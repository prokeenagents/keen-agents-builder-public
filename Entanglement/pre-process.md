# The pre-process — `@keenagents/keen-site`

The pre-process is the npm package **`@keenagents/keen-site`** (version `15.3.0` = the Keen 15.3 site protocol); its
bin **`keen-site`** is what `npm start`, `npm run dev:managed` and the image's `CMD` run. It sits **in front of
Next**: it holds the public port, proxies every request to Next on an internal port, and keeps **one signed
WebSocket to Keen**, over which Keen starts, stops and restarts the site — on every instance of the key at once —
and hands Next the values it needs. Plain Node ESM, no runtime dependencies, Node ≥ 22.9. It connects **out** to
Keen, so it needs no inbound route of its own.

> **The reference site today still carries its own copy** in `keen-site/` (`node keen-site/index.mjs`, the same code
> and behaviour) until it switches to the package. A downloaded site whose `package.json` scripts call
> `node keen-site/index.mjs` is on that copy; everything below holds for both, except §0 (the bin, its option, where
> it looks for files) and the file names.

## 0. Installing it and the command

`npm install @keenagents/keen-site`, then the site's scripts:

| Script | Runs |
|---|---|
| `"dev:managed": "KEEN_SITE_CHILD=dev keen-site --dotenv .env.local"` | the pre-process, `.env.local` loaded first, Next as `next dev` |
| `"start": "keen-site"` | the pre-process, Next as `next start` (or the standalone `server.js` in an image) |

`keen-site [--dotenv <path>]`:

- `--dotenv <path>` (or `KEEN_SITE_ENV_FILE=<path>`; the option wins) loads that file **if it exists** with Node's own
  parser, before anything else — a missing file is skipped, a value already in the environment wins over the file's,
  nothing of the file is printed (one line: `[keen-site] Environment file <path> loaded.`). Relative to the site's folder.
- **Not `--env-file`:** Node reads `--env-file` / `--env-file-if-exists` anywhere on its command line, also after the
  script, and exits 9 (`node: <path>: not found`) before the bin runs when the file is missing; the bin refuses both
  spellings with that reason. An unknown argument exits 2 with the usage; `-h` / `-v` print the usage / the version.
- **Every path is the site's folder** — the folder it is started in (`process.cwd()`; npm runs a script in the folder of
  the site's `package.json`), never the package's folder in `node_modules`: the site's version from its `package.json`,
  `server.js` for `KEEN_SITE_CHILD=auto`, `next` resolved from the site's own `node_modules`, Next's working folder, and
  the site's own pages in `<site>/keen-site/pages/`. Started where there is neither `next` nor `server.js`, it stops:
  `[keen-site] Could not start: Next is not installed in <folder> and there is no server.js there — …`.

