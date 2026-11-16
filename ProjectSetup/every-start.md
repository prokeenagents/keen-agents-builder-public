# Every next start — opening an existing project again

The person comes back to a project set up before ("continue", "it worked yesterday"). Work through these in order
before you change anything; stop at the first problem and fix it. The values and their files: `values.md`.

## 1. Check the files — the builder on files

First find and read `keen-project.json` (the current folder, then its parents; not found → ask the person where it
is — `keen-project.md` §1). Then, from the project root (ask for its path if you do not know it):

| Check | Good | If not |
|---|---|---|
| `keen-project.json` | found; `server`, `agent_project_dir`, `mcp_id`, `mcp_secret` (and `application`, `application_dir` when there is a site) non-empty and not `[REPLACE…` placeholders; listed in the workspace's `.gitignore` and not tracked (`git ls-files keen-project.json` prints nothing) | a missing field → the person fills it in the file; a tracked file → stop: the person untracks it and rotates the MCP secret (`keen-project.md` §4) |
| the MCP server | `claude mcp list` shows a server at `<server>/mcp` (`server` from `keen-project.json`) | missing or another URL → add / re-add it (`keen-project.md` §1), and the person restarts Claude Code once before anything else |
| `.env` exists | the core keys are present and non-empty: `KEEN_HOST` (bare), `KEEN_SPACE_ID`, `KEEN_AGENT`, `KEEN_DEPLOY_TOKEN`, `KEEN_ORIGIN`, `KEEN_USER_ID`, `KEEN_EMAIL`, `KEEN_PROJECT_DIR`; beside them `KEEN_CONSUMER_SECRET`, `KEEN_REFRESH_TOKEN` | a missing id: read it back through MCP (§3). A missing secret is not readable again: `KEEN_CONSUMER_SECRET` → `rotate_mcp_consumer_secret` (confirm first). A lost MCP secret → the person presses **Rotate secret** and types the new one into `keen-project.json` |
| `.env` values | unquoted `KEY=value`; `KEEN_HOST` = the bare host of `server`, `KEEN_ORIGIN` = `application` | fix the line from `keen-project.json` and tell the person |
| `.vscode/keen.json` | `server` = `server` in `keen-project.json`, `space` = `KEEN_SPACE_ID`, `token` = `KEEN_DEPLOY_TOKEN` | write the missing fields (`../ProjectStructure/vscode/keen-json.md`); the person types `password` themselves |
| `.gitignore` | the project's lists `.vscode/keen.json` and `.env`; the workspace's lists `keen-project.json` | add them (`../ProjectStructure/gitignore.md`) |
| git | neither file is tracked (`git ls-files .env .vscode/keen.json` prints nothing) | `git rm --cached` the file, then treat every secret in it as leaked: rotate / reset each one (`values.md`, "When a value leaks") |
| `src/` | `src/flows/<Start Flow>.flow`, `src/scripts/`, `src/keen-tools.json` | `../ProjectStructure/SKILL.md` |
| the toolkit | `keen-validate` and `keen-deploy` on the PATH; `<MCP>/agent-runner/node_modules` present | `../MCP/validator.md` §1; `npm install` in the runner |

Never print a value while you check — compare presence, not content.

## 2. Sign in again — the builder through MCP, the owner's code from the person

A new client session is a new MCP session: `mcp_login { id: mcp_id, secret: mcp_secret }` from `keen-project.json` → "Step 2 of 2" → ask the person
for the owner's 6-digit code → `mcp_login_verify`. The code is asked once per MCP session; an idle session ends after
30 minutes (`../MCP/connect.md` §5–7).

| Answer | What changed | Do |
|---|---|---|
| `Logged in READ-ONLY …` | the owner lost two-step sign-in, was blocked, left, or the owner's role no longer covers the builder's | stop before any write; the person names an eligible **Owner** (**Organization › MCP Accounts** › the account); sign in again |
| `Login failed (status 406) …` | wrong secret, the account disabled, deleted, or imported without a secret | the person checks the account; a lost secret → **Rotate secret**, they type the new one into `keen-project.json` |
| a tool answers `Forbidden` | the builder's role was narrowed | the person widens the role on **Roles** |
| HTTP 404 `Session replaced …` | another client signed in with the same MCP account | tell the person; if it was not them, rotate the secret |

## 3. Check the records still stand — the builder through MCP

1. `get_space { id: KEEN_SPACE_ID }` — the space and its agents; the agent with `KEEN_AGENT` as its slug is there and
   `active`. Gone → say exactly which and stop.
