---
name: keen-project-setup
description: Keen 15.3 — How a Keen agent project is set up and started, end to end and in order — the first time (from the person's idea to a deployed agent answering a test chat: the questions to ask, the person's MCP account and two-step sign-in, the sign-in, the space, the agent, the API chain, the partner site and its public origin, the MCP consumer and its token, the project skeleton, the Secrets and Settings the person types, the runner's .env, validate, deploy, the first test chat) and every next time an existing project is opened (the files to check, a new sign-in, a fresh consumer token, is the site running, what changed since last time). Says who does each step (the builder through MCP, the builder on files, the person in the console, the person on their machine) and where every value comes from and which git-ignored file it goes to. Use this skill whenever the person wants to start, create, set up, bootstrap, resume, reopen or "continue" a Keen agent or project, says "I have an idea for an agent", "let's build an agent", "where do I start", "set it up", "open my project again", "it worked yesterday", asks which value goes where or what a .env needs — even if they never say "setup".
---

# Keen project setup — first time and every next start

> **Keen 15.3.** This skill describes Keen 15.3 in full — it is the baseline. A later release (15.4, …) gets an
> additions-only skill with just what changed; read this one first, then the additions for the platform's version.

This skill is the **order** and the **who does what**. Each step points to the skill that holds its detail — read
that file before you act. Two paths:

**Step 0 of both paths: find and read `keen-project.json`** — the workspace file at the top of the person's
workspace (the current folder, then its parents; not found → ask the person where it is; none → offer the template).
It is the one source of `server` (the Keen), `agent_project_dir` (the agent project's folder), `application` (the site's public address), `application_dir` (the site's
folder), `mcp_id` and `mcp_secret` (the builder's MCP account). Detail: `keen-project.md`.

## Path 1 — the first setup (details: `first-setup.md`)

1. **Ask first** — the space and agent names (the Keen and the site's address come from `keen-project.json`), what the agent must do, which external services,
   where the partner site is (or whether the person needs one yet). `first-setup.md` §1.
2. **The person's preconditions** — their own two-step sign-in, a builder role, an MCP account with an owner; they
   type its ID and secret into `keen-project.json` (`mcp_id`, `mcp_secret`) themselves. §2.
3. **Connect and sign in** — `mcp_login` → the owner's code → `mcp_login_verify`. §3, `../MCP/connect.md`.
4. **Space and agent** — `create_space`, `create_agent`. §4, `../MCP/golden-path.md` §1–2.
5. **The API chain** — certificate, client, contract (spaces + policy). §5, golden path §3–5.
6. **The partner site and its origin** — the site's folder, its `.env.local`, its public `https://` address. §6.
7. **API key + webhook, bound** — `create_api_key`, `create_webhook`, `update_api_key` with all four ids,
   `wake_api_key`; the person presses **Start**. §7, golden path §6–10.
8. **MCP consumer and its token** — `create_mcp_consumer`, `get_mcp_consumer_token`. §8, golden path §11–12.
9. **The project** — the skeleton, the `.env`, the flows, tools and services. §9, `../ProjectStructure/SKILL.md`.
10. **What the person types in the console** — the agent's Secrets; Settings switches. §10.
11. **Validate → deploy → first test chat → read the trace.** §11, `../MCP/testing.md`.
12. **Done** — the checklist. §12.

## Path 2 — every next start (details: `every-start.md`)

1. Check the files: `keen-project.json` (present, no placeholders, git-ignored), `.env` complete, `.vscode/keen.json`, `.gitignore`. §1.
2. Sign in again (a new MCP session = a new owner's code). §2.
3. Check the records still stand: space, agent, API key (`enabled`), the site (`get_api_key_site`). §3.
4. A fresh consumer token (`refresh_mcp_consumer_token`, else `get_mcp_consumer_token`). §4.
5. Ask what changed since last time and do what each change needs (a new site address, a rotated or disabled
   key, a role or owner change, a reset deployment token). §5.
6. The loop: edit → `keen-validate` → `keen-deploy` → `run.ts` → read → fix. §6.

Every value, its source, its file and who may see it: `values.md`.

## Who does what

| Who | Does | Never |
|---|---|---|
| **The builder through MCP** | sign-in, spaces, agents, Json / Front Settings, certificates, clients, contracts, webhooks, API keys, **Rebuild and refresh data** (`wake_api_key`), MCP consumers and their tokens, Log Records, reading secret NAMES | type or read a secret value; accounts, roles, MCP accounts; press **Start** on a held site; import / export; the debugger |
| **The builder on files** | reads `keen-project.json` first; the project skeleton, `src/` (flows, scripts, `keen-tools.json`), the project's `.env`, `.vscode/keen.json` (except the person's password), the site's `.env.local` — `KEEN_HOST` / `KEEN_ORIGIN` / `server` copied from `keen-project.json` | commit a git-ignored file; print a secret; edit the site's code unasked; write `mcp_id` / `mcp_secret` anywhere else |
| **The person in the console** | their two-step sign-in (**Organization › My Account**), the builder's role (**Roles**), the MCP account (**MCP Accounts**), the agent's **Secrets**, the API key's **Secrets**, **Start** on the **Application** card, **Download Site** (Home › Get started) | paste a secret into the chat |
| **The person on their machine** | the MCP account ID + secret into `keen-project.json`, the console password into `.vscode/keen.json`; the owner's 6-digit code in the chat; run the site, its tunnel and the tools when the builder has no shell there | — |

When the builder has a shell on the person's machine, it runs the commands itself (`npm install`, the site, the
tunnel, `keen-validate`, `keen-deploy`, `run.ts`); otherwise it gives the person the exact command and asks for the
line it needs back (a port, an address, `deployed`).

## Rules

- **One host.** Read `server` from `keen-project.json` first (ask only when the file is missing or the field is a
  placeholder); every URL follows from it (`../MCP/connect.md` §1). Work against that real host — never a local stack, never a switch that turns certificate checks off.
- **Never ask the person to paste a secret into the chat.** The MCP account ID + secret go into
  `keen-project.json` and the console password into `.vscode/keen.json`, by the person's own hand; the agent's and the API key's Secrets are typed on their
  console cards. The one thing typed into the chat is the owner's 6-digit code — never stored, never repeated.
- **A secret an MCP tool answers once goes straight into its git-ignored file** (`values.md` says which) and is
  never repeated in the chat, a draft, a commit or a log. A lost one is re-minted, not read again.
- **Two kinds of Secrets, two receivers.** The **agent's Secrets** go to the script engine: a tool reads one with
  `system/secrets` and hands it to its `service.js`. The **API key's Secrets** go to the partner site: they land in
  its process environment when the application starts or restarts, and its own server code (its API routes) uses
  them. `../Administration/references/secrets-and-credentials.md`.
- **Settings hold plain values only**, used as switches and labels, snake_case keys:
  `{ "service_available": true, "service_title": "My Service" }`. Json Settings reach the scripts from the next
  Script node; **Front Settings reach the site only after Rebuild and refresh data** (`wake_api_key`) or a restart
  of the site.
- **How a run works.** The chat client — the person's browser on the site, or the runner — coordinates the run;
  the platform runs one node per request. So the runner tests the same path a browser takes.
- **Lock, change, unlock** every update; **confirm** every destructive tool and say what stops at once
  (`../MCP/SKILL.md`, Rules).
- **Never deploy to a space the person did not name; never deploy what did not validate.**
- **After a change, ask what must move** — `../Administration/references/delivering-changes.md`.

## Related skills

- Platform tools and the golden path: `../MCP/SKILL.md`, `../MCP/golden-path.md`.
- The project's files: `../ProjectStructure/SKILL.md`. An external API: `../Services/SKILL.md`.
- The agent's design: `../AgentArchitecture/SKILL.md`, `../Flow/Nodes/SKILL.md`, `../Flow/Tools/SKILL.md`.
- The console, segment by segment: `../Administration/SKILL.md`.
