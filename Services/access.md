# Access — how a service authenticates, and where each credential lives

Every kind of access is built the same way: the **tool** reads the credential (`system/secrets` or
`system/cookies`), passes it to `ShopApiService.connect(credentials, options)`, and `connector.js` adds it to every
request it sends with `system/http`. Nothing else ever holds it.

## 1. The rules for every credential

| Never | Why |
|---|---|
| in `settings.js` | deployed with the code, visible to anyone with the project and in the debugger, never masked |
| in Json Settings or Front Settings | readable by every reader of the agent, exported with it, never masked |
| in the `.flow`, `keen-tools.json`, a Script node's key / value pairs | deployed in clear |
| in a prompt (`${dictionary.x}`, `${session.x}`) or the tool's reply | sent to the model provider, stored in the chat history |
| in the tool's `return` value | travels to the person's browser in the node's reply |
| in `Log.*`, `Chat.writeOut`, the dictionary, the session | stored; a cookie or a fetched token is NOT masked there |
| in the URL (`?api_key=`, `https://user:pass@…`) | `user:pass@` is refused (`E_HTTP_URL`); a query key lands in the partner's logs — use a header unless the API allows nothing else |
| asked for in the chat | the person types secrets in the console only |

**Masking** replaces the value of every agent Secret (8 bytes or more) with `••••` in what a node lets out — also
base64 and URL-encoded forms — but only values saved as **agent Secrets**. A cookie, or a token the connector
fetched, is never masked. The request itself always carries the real value. `../Flow/Nodes/Script/references/system/secrets.md`.

**Redirects**: a hop to another origin carries none of your headers (a key never follows a redirect to another
host); a 307 / 308 to another origin with a body is refused. Call the final URL directly.

## 2. An API key in a header

The most common. Secret `SHOP_API_KEY`; the header name from the documentation.

```js
// tool
const apiKey = Secrets.get('SHOP_API_KEY');
if (apiKey === undefined) { reply({ ok: false, retryable: false, error: 'Not set up (no SHOP_API_KEY). Tell the person.' }); return { ok: false }; }
const shop = ShopApiService.connect({ apiKey }, { baseUrl });

// connector.js
const headers = { 'x-api-key': apiKey, accept: 'application/json' };
```

## 3. Basic auth

