# Cache

## Description

**Cache** (console title **Cache Management**) shows the platform's served copies of the configuration — the
ready-made copies that chats, partner sites and the API read instead of the stored records. One card per resource:
**Roles**, **Agents**, **Spaces**, **Api Keys**, **Certificates**, **Clients**, **Consumer Contracts**,
**Consumer Policy**. Each card shows **State** (**Idle** / **Creating…** / **Invalidating…** / **Failed**),
**Present**, **Last created**, **Entries**, **Size**, **Last changed by**, **Last changed at**, and has three
buttons: **Refresh status**, **Create** (build a fresh copy) and **Invalidate** (clear it).

A copy never holds a secret: no deployment tokens, no key hashes, no client secrets, no private keys, no agent
settings blobs (only whether an agent has them).

**The copies keep themselves current.** Every save, create or delete of a space, an agent, an API key, a client, a
certificate, a consumer contract or a webhook rebuilds the affected copy by itself within moments. So in normal work
the person never needs this page. The real cases:

- a partner reports stale configuration and you want to see when a copy was last built (**Last created**);
- a card shows **Failed** (**The last cache job failed** + the reason) — press **Create** again;
- a copy must stop being served at once (rare) — **Invalidate**;
- support asks for a rebuild after an incident.

Pushing changes to a partner site is NOT done here: that is the API key's **Rebuild and refresh data**
([../../API/API Keys/api-keys-skill.md](../../API/API%20Keys/api-keys-skill.md)). A role change does not need this
page either: saving a role ends every holder's session (people at once, MCP accounts within about a minute) and they
get the new rights when they sign in again ([../../Organization/Roles/roles-skill.md](../../Organization/Roles/roles-skill.md)).

**Rebuild resource cache** on a record page (Space, Agent, Client, Certificate, Contract, Webhook, Api Key) starts the
same build as **Create** for that record's whole resource, without leaving the record:

| Record page | Rebuilds |
|---|---|
| Space | the **Spaces** copy |
| Agent | the **Agents** copy |
| Client | **Clients** |
| Certificate | **Certificates** |
| Contract | **Consumer Contracts** + **Consumer Policy** |
| Webhook, Api Key | **Api Keys** (webhooks live in the API-key copy) |

Toast: **Cache rebuild started** with **View cache status** (opens that card alone at `/cache/<resource>`).

## Who may

| Right | Opens |
|---|---|
| `ce1` (Cache · Read) | The page, every card's status, **Refresh status**. |
| `ce2` (Cache · Write) | **Create**, **Invalidate**, every record's **Rebuild resource cache**. |

- Owner and admin always have both.
- The record pages' button follows `ce2` only — independent of the record's own right: a cache manager sees it
  without the right to edit the record, a record editor without `ce2` does not.
- Without `ce1`: **You don't have access to this page**, the sidebar row **Cache** is hidden. With `ce1` only, the
  cards show no **Create** / **Invalidate**.
- See [../../references/rights.md](../../references/rights.md).

## MFA

**Create**, **Invalidate** and **Rebuild resource cache** need two-step sign-in: `MFA required!` (console:
**Turn on two-factor sign-in first**). Reading the status does not. Why: with only a stolen password someone could
**Invalidate** the **Api Keys** or **Agents** copy and cut every partner site and chat off until the next build. An
MCP session needs its owner's code. See [../../references/sign-in-and-mfa.md](../../references/sign-in-and-mfa.md).

## Through MCP

**Reachable through MCP: yes.**

