# `system/http`

## Description

Outbound HTTP for a Script node. The sandbox has no network, no `fetch` and no sockets; this module is the only
way out. The engine makes the request for the script, behind an address guard, and hands back the final
status and the response body.

Use it to call a real external API (a shop, a CRM, a search API, a public JSON service), with a key from
`system/secrets` or a token from `system/cookies`.

Do not use it for:

- a model call → an **LLM** node, never a model API from a script;
- the platform's own services, the machine itself (loopback) or a private network → refused (see Limits);
- binary downloads (images, PDFs, archives) → the body is always read as UTF-8 text, so binary bytes do not
  survive; ask the API for JSON or a URL instead;
- large responses → the body is capped at 10 MB, and parsed JSON costs 2–5× its size in the script's 30 MB.

The node itself (wiring, the error edge, the 15-minute run limit) is in `../../script-skill.md`.

## Import

```js
import Http from 'system/http';                                  // the frozen object: Http.get(…)
import { get, getJson, post, postJson, request } from 'system/http'; // any of the five, by name
```

`system/cookies` also exports `get`: when you import both by name, rename one
(`import { get as httpGet } from 'system/http'`).

## Functions

Every function is `async` and resolves to the same envelope:

| Field | Type | Meaning |
|---|---|---|
| `ok` | boolean | `true` when `status` is 200–299 |
| `status` | number | the status of the final response (after redirects) |
| `body` | string or JSON value | text, or parsed JSON for `getJson` / `postJson` |

Response headers are **not** returned (no `Location`, `Set-Cookie`, rate-limit headers). A HEAD, 204 or 304
answer has the body `""` (`null` for the JSON functions).

### `get(url, opts?)`

- `url` — string, required, absolute `http://` or `https://`.
- `opts.headers` — optional object of string → string.
- Returns `{ ok, status, body }`, `body` = the response text (`""` when empty).

```js
const res = await Http.get('https://example.com/robots.txt');
if (res.ok) dictionary.robots = res.body.slice(0, 500);
```

### `getJson(url, opts?)`

As `get`, but `body` is parsed: an empty body → `null`; valid JSON → the value; anything else (an HTML error
page, plain text) → the raw text. It never throws on a bad body. It does not send `accept: application/json`
(the default is `*/*`); add it to `opts.headers` if the API needs it.

```js
const res = await Http.getJson(`https://api.example.com/users/${id}`, { headers: { accept: 'application/json' } });
if (res.ok && typeof res.body === 'object') dictionary.user = { name: res.body.name };
```

### `post(url, body, opts?)`

- `body` — a string is sent as is; anything else is sent as `JSON.stringify(body)`; `undefined` sends no body
  (`content-length: 0`).
- The content type is `text/plain;charset=UTF-8` unless you set `content-type` in `opts.headers` — even when
  the body is an object. For JSON use `postJson`.
- Returns `{ ok, status, body }`, `body` = text.

```js
const res = await Http.post('https://hooks.example.com/in', 'a=1&b=2',
    { headers: { 'content-type': 'application/x-www-form-urlencoded' } });
