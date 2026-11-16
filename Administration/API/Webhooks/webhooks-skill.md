# Webhooks

## Description

A webhook record is a partner site's address, as a named record an API key binds:

- **Origin** — the site's exact browser origin, `scheme://host[:port]`. It is the allow-list: a request (the site
  server's token request, the browser's chat socket) from any other origin is dropped. One record = one origin; one key
  holds one record, so a key accepts exactly one origin.
- **Webhook URL** — where Keen POSTs its change notices (server to server). For the reference partner site it is
  `https://<site>/api/keen-webhook/<KEEN_WEBHOOK_SECRET>`; the last part is the site's webhook secret, so treat the whole
  URL as a secret. A managed site gets that secret and its origin from Keen at each start.

What Keen sends to the URL (a small JSON notice `{"synch-data": [...]}`; the site then re-fetches what changed):

| Notice | Sent when | Why |
|---|---|---|
| `r_api_keys` | the key is created, changed, rotated; its client renamed or rotated | re-read the key's resources |
| `r_cert` / `r_cert_delete` | the bound certificate's secret or key pair changes / it is deleted | re-fetch the certificate |
| `r_consumer_policy` / `r_consumer_policy_delete` | the bound contract (name, key, policy, spaces) changes / is deleted | re-read the contract and policy |
| `r_consumer_spaces_update`, `r_consumer_contract_changed` | one consumer's spaces or contract changed (carries the consumer id) | refresh that user's session |
| `r_space`, `r_agent`, `r_json` | **Rebuild and refresh data** on a key whose site is not managed (the certificate is sent first), and the key's Delete / Disable / Enable | re-read spaces, agents and agent front settings |

