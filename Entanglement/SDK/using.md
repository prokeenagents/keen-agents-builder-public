# Using the SDK

The public surface a site's code uses, what each event carries, how to tell the final answer from helper answers, and
examples. Entry: [sdk.md](sdk.md). Frames in detail: [protocol.md](protocol.md). Codes: [errors.md](errors.md).

## 1. The public API — `ChatAPI` (`chat-api.ts`)

```ts
import { ChatAPI } from '@keenagents/chat-sdk'; // the site's own copy: import ChatAPI from '@/service/services/chat'

const chat = new ChatAPI({
    url: 'wss://keen.example.com/ws-keen', // required — the constructor throws without it
    spaceID: '<space id>',                 // projectID defaults to it
    agentID: '<agent slug>',               // the default agent of runFlow
    userId: '<token sub>',
    email: '<token e-mail>',
    accessToken: '<consumer access token>',
    onAuthExpired: refreshToken,           // () => Promise<string | null>
    errors: { "4XXX": { delay_ms: '5000', max_retry: 5 } }, // optional: this chat's error policy (setup.md §8)
    // cookies?: string[] | Record<string, string>; contextBatchSize?: number
});
```

| Call | What it does |
|---|---|
| `connect()` | opens the socket (no-op if one exists); in a browser it also arms the tab-close cancel |
| `whenReady()` | resolves with the `cid` on the welcome; **never rejects** — race it with a timeout or `onStatus` |
| `runFlow({ chatId, prompt, agentId?, projectId?, userId?, email? })` | runs one turn to the end; resolves with the flow tree (`ReadonlyMap<key, FlowTaskBundle>`); rejects on a final error, a lost connection or a cancel. One at a time: a second call while running throws `TaskQueue already running — call clear() or cancel() first` |
| `cancel()` | **the** stop: ends the local run at once (`runFlow` rejects `TaskQueue cancelled`) and sends `cancel` for the `cid` (deferred until the next `resumed` while reconnecting). A no-op when nothing runs |
| `setAccessToken(token)` | the token for the next frame; no reconnect |
| `tryAgain()` | after `unavailable` (close 4401): ONE new socket; `true` once welcomed |
| `disconnect()` | cancels a running flow first, closes with 1000, stops reconnecting, rejects waiters, **drops the `onStream` / `onResponse` subscriptions** (subscribe again after a new `connect()`) |
| `getStatus()` / `isConnected()` / `isReady()` / `isRunning()` | snapshots; `isReady` = open AND bound to the flow's `cid` |
| `getCorrelationID()` / `getPromptLimit()` | the `cid`; the prompt limit from the welcome (20 000 today, `null` before a welcome) |
| low level | `send`, `sendMessage`, `sendNodeTask`, `sendContextRun`, `waitFor`, `sendCancel`, `sendPing`, `setCorrelationID` — TaskQueue uses them; a page does not |

Subscriptions (each returns an `Unsubscribe`):

