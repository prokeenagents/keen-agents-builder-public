# Spaces

## Description

A space is the room agents live in. It groups agents, holds the **deployment token** a deploy signs in with, and is
the unit a consumer contract grants to end users. Its **Space ID** is also the project id: the deploy client and the
chat clients name the space by it.

The person needs a space when:

- they start a new project — a space must exist before any deploy and before any agent;
- they want a separate place for a separate product or partner (contracts grant whole spaces);
- the deploy client asks for the Space ID and the deployment token (`.env` / `keen.json`);
- a deployment token leaked or a person who held it left — **Reset token**;
- a space is no longer used — delete it (its agents go with it).

Related: agents live in exactly one space ([Agents](../Agents/agents-skill.md)); a contract offers spaces to its
consumers ([Contracts](../../API/Contracts/contracts-skill.md)); consumers and MCP consumers are granted spaces out of
that offer ([Consumers](../Consumers/consumers-skill.md), [MCP Consumers](../MCP%20Consumers/mcp-consumers-skill.md)).

## Who may

| Right | Opens |
|---|---|
| `sp1` (Spaces · Read) | the landing, the list, every space record, the Assigned agents card |
| `sp2` (Spaces · Write) | **Create space**, **Save**, **Reveal** / Copy of the deployment token, **Reset token**, **Delete space**, Lock |
| `sp3` / `sp4` | Import / Export of spaces |
| `ce2` (Cache · Write) | **Rebuild resource cache** in the page header (independent of `sp2`) |
| `ag1` / `ag2` | the agent links / **New agent** in the Assigned agents card |

Owner and admin pass every gate. The deployment token is **write-only reading**: a reader with only `sp1` sees
"Available to roles that may write spaces." in its place. A person without `sp1` gets "You don't have access to this
page" and no sidebar row. See [rights](../../references/rights.md).

## MFA

Every write needs the person's two-factor sign-in: create, save, lock, Reset token, delete, import, export — **and
reading the deployment token** (it is an `sp2` read). Without it the console shows "Turn on two-factor sign-in first" /
"Changes, imports, exports and record locks need a second factor on this account." and a direct call answers
`MFA required!`. Why: the deployment token uploads code into the space. With only a stolen password, someone could
read it and deploy a script that sends every agent's secrets out, or delete the space with all its agents.
An MCP account is under the same rule: without its owner's code its session is read-only. See
[sign-in-and-mfa](../../references/sign-in-and-mfa.md).

## Through MCP

**Reachable through MCP: yes.**

| Tool | What it does | Needs |
|---|---|---|
| `list_spaces` | every space with its agents | `sp1` |
| `get_space` | one space with its agents (no token) | `sp1` |
| `create_space` | creates a space `{ title, description }`; the reply carries the new token | `sp2` + MFA |
| `update_space` | changes title and / or description | `sp2` + MFA + the space locked by you |
| `delete_space` | deletes the space and its agents | `sp2` + MFA + the space locked by you; ask the person first |
| `get_space_deployment_token` | reads the token | `sp2` + MFA |
| `reset_space_deployment_token` | re-mints the token; the old one stops at once | `sp2` + MFA; refused while another holds the space; ask first |
| `clear_spaces_cache` | rebuilds the platform's served copy of spaces and agents | `sp2` + MFA |
| `create_cache { resource: 'spaces' }` | the console's **Rebuild resource cache** | `ce2` + MFA |
| `lock_record` / `unlock_record` `{ kind: 'space', id }` | reserve / release the space | `sp2` + MFA |

**Not through MCP — tell the person:**

- **Import / Export of spaces** — console only (see Import / Export below).
- **Turn on two-factor sign-in** for a person who has none — My Account › Security
  ([sign-in-and-mfa](../../references/sign-in-and-mfa.md)).

The token is a credential. When the builder reads it with `get_space_deployment_token`, it writes it straight into the
project's `.env` (`KEEN_DEPLOY_TOKEN`) and never repeats it in the chat. When the person fetches it, tell them to open
the space, press **Reveal** (or Copy) on **Deployment token** and paste it into the `.env` file themselves — never into
the chat. See [secrets-and-credentials](../../references/secrets-and-credentials.md).

## Create

Console: **AI › Spaces › Create Space** (or **New space** on the Space List).

| Field | Required | Limits | Note |
|---|---|---|---|
| **Title** | yes | at most 150 characters, trimmed, unique across the platform | help: "Up to 150 characters, unique across the platform." |
| **Description** | yes | at most 500 characters | two spaces may share a description |

Press **Create space**. Refusals, verbatim:

- `Not Acceptable` — the title is already taken (the refusal is deliberately general; also a title or description over
  the limit sent through MCP).
- `Space limit reached — a maximum of 20 spaces is allowed!` — 20 spaces per organization; delete one first.
- Form words: `Title is required`, `Title must be at most 150 characters`, `Description is required`,
  `Description must be at most 500 characters`.

