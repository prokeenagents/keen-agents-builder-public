# Script (`scriptNode`)

Runs one JavaScript file of the project in a sandbox and continues out of **`next_1`** when it returns, or
**`error`** when it throws.

## Description

The Script node is the agent's code. Its script receives the node's key / value pairs as `props`, reads and
writes the current flow's `dictionary`, and reaches everything else through `system/*` imports: outbound HTTP,
the run's session, the conversation, the agent's Json Settings and Secrets, the consumer's cookies, logs and
interim chat messages.

Use it to:

- call an external API (`system/http`), with a key from the agent's Secrets (`system/secrets`);
- compute, parse, reshape or validate data and put the result into the dictionary for the next nodes;
- prepare a number or boolean a **Condition** can test (a list's length, "is it empty");
- read configuration from the agent's Json Settings (`system/settings`);
- write a message into the conversation that an **LLM** node then answers (`system/agent`).

Use something else when:

- you only set a few literal or `${…}` values → **Assignment**;
- the step needs a model's judgement or wording → **LLM** (never call a model API from a script);
- you branch on a value you already have → **Condition**;
- you repeat steps per list item → **Loop** (one at a time) or **Parallel Context** (in parallel, waves of up to 15), with a small
  Script inside if needed — not one script doing all the work;
- you need another flow → **Run Flow** / **Jump Flow**.

A script the **LLM** calls as a tool is not a Script node: it lives under `src/scripts/tools/`, its
`keen-tools.json` entry starts with `tools/` and has no `..`, and it answers through `system/agent`, not through
its return value. See `../LLM/references/tool-calling.md`.

## In / Out

- **In:** `in`, takes **several** edges. Any node with an out handle may connect into it — Start Flow `next`,
  LLM `next_1` / `error`, Summarizer `next_1`, Condition `true` / `false`, Loop `out` / `next_1`, Assignment,
  Script, Run Flow, Join Flow, Parallel Flows and Parallel Context `next_1` — except LLM `summary` (only to a
  Summarizer), Summarizer `error` (only to another Summarizer) and Flow Pointer `next` (only to a Parallel Flows
  `wait`).
- **Out:** `next_1` (the clean return) and `error` (below). Each may lead to the `in` of any node that has one,
  and to a Loop's `next_2` when the Script ends a loop body. Not allowed: Start Flow, Flow Pointer and Note (no
  In), a Summarizer (its In takes only Summary / Fallback edges) and a Parallel Flows `wait`. A single-in target
  (Condition, Assignment, Parallel Context, Loop `next_2`) may have no other incoming edge — put a Join Flow in
  front.
- **`next_1` unwired:** the script runs and its writes are committed, then that path ends (no next node).
  keen-validate warns. If no other path reaches an End Flow, the person gets no answer.

## Fallback

None. The Script's failure output is `error` — see Error.

## Error

`error` is where the run goes when the node fails. The engine takes it when:

