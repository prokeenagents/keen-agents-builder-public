# Roles

## Description

A role is a named set of rights. Every person (Accounts) and every MCP account holds exactly one role. A role has a
**Title**, a **Slug** made from it (lower case, spaces and punctuation become `_`: "Support Team" → `support_team`),
and a **Permissions** board: for each of the 12 grantable scopes, four switches — **Read**, **Write**, **Import**,
**Export** (each on or off).

The person needs this page when:

- your MCP account needs a role made for building (or one more scope) — a tool answered `Forbidden`;
- a colleague needs narrower or wider rights than the built-in roles;
- your MCP account's owner must cover your role (the owner's role must be at least as wide as yours);
- a custom role is no longer used.

Related: [Accounts](../Accounts/accounts-skill.md) and [MCP Accounts](../MCP%20Accounts/mcp-accounts-skill.md) pick a
role; the scope letters are explained in [rights.md](../../references/rights.md).

### The board

| # | Scope (board title) | Letters | Read lets | Write lets | Import / Export |
|---|---|---|---|---|---|
| 1 | **Consumers** | `cs` | view consumers | create, edit, delete consumers, assign contracts | yes |
| 2 | **Spaces** | `sp` | view spaces | create, edit, delete spaces; read or reset their deployment tokens | yes |
| 3 | **Agents** | `ag` | view agents and settings | create, edit, delete agents | yes |
| 4 | **API Keys** | `ak` | view keys and bindings | create, rotate, revoke keys | Not used |
| 5 | **Clients** | `ct` | view clients | create, rotate, delete client id / secret pairs | yes |
| 6 | **Certificates** | `ca` | view certificates | generate, rotate, delete certificate pairs | Not used |
| 7 | **Contracts** | `co` | view contracts, spaces, policies | create, edit, delete contracts and assignments | yes |
| 8 | **Webhooks** | `wk` | view webhook records | create, edit, delete them | yes |
| 9 | **Cache** | `ce` | view cache status | create or invalidate caches | Not used |
| 10 | **Logs** | `l` | view logs | enable / disable log channels, reveal a log stream token | Not used |
| 11 | **MCP Consumers** | `mcc` | view them | create, assign, enable / disable, rotate, delete them | Not used |
| 12 | **Debugger** | `dg` | attach the flow and script debuggers | Not used | Not used |

Rules: Write needs Read; Import and Export each need Write; turning Read off clears Write, turning Write off clears
Import and Export ("Read lets the role open the section; Write lets it make changes and needs Read first. Turning Read
off clears Write too. Import and Export let the role move the section's records in and out as files; each needs
Write."). Accounts, Roles and MCP Accounts are **not** on the board: they belong to the owner and admins only.

### The four built-in roles

| Role | Board | Title | Delete |
|---|---|---|---|
| `owner` | held by the role — reaches everything | locked | never |
| `admin` (Administrator) | held by the role — reaches everything | locked | never |
| `developer` | editable | locked | never |
| `default` | read-only (all off) | locked | never — it is where accounts land when their role is deleted |

## Who may

- **Only the owner and administrators, as persons.** Reads included (the `r` scope is never grantable; an MCP token is
  refused). Anyone else does not see the section.
- `owner`, `admin` and `default` cannot be locked or edited (`Not allowed!` on **Lock**); `developer` keeps its title.
- A title may not be or contain `admin`, `owner`, `developer` or `default` (any case).

## MFA

Every change — create, Save, Delete, Lock, import, export — needs the acting person's two-step sign-in (**Turn on
two-factor sign-in first** / `MFA required!`). **Why:** a role decides what every holder can do; with only a stolen
password someone could widen a role they or a planted account hold. Note: a person or MCP account without two-step
sign-in cannot write at all, whatever the role says.

## Through MCP

**Reachable through MCP: no.** There is no roles tool: you cannot read your own role. Learn what you lack from the
refusals: `Forbidden` = your role misses that scope's position (Read for a list / get, Write for a change, Import /
Export for files). Tell the person which scope and position you need.

**Not through MCP — tell the person** (sidebar **Organization › Roles**):

