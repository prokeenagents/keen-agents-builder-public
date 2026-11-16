# The golden path — from an empty organisation to a test chat

The order to provision everything a new agent needs, with the tool for each step, what to keep from the reply,
and what the person must do in the console when MCP cannot. Sign in first (`connect.md`). Every tool, its scope
and its lock rule: `tools.md`.

**Keep values as you go.** Ids are safe to repeat. Secrets marked **once** never come back: write them straight
into the git-ignored file named in the step (never into chat, a draft, a commit or a log). A lost one is
re-minted (rotate / reset), not read again.

**Where things live.**

| File | Holds | Who reads it |
|---|---|---|
| `<workspace>/keen-project.json` (git-ignored, outside the project) | `server`, `agent_project_dir`, `application`, `application_dir`, the MCP account's `mcp_id` / `mcp_secret` — the one source of these | you, first, every session — `../ProjectSetup/keen-project.md` |
| `<project>/.env` (git-ignored) | the runner / deploy / validate values (step 13) | `run.ts`, `keen-deploy`, `keen-validate` — each reads `.env` from the **current folder**, so run all three from the project root (`agent_project_dir`) |
| `<project>/.vscode/keen.json` (git-ignored) | `server`, `space`, deployment `token`, the debugger login | Shira, `debug.ts` — see `../ProjectStructure/vscode/keen-json.md` |
| the partner site's `.env.local` | client + api key secrets, origin, webhook secret | the site (the reference site "entanglement") |

## 0. Read `keen-project.json`, then ask

1. Read `keen-project.json` (`../ProjectSetup/keen-project.md`): `server` is the Keen — every URL derives from its
   host (`connect.md` §1); `mcp_id` / `mcp_secret` sign you in. Ask "What is the address of your Keen?" only when the
   file is missing or `server` is a placeholder.
2. The partner site: its folder is `application_dir`, its public address `application`. Ask only what the file does
   not say. If the person has no site, they download it with the console's **Download Site** button and its folder
   goes into `application_dir`.
3. The names: space title, agent name, the agent slug (4–60 lowercase letters and single dashes; unique in the
   organisation), Start Flow and Start Node (PascalCase, 3–60). The person supplies the space and agent names; offer
   only computed defaults (the slug = the agent name in kebab-case, digits dropped; Start Flow `Project`, Start Node
   `Main`) and confirm. Never invent names or reuse an existing space's title.

## 1. Space — `create_space { title, description }`

Keep: the space **id**; the **deployment token** (in this reply; later `get_space_deployment_token`, scope sp2;
`reset_space_deployment_token` re-mints it and the old one stops at once for new deploy connections; a deploy
session already open with it may finish its short window). Write the token into `.env` (`KEEN_DEPLOY_TOKEN`) and
`.vscode/keen.json` (`token`).

## 2. Agent — `create_agent { spaceId, displayName, agentId, startFlow, startNode }`

Keep: the agent record **id** (for settings, locks) and the **slug** (`agentId`, for the runner and the flow's
answering LLM node). `startFlow` / `startNode` must match the flow you deploy: the file `src/flows/<startFlow>.flow`
and its Start node labelled `<startNode>`. The LLM node that answers the person must carry this same slug as its
Agent ID (`../Flow/Nodes/LLM/llm-skill.md`).

- **2a. Settings (optional).** `lock_record { kind: 'agent', id }` → `update_agent_settings { id, jsonSettings }`
  (a JSON string, ≤ 1000 characters; scripts read top-level keys with `system/settings`) and/or
  `update_agent_front_settings { id, jsonSettings }` (the partner site reads them) → `unlock_record`.
- **2b. Secrets (only the person).** A third-party key a script reads with `system/secrets` is never typed over
  MCP. Tell the person: **AI › Agents › <agent> › Secrets** card → Add secret → name + value → Save (the
  browser encrypts it). Give them the exact NAME your script reads. Then check with `list_agent_secrets { id }`
  (names only). See `../Flow/Nodes/Script/references/system/secrets.md`.

## 3. Certificate — `create_certificate { name, secretKey }`

