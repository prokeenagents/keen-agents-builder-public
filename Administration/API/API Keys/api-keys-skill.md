# Api Keys

## Description

An API key is the partner application's credential and its control point. One key belongs to one partner site (an
Entanglement-style Next app). The key binds four sibling records, one of each:

| Binding | What it gives the key |
|---|---|
| **Webhook** ([webhooks](../Webhooks/webhooks-skill.md)) | the site's exact browser origin (the allow-list) and the URL Keen notifies |
| **Client** ([clients](../Clients/clients-skill.md)) | the site server's identity (client id + secret) |
| **Certificate** ([certificates](../Certificates/certificates-skill.md)) | the signing material and the shared secret key |
| **Consumer contract** ([contracts](../Contracts/contracts-skill.md)) | the tenant: its spaces, its registration and login policy |

A key with all four is **Fully bound**; with one to three, **Half-wired**; with none, **Not bound**. Only a fully bound
key lets the site mint its application token, and only then does its origin pass.

The key is also where the person runs the site: the **Application** card lists every connected site instance (at most
50 per key; the 51st is refused until one disconnects) and has Start / Stop / Restart and **Rebuild and refresh data**;
the **Secrets** card holds values the site gets as environment variables when it starts.

The two kinds of values a site gets from Keen: the key's **Secrets** are delivered to the site, which restarts to take
them, and the site's own server code (its API routes, e.g. a route that calls a voice service with
`process.env.ELEVENLABS_API_KEY`) uses them — never the browser. The agents' **Front Settings** hold plain values only
(e.g. `{ "service_available": true, "service_title": "My Service" }`); the site turns a connector on or off from them
and re-reads them on **Rebuild and refresh data**.

When the person needs it:
- a new partner site goes live (build the chain below, then create the key);
- the site's third-party keys (for example `ELEVENLABS_API_KEY`) must reach it without living in the container;
- spaces, agents or front settings changed and the site must re-read them;
- the site must be stopped (maintenance), restarted, disabled at once, or its secret was leaked (Rotate key).

### One partner site — the records and their order

1. The **space** and its **agents** exist ([spaces](../../AI/Spaces/spaces-skill.md), [agents](../../AI/Agents/agents-skill.md)).
2. A **Certificate** (name + a 16–32 character shared secret key).
3. A **Client** (its secret is shown once → the site's `KEEN_CLIENT_SECRET`; the id → `KEEN_CLIENT_ID`).
4. A **Consumer contract**: assign the spaces, set the defaults and the policy.
5. A **Webhook**: origin = the site's exact address; URL = `https://<site>/api/keen-webhook/<a random secret>`.
6. The **API key**, binding all four. Its Key Secret is shown once → the site's `KEEN_API_KEY_SECRET`; the Api Key ID → `KEEN_API_KEY_ID`.
7. The **Secrets** card: the site's other secrets.
8. The site is deployed with `KEEN_HOST`, `KEEN_API_KEY_ID`, `KEEN_API_KEY_SECRET`, `KEEN_CLIENT_ID`, `KEEN_CLIENT_SECRET`.
   Its instances connect and show **Waiting for start**; a person presses **Start**.

The site gets its origin, its webhook secret, the certificate and the Secrets from Keen at each start.

## Who may

| Right | Opens |
|---|---|
| `ak1` | every Api Keys page, the Application card (read), the Secrets card's names and history |
| `ak2` | Create, Save, Disable / Enable, Rotate key, Delete, Start / Stop / Restart, Rebuild and refresh data, Secrets Save |
| `ca2` | also needed to bind or unbind a certificate, to rotate a key that has one, and to change the webhook of a key that has one |
| `ce2` | the header's **Rebuild resource cache** (rebuilds without telling the site) |
| read rights of the siblings (`wk1`, `ct1`, `ca1`, `co1`) | fill the four binding pickers |

Owner and Administrator pass every check by role. Rights in detail: [rights](../../references/rights.md).

- Without `ak1` the person sees "You don't have access to this page".
- Without `ak2` the record is read-only: no Danger zone, no buttons on the Application card, no Save on Secrets.
- Without `ca2` (with `ak2`) the certificate picker is closed with **Needs the certificates write permission**, and so
  are Rotate key and the webhook picker of a key that has a certificate.
- Without read on a sibling, that one picker shows "Choices unavailable — requires … read permission."
- No API key is protected; any `ak2` holder may delete any key.

## MFA

Every change here needs the person's own two-factor sign-in (reads do not). Without it the gateway answers
`MFA required!` and the console shows **Turn on two-factor sign-in first** (link to My Account › Security). See
[sign-in and MFA](../../references/sign-in-and-mfa.md).

Why: a stolen password with `ak2` could rotate a key and take the new Key Secret — and whoever holds that secret can run a
site instance that receives the key's Secrets and its certificate once started. It could also re-point the bindings,
stop the partner's site, or delete the key. A **Start** after a Create or a Rotate is allowed only to a person in the
console, with MFA — never over MCP.

## Through MCP

**Reachable through MCP: partly.** Every write needs an MCP account signed in with its owner's code (see
[mcp](../../references/mcp.md)); class R tools need `lock_record { kind: 'api_key', id }` first.