| Need | Console steps |
|---|---|
| A new role | **Roles › Create Role** → **Title**, tick the board → **Create** → open it and check the board |
| Add a right | open the role → **Lock** → switch the scope's Read / Write → **Save** |
| See who holds what | **Role List** (Title, Slug, ID, Created) |
| Remove a role | open the role → **Lock** → **Danger zone › Delete role** |

## Create

Path: **Organization › Roles › Create Role** (or the list's **New role**). No lock needed.

| Field | Required | Limits | Note |
|---|---|---|---|
| **Title** | yes | the console allows up to 60 characters; unique; not / not containing `admin`, `owner`, `developer`, `default` | "The slug is derived from the title." |
| **Permissions** | no | the board's rules | may be ticked now or later |

Refusals: `Title is required` · `Title must be at most 60 characters` · `Title cannot be or include "admin" or "owner"
or "developer" or "default"` (form) · `title cannot be or include "admin", "owner", "developer" or "default"` ·
`Not Acceptable` (the title or slug is taken) · `Invalid permissions!` · `MFA required!`.

**Right after:** toast `Role "<title>" created`, the role's page opens. The console saves a board ticked on the create
page as a second step; **tell the person to look at the board once** — if it is empty or a refusal shows, **Lock**,
tick again, **Save**.

## Change

Needs the record lock — see [record-locks.md](../../references/record-locks.md) (**Lock** in the banner).
Edit the **Title** (not on the four built-ins) and the board; **Save** sends the whole board. Refusals:
`Invalid permissions!` (a broken rule) · `Not Acceptable` · `Reserve the record first!` · `Locked by … until …!`.

Renaming changes the slug; accounts and MCP accounts follow automatically.

**How the change reaches what runs:** "Saving signs out everyone who holds this role." Every person holding it is
signed out at once and gets the new rights at the next sign-in; **every MCP account holding it — you included — loses
its session within about a minute** and must `mcp_login` again. A narrower role can also make an owner stop
**covering** an MCP account (that MCP account then signs in read-only). Saving with nothing changed signs nobody out.
Running agents, keys and partner sites are not affected. See
[delivering-changes.md](../../references/delivering-changes.md).

## Delete

Custom roles only. Role → **Lock** → **Danger zone › Delete role** → "Delete the role "{title}"? Its accounts — human and
MCP — move to "default" and the people are signed out." Toast `Role "<title>" deleted — its accounts moved to
"default"`. Every holder's session ends; an MCP account on `default` can do nothing useful (and its owner may stop
covering it). It cannot be undone.

## Import / Export

Supported (owner / admin, with two-step sign-in), see [import-export.md](../../references/import-export.md).
Carried: title, slug and the full board. Matched by slug. `owner`, `admin` and `default` are never written by an
import; nothing secret is in a role.

## Mistakes that break it

| Mistake | What happens | Do instead |
|---|---|---|
| Write without Read | refused `Invalid permissions!` (the board clears it anyway) | Read first |
| Import / Export on API Keys, Certificates, Cache, Logs, MCP Consumers | `Invalid permissions!` | only the six exchangeable scopes |
| Editing your MCP account's role while you work | your session ends | finish, then edit; sign in again |
| Narrowing the role of an MCP account's owner | that MCP account turns read-only | keep the owner's role at least as wide |
| Deleting the role your MCP account holds | you move to `default`: everything `Forbidden` | assign another role first |
| Title with "admin" in it (e.g. "Sysadmin") | refused | another word |
| Ticking the board on Create and not checking | the role may exist with nothing granted | open the role after Create |

## Example

Goal: you got `Forbidden` on `create_mcp_consumer`.

1. Tell the person: "My role lacks Write on **MCP Consumers**. Open **Organization › Roles**, open the role of my MCP
   account (it is shown on **MCP Accounts › <my account>**), press **Lock**, switch **MCP Consumers** Read and Write on,
   **Save**, then **Unlock**."
2. Warn them: "Saving signs out everyone with this role, and my session ends too."
3. When they say it is done: `mcp_login` again (ask for the owner's code on "Step 2 of 2"), then retry
   `create_mcp_consumer`.
