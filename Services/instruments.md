# Designing instruments

An **instrument** is one method of the object `ShopApiService.connect(…)` returns — one action the model may take
(`search`, `getCart`, `setCartItem`). Each has one tool. This file is how to shape what goes in, what comes out,
how it fails, and what the platform's limits mean for it.

## 1. One action, one instrument, one tool

- A verb that says the action; one tool per instrument (`Shop Search` → `shopSearchTool.js` → `shop.search`).
- The model chooses better among single-purpose tools, each with its own short input, than one tool with an
  `action` field — and a wrong choice is visible in the trace.
- Two tools may share an instrument's helper (in `service.js` unexported, or `utils.js`), never each other.

## 2. Input from the model

The model writes `!*context` as text; the tool gets it as `toolOptions.toolContext.options.context` (a trimmed
string; any other `!*key` also arrives as a string). `props` is always `{}` in a tool.

1. **The tool** parses it in a `try` and checks the shape. Bad → a reply that names the exact shape, then return:
   ```js
   let input;
   try { input = JSON.parse(call.options.context ?? ''); } catch { input = null; }
   if (!input || typeof input.query !== 'string' || input.query.trim() === '') {
       reply({ ok: false, retryable: true, error: 'Shop Search input is invalid. Send !*context as JSON {"query": "<a few words>", "limit": 5}.' });
       return { ok: false };
   }
   ```
2. **The instrument** checks every value again and cleans it: `cleanText(query, 200)`, `clampInt(limit, 1, 10, 5)`,
   a pattern for ids (`^[A-Za-z0-9-]{1,40}$`), `encodeURIComponent` on every path and query part.
3. The model never chooses a host, a path or a header: the base URL comes from `settings.js` or a Json Setting.

Treat the input as the person's own words — they may try to make the model send something else.

## 3. Output to the model

The tool files ONE reply with `Agent.setRootAgentPrompt` on the caller's session; that text is the next user turn,
re-read on every following round of the exchange and stored in the chat history.

- **Small**: the few fields the model needs to answer — ids it must send back later (a `sku`), names, a price, a
  status, a short snippet. Cut texts (`cleanText(x, 120)`), keep only a page of results (5–10).
- **Compact JSON** (`JSON.stringify({ ok: true, ...result })`) or one plain sentence. JSON is easier for the model to
  pick a field from; say in the system prompt what it holds.
- **Never** the raw API answer, a header, a token, an internal URL with a key, or another person's data the partner
  returned by mistake.
- The tool's `return` value never reaches the model; it travels to the person's browser — return `{ ok: true }`.

## 4. Errors — every failure becomes a reply the model can act on

`{"ok": false, "retryable": <bool>, "error": "<what happened and what to do>"}`. `retryable: true` = a corrected or
later call may work; `false` = tell the person. Make every error in `utils.js` (`serviceError`, `describeStatus`).

A 4xx / 5xx answer is **not** a throw in `system/http` — check `res.ok`:

| Status | Words for the model | retryable |
|---|---|---|
| 400 / 422 | what the API refused (its short `message`, cut to 200 chars) and the right shape | yes if the input can change |
| 401 with the app key | "the service refused the agent's key — tell the person (SHOP_API_KEY)" | no |
| 401 with the person's token | "the person is not signed in any more — ask them to sign in again" | no |
| 403 | "not allowed for this person" | no |
| 404 | "unknown <thing> — search again" | no |
| 409 | "refused: <the API's message>" (stock, a conflict) | no |
| 429 | "busy — try again in a minute" | yes, later |
| 5xx | "unavailable — try again later" | yes, later |

What `system/http` **throws** (catch it in the connector, wrap it in `serviceError(…, true)` unless noted):

