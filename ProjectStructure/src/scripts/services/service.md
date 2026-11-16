# `src/scripts/services/<service>/service.js`

## Description

The service's **entry and its list of instruments**: `connect(credentials, options)` assembles the connection
(through `connector.js`) and returns one method per action the LLM may take ("search the documents", "read one
chunk", "create a calendar event"). Each tool connects, calls its one instrument with the arguments, and turns the
result or the error into its reply to the model.

The standard wants it so that the actions live in one place with one shape. The builder adds an action by adding
one function here, one tool, and its entry in the service's skill; the connector does not change. Because an
instrument receives its connection instead of reading a secret, it can be called in a test with a fake connection
object.

## Location and name

- `src/scripts/services/<service>/service.js` — required (house standard), exactly this name.
- Imported by the tool with a relative path — the only service file the tool imports:
  `import * as DocStoreService from '../services/docStore/service.js';`
- It assembles the connection: `DocStoreService.connect(credentials, options)` calls `connector.js`'s
  `createConnection` and returns the instruments bound to that connection.
- Function names are verbs in lower camel case and say the action: `search`, `getChunk`, `listEvents`,
  `createEvent`. One function per LLM action; a helper used by two functions goes to `utils.js`.

## Structure

| Export | Required | What it is for |
|---|---|---|
| `connect(credentials, options)` (a named export; the tool reaches it as `<Name>Service.connect` through `import * as`) | yes | builds the connection with `createConnection` from `connector.js` and returns a frozen `{ <action>(args), … }` — the instruments bound to it |
| one `async function <action>(connection, args)` per LLM action (module-private) | at least one | checks `args`, calls the service through `connection`, returns a small plain result |
| a constant a tool needs (a cookie name, a default title) | when needed | re-exported from `settings.js` (`export const DEFAULT_TITLE = TITLE;`), so the tool imports nothing else |

Every instrument follows the same contract (house standard):

- **Arguments:** inside `service.js`, `connection` first (the object `connector.js` returned), then one plain
  `args` object; the tool calls the bound instrument with `args` only (`docStore.search({ … })`). The
  function checks and cleans every argument itself — the model's input arrives unchecked.
- **Return:** a small, plain, JSON-able object with only the fields the model needs (titles, ids, short texts).
  Never the raw answer of the service: the tool sends the result to the model as text, and the conversation keeps
  it.
- **Errors:** throw an `Error` whose message the model can repeat to the person, in plain words, with a
  `retryable` flag (`serviceError(message, retryable)` from `utils.js`). Bad input from the model →
  `retryable: true` plus what to send instead; a refused key or a service outage → `retryable: false` or `true`
  as the case is.

Must NOT be in it: an import of `system/secrets` or `system/settings` (the tool reads them and passes values in),
`system/http` (the connection makes the calls), `system/agent` (only the tool replies), an `exec`, module-level
state meant to survive between calls (the sandbox is fresh per node run), a URL or a limit written inline (they
live in `settings.js`).

## Rules and validation

What the platform enforces today: the file is an ordinary ES module that keen-validate lints as a helper (no
`exec` needed; only `system/*` and existing relative `.js` imports; no `fetch`, `require`, `eval`, `Function`,
dynamic `import()`, `with`, `process`, `global`, `globalThis`, `module`, `exports`; no `__proto__`,
`constructor`, `prototype`, `getPrototypeOf`, `setPrototypeOf`; a warning for `crypto` and for `Promise.all`
over `system/http` reads). The deploy refuses the same forbidden constructs. Nothing checks what a function
returns or throws.

House standard (not checked by any tool yet): `connect` + the `(connection, args)` instruments; no `system/secrets`,
`system/settings`, `system/cookies`, `system/http` or `system/agent` import here; each instrument listed in the
service's skill (`.claude/skills/<service-in-kebab>-service/SKILL.md`) with when to use it, its input, reply, limits
and errors.

## Limits

The instruments run inside the tool's node: 30 MB for everything the node holds, a 10 MB cap on each HTTP answer,
one HTTP call at a time (`await` each — `Promise.all` throws `E_SAB_BUSY`), 15 s per call, 15 minutes per run.
Ask the service for a page, not everything, and keep only the fields you return. Details:
[`script-skill.md`](../../../../Flow/Nodes/Script/script-skill.md) → Limits,
[`http.md`](../../../../Flow/Nodes/Script/references/system/http.md) → Limits.

## Mistakes that break it

| Mistake | What happens | Write instead |
|---|---|---|
| `Secrets.get(...)` inside an instrument | works, but the function needs the engine to test and the key's reader is no longer one place | take `connection` as the first argument |
| returning the service's whole answer | the model's prompt fills with noise; a large answer costs tokens every round | map to the few fields the model needs |
| `throw new Error('400')` | the model cannot tell the person or itself what to fix | `serviceError('The query is empty. Send {"query": "<text>"}.', true)` |
| `await Promise.all(ids.map(id => connection.get(...)))` | `E_SAB_BUSY` | a `for` loop with `await` |
| trusting `args.limit` | `"1000"` or `-1` reaches the service | `clampInt(args.limit, 1, MAX_LIMIT, DEFAULT_LIMIT)` |
| `encodeURIComponent` forgotten on an id from the model | a broken or different path | encode every path part |

## Example

```js
// src/scripts/services/docStore/service.js
// The DocStore service: connect() assembles the connection (through connector.js) and returns the instruments —
// one method per action the model may take. The tools import ONLY this file.
import { createConnection } from './connector.js';
import { CHUNK_MAX_CHARS, DEFAULT_LIMIT, DOCUMENTS_PATH, MAX_LIMIT, QUERY_MAX_CHARS, QUERY_PATH, SNIPPET_MAX_CHARS, TITLE_MAX_CHARS } from './settings.js';
import { clampInt, cleanText, serviceError } from './utils.js';

/**
 * Connect and get the instruments.
 * credentials: { apiKey } (the Secret DOCSTORE_KEY).
 * options:     { baseUrl } (the Json Setting doc_store_api_url, optional).
 */
export function connect(credentials, options = {}) {
    const connection = createConnection(credentials, options);
    return Object.freeze({
        search: args => search(connection, args),
        getChunk: args => getChunk(connection, args)
    });
}

/** Search the document store; returns the best passages, each short enough for the model. */
async function search(connection, { query, limit, shelf } = {}) {
    const text = cleanText(query, QUERY_MAX_CHARS);
    if (text === '') throw serviceError('The search query is empty. Send {"query": "<text>"}.', true);

    const body = { query: text, limit: clampInt(limit, 1, MAX_LIMIT, DEFAULT_LIMIT) };
    if (typeof shelf === 'string' && shelf.trim() !== '') body.shelf = shelf.trim();

    const answer = await connection.post(QUERY_PATH, body);
    const hits = Array.isArray(answer.hits) ? answer.hits.slice(0, body.limit) : [];
    return {
        total: Number(answer.total) || hits.length,
        hits: hits.map(hit => ({
            documentId: cleanText(hit.documentId, 64),
            index: clampInt(hit.index, 0, 100000, 0),
            title: cleanText(hit.title, TITLE_MAX_CHARS),
            page: Number(hit.page) || null,
            text: cleanText(hit.text, SNIPPET_MAX_CHARS)
        }))
    };
}

/** Read one passage of a document the model found with `search`. */
async function getChunk(connection, { documentId, index } = {}) {
    const id = cleanText(documentId, 64);
    const n = clampInt(index, 0, 100000, -1);
    if (id === '' || n < 0) throw serviceError('Send {"documentId": "<id from a search hit>", "index": <number from the same hit>}.', true);

    const answer = await connection.get(`${DOCUMENTS_PATH}/${encodeURIComponent(id)}/chunks/${n}`);
    return { documentId: id, index: n, title: cleanText(answer.title, TITLE_MAX_CHARS), text: cleanText(answer.text, CHUNK_MAX_CHARS) };
}
```
