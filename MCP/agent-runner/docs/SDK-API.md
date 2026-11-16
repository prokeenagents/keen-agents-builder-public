# ChatSDK — API reference

The Keen chat client the runner uses: the npm package `@keenagents/chat-sdk` 15.3.0 (`npm install` in this folder installs it; a client of your own adds it with `npm install @keenagents/chat-sdk@15.3.0`). Drive a flow, stream its progress, read the flow-tree, cancel it. `run.ts` is one thin consumer of this; build your own the same way.

```ts
import { ChatAPI, FlowError, CHAT_SETTINGS } from '@keenagents/chat-sdk';   // named exports only — there is no default export
import type { ChatAPIOptions, FlowTaskBundle, Envelope } from '@keenagents/chat-sdk';
```

Every type is exported from `@keenagents/chat-sdk` (see *Exported types* below); there are no global types to ship.

In Node, provide the browser `WebSocket` global before constructing (the SDK calls `new WebSocket(url)`):

```ts
import { WebSocket } from 'ws';
(globalThis as any).WebSocket = WebSocket;  // a subclass that passes { origin } when the Keen server allow-lists origins (run.ts does this)
```

## Construct

```ts
const chat = new ChatAPI({
  url: string,           // REQUIRED, no default: the Keen server WS, wss://<host>/ws-keen
                         // (e.g. 'wss://keen.example.com/ws-keen'). Missing or blank → the constructor throws a TypeError
  spaceID: string,
  agentID: string,       // the agent SLUG
  userId: string,        // must equal the token's (sealed) sub
  email: string,         // presence-checked by the Keen server
  projectID?: string,    // default: spaceID
  accessToken: string,   // consumer access_token
  cookies?: string[] | Record<string, string>,
                         // forwarded to script nodes on the initial run (system/cookies): a list of
                         // NAMES is an allow-list read from the browser's document.cookie ([] = none,
                         // omitted = every JS-readable cookie; HttpOnly never visible); an explicit
                         // { name: value } MAP is used as-is with no browser (run.ts builds it from --cookie / KEEN_COOKIES)
  contextBatchSize?: number,
                         // parallelContext clones drained per wave; default CHAT_SETTINGS.CONTEXT_BATCH_SIZE (15);
                         // only a positive integer is honoured
  onAuthExpired?: () => Promise<string | null>,
                         // the token refresher: called once per `token` refusal of a resume, and once per
                         // node visit on an E3002 reply. A string becomes the access token (the resume / the
                         // node is re-sent at once); null ends the run with `Invalid token`. A throw is retried
                         // after the backoff. run.ts passes one that answers null (it cannot mint a token).
  errors?: ErrorPolicies,
                         // this chat's error policy — see *Error policy* below; a bad key or value throws here
});
```

## Lifecycle (the canonical order)

```ts
chat.onStream((event, data, requestId) => { /* live progress */ });
chat.connect();                       // 1. open the WS (async handshake)
const cid = await chat.whenReady();   // 2. wait for the Keen server's welcome (assigns the connection cid)
const tree = await chat.runFlow({ chatId, prompt });  // 3. drive one flow → resolves with the flow-tree
// … read tree …
chat.disconnect();                    // 4. close (cancels a still-running flow first)
```

Skipping `whenReady()` before `runFlow()` is the classic bug: `TaskQueue` mints a fallback cid the Keen server rejects as *"correlationId does not match connection cid"*.

## Methods

