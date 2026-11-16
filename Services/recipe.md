# The recipe — from the API's documentation to a tested tool

Follow the steps in order. Each says what to write, shows a short snippet (the full set is in
`examples/shopApi/project/`) and names the mistake to avoid. The service is `<service>` (camelCase: `shopApi`), its
tools `<service><Action>Tool.js`.

## 0. Agent side or site side

Read `SKILL.md` → "Where a service lives". This recipe builds the **agent side**. If the site must act too (a
Connect button, a page, the partner's webhooks), list what the site must do and give it to the person — its keys go
on the **API key's Secrets** card, its switches into the agent's **Front Settings**.

## 1. Read the API's documentation

Ask the person for the documentation (a link, a file, an OpenAPI text) and a TEST account. Write down, for each
endpoint you may use: method + path, the input, the answer's fields, the auth, the errors, paging, rate limits.

```
GET  /v1/products?q=&limit=     app key            → { items: [{sku,name,price,inStock}], total }
GET  /v1/cart                   app key + person   → { lines: [...], total }
PUT  /v1/cart/items/{sku}       app key + person   { quantity } → the cart        (a "set": safe twice)
```

Mistake: guessing a route or a field from the name of the product. If the documentation does not say it, ask.

## 2. List the actions — one instrument per action

Keep only the actions the person's use case needs. Each becomes ONE instrument and ONE tool. Why: the model picks
far better among single-purpose tools with their own short input than one tool with an `action` switch. Name them
as verbs: `search`, `getCart`, `setCartItem`. Design each with `instruments.md`.

Mistake: one "Shop" tool with `{"action": "search" | "cart" | "add"}` — the model mixes the inputs.

## 3. Decide where each value lives

| Value | Where | Read with |
|---|---|---|
| base URL, paths, page sizes, text limits | `settings.js` (code, deployed, visible) | `import` in the service files |
| the switch, the display title, a per-agent address | the agent's **Json Settings** — plain values | `Settings.getMany(...)` in the tool |
| the app's key, client id + secret, a password | the agent's **Secrets**, typed by the person in the console | `Secrets.get('NAME')` in the tool |
| the person's own token (their account at the partner) | a JS-readable **cookie** the site sets after the person signs in | `Cookies.get('name')` in the tool |

Name secrets `^[A-Z][A-Z0-9_]{0,127}$` (`SHOP_API_KEY`); Json Settings keys in one style (`shop_available`,
`shop_title`, `shop_api_url`). Every kind of access: `access.md`.

Mistake: a key in `settings.js` or Json Settings — deployed or exported in clear, never masked.

## 4. `settings.js` — constants only

```js
export const BASE_URL = 'https://api.shop.example.com';
export const PRODUCTS_PATH = '/v1/products';
export const CUSTOMER_COOKIE = 'shop_session';
export const DEFAULT_LIMIT = 5;
export const MAX_LIMIT = 10;
```

Only `export const UPPER_SNAKE = <literal>`; a comment at the top names the Json Settings that override it and the
Secret names. Mistake: `TIMEOUT_MS` — nothing uses it; every call has the platform's 15 s.

## 5. `connector.js` — the authenticated client

`createConnection(credentials, options)` checks the credentials, holds them in a closure, adds them to every request,
turns a status into an error in words. Only `service.js` calls it.

```js
export function createConnection(credentials, options = {}) {
    const apiKey = credentials?.apiKey;
    if (typeof apiKey !== 'string' || apiKey.trim() === '') throw serviceError('The shop is not set up (no API key).', false);
    const baseUrl = normaliseBaseUrl(options.baseUrl ?? BASE_URL);
    const send = async (method, path, body) => { /* Http.request, catch → serviceError, !res.ok → describeStatus */ };
    return Object.freeze({ get: path => send('GET', path) });
}
```

Mistake: `return { apiKey, … }` — the key travels with the object and can reach a reply.

## 6. `utils.js` — pure helpers

`serviceError(message, retryable)`, `describeStatus(status)`, `cleanText`, `clampInt`, `normaliseBaseUrl`, `parseJson`,
a mapper shared by two instruments. No `system/*` import, no state. Mistake: `Buffer`, `btoa`, `crypto` — none exist
in the sandbox (a base64 helper: `access.md` §2).

## 7. `service.js` — `connect` and the instruments

```js
import { createConnection } from './connector.js';
export function connect(credentials, options = {}) {
    const connection = createConnection(credentials, options);
    return Object.freeze({
        search: args => searchProducts(connection, args),
        getCart: () => getCart(connection),
        setCartItem: args => setCartItem(connection, args)
    });
}
async function searchProducts(connection, { query, limit } = {}) { /* check, call, map to a few fields */ }
```

Each instrument checks its own arguments (the model's input is untrusted), makes its calls through `connection`,
returns a small plain object and throws `serviceError` in words. Constants a tool needs (a cookie name, a default
title) are re-exported here, so the tool imports nothing else. Mistake: an instrument that returns `res.body` as is.

## 8. The tools — one per instrument

`src/scripts/tools/shopSearchTool.js`, `shopCartTool.js`, `shopAddToCartTool.js` (camelCase, letters and digits).
Always the same five steps:

```js
import * as ShopApiService from '../services/shopApi/service.js';
export const exec = async () => {
    const call = toolOptions.toolContext;
    const reply = data => Agent.setRootAgentPrompt(call.agentId, { prompt: JSON.stringify(data),
        sessionID: toolOptions.agentNode.flowContext.sessionId, requestID: Tools.generateUUID() });
    // 1 the switch   2 the input   3 the Secret (+ cookie)   4 connect + one instrument   5 one reply
    const [available, title, baseUrl] = Settings.getMany('shop_available', 'shop_title', 'shop_api_url');
    if (available !== true) { reply({ ok: false, retryable: false, error: 'The shop is not available on this agent.' }); return { ok: false }; }
    …
    const shop = ShopApiService.connect({ apiKey: Secrets.get('SHOP_API_KEY') }, { baseUrl });
    reply({ ok: true, ...(await shop.search({ query: input.query, limit: input.limit })) });
};
```

Mistakes: `return result` instead of a reply (`No tool response`); `sessionID: flowContext.sessionId` (the tool's own
session); a throw that escapes. Full rules: `../ProjectStructure/src/scripts/tools/name-tool.md`.

## 9. `src/keen-tools.json`

```json
{ "tools": [ { "name": "Shop Search", "type": "script", "entry": "tools/shopSearchTool.js" } ] }
```

Names in Title Case words, the same spelling in the prompt. Mistake: `"entry": "scripts/tools/…"` — must start
with `tools/`.

## 10. The service's skill — recommended

Write `<project>/.claude/skills/<service-in-kebab>-service/SKILL.md` from `service-skill-template.md`: when and why
each instrument, its input and reply, the limits, the errors, the connection's steps, the Secret / setting / cookie
names, what the person sets. Update it in the same change whenever an instrument, a name or a limit changes. A
service without its skill is not finished. Mistake: placing it under `src/scripts/` — keen-deploy uploads it to the
platform (the evidence: `service-skill-template.md` §1).

## 11. The calling LLM's system prompt

The model never sees `keen-tools.json`; the system prompt is the only place it learns a tool exists. Write the call
format once (copy from `../Flow/Tools/ScriptTool/references/examples.md`), then per tool:

```md
1. Shop Search
Description: searches the shop's catalogue and returns up to 10 products with sku, name, price and inStock.
Use it whenever the person looks for a product, asks a price or whether something is in stock.
Usage: !*context is JSON {"query": "<a few words>", "limit": 5} (limit 1-10).
```

Name, WHEN to use it (and when not — "only after the person clearly asked"), the exact input with an example, what
the reply holds, and the stop rules: how to read `"retryable"`, the most calls per question, what to say when the
service is off or the person is not signed in. The LLM node's `agentId` must be the agent's slug and **Use tools**
on. Mistake: describing a tool in `keen-tools.json` (`description` is ignored).

## 12. What the person does in the console

You never type or ask for a secret value. Tell the person exactly:

1. **AI › Agents › Agent List** › the space › **Open** the agent › **Lock** › **Secrets** › **Add secret** →
   Name `SHOP_API_KEY`, the value → **Save**. Then confirm the NAME with MCP `list_agent_secrets`.
2. **Json settings** → `{"shop_available": true, "shop_title": "Example Shop"}` → **Update settings** (or MCP
   `update_agent_settings` under the lock). Applies from the next Script node, no deploy.
3. Site side, if any: the API key's **Secrets** card + **Save and restart**; Front Settings + **Rebuild and refresh
   data** on the API key (`access.md` §7).
4. For the person's own token: the site must set a JS-readable cookie and forward it (`access.md` §6).

## 13. `keen-validate`

`keen-validate <project-dir>` until `0 error(s)` (and look at every warning). It checks the registry, lints every
file under `src/scripts/` (imports, forbidden globals) and each tool's reply stamp. It does NOT check the house
standard (four files, the skill, secrets only in tools) — check those yourself. `../MCP/validator.md`.

## 14. `keen-deploy`, then a test chat

`keen-deploy` (the space the person named) → `deployed`. Then the runner from the project root:

```bash
npx --prefix <MCP>/agent-runner tsx <MCP>/agent-runner/run.ts --prompt "Do you have road bikes?" --json
```

Test each tool: one question that needs it, one that should NOT call it, one with bad input, one with the switch
off, one without the Secret, and — for the cart — with and without the cookie (`KEEN_COOKIES=shop_session=<a TEST
account's value>` in the git-ignored `.env`, from the person). `../MCP/testing.md`.

## 15. Reading failures

| You see | Cause | Fix |
|---|---|---|
| the final answer talks about "no tool response" | the tool threw, returned without a reply, or stamped the wrong session | the Log Record line `Script "tools/…" failed: …`; catch everything; `toolOptions.agentNode.flowContext.sessionId` |
| `The requested tool does not exist.` in the trace | the prompt's name ≠ the registry's | one spelling |
| a reply `"retryable": true` repeated | the model cannot fix its input | make the error say the exact shape |
| `… not set up (no SHOP_API_KEY)` | the Secret is not saved, or misspelled | the console step; `list_agent_secrets` |
| `… could not be reached (E_HTTP_SSRF …)` | a private / internal address | a public `https://` host, or the site side |
| `The agent's secrets could not be read.` in the Log Record | the store did not answer, or the agent was renamed | retry; after a rename a new chat |

Read the trace first, then the agent's Log Record (`../MCP/testing.md` §6), then fix the cause, validate, deploy,
test again.
