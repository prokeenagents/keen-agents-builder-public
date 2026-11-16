# `system/agent`

## Description

The run's **conversation store**: the prompts given to agents and the responses they gave, per agent id, each
entry in a **channel** (a named lane, default `'root'`), newest first. Two stores: prompts and responses.

An LLM node takes as its trigger the newest prompt with `role: 'user'` and `agentChat: true` among **all** of
its agent's channels, preferring one whose `sessionID` equals the node's session; its answer is written to the
responses store on the **same channel** as that trigger. So a script uses this module to:

- give an LLM node a message to answer (`setRootAgentPrompt`) — e.g. a tool's reply (rules in
  `../../../LLM/references/tool-calling.md`);
- read what an agent answered (`getAgentLastResponse`, or `getChannelResponses` for a non-root channel);
- pass messages between parallel branches on a channel, and drain or delete them when done — **channels have their own
  guide: `channels.md`** (what they are for, the write / read / consume / delete functions, recipes).

Do not use it for working data (`dictionary`), small run-wide values (`system/session`), or messages to the
person (`system/chat`). It holds only **this run**: earlier chat turns are not in it.

## Import

```js
import Agent from 'system/agent';
import { getRootAgentPrompt, getAgentLastPrompt, getAgentLastResponse, getAgentLastResponses,
         getAgentLastResponseByRequestId, getAgentLastResponseBySessionId, getAgentResponseBySessionRequestIds,
         getChannelPrompts, getChannelResponses, consumeChannelPrompts, consumeChannelResponses,
         setAgentPrompt, setAgentResponse, setRootAgentPrompt,
         deleteChannel, deleteAgentPrompts, deleteAgentResponses, deleteAgentPrompt, deleteAgentResponse } from 'system/agent';
```

## Functions

**Entry shapes** (as stored). Prompt: `{ agentID, prompt, role, agentChat?, sessionID, requestID, channel?,
files?, filePaths?, images?, timestamp }` (`role` is `'system' | 'user' | 'assistant' | 'tool'`). Response:
`{ agentID, agentName, response, sessionID, requestID, channel?, timestamp }`. An entry with no `channel` is on
`'root'`.

**What a read sees.** Reads go to the store at the call and return the committed entries **plus this node's own
writes**, which come first. The per-agent reads cover the agent's `'root'` channel only — except that this
node's own writes to that agent show up on any channel. Reads never validate `agentID`: a wrong one returns
`null` / `[]`.

### Per-agent reads (`'root'` channel)

| Function | Returns |
|---|---|
| `getRootAgentPrompt(agentID)` | the newest prompt with `role === 'user'` and `agentChat === true`, or `null` — this run's user message unless a script wrote a newer one |
| `getAgentLastPrompt(agentID)` | the newest prompt, or `null` |
| `getAgentLastResponse(agentID)` | the newest response, or `null` |
| `getAgentLastResponses(agentID)` | every response, newest first; `[]` when none |
| `getAgentLastResponseByRequestId(agentID, requestID)` | the newest response with that `requestID`, or `null` |
| `getAgentLastResponseBySessionId(agentID, sessionID)` | the newest response with that `sessionID`, or `null` |
| `getAgentResponseBySessionRequestIds(agentID, sessionID, requestID)` | the newest response matching both, or `null` |

```js
const answer = Agent.getAgentLastResponseBySessionId('offer-agent', flowContext.sessionId)?.response ?? '';
```

### Channel reads (all agents)

- `getChannelPrompts(channel, opts?)` / `getChannelResponses(channel, opts?)` → every entry on `channel`
  across all agents: this node's writes first, then the committed ones sorted newest first by `timestamp`;
  `[]` when none. `channel` non-empty string, required. `opts = { sessionID?, requestID? }` keeps only the
  entries whose fields equal the given strings (non-string values are ignored).
