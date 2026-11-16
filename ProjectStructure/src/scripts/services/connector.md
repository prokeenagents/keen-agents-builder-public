# `src/scripts/services/<service>/connector.js`

## Description

The **connection** to one external service. `createConnection` takes the credentials the tool read (an API key from the
agent's Secrets, or a person's OAuth token) and returns a connection object: a small client that adds the
authentication to every request, checks the status, and turns a failure into an error in plain words. The
instruments in `service.js` make every call through it and never see the credential.

The standard wants it so that authentication lives in one file per service: changing a header, a token refresh
or the error wording touches nothing else, and the builder can review in one place where a credential goes.

## Location and name

- `src/scripts/services/<service>/connector.js` — required (house standard), exactly this name.
- Imported by `service.js` only — never by the tool: `import { createConnection } from './connector.js';`. The name
  is not `connect`, so it never clashes with `service.js`'s own `connect`. The tool reaches the connection through
  `<Name>Service.connect(…)`.
- The secret names the connector needs are written in the service's skill and read by the tool
  (`Secrets.get('DOCSTORE_KEY')`), never here.

## Structure

| Export | Required | What it is for |
|---|---|---|
| `createConnection(credentials, options)` | yes | checks the credentials, returns the connection; throws a clear error when they are missing |
| the connection's `get(path)` / `post(path, body)` (or what the service needs) | yes | one request with the authentication added; returns the parsed body or throws |
| `refresh(...)` | OAuth only | trades a refresh token for a fresh access token inside this node |

`credentials` holds only values (`{ apiKey }` or `{ accessToken, refreshToken }`); `options` holds overrides
from the agent's Json Settings (`{ baseUrl }`). The credential stays in the connection's closure — never a field
of the returned object, never in an error message, never logged.

Must NOT be in it: an import of `system/secrets` (the tool reads secrets), a key or token written in the code, a
write of the credential to `dictionary`, `system/session`, `system/log`, `system/chat` or `system/agent`.

## Rules and validation

What the platform enforces today: an ordinary helper module (linted as in [`service.md`](service.md)). It may
import `system/http`; the requests go out with the real values (masking never touches a request). In a node whose
import graph imports `system/secrets`, every secret value of 8 bytes or more is shown as `••••` in what the node
lets out — logs, chat, dictionary, session, the reply to the model, error texts. A cookie value is **not**
masked. A redirect to another origin carries none of your headers (the key stays with the host you called), and a
307 / 308 that would re-send a body to another origin is refused (`E_HTTP_REDIRECT`).

House standard (not checked by any tool yet): `createConnection` is called only by `service.js`'s `connect`; only
the tool imports `system/secrets` / `system/cookies`; the credential is passed in, held in a closure, and never
written anywhere. Every kind of access (key, basic, bearer, OAuth client credentials, the person's token):
[`Services/access.md`](../../../../Services/access.md).

### OAuth: where a person's token lives — an open platform question

A person's OAuth token (their mail account, their CRM login) is **not** an agent Secret: Secrets are one set
per agent, typed by an admin. What the engine shows today (verified):

- The model's prompt is built from the LLM node's authored prompts (a `${dictionary.x}` or `${session.key}` in
  them puts that value in the prompt), this agent's chat history and its rolling summary, and the newest user
  message — for a tool, the tool's reply. The reply is also stored in the chat history.
- The `dictionary`, the session and the `system/agent` store live for one run; the next chat message starts
  empty. A script cannot set a cookie. So the only place a script can keep a value for the next message is the
  conversation — the prompt.

A per-person store that survives between messages and never enters a prompt is the one platform piece still
missing. Until it exists, the safe practice is:

1. The person's site holds the token and sends it with each message as a JS-readable cookie; the tool reads it
   with `system/cookies` and passes it to `<Name>Service.connect` ([`cookies.md`](../../../../Flow/Nodes/Script/references/system/cookies.md)).
2. The app's client secret is an agent Secret; the client id is an agent Secret too, or a Json Setting when the
   provider calls it public.
3. `refresh` may get a new access token for this node only; it cannot be kept. If the provider rotates refresh
   tokens, refresh on the site instead — a refresh here would spend the cookie's token.
4. A refused or expired grant → the tool replies "the person must connect again"; it never asks the model for a
   token, and never puts a token in a reply, a prompt placeholder, the dictionary, the session or a log.

## Limits

Each request: 15 s including redirects, at most 3 redirects, 10 MB body, one call at a time, public hosts only
(`E_HTTP_SSRF` for a private address). There is no `crypto` in the sandbox, so a connector cannot sign a JWT (for
example a service-account JWT assertion). Details: [`http.md`](../../../../Flow/Nodes/Script/references/system/http.md),
[`secrets.md`](../../../../Flow/Nodes/Script/references/system/secrets.md).

## Mistakes that break it

| Mistake | What happens | Write instead |
|---|---|---|
| `import Secrets from 'system/secrets'` in the connector | works, but the key's reader is no longer only the tool | the tool reads it and calls `<Name>Service.connect({ apiKey })` |
| `return { apiKey, baseUrl }` | the key travels with the connection and can end up in a reply | keep it in the closure |
| `dictionary.token = accessToken` | stored in clear (a cookie value is not masked), gone at the next message anyway | use it in this node only |
| relying on a redirect to another host to keep the API key | the next host gets none of your headers and answers 401 / 403 | call the final URL directly; keep the base URL in `settings.js` |
| `createConnection` with `undefined` | a vague 401 later | throw `serviceError('… no API key.', false)` in `createConnection` |
| signing a JWT in the connector | no `crypto` in the sandbox | a key or OAuth flow; let the site mint the token |

## Example

```js
// src/scripts/services/docStore/connector.js
// The authenticated connection to the fictional DocStore. Every call goes through here; the key stays in the closure.
import Http from 'system/http';
import { BASE_URL } from './settings.js';
import { describeStatus, normaliseBaseUrl, serviceError } from './utils.js';

/**
 * Build the authenticated DocStore client. Only service.js calls it (inside its connect); the tool never imports this file.
 * credentials.apiKey — the agent's Secret DOCSTORE_KEY.
 * options.baseUrl    — the Json Setting "doc_store_api_url"; the default is BASE_URL.
 */
export function createConnection(credentials, options = {}) {
    const apiKey = credentials?.apiKey;
    if (typeof apiKey !== 'string' || apiKey.trim() === '') throw serviceError('DocStore is not set up on this agent (no API key).', false);

    const baseUrl = normaliseBaseUrl(options.baseUrl ?? BASE_URL);
    if (baseUrl === null) throw serviceError('The DocStore address on this agent is not a valid https:// URL (Json Setting doc_store_api_url).', false);

    const headers = { 'x-api-key': apiKey, accept: 'application/json' };

    const send = async (method, path, body) => {
        let res;
        try {
            res = method === 'GET' ? await Http.getJson(baseUrl + path, { headers }) : await Http.postJson(baseUrl + path, body, { headers });
        } catch (err) {
            // timeout, DNS, refused address, network, too many redirects — the message never holds a header
            throw serviceError(`DocStore could not be reached (${err.message}).`, true);
        }
        if (!res.ok) throw serviceError(describeStatus(res.status), res.status === 429 || res.status >= 500);
        if (res.body === null || typeof res.body !== 'object') throw serviceError('DocStore sent an answer that is not JSON.', true);
        return res.body;
    };

    return Object.freeze({
        get: path => send('GET', path),
        post: (path, body) => send('POST', path, body)
    });
}
```
