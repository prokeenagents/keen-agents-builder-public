# Consumers

## Description

A consumer is an end user of a partner site — a person who signs in on the site (e-mail + password, optionally a
one-time code) and chats with the agents. Every consumer belongs to at most one **contract** (its tenant): the token it
gets at sign-in is stamped with that contract's key, and it may reach only the **spaces** that contract offers and that
were granted to it. An e-mail is unique **within** a tenant; the same address may exist under another partner.

Three kinds show in the list:

- **Partner sign-up** — registered on a partner site (most consumers);
- **first-party** (**No tenant**) — created in the console without a contract; it reaches nothing until given one;
- **Orphan** — its contract was deleted; it was released, not deleted, and reaches nothing until given a tenant again.

The person needs this segment when:

- an end user cannot reach an agent — check the consumer's contract, its spaces and whether it confirmed;
- they invite a tester or a customer by e-mail without the partner site's sign-up;
- a user moves to another partner (tenant), or a space must be granted / taken away;
- a user is locked out — **Reset password** mails a new link;
- a user must be removed (it is signed out at once).

Related: the tenant and what it offers are the [contract](../../API/Contracts/contracts-skill.md); the spaces are
[Spaces](../Spaces/spaces-skill.md). For the builder's own testing use an
[MCP consumer](../MCP%20Consumers/mcp-consumers-skill.md), never a real person's account.

## Who may

| Right | Opens |
|---|---|
| `cs1` (Consumers · Read) | the list (filters, sort, paging), every consumer record |
| `cs2` (Consumers · Write) | **Create consumer**, **Save contract**, **Save spaces**, **Reset password**, **Delete consumer**, Lock |
| `cs3` / `cs4` | Import / Export of consumers |
| `co1` (Contracts · Read) | the Contract select, the contract filter and the grants board; without it: "Choices unavailable — requires contracts read permission." |

Owner and admin pass every gate. **Every consumer write is human only**: an MCP account may read consumers but never
create, move, grant, reset or delete one (`MCP accounts may not access this resource`). The consumer's own actions on
the partner site (sign-in, profile, password change) are never blocked by the console. See [rights](../../references/rights.md).

## MFA

Every write (create, save contract, save spaces, reset password, delete, lock, import, export) needs the person's
two-factor sign-in; reads do not. The console shows "Turn on two-factor sign-in first"; a call answers
`MFA required!`. Why: with only a stolen password, someone could move a customer under their own partner tenant,
grant spaces the customer should not reach, mail password resets to sign people out, or delete real users.
MCP accounts never write here, with or without MFA. See [sign-in-and-mfa](../../references/sign-in-and-mfa.md).

## Through MCP

**Reachable through MCP: partly — read only.**

| Tool | What it does | Needs |
|---|---|---|
| `list_consumers { page?, items?, sort?, filters? }` | one page of consumers; filters by name, mail, contract, confirmed, external, created, id | `cs1` |
| `get_consumer { id }` | one consumer (contract key, spaces, confirmed, last login) | `cs1` |
| `get_consumer_info { id }` | the record's info view | `cs1` |

**Not through MCP — tell the person** (each in **AI › Consumers**):

- **Invite a consumer** — **Create Consumer**, type **Email**, pick **Contract**, **Create consumer**.
- **Move to another tenant / unbind** — open the consumer, **Lock**, change **Contract**, **Save contract**, confirm.
- **Grant or remove spaces** — open, **Lock**, switch **Granted** per space, **Save spaces**.
- **Reset password** — open, header **Reset password**, confirm.
- **Delete** — open, **Lock**, **Danger zone** › **Delete consumer**, confirm.
- **Import / Export** — the Import / Export pages.

Use the reads to diagnose first, then give the person the exact clicks.

## Create

Console: **AI › Consumers › Create Consumer** (or **New consumer** on the list). Card **Consumer Details**:

| Field | Required | Limits | Note |
|---|---|---|---|
| **Email** | yes | a valid e-mail, at most 254 characters | "The confirmation link is emailed here — the end user sets their own name and password on it." |
| **Contract** | no | an existing contract | empty = "No contract — belongs to the organization" (first-party) |