- `consumeChannelPrompts(channel, opts?)` / `consumeChannelResponses(channel, opts?)` → the same read of the
  **committed** entries only, and **deletes the channel** (that store's lane of every agent) in the same step.
  `opts` narrows only what is returned; the whole channel is deleted. This node's own writes are neither
  returned nor deleted (they are committed at its end).

```js
const replies = Agent.consumeChannelResponses('quotes');      // read once, lane emptied
```

### Writes (queued; committed at the node's clean return)

Each returns the entry as queued (an object, **without** `timestamp`); a read later in the **same node** sees it.

- `setRootAgentPrompt(agentID, payload)` — a user message an LLM node of `agentID` takes as its trigger.
  `payload = { prompt, sessionID, requestID, channel?, files?, filePaths?, images? }`; `prompt` a non-empty
  string (checked); `role: 'user'` and `agentChat: true` are added. Only those seven fields are stored — any
  other field is dropped at commit. Stamp `sessionID` with the session of the LLM node that must answer and
  a fresh `requestID` (`Tools.generateUUID()`). The commit adds `timestamp`.
- `setAgentPrompt(agentID, payload)` — a prompt stored as given (every field kept), plus `agentID` and
  `timestamp`. Nothing in `payload` is checked: give `prompt`, `role`, `sessionID`, `requestID` yourself.
  It becomes a trigger only with `role: 'user'` and `agentChat: true`.
- `setAgentResponse(response)` — a response stored **exactly as given**; `response.agentID` required. No
  `timestamp` is added: set `timestamp: Tools.getTimestamp()` yourself, or it sorts last in channel reads.

```js
Agent.setRootAgentPrompt('offer-agent', { prompt: 'Summarise the offer', sessionID: flowContext.sessionId,
                                          requestID: Tools.generateUUID() });
```

### Deletes (immediate, committed entries only)

None of them touches this node's queued writes; none is undone by a later throw, the time limit or a cancel.

| Function | Deletes | Returns |
|---|---|---|
| `deleteChannel(channel, opts?)` | the channel in both stores, every agent; with `opts.affectDB === true` also asks the platform to purge the channel's saved chat history of this chat (in the background; skipped when the run has no chat) | the number of agent lanes removed (prompts + responses) |
| `deleteAgentPrompts(agentID)` / `deleteAgentResponses(agentID)` | every prompt / response of the agent, all channels | `1` if the agent had any, else `0` |
| `deleteAgentPrompt(agentID, opts?)` / `deleteAgentResponse(agentID, opts?)` | one entry: the newest on `opts.channel` (default `'root'`), or the newest there matching every given `opts.sessionID` / `opts.requestID` | `true` if one was removed, else `false` |

## Errors

| When | What the script sees | Node fails or catchable | What to do |
|---|---|---|---|
| `channel` empty / not a string (channel reads, consumes, `deleteChannel`) | `TypeError: AgentMgr.<function>: channel must be a non-empty string` | catchable | pass a channel name |
| `agentID` empty / not a string (writes, deletes) | `TypeError: AgentMgr.<function>: agentID must be a non-empty string` | catchable | — |
| `payload` not an object (`setAgentPrompt`, `setRootAgentPrompt`) | `TypeError: AgentMgr.<function>: payload must be an object` | catchable | — |
| `payload.prompt` empty / not a string (`setRootAgentPrompt`) | `TypeError: AgentMgr.setRootAgentPrompt: payload.prompt must be a non-empty string` | catchable | never send an empty reply; send a sentence |
| `setAgentResponse` without an object / `agentID` | `TypeError: AgentMgr.setAgentResponse: response must be an object` / `…: response.agentID must be a non-empty string` | catchable | — |
| `opts` not an object (`deleteChannel`, `deleteAgentPrompt`, `deleteAgentResponse`) | `TypeError: AgentMgr.<function>: opts must be an object when provided` | catchable | pass `{ … }` or nothing |
| A read while a `system/http` call is still running | `Error: E_SAB_BUSY: one buffer op at a time — await each before the next` | catchable | `await` every HTTP call first |
| A read whose result is over 10 MB of JSON | `E_SAB_OVERFLOW: agent prompt array for "<agentID>" exceeds 10485760 byte buffer` (or `agent resp array…`, `channel resp array for "<channel>"…`, `channel prompt drain for "<channel>"…`) | catchable — but after a **consume** the channel is **already deleted** | keep entries small; drain often |
| One queued entry over its cap | at the node's end: `Agent state entry is N bytes, exceeds per-entry cap of 8388608` | node fails → `error`; nothing of the node written (the session alone is kept) | shorter prompts / responses |
| The node's entries together over the run cap | at the end: `Agent state writes of this run are N bytes, exceeds per-run cap of 8388608` | node fails → `error`; nothing written | spread writes over nodes |
| The script throws after writing | the queued writes are dropped | `error` edge | write last, after everything that can fail |
| You deleted this run's user message, then an LLM node of that agent runs | that LLM node finds no user message and fails | the LLM node fails | never delete `getRootAgentPrompt`'s entry during the run |

## Statuses

- **Missing:** single reads → `null`; list reads → `[]`.
- **Writes committed:** at the node's clean return, in the script's order, together with the dictionary and
  the session — all or none. Visible from then on to every later node and flow of the run (LLM nodes
  included); before that, only to this node's own reads.
- **Writes rolled back:** when the script throws, when any end-of-node check fails (an agent cap, the
  dictionary or session cap, a bad dictionary or session value), on the 15-minute time limit, a cancel and an
  overload eviction.
- **Deletes and consumes:** done at the call, final. An eviction retries the node, so a consume runs again on
  an already empty channel.
- **Trimmed:** each agent's channel keeps its newest 200 entries; an older one drops silently on the next write.
- **Lifetime:** one run. Wiped when the root flow reaches its End Flow or the run is cancelled; 60 s after
  the last activity as a backstop (the heartbeat keeps it while the run is live).

## Limits

| Limit | Value | Enforced | When exceeded |
|---|---|---|---|
| One entry (JSON, after secret masking) | 8 MB = 8 388 608 bytes | at the node's end | node fails, nothing written |
| All entries one node writes | 8 MB (the platform's setting) | at the node's end | node fails, nothing written |
| Entries per agent and channel | 200, newest kept | at commit | oldest dropped |
| One read's result | 10 MB (buffer shared with `system/http` / `system/dictionary`) | in the sandbox | `E_SAB_OVERFLOW` |
| Reads at a time | one buffer operation | in the sandbox | `E_SAB_BUSY` |
| `agentID`, `channel` | non-empty strings; use letters, digits, `-` and `_` (each is a path segment in the run's store; a `.` is not safe) | partly | — |
| Expiry | 60 s after the last activity; wiped at the end of the run | the run's store | gone |
| Secrets | stored as `••••` in queued writes | at the node's end | — |

## Mistakes that break it

| Mistake | What happens | Write instead |
|---|---|---|
| `setRootAgentPrompt(id, { prompt, sessionId: … })` (lowercase `Id`) | `sessionID` is missing; the LLM may take another trigger or report "No tool response" | `sessionID` / `requestID`, capital `ID` |
| A tool reply stamped with the tool's own `flowContext.sessionId` | the calling agent does not see it | `toolOptions.agentNode.flowContext.sessionId` (see tool-calling.md) |
| Triggering on channel `'com'`, then `getAgentLastResponse(id)` | `null` / an old root answer — the answer is on `'com'` | `getChannelResponses('com', { sessionID })` |
| Staging a `role:'user', agentChat:true` prompt on a side channel "for later" | the agent's next LLM node takes it as its trigger at once | stage it in the `dictionary`; write the prompt when it is due |
| `setAgentResponse` without `timestamp` | sorts last in channel reads | `timestamp: Tools.getTimestamp()` |
| Extra fields on `setRootAgentPrompt` (`{ prompt, …, meta }`) | `meta` is dropped at commit | `setAgentPrompt` with the full payload, or the dictionary |
| Expecting a read in the **next** node to show a channel write via `getAgentLastPrompt` | after commit the per-agent read sees `'root'` only | `getChannelPrompts(channel)` |
| Two branches both `consume` one channel | the second gets `[]` | one consumer per channel, or `get…` |
| `deleteChannel('root', { affectDB: true })` | the run's root lane and the chat's saved history on it are gone | delete side channels only; `affectDB` only to erase history on purpose |
| `deleteAgentPrompt(id)` during the run | removes this run's user message; the agent's next LLM node fails | delete with `{ channel, requestID }` of your own entry |

## Example

```js
// src/scripts/quotes/ask-pricing-agent.js — hand a question to the pricing agent's LLM node,
// which runs next in this flow on the same session.
import Agent from 'system/agent';
import Tools from 'system/tools';

export async function exec(props) {
    const question = String(props.question ?? '').trim();
    if (!question) throw new Error('no question');            // nothing queued yet → nothing to roll back

    const previous = Agent.getAgentLastResponseBySessionId('pricing-agent', flowContext.sessionId);
    dictionary.previousQuote = previous ? previous.response : null;

    const requestID = Tools.generateUUID();
    Agent.setRootAgentPrompt('pricing-agent', {
        prompt: `Price this request: ${question}`,
        sessionID: flowContext.sessionId,                       // the LLM node's session
        requestID
    });
    dictionary.pricingRequestId = requestID;                    // read the answer later by this id
    return { requestID };
}
```
