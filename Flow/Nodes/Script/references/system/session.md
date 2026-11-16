# `system/session`

## Description

The run's **session**: one flat key / value store shared by every flow of the run (the root flow, Run Flow /
Jump Flow children, tool flows, Parallel Flows branches, Parallel Context clones). Flow fields read it with
`${session.<key>}` (one flat key, no nesting).

Use it for small values that every flow of the run must see: a language, a user id the client sent, a flag,
an error note for the `error` handler (the session is kept when the script throws).

Do not use it for:

- objects, arrays or lists → the current flow's `dictionary` global (see `dictionary.md`);
- anything that must outlive the run → it is wiped when the run ends (Statuses);
- passing a message to an LLM → `system/agent` (see `agent.md`).

The session starts **empty** for every run: it holds no user id, e-mail or session id unless a node wrote them.

## Import

```js
import Session from 'system/session';                       // the whole object (also a property proxy)
import { setSessionValue, getSessionValue, deleteSessionValue,
         hasSessionKey, clearSessionStorage, getSessionSize } from 'system/session';
```

## Functions

The default export is also a proxy: `Session.lang` reads, `Session.lang = 'de'` writes, `delete Session.lang`
deletes, `'lang' in Session` tests. Property syntax never reaches a key named like one of the six functions
(`Session.getSessionValue` is the function); use the functions for such keys.

### `setSessionValue(key, value)`

- `key` — string, required. Any string is accepted here; see Limits for safe keys.
- `value` — `string`, finite `number`, `boolean` or `null`. Checked when the node **ends**, not here.
- Returns `undefined`. Replaces any earlier value.

```js
Session.setSessionValue('lang', 'de');      // or: Session.lang = 'de';
```

### `getSessionValue(key)`

- Returns the value, or `undefined` when the key is absent. A stored `null` reads `null`.
- Sees this node's own writes at once and the session as it was committed when this node started.

```js
const lang = Session.getSessionValue('lang') ?? 'en';
```

### `deleteSessionValue(key)`

- Removes the key; no-op when absent. Returns `undefined`.

### `hasSessionKey(key)`

- Returns `true` when the key exists (also when its value is `null`), else `false`.

### `clearSessionStorage()`

- Removes every key this node can see. Returns `undefined`. Keys that another branch adds at the same time
  are not removed (only the keys present when this node started are deleted at commit).

### `getSessionSize()`

- Returns the length of the session's JSON text as a `number`. In the sandbox it counts **characters**, not
  bytes, so it is lower than the cap's measure for non-ASCII text (the cap counts UTF-8 bytes).

```js
if (Session.getSessionSize() > 1_000_000) Session.deleteSessionValue('bigNote');
```

## Errors

| When | What the script sees | Node fails or catchable | What to do |
|---|---|---|---|
| A value is an object or array (`Session.user = {…}`) | nothing at the call; at the node's end: `Session key 'user': type 'object' is not allowed; session values must be primitive (string, number, boolean, null)` | node fails → `error` edge | flat keys (`user_id`, `user_name`) or the `dictionary` |
| A value is `undefined` (`Session.x = undefined`) | at the end: `Session key 'x': type 'undefined' is not allowed; …` (same tail) | node fails → `error` | `deleteSessionValue('x')` |
| A value is `NaN` / `Infinity` | at the end: `Session key 'x': NaN is not allowed; numbers must be finite` (or `Infinity`) | node fails → `error` | check `Number.isFinite(n)` first |
| A value is a function | the copy-out of the session fails at the end | node fails → `error` | store primitives only |
| Property write to a function name (`Session.getSessionValue = 1`) | `TypeError: 'set' on proxy: trap returned falsish for property 'getSessionValue'` | catchable at once | `setSessionValue('getSessionValue', 1)` |
| The session is over its cap at the node's end | `Session <run id> commit would be N bytes, exceeds cap of 1572864` | node fails → `error`; nothing of the node written | keep values short; delete what is done |
| The session is already over its cap when the node starts (parallel branches added keys together) | `Session <run id> is N bytes, exceeds cap of 1572864` | node fails → `error` before the script runs; every later node that opens the session fails the same way | keep each branch's keys small |
| The run was cancelled or its store expired | `Session <run id> not found; flow may be cancelled or stale` (at start) or `Run commit refused: <store key> not found; flow may be cancelled or stale — nothing was written` (at the end) | node fails → `error` | none needed; the run is over |