| Package file | Role |
|---|---|
| `bin/keen-site.mjs` | the bin: its options, the environment file, then `lib/main.mjs` |
| `lib/main.mjs` | config, mode, the server, the channel, the child, signals (the site copy's `index.mjs`) |
| `lib/config.mjs` | the mode, the ports, the instance id / runtime / version |
| `lib/channel.mjs` | the link to Keen: hello / welcome, frames, ping, closes, reconnects, the before-serve check |
| `lib/signature.mjs` | the signatures and the encrypted fields (`keen-site-v1`) |
| `lib/controller.mjs` | what happens to Next on each word from Keen |
| `lib/child.mjs` | spawn / stop / restart / readiness / crash policy of Next |
| `lib/proxy.mjs`, `lib/pages.mjs` | the HTTP + upgrade proxy; the maintenance / starting / unavailable pages |
| `lib/close-codes.mjs` | the close codes and reconnect delays |
| `lib/denylist.mjs` + `lib/site-env-denylist.json` | the names a Secret may never set |
| `lib/index.mjs` | the package's import entry: pure pieces only (`readConfig`, `classifyClose`, `secretNameRefusal`, `loadPages` …) — starts nothing |

## 1. The modes

One line at start says which: `[keen-site] Mode <mode> — <why>. Instance <id> (<runtime>, site <version>, Node <v>).`

| Mode | When | What runs |
|---|---|---|
| **managed** | `KEEN_HOST` (a full `http(s)` URL), `KEEN_API_KEY_ID`, `KEEN_API_KEY_SECRET` all set | Keen decides when Next runs and with which values |
| **legacy** | one of the three missing; or, before any welcome, Keen answers close **4405** (a key created before 15.3 and not rotated since); or the Keen has no `/keen-site/link` | Next on the container's own env, proxy only, no channel — the site is not on the Application card |
| **off** | `KEEN_SITE_MODE=off` | no proxy: Next binds the port itself; the pre-process only forwards signals |

`npm run dev` runs Next **alone** — no pre-process, no site control, no Secrets from Keen.

## 2. The link to Keen

`wss://<KEEN_HOST host>/keen-site/link` (Keen's link worker, which only forwards bytes; Keen's API-key service signs).

1. All keys derive from `KEEN_API_KEY_SECRET`; **the secret never crosses the link**.
2. The first frame is the signed **hello**: key id, timestamp, nonce, the instance (id, protocol `2`, the site's
   `package.json` version, runtime `node` / `docker` / `cloud-run`) and the hash of the state it last applied. Keen
   refuses a hello more than **60 s** off its clock (the machine needs a correct clock — NTP).
3. Keen answers a signed **welcome** bound to that hello: the current **state** (run, enabled, complete, missing,
   counters, hash, version) and — only while the site should run — the **launch set**, encrypted to that hello.
4. After it: `ping` every 25 s (no `pong` for 60 s → reconnect), `report { phase, appliedHash }` on every phase
   change (`starting` / `running` / `stopped` / `unavailable` — what the card's instance list shows), `launch` to ask
   for the launch set. Keen sends `state` (signed, versioned — applied only when its version grows), `launch`
   (signed, encrypted to that request) and `launch-refused` (ask again later).
5. A Keen frame that fails verification drops the socket (`Keen's channel sent … — dropping the socket (policy)`).
   Nothing logs a frame, a payload, a signature or a value.

Instance id = `<hostname or Cloud Run revision>-<6 random characters>`, new at each process start.

## 3. The commands — what each word from Keen does to Next

| Keen says | Next |
|---|---|
| the same hash as the one applied, Next up | nothing — a reconnect never restarts the site |
| **Start** / **Restart**, a new root (Rotate + Start), Enable, a re-binding, a Secrets publish (`run`, `restarts`, `launch`, `root`, `secrets`, `enabled`, `complete` changed) | ask the launch set, then start / restart Next with it |
| **Refresh data**, a new certificate, a contract change (only `live` changed) | ask the launch set, then a **nudge** — no restart (§5) |
| **Stop** (`run: stopped`) — also the **hold** after Create / Rotate | Next stopped, the **maintenance** page, still connected |
| Disabled, or incomplete (a binding missing) | Next stopped, the **unavailable** page, still connected; log `Keen says this api key cannot run a site yet — missing: …` for incomplete |

**The hold.** After a Create or a Rotate Keen sends the instance a plain `stopped` until a person presses Start: it
serves the maintenance page, receives **no** env, certificate or Secret, and shows in the card's list with its
address. When the person presses Start, every instance asks its launch set and starts. A site needs no code for this.

Before the first welcome the site shows the **starting** page for 15 s, then the **unavailable** page while the link
keeps trying.

## 4. Launching Next — the values in its environment

What runs (`KEEN_SITE_CHILD`): `auto` (default) → `node server.js` when the standalone output sits in the folder
(the image), else `next start`; `dev` → `next dev` (what `npm run dev:managed` sets); `standalone` / `next-start`
force one. Next always listens **internally only (the loopback address), on `<child port>`**; the pre-process holds `0.0.0.0:<PORT>`.

| Port | Setting | Default |
|---|---|---|
| public (the tunnel / platform points here) | `PORT` | `3000` (the image sets `8080`; Cloud Run injects its own) |
| Next's internal | `KEEN_SITE_CHILD_PORT` | `PORT + 1`; must differ from `PORT` or the process does not start |

Next's environment, in this order (a later one wins):

1. the pre-process's own env (the container's; under `dev:managed`, `.env.local` loaded by `--dotenv` at start);
2. **`launch.env`** from Keen: `KEEN_ORIGIN` (the bound webhook's origin) and `KEEN_WEBHOOK_SECRET` (the last segment
   of the bound webhook URL, when it ends in `/api/keen-webhook/<segment>`). A Keen value that replaces a different
   container value logs `WARN: Keen's <NAME> replaces the container's value.` It may never set `PORT`, `HOSTNAME`,
   `PATH`, `HOME`, `NODE_*`, `LD_*`, `KEEN_SITE_*`, `KEEN_CERTIFICATE_*` or the five container values;
3. **the API key's published Secrets** (`launch.secrets`): each name is checked again (`^[A-Z][A-Z0-9_]{0,127}$` and the
   denylist — `KEEN_`, `NEXT_`, `NODE_`, `NPM_`, `K_`, `CLOUD_RUN_`, `LD_` … prefixes, `PATH`, `PORT`, `HOSTNAME`, the
   proxy and trust-store names …); a refused one is not applied (`WARN: the launch set names <NAME>, which a secret
   may not set — ignored.`). A Secret replaces a container value of the same name with
   `WARN: Keen's secret <NAME> replaces the container's value — remove it from the container's environment.` on every
   start. Then one line: `Secrets (version <n>): A, B.` — names only;
4. the certificate: `KEEN_CERTIFICATE_PEM`, `KEEN_CERTIFICATE_SECRET` (the connector stores it at boot and skips the
   older certificate claim / redeem);