- the script throws (your `throw`, a `TypeError`, an uncaught `system/http` transport error, `E_SAB_BUSY`, …);
- the script file is missing, does not compile, imports something not allowed, or has no exported `exec`;
- the return value cannot be copied out (a function, a class instance);
- the script passes its memory (30 MB) — the sandbox is stopped;
- the run's writes break a cap (dictionary or session 1.5 MB, a non-primitive session value, agent state 8 MB);
- the agent's Secrets cannot be fetched (`The agent's secrets could not be read.`).

On the error edge the dictionary changes and queued agent writes are **dropped**; session writes are **kept**,
so the handler can read them. The agent's Log Record gets one line: `Script "<script path>" failed: <message>`.

**Not** the error edge: the **15-minute time limit** (the run ends with the terminal `E8101 Script time limit
reached!`, nothing of the node is written, the same `Script "<path>" failed: Script time limit reached!` line is
logged), an engine overload eviction (retried by the platform) and a cancel by the person. No edge can catch
these.

**With no `error` edge nothing runs after this node:** in the root flow the person's chat turn ends without an
answer; in a Parallel Flows branch the branch ends there (and counts as finished); the only trace is the failure
line in the Log Record. keen-validate warns. Wire `error` on every Script
that can fail — typically to an LLM that tells the person what went wrong, a Script that cleans up, or an End
Flow. The same targets as `next_1` are allowed.

## Settings

| Field (canvas) | JSON key | Rule | What it is for |
|---|---|---|---|
| Script path | `data.settings.value` | required; ends in `.js`; ≤ 160; a literal (no `${…}`) | the file to run, relative to `src/scripts/` (`fetch-order.js`, `orders/fetch.js`); it must exist |
| Label | `data.settings.label` (and `data.label`) | ≤ 60 | the name on the card; not read by the engine |
| Dictionary Key/Value Pairs | `data.settings.keyValuePairs` | ≤ 10 pairs; key 1–100, unique; value a string ≤ 200; values take `${…}` | the `props` object `exec` receives |
| Description | `data.description` | ≤ 250 | a note; not read by the engine |

How a pair's value arrives in `props`:

- a plain literal is a **string** (`"10"` → `"10"`; convert with `Number(props.x)`);
- exactly one placeholder (`${dictionary.order}`) keeps the type of a string, number, boolean or list — **an
  object or a missing value arrives as `null`** (read objects from the `dictionary` global instead);
- text mixed with placeholders is a string; an object or list inside it becomes `""`.

## Rotate

Yes. Rotate turns the three dots around the card: `data.handlePosition` is where **In** sits — `top` (the
default; then Error is left, Out bottom), `right`, `bottom` or `left`; Out is always opposite In and Error one
step before it. The key is absent until the node is first rotated. Cosmetic only: it never changes wiring or
running.

## JSON structure

| Property | Required | What it means |
|---|---|---|
| `id` | yes | `scriptNode_` + 12 characters `A–Z a–z 0–9`, unique in the project; the prefix is the node's kind |
| `type` | `"scriptNode"` | the node kind |
| `position.x`, `position.y` | yes | canvas place, multiples of 16; not read by the engine |
| `data.label` | no | the card's label (same text as `settings.label`); not read by the engine |
| `data.description` | no | ≤ 250, a note; not read by the engine |
| `data.labelNode` | `"Script"` | fixed card title |
| `data.descriptionNode` | `"Execute custom JS script"` | fixed card subtitle |
| `data.open` | no — leave it out | the canvas no longer reads or writes it (every panel opens closed; one already in a file is kept). Not read by the engine. |
| `data.handlePosition` | no | `top` / `right` / `bottom` / `left`, see Rotate; not read by the engine |
| `data.settings.value` | yes | the script path — see Settings; read as a literal |
| `data.settings.label` | no | the label the card shows; not read by the engine |
| `data.settings.keyValuePairs` | no | `[{ "key": "<name>", "value": "<text or ${…}>" }]` → `props`; see Settings |
| `dragHandle` | `".drag-handle__custom"` | fixed |

The engine reads only `data.settings.value` and `data.settings.keyValuePairs`.

## In the `.flow` file

```json
{
  "id": "scriptNode_Kq81LmZx0PaB",
  "type": "scriptNode",
  "position": { "x": 304, "y": 736 },
  "data": {
    "label": "Fetch order",
    "description": "Reads the order from the shop API",
    "labelNode": "Script",
    "descriptionNode": "Execute custom JS script",
    "open": false,
    "settings": {
      "value": "orders/fetch-order.js",
      "label": "Fetch order",
      "keyValuePairs": [ { "key": "orderId", "value": "${dictionary.orderId}" } ]
    }
  },
  "dragHandle": ".drag-handle__custom"
}
```

```json
{ "id": "xy-edge__scriptNode_Kq81LmZx0PaBnext_1-agentNode_Ab12Cd34Ef56in", "type": "step",
  "source": "scriptNode_Kq81LmZx0PaB", "sourceHandle": "next_1",
  "target": "agentNode_Ab12Cd34Ef56", "targetHandle": "in" },
{ "id": "xy-edge__scriptNode_Kq81LmZx0PaBerror-agentNode_Zz98Yy76Xx54in", "type": "step",
  "source": "scriptNode_Kq81LmZx0PaB", "sourceHandle": "error",
  "target": "agentNode_Zz98Yy76Xx54", "targetHandle": "in" }
```

The script file (`src/scripts/orders/fetch-order.js`) is an ES module with a **named** `exec`:

```js
import Http from 'system/http';          // only system/* and ./relative files
import { clean } from '../lib/clean.js'; // exact path with .js, inside src/scripts

