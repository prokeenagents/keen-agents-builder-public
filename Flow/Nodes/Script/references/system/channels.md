# Channels (`system/agent`)

## Description

A **channel** is a named lane in the run's conversation store. Every prompt and every response an agent gets or
gives sits in a channel of that agent — `'root'` unless another name is given. Channels are one of the run's three
ways to pass information (with the session and each flow's private dictionary — see
`../../../../../AgentArchitecture/references/communication.md`), and they are built for one job:

**collect information for a specific task, from several places, and delete it when the work is done.**

- Several writers — Scripts in parallel branches, tools, sub-agents, LLM nodes — put entries on the task's channel.
- One reader, when the task is done, takes them all with `consumeChannelResponses('<task>')` (read **and** delete in
  one step) and turns them into what the next step needs.
- `deleteChannel('<task>')` clears a channel without reading it.

The channel store is the **run's**: every flow of the run sees the same channels — the root flow, Run / Jump
children, tool flows, Parallel Flows branches and Parallel Context runs. That is what makes a channel the way to bring
results back from Parallel Flows branches, whose own dictionaries are deleted when they end.

**An LLM node and channels.** An LLM node takes as its trigger the newest prompt with `role: 'user'` and
`agentChat: true` filed for **its agentId on any channel** (preferring one whose `sessionID` is the node's session),
and writes its answer to the **same channel** as that trigger. So filing a prompt for agent `X` on channel `research`
makes `X`'s next LLM node answer on `research`. An LLM node cannot read a channel through `${…}` — only Scripts read
channels; to show collected entries to a model, a Script turns them into text in the dictionary.

Do not use a channel for one agent's working memory (its dictionary key, read by its prompt), for small run-wide
facts (the session), or for anything that must outlive the run (it is wiped at the root End).

Channels are part of the `system/agent` module; its per-agent functions are in `agent.md`.

## Import

```js
import Agent from 'system/agent';
// or only what you use:
import { getChannelPrompts, getChannelResponses, consumeChannelPrompts, consumeChannelResponses,
         deleteChannel, setRootAgentPrompt, setAgentPrompt, setAgentResponse } from 'system/agent';
import Tools from 'system/tools';   // generateUUID(), getTimestamp() for the entries you write
```

## Functions

**Entry shapes.** Prompt: `{ agentID, prompt, role, agentChat?, sessionID, requestID, channel?, files?,
filePaths?, images?, timestamp }`. Response: `{ agentID, agentName, response, sessionID, requestID, channel?,
timestamp }`. No `channel` = `'root'`.

### Writing to a channel (queued; committed when the node ends cleanly)

| Function | Puts on a channel |
|---|---|
| `setRootAgentPrompt(agentID, { prompt, sessionID, requestID, channel })` | a user message that **triggers** `agentID`'s next LLM node; its answer lands on the same channel. Only `prompt`, `sessionID`, `requestID`, `channel`, `files`, `filePaths`, `images` are stored |
| `setAgentPrompt(agentID, { prompt, role, sessionID, requestID, channel, … })` | any prompt, stored as given — it triggers only with `role: 'user'` and `agentChat: true` |
| `setAgentResponse({ agentID, agentName, response, sessionID, requestID, channel, timestamp })` | a response, stored **exactly** as given — set `timestamp: Tools.getTimestamp()` or it sorts last |

A write is visible to this node's own reads at once and to every other node and flow after this node ends cleanly
(together with its dictionary and session writes — all or none).

### Reading a channel (all agents)

- `getChannelPrompts(channel, opts?)` / `getChannelResponses(channel, opts?)` → every entry on `channel`, from
  every agent: this node's own writes first, then the committed ones, newest first. `[]` when none.
  `opts = { sessionID?, requestID? }` keeps only entries whose fields equal the given strings.
- `consumeChannelPrompts(channel, opts?)` / `consumeChannelResponses(channel, opts?)` → the committed entries, and
  the channel is **deleted** (that store's lane of every agent) in the same step. `opts` narrows only what is
  returned — the whole channel is deleted. This node's own writes are neither returned nor deleted.

### Deleting

| Function | Deletes | Returns |
|---|---|---|
| `deleteChannel(channel, opts?)` | the channel in both stores (prompts and responses), every agent; with `opts.affectDB === true` also purges the channel's saved chat history of this chat | the number of agent lanes removed |
| `deleteAgentPrompt(agentID, { channel, sessionID?, requestID? })` / `deleteAgentResponse(…)` | one entry: the newest on that channel matching the given ids | `true` / `false` |

Deletes and consumes act at the call and are final — a later throw does not undo them.

## Errors

| When | What the script sees | Node fails or catchable | What to do |
|---|---|---|---|
| `channel` empty / not a string | `TypeError: AgentMgr.<function>: channel must be a non-empty string` | catchable | pass a channel name |
| `opts` not an object (`deleteChannel`, `deleteAgent…`) | `TypeError: AgentMgr.<function>: opts must be an object when provided` | catchable | pass `{ … }` or nothing |
| a read or consume whose result is over 10 MB of JSON | `E_SAB_OVERFLOW: channel resp array for "<channel>" exceeds …` / `channel prompt drain for "<channel>" …` | catchable — but after a **consume** the channel is **already deleted** | keep entries small; consume often |
| a read while a `system/http` call is still running | `Error: E_SAB_BUSY: one buffer op at a time — await each before the next` | catchable | `await` every HTTP call first |
| an entry over 8 MB, or the node's entries over 8 MB together | at the node's end: `Agent state entry is N bytes, exceeds per-entry cap …` / `… writes of this run are N bytes …` | node fails → `error`; nothing written | shorter entries; spread writes |
| the script throws after writing | the queued writes are dropped | `error` edge | write last |

## Statuses

- **Empty / missing:** reads and consumes → `[]`.
- **Committed:** at the node's clean return; visible from then on to every node and flow of the run.
- **Rolled back:** the node's queued writes, on a throw, a failed end-of-node check, the time limit, a cancel.
- **Consumed / deleted:** at the call, final. A retried node consumes an already empty channel → `[]`.
- **Trimmed:** each agent's lane on a channel keeps its newest **200** entries; older ones drop silently.
- **Lifetime:** one run — wiped at the root flow's End or a cancel; 60 s after the last activity as a backstop.

## Limits

| Limit | Value | When exceeded |
|---|---|---|
| One entry | 8 MB | node fails, nothing written |
| All entries one node writes | 8 MB | node fails, nothing written |
| Entries per agent per channel | 200, newest kept | oldest dropped |
| One read / consume result | 10 MB (the input buffer shared with `system/http` / `system/dictionary`) | `E_SAB_OVERFLOW` (a consume has already deleted) |
| Channel names | non-empty; letters, digits, `-`, `_` (a `.` is not safe) | — |

## Mistakes that break it

| Mistake | What happens | Write instead |
|---|---|---|
| expecting an LLM prompt to read a channel (`${channel.results}`) | no such placeholder — empty | a Script consumes the channel and writes TEXT into the dictionary; the prompt reads `${dictionary.…}` |
| two Scripts both `consume` one channel | the second gets `[]` | one consumer per channel (or `get…` everywhere but the last) |
| collecting from Parallel Flows branches through their dictionaries | the branch dictionaries are deleted at their ends | branches write to a channel; one Script after Out consumes it |
| parallel workers that share one agentId get their prompts without their own `sessionID` (or on separate channels, expecting that to separate them) | a worker takes a sibling's prompt — an LLM picks the newest prompt for its agentId from ALL channels, preferring its own session | stamp each prompt with the worker's own `flowContext.sessionId`, or give each its own agentId; a channel never separates triggers |
| collecting LLM answers from a channel and treating every entry as a result | a failed call's error text is stored as an answer on the trigger's channel too | wire the LLM's Fallback to a Script that deletes that entry (`deleteAgentResponse`) |
| `setAgentResponse` without `timestamp` | sorts last in channel reads | `timestamp: Tools.getTimestamp()` |
| huge entries, consumed rarely | over 10 MB the consume fails after deleting — the data is lost | small entries (ids, short text); consume when each task ends |
| `deleteChannel('root', …)` or `affectDB: true` by habit | the run's own lane (and its saved chat history) is gone | delete task channels only |
| leaving task channels behind | they ride in the run's store until the root End | consume or delete when the task is done |

## Example

Three Parallel Flows branches each price one supplier and report on the channel `quotes`; after Out one Script
collects them for the LLM that answers the person.

```js
// src/scripts/quotes/reportQuote.js — the last Script of each branch (props.supplier set on its Script node)
import Agent from 'system/agent';
import Tools from 'system/tools';

export async function exec(props) {
    const price = dictionary.price;                                   // this branch's own dictionary
    Agent.setAgentResponse({
        agentID: 'quote-collector',
        agentName: 'Quote collector',
        response: JSON.stringify({ supplier: String(props.supplier), price }),
        sessionID: flowContext.sessionId,
        requestID: Tools.generateUUID(),
        channel: 'quotes',
        timestamp: Tools.getTimestamp()
    });
    return { ok: true };
}
```

```js
// src/scripts/quotes/collectQuotes.js — after the Parallel Flows node's Out
import Agent from 'system/agent';

export async function exec() {
    const quotes = Agent.consumeChannelResponses('quotes')            // read AND delete the lane
        .map(entry => { try { return JSON.parse(entry.response); } catch { return null; } })
        .filter(Boolean);
    dictionary.quotesText = quotes.length
        ? quotes.map(q => `${q.supplier}: ${q.price}`).join('\n')       // TEXT — a prompt cannot show a list
        : 'No supplier answered.';
    return { count: quotes.length };
}
```

The answering LLM's system prompt then reads `Quotes:\n${dictionary.quotesText}`.
