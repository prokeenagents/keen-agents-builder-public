# `system/log`

## Description

Writes a line to the agent's **Log Record** — the log an admin turns on in the console (Logs section) and can
watch live. It is the only trace a script leaves on a live run: production has no debugger. Never shown to the
person in the chat.

Use it for the branch taken, each external call and its status, and every caught error. Do not use it to talk
to the person (that is `system/chat`), to pass data to a later node (that is the `dictionary`), or for
`console.log` (it reaches no Log Record). The node itself is in `../../script-skill.md`.

## Import

```js
import Log from 'system/log';                          // Log.error / Log.warning / Log.info / Log.debug
import { error, warning, info, debug } from 'system/log';
```

The default export is frozen. There is no `Log.log`, no `Log.warn` and no `system/logs` (plural).

## Functions

All four have the same shape: `fn(message)` → `undefined`. They send the line at once (not at the end of the
node) and never wait.

| Argument | Type | Required | Rules |
|---|---|---|---|
| `message` | any | no | a string is written as is; anything else is written as `JSON.stringify(message)`; a value that gives no JSON (`undefined`, a function, no argument) is written as `undefined` |

### `error(message)`
A real failure: a caught exception, a refused call, a branch that should never run. Stored at level `error`.
```js
Log.error(`billing unreachable: ${e.message}`);
```

### `warning(message)`
A soft failure or a fallback taken (a retry, a default value). Stored at level `warn`.
```js
Log.warning(`shop answered ${res.status}, using the cached price`);
```

### `info(message)`
The decisions that explain the run. Stored at level `info`.
```js
Log.info(`order ${id}: status ${res.body.status}`);
```

### `debug(message)`
Detail for digging (raw payloads, intermediate values). Stored at level `debug`.
```js
Log.debug({ step: 'parsed', rows: rows.length });   // → {"step":"parsed","rows":3}
```

**The stored line** is `[<LEVEL>] <caller> | <message>`:

- `<LEVEL>` is `ERROR`, `WARNING`, `INFO` or `DEBUG`;
- `<caller>` is the flow file the node belongs to (`Chat.flow`), or `Virtual Script Tool` when the script runs
  as an LLM tool (`src/scripts/tools/…`);
- e.g. `[INFO] Chat.flow | order 4711: status shipped`.

The engine writes one line of its own when the node fails: `[ERROR] Script "<script path>" failed: <message>`
(no caller prefix). A Script tool whose path is not under `tools/` gets
`[ERROR] virtualScriptNode rejected — tool path must live under "scripts/tools/" (got "<path>")`.

## Errors

| When | What the script sees | Node fails or catchable | What to do |
|---|---|---|---|
| `message` holds a BigInt | `TypeError: Do not know how to serialize a BigInt` | catchable; uncaught → error edge | log `String(n)` |
| `message` is an object that refers to itself | `TypeError: Converting circular structure to JSON …` | catchable; uncaught → error edge | log the fields you need |
| `Log.log(…)` / `Log.warn(…)` | `TypeError: Log.log is not a function` | catchable; uncaught → error edge | use the four names |
| `import … from 'system/logs'` | the node fails with `ivm: import "system/logs" not supported — …`; keen-validate says `import 'system/logs' — it is 'system/log' (singular)` | error edge (nothing of the script runs) | `system/log` |
| no Log Record catches the line | nothing — the call returns `undefined` | neither: the line is dropped silently | ask the admin to add / resume a Log Record |

Writing a line never fails the node: delivery is fire-and-forget.

## Statuses

A call always returns `undefined`. The line then ends in one of:

| Status | When |
|---|---|
| **kept** | an **enabled** Log Record exists for the run's agent, or — when the agent has no record of its own — an enabled space-wide record for the run's space. Every level is kept: the record has no level filter (error, warn, info and debug each go to their own daily file). |
| **dropped** | no record for the agent and none for the space; the agent's record is paused (a paused agent record still wins over the space record, so the space record does not catch it); the run's agent could not be read and there is no space-wide record. |

The agent is the run's agent (the chat's), not the flow file. A line sent before the node throws is kept: the
dictionary rollback does not touch the log.

## Limits

| Limit | Value | Where | When exceeded |
|---|---|---|---|
| Levels | 4: `error`, `warning` (stored `warn`), `info`, `debug` | this module | another name is not a function (`TypeError`) |
| Line length | no cap set by the engine or the Log Record | — | a huge line costs the script's memory (30 MB, see `../../script-skill.md`); keep lines short |
| Retention | 30 days; one file per level per day, a new file past 50 MB | the Log Record | older files are deleted |
| Masking | a Secret value of 8 bytes or more becomes `••••` | only in a node that imports `system/secrets` | see `secrets.md` |

## Mistakes that break it

| Mistake | What happens | Write instead |
|---|---|---|
| `console.log(x)` | reaches no Log Record | `Log.info(x)` |
| `Log.error(e)` with an `Error` | the line is `{}` (an Error has no JSON fields) | `Log.error(e.message)` or `` `${e.name}: ${e.message}` `` |
| `Log.info('rows', rows)` | only `rows` is lost: one argument is read | `` Log.info(`rows ${JSON.stringify(rows)}`) `` |
| logging a whole API answer at `info` | long, noisy lines, every run | `Log.debug` a few fields |
| expecting the person to see it | the chat shows nothing | `system/chat` `writeOut(…)` for interim text |
| logging a secret to check it | the line says `••••` (in that node) | log `Secrets.has('NAME')` |
| relying on logs with no Log Record | every line is dropped | ask the admin for an Agent or Space Log Record |

## Example

```js
import Http from 'system/http';
import Log from 'system/log';

export const exec = async (props) => {
    Log.info(`looking up order ${props.orderId}`);
    let res;
    try {
        res = await Http.getJson(`https://shop.example.com/orders/${encodeURIComponent(props.orderId)}`);
    } catch (e) {
        Log.error(`shop unreachable: ${e.message}`);
        throw e;                                   // → error edge (+ the engine's own failure line)
    }
    if (!res.ok) {
        Log.warning(`shop answered ${res.status} for ${props.orderId}`);
        return { found: false };
    }
    Log.debug({ status: res.body.status, items: res.body.items?.length ?? 0 });
    dictionary.order = res.body;
    return { found: true };
};
```
