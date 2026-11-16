# Record locks

One person (or one MCP account) edits a record at a time. Before a change the record is reserved with **Lock**; while it
is held, everyone else sees it read-only with the holder's name and the time the lock runs out. Roles decide WHO may
change a record; the lock decides WHEN. The owner and admins are bound by it like everyone else.

## 1. Which records lock

| Kind | Who may lock it | Through MCP (`lock_record` kind) |
|---|---|---|
| Accounts | owner / admin | — (people only) |
| MCP accounts | owner / admin | — |
| Roles (not owner / admin / default) | owner / admin | — |
| Spaces | `sp2` | `space` |
| Agents (their Json / Front settings and secrets ride the agent's lock) | `ag2` | `agent` |
| API keys | `ak2` | `api_key` |
| Clients | `ct2` | `client` |
| Certificates | `ca2` | `certificate` |
| Webhooks | `wk2` | `webhook` |
| Contracts (all three cards share one lock) | `co2` | `consumer_contract` |
| Consumers | `cs2`, people only | — |
| MCP consumers | `mcc2` | `mcp_consumer` |
| Log records | `l2` | `log_record` |

**Never locked** (last writer wins — they are switches): **My Account**, **Require MFA for every account**, the Debugger
switch and Kill & Resume, the log channel switches on **Logs**, the **Cache** page.

**Creating needs no lock**, and a new record is NOT locked for its creator — lock it before the first change.
Exception: a new agent needs its space not held by someone else.

LOCK itself needs the write right and MFA (`MFA required!` without it). Locking a record nobody may change — the owner's
account, your own account, the owner / admin / default roles — answers `Not allowed!`.

## 2. Lock, Extend, Unlock — the banner

The banner sits under the record's title. Its states:

| State | Banner line | Buttons |
|---|---|---|
| free | **Not locked** — "Lock the record to edit it — the form is read-only until you do." | **Lock** |
| yours | **Locked by you since {since}, expires {expires}** — "Every save refreshes your lock. Unlock when you are done so others can edit." | **Unlock** |
| yours, last 5 minutes | the same + "Your lock ends at {expires} — extend it to keep editing." | **Extend** + **Unlock** |
| someone else's | **Locked by {email} since {since}, expires {expires}** — "The form is read-only. This page checks every 5 seconds whether the lock was released." | none |
| expired | **Lock by {email} expired at {expires}** — "The record is free again — lock it to edit." | **Lock** |

- **How long:** 30 minutes from the holder's LAST SAVE. Every successful change by the holder starts the 30 minutes
  again. Opening or reading a record never extends anyone's lock. **Extend** = Lock again (+30 minutes).
- Toasts: **Record locked — you can edit it now** · **Record unlocked** · **Lock extended until {expires}**.
- Times in the banner are in the reader's own time zone. A holder that is an MCP account shows as `<name> (MCP account)`.
- Lists show a padlock on locked rows (green = yours, red = someone else's).
- A person without the write right sees no banner (the page is read-only anyway). A person without MFA sees **Turn on
  two-factor sign-in first** in place of **Lock**.

## 3. What needs the lock and what does not

| Class (the console's code: R / A) | Actions | Rule | When blocked, the button's reason |
|---|---|---|---|
| **R — needs YOUR lock** | every Save on a record form; Delete; **Block account** / **Unblock account**; an account's role; an MCP account's role, enabled switch and **Change owner**; a role's title and permissions; agent settings and secrets; API key bindings, secrets, **Rotate**, Disable / Enable, Start / Stop / Restart; contract name, key rotation, policy and space lists; consumer contract and spaces; MCP consumer contract, spaces, enabled switch; certificate **Replace secret** | you hold the record, not expired | **Lock the record above to change this.** |
| **A — credential action** | **Reset password**, **Reset MFA**, **Resend invitation**, sign-in **Unblock** (accounts, MCP accounts); **Rotate** on a client, certificate, MCP account, MCP consumer; reset a space's deployment token; Refresh data (Wake) on an API key | nobody ELSE holds the record; no lock needed, none taken or renewed | **Locked by {email} until {time}!** |
| none | reading, copying, revealing, rebuilding a cache | never blocked | — |

**Agents and their space:**
- New agent: the space must be free, expired or yours ("{name} is locked by {email} until {time} — nothing can be created
  under it until it is released.").
- Change an agent: the AGENT locked by you AND its space not held by someone else ("… — its agents cannot be changed until
  it is released.").
- Delete a space: the space locked by you AND none of its agents held by someone else ("… — the space cannot be deleted
  until it is released.").

Binding one record to another (a client to an API key) only needs the record you edit — the target is not checked.

## 4. The refusals (exact words)

| Words | Meaning | Do |
|---|---|---|
| `Reserve the record first!` | Nobody holds it, or your own lock ran out | Lock (or `lock_record`) and save again. In the console the typed draft is kept. |
| `Locked by <label> until <HH:MM>!` | Someone else holds it. The time in the MESSAGE is UTC (the console re-words it to local time; the reply's `lock.expiresAt` is ISO) | Tell the person who holds it and until when. Wait, or ask the holder to unlock. |
| `Not allowed!` | A record nobody may lock / change (owner's account, your own row, a protected role) | Nothing to do — it is protected |
| `MFA required!` | No second factor (or a read-only MCP session) | `sign-in-and-mfa.md` §8 / §9 |

When converting the UTC time for the person, say "until 14:30 your time", not the raw UTC.

## 5. Another person's lock — who can break it

**Nobody can force-unlock.** There is no break button, for the owner neither. The options:
1. Ask the holder to press **Unlock** (or, for an MCP holder, to call `unlock_record`).
2. Wait: it expires 30 minutes after the holder's last save. The page re-checks every 5 seconds and **Lock** lights up.
3. Only an import takes a lock over (it writes and releases it again; the holder's next save is refused with
   `Locked by <importer> …`). See `import-export.md`.

A lock is released at once when every session of its holder ends for a security reason: the holder is blocked or
deleted, their password or MFA is reset, they are given another role or their role is deleted; for an MCP account: its
role, secret or enabled switch changes, or it is deleted. Saving a role's permissions board ends its holders'
sessions too, but does NOT release their locks — those run out 30 minutes after the holder's last save. Do not suggest these just to free a record — they lock the person out.

## 6. Sign-out, idle, closing the tab

- **A plain sign-out does NOT release the lock** (the person may hold it from another tab or device).
- Reloading, navigating away, closing the tab, the idle **Session locked** window: none of them release it.
- The lock just runs out 30 minutes after the last save.
- Rule for the person: press **Unlock** when done.

## 7. Through MCP

| Tool | Does | Needs |
|---|---|---|
| `lock_record { kind, id }` | Reserve (or extend) a record for 30 minutes | the kind's write scope + a confirmed session |
| `unlock_record { kind, id }` | Release your reservation; a record you do not hold, or an expired lock, is a harmless no-op | the same |

`kind` ∈ `space`, `agent`, `api_key`, `client`, `certificate`, `webhook`, `consumer_contract`, `mcp_consumer`,
`log_record`. Accounts, MCP accounts, roles and consumers cannot be locked through MCP.

Your routine for every change:
1. `lock_record` → read the reply's `lock` (`mine: true`, `expiresAt`).
2. The `update_*` / `delete_*` / `assign_*` / `set_*` / `rotate_api_key` call(s). Each successful one renews the 30 minutes.
3. `unlock_record` — always, also after a failure. A delete needs no unlock (the record is gone).

- Class A tools (`rotate_client`, `rotate_certificate`, `rotate_mcp_consumer_secret`, `reset_space_deployment_token`,
  `wake_api_key`) need no lock — but fail with `Locked by …` while someone else holds the record.
- `create_*` needs no lock; `create_agent` fails while someone else holds the space.
- Every `get_*` / `list_*` reply carries the `lock` block (`by`, `byEmail`, `at`, `expiresAt`, `mine`, `expired`) — check
  it before you start, and tell the person if a colleague holds the record.
- Never leave a lock behind: the person's colleagues will see `<your MCP account name> (MCP account)` as the holder
  for up to 30 minutes and nobody can break it.
