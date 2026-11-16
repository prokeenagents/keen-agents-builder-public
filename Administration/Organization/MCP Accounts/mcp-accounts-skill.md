# MCP Accounts

## Description

An MCP account is the login of an AI helper — **you, the builder** — inside one Keen organization. It has no e-mail
and no password: an **MCP Account ID** (public, never changes) plus an **MCP Secret** (43 characters, shown once).
It holds one **Role** (what you may see and change), an **Enabled** switch, and an **Owner**: a person in the
organization whose two-step code confirms each of your sessions. Every change you make is recorded in the audit
trail under the MCP account's name, like a teammate's.

The person needs this page when:

- you are being set up for the first time (they create your MCP account and give you its ID and secret);
- `mcp_login` answers `Logged in READ-ONLY` (no ready owner — they fix the **Owner**);
- a tool answers `Forbidden` (your role lacks the scope — they change the **Role**, or the role itself on **Roles**);
- the secret is lost or leaked (**Rotate secret**);
- `mcp_login` answers `Login failed (status 406): Not Acceptable` (wrong secret, disabled, deleted, or imported without
  a secret);
- `mcp_login` answers status 429 after many wrong owner codes (**Unblock** on the record).

Related: the role comes from [Roles](../Roles/roles-skill.md); the owner is a person on
[Accounts](../Accounts/accounts-skill.md) and sees "MCP accounts that ask your code" on
[My Account](../Account/account-skill.md); the test consumers you create are [MCP Consumers](../../AI/MCP%20Consumers/mcp-consumers-skill.md).
Shared mechanics: [mcp.md](../../references/mcp.md), [sign-in-and-mfa.md](../../references/sign-in-and-mfa.md).

## Who may

- **Only the owner and administrators, as persons, in the console.** Reads included. No role can grant it: the `mc`
  scope is never grantable (always `0000`). An MCP token is refused on every MCP-account route — you can never list,
  read, create or change MCP accounts, not even your own.
- Anyone else does not see the section; opening the page shows **You don't have access to this page**.
- **Role limits:** an MCP account can never hold `owner` or `admin` (refused `Not allowed!`). Any other role is allowed.
- **Who may be the Owner** — a person who is confirmed, not blocked, has two-step sign-in on, and whose role **covers**
  the MCP account's role: the `owner` and `admin` roles always cover; any other role must have, on every scope, Read,
  Write, Import and Export at least as high as the MCP account's role. You can never be more powerful than the person
  behind you.

## MFA

- **The person:** every change on this page — Create, Save, Change owner, Rotate secret, Delete, Lock, Unblock,
  import and export — needs the person's own two-step sign-in. Without it the console shows **Turn on two-factor sign-in
  first** and the wire answers `MFA required!`. Send them to [My Account](../Account/account-skill.md) › Security first.
- **You (the MCP account):** you have no factor of your own; the **owner's** factor guards you.
  - Owner ready → each sign-in asks the owner's 6-digit code once per session.
  - No ready owner (none, no two-step sign-in, blocked / not confirmed, role does not cover) → you sign in
    **read-only**: reads work; every write, lock, import, export and MCP-consumer token answers `MFA required!` with the
    note "This session is read-only: the MCP account's owner has not confirmed it (see `mcp_login`)."
- **Why:** the secret sits in a file on a machine. If it leaks, a stranger with only the secret cannot sign in without
  the owner's code, and cannot push your working session out (the takeover happens only after the code). Without an
  owner the worst a stolen secret does is read.

## Through MCP

**Reachable through MCP: partly** — the sign-in tools only. Managing MCP accounts is console-only.

