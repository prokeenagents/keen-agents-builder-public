---
name: keen-mcp
description: Keen 15.3 — How the builder works with the Keen platform itself — connecting to the Keen MCP server and signing in with an MCP account (the owner's code, read-only sessions), every MCP tool and what it needs, the golden path from an empty organisation to a test chat, validating a project with keen-validate, uploading it with keen-deploy, and testing the agent with the runner (run.ts) — the trace, the consumer token, the agent's Log Record, the common failures. Use this skill whenever you must create or change anything on a Keen platform, deploy a project, run or test an agent, read why a run failed, or when the person mentions MCP, a sandbox URL, keen-validate, keen-deploy, run.ts, a deployment token, an MCP account or MCP consumer, "deploy it", "test it", "it doesn't answer" — even if they never say "MCP".
---

# Keen MCP — provision, validate, deploy, test

> **Keen 15.3.** This skill describes Keen 15.3 in full — it is the baseline. A later release (15.4, …) gets an
> additions-only skill with just what changed; read this one first, then the additions for the platform's version.

You build an agent in files; it runs from the platform's **deployed** copy. Four tools take it there:

| Tool | What it does | Where | File |
|---|---|---|---|
| **The Keen MCP server** | creates and changes the platform's records (spaces, agents, the API chain, MCP consumers, caches, logs) — provisioning, not chatting | `https://<host>/mcp` | `connect.md`, `tools.md` |
| **keen-validate** | checks the project before a deploy — `0 error(s)` = clear to deploy | `bin/keen-validate-<os>-<arch>` | `validator.md` |
| **keen-deploy** | uploads the project to its space; the platform answers `deployed` / `rejected` at once | `bin/keen-deploy-<os>-<arch>` | `uploader.md` |
| **run.ts** (the runner) | chats with the deployed agent and prints the trace: the live stream and every node's request → response | `agent-runner/` | `testing.md` |

The whole setup, step by step, from an empty organisation to a test chat: `golden-path.md`.

## Start every session like this

1. **Read `keen-project.json`** — the workspace file (`../ProjectSetup/keen-project.md`): the current folder, then
   its parents; not found → ask the person where it is. Its `server` is the Keen; every URL follows from that host
   (`connect.md` §1). Ask "What is the address of your Keen?" only when the file is missing or `server` is a placeholder.
2. **Connect** the MCP server to your client once (`connect.md` §3).
3. **Sign in** with `mcp_login { id: mcp_id, secret: mcp_secret }` — read both from `keen-project.json`, never from
   the chat, never printed. If it answers that the owner's code is needed, ask the
   person for the 6-digit code and call `mcp_login_verify { code }`; never store or repeat the code. **"Logged in
   READ-ONLY"** means no owner can confirm: reads work, every write is refused — tell the person why
   (`connect.md` §5–6).

## The build loop

```
edit → keen-validate → keen-deploy → npx tsx run.ts --prompt "…" --json → read the trace → fix → …
```

- Install the two binaries once: copy the pair for the machine from `bin/` onto the PATH as `keen-validate` and
  `keen-deploy` (`validator.md` §1). The runner needs `cd agent-runner && npm install` once and a `.env` made from
  `.env.example`.
- **Never deploy what did not validate.** A project that validates can still be refused by the deploy in a few cases
  (`validator.md` §6) — read the refusal; it names the file and the rule.
- The MCP consumer's token lives 10 minutes; refresh it through MCP before a test session (`testing.md` §5).
- When a run fails, read the trace first, then the agent's Log Record (`testing.md` §6–8).

## Rules

- **Secrets:** a value MCP answers once (a client secret, an API key secret, an MCP consumer secret, the certificate
  key you chose) goes straight into the git-ignored env file it belongs in and is never repeated in the chat. Never
  ask the person to paste a secret into the chat; secrets the person types (an agent's or a site's **Secrets**) are
  typed in the console.
- **Lock, change, unlock:** every update / delete needs `lock_record` first and `unlock_record` after
  (`tools.md`, "Record locks").
- **Confirm destructive tools** with the person first (`delete_*`, `rotate_*`, `reset_space_deployment_token`,
  `set_api_key_enabled`, `set_api_key_site`) and say what stops at once. Confirm also before
  `set_mcp_consumer_enabled false` (not marked destructive, but it revokes the consumer's tokens at once) and before
  re-pointing a binding of a live api key (`update_api_key`, or `update_webhook` with a new origin): either ends every
  token of that key, like a rotate (`tools.md`, "API keys").
- **What MCP cannot do** — accounts, roles, MCP accounts, typing secret values, import / export, the debugger, pressing
  **Start** on a held site — you tell the person the exact console steps. The console, segment by segment:
  `../Administration/SKILL.md`.
- **Never run keen-deploy against a space the person did not name** — it replaces that space's deployed project.

## Related skills

- The project layout keen-validate expects: `../ProjectStructure/SKILL.md`.
- Writing flows and nodes: `../Flow/Nodes/SKILL.md`; tools: `../Flow/Tools/SKILL.md`.
- The console and what each change does to running agents and sites: `../Administration/SKILL.md`.