Press **Create consumer**. Refusals: `This consumer is already created!` (the e-mail exists in that tenant),
`No such contract!`, `Enter a valid email`. Right after: toast `Consumer "<email>" created — confirmation email sent`.
The consumer is **New** (unconfirmed) until it opens the link (valid 24 hours; there is no resend — create again after
deleting, or use **Reset password** once confirmed). It gets the contract's **in-app default spaces** at once; a
first-party consumer gets none.

## Change

Record: **AI › Consumers › Consumer List › Open**. Lock the consumer first
([record-locks](../../references/record-locks.md)): **Save contract**, **Save spaces** and **Delete** need your lock;
**Reset password** only needs it not held by someone else. Name and e-mail are never editable here (the end user sets
the name).

| Where | What it does |
|---|---|
| **Tenant & Identity** › **Contract** › **Save contract** | move: "Move "<email>" to "<contract>"? Its session ends and its spaces are trimmed to what that tenant offers." — unbind: "Unbind "<email>" from its tenant? This clears every space." |
| **Spaces** › **Granted** switches › **Save spaces** | the grant, limited to what the contract offers (`Spaces must be offered by the contract!`) |
| header **Reset password** (confirmed consumers only) | "Mail a password reset to "<email>"? Any earlier link stops working." |
| **Copy Consumer ID** | the id (the chat's user id) |

**How the change reaches what runs** ([delivering-changes](../../references/delivering-changes.md)):

| Change | Reaches |
|---|---|
| Move to another contract / unbind | at once: every session of the consumer ends; it signs in again (under the new tenant) |
| A space **removed** | at once: its sessions end — the old token still named the space |
| A space **added** | only after the consumer signs in again (the grant lives in the token); "a change here reaches a live session only after it re-authenticates" |
| **Reset password** | at once: the old password and every session end; the mailed link sets a new one |
| The partner site | is notified of a space change or a move by itself; nothing to press |

## Delete

Record › **Danger zone** › **Delete consumer** ("The end user can no longer sign in, and the tokens it holds are
refused at once."). Confirm `Delete "<email>"? It can no longer sign in.` Toast `Consumer "<email>" deleted`.
Its chat stops at the next request. It cannot be undone; the same e-mail can be invited again as a new consumer (new
id, new confirmation).

## Import / Export

Supported (`cs3` / `cs4` + MFA): **AI › Consumers › Import / Export**; the export can carry the list's filters.
Matched by e-mail **and** contract. Carried: e-mail, contract, spaces, partner sign-up marker, the profile (for
information). **Never carried: passwords, reset links, sessions.** Every new consumer an import creates is
unconfirmed and gets a confirmation mail valid 24 hours ("there is no resend") — the console asks before it runs.
Import contracts and spaces first. See [import-export](../../references/import-export.md).

## Mistakes that break it

| Mistake | What happens | Do instead |
|---|---|---|
| A consumer with no contract (first-party or orphan) | reaches no space at all | give it a contract, then grant spaces |
| Granting a space the contract does not offer | `Spaces must be offered by the contract!` | add the space to the contract first ([Contracts](../../API/Contracts/contracts-skill.md)) |
| Expecting a newly granted space in a running chat | not there until it signs in again | tell the user to sign out and in |
| Moving a consumer "to fix spaces" | its session ends and the spaces are trimmed to the new tenant | change the spaces, not the tenant |
| Inviting the same e-mail twice in one tenant | `This consumer is already created!` | open the existing one |
| Using a real customer's account to test an agent | changes and test chats land in a real person's history | an MCP consumer |
| Asking the person to send a consumer's password | it is in the chat | **Reset password** — the user sets it from the mail |

## Example

Goal: a customer, `user@example.com`, says the "Support" assistant does not answer on the partner site.

1. `list_consumers { filters: { "mail": "user@example.com" } }` → one row; note `consumerContract` (the key), `space`,
   `confirmed`.
2. `confirmed` is false → tell the person: the customer never opened the confirmation mail (valid 24 hours).
3. Confirmed, but the Support space id is not in `space` → `get_consumer_contract` (via
   [Contracts](../../API/Contracts/contracts-skill.md)) to check the contract offers it.
4. It does → tell the person: "Open **AI › Consumers**, open *user@example.com*, press **Lock**, switch **Granted** on
   for **Support**, press **Save spaces**, then **Unlock**. Ask the customer to sign out and sign in again."
5. It does not → the space must first be added to the contract (Contracts segment), then step 4.
