---
name: shop-api-service
description: The ShopApi service of this agent project (the fictional shop at api.shop.example.com) — its three tools Shop Search, Shop Cart and Shop Add To Cart, when the model should use each, their exact inputs and replies, the limits and errors, how service.js connects (the agent's Secret SHOP_API_KEY, the person's sign-in cookie shop_session), the Json Settings switch shop_available, and what the person must set in the console. Use it whenever you change, extend, debug or test anything under src/scripts/services/shopApi/ or the three shop tools, add a shop action, or when the person mentions the shop, the catalogue, the cart, SHOP_API_KEY, shop_available or shop_session.
---

# ShopApi service

> A fictional service: `api.shop.example.com`, its routes and names are made up to show the house standard.

Where it lives: the **agent side** — a script service, run by the script engine, with an **agent** Secret. The
agent's assistant finds products, shows the person's cart and sets quantities in it.

Files: `src/scripts/services/shopApi/{service,connector,utils,settings}.js`; the tools
`src/scripts/tools/shop{Search,Cart,AddToCart}Tool.js`; their entries in `src/keen-tools.json`; their descriptions
in the system prompt of the LLM node **Shop Assistant** (`src/flows/Assistant.flow`, agentId `shop-assistant`).

## Instruments

The tool imports only `service.js`: `ShopApiService.connect(credentials, { baseUrl })` returns the instruments.

| Tool (`keen-tools.json` name) | Method | When the model uses it | Input (`!*context`) | Reply (JSON) |
|---|---|---|---|---|
| Shop Search | `shop.search({ query, limit })` | the person looks for a product, a price or stock | `{"query": "<a few words>", "limit": 5}` — limit 1–10, default 5 | `{"ok": true, "shop", "total", "products": [{ "sku", "name", "price": { "amount", "currency" }, "inStock" }]}` |
| Shop Cart | `shop.getCart()` | the person asks about their cart; before changing a product that may be in it | `{}` (ignored) | `{"ok": true, "shop", "lines": [{ "sku", "name", "quantity", "price" }], "total"}` |
| Shop Add To Cart | `shop.setCartItem({ sku, quantity })` | only after the person clearly asked to add / change that product | `{"sku": "<sku>", "quantity": <1-20>}` — the TOTAL wanted; a "set", so safe to repeat | the cart, as Shop Cart |

Every failure replies `{"ok": false, "retryable": <bool>, "error": "<words the model can act on>"}`.

## Connection — the steps of each tool

1. Json Settings first: `shop_available` must be `true`, else the reply "… is not available on this agent".
   `shop_title` names the shop in replies (default `DEFAULT_TITLE`); `shop_api_url` overrides `BASE_URL`.
2. The Secret `SHOP_API_KEY` (every tool); for the cart tools also the cookie `shop_session`
   (`ShopApiService.CUSTOMER_COOKIE`) with `system/cookies`.
3. `ShopApiService.connect({ apiKey, customerToken }, { baseUrl })` → `connector.js`'s `createConnection` holds both
   values in its closure. Every call sends `x-api-key: <SHOP_API_KEY>`; a cart call also
   `authorization: Bearer <shop_session>`. The shop decides from the person's sign-in whose cart it is.
4. A 4xx / 5xx becomes `serviceError(describeStatus(…), retryable)`; a throw of `system/http` (timeout, DNS, refused
   address) becomes "The shop could not be reached (…)", retryable.

## Configuration — what the person sets

| What | Where | Value |
|---|---|---|
| `SHOP_API_KEY` | AI › Agents › **shop-assistant** › Lock › **Secrets** › Add secret › Save | the shop's app key — typed by the person, never in the chat |
| Json Settings | AI › Agents › **shop-assistant** › **Json settings** › Update settings | `{"shop_available": true, "shop_title": "Example Shop"}` (+ `"shop_api_url"` only for another address) — plain values, never a key |
| `shop_session` cookie | the partner site, after the person signs in to the shop | JS-readable (not `HttpOnly`); the site's chat SDK forwards it (`cookies: ['shop_session']`) |

A Json Settings change applies from the next Script node — no deploy. Set `shop_available` to `false` to switch the
shop off at once.

## Limits

- Search: query ≤ 200 characters, at most 10 products, names cut to 120 characters.
- Quantity 1–20 per product; SKUs `^[A-Za-z0-9-]{1,40}$`.
- `system/http`: 15 s per call with redirects, ≤ 3 redirects, a body ≤ 10 MB, one call at a time, public hosts only.

## Errors the model may read

| Error text (start) | Cause | Retryable |
|---|---|---|
| `… is not available on this agent` | `shop_available` is not `true` | no — tell the person |
| `… input is invalid. Send !*context as JSON …` | the model's input | yes |
| `… is not set up on this agent (no SHOP_API_KEY)` | the Secret is missing | no — tell the person |
| `The person is not signed in to …` | no cookie, or the shop answered 401 for it | no — ask the person to sign in |
| `The shop refused the agent's API key (401/403)` | a wrong or revoked `SHOP_API_KEY` | no |
| `The shop does not know this product (404)` | an unknown SKU | no — search again |
| `The shop refused the change (409/422). The shop said: …` | out of stock, a cart limit | no |
| `The shop is busy (429)` / `unavailable (5xx)` / `could not be reached (…)` | the shop or the network | yes, later — never in a loop |

## Testing

`keen-validate .` → `keen-deploy` → the runner. For the cart tools the person puts a TEST shop account's sign-in in
the project's git-ignored `.env` as `KEEN_COOKIES=shop_session=<value>` (never in the chat), then
`run.ts --prompt "What is in my cart?" --json`. Without the cookie the cart tools must answer "not signed in"; with
`shop_available` false every tool must answer "not available".