### Connection
- **`connect(): void`** — open the WebSocket. No-op if a socket is already constructed (or a reconnect is scheduled). In a browser it also arms the `pagehide` cancel (below).
- **`tryAgain(): Promise<boolean>`** — after `'unavailable'` (close 4401), on the user's next action: opens exactly ONE new socket and resolves `true` after a welcome (`'connected'`), `false` when the service is still unavailable (another 4401, or a close before a welcome). Resolves `true` at once when already connected. The SDK never retries on a timer; a plain `connect()` from `'unavailable'` does the same single attempt.
- **`disconnect(): void`** — **cancels a running flow first** (the Keen server no longer cancels on a close — it holds the flow for its grace so a dropped socket can resume — and a disposed `ChatAPI` can never resume), then closes the socket with 1000, stops reconnecting and disposes the response waiters and handlers. Clears the cid.
- **`isConnected(): boolean`** — socket open?
- **`isReady(): boolean`** — socket open AND bound to the flow's cid: false between a reconnect's `welcome` and its `resumed`. Run / cancel / ping frames go out only then.
- **`getStatus(): ConnectStatus`** — `'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'unavailable'`. `'unavailable'` = close 4401: the application's API key is stopped (see `tryAgain()` and the close table). `'reconnecting'` lasts from a drop until the new socket is ready — the resume included. Drive a UI Send-gate with it.
- **`whenReady(): Promise<string>`** — resolves with the connection cid once the Keen server's `welcome` frame arrives (immediately, if already known). **It never rejects and never settles if the socket closes before the welcome** (e.g. a refused origin) — always race it against a timeout or `onStatus('disconnected')`, as `run.ts` does (15 s). **Gate `runFlow` on this.**
- **`getCorrelationID(): string | null`** — the connection cid, or null before welcome. While a dropped socket resumes a running flow it stays the flow's (old) cid.
- **`getPromptLimit(): number | null`** — the longest prompt, in characters, the Keen server accepts: `welcome.limits.promptChars` (**20000** today, one limit for the whole platform), or null until a welcome carried it (an older server sends none). Use it for a counter and to stop the send. A longer prompt is refused by the server with **`E2101`** (see *Prompt limit* below).
- **`getUrl(): string`** — the WebSocket URL given at construction.
- **`setCorrelationID(cid): void`** — force a cid (only for a server that sends no welcome; normally untouched).

### Running
- **`runFlow(input: RunFlowInput): Promise<ReadonlyMap<string, FlowTaskBundle>>`** — drive ONE flow to completion. Resolves with the flow-tree (below). Rejects with:
  - a **`FlowError`** — the Keen server answered a final code (see *Errors*): `.code` is the envelope's code, `.message` its message (or the code when it has none), `.details` its particulars when sent;
  - `Error('TaskQueue cancelled')` — the user's `cancel()`;
  - a `ConnectionLostError` — the connection can no longer drive the flow (see *Reconnect and resume*);
  - a `FatalSendError` — an outbound frame over `MAX_FRAME_BYTES`;
  - `Error('failed to send after 10 attempts')` — the run frame could not reach a ready socket.

  The SDK does all orchestration (per-node sends, parallel fan-out, retries); the engine is a pure function.
  ```ts
  interface RunFlowInput { chatId: string; prompt: string; userId?; email?; projectId?; agentId?; }
  ```
- **`isRunning(): boolean`** — a run in flight?
- **`onRunning(handler): Unsubscribe`** — fires `true` when a run starts, `false` when it settles (success / throw / cancel). Pair with `onStatus`: `canSend = status === 'connected' && !running`.
- **`onSummarizing(handler: (active: boolean) => void): Unsubscribe`** — the chat is being compressed. Fires `true` when the SDK dispatches a node task of kind `summarizerNode` (the Summarizer node runs as its own step of the flow), `false` when that task settles — its reply, an error, a cancel, or the flow's end; it is never left at `true` (`runFlow`'s exit resets it). Counted per task, so parallel bundles cannot switch it off early; a Fallback chain of Summarizers gives `true, false, true, false`. The flow is still running meanwhile (`isRunning()` stays `true`, so Send stays off): show a line such as "Compressing the conversation…" while it is `true`. Its type is the exported `SummarizingHandler`.

### Streaming & events (all return an `Unsubscribe`)
- **`onStream((event: string, data, requestId?) => void)`** — every engine → user progress frame (token text, `<SYSTEM CALL>` directives). The live view. **This is the "hook"** a headless runner turns into stdout.
- **`onStatus(handler)`** — connection status changes.
- **`onSystem(handler)`** — socket-level notes (open / close / error / parse failure / reconnect / resume) as plain strings.
- **`onWelcome(handler)`** — fires with `{ correlationID }` when a socket becomes ready on a NEW cid (not after a resume).
- **`onResume(handler)`** — fires with `{ correlationID, detachedMs }` when a dropped socket resumed the running flow on its old cid. The token stream emitted while the socket was away is **not** replayed: re-read the chat history when the resumed turn ends.

### Stopping (cancel)
- **`cancel(): void`** — THE consumer-facing cancel. Stops the local drain loop, sends the `cancel` frame for the run's cid (the Keen server wipes that cid's `dict` / `session` / `agentState` / queue, so a half-run leaves nothing behind) and clears local state; the pending `runFlow` promise rejects with `TaskQueue cancelled` **at once**. It also covers the start: a cancel before the first reply is sent for the run frame's cid. Safe to call when idle. While reconnecting the cancel is **deferred**: the next socket resumes the cid (that proves ownership) and then sends it; if the client never gets back, the Keen server's grace ends the flow.
  ```ts
  chat.cancel();                     // cancel the current run
  ```