2. Find the API key behind the project: `list_api_keys` → the key whose webhook origin is `KEEN_ORIGIN`
   (`get_webhook` on its `webhookId`). Check `enabled: true` and all four bindings. `enabled: false` = stopped on
   purpose: tell the person and stop — never enable it yourself.
3. `get_api_key_site { id }` — is the site running?

| The view | Meaning | Do |
|---|---|---|
| `held: true` | the key was created or rotated; the site waits for a person | **The person:** **API › Api Keys** › the key › **Application** › **Start** (MCP cannot) |
| `run: "stopped"`, not held | someone pressed **Stop** (visitors see the maintenance page) | ask the person; then `set_api_key_site { id, command: 'start' }` under the key's lock, or they press **Start** |
| no instance listed | the site is not running, or runs without site control (`npm run dev`) | the person starts it (`first-setup.md` §6.4) and its tunnel; then look again |
| some instances not current | they are still re-reading | wait a few seconds and look again |

4. `list_agent_secrets { id }` — every NAME the tools read is there (a missing one = a tool answers "not set up").

## 4. A fresh consumer token — the builder through MCP

`KEEN_TOKEN` lives 10 minutes, so it has expired. `refresh_mcp_consumer_token { refresh_token: KEEN_REFRESH_TOKEN }`
→ a NEW pair: write BOTH (`KEEN_TOKEN`, `KEEN_REFRESH_TOKEN`) — the old refresh token is spent. Refused (406) → mint
with `get_mcp_consumer_token { id: KEEN_USER_ID, secret: KEEN_CONSUMER_SECRET }`. Refused again → the consumer
changed (disabled, rotated, re-homed, spaces narrowed) or its key's chain is broken: `get_mcp_consumer` and §3.2
(`../MCP/golden-path.md`, "When the consumer token expires").

## 5. What changed since last time — ask the person, then do what each needs

Ask: "Since we last worked: did the site's address change, was the API key rotated or disabled, did your role, the
builder's role or the MCP account's owner change, was the space's deployment token reset?"

| Change | What it broke | What it needs |
|---|---|---|
| **A new site address** (a free tunnel restarted, the site moved) | the relay refuses the old Origin; every token of the key ended if the webhook's origin was changed | `application` in `keen-project.json` first, then the four places together: `update_webhook { id, origin, webhook }` under its lock; the site's `.env.local` `KEEN_ORIGIN` (+ restart); the project's `.env` `KEEN_ORIGIN`; `wake_api_key`; then a new `KEEN_TOKEN` (`../MCP/golden-path.md`, "When the site's address changes") |
| **The API key rotated** | every chat and token of the key; the site cannot connect | the person copies the new Key Secret into the site's `.env.local` `KEEN_API_KEY_SECRET` (the console showed it once) — or, if you rotated it, you write it there; restart the site; the person presses **Start**; a new `KEEN_TOKEN` |
| **The API key disabled** | everything of the site stops (close 4401) | the person decides; only they re-enable it (`set_api_key_enabled true` after their yes); old tokens never revive — mint a new one |
| **A binding re-pointed** (another client, certificate, contract or webhook on the key) | every token of the key | `wake_api_key`; a new `KEEN_TOKEN`; a rotated client → the new `KEEN_CLIENT_SECRET` in `.env.local` + restart |
| **A role saved or deleted, the MCP account's role / owner / secret / Enabled changed** | the builder's MCP session (people's sessions too) | sign in again (§2); a new secret → the person types it into `keen-project.json` |
| **The deployment token reset** | `keen-deploy` is refused | `get_space_deployment_token` → `.env` `KEEN_DEPLOY_TOKEN` and `.vscode/keen.json` `token` |
| **Json / Front Settings or the agent's Secrets changed** | nothing — they apply by themselves | Front Settings: `wake_api_key` so the site sees them |
| **Someone else deployed to the space** | the deployed copy is not your files | ask the person before deploying over it |

Every change and how it reaches what runs: `../Administration/references/delivering-changes.md`.

## 6. The loop — from the project root

```bash
keen-validate && keen-deploy && npx --prefix <MCP>/agent-runner tsx <MCP>/agent-runner/run.ts --prompt "…" --json
```

Read the trace, then the agent's Log Record; fix the cause; again (`../MCP/testing.md`). Mint a new `KEEN_TOKEN`
(§4) whenever 10 minutes have passed. A change to the agent record or its Settings needs no deploy; a change to
anything bound to the API key needs `wake_api_key`.