A managed site (one connected through Keen's site channel) gets space, agent and front-settings changes over that
channel instead, when the person presses **Rebuild and refresh data**. A front-settings save on an agent does not
notify the site by itself.

Every POST is signed (`X-Keen-Signature`, HMAC under the bound certificate's secret key); a key without a certificate
sends nothing. Keen posts only to `https://` (plain `http://` only for a host the operator allow-listed), never to a
private address, follows no redirect, and gives up after 5 seconds.

When the person needs it: step 5 of a new site ([the chain](../API%20Keys/api-keys-skill.md#one-partner-site--the-records-and-their-order));
the site moves to a new domain; the site's webhook secret changes.

## Who may

| Right | Opens |
|---|---|
| `wk1` | every Webhooks page (the full URLs included) |
| `wk2` | Create, Save, Delete |
| `wk3` / `wk4` | Import / Export |
| `ca2` | also needed to change the URL of a webhook bound to a key that has a certificate |
| `ce2` | **Rebuild resource cache** |

Owner and Administrator pass by role ([rights](../../references/rights.md)). Without `wk1`: "You don't have access to this
page". Without `wk2`: read-only, no Danger zone.

## MFA

Every change, import and export needs the person's two-factor sign-in; else `MFA required!` /
**Turn on two-factor sign-in first** ([sign-in and MFA](../../references/sign-in-and-mfa.md)). Why: with a stolen password
one could point a bound URL at their own server (Keen's signed notices — and, for a site not yet managed, the
certificate — would go there), or move the origin so another site is accepted for the tenant.

## Through MCP

**Reachable through MCP: yes.** Writes need an MCP account signed in with its owner's code ([mcp](../../references/mcp.md));
update and delete need `lock_record { kind: 'webhook', id }` first.

| Tool | What it does | Needs |
|---|---|---|
| `list_webhooks` / `get_webhook` | list / read (name, origin, URL, `apiKeyId`) | `wk1` |
| `create_webhook` | `{ name, origin, webhook }`, created unassigned | `wk2` |
| `update_webhook` | partial: name / origin / URL | `wk2`, lock (+ `ca2` for the URL of a key with a certificate) |
| `delete_webhook` | delete an unbound record | `wk2`, lock |

Binding is done on the key: `update_api_key { webhookId }`.

**Not through MCP — tell the person:** the URL carries the site's webhook secret. Unless the person agrees that it passes
through the chat, ask them to type it: **Webhooks** › **Create Webhook** (or the record › **Lock** › Webhook URL › **Save**).
Import / export: **Webhooks** › **Import** / ⋮ **Export**.

## Create

Console: **Webhooks** › **Create Webhook** (or **New webhook**). Card **Delivery Target**:

| Field | Required | Limits | Note |
|---|---|---|---|
| **Name** | yes | 1–100, unique | "Enter Webhook Name" |
| **Origin** | yes | ≤ 200; `scheme://host[:port]`, no path, no trailing slash; unique | port matters: `https://site.example.com` is not `https://site.example.com:8443` |
| **Webhook URL** | yes | ≤ 500; a full URL without user / password; https (http only for an allow-listed host); unique | the reference site: `…/api/keen-webhook/<KEEN_WEBHOOK_SECRET>` |

Refusals: `Name "<name>" is already in use by another webhook.` · `Origin "<origin>" is already in use by another webhook.` ·
`Webhook URL "<url>" is already in use by another webhook.` ·
`Origin must be scheme://host[:port] — no path, no trailing slash.` ·
`Webhook must be an https:// URL (http:// only for a host the operator allow-listed).`

Right after: toast `Webhook "<name>" created`; the record is **Unassigned** until an API key picks it.

## Change

Record lock first ([record locks](../../references/record-locks.md)). **Target & Binding** card: **Name**, **Origin**,
**Webhook URL** → **Save**. **Bound API key** is read-only (set on the key).

### How the change reaches what runs

On a bound record, immediately:

| Field | Effect |
|---|---|
| Origin | every token of the bound key ends; its site instances restart; the new origin is allowed, the old one dropped at once |
| Webhook URL | the site's instances restart with the new webhook secret; the next notices go to the new URL |
| Name | nothing |

An unbound record affects nothing. Moving a site to a new domain: change the origin and the site's address together,
then expect every user to sign in again. See [delivering changes](../../references/delivering-changes.md).

## Delete

Danger zone › **Delete** › "Delete "<name>"?". A bound record cannot be deleted: the button is disabled with
"Bound to <key> — clear it from the api key's own form (— No webhook —), save, then delete." (the gateway answers
`Webhook "<name>" is bound to an api key. Unbind it there first.`). Unbinding it on the key ends every token of that key
and leaves it half-wired. Delete cannot be undone.

## Import / Export

Supported. Carried: name, origin, the URL **masked** — its last path part and query are replaced. Never carried: the
bound key. An imported record shows "Re-enter the URL — The import masked its secret part. No API key can bind this
webhook until then."; binding it answers `Re-enter the webhook URL first!`. See
[import / export](../../references/import-export.md).

## Mistakes that break it

| Mistake | What happens | Do instead |
|---|---|---|
| Origin with a path or a trailing `/` | refused | `https://shop.example.com` exactly |
| Origin = the hosting provider's address while users use a custom domain | token requests and chat from the domain are dropped (silent 502, maintenance page) | the origin is the address users open |
| URL that does not reach the site (wrong host, bad TLS) | notices and the certificate never arrive | use a URL that answers over valid HTTPS |
| URL without the site's secret part | the site refuses every notice | append `/<KEEN_WEBHOOK_SECRET>` |
| Editing the origin of a live site casually | every user is signed out | change it only with the domain move |
| Showing the URL in chat or a ticket | the site's webhook secret leaks | treat it as a secret |

## Example

Goal: the site "Shop" moves from `https://shop-old.example.com` to `https://shop.example.com`.

1. Builder: `list_webhooks` → the record bound to "Shop Key"; `get_api_key` confirms the binding.
2. Builder tells the person: every Shop user will be signed out once; their site must answer on the new domain first.
3. Builder: `lock_record { kind: 'webhook', id }`, `update_webhook { id, origin: "https://shop.example.com" }`,
   `unlock_record`. (The URL carries a secret — if it changes too, the person edits it: **Webhooks** › the record ›
   **Lock** › **Webhook URL** › **Save**.)
4. Builder: `get_api_key_site` → the instances restarted and are running.
