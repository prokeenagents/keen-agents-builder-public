# Certificates

## Description

A certificate is a tenant's signing material. It has two parts:

- an **RSA key pair** made by Keen. The **Public Key** (a PEM) is readable; the partner site verifies Keen-issued tokens
  with it. The private half never leaves Keen. **Folder ID** names where it is kept and the key id tokens are signed under.
- a **shared secret key** (16–32 characters) that both sides hold. Keen signs every webhook notice with it
  (`X-Keen-Signature`) and protects consumer tokens with it. It is shown once, at create; later it can be replaced, never read.

An API key binds one certificate ([api keys](../API%20Keys/api-keys-skill.md)). A key without one is not fully bound and
sends no webhook at all (nothing to sign with). A managed partner site receives the public key and the secret from Keen
at each start, over its own channel; a site not yet managed gets them by its webhook (on **Rebuild and refresh data**, or
by asking for them itself).

When the person needs it:
- a new partner site (step 2 of [the chain](../API%20Keys/api-keys-skill.md#one-partner-site--the-records-and-their-order));
- the shared secret leaked (**Replace secret key**) or the key pair must be renewed (**Rotate key material**).

## Who may

| Right | Opens |
|---|---|
| `ca1` | every Certificates page (name, public key, folder, bound key — never the secret) |
| `ca2` | Create, Save, Replace secret key, Rotate key material, Delete; and on Api Keys: binding or unbinding a certificate, rotating a key that has one, changing the webhook of such a key |
| `ce2` | **Rebuild resource cache** |

Owner and Administrator pass by role ([rights](../../references/rights.md)). Without `ca1`: "You don't have access to this
page". Without `ca2`: read-only, no Shared secret key card, no Danger zone; on an API key the certificate picker shows
**Needs the certificates write permission**. Certificates have no import / export rights.

### Why binding and unbinding both need `ca2`

The certificate's secret travels to wherever its key points: to the key's webhook URL and to every started instance of
the key's site (anyone holding the key's API Key Secret can run one). With only `ak2`, a person could bind a certificate
to a key whose secret or webhook they control, or rotate such a key and run an instance, and so receive the certificate's
secret. Unbinding changes the tenant's signing material too: every token of the key ends and the site stops receiving
signed notices. So all of these are a certificates decision: `ca2` (owner / admin by role). The refusal is
`Certificate write permission required!`.

## MFA

Every change needs the person's two-factor sign-in; else `MFA required!` / **Turn on two-factor sign-in first**
([sign-in and MFA](../../references/sign-in-and-mfa.md)). Why: with a stolen password one could replace the shared secret
(forging signed notices to the partner becomes possible for whoever chose it, and the live site stops verifying) or bind
the certificate somewhere it leaks.

## Through MCP

**Reachable through MCP: yes.** Writes need an MCP account signed in with its owner's code ([mcp](../../references/mcp.md)).

| Tool | What it does | Needs |
|---|---|---|
| `list_certificates` / `get_certificate` | list / read (public PEM, folder, `apiKeyId`; never the secret) | `ca1` |
| `create_certificate` | `{ name, secretKey }` — the reply carries the secret once | `ca2` |
| `update_certificate` | rename and / or replace `secretKey` (never clear it) | `ca2`, `lock_record { kind: 'certificate', id }` |
| `rotate_certificate` | new key pair, same id and folder; the secret unchanged | `ca2`; refused while another user holds it |
| `delete_certificate` | delete | `ca2`, lock |

Binding is done on the key: `update_api_key { certificateId }` (`null` unbinds; both need `ca2`).

When the builder creates one: generate 32 random letters and digits for `secretKey`, never repeat the value in the chat.
A managed site needs no one to copy it — Keen hands it to the site.

**Not through MCP — tell the person:** nothing is console-only. If the person prefers to choose the secret themselves:
**Certificates** › **Create Certificate** (the field is pre-filled; **Generate** makes a new one).

## Create

Console: **Certificates** › **Create Certificate** (or **New certificate**). Card **Certificate Details**:

| Field | Required | Limits | Note |
|---|---|---|---|
| **Name** | yes | 1–100, unique | "Enter Certificate Name" |
| **Secret Key** | yes | 16–32 characters, not one repeated character | pre-filled with a generated key; **Generate** re-fills it |

Refusals: `Reached the maximum number of certificates (20). Delete one before creating a new certificate.` ·
`Name "<name>" is already in use by another certificate.` · `Name is required.` · `Secret key is required.` ·
`Secret key must be between 16 and 32 characters.` · `Secret key must not be a single repeated character.`

Right after: toast `Certificate "<name>" created`, then **Copy the secret key now** — "It is shown only once. Afterwards
it can be replaced but never read again." → **I have copied it — open the certificate**. The key pair is made for it.

## Change

Record lock for Save, Replace secret key and Delete ([record locks](../../references/record-locks.md)); **Rotate key
material** needs only that nobody else holds the record.

- **Key Material** card: **Name** → **Save** (changes nothing that runs). **Certificate ID**, **Public Key**,
  **Folder ID**, **Bound API key** are read-only.
- **Shared secret key** card: **New secret key** (+ **Generate**) → **Replace secret key** → "Replace the secret key of
  "<name>"? Every consumer token of this tenant stops verifying, and the partner must fetch the certificate again. The
  partner site must switch to the new key at the same moment." → the new value is shown once.
- Danger zone › **Rotate key material** → "Rotate the key pair of "<name>"? Re-mints the key pair in place — same ID,
  same folder, new public key. Everything verifying against the OLD public key fails immediately."

### How the change reaches what runs

Immediately. A managed site's instances re-read the certificate at once (no restart); a site not yet managed gets the
`r_cert` notice and fetches it again. Consumers of the tenant may have to sign in again. See
[delivering changes](../../references/delivering-changes.md).

## Delete

Danger zone › **Delete** › "Delete "<name>"?" (bound: "… It is unbound from its api key, which stops being fully bound —
its partner loses access until another certificate is bound."). A bound certificate CAN be deleted: every token of its
key ends at once, the site gets `r_cert_delete`, and the key's site shows **Incomplete** until another certificate is
bound (which needs `ca2`). The key pair is destroyed; it cannot be undone.

## Import / Export

Not available for certificates — they are never exported or imported. On a new instance, create new ones and bind them.
See [import / export](../../references/import-export.md).

## Mistakes that break it

| Mistake | What happens | Do instead |
|---|---|---|
| A key with no certificate | no webhook is sent; Rebuild and refresh data refuses the key | bind one (with `ca2`) |
| Replacing the secret while a site not yet managed holds the old one | its notices fail to verify (`Webhook refused: mismatch`) until it re-fetches | replace, then **Rebuild and refresh data** on the key |
| Rotate key material "to be safe" during traffic | verification with the old public key fails at once | do it in a quiet window |
| Deleting the certificate of a live site | every token of the key ends; site Incomplete | bind a new one first, then delete |
| Showing the secret in chat | anyone can forge signed notices to the partner | let Keen deliver it; never echo it |

## Example

Goal: a new certificate for the site "Shop", bound to its existing key (the builder's MCP role has `ca2`).

1. Builder: `create_certificate { name: "Shop Cert", secretKey: <32 random letters and digits> }` — the value is not
   shown to anyone.
2. Builder: `get_api_key` on "Shop Key" → it has no certificate. `lock_record { kind: 'api_key', id }`,
   `update_api_key { id, certificateId: <new id> }`, `unlock_record`. Every token of the key ends; the site restarts.
3. Builder: `wake_api_key` (Rebuild and refresh data), then `get_api_key_site` → running.
4. Without `ca2` on the builder's role, tell the person (owner / admin): Api Keys › "Shop Key" › **Lock** › Certificate →
   "Shop Cert" › **Save**, then Application card › **Rebuild and refresh data**.
