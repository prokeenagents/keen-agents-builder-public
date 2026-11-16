# The protocol — every frame the SDK sends and receives

One WebSocket per chat: `wss://keen.example.com/ws-keen` (the `url` every client must pass — `@keenagents/chat-sdk`
has no default). Every frame is JSON `{ "event": "<name>", "data": { … } }`
(the relay's wire format). The SDK speaks protocol **2** (resume, `pong`). Entry: [sdk.md](sdk.md). Codes:
[errors.md](errors.md). Values below are shortened examples.

## 1. Frames the SDK sends

| `event` | When | `data` |
|---|---|---|
| `run` | the first prompt, every node visit, every re-send | `{ requestId, payload }` |
| `ping` | every 5 s during a run | `{ protocol: 2 }` |
| `cancel` | the person's stop (`ChatAPI.cancel()`, `KeenChat.cancel()`), a final reply code on any node (from 15.3.0 every code except `E4…` / `E7…`, and an `E4…` / `E7…` whose per-chat `max_retry` is used up — [errors.md](errors.md)), an undeliverable frame, a tab close | `{ correlationId }` (must be this socket's `cid`, else the relay ignores it). Sent once per run |
| `resume` | the first frame on a new socket while a flow runs on the old `cid` | `{ correlationId, resumeToken, userContext: { userId, accessToken } }` |

**The run frame** (the first prompt):

```json
{ "event": "run", "data": { "requestId": "r-3f1c…", "payload": {
  "userContext": { "userId": "<token sub>", "email": "ana@example.com", "accessToken": "<token>" },
  "rootAgentContext": { "agentId": "support-agent", "prompt": "Where is my order?" },
  "chatContext": { "chatId": "c-7a2…", "projectId": "<space id>" },
  "flowContext": { "correlationId": "<cid>", "sessionId": "r-91e…", "requestId": "r-04b…" },
  "requestContext": { "cookies": { "theme": "dark" } } } } }
```

