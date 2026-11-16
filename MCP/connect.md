# Connect to the Keen MCP server and sign in

The Keen MCP server is how you configure an organisation without the console: spaces, agents, the API chain a
partner site needs, MCP consumers, caches and Log records. You act as an **MCP account** that a person created
for you. This file covers the host, the endpoint, adding the server to your client, the account, the sign-in
and every refusal you can meet before a tool works.

## 1. The first question: which Keen?

Before anything else, find and read `keen-project.json` (`../ProjectSetup/keen-project.md`): its `server`
(`https://keen.example.com`) is the Keen. Only when the file is missing or `server` is still a placeholder, ask the
person one plain question — **"What is the address of your Keen?"** — and have the answer written into the file. Do
not ask about modes, ports or endpoints. Everything derives from the host (e.g. `keen.example.com`). Treat it as live
and confirm before any destructive tool.

| | Derived from the host |
|---|---|
| Keen host (`KEEN_HOST`, bare) | `<host>` (no scheme, no path) — the host of `server` |
| MCP endpoint | `https://<host>/mcp` |
| Chat WebSocket (runner, derived) | `wss://<host>/ws-keen` |
| Deploy endpoint (derived) | `https://<host>/ms/deploy` |

## 2. The endpoint and the transport

| | |
|---|---|
| Endpoint | `https://<host>/mcp` — the same host as the console (nginx sends exactly `/mcp` to the server) |
| Transport | MCP **Streamable HTTP**, **stateful**: your client's `initialize` opens a session (`mcp-session-id` header); the session holds your sign-in |
| Methods | `POST` (JSON-RPC messages), `GET` (the server-to-client stream), `DELETE` (ends the session) |
| Body limit | 4 MB per request |
| Resources (read-only) | `spaces://list` (sp1), `api-keys://list` (ak1), `consumer-contracts://list` (co1), `consumers://list` (cs1, first page), `logs://settings` (l1) |

