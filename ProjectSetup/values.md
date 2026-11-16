# Every value a project needs — where it comes from, where it goes

Four git-ignored files hold everything; nothing secret goes anywhere else (not `src/`, not a Settings value, not
the chat, not a commit):

| File | Read by | Never |
|---|---|---|
| **`<workspace>/keen-project.json`** (`keen-project.md`) — the workspace root | you, first, every session; it is the one source of `server`, `agent_project_dir`, `application`, `application_dir`, `mcp_id`, `mcp_secret` | committed; printed; under `src/`, a site's `public/` or in a zip |
| **`<project>/.env`** | `run.ts`, `keen-deploy`, `keen-validate` (each from the **current folder** — run them from the project root, `agent_project_dir`); you, for the kept keys | committed; printed |
| **`<project>/.vscode/keen.json`** | the VS Code extension (deploy, debuggers), `agent-runner/debug.ts` | committed; read by `keen-deploy` |
| **the site's `.env.local`** | the partner site (its pre-process and its server code) | committed; uploaded with the project |

Write every value unquoted (`KEY=value`): the Go tools keep quotes literally. "Once" = shown in one reply or one
console reveal, never again; a lost one is re-minted.

## `keen-project.json`

| Field | What it is | Goes to | Who may see it |
|---|---|---|---|
| `server` | the Keen's base address, `https://keen.example.com` | the project's `.env` `KEEN_HOST` (bare host), `.vscode/keen.json` `server`, the site's `.env.local` `KEEN_HOST` (full URL) | anyone |
| `application` | the site's public `https://` origin | the project's `.env` `KEEN_ORIGIN`, the site's `.env.local` `KEEN_ORIGIN`, the webhook record's `origin` | anyone |
| `agent_project_dir` | the agent project's folder, relative to the file (`.` = the workspace root) | where the project lives; the tools run there; the folder opened in VS Code for Shira | — |
| `application_dir` | the site's folder, relative to the file | where you work on the site | — |
| `mcp_id` | the builder's MCP account ID (**Organization › MCP Accounts** › the reveal after Create) — **the person types it in** | `mcp_login { id }` only | anyone in the org |
| `mcp_secret` | the MCP account's secret (43 characters; the same reveal / **Rotate secret**) — **the person types it in**, never via the chat | `mcp_login { secret }` only | the person; the builder reads it from the file only |

When it and another file disagree, `keen-project.json` wins: correct the other file and tell the person.

## The project's `.env`

