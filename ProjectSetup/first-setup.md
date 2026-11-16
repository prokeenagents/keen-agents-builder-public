# The first setup — from an idea to a running agent

In order. Each step says **who** does it, the **tool / console path / command**, and what to **keep** and where.
The tool's own rules (scopes, locks, refusals) are in `../MCP/tools.md`; the golden path's step numbers are given as
"GP §n" (`../MCP/golden-path.md`). Every value and its file: `values.md`. In the examples the Keen host is
`keen.example.com` and the site's public address `https://chat.example.com`.

## 0. Find and read `keen-project.json` — the builder on files

Before anything else: find `keen-project.json` (the current folder, then each parent; not found → ask the person
where it is; none → offer the template at the workspace root, fill `server`, `agent_project_dir`, `application`, `application_dir` with the
person's answers and let them type `mcp_id` / `mcp_secret` themselves). An empty field or one still starting with
`[REPLACE` counts as missing — ask the person to fill it in the file. Make sure the workspace's `.gitignore` lists it.
Detail and template: `keen-project.md`. Never print the file.

## 1. Ask first — the builder, in the chat

Ask one question at a time; wait for each answer. The person supplies the names; you offer only computed defaults.

1. **The Keen** = `server` in `keen-project.json` → its bare host (`keen.example.com`). Every URL follows from it
   (`../MCP/connect.md` §1). Treat it as live. Ask "What is the address of your Keen?" only when the file is missing
   or `server` is a placeholder — and have the answer written into the file.
2. **The space and the agent.** The space title (unique; never reuse an existing one) and a description; the agent's
   display name. Offer the defaults and confirm: the slug = the agent name in kebab-case, digits dropped, 4–60
   characters (`shop-assistant`); Start Flow `Project`; Start Node `Main` (GP §0).
3. **What the agent must do.** Who talks to it, what it answers, what it must never do, one or two example
   conversations. This drives the design: `../AgentArchitecture/SKILL.md`.
4. **Which external services** (a shop, a CRM, a document store …). For each: the API's documentation, a TEST
   account, and whether the model calls it in a chat (agent side) or the site uses it outside a chat (site side)
   — `../Services/SKILL.md`, "Where a service lives". Note the Secrets each one will need (names only).
5. **The partner site.** Its folder is `application_dir` and its public address `application` in
   `keen-project.json`; ask only what the file does not say: "Will people chat through it now, or do we first test the
   agent alone?" No site yet → the person downloads it from the console's **Home › Get started ›
   Download Site** and unpacks it into a folder they name — that folder goes into `application_dir`. Testing alone first is fine: the runner needs only a
   fully bound API key whose webhook carries an origin (§6); the site can join later at that same address.
6. **Where the project lives** — an empty folder the person names (absolute path), inside the workspace whose root
   holds `keen-project.json` (`../ProjectStructure/SKILL.md`).

## 2. The person's preconditions — the person in the console

The builder can do nothing before these exist. Tell the person, in this order (detail and wording:
`../Administration/Organization/MCP Accounts/mcp-accounts-skill.md`, "Example"):

1. **Two-step sign-in on their own account:** **Organization › My Account › Security**. Every write in the console
   needs it, and only a person with it can own an MCP account.
2. **A role for the builder:** **Organization › Roles › Create Role** (owner or admin only). Read + Write on
   Spaces, Agents, API Keys, Clients, Certificates, Contracts, Webhooks, MCP Consumers and Logs (Logs Write = the
   agent's Log Record and its stream, `../MCP/testing.md` §6); Cache Write if you will rebuild caches; Read on
   Consumers. Never `owner` or `admin` — the platform refuses both for an MCP account.
3. **The MCP account:** **Organization › MCP Accounts › Create MCP Account** — Name, Role = the role above, Owner =
   a person with two-step sign-in whose role covers the builder's role (themselves, as owner or admin), Enabled on.
4. The reveal **MCP secret — shown once**: the person types **MCP Account ID** and **MCP Secret** into
   `keen-project.json` as `mcp_id` / `mcp_secret` **themselves** (`keen-project.md`). If the file does not exist yet,
   write it first from the template with the two placeholders, and the workspace's `.gitignore` line
   `keen-project.json` with it, so the secret never lands in a tracked file.

## 3. Connect and sign in — the builder through MCP

1. Add the server once: `claude mcp add --transport http keen https://keen.example.com/mcp`; the person restarts
   the client (or runs `/mcp`) if the tools do not appear (`../MCP/connect.md` §3).
2. `mcp_login { id: mcp_id, secret: mcp_secret }` with both values read from `keen-project.json` — never from the
   chat, never printed.
3. "Step 2 of 2" → ask in one line: "Enter the 6-digit code from <masked owner>'s authenticator app" (or "… e-mailed
   to …") → `mcp_login_verify { code }`. Never store or repeat the code.
4. "Logged in READ-ONLY" → stop; every step below writes. Tell the person the reason the reply names and the fix
   (an eligible **Owner** on the MCP account), then sign in again (`../MCP/connect.md` §6).
5. Check the role works: `list_spaces`.

## 4. Space and agent — the builder through MCP

| Step | Tool | Keep → where |
|---|---|---|
| GP §1 | `create_space { title, description }` | space **id** → `.env` `KEEN_SPACE_ID`, `.vscode/keen.json` `space`; the **deployment token** → `.env` `KEEN_DEPLOY_TOKEN`, `.vscode/keen.json` `token` |
| GP §2 | `create_agent { spaceId, displayName, agentId, startFlow, startNode }` | the agent record **id** (for settings and locks; `list_agents` finds it again); the **slug** → `.env` `KEEN_AGENT` and, later, the Agent ID of the LLM node that answers |

The deployment token can be read again (`get_space_deployment_token`, sp2); write it to the two files now anyway.
If `.env` or `.vscode/keen.json` does not exist yet, create it from §9's skeleton first.

## 5. The API chain — the builder through MCP

| Step | Tool | Keep → where |
|---|---|---|
| GP §3 | generate a 32-hex `secretKey` yourself (`node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"`), then `create_certificate { name, secretKey }` | certificate **id**; the `secretKey` (**once**) → project `.env` `KEEN_CERTIFICATE_SECRET` (see `values.md` for why it is optional) |
| GP §4 | `create_client { name }` | client **id** + **secret** (**once**) → the site's `.env.local` `KEEN_CLIENT_ID` / `KEEN_CLIENT_SECRET` |
| GP §5 | `create_consumer_contract { name }`, then under its lock: `assign_contract_spaces`, `update_consumer_contract_policy` (all five booleans), `assign_contract_default_outside_spaces` (and `…_system_spaces` if wanted), `unlock_record` | contract **id** (for the API key and the MCP consumer) |

Ask the person how people may register on their site before you set the five policy booleans
(`../Administration/API/Contracts/contracts-skill.md`). If no site folder exists yet (§1.5), keep the client values
for the site's `.env.local` by writing that file as soon as the folder exists — never in the chat.

## 6. The partner site and its origin — the person on their machine (the builder if it has a shell)

The **origin** (`https://chat.example.com`, no path, no trailing slash) is the key of the whole chain: the relay lets
a socket in only if its Origin equals the origin of the webhook bound to a fully bound API key. It is `application`
in `keen-project.json` — decide it first and write it there.

1. **The folder** = `application_dir` in `keen-project.json`. The site from **Download Site** (or the person's own copy). Its `.env.example` must name
   `KEEN_WEBHOOK_SECRET`; if not, it is an outdated copy — the person downloads a fresh one. Read only
   `.env.example`, never another `.env*` file you did not write. `npm install` in it once.
2. **The public address.** Where people will open the site: a deployed site's own `https://` address, or — for a
   site on the person's machine — a tunnel to the port the site listens on (e.g. `ngrok http 3000` →
   `https://<id>.ngrok-free.app`). That address is the origin → `application` in `keen-project.json`. A free tunnel's address changes on every restart
   (every-start §5).
3. **Its `.env.local`** — copy `.env.example`, then fill (the site's own names; `values.md`):
   `KEEN_HOST=https://keen.example.com` (= `server`, a full URL — the site refuses a bare host), `KEEN_WS=wss://keen.example.com/ws-keen`
   (point it at Keen, never through the tunnel), `KEEN_ORIGIN=<application>`, `KEEN_WEBHOOK_SECRET=<64 random hex>`
   (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`, the same value in the project's
   `.env`), `KEEN_CLIENT_ID` / `KEEN_CLIENT_SECRET` (§5), `KEEN_API_KEY_ID` / `KEEN_API_KEY_SECRET` (§7). Leave the
   rest of the example's lines empty unless the person's site uses them.
4. **The start command** — under site control, so Keen can start, stop and restart it and hand it the API key's
   Secrets: `npm run dev:managed` while developing, or `npm run build` then `npm start` for a real run. Its first
   line says the mode (`[keen-site] Mode managed — …`) and the next the port (`Listening on …:<port>`): the tunnel
   points at that port. (`npm run dev` runs the site without site control: no Start / Stop, no Secrets from Keen,
   no instances on the Application card.) Start it once §7 has filled the key values; under site control it then
   waits for Keen (the next step).

## 7. API key, webhook, bindings — the builder through MCP, then the person

| Step | Who / tool | Keep → where |
|---|---|---|
| GP §6.1 / §8 | `create_api_key { name }` | key **id** + **secret** (**once**) → the site's `.env.local` `KEEN_API_KEY_ID` / `KEEN_API_KEY_SECRET` |
| GP §7 | `create_webhook { name, origin: <origin>, webhook: "<origin>/api/keen-webhook/<KEEN_WEBHOOK_SECRET>" }` | webhook **id**. The URL is a secret — never echo it |
| GP §8 | `lock_record { kind: 'api_key', id }` → `update_api_key { id, clientId, certificateId, consumerContractId, webhookId }` → `unlock_record` | — (needs `ca2` for the certificate) |
| GP §10 | `wake_api_key { id }` — **Rebuild and refresh data** | the reply's `rebuilt` counts |
| GP §9 | start the site (§6.4) | — |
| the hold | **The person:** **API › Api Keys › <key> › Application** card → **Start** | `get_api_key_site { id }` shows `held: false`, the instance(s) and "current" |

A new key's site **waits for a person's Start** (`held: true`, the card shows **Waiting for start**); MCP cannot lift
it. Under site control the site then receives its origin, its webhook secret and the certificate from Keen at every
start. A site without site control (`npm run dev`) reads them from `.env.local` instead: restart it after any change
there, and `wake_api_key` delivers its certificate (GP §9–10). A refusal from `wake_api_key` names the missing
binding; a key with `enabled: false` was stopped on purpose — stop and tell the person.

## 8. MCP consumer and its token — the builder through MCP

| Step | Tool | Keep → where |
|---|---|---|
| GP §11 | `create_mcp_consumer { name: "<slug>-consumer", consumerContractId, space: [spaceId], enabled: true }` (an existing one: GP §11, "An existing consumer instead") | `consumer.id` → `.env` `KEEN_USER_ID`; `secret` (**once**) → `.env` `KEEN_CONSUMER_SECRET` |
| GP §12 | `get_mcp_consumer_token { id, secret }` | `access_token` → `KEEN_TOKEN` (10 minutes); `refresh_token` → `KEEN_REFRESH_TOKEN` |

A 406 from the token tool never says why: check the consumer is enabled, has the contract, and the key behind that
contract is fully bound and woken.

## 9. The project — the builder on files

1. **The skeleton** in `agent_project_dir` (`../ProjectStructure/SKILL.md`, "A new project, in order"): `.gitignore` FIRST
   (`../ProjectStructure/gitignore.md` — `.vscode/keen.json`, `.env`, `.env.*`, `!.env.example`, `node_modules/`,
   `*.zip`), then `.vscode/keen.json` (`../ProjectStructure/vscode/keen-json.md`: `server` = `server` from `keen-project.json`,
   `space`, `token`; `user` and `password` = the person's console login for the debuggers — the person types the
   password into the file themselves), `.vscode/settings.json`, `package.json`, `.prettierrc` + `.prettierignore`.
2. **The project's `.env`** in the project root (GP §13, `values.md`): `KEEN_HOST=keen.example.com` (the bare host
   of `server`), `KEEN_TOKEN`, `KEEN_USER_ID`, `KEEN_EMAIL` (any non-empty value), `KEEN_ORIGIN` (= `application`),
   `KEEN_SPACE_ID`, `KEEN_AGENT`, `KEEN_DEPLOY_TOKEN`, `KEEN_PROJECT_DIR=.`; kept beside them for you:
   `KEEN_CONSUMER_SECRET`, `KEEN_REFRESH_TOKEN`, `KEEN_CERTIFICATE_SECRET`, `KEEN_WEBHOOK_SECRET`. No MCP account
   values — they stay in `keen-project.json`. Unquoted values;
   `chmod 600`. All three tools read `.env` from the **current folder**: run them from the project root.
3. **The agent.** The design: `../AgentArchitecture/SKILL.md`. The flow: `src/flows/<Start Flow>.flow` whose Start
   node is labelled `<Start Node>`; the LLM node that answers the person carries the agent's **slug** as its Agent
   ID (`../Flow/Nodes/SKILL.md`). Every LLM node gets a Fallback to the same agent on another provider, and every chat
   LLM a Summary to a Summarizer that has its own Fallback Summarizer — by default, unasked (the house standard,
   `../Flow/Nodes/SKILL.md`). Tools: `../Flow/Tools/SKILL.md`. Each external service:
   `../Services/SKILL.md` → `recipe.md` (the four files, one tool per instrument, `src/keen-tools.json`, the
   service's skill).
4. **The toolkit, once per machine:** the `keen-validate` / `keen-deploy` pair for the machine from `<MCP>/bin/` onto
   the PATH (`../MCP/validator.md` §1); `cd <MCP>/agent-runner && npm install` (Node 20 or newer). `<MCP>` = the
   folder of the keen-mcp skill.

## 10. What the person types in the console

- **The agent's Secrets** (only the person): **AI › Agents** › the agent › **Lock** › **Secrets** › **Add secret** →
  the exact NAME your tool reads (`SHOP_API_KEY`) + the value → **Save**. Then check with `list_agent_secrets { id }`
  (names only). They apply from the next Script node — no deploy.
- **Json Settings** (plain switches for the scripts): **Json settings** › `{ "shop_available": true, "shop_title":
  "Example Shop" }` › **Update settings** — or you write them with `update_agent_settings` under the agent's lock
  (GP §2a). From the next Script node.
- **Front Settings** (plain switches for the site): the same on **Front settings**, or `update_agent_front_settings`;
  then **Rebuild and refresh data** (`wake_api_key`) — the site does not see them before.
- **The API key's Secrets** (only if the site's own server code needs a key): **API › Api Keys** › the key › **Lock** ›
  **Secrets** card → **Save and restart** (or **Save**, then **Restart** / **Start**).

Never ask for a value in the chat; give the console path and the NAME. Detail:
`../Administration/references/secrets-and-credentials.md`, `../Services/recipe.md` §12.

## 11. Validate, deploy, the first test chat — from the project root

1. `keen-validate` → `0 error(s)` (`../MCP/validator.md`); read every warning.
2. `keen-deploy` → `{"t":"deployed",…}` (`../MCP/uploader.md`). Only the space the person named.
3. Optional, before the chat: a Log Record for the agent and its live stream (`../MCP/testing.md` §6).
4. `npx --prefix <MCP>/agent-runner tsx <MCP>/agent-runner/run.ts --prompt "Hello" --json` — a token older than
   10 minutes is refreshed first (every-start §4).
5. Read the trace: the summary → the failing `flow` line → the last node with `success: false` → its request → its
   response; then the Log Record (`../MCP/testing.md` §4, §6, §8). Fix the cause → validate → deploy → run.
6. With the site running: the person opens `<origin>`, signs up or in, and chats — the same agent.

## 12. Done — the checklist

- [ ] `mcp_login` confirmed by the owner; the builder's role reaches every tool used.
- [ ] Space, agent (slug = the answering LLM node's Agent ID, Start Flow / Node = the deployed flow and its Start node).
- [ ] Certificate, client, contract (spaces, defaults, policy), webhook (origin = the site's public address), API key
      with all four bindings; `wake_api_key` answered.
- [ ] The site runs under site control; `get_api_key_site` shows `held: false` and its instance(s) current.
- [ ] MCP consumer on the contract and the space; `KEEN_TOKEN` fresh.
- [ ] The workspace's `.gitignore` lists `keen-project.json`, the project's lists `.vscode/keen.json` and `.env`;
      none is tracked; no secret in `src/` or a Settings value.
- [ ] The agent's Secrets saved by the person (`list_agent_secrets` shows every NAME the tools read).
- [ ] Every LLM node has a Fallback (another provider) and every chat LLM a Summary → Summarizer → Fallback Summarizer.
- [ ] `keen-validate` 0 errors, `keen-deploy` `deployed`, `run.ts` `ok: true` with `endReached: true`, and the
      answer is what the person asked for.
- [ ] A summary to the person: ids only (space, agent slug, API key, consumer, the origin), never a secret.
