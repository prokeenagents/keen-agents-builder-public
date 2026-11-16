# `system/dictionary`

## Description

Reads one value from **another** flow's dictionary in the same run, or deletes that dictionary.

The **current** flow's dictionary is not this module: it is the bare global `dictionary` (no import), which the
script reads and writes like a plain object. Its rules and limits are at the end of this file.

Which dictionary a flow owns:

| Flow | Its dictionary is stored under |
|---|---|
| the root flow, a Run Flow / Jump Flow child | the **root flow's** id (they share one dictionary) |
| a tool (script or flow) | the dictionary of the flow whose LLM node called it — the root flow's, or a Parallel Flows branch's / Parallel Context clone's own when the calling LLM runs there |
| a Parallel Flows branch | its own `flowId` (starts empty, deleted when the branch ends) |
| a Parallel Context clone (and Run / Jump children inside it) | the clone's `flowId` (seeded from its collection item, merged back and deleted when the clone ends) |

Use `system/dictionary` when a Parallel Flows branch or a clone must read a value of the flow that started it
(`flowContext.parentFlowId`, when that flow owns a dictionary), or a running sibling whose `flowId` you were
handed; and `closeDictionary` to free a dictionary you know is finished.

Do not use it to read your own flow's data (use `dictionary`), to write another flow's data (there is no
write; hand results back through your own dictionary, the session or `system/agent`), or to read a branch
that has already ended (its dictionary is gone).

## Import

```js
import Dict from 'system/dictionary';                 // never name it `dictionary` (that is the global)
import { get, closeDictionary } from 'system/dictionary';
```

## Functions

### `get({ flowID, path })`

- `flowID` — non-empty string, required: the id the dictionary is stored under (table above).
- `path` — non-empty string, required: a dot path inside it (`'order.status'`).
- Returns the value at `path` as JSON data (object, array, string, number, boolean, `null`), or **`null`** when
  the dictionary or the path does not exist. A miss never throws.
- Reads what is **committed** now; another node's uncommitted changes are not seen. Only dictionaries of
  this run can be read.

```js
const status = Dict.get({ flowID: flowContext.parentFlowId, path: 'order.status' });  // null if absent
```

### `closeDictionary(flowID)`

- `flowID` — non-empty string, required.
- Returns `true` if a dictionary was deleted, `false` if none existed.
- Acts **at once**; a later throw, the time limit or a cancel does not undo it.

```js
if (Dict.closeDictionary(props.finishedFlowId)) Log.info('freed');
```

## Errors

