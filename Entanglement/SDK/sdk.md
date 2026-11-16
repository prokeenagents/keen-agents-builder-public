# The chat SDK — what it is and how a run works

The chat SDK is the TypeScript client that lets an end user (a *consumer*) chat with a Keen agent. It runs in the
person's **browser** (or a Node ≥ 22 process). It is the run's **coordinator**: the browser drives the run, the server
executes **one node per request**. The server never runs a whole flow on its own.

It is the npm package **`@keenagents/chat-sdk`**, version **15.3.0** (the version follows the Keen release whose
protocol it speaks): `npm install @keenagents/chat-sdk`, `import { ChatAPI } from '@keenagents/chat-sdk'`. Its code,
tests and npm README: [`package/`](package/README.md). **Published on npm since 2026-11-15** (only the built
package — minified JavaScript, types, README; the source repository is private, the built one is
`prokeenagents/chat-sdk-public`). The package started as a copy of the reference partner site's SDK
(`src/service/services/chat/`, last changed 2026-11-09) and differs from it in: the types are exported (no global
`App.Chat`), the WebSocket `url` is required (no default), the final codes = the relay's (every code except `E4…` /
`E7…`) and the kill-on-final-error behaviour, the per-chat error policy (`errors`), `KeenChat.cancel()` as the full
cancel, the first prompt honouring `retryAfterMs`, no `unauthorized` status. **The reference site's own copy, before it switches to the package, still behaves the old
way** (see [errors.md](errors.md)).

The base site (`../site/`) uses the package; its old copy of the SDK and that copy's `HOW_TO_USE.md` are gone. A site
that still carries the old copy: see [using.md](using.md) § *Old statements* for where that how-to is out of date.

## The whole process, end to end

```
 person ──types──▶ browser: ChatAPI / TaskQueue (holds the run's progress: which node is next, which flows are open)
                        │  wss://keen.example.com/ws-keen   (one WebSocket per chat, Origin = the site's origin)
                        ▼
                  Keen relay  (checks origin, token, space, agent; one dispatch per request id; streams text back)
                        │  NATS, one request = one node
            ┌───────────┼──────────────┐
            ▼           ▼              ▼
       flow engine   LLM engine    script engine   (run ONE node, write the run's stores, answer: status + next node(s))
            └───────────┴──────────────┘
                        │  dictionary / session / channels / agent state of the run live HERE (Dragonfly, 60 s TTL)
```

1. **The person types** and presses Send. The site calls `chat.runFlow({ chatId, prompt })`.
2. **The socket is ready.** On open, the relay sent a `welcome` frame with the connection's correlation id (`cid`),
   a resume handle and the prompt limit. Every flow of this connection runs on that `cid`.
