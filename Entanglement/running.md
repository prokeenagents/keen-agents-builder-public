# Running the site — start, stop, watch, fix

## 1. Starting it

| Command | What runs | Site control |
|---|---|---|
| `npm run dev:managed` | the pre-process (`KEEN_SITE_CHILD=dev keen-site --dotenv .env.local`); `.env.local` loaded first; Next as `next dev` behind it | **yes** — the reference setup while developing |
| `npm run build`, then `npm start` | the pre-process (`keen-site`); Next as `next start` (or `node server.js` from the standalone output in an image) | **yes** — a production run |
| `npm run dev` | Next alone, `.env.local` | **no** — no Start / Stop, no Secrets from Keen, not on the Application card |
| `npm run start:next` | Next alone (`next start`) | no |

The pre-process is the package `@keenagents/keen-site` (its bin `keen-site`, [pre-process.md](pre-process.md) §0). The
reference site today still carries its own copy until it switches: there the scripts read
`KEEN_SITE_CHILD=dev node --env-file-if-exists=.env.local keen-site/index.mjs` and `node keen-site/index.mjs` — the same
behaviour. `keen-site` runs from the site's folder (npm scripts do), which is where it looks for `next`, `server.js`,
`package.json` and the site's own pages.

`npm start` does not load `.env.local` itself — the environment must already hold the values (a service's
environment file, the container's env). `dev:managed` loads it (`keen-site --dotenv .env.local`: only if the file
exists, a value already in the environment wins). Never write `keen-site --env-file …`: Node itself reads that option
and exits when the file is missing — the bin refuses it with that reason.

### The reference setup — a managed site on a machine

The setup Keen's own reference site runs today, in generic terms:

- The site folder (`my-site/`) runs **`npm run dev:managed`**. Under `next dev` add the site's public hostname to `allowedDevOrigins` in `next.config.ts`
  (else Next blocks its own hot-reload from that host), then restart Next (Keen's **Restart** does it). The pre-process holds the public port; `next dev` runs
  as its child on another port, set with **`KEEN_SITE_CHILD_PORT`** in `.env.local` (any free port ≠ `PORT`).
- It runs as a **supervised service that restarts on failure** — a systemd **user** service (`Restart=on-failure`,
  `WorkingDirectory=` the site folder — the pre-process takes everything from the folder it starts in —, `ExecStart=`
  `npm run dev:managed`), or a process manager (pm2 or similar). The
  supervisor restarts the pre-process if it exits with an error; the pre-process itself restarts a crashing Next
  (§ pre-process 4). A clean stop (SIGTERM) exits 0 and is not restarted.
- A **tunnel** (Cloudflare Tunnel or ngrok) maps the public `https://site.example.com` to the pre-process's port
  ([setup.md](setup.md) §4). Run the tunnel as a service too, so both come back after a reboot.
- **Keen drives it** through the API key's **Application** card: Start / Stop / Restart / Rebuild and refresh data.
- **Its secrets** come from the API key's **Secrets** card — `.env.local` holds only the five container values (plus
  `KEEN_ORIGIN`, `KEEN_WEBHOOK_SECRET`, `KEEN_SITE_CHILD_PORT`).

The person sets up the service and the tunnel on their machine (the builder if it has a shell there). Never start or
stop it by process name — by its service, or by the PID that owns its port.

## 2. Stopping and restarting — from Keen vs on the machine

| Want | From Keen (every instance at once) | On the machine |
|---|---|---|
| maintenance page, process stays up | **Stop** (card) / `set_api_key_site { id, command: 'stop' }` — open chats go on | — |
| bring it back | **Start** / `set_api_key_site … 'start'` | — |
| re-read configuration, take saved Secrets | **Restart** / `… 'restart'`, or **Save and restart** on Secrets | restarting the service also does it |
| new data, no restart | **Rebuild and refresh data** / `wake_api_key { id }` | — |
| end every chat and token now | **Disable** (Danger zone) / `set_api_key_enabled { enabled: false }` | stopping the service does NOT end chats (they run on Keen) |
| a changed `.env.local` / container value | — | **restart the service** (Keen cannot change the five container values) |
| new `KEEN_API_KEY_SECRET` after a Rotate | — | write it, restart the service, then a person presses **Start** |

