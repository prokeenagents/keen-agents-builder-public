# `system/chat`

## Description

Sends **interim** frames to the person's chat while the script runs: a status line, a "thinking" line, an
error notice, progress / stream / start / end of a sub-run, files. They appear at once, before the node ends.

They are never the agent's answer and never reach an LLM: the answer comes from an LLM node (or what the
client does with End Flow). Use `system/chat` for "Looking up your order…" during a slow API call.

Do not use it for: the answer itself (an LLM node), diagnostics (`system/log` — the person never sees those),
or data a later node needs (`dictionary` / session).

## Import

```js
import Chat from 'system/chat';
import { writeOut, writeThinking, writeError, writeAgentProgress,
         writeAgentStream, writeAgentStart, writeAgentEnd, writeFiles } from 'system/chat';
```

## Functions

Every function returns `undefined` at once (fire-and-forget) and sends one frame. Text arguments (marked
*text*) are sent as given when a string, as `JSON.stringify` of anything else, and as `""` for `null` /
`undefined`. Other arguments go out as data, as given. No argument is checked.

| Function | Arguments | Arrives in the chat as |
|---|---|---|
| `writeOut(message)` | *text* | `message` event, the text |
| `writeThinking(message)` | *text* | `thinking` event |
| `writeError(message)` | *text* | `error` event — a notice only; the node does **not** fail |
| `writeAgentProgress(subSessionId, current, total, message)` | `message` *text*; the rest data | `progress` event, data `{ subSessionId, current, total }` |
| `writeAgentStream(subSessionId, content, isPartial)` | `content` *text*; `isPartial` boolean, any non-boolean → `true` | `agentStream` event, data `{ subSessionId, isPartial }` |
| `writeAgentStart(mainSessionId, subSessionId, agentName, flowEntry)` | data | `agentStart` event, data with the four values |
| `writeAgentEnd(subSessionId, status, result, duration)` | data | `agentEnd` event, data with the four values |
| `writeFiles(files)` | data (whatever the client expects, e.g. a list) | `files` event, data = `files` |

```js
Chat.writeOut('Looking up your order…');
Chat.writeAgentProgress(flowContext.sessionId, 2, 5, 'Checked 2 of 5 stores');
```

## Errors

| When | What the script sees | Node fails or catchable | What to do |
|---|---|---|---|
| Any normal call | nothing; returns `undefined` | — | — |
| An argument holds a function or another value that cannot be copied out of the sandbox | an error thrown at the call | catchable (uncaught → `error` edge) | send plain data |
| Nobody is connected to the chat (an API run, a closed tab) | nothing; the frame is dropped | — | never rely on a frame arriving |
| A frame larger than the platform's message limit (default 8 MB) | nothing; the frame is not delivered | — | keep frames short; send links, not file bodies |

## Statuses

- **Sent at the call**, not at the node's end. Frames already sent stay in the chat when the script later
  throws, hits the 15-minute time limit or is cancelled: nothing is rolled back.
- **Not stored:** a frame is not in the dictionary, the session, the conversation store or the chat history,
  and no later node can read it.
- **Masked:** any agent Secret value in any argument (and its JSON-escaped, URL-encoded, base64 forms) is
  sent as `••••`.
- An engine overload eviction retries the node, so its frames may be sent twice.

## Limits

| Limit | Value | Enforced | When exceeded |
|---|---|---|---|
| Frame size | the platform's message limit, default 8 MB, for the whole frame | in transport | frame dropped, script not told |
| Rate / count | none in the engine | — | every call is one frame; a loop of thousands floods the chat |
| Content checks | none — any text, any data | — | — |

## Mistakes that break it

| Mistake | What happens | Write instead |
|---|---|---|
| `Chat.writeOut(answer)` as the reply | the person sees an interim line; the agent's real turn still needs an LLM / End Flow | write the result to `dictionary`, let an LLM answer |
| `Chat.writeError('failed')` and expecting the `error` edge | the node continues out of `next_1` | `throw new Error('…')` |
| `Chat.writeOut(...)` inside a loop over 500 items | 500 frames | one frame every N items |
| `Chat.writeOut(res.body)` with a big API body | huge frame, may be dropped; secrets masked but data leaked to the person | a short sentence |
| `console.log` / `Chat` for debugging | the person sees debug text | `system/log` |

## Example

```js
// src/scripts/orders/search-stores.js — a slow lookup with progress
import Chat from 'system/chat';
import Http from 'system/http';

export async function exec(props) {
    const stores = ['north', 'south', 'east'];
    const found = [];
    Chat.writeOut('Checking stock in our stores…');
    for (let i = 0; i < stores.length; i += 1) {
        const res = await Http.getJson(`https://shop.example.com/api/stock/${stores[i]}/${props.sku}`);
        if (res.ok && res.body && res.body.qty > 0) found.push(stores[i]);
        Chat.writeAgentProgress(flowContext.sessionId, i + 1, stores.length, `Checked ${i + 1} of ${stores.length}`);
    }
    dictionary.stock = { sku: props.sku, stores: found };
    return { count: found.length };
}
```