3. **The run frame.** The SDK mints a session id and a request id, stamps the person's access token and cookies, and
   sends one `run` frame (the agent's **slug**, the space, the chat id, the prompt). This is the only frame that may be
   refused (a busy server): it is tried up to 10 times, 1 s apart — or after the refusal's own `retryAfterMs`, up to
   60 s.
4. **The relay checks** the token (on every frame), the user id against the token, the space against the token's
   spaces and the contract, and the agent in the space; then it asks the engine over NATS.
5. **The engine runs the Start node** and answers with the root bundle: the flow's identity and the next node task(s).
6. **The SDK sends each next node** as its own `run` frame. One engine runs that one node, writes what the node changed
   (dictionary, session, channels) and answers with the next node(s) — or a new flow (Run Flow, Jump Flow, a tool, a
   Parallel Flows branch, a Parallel Context run) that the SDK then drives the same way.
7. **Text streams meanwhile.** While an LLM node writes, the LLM engine publishes `token` frames; the relay forwards
   them to the socket that owns the `cid`. They are a live preview; each LLM node's **result** (its whole answer, its
   token use, its agent's name) arrives in that node's reply.
8. **The end.** When the root flow's End node answers `{ final: true, flowContext }` and every child flow has ended,
   `runFlow` resolves with the whole flow tree. The final answer is the console agent's answer on the run's own
   session; every other LLM answer is a helper the site may show folded.

Who holds what:

| Where | What it holds | For how long |
|---|---|---|
| the browser (TaskQueue) | the run's progress: every bundle, which node is pending / running / done, the request id of each visit | the run; a reload loses it |
| the relay (Dragonfly) | the `cid`'s owner socket, a lease per (cid, request id), a reply buffer while the socket is away | while the flow runs; a dropped socket's flow is held for the grace (120 s by default) |
| the engines (Dragonfly) | the run's dictionary, session, channels, agent state, cookies | 60 s from the last touch — the heartbeat and every node visit renew it |
| chat history (Postgres) | the saved exchange: the prompt and the answering node's final answer, plus helpers that interact with the DB | permanent |

Two mechanisms keep this safe:

- **The heartbeat.** Every 5 s while a run is in flight the SDK sends `ping`; the relay renews the engines' 60 s TTLs on
  the `cid` (and answers `pong`, which the SDK's 15 s liveness check reads). A slow LLM or a long Script never lets the
  run's stores expire.
- **The stable request id.** Each node **visit** gets one request id for its whole life — every retry and every re-send
  after a reconnect carries it. The relay keeps a lease per (cid, request id): a re-send joins the dispatch already
  running, or is answered from the reply buffer, so a node is never run twice by a retry.

**Errors: what ends a run and what is retried.** Only `E4…` (an overloaded engine — nothing ran) and `E7…` (a timeout,
a transport error) are re-sent — a node without a limit by default; every other failure is final (the relay replays it
from its reply buffer) and kills the flow with a `FlowError`. A site sets a **per-chat error policy** when it creates
the chat — `errors: { "4XXX": { delay_ms: '5000', max_retry: 5 } }` — to give up sooner or pause longer:
[setup.md](setup.md) §8 *Error policy per chat*; every code: [errors.md](errors.md).

## The parts

Files are under `package/src/`; every name below is exported from `@keenagents/chat-sdk`.

| Part | File | One line |
|---|---|---|
| the entry | `index.ts` | exports everything below |
| `ChatAPI` | `chat-api.ts` | the only class a page uses: construct, connect, `runFlow`, `cancel`, subscriptions, token refresh |
| `KeenChat` | `keen-chat.ts` | a minimal wrapper `{ ws, token, email }` → `run({ agentId, spaceId, chatId, prompt })` |
| `WSConnectAPI` | `connect.ts` | the WebSocket: welcome, status, reconnect + resume, liveness, the 4401 / 4409 closes |
| `ResponseAPI` | `response.ts` | routes inbound frames: an envelope → the waiter of its request id; no envelope → `onStream` |
| `SendRequest` | `send-request.ts` | sends one `run` frame (transport retry, the 8 MiB cap) and keeps unanswered frames for a re-send |
| `TaskQueue` | `task-queue.ts` | the coordinator: the bundle tree, node by node, child flows, parallel waves, retries, the kill on a final code, heartbeat, cancel |
| `CHAT_SETTINGS` | `settings.ts` | every constant (retries, heartbeat, wave size, reconnect, liveness) — no URL: the URL is required per instance |
| utils | `utils.ts` | request ids (v4 UUIDs), cookies, backoff, `isFinalErrorCode` / `isRetriedErrorCode` / `RETRIED_ERROR_FAMILIES`, `FlowError`, `FatalSendError`, `ConnectionLostError`, `CONNECTION_LOST_TEXT` |
| the error policy | `error-policy.ts` | `ErrorPolicyTable`: validates `ChatAPIOptions.errors` at construction, picks the most specific key for an `E4…` / `E7…` code ([setup.md](setup.md) §8) |
| the types | `types.ts` | every frame, payload, bundle and handler, exported by name (`Envelope`, `FlowTaskBundle`, …; the site's copy has them as the global `App.Chat.*`) |

The package has **no runtime dependencies** and only relative imports. Keep it that way. Its tests (vitest, a fake
relay socket, no network) are in `package/test/`; `npm run typecheck`, `npm test`, `npm run build` in `package/`.

## Where it runs

In a site: in the browser only. The page builds the `ChatAPI` in an effect (never during render, never in a
server-side render — the chat belongs to the person's tab) and closes it on unmount. A headless caller (a test, a
runner) can use it in Node ≥ 22, with a `WebSocket` that sends an allow-listed `Origin` ([setup.md](setup.md) §3). The WebSocket goes from the browser **straight to Keen's relay**, not
through the site. The site's server does only what needs a secret: it mints and rotates the end user's tokens (the
refresh token is an httpOnly cookie) and reads chat history through Keen.

## What the site builds on it

| Feature | Built from |
|---|---|
| the chat (`components/ui-chat/chat-shell`) | `onStatus`, `onRunning`, `onSummarizing`, `onStream` (`token` into one bubble), `runFlow`, `cancel`, `tryAgain`, `getPromptLimit` |
| the run trace (the folded "steps") | today from the stream: `components/ui-chat/chat-messages/turns.ts` — events and `<SYSTEM CALL>` fences become steps, the prose after the last tool call is the answer |
| helpers vs. the final answer by node | the flow tree: each LLM node's reply carries `response.text`, `response.usage`, `responseType`, `agentName` ([using.md](using.md) § *Final answer and helpers*) |
| history | the site's `/api/chat/history?chatId=` → Keen; re-read after a resumed turn (the stream during a gap is not replayed) |

## Files in this folder

| File | Read it when |
|---|---|
| [setup.md](setup.md) | the URL, the token and its refresh, the origin, the ids a chat is opened for, cookies, reconnect / resume, tabs, the per-chat error policy (§8) |
| [using.md](using.md) | the public API, every event and what it carries, final answer vs helpers, token use, examples |
| [task-queue.md](task-queue.md) | the coordinator in depth: bundles, visits, retries, child / tool flows, parallel waves, heartbeat, cancel, tab close |
| [protocol.md](protocol.md) | every frame the SDK sends and receives, with JSON |
| [errors.md](errors.md) | every status code: who sends it, final or retried, what to show, what to check |

Related: [../SKILL.md](../SKILL.md) (the site), [../setup.md](../setup.md) (its `.env.local`),
[../../AgentArchitecture/references/building-blocks.md](../../AgentArchitecture/references/building-blocks.md) (f)
(what the person sees from each LLM node), [../../Flow/Nodes/SKILL.md](../../Flow/Nodes/SKILL.md) (*How a run works*).