| Subscription | Fires |
|---|---|
| `onStatus(s)` | `disconnected` · `connecting` · `connected` · `reconnecting` · `unavailable`. The package has **no** `unauthorized`: the relay checks the token per frame, never at the socket, so a refused token is a refused frame (`Invalid token` on the run) and the socket stays usable. The site's copy still lists `unauthorized` in its type (never emitted) and its chat header colours it — drop that when it switches |
| `onRunning(b)` | `true` when `runFlow` starts, `false` when it settles — gate Send on `connected && !running` |
| `onSummarizing(b)` | `true` while a Summarizer node runs (the chat stays busy a few seconds; show "Compressing the conversation…") |
| `onStream(event, data, requestId?)` | every inbound frame **without** an envelope — the live stream (§2) |
| `onResponse(envelope, requestId)` | every reply envelope (every node's result) |
| `onWelcome({ correlationID })` / `onResume({ correlationID, detachedMs })` | a welcome / a resumed flow |
| `onSystem(text)` | the transport's narration (open, close with code, reconnecting, resumed, refusals) — a log, not UI |
| `chat.taskQueue.onUpdate(bundles)` | the live bundle map after every change (no `ChatAPI` delegate; read-only use) |

`KeenChat` (`keen-chat.ts`) wraps it: `new KeenChat({ ws, token, email, errors? })` (`ws` required), `connect()`,
`run({ agentId, spaceId, chatId, prompt })`, `onStream`, `onStatus`, `onSystem`, `setToken`, `cancel`, `disconnect`;
`api` is the `ChatAPI`. Its `cancel()` is the **full** cancel (`ChatAPI.cancel()`): the local run stops at once and the
cancel frame goes out; it returns `true` when a run was in flight, `false` (and sends nothing) when idle. The
reference site's own copy, before it switches to the package, still calls only the low-level `sendCancel()` there —
the frame goes out (even when idle) but the local run keeps driving an ended flow; on that copy use
`chat.api.cancel()`.

**In the next site version:** `onTruncated(info)` — fires once per LLM node reply whose `response.truncated` is `true`
(the answer was cut at the node's Max Tokens); `info = { nodeId, requestId, agentName, responseType }`. The current
site does not have it; the field is already on the wire (§3).

## 2. The stream — what each frame carries

A stream frame is `{ event, data: { text?, data? } }` — **only the text (and an optional `data`)**. It names no
node, no agent, no request id. You cannot tell from a `token` which LLM node wrote it.

| `event` | Sent by | `data` |
|---|---|---|
| `token` | the LLM engine, every chunk of **every** LLM node (helpers, tools, branches included; not the Summarizer) | `{ text }` — the delta |
| `thinking` | a Script (`system/chat` thinking) | `{ text }` |
| `message` | a Script (an interim message) | `{ text }` |
| `progress` | a Script (a sub-agent's progress) | `{ text, data: { subSessionId, current, total } }` |
| `error` | a Script (`system/chat` error) | `{ text }` — a message, **not** a failure of the run |
| `agentStart` / `agentStream` / `agentEnd` / `files` | a Script (sub-agent helpers) | `data` objects |
| `processing` | an emitter method nothing calls today | — |

A failed node is not a stream frame: it is the node's reply envelope (`success: false`) — see [errors.md](errors.md).

## 3. A node's result — final answer and helpers

Every node's reply is an envelope `{ success, code, message, data }`; the SDK stores it on the node task as
`node.response`. For an **LLM node** (`nodeContext.kind === 'agentNode'`) `data` is:

```json
{
  "response": { "text": "…the whole answer…", "role": "assistant", "model": "…", "provider": "…",
                "usage": { "inputTokens": 812, "outputTokens": 164 }, "finishReason": "…", "truncated": false },
  "responseType": "text",
  "agentName": "Support",
  "toolContext": null,
  "nodeTasks": [ … ]
}
```

- `responseType`: `text` (an answer), `tool` (the model wrote a `<SYSTEM CALL>` — a tool runs next and the node is
  called again with the result), `error` (the provider failed; `response.text` holds the error words and the flow went
  on through the node's Fallback edge, else its Out).
- **Token use** of a turn = the sum of `response.usage` over every agentNode task in the tree.
- **The final answer** is the answering LLM node's — the console agent's ID, on the run's **own** session and request
  (the engine saves only that one as the chat's row). A reply carries `agentName`, not the agent ID; identify it by
  the node task's `flowContext.sessionId` / `requestId` equal to the root flow's (`bundle.flowTask.rootFlowContext`),
  and take its **last** `text` reply (a tool round calls the same node again). Everything else is a helper.
- The reference site today folds by the **stream** instead (`turns.ts`): engine events and tool fences become steps,
  prose after the last tool call is the answer. Folding by node results is exact; folding by stream is a heuristic.

A **Script** reply carries `scriptName` and `returnValue` (the agent's secrets masked); the End node of the root flow
answers `{ final: true, flowContext }`.

## 4. Errors, cancel and the stopped service

`runFlow` rejects with an `Error` whose message is the envelope's `message` (or its code). Show it in an error row,
except `TaskQueue cancelled` (the person's own stop — a quiet "Canceled."). A **final** reply code rejects with a
`FlowError` (exported): the same `message`, plus `code` (e.g. `E2201`, `E6101`) and `details` — tell an agent project
error from a refused token by `err.code` instead of matching words. Which codes are final and what that does to the
run: [errors.md](errors.md) (`isFinalErrorCode(code)` answers it in code). In short: only `E4…` and `E7…` are
re-sent; everything else is final. A chat's `errors` policy can make `E4…` / `E7…` final sooner — then `runFlow`
rejects with a `FlowError` carrying that code ([setup.md](setup.md) §8).

The texts the SDK itself uses (`CONNECTION_LOST_TEXT`, a contract — match on them):

| Text | When |
|---|---|
| `The service is temporarily unavailable` | close 4401: the API key is stopped. Status `unavailable`; no reconnect, no timer. Show it with a **Try again**; the person's next Send calls `tryAgain()` once |
| `Invalid token` | a refresh answered `null` — sign the person in again |
| `connection lost — the server no longer holds this flow` | the resume was refused `gone` / `protocol` |
| `connection taken over by another session` | close 4409 |
| `connection lost — this Keen server cannot resume a flow` | a relay without resume dropped the socket |

## 5. Examples

**A minimal chat:**

```ts
chat.onStatus(s => setStatus(s));
chat.onRunning(r => setRunning(r));
chat.onStream((event, data) => {
    if (event === 'token' && typeof data?.text === 'string') appendToBubble(data.text);
    else if (typeof data?.text === 'string') addEventRow(event, data.text);
});
chat.connect();
await chat.whenReady();
try { await chat.runFlow({ chatId, prompt }); }
catch (err) { if ((err as Error).message !== 'TaskQueue cancelled') showError((err as Error).message); }
```

**Helpers folded, from the node results:**

```ts
const tree = await chat.runFlow({ chatId, prompt });
const llm = [...tree.values()].flatMap(b => b.nodeTasks.map(n => ({ b, n })))
    .filter(({ n }) => n.nodeContext.kind === 'agentNode' && n.response?.success);
const root = [...tree.values()][0]?.flowTask.rootFlowContext;
const isMain = ({ n }: typeof llm[number]) => n.flowContext.sessionId === root?.sessionId && n.flowContext.requestId === root?.requestId;
const final = llm.filter(isMain).map(x => x.n.response!.data as any).filter(d => d.responseType === 'text').at(-1);
const helpers = llm.filter(x => !isMain(x)).map(x => x.n.response!.data as any);   // agentName, response.text, response.usage
```

**A chat that gives up on a busy engine after ~25 s:**

```ts
import { ChatAPI, FlowError } from '@keenagents/chat-sdk';

const chat = new ChatAPI({ url, spaceID, agentID, userId, email, accessToken,
    errors: { "4XXX": { delay_ms: '5000', max_retry: 5 } } });   // 5 re-sends, 5 s apart; E7… keeps the default
try { await chat.runFlow({ chatId, prompt }); }
catch (err) {
    if (err instanceof FlowError && err.code.startsWith('E4')) showError('Busy right now — please try again in a minute.');
    else if ((err as Error).message !== 'TaskQueue cancelled') showError((err as Error).message);
}
```

**Cancelling:** `chat.cancel()` — `runFlow` rejects `TaskQueue cancelled` at once.

**Refreshing the token:** pass `onAuthExpired` — the SDK calls it when the relay answers `E3002` (the first prompt or
a node), once for all nodes refused together, and sends the same request again. No timer (setup.md §2).

## 6. Old statements in an older site's `HOW_TO_USE.md` (the base site no longer has it; the code wins)

- "No automatic reconnect" — the SDK reconnects and resumes by itself.
- "To refresh the token, construct a new ChatAPI" — use `setAccessToken` / `onAuthExpired`.
- "Heartbeat every 20s" — every 5 s.
- "The relay's handleDisconnect cancels the cid" — a close only **detaches** it for the grace; `ChatAPI.disconnect()`
  sends the cancel itself.
- "per-node max retries" — by default a node's `E4…` / `E7…` is retried without a limit (only the run frame is
  bounded); a chat bounds it with its `errors` policy. Every other code is final.
- `bundle.flowTask.completed`, `node.id` — the fields are `bundle.flowTask.flowContext.completed`,
  `node.nodeContext.id`; `import ChatAPI from './api'` — the module is the folder's `index.ts` (in the package:
  `import { ChatAPI } from '@keenagents/chat-sdk'`).
