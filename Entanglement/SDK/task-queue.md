# TaskQueue — the coordinator in depth

`task-queue.ts` drives one turn from the prompt to the end of every flow it opens. One TaskQueue per `ChatAPI`; one
run at a time. The server executes one node per request; everything about *which* node runs next and *when* is here.
Entry: [sdk.md](sdk.md).

## 1. The model — bundles and node tasks

- A **bundle** (`FlowTaskBundle`) is one flow instance: `flowTask` (its contexts: `userContext`, `rootFlowContext`,
  `rootAgentContext`, `chatContext`, `flowContext` with `flowId`, `sessionId`, `requestId`, `entry`, `completed`, and
  `options`; `toolFlow` for a tool's flow) plus `nodeTasks`.
- A **node task** is `{ flowContext, nodeContext: { id, kind, initial? }, options?, inProgress, ready, response? }`.
  `inProgress` / `ready` / `completed` are the **client's** state — the SDK forces them to `false` on every inbound
  task, whatever the server sent.
- Every bundle lives in one flat map under the key `<correlationId>_<sessionId>_<flowId>`. A parallel host node keeps
  the keys of its child bundles (`parallelFlowTask` / `parallelContextTask` as `string[]`).

The drain: while any bundle is not completed, every incomplete bundle is drained in parallel; draining a bundle fires
every pending task (`!inProgress && !ready`) in parallel and repeats until none is pending. A bundle is completed when
its End node answers the final signal, or when it has nothing pending and all its children are completed.

## 2. The run frame (the first prompt)

1. Re-entry guard: a second `run` while running throws.
2. The `cid` is the welcome's (a client-minted fallback only for a relay that sends no welcome).
3. `onRunning(true)` and the heartbeat start.
4. The payload: `userContext { userId, email, accessToken }`, `rootAgentContext { agentId, prompt }`,
   `chatContext { chatId, projectId }`, `flowContext { correlationId, sessionId, requestId }` (both fresh),
   `requestContext { cookies }`.
5. It is sent under **one request id** for all its attempts. A refusal `E4…` (busy, the account's limits, no engine)
   or an `E7…` (a timeout, a transport error) is re-sent up to **10 times, 1 s apart**, then `runFlow` rejects with
   the reply's message ("busy, try again in a minute"). When the refusal names its own wait — `details.retryAfterMs`
   of `too many prompts this minute for this account` — the SDK waits that long instead of 1 s (up to
   `RUN_FRAME_RETRY_AFTER_MAX_MS`, 60 s); a longer wait (`account blocked for new prompts`, 15 min by default) cannot
   be served by the next attempts, so `runFlow` rejects at once with it. A chat's **error policy** (§4) replaces the
   10 attempts with its `max_retry` and the 1 s with its `delay_ms` for the codes its key matches (a larger
   `retryAfterMs` still wins). Any other failure (a final code) rejects at once. If the socket dropped and the old
   `cid` is gone while nothing had started, the start is re-sent on the new `cid`.
6. The reply is the root bundle. No node tasks → the run ends at once.

Until the run frame is accepted the flow has **not started**. After it, it is always finished — only a final code
(§4), a lost connection or the person's cancel ends it.

## 3. Sending a node and waiting — one visit, one request id

For each pending task the SDK builds a `NodeTaskRequest`: the bundle's contexts, the current access token, a
`flowContext` with `correlationId`, `sessionId`, `requestId` (+ `flowId` for a non-root bundle, + `currentFlowId`,
`parentFlowId`, `parentSessionId`, `contextNumber` / `contextPath`, `correlationToken` when present), the
`nodeContext`, and `options` (the task's own, else the tool flow's `options` with its `toolContext`).

It mints **one visit id** (`r-<uuid>`) and keeps it for every attempt of this visit. On the relay a lease per
(cid, visit id) is the single-flight: a re-send while the node runs **joins** the running dispatch; a reply that came
while the socket was away is kept in a reply buffer and given to the re-send. So a retry never runs a node twice.

## 4. The two retry layers — and the chat's error policy

| Layer | Where | Retries | Pause |
|---|---|---|---|
| **transport** | `SendRequest.execute` | while the socket is not ready (closed, or reconnected but not yet `resumed`) | 1 s; the run frame 10 attempts, every node without a limit |
| **response** | `TaskQueue.runRegularNode` | a reply with an `E4…` / `E7…` code, a `waitFor` timeout (600 s), a dropped reply | full jitter, caps 1 → 2 → 4 → 8 → 10 s, reset per node; an `E4` `retryAfterMs` honoured up to 10 s; **no limit** by default |

**Final** (`isFinalErrorCode`) = **every code except `E4…` and `E7…`** — the relay's own rule (`retry-policy.ts`
`isFinalEnvelope`). The relay keeps every other reply in its reply buffer and answers
every re-send of the same visit id from it, so re-sending `E5…` / `E6…` (`E5001`, `E6001`, `E6101` …) could never
succeed: it would loop every second while the tab is open, and with a full buffer the node would run again. Retried:
**`E4…`** (nothing ran — an overloaded engine, free again in seconds) and **`E7…`** (a timeout / transport error).
While a node waits, the heartbeat (§8) keeps the run's memory alive. Two exceptions: `E3002` with `onAuthExpired` is
refreshed once per visit and retried with the same visit id; a frame over 8 MiB fails at once (and kills the flow like
a final code). (The relay has its own short retry of an engine's `E4` and of "no engine listening" before it answers.)

**The chat's error policy** (`ChatAPIOptions.errors`, [setup.md](setup.md) §8) acts on the **response** layer, for
`E4…` / `E7…` only:

```ts
new ChatAPI({ …, errors: { "4XXX": { delay_ms: '5000', max_retry: 5 } } });
```

- the reply's code picks the **most specific** matching key (`"4001"` beats `"40XX"` beats `"4XXX"`);
- `max_retry`: the visit re-sends at most that many times for codes under the key (a count per visit id and per key;
  a new node starts from 0); the next such reply is **final** — the same kill as below. `0` = final at once. On the run
  frame it replaces the 10 attempts;
- `delay_ms`: the pause before each of those re-sends, instead of the backoff (the run frame: instead of 1 s); a
  larger `retryAfterMs` still wins (capped at 10 s on a node, 60 s on the run frame);
- a policy on a final family is ignored (one console warning at construction) — the relay would replay the reply;
- the transport layer is not touched (a socket that is away is waited for, not counted).

**A final code mid-run kills the flow** (a flow problem means killing the flow directly). The
moment one node's reply carries a final code — or an `E4…` / `E7…` whose policy `max_retry` is used
up:
1. the run ends with that error **at once** — `runFlow` rejects with a `FlowError` (`message`, `code`, `details`),
   reported once;
2. the SDK sends the **cancel** for the `cid` (the same path as `cancel()`: deferred until the next `resumed` while
   reconnecting), so the server releases the flow's dictionary, session and queued work;
3. **no other node of the run keeps retrying**: every sibling's pause wakes, its waiter is rejected, and its loop
   returns at its next check; a sibling's late reply is ignored. The queue is free for the next `runFlow`.

So an empty Run Flow / Jump Flow target, a node missing from the project, or an LLM node whose setup fails (no agent
name / ID, an unknown model or provider) with no output wired now ends the turn with the engine's message instead of
spinning, and so does any `E5…` / `E6…`. **The reference site's own copy, before it switches to the package, still
retries every `E5…` / `E6…`** (the run spins until the person cancels) — so on it, keep building defensively: wire every LLM node's Out /
Fallback, never leave a Run / Jump target empty, run the validator before a deploy. See [errors.md](errors.md).

## 5. What a reply can be

| Reply `data` | The SDK |
|---|---|
| `{ final: true, flowContext }` with this bundle's four ids | marks the bundle **completed** (a tool's script flow also gets a client-only `virtualEndNode` for display) |
| `{ childFlows: [ bundle, … ], nodeTasks? }` (each child's `parentFlowId` = this bundle's `flowId`) | registers every child, drains them **all in parallel**, marks this node ready when all ended, **then** adds the parent's `nodeTasks` (never racing the children). A mismatched `parentFlowId` is a final error |
| `{ parallelContextTask: { flowTask, total }, nodeTasks? }` | clones the template `total` times and drains them in **waves of 15** (§7), then the parent's `nodeTasks` |
| `{ nodeTasks }` / `{ nextNodeTasks }` / a single node task | adds them to the bundle (a task id already pending is not added twice; a loop or Jump back to a node that ran adds a fresh task) |

## 6. Child flows and tool flows

- **Run Flow / Jump Flow** answer `childFlows`; the child runs on the calling flow's dictionary (`currentFlowId`).
- **A tool call** (an LLM node with `responseType: 'tool'`) answers `childFlows: [tool flow]` and, in `nodeTasks`, the
  same LLM node again with `options { toolResponse: true, promptMarker }`. The tool flow's `options` carry
  `{ toolContext, agentNode }`, which the SDK forwards on each of its nodes. A **Script tool** is one
  `virtualScriptNode` (the relay sends it straight to the script engine); its final signal ends the tool flow. A
  **flow tool** is the flow's real Start node. When the tool flow ends, the LLM node runs again with the result.
- Only the first `<SYSTEM CALL>` of an answer runs; an unknown tool or an unparsable block re-calls the LLM node with
  the error as a user turn (no child flow).

## 7. Parallel Flows and Parallel Context

- **Parallel Flows** — a node task arrives with `parallelFlowTask: [bundle, …]`: every branch is registered and drained
  at once, **no cap**.
- **Parallel Context** — `parallelContextTask: { flowTask: template, total }`: the SDK makes `total` clones (a fresh
  `flowId`, `sessionId`, `requestId`, `contextNumber = index`, the template's `contextPath` and `entry`; the parent's
  root contexts and chat), and drains them **15 at a time**: the next wave starts when the whole wave has ended
  (`contextBatchSize` overrides 15). The engine merges each clone's final dictionary back at its End node.

## 8. The heartbeat

From the start of `run` to its end the SDK sends `ping { protocol: 2 }` every **5 s**. The relay renews the engines'
dictionary / session / agent state TTLs (60 s) on the `cid` and answers `pong`. While a run is active a socket with no
inbound frame for 15 s is closed (4000) and reconnected — that catches a half-open TCP.

## 9. Cancel

`chat.cancel()`:
1. marks the run cancelled — every node loop stops at its next await, every waiter is rejected, every pause wakes;
2. sends `{ event: 'cancel', data: { correlationId } }` (one frame covers the whole tree; while reconnecting it is
   deferred until the next `resumed`);
3. the relay marks the `cid` ended and tells the engines, which drop the dictionary, session, agent state and queued
   work of the `cid`; the LLM engine marks a half-written answer cancelled in the history;
4. `runFlow` rejects `TaskQueue cancelled` **at once**.

A final code does the same at once (the SDK sends the cancel itself, §4). A lost connection does not (the `cid` is no
longer this socket's). Never use the low-level `sendCancel()` to stop a run: the local loop keeps going against an
ended flow. `KeenChat.cancel()` is the full cancel in the package (in the site's copy it is still `sendCancel()` only).

## 10. Completion

When no bundle is incomplete, the run returns a copy of the whole map and clears it; `onRunning(false)`, the
heartbeat stops, the Summarizer flag is reset. The next `runFlow` starts empty on the same `cid`.

## 11. When the tab closes

- **A close or a reload** (`pagehide`, not a back-forward cache entry): the SDK cancels the running flow, best effort
  — the cancel frame goes out if the socket is still ready. The run's state lives in the tab's memory, so it can never
  be resumed by another page.
- **If the cancel did not get out**, the relay sees the socket close and only **detaches** the `cid`: it keeps the
  engines' TTLs alive for the grace (120 s by default), then ends the flow. A node already in an engine finishes;
  nothing sends the next one, so the run stops at the current node. After the end the run's stores expire 60 s after
  the last touch.
- The saved history keeps the exchange: the answer if it was finished, else the row marked cancelled.
