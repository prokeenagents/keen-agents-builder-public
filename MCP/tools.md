# The Keen MCP tools — every one, by domain

The server registers **88 tools** (and 5 read-only resources, see `connect.md`). Each tool is ONE request to the
platform, made AS your MCP account: the platform re-checks your role on every call and the action log records
you. Every tool's own description repeats its scope; read it when unsure.

**Columns.** **Scope** = the permission your role needs (`x1` read, `x2` write). Every `x2` tool also needs a
confirmed session (the owner's code — see `connect.md` §6). **Lock**: `R` = you must hold the record's
reservation first (`lock_record`); `A` = no reservation needed, refused only while ANOTHER user holds the record;
`S` = refused while another user holds the parent space; `—` = no lock involved. **Destr.** = marked destructive
(confirm with the person before calling). **Once** = the reply carries a secret that is never shown again.

Record ids are cuids. The agent **slug** (`agentId`, e.g. `offer-agent`) is not its record id.

## Session and record locks

| Tool | Does | Main inputs | Scope | Lock | Destr. |
|---|---|---|---|---|---|
| `mcp_login` | sign in as the MCP account (may answer "Step 2 of 2") | `id`, `secret` | — | — | no |
| `mcp_login_verify` | the owner's 6-digit code | `code` | — | — | no |
| `mcp_login_resend` | mail a new code (e-mail owner only; 60 s apart, 3 at most) | — | — | — | no |
| `logout` | revoke this session's token | — | — | — | no |
| `lock_record` | reserve a record for 30 minutes (again = extend) | `kind`, `id` | the record's `x2` | — | no |
| `unlock_record` | release your reservation (no-op if not yours / expired) | `kind`, `id` | the record's `x2` | — | no |

## Spaces

| Tool | Does | Main inputs | Scope | Lock | Destr. | Once |
|---|---|---|---|---|---|---|
| `list_spaces` | list the AI spaces | — | sp1 | — | no | |
| `get_space` | one space, with its agents (no deployment token) | `id` | sp1 | — | no | |
| `create_space` | create a space; the reply also carries its **deployment token** | `title` (unique), `description` (required) | sp2 | — | no | token (re-readable) |
| `update_space` | partial update | `id`, `title?`, `description?` | sp2 | R | no | |
| `delete_space` | delete a space; its agents cascade | `id` | sp2 | R | **yes** | |
| `get_space_deployment_token` | read the token `keen-deploy` uses | `id` | sp2 | — | no | |
| `reset_space_deployment_token` | re-mint it; the old one stops at once for any new deploy connection | `id` | sp2 | A | **yes** | new token (re-readable) |
| `clear_spaces_cache` | force a rebuild of the spaces cache | — | sp2 | — | no | |

## Agents

| Tool | Does | Main inputs | Scope | Lock | Destr. |
|---|---|---|---|---|---|
| `list_agents` | a space's agents | `spaceId` | ag1 | — | no |
| `get_agent` | one agent | `id` | ag1 | — | no |
| `create_agent` | create an agent in a space; the relay runs `startFlow`-`startNode` | `spaceId`, `displayName` (3–150), `agentId` (slug: 3–100, lowercase letters and single dashes, no digits; unique in the organisation), `startFlow`, `startNode` (PascalCase, 3–60) | ag2 | S | no |
| `update_agent` | partial: rename, re-point the entry, `active` on/off | `id`, any of the above, `active?` | ag2 | R (agent) | no |
| `delete_agent` | delete an agent | `id` | ag2 | R | **yes** |
| `get_agent_settings` | read the runtime Json Settings | `id` | ag1 | — | no |
| `update_agent_settings` | write the WHOLE runtime Json Settings (scripts read the top-level keys with `system/settings`) | `id`, `jsonSettings` (a JSON **string**, valid JSON, ≤ 1000 characters; `''` clears) | ag2 | R (agent) | no |
| `get_agent_front_settings` | read the partner-facing Front Settings | `id` | ag1 | — | no |
| `update_agent_front_settings` | write the WHOLE Front Settings (the partner site reads them through the relay; scripts never do) | `id`, `jsonSettings` (same rule) | ag2 | R (agent) | no |
| `list_agent_secrets` | the NAMES of the agent's secrets, who set them and when, the limits (50 names, 8–8192 bytes a value, 65536 an agent), the history. **Never a value** | `id` | ag1 | — | no |

Pick the agent slug **4–60** characters: the platform takes 3–100, the flow canvas's Agent ID field only 4–60.
The settings are write-through: scripts see new values on their next run, no deploy needed. More:
`../Flow/Nodes/Script/references/system/settings.md`, `.../system/secrets.md`.

## API keys

| Tool | Does | Main inputs | Scope | Lock | Destr. | Once |
|---|---|---|---|---|---|---|
| `list_api_keys` / `get_api_key` | read | `id` | ak1 | — | no | |
| `create_api_key` | create a key; may bind the four records at once. The site then waits for a person's Start | `name` (≤ 100), `webhookId?`, `clientId?`, `certificateId?`, `consumerContractId?` | ak2 (+ ca2 with a certificate) | — | no | **key secret** |
| `update_api_key` | rename / re-point bindings; `null` unbinds. **A changed binding ends every token of the key at once** (the application token, every chat, every consumer token — like a rotate) and restarts every site instance | `id`, `name?`, the four ids (or `null`) | ak2 (+ ca2 to bind / unbind a certificate, or to re-point the webhook of a key that has one) | R | no | |
| `rotate_api_key` | re-mint the key secret: ends at once every chat, socket and token of the partner application; the site then waits for a person's Start | `id` | ak2 (+ ca2 if it has a certificate) | R | **yes** | **new key secret** |
| `wake_api_key` | **Refresh data**: rebuild the caches of everything bound to the key, then every connected site instance re-reads (no restart, no chat ends). Refuses a half-wired key | `id` | ak2 | A | no | |
| `delete_api_key` | delete (revoke): ends every chat, socket and token of the application | `id` | ak2 | R | **yes** | |
| `set_api_key_enabled` | off = stops the application at once (close 4401); on = it may mint tokens again (old tokens stay dead) | `id`, `enabled` | ak2 | R | **yes** | |
| `get_api_key_site` | the partner site: running or not, `held`, connected instances, current or not | `id` | ak1 | — | no | |
| `set_api_key_site` | `start` / `stop` (maintenance page; chats go on) / `restart` every instance | `id`, `command` | ak2 | R | **yes** | |
| `list_api_key_secrets` | the NAMES of the site's environment secrets, version / pending, limits, history. **Never a value** | `id` | ak1 | — | no | |

The same "every token of the key ends" happens when a record bound to a key changes under it: `update_webhook` with a
new `origin`, or deleting the key's client, certificate or contract (the binding becomes empty). A new webhook URL
alone ends no token, but restarts every site instance. A rename changes nothing. So on a live key, confirm first and
plan the follow-up: restart the site, mint a new consumer token (`golden-path.md`).

`set_api_key_site` 400 answers (verbatim): `This api key has no site control yet — rotate it once to turn it
on.` · `Enable the key first.` · `This api key cannot control a site yet — no <x>, no <y> bound.` · `The site is
stopped — start it instead.` · `The site waits for a person to start it after a new key secret!` (after a create
or a rotate: tell the person to press **Start** on the key's **Application** card; never retry). Passing
`enabled` to `update_api_key` does nothing (the input schema drops unknown keys): use `set_api_key_enabled`.

## Clients, certificates, webhooks

| Tool | Does | Main inputs | Scope | Lock | Destr. | Once |
|---|---|---|---|---|---|---|
| `list_clients` / `get_client` | read | `id` | ct1 | — | no | |
| `create_client` | create; mints client id + secret | `name` (≤ 100) | ct2 | — | no | **client secret** |
| `update_client` | rename | `id`, `name` | ct2 | R | no | |
| `rotate_client` | re-mint the secret; the old one stops at once | `id` | ct2 | A | **yes** | **new secret** |
| `delete_client` | delete | `id` | ct2 | R | **yes** | |
| `list_certificates` / `get_certificate` | read (name, public PEM, folder id, linked key) — never the `secretKey` | `id` | ca1 | — | no | |
| `create_certificate` | create; an RSA pair is generated server side | `name`, `secretKey` (16–32 chars trimmed, not one repeated char — generate a random one) | ca2 | — | no | **secretKey echoed (the only read)** |
| `update_certificate` | rename and/or replace `secretKey` (never cleared) | `id`, `name?`, `secretKey?` | ca2 | R | no | |
| `rotate_certificate` | new key pair (same folder id); `secretKey` unchanged | `id` | ca2 | A | **yes** | |
| `delete_certificate` | delete | `id` | ca2 | R | **yes** | |
| `list_webhooks` / `get_webhook` | read | `id` | wk1 | — | no | |
| `create_webhook` | a named (origin, callback URL) pair; all three unique | `name`, `origin` (`scheme://host[:port]`, no path, ≤ 200), `webhook` (full URL, ≤ 500, no credentials in it; the platform accepts only `https://` unless the operator allow-listed the host — the tool's schema lets `http://` through, the platform refuses it: `Webhook must be an https:// URL (http:// only for a host the operator allow-listed).`). Keen delivers only to a public address and never follows a redirect | wk2 | — | no | |
| `update_webhook` | partial; a new `origin` on a webhook bound to a key ends every token of that key (see API keys) | `id`, `name?`, `origin?`, `webhook?` | wk2 (+ ca2 for the URL of a certificate key's webhook) | R | no | |
| `delete_webhook` | delete | `id` | wk2 | R | **yes** | |

## Consumer contracts and consumers

| Tool | Does | Main inputs | Scope | Lock | Destr. |
|---|---|---|---|---|---|
| `list_consumer_contracts` / `get_consumer_contract` | read (policy + space sets) | `id` | co1 | — | no |
| `list_contract_spaces` | the spaces a contract can be granted | — | co1 | — | no |
| `create_consumer_contract` | create a partner tenant | `name`, `key?` (re-adopt a lost tenant) | co2 | — | no |
| `update_consumer_contract` | rename / change key | `id`, `name?`, `key?` | co2 | R | no |
| `delete_consumer_contract` | delete; its consumers are released (orphans) | `id` | co2 | R | **yes** |
| `update_consumer_contract_policy` | set ALL FIVE booleans: `outsideRegistration`, `otpInsideRegistration`, `otpOutsideRegistration`, `blockOutsideRegistrationLogins`, `blockSystemRegistrationLogins` | `id` + five booleans | co2 | R | no |
| `assign_contract_spaces` | replace the assigned space set (`[]` clears) | `id`, `spaceIds` (≤ 200) | co2 | R | no |
| `assign_contract_default_system_spaces` | default set for system-registered consumers (subset of assigned) | `id`, `spaceIds` | co2 | R | no |
| `assign_contract_default_outside_spaces` | default set for outside-registered consumers (subset of assigned) | `id`, `spaceIds` | co2 | R | no |
| `list_consumers` | people consumers, paged (`page`, `items`, `sort`, `filters` as `<field>[.<op>]`) — READ ONLY | paging | cs1 | — | no |
| `get_consumer` / `get_consumer_info` | one person consumer (record / enriched view) — READ ONLY | `id` | cs1 | — | no |

## MCP consumers (the end users YOU act as)

These tools reach every MCP consumer of the organisation, not only the ones you created (`createdBy` is a record, not
an owner). Create, the two assigns and the two token tools are for MCP accounts only; a person can only list, read,
enable / disable, rotate and delete them in the console.

| Tool | Does | Main inputs | Scope | Lock | Destr. | Once |
|---|---|---|---|---|---|---|
| `list_mcp_consumers` / `get_mcp_consumer` | read; never a secret | paging / `id` | mcc1 | — | no | |
| `create_mcp_consumer` | create a headless consumer (no e-mail, password or OTP); `createdBy` = you | `name` (unique, immutable), `consumerContractId?` (the contract ID, not its key; needed before a token), `space?` (subset of the contract's spaces), `enabled?` | mcc2 | — | no | **secret** |
| `assign_mcp_consumer_contract` | re-home onto a contract or `null`; revokes every token pair at once | `id`, `consumerContractId` | mcc2 | R | no | |
| `assign_mcp_consumer_spaces` | replace the space grant; removing a space revokes every pair | `id`, `space` | mcc2 | R | no | |
| `set_mcp_consumer_enabled` | off revokes every pair; on revives none. Not marked destructive, but confirm before turning one off | `id`, `enabled` | mcc2 | R | no | |
| `rotate_mcp_consumer_secret` | new secret; old one dead, every pair revoked | `id` | mcc2 | A | **yes** | **new secret** |
| `delete_mcp_consumer` | delete; its credential and tokens stop | `id` | mcc2 | R | **yes** | |
| `get_mcp_consumer_token` | mint the consumer's token pair `{ access_token, token_type, expires_in, refresh_token }` — the ONLY way to get one | `id`, `secret` | mcc1 + confirmed session | — | no | the pair |
| `refresh_mcp_consumer_token` | rotate the pair; the old refresh token is spent — replace both | `refresh_token` | mcc1 + confirmed session | — | no | the new pair |

Any token refusal (unknown id, wrong secret, disabled, no contract, chain not fully bound) is one uniform **406**
that never says which. Failed attempts are throttled (429 `Too many attempts!`).

## Cache

| Tool | Does | Main inputs | Scope | Destr. |
|---|---|---|---|---|
| `get_cache_status` | build status of one cache resource | `resource` ∈ roles, agents, spaces, api_keys, certificates, clients, consumer_contracts, consumer_policy | ce1 | no |
| `create_cache` | rebuild one whole resource | `resource` | ce2 | no |
| `invalidate_cache` | invalidate one resource | `resource` | ce2 | no |
| `rebuild_api_key_cache` | rebuild ONLY what one key binds, WITHOUT telling the site (rarely needed: use `wake_api_key`) | `id` | ce2 | no |

## Logs

| Tool | Does | Main inputs | Scope | Lock | Destr. |
|---|---|---|---|---|---|
| `list_log_settings` | the log-channel switchboard | — | l1 | — | no |
| `update_log_setting` | flip one channel (the `action` / `error` channels refuse) | `id` (the channel name) | l2 | — | no |
| `get_log_audit` | one channel's audit: its dated files | `audit` (plain name) | l1 | — | no |
| `get_log_file` | the newest ~40 lines of one system log file | `filename` (plain basename, e.g. `system-action-2026-08-23.log`) | l1 | — | no |
| `list_log_records` | the per-(space, agent) Log records | `spaceId?` | l1 | — | no |
| `reveal_log_token` | a record's `readToken` (for the live stream) | `id` | l2 | — | no |
| `create_log_record` | a record for a space (`SPACE`) or one agent (`AGENT` + `agentSlug`) | `title`, `selector`, `spaceId`, `agentSlug?`, `description?`, `allowClientRead?` | l2 | — | no |
| `update_log_record` | partial; `enable` toggles it | `id`, … | l2 | R | no |
| `delete_log_record` | delete | `id` | l2 | R | **yes** |

How the builder uses Log records to read an agent's errors: `testing.md` §6.

## Record locks (reservations)

- **Kinds** (`lock_record` / `unlock_record` `kind`): `space`, `agent`, `api_key`, `client`, `certificate`,
  `webhook`, `consumer_contract`, `mcp_consumer`, `log_record`. An agent's Json and Front settings ride the
  **agent's** lock.
- **Life:** 30 minutes. Each of your own updates refreshes it; `lock_record` again extends it. A reservation also
  ends when your session ends (logout, a role / secret / Enabled change).
- **The reply** is the lock block `{ by, byEmail, at, expiresAt, mine, expired }`. Your label reads
  `<MCP account name> (MCP account)`. Every `get_*` / `list_*` reply of these records carries the same block
  (`null` = free; `expired: true` = free for anyone).
- **Refusals (406):** `Reserve the record first!` — free, or your hold expired: `lock_record`, then repeat.
  `Locked by <who> until <HH:MM>!` (UTC; `result.lock.expiresAt` is ISO) — tell the person who holds it and until
  when; do not loop; **there is no force-unlock**. `Not allowed!` on `lock_record` — a record nobody may change.
- **Creating** needs no reservation (except `create_agent`: refused while another user holds the space). A new
  record is not reserved for you: lock it before its first update.
- **Pattern for a burst:** lock → all the changes → unlock. Locking changes nothing else on the record.

## What NO tool does (tell the person to use the console)

| Not on MCP | Where the person does it |
|---|---|
| People's accounts, roles, MCP accounts (yours too: owner, secret, role, Enabled) — not even reads | **Organization › Accounts / Roles / MCP Accounts** (owner or admin) |
| Create, change, reset a password of, assign spaces / a contract to, or delete a **person** consumer (MCP can only list / read them) | **AI › Consumers** |
| Type, set, remove or read a **secret value** (an agent's secrets, a site's secrets) | **AI › Agents** › the agent › **Secrets** card; **API › Api Keys** › the key › **Secrets** card |
| **Start** a site after `create_api_key` / `rotate_api_key` (the hold) | **API › Api Keys** › the key › **Application** card › Start |
| Import / export | the console's Import / Export pages (people only) |
| The flow / script **debugger** (switch, kill connections, debug tickets) | **System › Debugger** (owner / admin); a ticket needs a person's console login (`testing.md` §7) |
| Unblock a sign-in after the 24-hour code block | the MCP account's page › **Unblock** (owner / admin) |
| Force-unlock a record | nobody: wait for the lock to expire |
| Organisation settings (debugger switch, MFA policy) | **System** / **Organization** pages, owner / admin |

Console detail: `../Administration/SKILL.md` and its `references/`.