| When | What the script sees | Node fails or catchable | What to do |
|---|---|---|---|
| `get` with no object (`get('x')`, `get()`) | `TypeError: dictionaryMgr.get: expects an object { flowID, path }` | catchable | pass `{ flowID, path }` |
| `flowID` missing / empty / not a string | `TypeError: dictionaryMgr.get: flowID must be a non-empty string` | catchable | check the id first (`flowContext.parentFlowId` is absent in the root flow) |
| `path` missing / empty / not a string | `TypeError: dictionaryMgr.get: path must be a non-empty string` | catchable | give a dot path |
| `closeDictionary` with a bad id | `TypeError: dictionaryMgr.closeDictionary: flowID must be a non-empty string` | catchable | — |
| `get` while a `system/http` call is still running (not awaited) | `Error: E_SAB_BUSY: one buffer op at a time — await each before the next` | catchable | `await` every HTTP call first |
| You closed a dictionary that a still-running flow uses | that flow's next node fails: a Script node with `Dictionary <run id>_<flowID> not found; flow may be cancelled or stale` (its `error` edge); any other node kind fails with `E6101` | the **other** flow fails | close only dictionaries whose flow has ended |
| You closed **your own** dictionary (e.g. the root's from a Run Flow child) | at this node's end: `Run commit refused: <store key> not found; flow may be cancelled or stale — nothing was written` | this node fails → `error` | never close the dictionary you run on |

## Statuses

- **`get` found:** the value, a fresh copy (changing it changes nothing stored).
- **`get` missing:** `null` — for an absent dictionary, an absent path, a branch that already ended, a
  `flowID` of another run, and a stored `null` alike.
- **`closeDictionary`:** `true` deleted / `false` nothing there. Immediate and final.
- **TTL:** a dictionary expires 60 s after the last activity (the heartbeat keeps a live flow's alive); all of
  the run's dictionaries are wiped when the root flow ends or the run is cancelled.

## Limits

| Limit | Value | Enforced | When exceeded |
|---|---|---|---|
| Reach | dictionaries of this run only | by the engine | other runs read `null` |
| Value size read by `get` | ≤ 10 MB (one buffer shared with `system/http` and `system/agent` reads); a dictionary is ≤ 1.5 MB, so never reached | in the sandbox | — |
| Calls at a time | one buffer operation at a time | in the sandbox | `E_SAB_BUSY` |
| Path form | dot path; use keys of letters, digits and `_` (an index such as `items[0]` is passed through as written — not verified) | — | — |

## The current flow's `dictionary` global — rules and limits

- Read and write it as a plain object: `dictionary.order = { id: 7 }`, `delete dictionary.tmp`. No import.
- **Committed** at the node's clean return only, together with the session and the `system/agent` writes (all or
  none). **Dropped** when the script throws, when any end-of-node check fails, on the time limit, a cancel or an
  eviction. Visible to the next nodes of every flow that shares it, once committed.
- **Cap:** 1.5 MB = 1 572 864 bytes of JSON (UTF-8, after secret masking), checked when the node opens it
  (`Dictionary <run id>_<flowID> is N bytes, exceeds cap of 1572864`, the node fails before the script runs)
  and at the end (`Dictionary <run id>_<flowID> commit would be N bytes, exceeds cap of 1572864`). Both →
  `error` edge.
- **Values:** JSON only — `null`, strings, booleans, finite numbers, plain objects, arrays. A changed value that
  breaks this fails the node at its end with `Invalid dict value at $.<path>: …`, e.g.
  `undefined is not JSON-serializable`, `NaN is not JSON-serializable`, `functions are not allowed`,
  `bigint is not JSON-serializable`, `Date instances are not allowed (plain objects only)`,
  `circular reference detected`. Write `delete dictionary.x`, not `dictionary.x = undefined`; dates as
  `new Date().toISOString()`.
- **Keys:** use letters, digits and `_`; `${dictionary.a.b}` walks dots and cannot index arrays.
- Secret values are stored as `••••`.

## Mistakes that break it

| Mistake | What happens | Write instead |
|---|---|---|
| `import dictionary from 'system/dictionary'` | hides the global; your writes go nowhere | `import Dict from 'system/dictionary'` |
| `Dict.get({ flowID: flowContext.flowId, path })` to read your own data | reads the committed copy, misses this node's changes (or `null`) | `dictionary.<path>` |
| `get` from a Parallel Flows branch with `parentFlowId` of a Run Flow child | `null`: that child shares the root's dictionary, stored under the root's id | read a value the root passed in props, or the session |
| Reading a branch after Join Flow | `null`: the branch's dictionary was deleted at its end | have the branch write its result to the session or a channel (`system/agent`) |
| `closeDictionary` on a flow still running | that flow's next node fails | close only ended flows |
| `Http.get(url)` not awaited, then `Dict.get(...)` | `E_SAB_BUSY` | `await` the HTTP call |
| `dictionary.when = new Date()` | node fails at its end | an ISO string or a number |

## Example

```js
// src/scripts/branch/read-parent-limit.js — runs in a Parallel Flows branch started by the root flow
import Dict from 'system/dictionary';

export async function exec() {
    const parent = flowContext.parentFlowId;
    const limit = parent ? Dict.get({ flowID: parent, path: 'settings.limit' }) : null;
    dictionary.limit = typeof limit === 'number' ? limit : 10;     // this branch's own dictionary
    return { limit: dictionary.limit };
}
```