The script never sees the end-of-node messages: the node goes out of `error` and the agent's Log Record gets
`Script "<script path>" failed: <message>`.

## Statuses

- **Missing:** `getSessionValue` → `undefined`; `hasSessionKey` → `false`; `${session.key}` in a field →
  empty (`null` when the field is exactly one placeholder).
- **Committed:** at the node's clean return, together with the dictionary and the queued `system/agent` writes,
  in one step — all three or none.
- **Kept on the `error` edge:** when the script throws, or when the end-of-node commit is refused (a cap, a bad
  dictionary value, an agent write over its cap), the session is committed **alone**, if it passes its own
  checks. A bad session value fails the node part-way through the copy-out: the deletes and the keys before
  the bad one may be kept, the rest is lost.
- **Dropped:** on the 15-minute time limit (`E8101`), the person's cancel and an engine overload eviction
  (the node is retried; it starts again from the committed session).
- **Visible:** to every node and flow of the run that opens the session **after** the commit. Branches that
  run at the same time each see the session as it was when they started; each commit writes only the keys
  it changed, and on the same key the later commit wins.
- **Lifetime:** one run. The run's store is wiped when the root flow reaches its End Flow or the run is
  cancelled. As a backstop it expires 60 s after the last activity (the client's heartbeat keeps it alive
  while the run is live). The next chat message starts a new, empty session.

## Limits

| Limit | Value | Enforced | When exceeded |
|---|---|---|---|
| Session size (JSON, UTF-8 bytes, after secret masking) | 1.5 MB = 1 572 864 bytes | at node start and at node end | node fails, `error` edge |
| Value types | `string`, finite `number`, `boolean`, `null` | at node end | node fails, `error` edge |
| Nesting | none — one flat level; `${session.a.b}` reads the key `"a.b"` | — | — |
| Keys | no count limit; use letters, digits and `_` only (each key is written as a separate path in the run's store; a key with `.`, spaces or brackets is not guaranteed to round-trip) | — | — |
| Expiry | 60 s after the last activity; wiped at the end of the run | the run's store | the session is gone |
| Secrets | any agent Secret value is stored as `••••` | at node end | — |

## Mistakes that break it

| Mistake | What happens | Write instead |
|---|---|---|
| `Session.setSessionValue('order', { id, total })` | node fails at its end; the dictionary and agent writes of the node are dropped | `dictionary.order = { id, total }` or two flat keys |
| `Session.items = list` | same failure (arrays are objects) | keep lists in the `dictionary` |
| `Session.x = undefined` to remove a key | node fails | `delete Session.x` |
| Expecting `${session.userEmail}` without writing it | empty value | write it from a prop the client sent |
| Reading a value in the next chat message | `undefined` — the run's session is gone | the conversation history or the client's own state |
| Two Parallel Flows branches writing `Session.result` | the later commit wins, the other is lost | one key per branch (`result_a`, `result_b`) |
| Many large values across branches | the session passes 1.5 MB together; every later node fails at start | short values; the `dictionary` for bulk data |
| Trusting `getSessionSize()` as bytes | non-ASCII text hits the cap earlier than it shows | keep a wide margin |

## Example

```js
// src/scripts/prefs/set-language.js — prop "lang" = "${dictionary.detectedLang}"
import Session from 'system/session';

export async function exec(props) {
    const lang = typeof props.lang === 'string' && /^[a-z]{2}$/.test(props.lang) ? props.lang : 'en';
    Session.lang = lang;                                  // read later anywhere as ${session.lang}
    if (!Session.hasSessionKey('firstSeenAt')) Session.firstSeenAt = Date.now();
    if (lang === 'xx') {
        Session.lastError = 'unsupported language';       // kept even though the script throws
        throw new Error('unsupported language');
    }
    return { lang };
}
```