Right after: the toast `Space "<title>" created`, then the card **Deployment token — shown now** with the Space ID and
the token ("Copy this token now and hand it to the deploy client. It stays readable later on this space's page, but
only to roles that may write spaces."). **I have copied it — open the space** opens the record. A new space is not
reserved for its creator; it is empty (no agents) until agents are created and a project is deployed into it.

## Change

Record: **AI › Spaces › Space List › Open**. Lock the space first ([record-locks](../../references/record-locks.md)):
**Save** and **Delete space** need your lock (class R); **Reset token** only needs the space not held by someone else
(class A). While you hold the space, nobody else can change its agents or create one in it.

| Where | What it does |
|---|---|
| **Space Configuration** › Title / Description › **Save** | renames / re-describes; the Space ID never changes (copy it with **Copy Space ID**) |
| **Deployment token** › **Reveal** / **Copy deployment token** | fetches the token (`sp2` + MFA) |
| **Deployment token** › **Reset token** | confirm "Re-mint the deployment token of "<title>"? Every new deploy with the old token is refused from now on." → the new value shows once |
| **Assigned Agents** › **New agent** | opens Create Agent with this space chosen |
| header › **Rebuild resource cache** (`ce2`) | rebuilds the platform's served copy of spaces; the toast links the Cache page |

After an import the Deployment token card says "A new deployment token was minted on import — The source instance's
token is not valid here. Reveal or reset the token and update the project's .env / keen.json." It goes away after the
first Reveal / Copy or a Reset.

**How the change reaches what runs** ([delivering-changes](../../references/delivering-changes.md)):

- Title / description: inside the platform within seconds. Partner sites are **not** told: they see a new or renamed
  space after **Rebuild and refresh data** on their API key ([API Keys](../../API/API%20Keys/api-keys-skill.md)).
- **Reset token**: immediately. Every **new** deploy connection with the old token is refused
  (`Invalid deployment token or space id`); a deploy session already open runs out its short window (minutes). Running
  chats are not touched. Update `KEEN_DEPLOY_TOKEN` in the `.env` (and `keen.json` for the VS Code extension).
- Nothing about a space restarts a chat.

## Delete

Record › **Danger zone** › **Delete space** ("Deleting a space deletes every agent in it, with their Json and Front
settings. It cannot be undone."). The confirm names what goes: `Delete "<title>"? Its <n> agents go with it: <names>.`
(no agents: `Delete "<title>"?`). Toast `Space "<title>" deleted — its agents went with it`.

What goes with it, at once: every agent of the space, their Json / Front settings and Secrets, and the deployed project
files. Contracts stop offering the space; consumers granted it lose it. Chats with those agents fail from the next
request. Refused while another person holds the space, or holds **any of its agents** (Delete is disabled with
"<agent> is locked by <email> until <time> — the space cannot be deleted until it is released."). It cannot be undone:
the token, the Space ID and the agents' secrets cannot be brought back — an import later creates a new space with a new
ID and token.

## Import / Export

Supported (`sp3` import, `sp4` export, plus MFA): **AI › Spaces › Import / Export**. A space is matched by its
**title**. Carried: title, description. **Never carried: the deployment token** — the importing instance mints a new
one, shown to nobody until someone reveals or resets it. Import spaces before their agents. See
[import-export](../../references/import-export.md).

## Mistakes that break it

| Mistake | What happens | Do instead |
|---|---|---|
| Deploying with the Space ID of one space and the token of another | `Invalid deployment token or space id` | copy both from the same space record |
| Reset token while a pipeline / teammate still deploys with the old one | their next deploy is refused | reset, then update every `.env` / `keen.json` that holds it |
| Pasting the token into a chat, a ticket or a commit | anyone who sees it can deploy code to the space | keep it only in `.env` / `keen.json`; if leaked, **Reset token** |
| Deleting a space "to clean up" | every agent, setting, secret and deployed file in it is gone for good | export first if unsure; delete agents one by one instead |
| A 21st space | `Space limit reached — a maximum of 20 spaces is allowed!` | reuse or delete a space |
| Expecting a partner site to see a new space at once | the site keeps its old list | **Rebuild and refresh data** on its API key |
| Saving without a lock | `Reserve the record first!` | **Lock** first (or `lock_record`) |

## Example

Goal: the person starts a support assistant and needs a place to deploy it.

1. `list_spaces` — check that "Support" is free and that fewer than 20 spaces exist.
2. Ask the person to confirm the title and a one-line description, then `create_space { title: "Support",
   description: "Customer support assistant for the web shop." }`. Keep the reply's `id`.
3. Write `KEEN_SPACE_ID=<the id>` into the project's `.env`. Write the token from the create reply (or
   `get_space_deployment_token`) into `KEEN_DEPLOY_TOKEN` without printing it.
4. If the call answers `MFA required!`, tell the person: "Your MCP sign-in is read-only. Sign it in again and give me
   your 6-digit code" — or do it in the console: **AI › Spaces › Create Space**, type the title and description, press
   **Create space**, press **Copy deployment token**, paste it into the `.env` file, then press **I have copied it —
   open the space**.
5. Continue with [Agents](../Agents/agents-skill.md): create the agent in this space, deploy, test.