```

### `postJson(url, body, opts?)`

- `body` — any JSON-able value; always sent as `JSON.stringify(body)`.
- Sets `content-type: application/json`; a `content-type` in `opts.headers` replaces it.
- Returns `{ ok, status, body }`, `body` parsed as in `getJson`.

```js
const res = await Http.postJson('https://api.example.com/v1/tickets', { title, priority: 2 });
if (!res.ok) throw new Error(`tickets API ${res.status}`);
```

### `request({ url, method, headers, body })`

- `url` — string, required.
- `method` — optional, default `GET`; upper-cased for you; only `GET`, `POST`, `PUT`, `PATCH`, `DELETE`,
  `HEAD`.
- `headers` — optional object of string → string.
- `body` — optional **string**. Ignored for `GET` and `HEAD`. `POST` / `PUT` / `PATCH` without a body send
  `content-length: 0`. Any non-string body fails the call (see Errors).
- Returns `{ ok, status, body }`, `body` = text (parse it yourself with `JSON.parse` in a `try`).

```js
const res = await Http.request({ url: `${base}/items/${id}`, method: 'PATCH',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify({ done: true }) });
```

## Errors

A 4xx / 5xx is **not** an error — it is a normal answer with `ok: false` (see Statuses). Every row below is a
**throw**: the script can catch it with `try / catch`; uncaught, the node fails and takes the error edge, and the
agent's Log Record gets `Script "<path>" failed: <message>`. In every message a secret value is shown as `••••`.

| When | What the script sees (`err.message`) | Node fails or catch | What to do |
|---|---|---|---|
| `url` missing or not a string; `request()` with no argument | `E_HTTP_BADREQ: missing url` | catch | pass an absolute URL string |
| method not one of the six | `E_HTTP_METHOD: "<METHOD>" not allowed` | catch | use GET / POST / PUT / PATCH / DELETE / HEAD |
| URL does not parse (relative, typo) | `E_HTTP_URL: invalid url "<url>"` | catch | build an absolute `https://…` URL; `encodeURIComponent` the parts |
| URL carries `user:pass@` | `E_HTTP_URL: url must not carry credentials` | catch | send an `authorization: Basic …` header (base64 helper: `../../../../../Services/access.md` §3) |
| scheme not http / https (`ftp:`, `file:`, `data:`) | `E_HTTP_SCHEME: only http/https allowed (got "<scheme>:")` | catch | use `https://` |
| the platform's host allow-list is set and the host is not on it | `E_HTTP_ALLOWLIST: host "<host>" not in allow-list` | catch | ask the platform operator; nothing in the script fixes it |
| an IP literal in a private / special range, any spelling | `E_HTTP_SSRF: blocked address "<ip>"` | catch | call a public address |
| an internal name (a loopback name, a name without a dot, `.local`, `.internal`, …) | `E_HTTP_SSRF: blocked host "<host>"` | catch | call a public host name |
| a name that resolves to any private / special address | `E_HTTP_SSRF: "<host>" resolves to blocked <ip>` | catch | the host is not reachable from scripts |
| the name does not resolve | `E_HTTP_DNS: cannot resolve "<host>"` or `E_HTTP_DNS: no address for "<host>"` | catch | check the host name (Json Settings, typo) |
| your headers too large | `E_HTTP_HEADERS: request headers too large` | catch | send fewer / shorter headers (≤ 16 384 characters) |
| a 4th redirect | `E_HTTP_REDIRECT: too many redirects` | catch | call the final URL directly |
| a redirect to another origin that would keep the request's body (a 307 / 308 after a request with a body; a 301 / 302 after a PUT / PATCH / DELETE with a body) | `E_HTTP_REDIRECT: a redirect to another origin would re-send the request body` | catch | call the final URL directly (with its own key, if it needs one) |
| a redirect `Location` that does not parse | `E_HTTP_URL: invalid redirect location "<location>"` | catch | call the final URL directly |
| the whole call takes over 15 s | `TimeoutError: The operation was aborted due to timeout` | catch | ask for less, page the API; do not retry in a tight loop |
| the decoded body is over 10 MB | `E_SAB_OVERFLOW: response exceeds 10485760 byte data budget` | catch | ask for fewer fields / a page; filter on the API side |
| a second `system/http`, `system/agent` or `system/dictionary` read while one is running (`Promise.all`, a call not awaited) | `E_SAB_BUSY: one buffer op at a time — await each before the next` | catch (the read that collides throws) | `await` each call before the next |
| connection refused / reset, TLS failure | the transport's own text, e.g. `connect ECONNREFUSED 1.2.3.4:443`, `socket hang up`, `certificate has expired` | catch | log it, answer the person, maybe retry once in a later run |
| a header value with a line break or a bad header name | e.g. `TypeError: Invalid character in header content ["x-a"]`, `TypeError: Header name must be a valid HTTP token ["bad name"]` | catch | `String(v).trim()`; plain token names |
| `request()` body not a string | `TypeError: The "string" argument must be of type string or an instance of Buffer or ArrayBuffer. Received …` | catch | `body: JSON.stringify(obj)` |
| a compressed answer that does not decompress | the decompressor's text, e.g. `incorrect header check` | catch | report it; the API sent a broken body |
| outbound HTTP switched off by the platform | `E_HTTP_DISABLED: system/http is not enabled on this engine` | catch | nothing in the script fixes it |
| the run was already cancelled | `E_HTTP_CANCELLED` | the run is ending | nothing |
| any other host failure | `E_HTTP_FAILED: request failed` | catch | log it and fail the node |
| parsed JSON pushes the script past 30 MB | the sandbox is stopped | node fails, **not** catchable | ask for less data |

## Statuses

