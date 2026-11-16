# MCP Consumers

## Description

An MCP consumer is a **headless end user** that an MCP account creates for itself. It has no e-mail, no password and
never a one-time code: its credential is an **id + a secret**. Like a normal consumer it belongs to one **contract**
(its tenant) and reaches a subset of that contract's spaces — so it sees the agents exactly as a partner site's user
does. Its token is issued **only** through the MCP server.

This is how the builder test-chats an agent. The loop is: change the flow → `keen-validate` → `keen-deploy` → mint
the MCP consumer's token → run the agent with the agent runner → read the flow-tree → fix → again, until the answers
are precise.

The person needs this segment when:

- the builder sets up testing for a new agent (one MCP consumer per project or per tester is enough);
- a test identity must be paused (**Enabled** off), re-keyed (**Rotate secret**) or removed;
- they audit which MCP account created which test identity (**Created by**, **Last login**).

Related: the tenant and the offered spaces are the [contract](../../API/Contracts/contracts-skill.md), which must be
bound to a fully wired [API key](../../API/API%20Keys/api-keys-skill.md) (client, certificate, webhook with the
origin); the agent is in [Agents](../Agents/agents-skill.md); the MCP account that creates it is in
[MCP Accounts](../../Organization/MCP%20Accounts/mcp-accounts-skill.md). Real end users are
[Consumers](../Consumers/consumers-skill.md).

## Who may

| Right | Opens |
|---|---|
| `mcc1` (MCP consumers · Read) | the list (filters, sort, paging), every record; **for an MCP account** also minting / refreshing a token |
| `mcc2` (MCP consumers · Write) | a human: the **Enabled** switch + **Save**, **Rotate secret**, **Delete MCP consumer**, Lock. An MCP account: all of that plus create, assign contract, assign spaces |
| `co1` | the contract names on the list and record (without it the raw contract id shows) |

Owner and admin pass the human gates. **Only an MCP account** may create an MCP consumer, bind its contract, grant
its spaces, or mint its token — a person gets `Only MCP accounts may manage MCP consumers`. The console has no Create
page and no contract / space editing. There is no import or export. See [rights](../../references/rights.md).

## MFA

Every write needs a second factor: for a person, their own two-factor sign-in (the console shows "Turn on two-factor
sign-in first"); for an MCP account, its owner's 6-digit code at `mcp_login` (a sign-in without it is read-only and
every write answers `MFA required!`). **Minting and refreshing the token need it too**, although they are `mcc1`.
Why: an MCP consumer chats with the organization's agents as a real tenant user. With only a stolen MCP secret or
password, someone could mint tokens and drive the agents (and their paid model calls and tools), or re-key the test
identity. See [sign-in-and-mfa](../../references/sign-in-and-mfa.md) and [mcp](../../references/mcp.md).

## Through MCP

**Reachable through MCP: yes** — and only through MCP for create, binding and tokens.

| Tool | What it does | Needs |
|---|---|---|
| `list_mcp_consumers` | one page; filters name, id, enabled, consumer contract, created at / from | `mcc1` |
| `get_mcp_consumer { id }` | the record (never the secret) | `mcc1` |
| `create_mcp_consumer { name, consumerContractId?, space?, enabled? }` | creates it; the reply has `consumer` **and** `secret` — shown this once | `mcc2` + MFA |
| `assign_mcp_consumer_contract { id, consumerContractId \| null }` | re-homes / unbinds; spaces are clamped (unbind clears them); every token pair ends | `mcc2` + MFA + locked by you |
| `assign_mcp_consumer_spaces { id, space[] }` | replaces the grant; removing a space ends every token pair | `mcc2` + MFA + locked by you |
| `set_mcp_consumer_enabled { id, enabled }` | off = every token refused at once, no new token | `mcc2` + MFA + locked by you |
| `rotate_mcp_consumer_secret { id }` | new secret, shown once; old secret and every token pair end | `mcc2` + MFA; refused while another holds it; ask first |
| `delete_mcp_consumer { id }` | deletes it; credential and tokens stop | `mcc2` + MFA + locked by you; ask first |
| `get_mcp_consumer_token { id, secret }` | the consumer's `access_token` (10 minutes) + `refresh_token` | `mcc1` + MFA |
| `refresh_mcp_consumer_token { refresh_token }` | a new pair; the old refresh token is spent | `mcc1` + MFA |
| `lock_record` / `unlock_record` `{ kind: 'mcp_consumer', id }` | reserve / release | `mcc2` + MFA |

`consumerContractId` is the contract's **id**, not its key. Any token failure — unknown id, wrong secret, disabled,
no contract, the contract's API key not fully wired — is the same `406`, on purpose; repeated wrong secrets are
throttled.

**Not through MCP — tell the person:** nothing is console-only. A person may pause, rotate or delete one in the
console (below) — e.g. when the MCP account is unavailable.

Keep the secret out of the chat and out of git: write the id + secret to a git-ignored local file, put only the token
and the id into the runner's `.env`. See [secrets-and-credentials](../../references/secrets-and-credentials.md).

## Create

Only through MCP: `create_mcp_consumer`.

