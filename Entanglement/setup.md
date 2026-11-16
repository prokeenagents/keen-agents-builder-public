# Setting up the site

The order for a site on the person's machine. The Keen records come first — the builder makes them through MCP
([golden path](../MCP/golden-path.md) §3–8) or the person in the console
([api-keys › One partner site](../Administration/API/API%20Keys/api-keys-skill.md)). Which value goes in which
git-ignored file across the whole project: [ProjectSetup/values.md](../ProjectSetup/values.md); the project order:
[ProjectSetup/first-setup.md](../ProjectSetup/first-setup.md) §6–7.

## 1. Get it

- The site's folder is `application_dir` in the workspace's `keen-project.json`
  ([keen-project.md](../ProjectSetup/keen-project.md)); read it first. No site yet: the console's Home page ›
  **Get started** › **Download Site** — a zip of the reference site. Unpack it into its own folder (`my-site/`) and
  write that folder into `application_dir`. A copy whose `.env.example` has no `KEEN_WEBHOOK_SECRET` line, or whose `package.json` has no
  `dev:managed` script, is outdated: download a fresh one.
- The person may keep their own fork; when updating it, overlay the new files — never replace the folder (their
  `.env.local` and changes live there).
- Node **22.9 or newer** (`engines` in `package.json`; the pre-process needs Node's built-in WebSocket client). The
  image uses Node 24.
- `npm install` once in the folder. It installs the pre-process too — the package `@keenagents/keen-site`, whose bin
  `keen-site` the scripts run (`"start": "keen-site"`, `"dev:managed": "KEEN_SITE_CHILD=dev keen-site --dotenv .env.local"`;
  [pre-process.md](pre-process.md) §0). The reference site today still carries its own copy in `keen-site/` and runs
  `node keen-site/index.mjs` until it switches — the same behaviour.

## 2. The environment — `.env.local`

`cp .env.example .env.local`, then fill it. `.env.local` is git-ignored; never commit it, never print it, never read
it unless you wrote it. Every value is **server-only** (no `NEXT_PUBLIC_` prefix): Next never puts it in the browser
bundle. Do not move them into `next.config` (its `env` key inlines values into the browser bundle).

| Name | Value | Where it comes from | Secret? |
|---|---|---|---|
| `KEEN_HOST` | `https://keen.example.com` — a full URL with the scheme (a bare host refuses to boot) | `server` in `keen-project.json` | no |
| `KEEN_API_KEY_ID` | the key's id | the **Api Key ID** shown after Create (`create_api_key`'s reply) | no (useless alone) |
| `KEEN_API_KEY_SECRET` | `kak_…` | the **Api Key** shown **once** after Create / Rotate | **yes** |
| `KEEN_CLIENT_ID` | the client's id | the client record | no |
| `KEEN_CLIENT_SECRET` | the client's secret | shown **once** after the client's Create / Rotate secret | **yes** |
| `KEEN_ORIGIN` | the site's public origin, `https://site.example.com` (no path, no trailing slash) | `application` in `keen-project.json` (§4 below); under site control Keen also hands it over at each start and its value wins | no |
| `KEEN_WEBHOOK_SECRET` | ≥ 32 characters, e.g. 64 hex (`openssl rand -hex 32`) | chosen by the person; the same value is the last segment of the webhook URL | **yes** |
| `KEEN_WS` | `wss://keen.example.com/ws-keen` | optional: under site control it is derived from `KEEN_HOST`; point it at Keen, **never through the tunnel** | no |
| the site's own keys (e.g. `ELEVENLABS_API_KEY`) | — | **leave empty**: they belong in the API key's **Secrets** card ([secrets](../Administration/references/secrets-and-credentials.md)) | yes |
| `TRUSTED_PROXY_HOPS` | how many proxies append to `X-Forwarded-For` (the per-address rate limits key on it); default `1` (ngrok, nginx, Cloud Run); `2` behind an external load balancer | optional; too high keys on a spoofable entry | no |
| `KEEN_SITE_CHILD_PORT` and the other `KEEN_SITE_*` | optional pre-process settings | [pre-process.md](pre-process.md) §7 | no |

- The first five are the **container values**: the site needs them to reach Keen, and they are never Secrets (Keen
  refuses `KEEN_*` names there, and the pre-process ignores one).
- `KEEN_ORIGIN` and `KEEN_WEBHOOK_SECRET` come from Keen's launch set under site control; keep them in `.env.local`
  anyway during 15.3 (a Keen without site control runs the site in legacy mode, on them). If they differ from Keen's,
  Keen's win and the log says `WARN: Keen's KEEN_ORIGIN replaces the container's value.`
- The site's Next server refuses to start in production with any of `KEEN_HOST`, `KEEN_ORIGIN`, `KEEN_CLIENT_ID`,
  `KEEN_CLIENT_SECRET`, `KEEN_API_KEY_ID`, `KEEN_API_KEY_SECRET`, `KEEN_WEBHOOK_SECRET` missing
  (`Keen config missing from the environment: …`), or with a webhook secret under 32 characters.
- Write a secret straight into `.env.local` from the tool reply that carries it; never repeat it in the chat. If you
  cannot write the file, let the person copy it there from the console.

## 3. The Keen records the site is bound to