Secrets `CRM_USER` + `CRM_PASSWORD` (or one `CRM_BASIC` holding `user:password`). The sandbox has **no `btoa`, no
`Buffer`**, so `utils.js` carries a base64 helper (tested against Node's `Buffer`, UTF-8 safe):

```js
/** UTF-8 text → base64. The sandbox has no btoa or Buffer. */
export function toBase64(text) {
    const bytes = [];
    for (const ch of String(text)) {
        const c = ch.codePointAt(0);
        if (c < 0x80) bytes.push(c);
        else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 63));
        else if (c < 0x10000) bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
        else bytes.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let out = '';
    for (let i = 0; i < bytes.length; i += 3) {
        const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
        out += abc[(n >> 18) & 63] + abc[(n >> 12) & 63] + (i + 1 < bytes.length ? abc[(n >> 6) & 63] : '=') + (i + 2 < bytes.length ? abc[n & 63] : '=');
    }
    return out;
}

// connector.js
const headers = { authorization: `Basic ${toBase64(`${user}:${password}`)}`, accept: 'application/json' };
```

Masking recognises a Secret inside a base64 text, so a Basic header that leaks shows `••••` — but do not rely on it.

## 4. A bearer token the partner issued once

A long-lived personal access token or service token: one Secret (`DOCS_TOKEN`), header
`authorization: Bearer <token>`. Same as §2.

## 5. OAuth client credentials (machine to machine)

Secrets `CRM_CLIENT_ID` and `CRM_CLIENT_SECRET` (or the id as a Json Setting when the documentation calls it
public). The connector fetches an access token, then uses it:

```js
// connector.js — inside createConnection, before the first call
const fetchToken = async () => {
    const form = `grant_type=client_credentials&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}`;
    let res;
    try {
        res = await Http.post(baseUrl + TOKEN_PATH, form, { headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' } });
    } catch (err) {
        throw serviceError(`The CRM sign-in could not be reached (${err.message}).`, true);
    }
    const body = parseJson(res.body);
    if (!res.ok || !body || typeof body.access_token !== 'string') throw serviceError(`The CRM refused the agent's client credentials (${res.status}).`, false);
    return body.access_token;
};
let accessToken = null;                                    // lives in this closure = this node only
const send = async (method, path, body) => {
    if (accessToken === null) accessToken = await fetchToken();   // awaited: one HTTP call at a time
    /* … authorization: `Bearer ${accessToken}` … */
};
```

If the documentation wants `client_secret_basic`, send `authorization: Basic ${toBase64(`${id}:${secret}`)}` instead
of the two form fields.

**Where may the access token be kept within one run?** Checked against the engine:

| Place | Lifetime | Risk | Verdict |
|---|---|---|---|
| the connector's closure | this node (one tool call) | none — dies with the sandbox | **use this** |
| a module-level variable | this node too — every node runs in a fresh sandbox | none, and no gain | no gain |
| the `dictionary` (the calling agent's) | the run (one chat message) | **not masked** (not an agent Secret); readable by every later node, the debugger, and a prompt through `${dictionary.x}`; the dictionary cap is 1.5 MB | no |
| the session (`system/session`) | the run | the same, and `${session.x}` puts it in a prompt; kept even on the error edge | no |
| the reply, the chat history | forever | sent to the model provider | never |

So: **fetch the token in every tool run** and keep it only in the closure. It costs one extra call (inside the
15 s per call, one call at a time); nothing outlives the run anyway — the next chat message starts with an empty
dictionary and session. If the partner limits how often a token may be minted, put the service on the site side.
The sandbox has no `crypto`: an assertion that must be **signed** (a JWT bearer grant) cannot be made in a script —
the site side, or a key / client-secret grant.

## 6. The end user's own token — from a site cookie

A person's own account at the partner (their cart, their mail, their CRM records) is **not** an agent Secret
(Secrets are one set per agent). The partner site holds it:

1. The site signs the person in to the partner (OAuth on its server routes, with the client secret on the API key's
   Secrets card) and stores the person's access token in a **JS-readable cookie** (`shop_session`).
2. The site's chat SDK forwards cookies with each message: it reads `document.cookie`, so **`HttpOnly` cookies are
   never forwarded**; the site decides PER AGENT which ones go, with the `cookies` allow-list it
   passes when it creates the SDK for a chat with that agent (`cookies: ['shop_session']` —
   `../Entanglement/SDK/setup.md` §5); without a list every JavaScript-readable cookie goes.
3. The tool reads it — every flow and node of the run sees the same cookies, as they were when the message was sent:

```js
const customerToken = Cookies.get(ShopApiService.CUSTOMER_COOKIE);
if (!customerToken) { reply({ ok: false, retryable: false, error: 'The person is not signed in to the shop on this site. Ask them to sign in, then ask again.' }); return { ok: false }; }
const shop = ShopApiService.connect({ apiKey, customerToken }, { baseUrl });
```

- A cookie value is **not masked**: use it only in the request; never log it, store it, or echo it.
- A 401 on such a call means the person's sign-in expired → reply "ask the person to sign in again"; never ask the
  model or the person for a token.
- A script cannot set a cookie, and a refreshed token cannot be kept. **The site refreshes the token**, never the
  script: the access token in the JS-readable cookie, the refresh token in an encrypted `HttpOnly` cookie only the
  site's server reads, and a site route that renews the access token before each chat message
  (`../Entanglement/connectors.md` § "Keeping the token fresh"). Never put a refresh token in a cookie the agent
  receives.
- The partner decides with this token what the person may see and change — the tool never decides it.

## 7. The site side — API Key Secrets and Front Settings

When the service (or its Connect step) lives on the partner site:

- Its keys go on **API › Api Keys** › the key › **Secrets** (not `NEXT_PUBLIC_*`, not a reserved name). The site's
  process gets them as **environment variables** at the next **Start** / **Restart** — **Save and restart** applies
  them at once; a plain **Save** waits for the next restart. The site's server routes read
  `process.env.SHOP_CLIENT_SECRET`; never send one to the browser.
- Its switch and display values go in the agent's **Front Settings**, plain values only:
  `{ "service_available": true, "service_title": "My Service" }`. A save does **not** reach the site by itself:
  press **Rebuild and refresh data** on the API key (MCP `wake_api_key`); connected instances re-read without a
  restart. The reference site serves them to its pages from `GET /api/agent-front-settings?agentId=<slug>` (a
  signed-in person only), and the page decides from `service_available` whether to show the Connect button.
- The agent side mirrors it with **Json Settings** (`{"shop_available": true, "shop_title": "Example Shop"}`): the
  tool reads them with `system/settings` from the next Script node — no deploy, no restart — and checks the switch
  first. Scripts never see Front Settings; the site never sees Json Settings. When both sides use one service, keep
  both switches in step.
