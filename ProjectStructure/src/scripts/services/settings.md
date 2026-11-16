# `src/scripts/services/<service>/settings.js`

## Description

"A place where we can store values": the service's **code constants and defaults** — the base URL, the paths,
page sizes, text limits, the default shelf or calendar. It is deployed with the code and readable by anyone who
can read the project, so it **never** holds a secret.

The standard wants it so that no number or URL is written inline in `service.js` or `connector.js`: a reviewer
sees every tunable value of the service in one short file, and the builder knows which values an admin may
override from the console.

### The three places a value can live

| Layer | Where | Who changes it | Takes effect | Visible to | Put here |
|---|---|---|---|---|---|
| `settings.js` | the project's code | a developer or the builder | after a deploy | anyone who reads the project | defaults: base URL, paths, page sizes, text limits |
| Json Settings (`system/settings`) | the agent's page in the console | an admin | from the next Script node, no deploy | anyone who can read the agent; carried by its export | plain values, snake_case keys: the switch `<service>_available`, a title, another base URL, a shelf |
| Secrets (`system/secrets`) | the agent's Secrets card | an admin, write-only | from the next node that imports `system/secrets` | no one — masked as `••••`; not exported | API keys, client secrets, passwords |

The tool reads the Json Settings and Secrets and passes them in; `settings.js` gives the default when a Json
Setting is absent (`options.baseUrl ?? BASE_URL` in the connector). A person's own OAuth token is none of the
three — see [`connector.md`](connector.md) → OAuth.

## Location and name

- `src/scripts/services/<service>/settings.js` — required (house standard), exactly this name.
- Imported with `'./settings.js'` by `service.js`, `connector.js` and `utils.js` — never by the tool (the tool
  imports only `service.js`). A constant a tool needs (a cookie name, a default title) is re-exported by
  `service.js`: `import { DEFAULT_TITLE as TITLE } from './settings.js'; export const DEFAULT_TITLE = TITLE;`.

## Structure

| Export | Required | What it is for |
|---|---|---|
| `BASE_URL` | yes, for an HTTP service | the default `https://` address; a Json Setting may override it |
| path constants (`QUERY_PATH`, …) | as needed | one per route the connector or service calls |
| limits (`DEFAULT_LIMIT`, `MAX_LIMIT`, `…_MAX_CHARS`) | as needed | the sizes the instruments clamp to |

Only `export const NAME = <literal>` lines in UPPER_SNAKE_CASE: strings, numbers, booleans, or arrays and
objects of those. No functions, no imports, no reads of anything.

Must NOT be in it: an API key, a token, a client secret, a password, a private key, a webhook signing value — or
a placeholder for one (`'PASTE_KEY_HERE'`); a value that differs per agent and must change without a deploy (that
is a Json Setting); a request timeout (`system/http` has no timeout option — every call has the platform's 15 s).

## Rules and validation

What the platform enforces today: an ordinary ES module, linted as a helper by keen-validate (imports, forbidden
globals and names). Nothing reads its values for secrets: a key written here is deployed, visible in the project
and in the debugger, and **not** masked — masking covers only values saved as agent Secrets.

House standard (not checked by any tool yet): constants only; no `system/*` import; nothing key-like (a planned
validator rule will flag names such as `*_KEY`, `*_SECRET`, `*_TOKEN`, `PASSWORD` and long random-looking
strings in this file).

## Limits

None of its own beyond a script's. The values it sets must respect the platform's: an answer the service is asked
for stays under the 10 MB HTTP cap and well under the node's 30 MB; what the tool replies costs prompt tokens every
round. Json Settings are at most 1000 characters of JSON; Secrets are at most 50 per agent, 8 to 8192 bytes each.
Details: [`settings.md` (module)](../../../../Flow/Nodes/Script/references/system/settings.md),
[`secrets.md`](../../../../Flow/Nodes/Script/references/system/secrets.md),
[`http.md`](../../../../Flow/Nodes/Script/references/system/http.md).

## Mistakes that break it

| Mistake | What happens | Write instead |
|---|---|---|
| `export const API_KEY = 'vp_live_…'` | deployed in clear, readable by anyone with the project, never masked | an agent Secret, read by the tool |
| a per-customer address here | every change needs a deploy | a Json Setting, with this file's value as the default |
| `export const TIMEOUT_MS = 30000` | nothing uses it — the call still stops at 15 s | ask the service for less; page it |
| `import Settings from 'system/settings'` here | the file now depends on the engine and the agent | the tool reads Json Settings and passes them in |
| importing it in the tool | breaks the house standard (the tool imports only `service.js`); as `Settings` beside `system/settings` the file does not even load (two bindings with one name) | re-export the constant from `service.js` |
| a Json Setting key `docStoreUrl` | works, but breaks the house style of the keys | snake_case: `doc_store_api_url` |
| `BASE_URL = 'http://10.0.0.5:8080'` | `E_HTTP_SSRF` — scripts reach public hosts only | a public `https://` address |

## Example

```js
// src/scripts/services/docStore/settings.js
// Defaults for the fictional DocStore service (api.docstore.example.com). Code, not configuration: never a key here.
// The agent's Json Settings (read by the tools, plain values only): "doc_store_available" (the switch — off unless
// true), "doc_store_api_url" (overrides BASE_URL), "doc_store_shelf" (no default).
// The tools read the agent's Secret DOCSTORE_KEY.

export const BASE_URL = 'https://api.docstore.example.com';
export const QUERY_PATH = '/v1/query';
export const DOCUMENTS_PATH = '/v1/documents';

export const DEFAULT_LIMIT = 5;
export const MAX_LIMIT = 10;

export const QUERY_MAX_CHARS = 500;
export const TITLE_MAX_CHARS = 120;
export const SNIPPET_MAX_CHARS = 600;
export const CHUNK_MAX_CHARS = 2400;
```
