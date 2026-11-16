---
name: keen-services
description: Keen 15.3 — How to MAKE A SERVICE: connect a Keen agent to an external API (a shop, a CRM, a document store, a search API, a booking or mail system) in the house standard, from the API's documentation to a tested tool — deciding whether the service lives on the agent (a script service with the agent's Secrets) or on the partner site (its server routes with the API key's Secrets), the four files under src/scripts/services/<service>/ (service.js assembles the connection and holds the instruments, connector.js, utils.js, settings.js), one thin tool per action, the access kinds (API key, basic, bearer, OAuth client credentials, the end user's own token from a site cookie), where every value and secret lives, the Json / Front Settings switches, the per-service skill every service should carry, the system prompt, validate, deploy and the test chat. Use this skill whenever the person wants the agent to reach, read from, search, or change something in another system — "connect our shop", "integrate the CRM", "the agent should see the customer's orders", "use this API", "here is the API documentation", "add an action to the service" — even if they never say "service".
---

# Keen services — connect an agent to an external API

> **Keen 15.3.** This skill describes Keen 15.3 in full — it is the baseline. A later release (15.4, …) gets an
> additions-only skill with just what changed; read this one first, then the additions for the platform's version.

A **service** is everything one external API needs: its connection, its instruments, its configuration, its tools and
its skill. Every service is built the same way, so you write the next one from the same recipe and the person (or
the next session) always knows where to look.

## Where a service lives: the agent or the site

| | **Agent side** — a script service | **Site side** — the partner site's own API |
|---|---|---|
| Code | `src/scripts/services/<service>/` + `src/scripts/tools/<name>Tool.js` in the agent project | server routes of the Entanglement site |
| Secrets | the **agent's Secrets** (AI › Agents › the agent › Secrets) → the script engine, `system/secrets` | the **API key's Secrets** (API › Api Keys › the key › Secrets) → the site process's environment after **Save and restart** / **Restart** |
| Plain switches | the agent's **Json Settings** → `system/settings`, from the next Script node | the agent's **Front Settings** → the site, after **Rebuild and refresh data** |
| Who acts | the model, through a tool, in the middle of a chat | the site's pages and routes (a Connect button, a page, a webhook) |

Choose the **agent side** when the model must decide to call the API while it answers (search, look up, change on
the person's request). Choose the **site side** when the site itself must use the API outside a chat — sign the
person in to the partner (OAuth Connect), show data on a page, receive the partner's webhooks — or when the API needs
something a script lacks (a signed JWT, binary files, a private network host). Many services have both: the site
connects the person and stores their token in a cookie; the agent's service uses it. This skill builds the agent
side and says what the site must provide.

## When a service is the right shape

- **A service** (four files + tools) — whenever an agent talks to an external API, even with one action today.
- **A plain tool without a service** — only for work with no outside system: a date sum, a reply built from Json
  Settings (`../Flow/Tools/ScriptTool/references/examples.md` §1, §3).
- **A Script node, not a tool** — when the call must happen on EVERY turn before the model answers (load the
  person's profile): the node may import the same `service.js`, no tool, no model decision.
- **A Flow Tool** — when a second model must judge the API's answer (`../Flow/Tools/FlowTool/flow-tool-skill.md`).

## The recipe — in order (details: `recipe.md`)

1. Read the API's documentation; list its actions, auth, limits, errors — `recipe.md` §1.
2. One instrument per action the model needs — `recipe.md` §2, `instruments.md`.
3. Decide where each value lives (code / Json Settings / agent Secret / the person's cookie) — `recipe.md` §3, `access.md`.
4. `settings.js` → `connector.js` → `utils.js` → `service.js` (`connect` + the instruments) — `recipe.md` §4–7.
5. One thin tool per instrument, `src/keen-tools.json` — `recipe.md` §8–9.
6. **The service's skill** — `service-skill-template.md`; recommended — `recipe.md` §10.
7. The calling LLM's system prompt — `recipe.md` §11.
8. Tell the person what to set in the console (Secret names, Json / Front Settings) — `recipe.md` §12.
9. `keen-validate` → `keen-deploy` → a test chat with the runner → read failures — `recipe.md` §13–15.

A complete, validated project: `examples/shopApi/` (three tools, an API key, the person's cookie, a safe write, a
Json Settings switch, its skill).

## Rules

1. **The tool imports only `service.js`.** `ShopApiService.connect(credentials, options)` assembles the connection
   (through `connector.js`) and returns the instruments; the tool never imports `connector.js`, `utils.js` or
   `settings.js` (`service.js` re-exports the constants a tool needs).
2. **Only the tool reads `system/secrets`, `system/settings` and `system/cookies`**, on every run, and passes values
   into `connect`. A secret never goes into `settings.js`, Json / Front Settings, the `.flow`, `keen-tools.json`,
   a prompt, the dictionary, the session, a log line or the tool's reply.
3. **Json and Front Settings hold plain values only** — a switch and its display values:
   `{ "service_available": true, "service_title": "My Service" }`. The tool checks the switch FIRST.
4. **One instrument per action, one tool per instrument.** The model picks better among single-purpose tools.
5. **Every failure becomes a reply** in words the model can act on (`{"ok": false, "retryable", "error"}`); never
   throw out of a tool; never retry in a loop.
6. **A reply is small**: the few fields the model needs — never a raw API answer, never a header or a token.
7. **A change is decided by the partner with the person's own token**, safe to run twice, one request, last.
8. **Give every service its skill** (recommended, not mandatory) at
   `<project>/.claude/skills/<service-in-kebab>-service/SKILL.md` (`service-skill-template.md` — the evidence for the place).
9. **Never deploy what did not validate**; never `keen-deploy` to a space the person did not name.
10. Fictional names in examples; never a real key, token or account in any file.

## Related skills

- **Service packages** — a ready outside service in three parts (site, Keen, agent), installed from a catalog folder
  such as `keen_services/<service>/`: `packages.md`. Check the catalog before you build a service from nothing.
- The site's connector mechanism (Connect, the token cookie, the refresh — a provider is configuration):
  `../Entanglement/connectors.md`.
- The project layout and each service file in detail: `../ProjectStructure/SKILL.md`,
  `../ProjectStructure/src/scripts/services/services.md`.
- Tools and the `<SYSTEM CALL>` protocol: `../Flow/Tools/SKILL.md`, `../Flow/Nodes/LLM/references/tool-calling.md`.
- The modules: `../Flow/Nodes/Script/references/system/{http,secrets,settings,cookies,log}.md`.
- Validate, deploy, test: `../MCP/SKILL.md` (`validator.md`, `uploader.md`, `testing.md`).
- The console (Secrets, Json / Front Settings, Rebuild and refresh data): `../Administration/SKILL.md`,
  `../Administration/references/secrets-and-credentials.md`, `../Administration/references/delivering-changes.md`.
