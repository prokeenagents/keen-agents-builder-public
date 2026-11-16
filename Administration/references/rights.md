# Rights — roles, scopes and who may do what

Every person and every MCP account holds exactly ONE role. The role decides WHAT they may do; the record lock decides
WHEN (see `record-locks.md`); MFA decides whether they may change anything at all (see `sign-in-and-mfa.md` §8).
Every check runs on the server again — hiding a button is never the protection.

## 1. The model

- A role = a title + per scope four switches: **Read**, **Write**, **Import**, **Export**. The console edits them on
  **Roles** › the role › **Role & Permissions** (the permissions board).
- A right is written as the scope's letters + the position: `sp1` = Spaces Read, `sp2` = Spaces Write, `sp3` = Import,
  `sp4` = Export. Segment files use these short forms.
- **Write needs Read.** **Import and Export each need Write.** The board's rule line: "Read lets the role open the section;
  Write lets it make changes and needs Read first. Turning Read off clears Write too. Import and Export let the role move
  the section's records in and out as files; each needs Write."
- Each switch is on or off (0 / 1). A position a scope does not use shows a dash **Not used**.

## 2. The 12 grantable scopes

| # | Board row | Letters | Read / Write | Import / Export |
|---|---|---|---|---|
| 1 | **Consumers** | `cs` | yes | yes |
| 2 | **Spaces** | `sp` | yes | yes |
| 3 | **Agents** | `ag` | yes | yes |
| 4 | **API Keys** | `ak` | yes | Not used |
| 5 | **Clients** | `ct` | yes | yes |
| 6 | **Certificates** | `ca` | yes | Not used |
| 7 | **Contracts** | `co` | yes | yes |
| 8 | **Webhooks** | `wk` | yes | yes |
| 9 | **Cache** | `ce` | yes | Not used |
| 10 | **Logs** | `l` | yes | Not used |
| 11 | **MCP Consumers** | `mcc` | yes | Not used |
| 12 | **Debugger** | `dg` | Read only | Not used |

**Not grantable to any role:** Accounts, Roles, MCP Accounts (and the organisation switches). They belong to the owner and
admins BY ROLE — reads included. No custom role can ever open them.

## 3. Segment → scope → what Read opens → what Write opens

| Segment | Scope | Read opens | Write opens (also needs MFA) |
|---|---|---|---|
| Accounts | owner / admin | the list, a record | invite, change role, **Block account** / **Unblock account**, **Reset password**, **Reset MFA**, **Resend invitation**, sign-in **Unblock**, delete; **Require MFA for every account** = owner only |
| My Account | any signed-in person | own profile, role, status | own names, own reset mail, own MFA (no MFA needed to set up MFA) |
| Roles | owner / admin | the list, a role's board | create, rename, set permissions, delete |
| MCP Accounts | owner / admin | the list, a record | create (secret shown once), role, owner, enable / disable, rotate secret, sign-in **Unblock**, delete |
| Spaces | `sp` | spaces, their agents list | create, edit, delete, **reveal** the deployment token, reset the token |
| Agents | `ag` | agents, Json / Front settings, secret NAMES | create, edit, delete, settings, secrets |
| Consumers | `cs` | end users, their info | invite, reset password, spaces, contract, delete — people only (MCP reads only) |
| MCP Consumers | `mcc` | the list, a record | people: enable / disable, rotate, delete; MCP accounts also create and assign contract / spaces |
| API Keys | `ak` | keys, bindings, the site / instances view, secret NAMES | create, edit bindings, rotate, Refresh data, Start / Stop / Restart, Disable / Enable, secrets, delete |
| Contracts | `co` | contracts, policy, spaces | create, edit, policy, the three space lists, delete |
| Webhooks | `wk` | webhook records | create, edit, delete |
| Clients | `ct` | clients | create, rename, rotate, delete |
| Certificates | `ca` | certificates, public keys | create, edit, rotate, delete |
| Logs | `l` | channel switches, audit, log files | switch log channels on / off |
| Log Records | `l` | log records | create, edit, delete, **reveal** the stream token |
| Cache | `ce` | cache status | create, invalidate, rebuild an API key's cache |
| Debugger | `dg` (Read) | the status; **dg1 + MFA** attaches VS Code | — (the Debugger switch and Kill & Resume are owner / admin) |

Import / Export pages: the six scopes with Import / Export need `<letters>3` / `<letters>4`; Accounts, Roles and MCP Accounts
need owner / admin. See `import-export.md`.

## 4. Extra gates beyond the scope