Generate `secretKey` yourself: 16–32 random characters, e.g.
`node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"` (32 hex). Never echo it. Keep: the
certificate **id**; the `secretKey` is in this reply only (**once**). No tool and no file needs it: a managed site
receives it from Keen at each start (it signs Keen's webhook deliveries). Keeping it as `KEEN_CERTIFICATE_SECRET`
in the git-ignored `.env` is optional, as a record. Lost →
generate a new one, `update_certificate { id, secretKey }` under the certificate's lock, then step 10 again.
Needs `ca2`.

## 4. Client — `create_client { name }`

Keep: the client **id** and **secret** (**once**) → the site's `.env.local` (`KEEN_CLIENT_ID`, `KEEN_CLIENT_SECRET`).

## 5. Contract — `create_consumer_contract { name }`

Keep: the contract **id**. Then, under one reservation:
`lock_record { kind: 'consumer_contract', id }` →
`assign_contract_spaces { id, spaceIds: [spaceId] }` →
`update_consumer_contract_policy { id, outsideRegistration, otpInsideRegistration, otpOutsideRegistration, blockOutsideRegistrationLogins, blockSystemRegistrationLogins }` (all five, every time; ask the person
how people may register on their site) →
`assign_contract_default_outside_spaces { id, spaceIds: [spaceId] }` (and `…_default_system_spaces` if wanted) →
`unlock_record`.

## 6. The partner site and its origin

The origin (`scheme://host[:port]`) the site — and the runner — present is the key of the whole chain: the relay
lets a socket in only if its Origin equals the `origin` of a webhook record bound to a **fully bound** api key.

1. Create the api key now (step 8, `create_api_key { name }`) so the site can boot: keep its **id** and
   **secret** (**once**) → `.env.local` (`KEEN_API_KEY_ID`, `KEEN_API_KEY_SECRET`).
2. In the site's `.env.local` (copy its `.env.example`): `KEEN_HOST=https://<host>` (a full URL; the site refuses a
   bare host), the client and key values, and `KEEN_WEBHOOK_SECRET` = 64 random hex characters
   (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`; at least 32; keep the same value in
   the project's `.env`). Under Keen's site control (the managed start below) Keen hands the site `KEEN_ORIGIN` and
   `KEEN_WEBHOOK_SECRET` from the webhook record at every start and the pre-process derives `KEEN_WS` from the host;
   a site started without site control needs `KEEN_WS=wss://<host>/ws-keen` and `KEEN_ORIGIN` itself. Follow the
   site's own `.env.example`; an `.env.example` without a `KEEN_WEBHOOK_SECRET` line is an outdated copy of the site: the person
   downloads a fresh one first. If the site has no `node_modules`, run `npm install` in it.
3. Start it **managed**, so Keen controls it (Start / Stop / Restart, the application Secrets, the instance list):
   `npm run dev:managed` while developing, or `npm run build` then `npm start`. (`npm run dev` runs the site WITHOUT
   site control: no Secrets from Keen, no Start / Stop, no instances on the Application card.) Read the port it
   prints — do not assume 3000. Details: `../Entanglement/`.
4. Give it a public `https://` address: the address people open the site at — for a site on the person's own
   machine, a tunnel to that port (e.g. `ngrok http <port>` → `https://<xxxx>.ngrok-free.app`). That public address
   is `<origin>` = `application` in `keen-project.json` (write it there).

If you cannot run processes, give the person these exact commands and ask for the port and the URL.

## 7. Webhook — `create_webhook { name, origin, webhook }`

`origin` = `<origin>` exactly (no path, no trailing slash). `webhook` = `<origin>/api/keen-webhook/<KEEN_WEBHOOK_SECRET>`
(must be `https://`; the URL itself is a secret — never echo it, mask it if a reply repeats it). Keep: the
webhook **id**. All three fields are unique across webhooks.

## 8. API key bindings

`lock_record { kind: 'api_key', id }` → `update_api_key { id, clientId, certificateId, consumerContractId, webhookId }`
→ `unlock_record`. A key missing any of the four is not live (and `wake_api_key` refuses it). Binding a
certificate needs `ca2`. (A key created after steps 3–7 can take all four ids in `create_api_key` directly.)

## 9. Finish the site and restart it

Set `KEEN_ORIGIN=<origin>` in `.env.local` and **restart** the site (it reads its configuration only at start).
A site running under Keen's site control waits after a create or rotate of its key until a person presses
**Start** on **API › Api Keys › <key> › Application** card; `get_api_key_site` shows `held: true` then. MCP cannot
lift it: tell the person.

## 10. Refresh data — `wake_api_key { id }`

Only once all four bindings exist. It rebuilds the caches of everything bound to the key (key, certificate,
client, contract + policy, the contract's spaces and their agents), then tells every connected site instance to
re-read. The reply's `rebuilt` counts records per resource. **Repeat it after every later change** to anything
bound to the key (a new agent, a changed webhook, a new space on the contract). Forgetting it is the usual
reason for "I changed it but the runner still sees the old thing".

- A refusal names a missing binding or a disabled key: fix the binding; a key with `enabled: false` was stopped on
  purpose — tell the person and stop, never enable it yourself.
- `get_api_key_site { id }` listing no instance is normal for a site without Keen's site pre-process, or a key not
  rotated since site control arrived. Do not rotate the key to "fix" it: a rotate stops the site until its
  environment holds the new secret and a person presses Start.

## 11. MCP consumer — `create_mcp_consumer { name, consumerContractId, space: [spaceId], enabled: true }`

Keep: `consumer.id` (→ `KEEN_USER_ID`) and `secret` (**once**, → `KEEN_CONSUMER_SECRET`) in the project's `.env`.
`name` is unique and can never change (a taken name is a 406: add `-2`, `-3`, …); a good default is
`<agent slug>-consumer`. `space` must be inside the contract's spaces.

**An existing consumer instead:** the person gives its id and secret. Under one reservation
(`lock_record { kind: 'mcp_consumer', id }`): `assign_mcp_consumer_contract { id, consumerContractId }` →
`assign_mcp_consumer_spaces { id, space: [spaceId] }` → `set_mcp_consumer_enabled { id, enabled: true }` if it was off →
`unlock_record`. A consumer belongs to ONE contract: re-homing moves it off its old one and revokes its tokens.

## 12. Its token — `get_mcp_consumer_token { id, secret }`

Keep: `access_token` (→ `KEEN_TOKEN`; lives **10 minutes** on a standard install, `expires_in` says) and
`refresh_token` (→ `KEEN_REFRESH_TOKEN`; lives days). A 406 here says nothing about why: check the consumer is
enabled, has the contract, and the key behind that contract is fully bound and woken.

## 13. The project's `.env` (from `agent-runner/.env.example`)

| Key | Value |
|---|---|
| `KEEN_HOST` | the bare host of `server` in `keen-project.json` (no scheme), e.g. `keen.example.com` |
| `KEEN_TOKEN` | the `access_token` from step 12 |
| `KEEN_USER_ID` | the MCP consumer id (the relay requires it to equal the token's sealed subject) |
| `KEEN_EMAIL` | any non-empty value, e.g. `agent@runner.example` (an MCP consumer has no e-mail) |
| `KEEN_ORIGIN` | `<origin>` from step 7, exact (= `application` in `keen-project.json`) |
| `KEEN_SPACE_ID` / `KEEN_AGENT` | the space id / the agent **slug** |
| `KEEN_DEPLOY_TOKEN` | the deployment token from step 1 |
| `KEEN_PROJECT_DIR` | the project root: `.` when the tools run from it (a relative path is resolved against the current folder; an absolute path is safest) |
| `KEEN_CHAT_ID` | optional: one fixed chat id so runs continue one conversation |

Kept in the same file for you (the tools ignore them; never print them):
`KEEN_CONSUMER_SECRET` (step 11), `KEEN_REFRESH_TOKEN` (step 12), optionally `KEEN_CERTIFICATE_SECRET` (step 3),
`KEEN_WEBHOOK_SECRET` (step 6, the site's value). The MCP account's ID and secret are not in `.env` — only in
`keen-project.json`.

Write values unquoted (`KEY=value`): the Go tools keep quotes literally. `.env` must be in `.gitignore`; keep it
readable only by its owner (`chmod 600`).

## 14. The project, validated and deployed

Write the project (`../ProjectStructure/SKILL.md`, flows `../Flow/Nodes/SKILL.md`, tools `../Flow/Tools/SKILL.md`),
then from the project root: `keen-validate` (0 errors, `validator.md`) → `keen-deploy` (`deployed`, `uploader.md`).

## 15. Test — `npx --prefix <MCP>/agent-runner tsx <MCP>/agent-runner/run.ts --prompt "…" --json`

From the project root (so `run.ts` reads its `.env`). Read the trace; fix → validate → deploy → run (`testing.md`).

Optional for testing: a Log record for the agent so its error lines are kept (`testing.md` §6).

## When the site's address changes

A free tunnel's URL changes on every restart; a site may also move. First write the new address into
`application` in `keen-project.json`. The origin then lives in four places; move all four together:

1. The webhook record, both fields: `lock_record { kind: 'webhook', id }` → `update_webhook { id, origin, webhook }`
   → `unlock_record`.
2. The site's `.env.local` `KEEN_ORIGIN` → restart the site.
3. The project's `.env` `KEEN_ORIGIN`.
4. **`wake_api_key { id }`** — only its rebuild puts the new origin on the relay's allow-list.

A new origin on the bound webhook ends every token of the key at once — the site's application token, every open
chat and every consumer token. The site's restart (2) mints it a new application token; then mint a new consumer
token (`get_mcp_consumer_token` with the stored id + secret) and replace `KEEN_TOKEN` (the token also carries the
origin). Skipping a step = a socket refused before the welcome, or `Invalid token`.

## When the consumer token expires

`KEEN_TOKEN` lives 10 minutes, so most test sessions start with a fresh one. The runner cannot refresh it:
an MCP consumer's token is minted only through the MCP server. Either:

- `refresh_mcp_consumer_token { refresh_token }` → a NEW pair; the old refresh token is spent, so replace both; or
- `get_mcp_consumer_token { id, secret }` again.

Write the new `access_token` into `KEEN_TOKEN`. A refusal (406) after a disable, delete, secret rotation,
contract change or narrowed spaces means: fix the consumer, then mint with `get_mcp_consumer_token`.

## After a key rotation, disable or delete

`rotate_api_key`, `set_api_key_enabled false` and `delete_api_key` end every chat (close 4401), the application
token and every consumer token of that key at once. So does re-pointing a binding of the key (`update_api_key`, a new
origin on its webhook, deleting its client / certificate / contract). After a rotate: the site needs the new
`KEEN_API_KEY_SECRET` and a restart (and a person's Start under site control); mint a new `KEEN_TOKEN`. Re-enabling a
key revives no old token.
