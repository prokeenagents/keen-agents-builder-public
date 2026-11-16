# Clients

## Description

A client is the partner site server's identity: a **Client ID** (`kcid_…`, public) and a **Client Secret** (shown once,
stored hashed). An API key binds one client ([api keys](../API%20Keys/api-keys-skill.md)). The site's server sends the
Client ID and Client Secret together with the Api Key ID and Key Secret to mint its **application token**; a key paired
with any other client cannot mint one.

On the reference partner site they are the container's `KEEN_CLIENT_ID` and `KEEN_CLIENT_SECRET`. Unlike the origin,
the webhook secret and the certificate, Keen does NOT hand them to the site at start — they live in the site's own
environment.

When the person needs it:
- a new partner site (step 3 of [the chain](../API%20Keys/api-keys-skill.md#one-partner-site--the-records-and-their-order));
- the client secret leaked or was lost (Rotate secret);
- after an import (an imported client has no usable secret until rotated).

## Who may

| Right | Opens |
|---|---|
| `ct1` | every Clients page (id, name, the secret's display prefix, the bound key) |
| `ct2` | Create, Save, Rotate secret, Delete |
| `ct3` / `ct4` | Import / Export |
| `ce2` | **Rebuild resource cache** |

Owner and Administrator pass by role ([rights](../../references/rights.md)). Without `ct1`: "You don't have access to this
page". Without `ct2`: read-only, no Danger zone. No client is protected.

## MFA

Every change, import and export needs the person's two-factor sign-in; else `MFA required!` /
**Turn on two-factor sign-in first** ([sign-in and MFA](../../references/sign-in-and-mfa.md)). Why: with a stolen password
one could rotate a client and take the new secret (half of what a fake partner server needs), or delete the client and
cut the live site off.

## Through MCP

**Reachable through MCP: yes.** Writes need an MCP account signed in with its owner's code ([mcp](../../references/mcp.md)).

| Tool | What it does | Needs |
|---|---|---|
| `list_clients` / `get_client` | list / read | `ct1` |
| `create_client` | `{ name }` — mints the id and secret; the reply carries the secret once | `ct2` |
| `update_client` | rename | `ct2`, `lock_record { kind: 'client', id }` |
| `rotate_client` | new secret (in the reply, once); the old one stops at once | `ct2`; refused while another user holds it |
| `delete_client` | delete | `ct2`, lock |

Binding is done on the key: `update_api_key { clientId }`.

**The secret:** `create_client` / `rotate_client` answer it once. Write it straight into the site's git-ignored
`.env.local` (`KEEN_CLIENT_SECRET`) and never repeat it in the chat. If you cannot write that file, ask the person to
create or rotate in the console and copy it there: **Clients** › **Create Client** (or the record › Danger zone ›
**Rotate secret**).

**Not through MCP — tell the person:** Import / export: **Clients** ›
**Import** / ⋮ **Export**.

## Create

Console: **Clients** › **Create Client** (or **New client**). Card **Client Identity**:

| Field | Required | Limits | Note |
|---|---|---|---|
| **Name** | yes | 1–100, unique | "Enter Client Name" |

Refusals: `Reached the maximum number of clients (20). Delete one before creating a new client.` ·
`Name "<name>" is already in use by another client.` · `Name is required.`

Right after: toast `Client "<name>" created`, then **Client Secret — shown once** with the **Client Secret** and the
**Client ID**. The person copies both into the site's environment, then **I have copied it — open the client**. Only a
display prefix of the secret stays readable. The client is **Unassigned** until a key picks it.

## Change

Record lock for a rename and for Delete ([record locks](../../references/record-locks.md)); **Rotate secret** needs only
that nobody else holds the record.

- **Name & Credentials** card: **Name** is the only editable field → **Save**. Changes nothing that runs.
- Danger zone › **Rotate secret** › "Rotate the secret of "<name>"? It is retired immediately — any partner system still
  using it starts failing the moment you confirm." → the new secret is shown once (**I have copied it — dismiss**).

### How the change reaches what runs

A rotate takes effect at once: the old secret can no longer mint an application token. A token the site already holds
keeps working until the key itself changes — but the next mint (after a restart, a key rotate, a binding change) fails
until the site's `KEEN_CLIENT_SECRET` holds the new value. So: rotate → put the new secret into the site's environment →
redeploy / restart the site. See [delivering changes](../../references/delivering-changes.md).

## Delete

Danger zone › **Delete** › "Delete "<name>"?" (bound: "… It is unbound from its api key, which stops being fully bound —
its partner loses access until another client is bound."). A bound client CAN be deleted: every token of its key ends at
once and the key's site shows **Incomplete** until another client is bound. Cannot be undone.

## Import / Export

Supported. Carried: the name. Never carried: the secret, its prefix, the bound key. An imported client gets a new
secret nobody has seen: "Imported without a secret — Rotate to get one. The partner's server cannot sign in until then."
See [import / export](../../references/import-export.md).

## Mistakes that break it

| Mistake | What happens | Do instead |
|---|---|---|
| Losing the secret | it cannot be shown again | Rotate secret, update the site |
| Rotating without updating the site | the next restart cannot mint a token; maintenance page | rotate and redeploy together |
| Binding the key to a different client than the site's `KEEN_CLIENT_ID` | the token mint is refused | bind the client whose id the site holds |
| Deleting the client of a live site | every token of the key ends | bind a new client first, update the site, then delete |
| Pasting the secret into chat or a ticket | half of the site's credential leaks | copy it only into the site's secret store |

## Example

Goal: the Shop site's client secret was pasted into a public ticket.

1. Builder: `list_clients` → "Shop Client", bound to "Shop Key".
2. Builder tells the person: Clients › "Shop Client" › Danger zone › **Rotate secret** › confirm → copy the new
   **Client Secret** into the site's `KEEN_CLIENT_SECRET` → redeploy the site.
3. Builder: `get_api_key_site` on "Shop Key" → the instances reconnected and run. (Its application token was not cut by
   the rotate; the redeploy makes the site use the new secret from its next mint.)