export async function exec(props) {       // `export const exec = async (props) => …` works too
    dictionary.result = clean(props.raw);  // results go into the dictionary
    return { done: true };                 // plain data; no later node reads it
}
```

- `exec(props)` is awaited. Its return value must be plain, copyable data; the engine keeps it nowhere a later
  node can read — write results into `dictionary` (or the session). The return value DOES travel to the person's
  browser in the node's reply (only the agent's Secrets are masked): never return tokens, raw API answers or other
  people's data.
- Bare globals: `dictionary` (the current flow's dictionary, writable), `flowContext` (this call's ids:
  `sessionId`, `requestId`, `flowId`, `parentFlowId`, …), and inside a tool flow `toolOptions`. There is no
  `console`, `fetch`, `crypto`, `Buffer`, `process`, `require` or timer: use the `system/*` modules.
- A helper file you import is a normal module and needs no `exec`.
- The deploy refuses any script that uses `eval`, `Function`, `require`, dynamic `import()`, `with`, refers to
  `process` / `global` / `globalThis` / `module` / `exports` / `__dirname` / `__filename`, or touches
  `__proto__` / `constructor` / `prototype` / `getPrototypeOf` / `setPrototypeOf` on an object.

The ten modules (`system/log`, `chat`, `session`, `dictionary`, `agent`, `settings`, `secrets`, `cookies`,
`http`, `tools`) each have their own file under `references/system/<module>.md` — every function, argument,
return value, error, status and limit; `references/system-modules.md` is the index. Read a module's file before
you use it for the first time in a project.

## Limits

Every Script node runs in its own fresh sandbox. These are the platform's defaults; the platform can change them.

| What | Limit | When it is crossed |
|---|---|---|
| Memory for the script itself (variables, objects, strings, the code) | **30 MB** | the sandbox is stopped and the node takes its **error** output |
| The data buffer for what comes **into** the script: an HTTP response body, a `system/agent` or `system/dictionary` read | **10 MB**, fixed, on top of the 30 MB (the sandbox is 40 MB in all) | that one call fails (`E_SAB_OVERFLOW: response exceeds … byte data budget` for HTTP); the script can catch it |
| The current flow's `dictionary` after the node | **1.5 MB** (JSON size) | the node's writes are refused and the node takes its **error** output |
| The run's `session` after the node | **1.5 MB**, and only primitive values (string, number, boolean, null) | same as above |
| The conversation (`system/agent`) | **8 MB** per entry and per run; **200** entries per agent / channel (the oldest drop off) | an oversized write is refused (error output) |
| Time for one script run | **15 minutes** from when it starts executing (queue time and a pause in the script debugger do not count) — per node / per tool call, not per chat | the run ends with `E8101 Script time limit reached!` — **not** the error output — nothing of the node is written, and one `Script "<path>" failed: Script time limit reached!` line goes to the agent's Log Record |
| One HTTP call | **15 s**, redirects and reading the body included; at most **3** redirects | the call fails; the script can catch it (see `references/system/http.md`) |
| Settings handed to the script (the node's Key/Value Pairs) | **10** pairs, key ≤ 100 characters, value ≤ 200 | the canvas and keen-validate refuse more |
| Script path | ends `.js`, ≤ 160 characters | keen-validate refuses it |
| In the script debugger only | the script gets **128 MB** instead of 30 | — |

Stay well below the memory: read a large HTTP answer, keep the few fields you need, and drop the rest before you
write to the dictionary. Loading a whole list of thousands of records into the dictionary is the most common way
to hit the 1.5 MB cap — store ids or a page, and fetch the rest in the node that needs it.

When the engine as a whole runs short of memory it may stop a running script before its own limits are reached;
that is an engine stop like the time limit (no error output, one failure line in the agent's Log Record).

Every module's own limits (sizes, counts, time-outs) are in its file under `references/system/`.

**What a script cannot do — by design — and what to do instead:**

| It cannot | Because | Do instead |
|---|---|---|
| keep a value for the **next message** | every store lives one run: the dictionary, `system/session`, `system/channels`, `system/agent` are wiped at the root End (60 s idle as a backstop); `system/cookies` is read-only | business state (a cart, a booking, a chosen account) in the partner's own system, read again through its API each message; the person's link to an outside account in a site cookie; the conversation in the LLM's chat history + Summarizer |
| refresh an end user's token and keep it | the same: a refreshed token is lost when the run ends | the **site** refreshes it and the agent receives a valid access token every message (`../../../Entanglement/connectors.md` § "Keeping the token fresh") |
| read **binary** content (PDF, image, docx, zip) | `system/http` reads every body as UTF-8 text, and there is no library to parse such files | an API that returns text (Google Drive `files.export` as `text/plain`; a provider's text endpoint), or a document service that extracts text and answers JSON — never parse a file in the script |
| use a package | only the `system/*` modules exist; `node:*` and npm imports are refused at deploy | `system/http` to a service that does the work |

## How the engine runs it

1. Opens the current flow's dictionary and the run's session, then resolves each key / value pair into
   `props` (rules in Settings).
2. Reads `src/scripts/<settings.value>` from the deployed project (missing → error edge).
3. Reads the agent's Json Settings (failure → no fields, the node goes on). If the script or one of its imports
   imports `system/secrets`, fetches the agent's Secrets for this node only (failure → error edge).
4. Starts a fresh sandbox (30 MB for the script + a 10 MB buffer for HTTP / agent / dictionary reads), loads
   the module and its imports — a forbidden import fails with `ivm: import "<x>" not supported — …` — and
   finds `exec` (else `Script "<path>" does not export an async \`exec\` function (got: undefined)`).
5. Calls `exec(props)` and waits. The time limit is 15 minutes for this one script run, counted from when it starts executing (queue time is not counted; a run paused in
   the script debugger is exempt). An HTTP call times out after 15 s.
6. On a clean return: reads back the `dictionary`, the session and the queued `system/agent` writes, replaces
   every Secret value in them with `••••`, checks every cap, and writes all three at once — or nothing, then
   the error edge. Then continues out of `next_1`.
7. On a throw: drops the dictionary changes and agent writes, writes the session (masked), logs
   `Script "<path>" failed: <message>` (masked) in the agent's Log Record, and continues out of `error` —
   or stalls if `error` has no edge.

The engine never retries a script that threw. Each node run is independent: nothing in the script's
variables survives to the next run.

## Mistakes that break it

| Mistake | What happens | Write instead |
|---|---|---|
| `error` left unwired | a throw stalls the run; the person gets no answer | wire `error` to a handler or End Flow |
| `export default function exec` / no `exec` | keen-validate error; at run time the error edge | `export async function exec(props)` |
| `settings.value` = `scripts/orders/fetch.js` or `fetch` | file not found (validator error) | the path under `src/scripts/` with `.js`: `orders/fetch.js` |
| `import _ from 'lodash'`, `node:crypto`, `system/logs` | keen-validate error, and the deploy refuses the project (only `./` / `../` files and the ten `system/*` modules pass) | own `./relative.js` files; `system/tools`; `system/log` |
| `import { x } from './util'` | `scripts/util` does not exist (no extension guessing) | `'./util.js'` |
| `props.limit > 5` with the value typed `10` | compares the string `"10"` | `Number(props.limit)` |
| a pair `${dictionary.order}` where `order` is an object | `props.order` is `null` | read `dictionary.order` in the script |
| `await Promise.all([Http.get(a), Http.get(b)])` | `E_SAB_BUSY` throws | `await` one call after the other |
| not checking `res.ok` | a 404 / 500 passes as success | `if (!res.ok) throw new Error(\`API ${res.status}\`)` |
| `dictionary.apiKey = Secrets.get('API_KEY')` for a later node | the dictionary stores `••••` | call `Secrets.get` in the node that uses it |
| `Session.setSessionValue('user', { … })` | node fails: session values must be primitive | flat keys, or the dictionary |
| returning a result and expecting the next node to see it | nothing stores the return value | `dictionary.x = …` |
| `console.log(...)` for debugging | no output anywhere | `Log.info(...)` (`system/log`) |
| a script that can run past 15 minutes | `E8101`, no error edge, nothing written | page the work across several nodes / runs |

## Example: fetch an order with a secret key

An LLM put the order number into `dictionary.orderId`. The Script reads the order and leaves a short
summary for the next LLM; a failure goes to an LLM that apologises.

```json
"settings": {
  "value": "orders/fetch-order.js",
  "label": "Fetch order",
  "keyValuePairs": [
    { "key": "orderId", "value": "${dictionary.orderId}" },
    { "key": "lang", "value": "${session.lang}" }
  ]
}
```

`next_1` → the LLM that answers with `${dictionary.order.status}`; `error` → the apologising LLM.

```js
// src/scripts/orders/fetch-order.js
import Http from 'system/http';
import Log from 'system/log';
import Secrets from 'system/secrets';
import Settings from 'system/settings';

export async function exec(props) {
    const id = String(props.orderId ?? '').trim();
    if (!/^[0-9]{4,12}$/.test(id)) {
        dictionary.order = { found: false, reason: 'invalid order number' };
        return { ok: false };                       // a clean "not found", not a failure
    }

    const key = Secrets.get('SHOP_API_KEY');
    if (key === undefined) throw new Error('SHOP_API_KEY is not set on this agent');
    const base = Settings.get('shopUrl') ?? 'https://shop.example.com';

    const res = await Http.getJson(`${base}/api/orders/${id}`, { headers: { authorization: `Bearer ${key}` } });
    if (res.status === 404) {
        dictionary.order = { found: false, reason: 'no such order' };
        return { ok: false };
    }
    if (!res.ok) throw new Error(`shop API answered ${res.status}`);   // → error edge + Log Record line

    dictionary.order = { found: true, status: res.body.status, total: res.body.total, lang: props.lang || 'en' };
    Log.info(`order ${id}: ${res.body.status}`);
    return { ok: true };
}
```