| Gate | When | Refusal |
|---|---|---|
| MFA | every write / import / export / lock, the deployment-token and stream-token reveals, the debugger ticket | `MFA required!` |
| `ca2` (Certificates Write) on top of `ak2` | binding or removing a certificate on an API key, rotating a key that has one, re-pointing the webhook of such a key | `Certificate write permission required!` |
| A person, not an MCP account | Accounts, Roles, MCP Accounts, My Account, consumer writes, Import / Export, the debugger | `MCP accounts may not access this resource` / `Forbidden` |
| An MCP account, not a person | creating an MCP consumer, assigning its contract / spaces, minting its tokens | `Only MCP accounts may manage MCP consumers` |
| The record lock | most changes (see `record-locks.md`) | `Reserve the record first!` / `Locked by … until …!` |
| A started site | after Create or Rotate of an API key the site waits for a PERSON to press Start | — |

## 5. The four protected roles

| Role | Badge | What it may do | What nobody may do to it |
|---|---|---|---|
| **Owner** | **protected — read only** | Everything. Only one. The only one who switches **Require MFA for every account**, acts on admins, and resets the owner's password. Not listed to anyone else. | Delete, block, re-role, reset password / MFA, create another owner |
| **Administrator** (`admin`) | **protected — read only** | Everything except: the MFA policy, anything on the owner's account, and creating / re-roling / blocking / resetting / deleting another admin (owner only) | Edit its permissions or title; delete it |
| **Developer** | **protected — title locked** | Starts with NO permissions; owner / admin set its board | Rename or delete it |
| **Default** | **protected — read only** | Nothing (all off). Where accounts land when their role is deleted | Edit or delete it |

The owner and admins pass every scope check by role (the board shows **Held by the role, not by permissions**). They are
still bound by MFA and by record locks.

Custom roles: **Title** 1–60 characters, unique, may not be or contain admin / owner / developer / default
(**Title cannot be or include "admin" or "owner" or "developer" or "default"**). The new role starts with nothing — set
its switches on its page.

**Changing a role:** **Saving signs out everyone who holds this role.** **Delete role** → "Its accounts — human and MCP —
move to "default" and the people are signed out." Changing a person's role also signs them out. A role change takes
effect at the next sign-in.

Nobody changes their own role. No custom role can create, become or act on an owner or admin.

## 6. Two kinds of buttons on a record (the lock classes)

The console's code calls them class R and class A; the person sees them by their disabled reason.

| Class | Which actions | Needs | Disabled reason the person sees |
|---|---|---|---|
| R — "needs your lock" | Save on a form, Delete, Block / Unblock, a role change, bindings, policy, Disable / Enable, Rotate an API key, Start / Stop / Restart, settings, secrets | the person holds the record's lock | **Lock the record above to change this.** |
| A — "credential action" | Rotate (client, certificate, MCP account, MCP consumer), **Reset password**, **Reset MFA**, Resend invitation, reset the deployment token, Refresh data / Wake | only that nobody ELSE holds the record; it never takes or renews a lock | **Locked by {email} until {time}!** |

Details and the full per-kind list: `record-locks.md`.

## 7. What a person without a right sees

- No Read: the section is missing from the sidebar; a direct link shows **You don't have access to this page** — "Your role
  does not carry the required permission for this section. If you believe it should, ask an administrator to update your
  role's permissions — the change applies on your next sign-in."
- Read without Write: the pages open read-only — no lock banner, no Create entry, no Danger zone actions.
- Write without MFA: the screen **Turn on two-factor sign-in first** (see `sign-in-and-mfa.md` §8).
- A refused call that slipped through: `Forbidden` (403).

Tell the person exactly which switch to ask for: "ask an owner or admin to turn on **Spaces** › **Write** in your role".

## 8. How an MCP account's role limits YOU

- You hold the MCP account's role — never owner or admin. You can do only what its switches allow, and only within the
  segments that are open to MCP at all (§4). A refusal `Forbidden` = the switch is off: tell the person which one.
- Changes need a confirmed session (your owner's code, `sign-in-and-mfa.md` §9); otherwise you are read-only.
- Your owner's role must include every switch of your role (owner / admin owners cover everything). If not, you sign in
  read-only: "its owner's role does not cover the MCP account's role". Fix: give the owner's role those switches, or
  narrow the MCP account's role, or pick another owner (**MCP Accounts** › the account › **Owner** › **Change owner**).
- Changing the MCP account's role (by an owner / admin) ends your session: sign in again.
- A good builder role: Read + Write on the segments the work needs (Spaces, Agents, API Keys, Clients, Contracts,
  Webhooks, Cache, MCP Consumers), Read on Logs / Consumers — never more than the job needs.
