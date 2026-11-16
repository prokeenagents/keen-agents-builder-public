# `system/cookies`

## Description

Read-only access to the cookies the person's website sent with the chat message that started this run —
typically a third-party token the site stored after the person clicked Connect (a mail account, a CRM). A cookie being
there is the consent signal: it exists only because the person connected.

Every flow and every Script node of the run sees the same cookies, as they were when the message was sent. They
live only as long as the run: the next message brings a fresh set; a cookie set during the run is seen from the
next message on.

What arrives is decided by the site, not by the agent. The reference site's chat SDK sends only cookies that the
page's JavaScript can read — never `HttpOnly` cookies — with their values URL-decoded, and can be limited to a
list of names.

Use it for a per-person token that the site holds. Use something else for:

- the agent's own keys and passwords → `system/secrets`;
- plain agent configuration → `system/settings`;
- values to keep or pass between nodes of the run → the `dictionary` global or `system/session`.

There is no write: a script cannot set, change or delete a cookie.

The node itself is in `../../script-skill.md`.

## Import

```js
import Cookies from 'system/cookies';              // the frozen object: Cookies.get(…)
import { get, all, has } from 'system/cookies';    // by name
```

`system/http` also exports `get`: when you import both by name, rename one
(`import { get as cookie } from 'system/cookies'`).

## Functions

### `get(name)`

- `name` — string, required, the exact cookie name (case-sensitive).
- Returns the value (a string, as the reference SDK sends it), or `undefined` when there is no such cookie, the
  run has no cookies, or `name` is not a string. An empty cookie is `""`, which is not `undefined`.

```js
const token = Cookies.get('gconnect');
if (!token) { dictionary.needsConnect = true; return { ok: false }; }
```

### `all()`

- Returns a new object `{ name: value, … }` of every cookie; `{}` when there are none. Changing it changes
  nothing for later calls.

```js
dictionary.cookieNames = Object.keys(Cookies.all());   // names only — never store the values
```

### `has(name)`

- Returns `true` when a cookie of that name was sent (even with an empty value), else `false`; `false` for a
  non-string `name`.

```js
if (!Cookies.has('crm_token')) throw new Error('not connected');
```

## Errors

| When | What the script sees | Node fails or catch | What to do |
|---|---|---|---|
| the cookie is not there | `get` → `undefined`, `has` → `false` | neither: no error | handle it (tell the person to connect) |
| `name` is not a string (`get(42)`) | `undefined` / `false` | neither | pass the name as a string |
| the run's stored cookies are unreadable (corrupt) | `{}` — as if none were sent | neither | as "not there" |
| the engine cannot load the run's cookies | the node fails before the script starts | error edge, not catchable | wire `error` |
| a named import that does not exist (`import { set } from 'system/cookies'`) | the module does not load | error edge | only `get`, `all`, `has` |

## Statuses

| State | `get(name)` | `has(name)` | `all()` |
|---|---|---|---|
| present with a value | the value | `true` | includes it |
| present but empty | `""` | `true` | includes it |
| absent (not sent, `HttpOnly`, filtered by the site, run without cookies) | `undefined` | `false` | lacks it |

Test with `if (!token)` to treat present-but-empty as absent.

## Limits

| Limit | Value | Where |
|---|---|---|
| number of cookies, size of a value | no limit of its own | — |
| everything the message carries (the cookies included) | 8 MiB = 8 388 608 bytes, the platform's setting | the chat connection refuses a larger message |
| copy in the script | all cookies are copied into the script at start; they count against its 30 MB | sandbox |
| lifetime | this run only; deleted when the run ends or is cancelled | engine |
| which cookies | only what the site sends; never `HttpOnly` with the reference SDK | the site |

Cookie values are **not** masked like Secrets: a token you log, put in the dictionary, the session, a chat
message or an agent prompt is stored and shown in clear.

## Mistakes that break it

| Mistake | What happens | Write instead |
|---|---|---|
| assuming the cookie is there | the API call goes out with `Bearer undefined` and fails with 401 | check `get` first and answer "please connect" |
| the site stores the token in an `HttpOnly` cookie | the script never sees it | the site must store it as a JS-readable cookie (or send it explicitly) |
| `Log.info(\`token ${Cookies.get('t')}\`)` or `dictionary.token = …` | the token is written in clear | use it only in the request; store a flag, not the value |
| `Cookies.set('t', x)` / `Cookies.t = x` | `TypeError` (no such function; the object is frozen) → error edge | keep values in the `dictionary` or `system/session` |
| `Cookies.get('GConnect')` for a cookie named `gconnect` | `undefined` | the exact name |
| expecting a cookie set during this run | not seen until the next message | ask the person to send the message again after connecting |
| `import { get } from 'system/cookies'` beside `import { get } from 'system/http'` | the script does not load (duplicate name) | rename one with `as` |

## Example

Read the person's files from a (fictional) file service with the token the site stored after Connect.

```js
// src/scripts/files/listFiles.js
import Cookies from 'system/cookies';
import Http from 'system/http';

export async function exec() {
    const token = Cookies.get('files_token');
    if (!token) {
        dictionary.files = { connected: false };      // the next LLM asks the person to click Connect
        return { ok: false };
    }

    const res = await Http.getJson('https://api.files.example.com/v1/files?limit=10',
        { headers: { authorization: `Bearer ${token}` } });
    if (res.status === 401) { dictionary.files = { connected: false, expired: true }; return { ok: false }; }
    if (!res.ok) throw new Error(`The file service answered ${res.status}`);

    dictionary.files = { connected: true, files: res.body.files.map(f => f.name) };
    return { ok: true };
}
```