| Tool | What it does | Needs |
|---|---|---|
| `list_api_keys` / `get_api_key` | list / read keys (prefix, bindings, `enabled`, `siteControl`) | `ak1` |
| `create_api_key` | create a key with optional bindings; the site then waits for a person's Start | `ak2` (+ `ca2` with a certificate) |
| `update_api_key` | rename, re-point or unbind (`null`) bindings | `ak2`, lock (+ `ca2` for a certificate, or the webhook of a key with one) |
| `rotate_api_key` | new Key Secret; the old one and every token stop at once | `ak2`, lock (+ `ca2` if it has a certificate) |
| `set_api_key_enabled` | Disable (`false`) / Enable (`true`) | `ak2`, lock |
| `delete_api_key` | delete the key | `ak2`, lock |
| `wake_api_key` | **Rebuild and refresh data** | `ak2`; refused while another user holds the key |
| `get_api_key_site` | the Application card's view (`run`, `held`, instances) | `ak1` |
| `set_api_key_site` | `start` / `stop` / `restart` every instance | `ak2`, lock; `start` refused while held |
| `list_api_key_secrets` | the Secrets card's NAMES, versions, `pending`, limits, history | `ak1` |
| `rebuild_api_key_cache` | rebuild the key's bound records without telling the site (rarely needed) | `ce2` |

Confirm with the person before `rotate_api_key`, `delete_api_key`, `set_api_key_enabled false` and `set_api_key_site`.

**Not through MCP — tell the person:**
- **Start after a Create or a Rotate** ("Waiting for start"): Api Keys › List › the key › Application card › **Start**,
  read the waiting instances' addresses, confirm.
- **Secret values**: Api Keys › the key › **Lock** › Secrets › **Add secret** → Name, Value → **Save** (or **Save and restart**).
  Values are typed only there; the browser encrypts them. Never ask for a value in the chat.
- **The Key Secret**: `create_api_key` and `rotate_api_key` answer the plaintext once. Write it straight into the
  git-ignored env file it belongs in (the site's `.env.local` as `KEEN_API_KEY_SECRET`, the runner's `.env`) and never
  repeat it in the chat. If you cannot write those files, let the person create / rotate in the console and copy it there.

## Create