| Tool | What it does | Needs |
|---|---|---|
| `mcp_login` | `{ id, secret }` → signs this MCP session in, or answers "Step 2 of 2" (the owner's code is due) | the ID + secret; Enabled; no 429 |
| `mcp_login_verify` | `{ code }` (6 digits) → completes the sign-in with the owner's code | a waiting `mcp_login` (≤ 5 min) |
| `mcp_login_resend` | mails the owner a new code | an e-mail owner; 60 s apart, at most 3 |
| `logout` | ends this session on the server (a waiting sign-in is dropped too) | — |

### The sign-in, step by step

1. Read the ID and secret from `mcp_id` / `mcp_secret` in the workspace's git-ignored `keen-project.json`
   (`../../../ProjectSetup/keen-project.md`). Never ask them to paste the secret into the chat, never print it, never
   write it into a draft.
2. Call `mcp_login { id: mcp_id, secret: mcp_secret }`. Three outcomes:
   - `Step 2 of 2: this MCP account's owner (p•••@…) must confirm…` → ask the person in ONE line: "Enter the 6-digit
     code from <masked owner>'s authenticator app", or "Enter the code e-mailed to <masked owner>". Then
     `mcp_login_verify { code }` with exactly what they typed. The code is single use, good for 5 minutes.
   - `Logged in as MCP account <id>.` → signed in, full rights of the role.
   - `Logged in READ-ONLY …` → reads only. Say so, stop before any write, and tell the person how to fix the owner
     (see the table below).
3. On `Logged in as MCP account <id> (confirmed by its owner).` you are in.

| Answer | Meaning | Do |
|---|---|---|
| `Login failed (status 406): Not Acceptable` | wrong ID / secret, the account is disabled or deleted, or it was imported without a secret | ask the person to check the account in the console (**Enabled**, an **Imported without a secret** alert); if the secret is lost → **Rotate secret** |
| `Login failed (status 429): Too many attempts! Wait …` | 5 wrong secrets per ID or 10 per address in 15 min, or 20 wrong owner codes in 24 h | wait; for the 24-h block an owner / admin presses **Unblock** on the record |
| `The code was not accepted. …` | wrong / expired code; the sign-in still waits | ask once more |
| `… has ended after 4 wrong codes. Call mcp_login again.` | the 4th wrong code burned the sign-in | start again at `mcp_login` |
| `Too many attempts! Wait …` (at verify) | the 24-h code budget is spent | as the 429 above |
| `This sign-in waits for a code from the owner's authenticator app — nothing is mailed.` | `mcp_login_resend` on an app owner | ask for the app's current code |
| `No sign-in is waiting for a code — call mcp_login first.` | the 5-minute window passed, or none started | `mcp_login` again |
| `Not authenticated — call the mcp_login tool first.` | your session was ended (see below) | `mcp_login` again |
| HTTP 404 `Session replaced: a newer mcp_login of this MCP account took over…` | someone completed a sign-in with the same account elsewhere | start a new MCP session; tell the person — if it was not them, rotate the secret |
| HTTP 404 `Session expired after <n> min idle…` | 30 min without a call (a waiting sign-in: 5 min) | start a new MCP session and sign in |

### Session facts

- **One session per MCP account.** A newer completed sign-in (after the code) ends the older one.
- Your access token lives 60 s and is renewed by the MCP server by itself — you never see a token.
- A restart of the MCP server ends every session: start a new one and sign in again.
- A change on the account's page ends your session within about a minute: the next tool answers with the refusal,
  then `Not authenticated — call the mcp_login tool first.` (see Change).

### Not through MCP — tell the person

| Need | Console steps |
|---|---|
| See / find MCP accounts | sidebar **Organization › MCP Accounts › MCP Account List** |
| Create one for you | **MCP Accounts › Create MCP Account** (see Create) |
| Fix "read-only" | open the account → **Lock** → **Change owner** → pick an eligible person → **Change owner** in the confirm |
| More rights | open the account → **Lock** → **Role** → **Save**; or change the role's board on **Roles** |
| Lost / leaked secret | open the account → **Danger zone › Rotate secret** → the person types the new **MCP Secret** into `keen-project.json` (`mcp_secret`) |
| Stop you at once | **Lock** → switch **Enabled** off → **Save** |
| Lift the 24-h code block | the **Sign-in blocked** alert on the record → **Unblock** |

## Create

Path: sidebar **Organization › MCP Accounts › Create MCP Account** (or the list's **New MCP account**).
The person needs two-step sign-in on. No lock is needed.

| Field | Required | Limits | Note |
|---|---|---|---|
| **Name** | yes | the console allows up to 100 characters; unique; **fixed forever** | "A label you will recognize later" — e.g. `omega-builder` |
| **Role** | yes | any role except `owner` / `admin` | pick a role made for the builder (below) |
| **Owner** | no | eligible people only; default "Me (<my e-mail>)" | "Its sign-ins ask this person's two-step code." |
| **Enabled** | — | on by default | "a disabled account cannot authenticate" |

Refusals (verbatim): `An MCP account with that name already exists!` · `No such role!` · `Not allowed!` (owner / admin
role) · `No such owner!` · `The owner has no MFA!` · `The owner's role does not cover this role!` · `MFA required!`.

A builder role usually reads and writes Spaces, Agents, API Keys, Clients, Certificates, Contracts, Webhooks, Cache and
MCP Consumers and Logs (Logs write: `create_log_record` and `reveal_log_token` need it), and reads Consumers. No
Debugger right: the debuggers sign in with a person's console login, never an MCP account. Build it on
[Roles](../Roles/roles-skill.md) first.

**Right after:** the form is replaced by **MCP secret — shown once** with **MCP Account ID** and **MCP Secret**, each with
a copy button. Tell the person to type both into the workspace's `keen-project.json` now — `mcp_id` and `mcp_secret` (never into
the chat), then press
**I have copied it — open the account**. The secret is never shown again; lost = **Rotate secret**.

## Change

Every change needs the record lock — see [record-locks.md](../../references/record-locks.md): the person presses
**Lock** in the banner (30 minutes, refreshed by every save), changes, saves, **Unlock**. You cannot lock this kind
through MCP.

| Action | Lock | What it does | What it stops at once |
|---|---|---|---|
| **Role** + **Save** | needed | new rights; the current owner's role must still cover it | your session (sign in again → the new role) |
| **Enabled** off + **Save** | needed | you cannot sign in or renew | your session |
| **Enabled** on + **Save** | needed | you may sign in again | nothing |
| **Change owner** (confirm "The MCP account's current session ends; the agent signs in again with <name>'s code.") | needed | new owner; both owners get a mail; "No owner" makes you read-only | your session; clears a code block |
| **Rotate secret** | not needed (refused only while someone else holds the lock) | new secret shown once; the old one dies | your session; clears a code block and the "Imported without a secret" state |
| **Unblock** (on **Sign-in blocked**) | not needed (as Rotate) | clears the wrong-code count | nothing |

The **Name** cannot change — a typo means delete and create again (new ID, new secret).

**Things that change you from outside this page:** the owner turning two-step sign-in off or having it reset, being
blocked, deleted, or moved to a role that no longer covers yours → your session ends and the next sign-in is
read-only (the record shows a **Read-only: …** alert). When the owner becomes eligible again you are ready again by
yourself. Saving your role's board on **Roles**, or deleting that role (you move to `default`), also ends your session.

**How the change reaches what runs:** immediately for you — every change above ends your current MCP session within
about a minute; sign in again to work under the new state. Nothing you built (spaces, agents, keys, MCP consumers)
stops. See [delivering-changes.md](../../references/delivering-changes.md).

## Delete

Record → **Lock** → **Danger zone › Delete MCP account** → confirm "Delete <name>? Its ID and secret stop working at
once; its MCP consumers keep working." Your session ends; everything you created stays. It cannot be undone — a new
account has a new ID and secret.

## Import / Export

Supported (owner / admin, with two-step sign-in), see [import-export.md](../../references/import-export.md).
Carried: name, role, enabled. Never carried: the secret (or its hash) and the owner. An import makes **the importing
person the owner** and creates the account **without a usable secret**: its record says **Imported without a secret —
Rotate to get one. The agent cannot sign in until then.**

## Mistakes that break it

| Mistake | What happens | Do instead |
|---|---|---|
| Secret pasted into the chat or a committed file | it may leak; with no owner a stranger can read the org | keep it in a git-ignored file; if it leaked → Rotate secret |
| No owner, or an owner without two-step sign-in | `Logged in READ-ONLY`; every write `MFA required!` | name an eligible owner |
| Owner's role narrower than yours | `The owner's role does not cover this role!` / read-only | pick an owner / admin owner, or widen the owner's role |
| Role too small | tools answer `Forbidden` | add the scope on Roles (Read for lists, Write for changes) |
| Same account used by two builders | each completed sign-in replaces the other (`Session replaced`) | one MCP account per builder |
| Guessing the owner's code | 4 wrong → sign-in ends; 20 in a day → 24-h block | always ask the person; never invent a code |
| Rotating while you work | your session ends, the old secret is dead | the person types the new secret into `keen-project.json`, then `mcp_login` |
| Leaving the reveal page before copying | the secret is gone | Rotate secret |

## Example

Goal: the person wants you to build an agent in their organization; nothing is set up yet.

1. Tell the person: "Open **My Account › Security** and turn on two-step sign-in if it is off."
2. Tell them: "Open **Roles › Create Role**, title `MCP Builder`, tick Read and Write on Spaces, Agents, API Keys,
   Clients, Certificates, Contracts, Webhooks, Cache, MCP Consumers and Logs, Read on Consumers, **Create**. Then open the
   role and check the board saved (if not: **Lock**, tick again, **Save**)."
3. Tell them: "Open **MCP Accounts › Create MCP Account**: Name `my-builder`, Role `MCP Builder`, Owner = you,
   Enabled on, **Create**. Copy **MCP Account ID** and **MCP Secret** into `keen-project.json` as `mcp_id` and
   `mcp_secret` (the file is git-ignored), then **I have copied it — open the account**."
4. Point the MCP client at `<server>/mcp` (`server` from `keen-project.json`); call
   `mcp_login { id: mcp_id, secret: mcp_secret }` from the file.
5. "Step 2 of 2" → ask: "Enter the 6-digit code from p•••@…'s authenticator app." → `mcp_login_verify { code }`.
6. `Logged in as MCP account … (confirmed by its owner).` → call `list_spaces` to confirm the role works.