| Message starts with | Meaning |
|---|---|
| `TimeoutError` | over 15 s including redirects — ask for less |
| `E_HTTP_SSRF` / `E_HTTP_ALLOWLIST` | a private / internal / not-allowed host — not retryable; a public host or the site side |
| `E_HTTP_DNS` | the host name does not resolve — check the Json Setting |
| `E_HTTP_URL` / `E_HTTP_SCHEME` / `E_HTTP_METHOD` / `E_HTTP_BADREQ` | a bug in the service — fix the code |
| `E_HTTP_REDIRECT` | more than 3 redirects, or a body re-sent to another origin — call the final URL |
| `E_SAB_OVERFLOW` | the answer is over 10 MB — page, ask for fewer fields |
| `E_SAB_BUSY` | two calls at once — `await` each |
| `E_HTTP_HEADERS` | your headers over 16 384 characters |
| `E_HTTP_DISABLED` / `E_HTTP_FAILED` | the platform — not retryable from the script |
| the transport's text (`ECONNREFUSED`, `certificate has expired`) | network / TLS |

Every one of these messages is safe to show the model (no header in them); a Secret's value in one is `••••`.
An uncaught throw gives the model only `No tool response` and the Log Record one line — never let one escape.

## 5. Limits that bite a service

| Limit | Value | What to do |
|---|---|---|
| time per HTTP call (connect, redirects, body) | 15 s | page; filter on the API's side; no timeout option exists |
| redirects | 3 | call the final URL |
| answer body | 10 MB after decompression, read as UTF-8 text | JSON only; no binary downloads (ask for a URL) |
| parsed answer in memory | 2–5× its size inside the node's 30 MB | ask for fewer fields; drop what you do not return |
| calls at once | 1 per node (`Promise.all` → `E_SAB_BUSY`) | a `for` loop with `await` |
| methods | GET, POST, PUT, PATCH, DELETE, HEAD | — |
| hosts | public only; the platform's allow-list if it has one | the site side for a private host |
| response headers | not returned (no `Location`, no rate-limit headers) | read what you need from the body |
| one tool run | 15 minutes, then the whole run ends (`E8101`) | never loop on an API |
| the reply | a non-empty string ≤ 8 MB — keep it to a few KB | trim |

Details: `../Flow/Nodes/Script/references/system/http.md`.

## 6. Paging and big answers

Ask the API for one page (`limit` = what you will show, at most 10); return `total` and, when the model may want
more, a `nextCursor` it can send back (`{"query": "…", "cursor": "<nextCursor>"}`). Never walk all pages in one
tool run: each call costs up to 15 s and the model reads every line you return on every round.

## 7. Actions that change something

An order, a payment, a message, a cart line:

- **Rights are the partner's**: call the API with the **person's own token** (`access.md` §6) so the partner
  decides what this person may change. Never trust an earlier Condition or the model's words as the check.
- **Safe to run twice**: in rare failures a node is sent again. Prefer a "set" form (`PUT /cart/items/{sku}
  {quantity: 2}` — twice leaves the same cart) over "add one". If the API only has "add", read first and write only
  when the change is not already there, or send the API's idempotency key built from values that stay the same on a
  re-send.
- **One call, last**: the whole change in ONE request, as the last step of the tool. If the person closes the tab,
  the run stops at the current node; a change split over several calls or tools can stay half done.
- **Ask first**: in the system prompt, "use it only after the person clearly asked" — and for anything costly
  (a payment, a sent mail), "repeat the details and wait for the person's yes".

## 8. No retries in a loop

The engine never retries a call, and a tool must not either: no `while (!ok)`, no sleep (there is no timer). Reply
`retryable: true` and let the model decide once (the prompt says "correct the call once"; "at most N calls per
question"). A 429 or 5xx is "try later", not "try now".

## 9. Logging

`Log.info` the outcome in counts (`Shop Search: 3 of 42 products`), `Log.warning` a failure with `err.message`.
Never the person's input, a token, a cookie or the API's answer. `../Flow/Nodes/Script/references/system/log.md`.