| Field | Required | Limits | Note |
|---|---|---|---|
| `name` | yes | non-empty, trimmed, unique | immutable — pick a clear one (`support-tester`) |
| `consumerContractId` | no at create, **yes for a token** | an existing contract id | the tenant; `No such consumer contract!` |
| `space` | no | ids the contract offers | else `Spaces must be offered by the contract!`; without a contract only `[]` |
| `enabled` | no | boolean | default `true` |

Refusals: `An MCP consumer with that name already exists!`, `No such consumer contract!`,
`Spaces must be offered by the contract!`, `Only MCP accounts may manage MCP consumers` (a person's token). Right
after: the reply carries `result.consumer.id` and `result.secret` — store both now; the secret is hashed and can never
be read again (lost → rotate). **Created by** is stamped with the MCP account.

## Change

Through MCP: the assign / enable / rotate tools above (lock first with `lock_record`, see
[record-locks](../../references/record-locks.md)).

In the console: **AI › MCP Consumers › MCP Consumer List › Open**. Name, contract and spaces are read-only for a
person. Lock the record for **Save** and **Delete**; **Rotate secret** needs only that nobody else holds it.

| Where | What it does |
|---|---|
| **Identity, Tenant & Access** › **Enabled** › **Save** | "Turns the consumer's access on or off — a disabled consumer cannot authenticate through the MCP server." |
| **Danger zone** › **Rotate secret** | "Rotate the secret of "<name>"? The old one stops at once and every session ends." → **MCP secret — shown once** with **Copy MCP secret**, then **I have copied it — back to the consumer** |
| **Copy MCP consumer id** | the id |

When a person rotates, the new secret must reach the builder's local credential file — tell the person to paste it
there (never into the chat), or rotate through MCP instead so the builder receives it directly.

**How the change reaches what runs** ([delivering-changes](../../references/delivering-changes.md)):

| Change | Reaches |
|---|---|
| **Enabled** off | at once: the access token is refused on the next call, the refresh token with `406`; re-enabling does not revive them — mint a new pair |
| Rotate secret | at once: the old secret and every token pair end; mint a new pair with the new secret |
| Contract changed / unbound | at once: every token pair ends; spaces clamped / cleared |
| A space removed | at once: every token pair ends |
| A space added | only in a newly minted pair |
| An agent / flow change | nothing to do here — the next run uses the deployed flow |

## Delete

Through MCP `delete_mcp_consumer` (lock first; ask the person), or the console **Danger zone** › **Delete MCP
consumer**: "Delete "<name>"? Its id and secret stop working at once." Toast `MCP consumer "<name>" deleted`. Its
credential and every token stop at once. It cannot be undone; to pause instead, switch **Enabled** off. Deleting the
MCP account that created it does **not** delete it; deleting its contract releases it (no contract, no spaces, no
token).

## Import / Export

Not available for MCP consumers. Create them again with `create_mcp_consumer` on the other instance.

## Mistakes that break it

| Mistake | What happens | Do instead |
|---|---|---|
| No contract, or the agent's space not granted | `406` on the token, or the run cannot reach the agent | bind the contract and grant the agent's space |
| The contract's API key misses its client, certificate or webhook | the token mint answers `406` | finish the API key ([API Keys](../../API/API%20Keys/api-keys-skill.md)) |
| The runner's `KEEN_ORIGIN` is not the origin on the API key's webhook record | the chat socket is refused | the webhook record's origin exactly |
| The contract key passed as `consumerContractId` | `No such consumer contract!` | the contract's **id** |
| A run after 10 minutes on the same access token | `Invalid token` | `refresh_mcp_consumer_token` (or mint again) before each run |
| Losing the secret | no new token | `rotate_mcp_consumer_secret` |
| Printing the secret or the token in the chat or a commit | anyone can chat as the tenant | keep them in git-ignored files |
| `KEEN_USER_ID` not the consumer's id | the run is refused | `result.consumer.id` |
| Deleting to pause testing | the history and Created by are gone | `set_mcp_consumer_enabled false` |

## Example

Goal: test the "Support" assistant (space `Support`, agent `support-agent`) until its answers are precise.

1. `list_consumer_contracts` / `get_consumer_contract` — find the contract that offers the Support space and is bound
   to a fully wired API key; note its **id** and the webhook record's origin.
2. `create_mcp_consumer { name: "support-tester", consumerContractId: "<contract id>", space: ["<Support space id>"] }`
   → write `result.consumer.id` + `result.secret` to the git-ignored credential file.
3. `get_mcp_consumer_token { id, secret }` → write `KEEN_TOKEN=<access_token>`, `KEEN_USER_ID=<id>`,
   `KEEN_ORIGIN=<the webhook origin>`, `KEEN_SPACE_ID`, `KEEN_AGENT=support-agent` into the runner's `.env`.
4. Run `npx tsx run.ts --prompt "Where is my order 1042?" --json`; read the flow-tree; fix the flow; `keen-validate`,
   `keen-deploy`; run again (refresh the token when it is older than 10 minutes).
5. Testing done for now → `lock_record { kind: 'mcp_consumer', id }`, `set_mcp_consumer_enabled { id, enabled: false }`,
   `unlock_record`. If `MFA required!` answers, tell the person: "Sign me in again with your 6-digit code" — or in the
   console: **AI › MCP Consumers**, open *support-tester*, **Lock**, switch **Enabled** off, **Save**, **Unlock**.