| Outcome | What the call does |
|---|---|
| 200–299 | resolves, `ok: true` |
| 400–599 (401, 404, 429, 500, …) | resolves, `ok: false`, `status` set, `body` = the error page / JSON (no throw) |
| 3xx **with** a `Location` | followed: the next request goes to `Location` (resolved against the current URL), checked again by every rule; up to 3 times, then the 4th throws `E_HTTP_REDIRECT` |
| 3xx **without** a `Location` (e.g. 304) | resolves, `ok: false`, `status` = the 3xx |
| HEAD, 204, 304 | resolves with an empty body (`""`, or `null` from the JSON functions) |
| timeout | throws `TimeoutError: …` |
| refused address / name / scheme | throws `E_HTTP_SSRF` / `E_HTTP_SCHEME` / `E_HTTP_ALLOWLIST` |
| network or TLS failure | throws the transport's message |
| body too big | throws `E_SAB_OVERFLOW` |

**What a redirect hop carries**, compared with the **original** URL's origin (scheme + host + port — `https:` →
`http:` on the same host is another origin):

- **the same origin** (also a hop back to it after a detour): your headers again; the method and body as below;
- **another origin:** **none of your headers** (no `authorization`, `x-api-key`, `cookie` or any other you set) — only
  the engine's own defaults; if that hop would still send a body (a 307 / 308, or a 301 / 302 after a PUT / PATCH /
  DELETE, when the request had a body), the call is **refused** with `E_HTTP_REDIRECT: a redirect to another origin would re-send the request body`;
- **method and body** (the Fetch standard): a 303 (except on GET / HEAD) and a 301 / 302 on POST continue as **GET
  without the body** and without your `content-*` headers; a 307 / 308, and a 301 / 302 on PUT / PATCH / DELETE, keep
  them.

So a key read from `system/secrets` never leaves for a host you did not call. The engine never retries a call.

## Limits

| Limit | Value | Enforced | When exceeded |
|---|---|---|---|
| time per call (connect, every redirect, reading the body) | 15 s, the platform's setting | engine | `TimeoutError: The operation was aborted due to timeout` |
| redirects followed | 3 (so at most 4 requests), the platform's setting | engine, every hop | `E_HTTP_REDIRECT: too many redirects` |
| response body | 10 MB = 10 485 760 bytes **after** decompression, the platform's setting | engine, while reading | `E_SAB_OVERFLOW` (that call only) |
| response in script memory | the decoded text, and 2–5× its size once parsed, inside the script's 30 MB | sandbox | the node fails, not catchable |
| request headers you set | the sum of name + value lengths ≤ 16 384 characters | engine | `E_HTTP_HEADERS` |
| request body | no cap of its own; the script's 30 MB memory bounds it | sandbox | the node fails |
| calls at the same time | 1 per node (shared with `system/agent` and `system/dictionary` reads) | sandbox | `E_SAB_BUSY` |
| calls per node | no count; the run's 15-minute limit applies | engine | see `../../script-skill.md` |
| methods | `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD` | engine | `E_HTTP_METHOD` |
| schemes | `http:`, `https:` | engine, every hop | `E_HTTP_SCHEME` |
| ports | any port | — | — |
| hosts | public addresses only; when the platform sets a host allow-list, only those hosts (and their subdomains) | engine, every hop | `E_HTTP_SSRF` / `E_HTTP_ALLOWLIST` |

Refused without a lookup: the loopback host name and its subdomains; any name ending in `.local`, `.localdomain`, `.internal`,
`.intranet`, `.private`, `.lan`, `.home`, `.corp`, `.home.arpa`; any name with no dot. Refused IPv4 (any spelling:
decimal, hex, octal): `0/8`, `10/8`, `100.64/10`, `127/8`, `169.254/16`, `172.16/12`, `192.0.0/24`, `192.0.2/24`,
`192.88.99/24`, `192.168/16`, `198.18/15`, `198.51.100/24`, `203.0.113/24`, `224/4`, `240/4`. Refused IPv6: `::/96`,
`64:ff9b:1::/48`, `100::/64`, `2001::/23`, `2001:db8::/32`, `2002::/16`, `3fff::/20`, `5f00::/16`, `fc00::/7`,
`fe80::/10`, `fec0::/10`, `ff00::/8`, an address with a zone (`%eth0`), and any IPv6 that carries a refused IPv4.
A name is resolved once per hop; if **any** answer is refused, the call is refused, and the connection goes only to
the checked answers.

Headers the engine handles:

- dropped if you set them: `host`, `content-length`, `connection`, `transfer-encoding` (any case);
- dropped silently: a header whose value is not a string (`{ 'x-page': 2 }` sends nothing — write `'2'`);
- added unless you set the same name: `accept: */*`, `accept-language: *`, `sec-fetch-mode: cors`,
  `user-agent: node`, `accept-encoding: gzip, deflate`;