`data.requestId` is the **visit id** (the relay's single-flight key, at most a short string); `flowContext.requestId`
is the flow's own request id. The prompt is at most `welcome.limits.promptChars` characters (`E2101` above it).

**A node frame:**

```json
{ "event": "run", "data": { "requestId": "r-b77…", "payload": {
  "userContext": { "userId": "<token sub>", "email": "ana@example.com", "accessToken": "<token>" },
  "rootFlowContext": { "flowId": "…", "correlationId": "<cid>", "sessionId": "r-91e…", "requestId": "r-04b…" },
  "chatContext": { "chatId": "c-7a2…", "projectId": "<space id>" },
  "flowContext": { "correlationId": "<cid>", "sessionId": "r-91e…", "requestId": "r-04b…", "flowId": "…", "currentFlowId": "…", "parentFlowId": "…" },
  "nodeContext": { "id": "LLM-1", "kind": "agentNode", "initial": false },
  "options": { "toolResponse": true, "promptMarker": "…" } } } }
```

`flowId` only for a non-root bundle; the spawn fields (`currentFlowId`, `parentFlowId`, `parentSessionId`,
`contextNumber`, `contextPath`, `correlationToken`) only when the bundle has them; `options` only when the task or its
tool flow has them.

## 2. Frames the SDK receives

| `event` | From | `data` | The SDK |
|---|---|---|---|
| `welcome` | relay, once per socket | `{ correlationID, resumeToken, graceMs, protocol, limits: { promptChars } }` | binds the `cid`, `whenReady` resolves, `onWelcome` |
| `result` | relay | `{ requestId, envelope }` (`success: true`) | resolves the visit's waiter, `onResponse` |
| `error` | relay | `{ requestId?, envelope }` (`success: false`) | the same path as `result` — the code decides: `E4…` / `E7…` retried (within the chat's error policy), anything else final (the run ends, `cancel` goes out) |
| `pong` | relay, per `ping` | `{}` | liveness only |
| `resumed` | relay | `{ correlationID, resumeToken, graceMs, detachedMs }` | ready on the old `cid`, `onResume`, re-sends every unanswered frame |
| `resume-refused` | relay | `{ correlationID, reason, retry, envelope }` — `reason`: `token` · `unavailable` · `gone` · `protocol` | refresh / retry / give up (setup.md §6) |
| any other (`token`, `thinking`, `message`, `progress`, `error` without an envelope, …) | engines, through the relay | `{ text?, data? }` | `onStream(event, data)` |

`welcome`:

```json
{ "event": "welcome", "data": { "correlationID": "6c1e…", "resumeToken": "<handle>", "graceMs": 120000,
  "protocol": 2, "limits": { "promptChars": 20000 } } }
```

The resume handle stays in memory only (never in a URL, storage or a log).

**Stream frames** carry only text:

```json
{ "event": "token", "data": { "text": "Your order " } }
{ "event": "progress", "data": { "text": "2 of 5 checked", "data": { "subSessionId": "…", "current": 2, "total": 5 } } }
```

No node id, no agent, no request id. An `error` frame **without** an envelope is a Script's message to the person,
not a failure.

## 3. The envelope — every reply

```json
{ "code": "E1001", "success": true,  "message": "OK", "data": { … } }
{ "code": "E4001", "success": false, "message": "too many prompts running for this account",
  "details": { "reason": "account-limit", "limit": 8, "active": 8 } }
```

`success: true` carries `data`; `success: false` carries `details` (a refusal's `retryAfterMs` may sit there — the
first prompt waits it, up to 60 s; the package types it as `Envelope.details`). The
site's own HTTP routes use a different shape (`{ success, status, message }`) — not this one.

## 4. What a reply's `data` is

**The run frame's reply — the root bundle:**

```json
{ "flowTask": { "userContext": { "userId": "…", "email": "…" }, "rootFlowContext": { … }, "rootAgentContext": { … },
    "chatContext": { … }, "flowContext": { "flowId": "…", "correlationId": "<cid>", "sessionId": "…", "requestId": "…",
    "entry": "Start", "completed": false }, "options": {} },
  "nodeTasks": [ { "flowContext": { "correlationId": "<cid>", "sessionId": "…", "requestId": "…" },
                   "nodeContext": { "id": "LLM-1", "kind": "agentNode", "initial": false } } ] }
```

**Next nodes:** `{ "nodeTasks": [ … ] }` (also accepted: `nextNodeTasks`, or one bare node task).

**An LLM node (`agentNode`):**

```json
{ "response": { "text": "…", "role": "assistant", "model": "…", "provider": "…",
                "usage": { "inputTokens": 812, "outputTokens": 164 }, "finishReason": "…", "truncated": false },
  "responseType": "text", "agentName": "Support", "toolContext": null,
  "providerEnvelope": { "code": "E1001", "success": true, … }, "nodeTasks": [ … ] }
```

`responseType`: `text` · `tool` · `error` (the provider failed: `response.text` = the error words,
`provider: "synthetic"`, the flow continues on the Fallback edge, else Out). `truncated: true` = the answer was cut at
the node's Max Tokens (delivered anyway). A tool call adds `childFlows` and a `toolContext`:

```json
{ "responseType": "tool", "toolContext": { "script": true, "flow": false, "agentId": "…", "path": "…", "prompt": "…", "options": { "tool": "orderLookup", … }, "projectTool": { … }, "error": false, "action": "…" },
  "childFlows": [ { "flowTask": { "toolFlow": true, "flowContext": { "parentFlowId": "<this flow>", "entry": "…", … },
                    "options": { "toolContext": { … }, "agentNode": { "flowContext": { … }, "nodeContext": { … } } } },
                    "nodeTasks": [ { "nodeContext": { "id": "…", "kind": "virtualScriptNode", "initial": false } } ] } ],
  "nodeTasks": [ { "nodeContext": { "id": "LLM-1", "kind": "agentNode" }, "options": { "toolResponse": true, "promptMarker": "…" } } ] }
```

**A Script node:** `{ "nodeTasks": [ … ], "scriptName": "lookup.js", "returnValue": … }` (the agent's secrets masked
as `••••`). A Script that throws continues on its error edge — still a `success: true` reply.

**Run Flow / Jump Flow:** `{ "childFlows": [ bundle ], "nodeTasks": [ … the caller's next … ] }`.

**Parallel Flows:** a node task with `"parallelFlowTask": [ bundle, … ]`. **Parallel Context:**
`{ "parallelContextTask": { "flowTask": <template bundle>, "total": 12 }, "nodeTasks": [ … ] }`.

**End of a flow:** `{ "final": true, "flowContext": { "flowId": "…", "correlationId": "<cid>", "sessionId": "…",
"requestId": "…" } }` — the four ids must equal the bundle's, else it is ignored. A Script tool's end adds
`scriptName` and `returnValue`.

## 5. Closes

| Code | Meaning | The SDK |
|---|---|---|
| 1006 before any welcome | the origin is not allowed (dropped before the upgrade), or Keen unreachable | stays `disconnected`, no reconnect |
| HTTP 429 at the upgrade | too many sockets on the replica / from the address | as above |
| 1000 | `disconnect()` | `disconnected` |
| 1006 / other after a welcome | a drop | `reconnecting`, then resume |
| 1012 | the relay restarts | reconnect after 0–1 s, resume |
| 1008 | too many refused resumes | new socket |
| 1009 | an inbound frame over 8 MiB | a drop (the SDK refuses such frames first) |
| 4000 | the SDK's liveness (15 s silent during a run) | reconnect, resume |
| 4401 | the API key is stopped | `unavailable`, no reconnect; the run fails `The service is temporarily unavailable` |
| 4409 | the `cid` was resumed on a newer socket | `disconnected`; the run fails `connection taken over by another session` |