| Name | What it is | Comes from | Once? | Who may see it |
|---|---|---|---|---|
| `KEEN_HOST` | the bare Keen host, no scheme, no path (`keen.example.com`) | `server` in `keen-project.json`, its host | no | anyone |
| `KEEN_SPACE_ID` | the space id (also the deployed project's id) | `create_space` reply (`get_space` / `list_spaces` later) | no | anyone |
| `KEEN_DEPLOY_TOKEN` | the space's deployment token | `create_space` reply; `get_space_deployment_token` (sp2); re-minted by `reset_space_deployment_token` | no (re-readable with sp2) | the person, the builder — it uploads code that can read the agent's Secrets |
| `KEEN_AGENT` | the agent's **slug** (`agentId`, not the record id) | the person / the computed default, sent in `create_agent` | no | anyone |
| `KEEN_PROJECT_DIR` | the project root (the folder with `src/`) | you: `.` when the tools run from the root (an absolute path is safest) | no | — |
| `KEEN_ORIGIN` | the site's public `https://` origin — equal to the webhook record's `origin` | `application` in `keen-project.json` (`first-setup.md` §6) | no | anyone |
| `KEEN_USER_ID` | the MCP consumer's id (must equal the token's sealed subject) | `create_mcp_consumer` reply `consumer.id` | no | anyone |
| `KEEN_CONSUMER_SECRET` | the MCP consumer's secret | `create_mcp_consumer` / `rotate_mcp_consumer_secret` reply `secret` | **yes** | the builder only |
| `KEEN_TOKEN` | the consumer's access token — the runner's only auth; lives **10 minutes** | `get_mcp_consumer_token` / `refresh_mcp_consumer_token` → `access_token` | renewable | the builder only |
| `KEEN_REFRESH_TOKEN` | the consumer's refresh token (days; spent by each refresh) | the same replies → `refresh_token` | renewable | the builder only |
| `KEEN_EMAIL` | any non-empty text (an MCP consumer has no e-mail; only its presence is checked) | you, e.g. `agent@runner.example` | no | anyone |
| `KEEN_CERTIFICATE_SECRET` | the certificate's shared secret key (16–32 characters) | YOU generate it before `create_certificate`; the reply echoes it | **yes** | the builder only. No tool and no site reads it from here — a site under site control receives it from Keen, an older site through the woken webhook. Kept only as a record; a lost one is replaced (`update_certificate`) |
| `KEEN_WEBHOOK_SECRET` | the last segment of the webhook URL — the same value as the site's | YOU generate it: 64 random hex characters (at least 32) | — | the builder and the site only |
| `KEEN_CHAT_ID` | optional: one chat id to continue one conversation across runs | you | no | — |
| `KEEN_COOKIES` | optional: `a=1;b=2` cookies the scripts read with `system/cookies` (a TEST account's values) | the person | — | as the cookie's own secrecy |
| `KEEN_PROMPT` | optional fallback for `--prompt` | — | no | — |

The tools read only `KEEN_HOST`, `KEEN_TOKEN`, `KEEN_USER_ID`, `KEEN_EMAIL`, `KEEN_ORIGIN`, `KEEN_SPACE_ID`,
`KEEN_AGENT`, `KEEN_CHAT_ID`, `KEEN_COOKIES`, `KEEN_PROMPT` (`run.ts`) and `KEEN_HOST`, `KEEN_SPACE_ID`,
`KEEN_DEPLOY_TOKEN`, `KEEN_PROJECT_DIR` (`keen-deploy`; `keen-validate` only `KEEN_PROJECT_DIR`). The other keys
are kept for you and ignored by the tools. The MCP account's ID and secret are not here — only in
`keen-project.json`.

## `.vscode/keen.json`

| Field | What it is | Comes from | Who may see it |
|---|---|---|---|
| `server` | `https://<host>` (scheme, no path) | `server` in `keen-project.json` | anyone |
| `space` | = `KEEN_SPACE_ID` | `create_space` | anyone |
| `token` | = `KEEN_DEPLOY_TOKEN` | `create_space` / `get_space_deployment_token` | as the token |
| `user` | the person's console e-mail (never a consumer or an MCP account) | the person | the person |
| `password` | that account's password (for the debuggers) | **the person types it into the file** | the person only |

## The site's `.env.local` (the reference site's names)

| Name | What it is | Comes from | Once? | Note |
|---|---|---|---|---|
| `KEEN_HOST` | `https://<host>` — a **full URL** here (the site refuses a bare host) | `server` in `keen-project.json` | no | not the runner's bare form |
| `KEEN_WS` | `wss://<host>/ws-keen` | derived from the host | no | optional under site control (derived); needed with `npm run dev`. Never through a tunnel |
| `KEEN_CLIENT_ID` / `KEEN_CLIENT_SECRET` | the client's id + secret | `create_client` / `rotate_client` | secret **yes** | the site mints its application token with them |
| `KEEN_API_KEY_ID` / `KEEN_API_KEY_SECRET` | the API key's id + Key Secret | `create_api_key` / `rotate_api_key` (console: the reveal after **Create** / **Rotate key**) | secret **yes** | also signs the site's link to Keen |
| `KEEN_ORIGIN` | = the project's `KEEN_ORIGIN` | `application` in `keen-project.json` | no | under site control Keen sends it at each start (from the webhook record); keep it here too |
| `KEEN_WEBHOOK_SECRET` | = the project's value | you | — | under site control Keen sends it too; keep it here |

The site's own other lines (its third-party keys) belong on the **API key's Secrets** card instead, typed by the
person; Keen's value replaces a same-named line here.

## Values on records only (no file)

| Value | What it is | Comes from / goes to |
|---|---|---|
| agent record **id** | the agent's cuid (settings, locks, secrets) | `create_agent` reply; `list_agents { spaceId }` finds it again |
| Start Flow / Start Node | the entry the relay runs (PascalCase, 3–60) | `create_agent`; must equal `src/flows/<Start Flow>.flow` and its Start node's label |
| certificate / client / contract / webhook / API key **ids** | the chain's records | their create replies; `get_api_key` shows the four bindings |
| the webhook **URL** | `<origin>/api/keen-webhook/<KEEN_WEBHOOK_SECRET>` | `create_webhook`; a secret — never echo it |
| the MCP consumer's **name** | `<slug>-consumer`, unique, never changes | `create_mcp_consumer` |
| the Log Record stream token | reads the agent's live log | `reveal_log_token` → a shell variable only, never a file |
| the owner's 6-digit code | confirms one MCP session | the person, in the chat → `mcp_login_verify`; never stored |

## What the person types in the console (names in the code, values never seen)

| Value | Where it is typed | Who reads it | Applies |
|---|---|---|---|
| **The agent's Secrets** (`SHOP_API_KEY` …; `^[A-Z][A-Z0-9_]{0,127}$`, 8–8192 bytes, ≤ 50) | **AI › Agents** › the agent › **Secrets** card | the script engine: a tool's `Secrets.get('NAME')` → its `service.js` | from the next Script node; check names with `list_agent_secrets` |
| **The API key's Secrets** (the site's third-party keys; no `NEXT_PUBLIC_`, no reserved names) | **API › Api Keys** › the key › **Secrets** card | the site's process environment → its own server routes | **Save and restart**, or **Save** then **Restart** / **Start**; names: `list_api_key_secrets` |
| **Json Settings** — plain switches / labels, snake_case (`{ "shop_available": true, "shop_title": "Example Shop" }`) | **AI › Agents** › the agent › **Json settings** (or MCP `update_agent_settings`) | the scripts, `system/settings` | from the next Script node |
| **Front Settings** — plain switches for the site | **Front settings** (or MCP `update_agent_front_settings`) | the partner site | after **Rebuild and refresh data** (`wake_api_key`) or a site restart |

## When a value leaks

| Leaked | Replace with | Then |
|---|---|---|
| `mcp_secret` (the MCP account's secret) | the person: **Rotate secret** on the MCP account | they type the new one into `keen-project.json`; `mcp_login` again |
| `KEEN_DEPLOY_TOKEN` | `reset_space_deployment_token` (confirm) | both files |
| `KEEN_CONSUMER_SECRET` / a token | `rotate_mcp_consumer_secret` (confirm) | `.env`; a new token |
| `KEEN_CLIENT_SECRET` | `rotate_client` (confirm) | `.env.local`; restart the site |
| `KEEN_API_KEY_SECRET` | `rotate_api_key` (confirm: every chat of the site ends) | `.env.local`; restart; the person presses **Start**; a new `KEEN_TOKEN` |
| `KEEN_WEBHOOK_SECRET` | a new value; `update_webhook { webhook }` under its lock | `.env.local` + `.env` |
| `KEEN_CERTIFICATE_SECRET` | a new value; `update_certificate { secretKey }` under its lock | `wake_api_key`; every consumer token stops verifying |

Detail of every credential: `../Administration/references/secrets-and-credentials.md`.