**Health.** The server itself answers `GET /healthz` (alive) and `GET /readyz` (alive and connected to the
platform's internal bus; 503 `waiting` otherwise), but nginx does not route them to it: on the public host
`https://<host>/healthz` is nginx's own `ok`. From outside, the real check is a working `initialize` plus a
tool call. A platform that is up but busy shows as a per-call 503.

## 3. Add the server to your MCP client

**Claude Code** (syntax checked with `claude mcp add --help`):

```bash
claude mcp add --transport http keen https://<host>/mcp
# scope: --scope local (default) | user | project  (project writes .mcp.json in the folder)
```

- Do this at the very start, right after reading `keen-project.json` (`../ProjectSetup/keen-project.md` §1): check
  `claude mcp list` for a server whose URL is `<server>/mcp`; add it when missing; when one named `keen` points to
  another URL, `claude mcp remove keen` and add it again.
- A server added or changed during a session is loaded only when a session starts: its tools (`mcp_login` …) are not
  there yet. Ask the person once to restart Claude Code in the same folder (or connect it from `/mcp`), then sign in.
  The default `local` scope keeps it for this folder on this machine; `--scope project` writes `.mcp.json` (only the
  URL, no secret) so everyone who opens the workspace gets it.

**Another MCP client:** any client that speaks Streamable HTTP works. Give it the URL `https://<host>/mcp`. No
header or OAuth is needed: the sign-in is a tool call (`mcp_login`), not an HTTP credential.

## 4. The MCP account

You always act as an **MCP account**. Only a person can create one, in the console:
**Organization › MCP Accounts** (owner or admin). See `../Administration/Organization/MCP Accounts/mcp-accounts-skill.md`.

| Part | What it means for you |
|---|---|
| **ID** | public; the person types it into `keen-project.json` as `mcp_id`; you pass it to `mcp_login` |
| **Secret** | shown to the person **once**, at create or after Rotate secret. The person types it into `keen-project.json` as `mcp_secret` themselves (never into the chat); it lives only there — not in the project's `.env`; never echo it |
| **Role** | the same roles people have. Its scopes decide every tool you may call (`sp1` = spaces read, `sp2` = spaces write, …). A full build needs write on spaces, agents, clients, certificates (`ca2`), webhooks, contracts, api keys, MCP consumers, and cache / logs as needed. An MCP account is never `owner` or `admin` (the platform refuses both), so the person gives it a custom role with exactly these scopes |
| **Enabled** | off = you cannot sign in |
| **Owner** | a person with two-step sign-in whose role covers the account's role. Without a ready owner you are READ-ONLY (section 6) |

No tool creates, changes or reads MCP accounts, people's accounts or roles. Your role, your owner and your
secret are changed only by a person in the console. A change to your role, secret or Enabled switch ends your
login; sign in again.

## 5. Signing in

1. `mcp_login { id: mcp_id, secret: mcp_secret }`, both read from `keen-project.json`. Three answers:
   - **"Step 2 of 2"** — the account has a ready owner. The reply names the owner masked (`p•••@example.com`) and
     the method. Ask the person in the chat: "Enter the 6-digit code from <owner>'s authenticator app", or
     "Enter the code e-mailed to <owner>" (the platform has already mailed it).
   - **"Logged in as MCP account <id>."** — signed in (this happens only when the platform answers a confirmed token at once).
   - **"Logged in READ-ONLY …"** — no ready owner; see section 6.
2. `mcp_login_verify { code }` with exactly the six digits the person typed. Success: "Logged in as MCP account
   <id> (confirmed by its owner)."
   - "The code was not accepted" — ask for a fresh code and try again. After **4** wrong codes the sign-in ends:
     start again with `mcp_login`.
   - The code is good for **5 minutes**. A waiting sign-in ends after 5 minutes idle.
3. `mcp_login_resend` — only for an e-mail owner: mails a new code, at least **60 s** apart, at most **3** times.
   For an authenticator owner it answers that nothing is mailed.
4. `logout` — revokes the session's token on the platform (and drops a sign-in waiting for its code).

**Never** write the owner's code anywhere: not in `.env`, `keen-project.json`, a project file, a draft or a message back. Never call
`mcp_login` again just to "get another code": that cancels the waiting sign-in.

The code is asked **once per MCP session**. Your access token lives 60 seconds and the server renews it by
itself (at about 80 % of its life); you do nothing. You need a new sign-in (and a new code) after `logout`, an
expired or replaced session, a restart of your client or of the server, or a change to the owner (the next
renewal is refused and the next tool answers 401).

## 6. READ-ONLY sessions — and why

An account whose owner is missing, has no two-step sign-in, is blocked or not confirmed, or whose role no
longer covers the account's role, signs in at once but READ-ONLY. The reply names the reason. Reads work;
every change answers **403 `MFA required!`** with a note "This session is read-only …".

Why: on Keen nothing changes without a second factor. A person needs their own two-step sign-in to write; an
MCP account borrows its owner's. The owner's code proves a person agreed to this session.

What a READ-ONLY session cannot do (each needs a write scope or the owner's code): every create / update /
delete / assign / rotate / reset / enable, `lock_record` / `unlock_record`, `get_space_deployment_token` (sp2),
`reveal_log_token` (l2), `get_mcp_consumer_token`, `refresh_mcp_consumer_token`, `wake_api_key`. **Stop before any write**, tell the person
plainly, and do not retry. The fix is theirs: an owner or admin names an owner on **Organization › MCP Accounts
› the account › Owner**. Then `mcp_login` again (a read-only session never upgrades in place).

## 7. Sessions

| Rule | Value |
|---|---|
| Sessions per MCP account | **one**. A newer completed sign-in (after its code) of the same account, from any client, ends the older session |
| Idle limits | 2 min before `mcp_login` · 5 min while a sign-in waits for its code · 30 min signed in |
| Server capacity | 20 sessions in all; at most 4 not-signed-in sessions (a sign-in waiting for its code counts as one) and 30 `initialize` calls per minute per address. Over a cap, `initialize` answers HTTP 503 `Too many sessions!` (retry after ~30 s) or HTTP 429 `Too many attempts!` (the per-minute rate, retry after 60 s) |
| Server restart | ends every session (the server keeps sessions in memory) |

The 30-minute idle limit is the one you meet: after half an hour without a tool call the next call needs a new
sign-in and a new owner's code. Batch the MCP work of a task, and do not sign in long before you need it.

An ended session answers **HTTP 404** on the endpoint with its reason: `Session replaced: a newer mcp_login of
this MCP account took over…`, `Session expired after <n> idle…`, `Session ended to make room…`, or `Session
not found`. Start a new MCP session (your client reconnects), `mcp_login` again, and ask for the owner's code again.

## 8. Refusals and what to do

A tool that fails returns `isError` with `{ status, message }` (and `result.lock` on a reservation refusal).
Read it and act; never retry blindly.

| Answer | Meaning | What you do |
|---|---|---|
| **401** `Not authenticated — call the mcp_login tool first.` | no sign-in in this session | `mcp_login` |
| **401** after a working session (`Session revoked!` or similar) | the renewal was refused: owner changed, account changed, token revoked | `mcp_login` again; expect a new code or READ-ONLY |
| **403** `MFA required!` (+ the read-only note) | READ-ONLY session | stop; section 6 |
| **403** `Certificate write permission required!` | binding / removing a certificate, rotating a key that has one, or re-pointing such a key's webhook needs `ca2` | stop; ask the person for a role with certificates write |
| **403** `MCP accounts may not access this resource` / `Forbidden` | a scope your role lacks, or a human-only area | tell the person which scope is missing |
| **406** | refused request: validation, a duplicate name, a half-wired api key, a reservation refusal (`Reserve the record first!`, `Locked by <who> until <HH:MM>!`), a wrong sign-in (`Login failed (status 406) …`), a consumer-token refusal (uniform, never says which check) | read the words; fix the input; for locks see `tools.md` |
| **429** `Too many attempts!` | too many failed sign-ins: 5 wrong secrets per MCP account (10 per address) in 15 min → 15 min block; **20 wrong owner codes in 24 h → a 24-hour block** and the owner gets a mail; failed `get_mcp_consumer_token` attempts too; (as HTTP 429 on `initialize`: 30 per minute per address) | wait the time the reply names, retry once. For the 24-hour block STOP: tell the person the wait in hours and that an owner or admin can press **Unblock** on the MCP account's page |
| **400** | e.g. `set_api_key_site` on a key without site control, a held site, a stopped site's restart | read the words (see `tools.md`) |
| **404** in a tool reply | unknown id | check the id (record id vs slug) |
| **503** in a tool reply | the platform is not answering now | wait, retry |
| **503** `Too many sessions!` on `initialize` | the server is at its session cap, or your address already holds 4 sessions that are not signed in | close sessions you no longer use (your client's DELETE), wait ~30 s, reconnect |
| **HTTP 404** on the endpoint itself | your MCP session ended | section 7 |
| **HTTP 400** `no valid MCP session` | your client sent a message without a session | reconnect (send `initialize` first) |

Next: [`tools.md`](tools.md) (every tool) and [`golden-path.md`](golden-path.md) (the provisioning order).