- **A final error code cancels too.** When a node (or the run frame) is answered with a final code, the SDK ends the run itself — every other node of the run stops retrying, `runFlow` rejects with the `FlowError`, and the cancel frame goes out for the cid (deferred the same way while reconnecting). You need not send one yourself.
- **`sendCancel(correlationID?: string): boolean`** — low-level: fires ONLY the cancel frame (defaults to the connection cid), no local cleanup. Returns `false` if the socket is not ready or no cid is known (a resumable cid then gets the cancel deferred to after the next `resumed`). Do **not** use it to stop a run from your own client — the drain loop keeps going and the run ends only when a reply carries a final code. `run.ts` calls `cancel()` then `disconnect()` on `SIGINT` and exits `130` — so Ctrl+C really stops the flow on the engine, not just the client.

### Low-level (not needed by a runner)
- **`onResponse(handler)`** — every response envelope · **`waitFor(requestId, timeoutMs?)`** — the pending-reply promise (default timeout `RESPONSE_TIMEOUT_MS`) · **`send()` / `sendNodeTask()` / `sendContextRun()`** — the raw frame senders `TaskQueue` uses; each takes `opts.requestId` (the node-visit id) and mints one only when none is given · **`sendMessage()`** — send + waitFor in one · **`sendPing()`** — one heartbeat frame · the parts `wsConnectApi`, `responseApi`, `sendRequestApi`, `taskQueue` (readonly fields) and `errorPolicies` (the validated policy table).
- The package also exports the parts themselves — `WSConnectAPI`, `ResponseAPI`, `SendRequest`, `TaskQueue` — for advanced composition only.

### Token refresh
- **`setAccessToken(accessToken: string): void`** — replace the bearer used inside every subsequent run / continuation frame WITHOUT tearing down the socket (the Keen server verifies it per frame). Call it when a token is about to expire during a long session. The current connection / cid is preserved. Without `onAuthExpired`, a resume refused `token` waits for exactly this call (a CHANGED token) and then re-sends the resume.
- **`ChatAPIOptions.onAuthExpired`** — see *Construct*. It also serves an `E3002` reply on the first prompt or a node: refresh once (one renewal shared by every node refused at the same moment), then retry the SAME request / visit id; a second `E3002` on that visit is final (`FlowError`), and a null refresh ends the run with a `FlowError` `Invalid token` (code `E3002`). Without the hook `E3002` is final at once, as `E3101` always is. The run frame (the first prompt) does not call the hook: an `E3002` there is final.

### Heartbeat
Automatic. While a `runFlow` is in flight `TaskQueue` fires `chat.sendPing()` (`{ protocol: 2 }`) every `CHAT_SETTINGS.HEARTBEAT_INTERVAL_MS` (5 s) to refresh the engine-side TTLs (dict / session / agentState), and stops on settle. A protocol-2 Keen server answers each with a `pong`; 15 s with no inbound frame while a run is active closes the socket (4000) and reconnects. You do not call it yourself.

## Errors (`FlowError`) and retries

The SDK follows the Keen relay's own rule. **Every error code is FINAL except the `E4…` and `E7…` families** (`isFinalErrorCode`, `isRetriedErrorCode`, `RETRIED_ERROR_FAMILIES = ['E4', 'E7']`, all exported from `@keenagents/chat-sdk`):