5. its own words: `KEEN_WS` (derived `wss://<KEEN_HOST host>/ws-keen` when unset), `KEEN_SITE_MANAGED=1`,
   `KEEN_SITE_TOKEN` (new per start), `KEEN_SITE_HASH`, `KEEN_SITE_SECRETS_VERSION`, `PORT=<child port>`,
   `HOSTNAME` = the loopback address, and `NODE_OPTIONS` from `KEEN_SITE_CHILD_NODE_OPTIONS`.

Values travel **only in Next's environment** — never on argv, never on disk, never in a log line. The site's server
code reads a Secret as `process.env.ELEVENLABS_API_KEY`; the browser never gets it.

**Supervising Next.** Ready = its port accepts TCP (checked every 100 ms, up to 30 s; otherwise it is killed). Stop =
SIGTERM, 10 s, SIGKILL. An exit nobody asked for restarts it after 1, 2, 5, 10, 30, 60 s; the 5th exit within 5 minutes
gives up (`Next keeps exiting — giving up until Keen sends the next state or launch.`, the unavailable page) until
Keen's next state — a Restart from the card starts it again. SIGTERM / SIGINT to the pre-process closes the link,
stops Next and exits 0.

## 5. Feeding the running site without a restart

**Rebuild and refresh data** (and a certificate or contract change) only moves the `live` counter. The pre-process
asks the launch set and calls Next's loopback route `POST /api/keen-site` with `X-Keen-Site-Token` and
`{ kinds: [r_api_keys, r_consumer_policy, r_space, r_agent, r_json], certificate? }`: Next stores the certificate and
re-reads the key, the contract and policy, the space list and the agents' Front Settings. Log: `Refresh data → Next
re-reads (HTTP 200).` No chat ends. From outside, `/api/keen-site` answers 404.

The other channel stays: Keen's **webhooks** to `/api/keen-webhook/<secret>` still deliver consumer sign-outs,
contract / space pushes and completion callbacks — each POST signed with the certificate's secret and checked by the
site. Those reach **one** instance (whichever the address routes to). Overview of every change:
[delivering changes](../Administration/references/delivering-changes.md).

## 6. Closes and reconnects

| Close | Reason | The pre-process |
|---|---|---|
| **4403** / **4404** / **4406** | key rotated / key deleted / invalid signature (wrong secret or id, clock > 60 s off, a protocol Keen refuses) | Next stopped, unavailable, `Keen closed the connection: <reason> — check KEEN_API_KEY_ID and KEEN_API_KEY_SECRET. Not reconnecting until this process restarts with new values.` For 4406 it also names a measured clock skew |
| **4405** | site control not set up | before any welcome: legacy mode; later: retry |
| **4402** | key disabled | Next stopped, unavailable; reconnect after about a minute, then stay parked; **Enable** starts it again by itself |
| **4413** | too many instances (50 per key) | keep the current state; retry after about a minute |
| **4429** | too many attempts; `retry=<s>` | keep the state; retry after that wait |
| **1012** | Keen's worker restarts | reconnect within 10 s |
| 4410 idle (no frame for 10 min), 1013, 4401, 4407, 4409, a dropped network | — | keep the current state; backoff with jitter, up to 60 s |

A reconnect re-sends the applied hash; an equal hash changes nothing. **Before serving a request** after more than
35 s without a frame from Keen (Cloud Run gives an idle instance no CPU), it pings and waits up to 2 s — so a Stop
that waited in the socket is applied before this very request is answered — and reconnects first if the socket died.

## 7. Its own settings (all optional)

| Variable | Effect |
|---|---|
| `KEEN_SITE_MODE=off` | no pre-process behaviour: Next binds the port itself |
| `KEEN_SITE_CHILD` | `auto` · `standalone` · `next-start` · `dev` |
| `KEEN_SITE_CHILD_PORT` | Next's internal port (default `PORT + 1`) |
| `KEEN_SITE_CHILD_NODE_OPTIONS` | `NODE_OPTIONS` for Next only (e.g. an inspector on the loopback address) |
| `KEEN_SITE_PROTOCOL` | `2` (default) applies the Secrets; `1` ignores them (only for a Keen rolled back to before the Secret Manager — with `2` such a Keen closes 4406). Any other value stops the boot |
| `KEEN_SITE_ENV_FILE` | the environment file to load first, as `--dotenv` (§0) — the package's bin only |

A site may ship its own `keen-site/pages/{maintenance,starting,unavailable}.html` in its own folder (with the package:
`<site>/keen-site/pages/`, the only file of the site's `keen-site/` folder still read). The pages answer 503 with
`Retry-After` (60 / 5 / 60 s) and JSON for `/api/*`; the public page never says why — the log does.

## 8. The proxy

Requests and upgrades pass unbuffered to Next (page streams, the 25 s event long poll, `next dev`'s hot reload);
`X-Forwarded-For` passes unchanged (set to the socket address only when absent). A body on GET / HEAD / OPTIONS / TRACE
is refused **400** (`{"success":false,"status":400,"message":"Bad Request"}`) — a site route that needs a body must
use POST. While Next starts, a request is held up to 15 s, then gets the starting page.