MCP: `set_api_key_site` needs `ak2` and the record lock (`lock_record { kind: 'api_key', id }` first), and the
person's confirmation. Its `start` is refused while the key is held: `The site waits for a person to start it after
a new key secret!` — tell the person to press Start in the console. Other refusals: `Enable the key first.` ·
`The site is stopped — start it instead.` (Restart while stopped) · `This api key has no site control yet — rotate it
once to turn it on.` Details: [api-keys](../Administration/API/API%20Keys/api-keys-skill.md),
[tools](../MCP/tools.md).

## 3. Where to see it — the Application card

**Api Keys** › the key › **Application** (MCP `get_api_key_site { id }` → `run`, `held`, instances):

- **The badge:** **Running** · **Stopped** · **Waiting for start** (held after Create / Rotate; the line names the
  waiting instances) · **Disabled** · **Incomplete** ("Bind a … first.").
- **Last:** `Last: Started by <who> at <time>` (Stopped, Restarted, Refreshed, Rotated, Rebound, Disabled, Enabled …).
- **Instances:** "n instances connected · k idle", "c of n on the current configuration" while some are still
  updating; columns Instance · State (Running / Starting / Stopped / Unavailable / Idle) · Current · Version (the site's
  `package.json` version + Node / Docker / Cloud Run) · Address · Last seen · Connected since. An instance that stops
  pinging (no CPU, gone) shows Idle and then drops from the list.
- "n refused connection attempts in the last hour" — wrong secrets, a bad clock; further ones answer "Too many attempts".
- "N instances run an older start-up process that does not apply secrets — update the site." on the Secrets card.

**The site's own log** (the service's journal, or the terminal): the `[keen-site]` lines (mode, port, starting,
secret names, closes) and the app's `[BOOT]` / `[keen]` lines. It never prints a value.

What each console change does to the running site — and whether the person must press anything:
[delivering changes](../Administration/references/delivering-changes.md).

## 4. The contract binding — what it decides

The API key binds one **consumer contract** ([contracts](../Administration/API/Contracts/contracts-skill.md)); it is
the site's tenant:

- **which spaces and agents** the site's users get (the site lists them from Keen's contract and space list);
- **sign-up and login policy** (whether people may register, the one-time code, the defaults for new users);
- consumer tokens carry their spaces — a narrowed contract signs users out of the site so they get a fresh token.

A contract change reaches the site at once (a nudge, no restart). A change of **which** contract (or client,
certificate, webhook) the key binds ends **every token of the key** and restarts every instance — confirm first.

## 5. Troubleshooting

| What the person sees | Cause | Do |
|---|---|---|
| No instance on the card | the site runs with `npm run dev` (no pre-process), or legacy mode (`Mode legacy` in its log), or it is not running, or a Cloud Run service with no traffic | start it with `dev:managed` / `npm start`; legacy because of a missing value → fill it; `4405` → the key predates 15.3: a Rotate turns site control on (only with the person — it stops the site until the new secret is in and Start is pressed) |
| **Waiting for start**, maintenance page | a new or rotated key | the person checks the instance addresses and presses **Start** |
| **Disabled**, unavailable page | the key was disabled on purpose | tell the person; never enable it yourself |
| **Incomplete**, unavailable page | a binding is missing | bind it (golden path §8) |
| Unavailable; log `Keen closed the connection: key rotated` / `key deleted` | the key was rotated / deleted | new secret (or a new key) into `.env.local`, restart the service, then Start |
| Unavailable; log `… invalid signature` | wrong `KEEN_API_KEY_ID` / `KEEN_API_KEY_SECRET`, or the clock > 60 s off | fix the value or the clock (NTP), restart the service |
| Unavailable; log `Next keeps exiting — giving up …` | Next crashes at boot (e.g. `Keen config missing from the environment: …`) | read the error above it, fix, then **Restart** from the card |
| Maintenance page; log `application_token attempt N failed` | the origin is not accepted (webhook origin ≠ `KEEN_ORIGIN`) — Keen drops it silently | origin = the public address exactly, on both sides |
| The chat never opens (socket closes 1006) | the page's address is not the bound origin (opened by another URL, a stale tunnel address) | open the site at its origin; after an address change move it everywhere + Rebuild and refresh data |
| `Invalid token` after a change | the key's bindings or the webhook's origin changed → every token ended | users sign in again; the site mints a new application token by itself; the runner needs a fresh consumer token |
| Saved Secret not used | Save stores only | **Restart** (or **Save and restart**) |
| Spaces / agents / Front Settings stale | the site keeps its own copy | **Rebuild and refresh data** |
| Log `Webhook refused: stale` | the machine's clock > 300 s off | fix the clock |
| `KEEN_SITE_PROTOCOL must be 1 or 2` at boot | a wrong value | unset it |

## 6. When the builder changes the site's code

The site's own working rules (its `AGENTS.md`) — the ones that bite:

- The **Keen connector is server-only** (`getKeen()`, `globalThis.__keenConnector`): read it in Server Components,
  route handlers, server actions; pass only plain data to client components. After changing the connector, restart
  `next dev` fully (with `dev:managed`: **Restart** from the card or the service).
- **Every new `/api/*` route must be listed** in the proxy's route config (`AUTH_API_CONFIG`, or the guest one) — an
  unlisted one answers 404. A brute-forceable or e-mail-sending route gets a rate limit.
- **Chat with the agent slug** (`agentId`), never the record id (the relay answers `E3101`). The chat SDK:
  [SDK/sdk.md](SDK/sdk.md).
- **Front Settings: read by field name** (`frontSettings.get(agentId, field)`, server-side); browser code uses
  `GET /api/agent-front-settings?agentId=`. They are not the agent's Json Settings (those never reach the site).
- **Third-party keys**: `process.env.NAME` in server code only, value in the Secrets card. Never `NEXT_PUBLIC_*`,
  never `next.config`'s `env`.
- Never forward a Keen reply to the browser raw; log statuses, not bodies.
- A route that needs a body uses POST (the pre-process refuses a body on GET / HEAD / OPTIONS / TRACE).
- The event bus and the rate limits are in process memory — one instance ([cloud-run.md](cloud-run.md)).
- The pre-process is a package: never edit it in `node_modules` (or the reference site's own copy in `keen-site/`);
  it imports nothing from `src/`, `next` or npm, and its two JSON lists are byte copies of Keen's — a change comes as a
  new `@keenagents/keen-site` version. The site keeps only its reserved route `src/app/api/keen-site` (the loopback
  nudge) and, if it wants, its own pages in `keen-site/pages/`.
