# Contracts

## Description

A consumer contract is a **tenant**: the group of end users (consumers) of one partner site. It carries:

- a **Key** — 19 letters and digits, stamped into every consumer token as the tenant;
- the **Registration & Login Policy** — five Yes/No rules for how its consumers sign up and sign in;
- the **Spaces** — the master set the tenant may offer (**Assigned**), plus the spaces a NEW consumer gets
  automatically (**In-app default**, **Partner default**).

An API key binds one contract ([api keys](../API%20Keys/api-keys-skill.md)); until then no partner origin resolves to the
tenant. A chat run in a space outside the contract's set is refused.

Who gets which contract:
- a consumer who **signs up on a partner site** gets the contract bound to that site's API key, and its **Partner default** spaces;
- a consumer **created in the console** gets the contract the admin picks on the consumer, and its **In-app default** spaces
  ([consumers](../../AI/Consumers/consumers-skill.md));
- an **MCP consumer** gets one through `assign_mcp_consumer_contract` ([MCP consumers](../../AI/MCP%20Consumers/mcp-consumers-skill.md)).

When the person needs it:
- a new partner site (step 4 of the chain in [api keys](../API%20Keys/api-keys-skill.md#one-partner-site--the-records-and-their-order));
- a new space or agent must be offered to a site's users;
- partner sign-up must be opened or closed, a one-time code required, or a group of consumers frozen.

## Who may

| Right | Opens |
|---|---|
| `co1` | every Contracts page; `list_contract_spaces` |
| `co2` | Create, Save, Rotate key, Save policy, Save spaces, Delete |
| `co3` / `co4` | Import / Export of contracts |
| `ce2` | the header's **Rebuild resource cache** |

Owner and Administrator pass by role ([rights](../../references/rights.md)). Without `co1`: "You don't have access to this
page". Without `co2`: switches disabled, no footers, no Rotate key, no Danger zone. No contract is protected.

## MFA

Every change, import and export needs the person's two-factor sign-in; else `MFA required!` and **Turn on two-factor
sign-in first** ([sign-in and MFA](../../references/sign-in-and-mfa.md)). Why: with a stolen password one could open
partner sign-up on a tenant, add spaces (and so agents) to it, switch off the one-time code, or rotate the key and sign
the whole tenant out.

## Through MCP

**Reachable through MCP: yes** (every action). Writes need an MCP account signed in with its owner's code
([mcp](../../references/mcp.md)); every write except create needs `lock_record { kind: 'consumer_contract', id }` first.

| Tool | What it does | Needs |
|---|---|---|
| `list_consumer_contracts` / `get_consumer_contract` | list / read (policy + the three space sets) | `co1` |
| `list_contract_spaces` | the spaces a contract can be given | `co1` |
| `create_consumer_contract` | `{ name, key? }` — a key re-adopts a tenant whose row was lost | `co2` |
| `update_consumer_contract` | rename and / or change the key | `co2`, lock |
| `update_consumer_contract_policy` | all five booleans every time | `co2`, lock |
| `assign_contract_spaces` | replace the Assigned set (≤ 200 ids; `[]` clears) | `co2`, lock |
| `assign_contract_default_system_spaces` | replace the In-app default set (⊆ Assigned) | `co2`, lock |
| `assign_contract_default_outside_spaces` | replace the Partner default set (⊆ Assigned) | `co2`, lock |
| `delete_consumer_contract` | delete; its consumers are released | `co2`, lock |

Binding the contract to a key is done on the key (`update_api_key { consumerContractId }`). Order when shrinking the
Assigned set: defaults first, then Assigned (the defaults must stay a subset at every step).

**Not through MCP — tell the person:** nothing is console-only. Import / export is console-only:
**Contracts** › **Import** / ⋮ **Export**.

## Create

Console: **Contracts** › **Create Contract** (or **New contract**). Card **Tenant Details**:

| Field | Required | Limits | Note |
|---|---|---|---|
| **Name** | yes | 1–100, unique | "Enter Contract Name" |
| **Key** | no | exactly 19 of A–Z a–z 0–9, unique platform-wide | empty = minted; a typed key re-adopts a lost tenant |

Refusals: `Reached the maximum number of consumer contracts (20). Delete one before creating a new contract.` ·
`Name "<name>" is already in use by another consumer contract.` · `Name is required.` ·
`Key must be exactly 19 characters from A-Z, a-z and 0-9.` · `A consumer contract with that key already exists.` ·
`Failed to mint a unique contract key after 8 attempts.`

Right after: toast `Contract "<name>" created`, then the record. A new contract has no spaces and every policy switch off
("in-app only"). Nothing is secret: the key stays readable.

## Change

One record lock covers all three cards ([record locks](../../references/record-locks.md)).

**Identity & Key** — **Name** (cosmetic) → **Save**. **Rotate key** (on the Key row) asks "Rotate the key of "<name>"?
Every consumer token minted under the current key stops being accepted the moment the new one lands, so every consumer
of this tenant has to log in again." The console makes the new key itself. **Bound API key** and **Webhook** are
read-only here.

**Registration & Login Policy** — five switches, saved together with **Save policy**:

| Switch | On means |
|---|---|
| **Partner sign-up** | a partner site may create new consumers through public registration |
| **One-time code — consumers created in-app** | those consumers confirm an e-mailed code at login |
| **One-time code — consumers who signed up on a partner site** | the same for partner sign-ups |
| **Freeze partner-registered consumers** | partner sign-ups are refused at login (accounts stay) |
| **Freeze in-app-created consumers** | console-created consumers are refused at login |

Turning a **Freeze** ON ends that group's open sessions at once; if that cannot be confirmed nothing is saved:
`Sessions could not be ended — nothing saved` (save again). The other switches apply to the next sign-up or login.

**Spaces** — a table: **Assigned** · **In-app default** · **Partner default** per space → **Save spaces**. A default needs
Assigned first; turning Assigned off clears both. Defaults apply only to NEW consumers; existing consumers keep their
spaces. A space that no longer exists shows **no longer available** (only Assigned can be turned off).
Refusals: `Default spaces must be a subset of the contract's assigned spaces.` · `Unknown space: <id>`.

### How the change reaches what runs

Immediately: every save is pushed to the bound key's site (its instances re-read; a legacy site gets a webhook notice).
No restart, no **Rebuild and refresh data** needed. New spaces' agents still need to exist and be deployed.
See [delivering changes](../../references/delivering-changes.md).

## Delete

Danger zone › **Delete** › "Delete "<name>"? Its api key stops being fully bound, and its consumers and MCP consumers are
released — not deleted." Cannot be undone. What stops at once: every token of the bound API key (the key loses its
contract); its site shows **Incomplete** until another contract is bound. The consumers stay, without a contract.

## Import / Export

Supported: **Contracts** › **Import** (`co3`) / ⋮ **Export** (`co4`). Carried: name, **key** (the tenant's identity across
instances), the five policy switches, the three space sets (by space). Never carried: the bound API key and its webhook.
An imported contract is unbound: "None — bind an API key to serve this contract's consumers." Recommended order puts
contracts after spaces and agents. See [import / export](../../references/import-export.md).

## Mistakes that break it

| Mistake | What happens | Do instead |
|---|---|---|
| A space assigned but no default | new partner sign-ups get no space and cannot chat | set **Partner default** (and **In-app default**) |
| Defaults expected to reach existing consumers | they keep their old spaces | add spaces on each consumer |
| Rotate key "to refresh" | the whole tenant signs in again | rotate only after a leak |
| Freeze switched on by mistake | that group is signed out at once | switch off, Save policy; they sign in again |
| Shrinking Assigned over MCP before the defaults | `Default spaces must be a subset …` | defaults first, then Assigned |
| Deleting the contract of a live site | every token of its key ends; the site is Incomplete | bind another contract first |

## Example

Goal: the site "Shop" must also offer the new space "Returns" to its users, new and existing.

1. Builder: `list_contract_spaces` → the id of "Returns"; `get_consumer_contract` → the current sets.
2. Builder: `lock_record { kind: 'consumer_contract', id }`.
3. Builder: `assign_contract_spaces { id, spaceIds: [<current…>, <returns>] }`, then
   `assign_contract_default_outside_spaces` and `assign_contract_default_system_spaces` with the same addition.
4. Builder: `unlock_record`. The site re-reads at once.
5. Builder tells the person: existing consumers do not get it automatically — open **Consumers** › each consumer ›
   Spaces, add "Returns" › Save (or the builder lists them with `list_consumers` and names them).