Console: **Api Keys** › **Create Api Key** (or the list's **New api key**). One card, **Credential Details**:

| Field | Required | Limits | Note |
|---|---|---|---|
| **Name** | yes | 1–100 characters, unique | "Enter Api Key Name" |
| **Webhook** | no | unassigned webhooks only | a masked (imported) webhook is refused |
| **Client** | no | unassigned clients only | |
| **Certificate** | no | unassigned certificates only | needs `ca2` |
| **Consumer contract** | no | unassigned contracts only | |

Refusals, verbatim:
- `Reached the maximum number of api keys (20). Revoke an existing one before creating a new key.`
- `Name "<name>" is already in use by another api key.` · `Name is required.`
- `Webhook "<id>" is already bound to another api key.` (and `Client …`, `Certificate …`, `Consumer contract …`)
- `Webhook "<id>" does not exist.` (and the three siblings) · `Re-enter the webhook URL first!`
- `Certificate write permission required!`

Right after: **Copy this key now — it will not be shown again**, with the **Api Key** value and the **Api Key ID**. The
person puts them into the site's `KEEN_API_KEY_SECRET` / `KEEN_API_KEY_ID`, then **I have copied it — open the api key**.
A new key starts **held**: its Application card shows **Waiting for start** until a person presses Start.

## Change

Every change needs the record lock (**Lock** in the banner; see [record locks](../../references/record-locks.md)).
Rebuild and refresh data needs only that nobody else holds it.

**Bindings & Key Material** card: rename, or pick another binding (the empty option unbinds) → **Save**.
A rename changes nothing that runs. **Any binding change ends every token of the key at once** and restarts every site
instance with the new set; a key left half-wired shows **Incomplete** ("Bind a … first.").

**Application** card (keys with site control):

| Button | What it does |
|---|---|
| **Start** (while stopped) | every instance runs the site; while **Waiting for start** it first asks, naming the waiting count — check the addresses |
| **Stop** | every instance shows the maintenance page; open chats are NOT ended (Disable for that) |
| **Restart** | every instance is away a few seconds and re-reads its configuration; refused while stopped or held |
| **Rebuild and refresh data** | Keen rebuilds its cache of everything bound to the key, then every connected instance re-reads it. No restart, no chat ends |

A key from before release 15.3 shows **Site control is off for this key** — it runs on its own environment until its next
**Rotate key**. Then only Rebuild and refresh data is offered.

**Secrets** card: rows of Name + Value. Name: capital letters, digits and `_`, starting with a letter, ≤ 128; never
`KEEN_*`, `NEXT_*`, `NODE_*`, `NEXT_PUBLIC_*`, `PATH`, `PORT`, proxies and other reserved names. Limits: 50 secrets,
8192 bytes a value, 65536 bytes a key. **Save** stores them; the line "Saved changes are not running yet — restart the
site to apply them." stays until a Start / Restart. **Save and restart** (only while running) applies them now. Saved
values are never shown again ("Saved — type to replace"). **Show history (n)** lists who set / replaced / removed what.
Row refusals name the row: `Row <n>: …` (e.g. `Row 3: "NAME" appears twice.`). A key without site control shows
"Rotate the key once to use secrets." The history is kept 400 days. If the site's container already has a variable of
the same name, Keen's value wins and the site logs a warning once per start — remove the container's line. The five
values the site needs to reach Keen (`KEEN_HOST`, `KEEN_API_KEY_ID`, `KEEN_API_KEY_SECRET`, `KEEN_CLIENT_ID`,
`KEEN_CLIENT_SECRET`) are never Secrets — they stay in the site's own environment.

**Danger zone**:

| Button | What stops at once |
|---|---|
| **Disable** | the partner application: every open chat ends, every token stops, no new token until **Enable**; instances wait and start again by themselves after Enable |
| **Rotate key** | the old Key Secret and every token under it; every instance disconnects ("The service is temporarily unavailable") until its environment holds the new key; then the site waits for a person's Start |
| **Delete** | see Delete below |

Rotate key: the new key is shown once → the person puts it into the site's `KEEN_API_KEY_SECRET`, restarts the site's
container, then presses **Start** on the Application card.

Refusals of the site buttons: `Enable the key first.` · `This api key cannot control a site yet — no … bound.` ·
`The site is stopped — start it instead.` · `The site waits for a person to start it after a new key secret!` ·
`This api key has no site control yet — rotate it once to turn it on.` Rebuild and refresh data on a half-wired key:
`API key not found or not fully configured — bind its client, certificate, contract and webhook, then rebuild.`

### How the change reaches what runs

| Change | Reaches the site |
|---|---|
| a binding changed, Disable, Rotate, Delete | immediately — tokens end, instances close or restart |
| Start / Stop / Restart | within a second on every instance |
| a space / agent / front settings / contract change | after **Rebuild and refresh data** (a contract change also on its own) |
| Secrets saved | at the next Start / Restart (or **Save and restart**) |

More: [delivering changes](../../references/delivering-changes.md).

## Delete

Danger zone › **Delete** › the question "Delete "<name>"? The partner application stops at once: every open chat ends
and every token issued under this key stops working. Its webhook, client, certificate and contract stay and become free.
Every instance of the site disconnects and stays unavailable." The key's Secrets go with it. It cannot be undone; the
partner needs a new key (and its secret in the site) to start again.

## Import / Export

Not available for API keys. Their bound webhooks, clients and contracts export on their own pages; certificates never
do. See [import / export](../../references/import-export.md).

## Mistakes that break it

| Mistake | What happens | Do instead |
|---|---|---|
| Webhook origin ≠ the site's real address (scheme, host, port) | the site's token request is dropped; maintenance page, `application_token attempt N failed` | origin = exactly `https://<site>`, no path, no slash |
| Rotating without updating the site | every instance stays unavailable ("key rotated") | rotate → new secret into `KEEN_API_KEY_SECRET` → redeploy → Start |
| Waiting for the site to start by itself after Create / Rotate | it stays **Waiting for start** | a person presses Start in the console |
| Stop to end chats | chats go on | Disable |
| Re-binding a client / certificate / contract "just to check" | every token ends, the site restarts | change bindings only on purpose |
| A secret named `KEEN_…` / `NEXT_PUBLIC_…` | `Row <n>: names starting with … are reserved …` | use the app's own name |
| Expecting a saved secret to be live | it waits for a restart | **Save and restart**, or Restart later |
| Changing spaces / agents and not refreshing | the site shows the old set | **Rebuild and refresh data** |

## Example

Goal: the person's new site `https://shop.example.com` must chat with the "Support" agent of space "Shop".

1. Builder: `list_spaces`, `list_agents` — confirm the space and agent exist.
2. Builder: `create_certificate { name: "Shop Cert", secretKey: <32 random chars> }` — never repeat the value.
3. Builder: `create_consumer_contract { name: "Shop Contract" }`, `lock_record { kind: 'consumer_contract', id }`,
   `assign_contract_spaces`, `assign_contract_default_outside_spaces`, `update_consumer_contract_policy`, `unlock_record`.
4. Person: **Clients** › **Create Client** › Name "Shop Client" › **Create** → copy the secret and the Client ID into the site's environment.
5. Person: **Webhooks** › **Create Webhook** › Name "Shop", Origin `https://shop.example.com`,
   Webhook URL `https://shop.example.com/api/keen-webhook/<their random secret>` › **Create**.
6. Person: **Api Keys** › **Create Api Key** › Name "Shop Key", pick the four bindings › **Create** → copy the Api Key and
   the Api Key ID into the site's environment.
7. Person: on the key › **Lock** › Secrets › **Add secret** `ELEVENLABS_API_KEY` + value › **Save**.
8. Person deploys the site. Builder: `get_api_key_site` → `held: true`, instances listed; tell the person:
   Application card › **Start** › check the addresses › confirm.
9. Builder: `get_api_key_site` → `run: running`. Later changes to the space: `wake_api_key`.
