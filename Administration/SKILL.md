---
name: keen-administration
description: Keen 15.3 — How the Keen organisation console works, segment by segment — what each one is for, who may use it (rights), why and where MFA is required, what the builder can do itself through MCP and what it must tell its person to do in the console, how to create, change and delete each record, what each change does to running agents, chats and partner sites, and how secrets and credentials are handled. Use this skill whenever the person needs something set up, changed or checked on the Keen platform — a space, an agent, its settings or secrets, an API key, a partner site, a contract, a webhook, a client, a certificate, consumers, MCP accounts or MCP consumers, roles, accounts, logs, Log Records, caches or the debugger — or asks "where do I …", "why can't I …", "who can …", "how do I give access …", "why does the site still see the old …", even if they never say "console" or "admin".
---

# Keen administration

> **Keen 15.3.** This skill describes Keen 15.3 in full — it is the baseline. A later release (15.4, …) gets an
> additions-only skill with just what changed; read this one first, then the additions for the platform's version.

The organisation console is where people set up and run everything around an agent. You reach part of it yourself
through MCP (with an MCP account); for the rest you **instruct your person** — the exact section, page, button and
words. Every segment has its own file; read it before you act or advise.

## The map

| Console section › segment | What it is for | Through MCP | File |
|---|---|---|---|
| Organization › **Accounts** | the people of the organisation: invite, role, block, reset | no | `Organization/Accounts/accounts-skill.md` |
| Organization › **My Account** | the signed-in person's own password and two-step sign-in | no | `Organization/Account/account-skill.md` |
| Organization › **Roles** | what each role may read and write | no | `Organization/Roles/roles-skill.md` |
| Organization › **MCP Accounts** | the identity YOU use to reach Keen through MCP | no | `Organization/MCP Accounts/mcp-accounts-skill.md` |
| AI › **Spaces** | where agents are deployed; the deployment token | yes | `AI/Spaces/spaces-skill.md` |
| AI › **Agents** | an agent, its Json / Front Settings and its Secrets | partly | `AI/Agents/agents-skill.md` |
| AI › **Consumers** | the end users who chat through a partner site | read only | `AI/Consumers/consumers-skill.md` |
| AI › **MCP Consumers** | test identities you create to chat with an agent | yes | `AI/MCP Consumers/mcp-consumers-skill.md` |
| API › **API Keys** | a partner site's credential and control: Site, instances, application Secrets | partly | `API/API Keys/api-keys-skill.md` |
| API › **Contracts** | which spaces a site's end users may use, and the sign-up policy | yes | `API/Contracts/contracts-skill.md` |
| API › **Webhooks** | the partner site's origin and the address Keen notifies | yes | `API/Webhooks/webhooks-skill.md` |
| API › **Clients** | a partner's client id + secret | yes | `API/Clients/clients-skill.md` |
| API › **Certificates** | the signing certificate of a partner's tokens | yes | `API/Certificates/certificates-skill.md` |
| System › **Logs** | log channels, the audit of who did what, log files | yes | `System/Logs/logs-skill.md` |
| System › **Log Records** | an agent's own log, the place to debug a flow | yes | `System/Log Records/log-records-skill.md` |
| System › **Cache** | the platform's served copies of configuration | yes | `System/Cache/cache-skill.md` |
| System › **Debugger** | attaching VS Code to the flow and script debuggers | no | `System/Debugger/debugger-skill.md` |

## What every segment shares (read once)

| Topic | File |
|---|---|
| Signing in, activation, password reset, two-step sign-in (MFA), the idle lock, the sign-in block, **the MFA gate** and why it exists, how an MCP account signs in | `references/sign-in-and-mfa.md` |
| Roles, the 12 scopes (Read / Write), the protected roles, extra gates, what a person without a right sees | `references/rights.md` |
| Record locks: Lock / Extend / Unlock, another person's lock, the refusal words | `references/record-locks.md` |
| Import / Export: which kinds, what is carried and what never is | `references/import-export.md` |
| Every secret and credential: where it is typed or shown, who reads it, how it is replaced | `references/secrets-and-credentials.md` |
| How each change reaches what is already running | `references/delivering-changes.md` |
| Which segments MCP reaches, segment by segment | `references/mcp.md` (sign-in and every tool: `../MCP/SKILL.md`) |

## Rules for you

- **Never ask the person to paste a secret into the chat.** Tell them where to type it (an agent's **Secrets** card, an
  API key's **Secrets** card). A secret an MCP tool answers once goes straight into the git-ignored env file it belongs
  in and is never repeated.
- **Lock, change, unlock.** Every change through MCP needs `lock_record` first and `unlock_record` after; creates need
  none. If someone else holds the record, tell the person who and until when — never retry in a loop.
- **Confirm before anything destructive** (`delete_*`, `rotate_*`, a reset of a deployment token, Disable of a key):
  say what stops at once (open chats, the partner site, issued tokens) and wait for a yes.
- **Writes need MFA.** A person without two-step sign-in, or an MCP session its owner did not confirm, is read-only.
- **Name the console exactly** — section › page › button, in the console's own words (bold in every file).
- **After a change, ask what must move.** Most changes reach running agents by themselves; some need a button
  (**Rebuild and refresh data**, **Save and restart**, **Start**). The table is in `references/delivering-changes.md`.

## Three facts that are easy to get wrong

1. **Two kinds of secrets a person types.** An agent's **Secrets** go to the script engine: the agent project's
   services use them (a tool reads one with `system/secrets` from the next Script node and hands it to its
   `service.js`, which assembles the connection with `connector.js`). An API key's application **Secrets** go to the
   partner site: they are put into its process environment and the site's own server code (its API routes) uses
   them; the site restarts to take them (**Save** = at the next start, **Save and restart** = now). Everything else
   secret is issued by Keen, shown once, and replaced by Rotate / Reset.
2. **Settings hold plain values only.** Json Settings and Front Settings carry switches and labels such as
   `{ "service_available": true, "service_title": "My Service" }` — never a key. The scripts turn a service on or
   off from Json Settings (from the next Script node); the partner site turns its connector on or off from Front
   Settings, and **Front Settings do not reach the site by themselves**: after a save, press **Rebuild and refresh
   data** on the site's API key (MCP `wake_api_key`) — a restart of the site also re-reads them.
3. **A new or rotated API key's site waits for a person.** After Create or Rotate the site shows **Waiting for start**
   until someone presses **Start** in the console.

## Setting up a new agent end to end

The order (space → agent → certificate → client → contract → webhook → API key with its four bindings → **Rebuild and
refresh data** → MCP consumer → its token → validate → deploy → test) with every step's tool and the console steps the
person does: `../MCP/golden-path.md`. The records one partner site needs, and in which order: the API Keys file,
section "One partner site".