- `content-length` is always computed; `content-type: text/plain;charset=UTF-8` when there is a body and no
  `content-type`;
- `gzip` / `x-gzip`, `deflate` and `br` answers are decoded for you; an unknown encoding is passed through raw.

The body is always decoded as UTF-8, whatever `charset` the answer names.

## Mistakes that break it

| Mistake | What happens | Write instead |
|---|---|---|
| not checking `res.ok` | a 401 / 404 / 500 passes as success, `res.body` is an error page | `if (!res.ok) throw new Error(\`API ${res.status}\`)` |
| no `try / catch` and no `error` edge | a timeout or DNS failure stalls the run | wrap the call, or wire `error` |
| `await Promise.all([Http.get(a), Http.get(b)])` | `E_SAB_BUSY` | `for` loop with `await` on each call |
| a call not awaited, then a `system/agent` read | the read throws `E_SAB_BUSY` | `await` every call |
| `fetch(url)` | keen-validate error; at run time `fetch` is not defined → error edge | `Http.get(url)` |
| `Http.post(url, { a: 1 })` to a JSON API | sent as `text/plain;charset=UTF-8`; the API may refuse it (415 / 400) | `Http.postJson(url, { a: 1 })` |
| `request({ …, body: { a: 1 } })` | throws `TypeError: The "string" argument must be …` | `body: JSON.stringify({ a: 1 })` |
| `request({ method: 'OPTIONS' })` | `E_HTTP_METHOD` | one of the six methods |
| `headers: { 'x-limit': 50 }` | the header is silently not sent | `'x-limit': '50'` |
| `Http.get('/api/orders')` or a host from a setting without `https://` | `E_HTTP_URL: invalid url` | an absolute URL |
| `https://user:pass@api.example.com` | `E_HTTP_URL: url must not carry credentials` | an `authorization: Basic <base64 of user:pass>` header — the sandbox has no `btoa`, `Buffer` or `TextEncoder`, so build the base64 with a pure-JS helper (one checked against Node's `Buffer`: `../../../../../Services/access.md` §3) |
| calling `http://internal-service`, `http://10.0.0.5` | `E_HTTP_SSRF` | a public host |
| `${base}/search?q=${text}` with raw user text | a broken or different URL | `encodeURIComponent(text)` |
| relying on a redirect to another host to keep your key | the next host gets none of your headers — the call fails there with 401 / 403 | call the final URL directly with the key it needs |
| reading `res.headers` | `undefined` — headers are not returned | ask the API to put what you need in the body |
| downloading an image / PDF | garbled text | let the API return a URL or JSON |
| `dictionary.data = res.body` with a huge answer | memory, the 1.5 MB dictionary cap, `••••` if it holds a secret | keep only the fields the next node needs |
| a string `body` on a `GET` | silently not sent | put the data in the query string, or use `POST` |

## Example

Read a customer with an API key from the agent's Secrets, then create a note for them.

```js
// src/scripts/crm/add-note.js
import Http from 'system/http';
import Secrets from 'system/secrets';
import Settings from 'system/settings';
import Log from 'system/log';

export async function exec(props) {
    const key = Secrets.get('CRM_API_KEY');
    if (key === undefined) throw new Error('CRM_API_KEY is not set on this agent');
    const base = Settings.get('crmUrl') ?? 'https://api.crm.example.com';
    const headers = { authorization: `Bearer ${key}`, accept: 'application/json' };

    let res;
    try {
        res = await Http.getJson(`${base}/v1/customers/${encodeURIComponent(props.email)}`, { headers });
    } catch (err) {                                    // timeout, DNS, refused address, network
        Log.error(`CRM unreachable: ${err.message}`);
        dictionary.note = { saved: false, reason: 'unreachable' };
        return { ok: false };
    }
    if (res.status === 404) { dictionary.note = { saved: false, reason: 'no such customer' }; return { ok: false }; }
    if (!res.ok) throw new Error(`CRM answered ${res.status}`);          // → error edge

    const created = await Http.postJson(`${base}/v1/customers/${res.body.id}/notes`,   // awaited: one call at a time
        { text: String(props.text).slice(0, 2000) }, { headers });
    if (!created.ok) throw new Error(`CRM note ${created.status}`);

    dictionary.note = { saved: true, id: created.body.id };
    return { ok: true };
}
```