| Tool | What it does | Needs |
|---|---|---|
| `get_cache_status { resource }` | One copy's status (`roles`, `agents`, `spaces`, `api_keys`, `certificates`, `clients`, `consumer_contracts`, `consumer_policy`). | `ce1` |
| `create_cache { resource }` | Starts a build; answers at once, the job runs in the background. | `ce2` + MFA |
| `invalidate_cache { resource }` | Clears the copy. Confirm with the person first. | `ce2` + MFA |
| `rebuild_api_key_cache { id }` | Rebuilds ONLY what one API key is bound to (the key, its certificate, client, contract, that contract's policy, its spaces and their agents) — and does not tell the site. | `ce2` + MFA |
| `clear_spaces_cache` | Rebuilds the **Spaces** and **Agents** copies. | `sp2` + MFA |

After an API-key change prefer `wake_api_key` (scope `ak2`): it does the same rebuild AND makes the partner site
re-read, in one step. `rebuild_api_key_cache` refuses a key that is not fully bound or is disabled:
`API key not found or not fully configured — bind its client, certificate, contract and webhook, then rebuild.`

Poll `get_cache_status` until `state` is `idle` (or `failed`, then read `error`).

**Not through MCP — tell the person:** nothing is missing. In the console: **System → Cache**, the card, **Create**
or **Invalidate**.

## Create

**Create** on a card (no confirmation — readers see wholly the old copy or wholly the new one, never a mix; nothing
is lost). Toast **Cache build started — the status follows the job**; the card shows **Creating… (n/total)** and
re-reads every 1.5 s until **Idle**. One job per resource: a **Create** while a job runs is queued
(**Queued after the running job.**). A burst of requests costs at most one more build.

## Change

There is nothing to edit in a copy. The actions:

- **Refresh status** — re-reads the card.
- **Rebuild resource cache** on a record page — see the table above. No record lock is needed (it changes no record).
- The API key's cascade — through MCP `rebuild_api_key_cache`, or the key's **Rebuild and refresh data**.

**How the change reaches what runs:** a finished build is read by chats and the API at once (the next request). A
partner site sees it on its next fetch — it is not told. To make a site re-read now, use the API key's **Rebuild and
refresh data** / `wake_api_key`. See [../../references/delivering-changes.md](../../references/delivering-changes.md).

## Delete

**Invalidate** on a card → **Invalidate the <title> cache?** — **Consumers lose the cache until the next Create
builds a fresh one.** → **Invalidate**. Toast **Cache invalidation started — the status follows the job**; then
**Present: No**, **Entries 0**.

What stops at once: everything that reads that copy gets nothing until a build — e.g. after **Api Keys** partner
sites' addresses are no longer accepted; after **Agents** or **Spaces** chats cannot find their agent. The copy comes
back with the next **Create**, or with the next save of a record of that resource. While a job runs, **Invalidate** is
refused: `Cache busy: a <creating|invalidating> job is already running for <resource>`.

## Import / Export

Not available for Cache — copies are built from the records, never carried in a file. See
[../../references/import-export.md](../../references/import-export.md).

## Mistakes that break it

| Mistake | What happens | Do instead |
|---|---|---|
| **Invalidate** "to refresh" | Readers get nothing until the next build — chats and sites can fail | Use **Create**; it swaps in the new copy safely |
| Pressing **Rebuild resource cache** after every save | Harmless, but useless — saves rebuild by themselves | Save is enough |
| Expecting a partner site to change after **Create** | The site is not told | API key → **Rebuild and refresh data** |
| `rebuild_api_key_cache` on a half-bound or disabled key | Refused, nothing rebuilt | Bind client, certificate, contract and webhook; enable the key |
| Reading **Last changed by** as a person | It may name the platform itself (an automatic rebuild) | Check the audit log for who saved the record |
| Leaving a **Failed** card | That copy stays at its last good state (or absent) | **Create** again; if it fails again, read the error and the **Error** log |

## Example

The person: "I created a new agent in the Shop space an hour ago, but the partner site still does not offer it."

1. `get_cache_status { resource: "agents" }` and `{ resource: "spaces" }` → **Idle**, **Last created**
   after the change: the copies are current. (A contract change would have reached the site by itself; a space or
   agent change never does.)
2. The site was simply not told. `lock_record` is not needed; call `wake_api_key { id: "<the partner's key id>" }`
   (needs `ak2` + MFA) — it rebuilds everything bound to the key and the site re-reads.
3. If the MCP session lacks `ak2`, tell the person: "Open **API → Api Keys → <the key>** and press
   **Rebuild and refresh data**."
4. If a status shows **Failed**: `create_cache { resource: "spaces" }`, poll `get_cache_status` until `idle`; if it
   fails again, tell the person to open **System → Logs → Audit**, sink **System / Error**, and send you the newest
   `Cache:` line.
