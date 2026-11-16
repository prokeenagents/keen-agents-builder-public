# Example — the ShopApi service

> `ShopApi` and `https://api.shop.example.com` are **fictional**: the routes, fields, Secret, cookie and setting
> names are made up to show the house standard. A real integration follows the same shape with its own names.

`project/` is one complete agent project that passes `keen-validate` with 0 errors and 0 warnings. It shows:

- **A service in four files** — `src/scripts/services/shopApi/`: `service.js` (`connect(credentials, options)`
  assembles the connection and returns the instruments `search`, `getCart`, `setCartItem`), `connector.js`
  (`createConnection` — the headers, the status → words), `utils.js` (pure helpers), `settings.js` (constants only).
- **Three thin tools that import only `service.js`** — `shopSearchTool.js` (the app's key from the agent's Secret
  `SHOP_API_KEY`), `shopCartTool.js` (the person's own cart, with their sign-in from the site's cookie
  `shop_session`), `shopAddToCartTool.js` (a write that is safe to run twice: a "set quantity", one request, last).
- **A Json Settings switch checked first** — `{"shop_available": true, "shop_title": "Example Shop"}`
  (+ an optional `"shop_api_url"`): plain values, never a secret.
- **Every failure as a reply** the model can act on: `{"ok": false, "retryable", "error"}`.
- **The registry and the prompt** — `src/keen-tools.json` and `src/flows/Assistant.flow` (Start → the LLM node
  *Shop Assistant*, agentId `shop-assistant` (a placeholder slug), tools on, the three tools described → End; its
  Fallback goes to the same LLM on Google `gemini-2.5-flash` (same Out, its own Fallback → End); both LLMs'
  Summary goes to a Summarizer on `claude-haiku-4-5-20251001` whose Fallback is a Summarizer on `gpt-4o-mini`, both
  Outs → the same End).
- **The service's skill** — `.claude/skills/shop-api-service/SKILL.md`, where Claude Code loads it and keen-deploy
  never uploads it.
- The project skeleton: `package.json`, `.gitignore`, `.prettierrc`, `.prettierignore`, `.vscode/settings.json`. There
  is no `.vscode/keen.json` — it holds the person's deploy token and is made from their values, never invented.

To run it on a platform: create the agent `shop-assistant` (Start Flow `Assistant`, Start Node `Start`), set its
Secret and Json Settings in the console, deploy, and test with the runner — see `../../recipe.md` §12–14.