One API key, four bindings ([api-keys](../Administration/API/API%20Keys/api-keys-skill.md)):

| Binding | For the site |
|---|---|
| **Webhook** | **origin** = the site's public origin, exactly; **Webhook URL** = `https://site.example.com/api/keen-webhook/<KEEN_WEBHOOK_SECRET>` ([webhooks](../Administration/API/Webhooks/webhooks-skill.md)) |
| **Client** | `KEEN_CLIENT_ID` / `KEEN_CLIENT_SECRET` ([clients](../Administration/API/Clients/clients-skill.md)) |
| **Certificate** | with a shared secret key — it signs Keen's webhook POSTs; Keen hands it to the site at each start ([certificates](../Administration/API/Certificates/certificates-skill.md)) |
| **Consumer contract** | which spaces the site's users get, sign-up and login policy ([contracts](../Administration/API/Contracts/contracts-skill.md)) — [running.md](running.md) §4 |

The webhook URL is a secret (its last segment is `KEEN_WEBHOOK_SECRET`): never echo it. Keen accepts only `https://`
webhook URLs (`http://` only for a host the Keen operator allow-listed).

## 4. The public address — a tunnel on the person's machine

The site must be reachable at a **public `https://` address**, and that address is its **origin** — `application`
in `keen-project.json`. On a server or a
cloud service it is the service's own address ([cloud-run.md](cloud-run.md) — no tunnel there). On the person's
machine it is a **tunnel** to the port the pre-process prints at start (`[keen-site] Listening on 0.0.0.0:<port>`):

- **Cloudflare Tunnel** (`cloudflared`): a named tunnel with a fixed hostname on the person's domain
  (`site.example.com` → the printed port). The address stays the same across restarts — the best choice for a site
  that runs every day. A quick tunnel gives a random `trycloudflare.com` address that changes each time.
- **ngrok** (`ngrok http <port>` → `https://<id>.ngrok-free.app`), or a similar service. A free ngrok address changes
  on every restart unless the account has a fixed domain.

Point the tunnel at the **pre-process's port**, never at Next's internal port (Next listens internally only, and
without the pre-process there is no site control).

Why a local address does not work — "localhost" or any address only the person's machine can open:

1. **The webhook URL.** Keen POSTs its notices (consumer sign-outs, contract and space changes, completion callbacks,
   and in legacy mode the certificate) from its own servers. It cannot reach an address on the person's machine,
   and it accepts only `https://` webhook URLs.
2. **The relay's origin allow-list.** The relay admits a browser's chat socket, and Keen accepts the site's token
   request, only when the `Origin` equals the origin of a webhook record bound to a fully bound API key — byte for
   byte (scheme, host, port). The site sends `KEEN_ORIGIN` as that Origin; the browser sends the address it opened.
   Both must be the public one.
3. **`wss` from an `https` page.** The chat runs over `wss://` to Keen; a browser on the public `https` page may open
   it, and the session cookies are `Secure` in a production build (sent only over https).
4. **E-mail links.** Registration, password reset and password change links are built from `KEEN_ORIGIN`; an end user
   clicking a local address reaches nothing.

The chat socket goes from the browser straight to Keen — never through the tunnel (a free tunnel may refuse a
browser WebSocket upgrade). Only pages, `/api/*` and Keen's webhooks ride the tunnel.

**When the address changes** (a free tunnel restarted, a move): move the origin everywhere together — `application` in
`keen-project.json` first, then the webhook record (both fields), `KEEN_ORIGIN`, the project's `.env`, then **Rebuild and refresh data**
([golden path › When the site's address changes](../MCP/golden-path.md)). A new origin on the bound webhook ends every
token of the key: open chats end, users sign in again. Prefer a fixed address.

## 5. First start

1. The records exist and the key is **fully bound** (all four).
2. `.env.local` holds the five container values (+ `KEEN_ORIGIN`, `KEEN_WEBHOOK_SECRET`).
3. Start it under site control **from the site's folder**: `npm run dev:managed` while developing, or `npm run build`
   then `npm start` ([running.md](running.md) §1). Read the port it prints; start the tunnel to it.
4. The key is new, so the site **waits**: the Application card shows **Waiting for start**, the instance appears in
   its list with its address, and the site serves the maintenance page. The person checks the address and presses
   **Start** (console only — MCP's start is refused while held).
5. **Rebuild and refresh data** once (`wake_api_key`) after the bindings — and after every later change to what the
   key binds.

## 6. What success looks like

In the site's log (managed mode):

```
[keen-site] Mode managed — site control by Keen. Instance <host>-<id> (node, site <version>, Node <version>).
[keen-site] Listening on 0.0.0.0:<port>; Next on <internal address>:<child port>.
[keen-site] Starting Next (Keen's state <12 characters>).
[keen-site] Secrets (version <n>): ELEVENLABS_API_KEY.
[OK] Certificate received.
[keen] application_token acquired (attempt 1)
[BOOT] Application activated: true
```

- `get_api_key_site { id }` → `run: running`, `held: false`, one instance on the current configuration; the card
  shows **Running** and the instance **Running**, **On the current configuration**.
- The public address opens the sign-in page; a test user registers (contract policy permitting), signs in and chats.
- `Mode legacy — …` instead means the pre-process is not under site control ([pre-process.md](pre-process.md) §2).