| Code family | Meaning | What the SDK does |
|---|---|---|
| `E4…` | nothing ran — an engine refused at admission (busy, no engine free, an account limit) | **retried** |
| `E7…` | a timeout / a transport error | **retried** |
| every other (`E2…` request / the agent's project, `E3…` auth, `E5…` a resource, `E6…` a system / flow problem, `E8…` cancelled, an unknown code) | final: the relay keeps that reply and answers every re-send of the same request with it | the run **ends at once**: `runFlow` rejects with a `FlowError`, every other node stops, the cancel frame goes out |

One edge the table does not cover: a non-success reply with no code string at all is final on the run frame but, on a node, is retried like `E4…` / `E7…` (`isFinalErrorCode` answers `false` for it).

How the retried families are re-sent, without a policy:

- **A node** (every node of a started flow, its start node and every `initial: true` node included): without a limit, after an exponential backoff with full jitter — random in `[0, min(10 s, 1 s × 2^(n−1))]` for the n-th failure in a row, reset when the node succeeds. An `E4…` refusal's `retryAfterMs` (top level or under `details`) is used instead, capped at 10 s. A send that could not be delivered, or a reply that did not come within `RESPONSE_TIMEOUT_MS`, is retried the same way.
- **The run frame** (the first prompt — until it is accepted, the flow has not started): up to `INITIAL_MAX_RETRIES` (10) attempts in all, 1 s apart; a refusal that names a `retryAfterMs` is waited instead, when it is up to `RUN_FRAME_RETRY_AFTER_MAX_MS` (60 s) — a longer one ends the run at once with the refusal. After the last refusal the run ends with a `FlowError` carrying it.

```ts
try {
  await chat.runFlow({ chatId, prompt });
} catch (err) {
  if (err instanceof FlowError) console.error(err.code, err.message);   // e.g. E2201 — the agent's project; E3002 — the token
}
```

`run.ts` prints exactly this: `run FAILED: <code> <message>`, exit `1`.

## Error policy (`errors`)

A per-chat override of how often and how far apart the **retried** families are re-sent. The runner does not expose it; a client of your own sets it at construction (`KeenChat` passes it through as is):

```ts
const chat = new ChatAPI({ url, /* … */, errors: { "4XXX": { delay_ms: '5000', max_retry: 5 } } });
```

- **Keys** — one code or a family: four characters of digits or `X` after an optional `E` (`"4XXX"` = `"E4XXX"` = every `E4…`; `"40XX"`; `"4001"` = `"E4001"`); `X` = any digit, lower-case `x` / `e` accepted. When several keys match a code, the **most specific** wins (fewest `X`; on a tie, a digit beats an `X` read left to right).
- **Fields** — `max_retry`: how many re-sends for a code under the key, counted per node visit (and per start for the run frame), then the failure is final (a `FlowError`, the cancel goes out); `0` = final at once; absent = the default (unlimited on a node, the run frame's own budget). `delay_ms`: the pause before each re-send, ms; absent = the default pause; a server `retryAfterMs` still wins when larger (on a node within its 10 s cap; on the run frame when it is not over 60 s). Both take a number or a numeric string (`'5000'`); `max_retry` must be a whole number ≥ 0, `delay_ms` a number ≥ 0.
- **Refused at construction** (a `TypeError` naming the key): a non-object `errors`, a key that is not four digits / `X`, two keys naming the same codes (`"4XXX"` and `"E4XXX"`), a policy that is not an object, an unknown field, a bad `max_retry` / `delay_ms`.
- **Warned, not applied** (one `console.warn`): a key on a final family (`E2…`, `E3…`, `E5…`, `E6…`, `E8…` …) — re-sending a final code cannot help — unless it is `max_retry: 0` (already true, no warning). An `X`-led key with `max_retry > 0` is kept, with a warning that it applies to `E4…` / `E7…` only.
- A policy can make an `E4` / `E7` code final sooner; it can never make a final code retried.

## KeenChat — the minimal wrapper

`KeenChat` is everything needed to connect a consumer to an agent and chat, and nothing else — no network call at construction, only the WebSocket on `connect()`.

```ts
import { KeenChat } from '@keenagents/chat-sdk';

const chat = new KeenChat({ ws: 'wss://keen.example.com/ws-keen', token, email });   // ws is REQUIRED (blank → TypeError)
chat.onStream((event, data) => render(event, data));
chat.connect();
const tree = await chat.run({ agentId, spaceId, chatId, prompt });                    // agentId = the agent SLUG
```

- **Config** (`KeenChatConfig`): `ws` (required), `token`, `email`, `userId?` (default: the token's `sub` claim, read without verifying — what the Keen server checks `userContext.userId` against), `host?` and `origin?` (informational; never used by the wrapper), `errors?` (passed to `ChatAPI` as is).
- **Methods**: `connect()`, `disconnect()`, `setToken(token)` (= `setAccessToken`), `onStream`, `onStatus`, `onSystem`, `run(input: KeenChatRun)` (= `runFlow` with `projectId: spaceId`), and **`cancel(): boolean`** — the FULL cancel (`ChatAPI.cancel()`): the local run stops at once (`run()` rejects `TaskQueue cancelled`) and the cancel frame goes out; returns `true` when a run was in flight. `api` is the underlying `ChatAPI`.
- When the token has no readable `sub` claim, the default is `''`: pass `userId` explicitly, as `run.ts` does with `--user-id` (its README explains why a consumer token needs it).

## Prompt limit (E2101)

The user's prompt is limited to **20 000 characters** (UTF-16 units, the same as a browser's `maxlength`), for every agent on the platform. The Keen server checks it on the run frame, before anything is dispatched or stored, and answers with an error frame (the flow fails with that error; no node runs):

| Code | Message | When |
|---|---|---|
| `E2101` | `The message is too long (at most 20000 characters).` | the prompt is longer than the limit |
| `E2101` | `The message must be text.` | the prompt is not a string |

The limit is announced in the `welcome` frame: `limits: { promptChars: 20000 }` (additive; older servers send no `limits`). The SDK keeps it and `getPromptLimit()` returns it, so a chat UI can show a counter and stop the send; the server's check is the rule. Only the user's prompt is limited, not the prompts a flow sets itself. `E2101` is final: `runFlow` rejects with a `FlowError` (`.code === 'E2101'`) and the SDK does not re-send it.

## Reconnect and resume (Keen 15.3)

A dropped socket never ends a started flow. The Keen server detaches the flow's cid for a grace (120 s by default) instead of cancelling it, and the SDK:

1. **Reconnects** after a close it did not ask for (not `disconnect()`, not 4409, not 4401), once the instance has seen a welcome: the pause before attempt *n* is random in `[0, min(10 s, 1 s × 2^(n−1))]` — full jitter, caps 1 → 2 → 4 → 8 → 10 s, no attempt limit; a relay restart (1012) waits 0–1 s. A close before the first welcome stays `disconnected` (a bad URL or origin fails fast).
2. **Resumes**: if a flow runs on the old cid, it ran a frame, the SDK holds the cid's resume token and the server speaks protocol 2, the new socket's first frame is `resume { correlationId, resumeToken, userContext }`. The socket is not ready until `resumed` (rotated resume token).
3. **Re-sends** every frame still awaited, in the original order, each with its **original requestId** and the current token. A node visit keeps ONE requestId for all its retries and re-sends, so the server answers a re-send from its reply buffer or joins the dispatch in flight rather than running the node again.

The resume token lives in memory only — never in a URL, storage or a log line. There is **no resume across a page reload**: in a browser a `pagehide` that is not a bfcache entry cancels a running flow (best-effort); otherwise the grace ends it.

| `resume-refused` reason | What the SDK does |
|---|---|
| `token` (E3002) | `onAuthExpired` once → a string re-resumes at once, null fails the run (`Invalid token`); no hook → waits for `setAccessToken()` with a new token |
| `unavailable` | re-sends `resume` after the backoff, on the same socket (never a 6th on one socket: a new socket instead) |
| `gone` / `protocol` (or a reason this SDK does not know) | the run fails — except when only the run frame had been sent and no reply came: the start is re-sent on the new cid |

| Close | What the SDK does |
|---|---|
| 1000 (`disconnect()`) | no reconnect (a running flow was cancelled first) |
| 1012 (relay restart) | reconnect after 0–1 s and resume |
| 1008 (too many refused resumes) | reconnect with the backoff |
| 4409 (superseded) | no reconnect; the running flow fails; no cancel is sent |
| 4401 (service unavailable: the API key is stopped) | status `'unavailable'`, no reconnect, no timer, no cancel, `onAuthExpired` not called; the running flow fails with `The service is temporarily unavailable` (a `ConnectionLostError`, code `E3002`, not restartable); a close before a welcome while `'unavailable'` stays `'unavailable'`; the next `connect()` / `tryAgain()` makes ONE attempt |
| 4000 (SDK liveness) | reconnect and resume |
| any other (1006 …) | reconnect with the backoff and resume |

**System messages** (`onSystem`): `close (code 1006) — reconnecting in 0.6 s (attempt 1)` · `resumed — correlationID X after 8.4 s` · `resume refused (token) — waiting for a new access token` · `resume refused (gone) — the server no longer holds this flow` · `resume refused (unavailable) — retrying in … s`.

**Failure texts** (the contract, `CONNECTION_LOST_TEXT`; the error is a `ConnectionLostError`, and the run sends no cancel for it):
- `connection lost — the server no longer holds this flow` — `gone` / `protocol` (the grace ran out, or a cancel came first)
- `connection taken over by another session` — close 4409
- `connection lost — this Keen server cannot resume a flow` — a drop during a running flow on a server whose welcome has no `protocol` (the socket still reconnects for the next turn)
- `The service is temporarily unavailable` — close 4401
- `Invalid token` — a token refusal of a resume whose refresh answered null

While offline the SDK keeps trying at the 10 s cap with no limit: the end of a started flow always comes from a server answer (or the user's cancel), never from a client timer.

## The flow-tree (`runFlow`'s resolution)

`ReadonlyMap<string, FlowTaskBundle>`, keyed `${correlationId}_${sessionId}_${flowId}`, where:

```ts
type FlowTaskBundle = {
  flowTask: FlowTask;      // the flow's metadata: userContext, rootFlowContext,
                           // rootAgentContext, chatContext, flowContext (entry, completed), options
  nodeTasks: NodeTask[];   // every node that ran in this flow
};
```

Each `NodeTask` carries its `nodeContext` (`kind` e.g. `startNode`/`scriptNode`/`agentNode`/`endNode`, `id`, `initial`), its request fields, and its **`response`** — the node's output envelope: `{ code: 'E1001', success: true, data: {…} }` on success (for an `agentNode` the LLM fields sit under `data.response`: `{ text, role, model, provider, usage: { inputTokens, outputTokens }, finishReason }`, next to `data.nodeTasks`), or an `E….` error code on failure. The `endNode` response carries `{ final: true, flowContext }`.

A parallel flow appears as MULTIPLE bundles in the map (one per sibling / context clone), each with its own `flowId` + `sessionId`.

## Exported types

Every type the package has, exported from its entry — import them with `import type { … } from '@keenagents/chat-sdk'`. The main ones: `ChatAPIOptions`, `ErrorPolicy`, `ErrorPolicies`, `RunFlowInput`, `FlowTaskBundle`, `FlowTask`, `NodeTask`, `Envelope`, `InboundFrame`, `OutboundFrame`, `InitialRunPayload`, `NodeTaskRequest`, `ContextRunPayload`, `UserContext`, `ChatContext`, `RootFlowContext`, `RootAgentContext`, `FlowContext`, `NodeContext`, `WelcomePayload`, `ResumedPayload`, `ResumeRefusedPayload`, `ConnectStatus`, and the handlers `StreamEventHandler`, `StatusHandler`, `SystemHandler`, `ResponseHandler`, `RunningHandler`, `SummarizingHandler`, `WelcomeHandler`, `ResumeHandler`, `FlowUpdateHandler`, `Unsubscribe`. Beside them, from their own files: `KeenChatConfig`, `KeenChatRun`, `ConnectHost`, `ExecuteOptions`, `RunPayload`, `ResolvedErrorPolicy`.

## Settings

`CHAT_SETTINGS` (read-only constants; there is no default WebSocket URL — `url` is required): `RESPONSE_TIMEOUT_MS` (600 s), `RETRY_DELAY_MS` (1 s — the transport loop and the run frame's refusal retries), `RUN_FRAME_RETRY_AFTER_MAX_MS` (60 s — the longest `retryAfterMs` the run frame waits; a longer one ends the run at once), `RETRY_BASE_DELAY_MS` (1 s) + `RETRY_MAX_DELAY_MS` (10 s — every node's `E4…` / `E7…` retries back off 1 → 2 → 4 → 8 → 10 s with full jitter without a limit, reset per node; an `E4` `retryAfterMs` hint is honoured up to 10 s), `HEARTBEAT_INTERVAL_MS` (5 s), `CONTEXT_BATCH_SIZE` (15), `INITIAL_MAX_RETRIES` (10 — the run frame only: its transport retries and its `E4…` / `E7…` replies, then `runFlow` rejects with a `FlowError`), `MAX_FRAME_BYTES` (8 MiB — a larger outbound frame throws a non-retryable `FatalSendError` up front instead of retrying forever), `RECONNECT_BASE_MS` (1 s) + `RECONNECT_MAX_MS` (10 s) — the reconnect backoff, `RESTART_JITTER_MS` (1 s — after a 1012), `LIVENESS_MS` (15 s), `RESUME_MAX_ATTEMPTS_PER_SOCKET` (5), `PROTOCOL` (2). Per instance you set `url` (required), `cookies`, `contextBatchSize`, `onAuthExpired` and `errors` via `ChatAPIOptions`; the rest are constants.
