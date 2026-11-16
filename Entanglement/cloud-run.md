# Running the site on Cloud Run (or a similar container service)

Later the site will most likely run on **Cloud Run** or a similar service (any platform that runs a container,
injects `PORT`, and gives it a public `https://` address). The reference site ships what it needs: a `Dockerfile`,
`cli/{config,secrets,deploy,redeploy}.sh` and its own `DEPLOYING.md` (the full walkthrough — domain mapping, org
policy, pitfalls). Point the person there for the commands; this file is what the builder must know.

Marks: **[code]** = verified in the site's code / Keen's code; **[guidance]** = how to do it well, not enforced.

## 1. The image [code]

- Multi-stage `node:24-slim` (glibc on purpose): `npm ci` → `next build` (standalone output) → a slim runner as a
  non-root user, `ENV PORT=8080`, `HOSTNAME=0.0.0.0`.
- **The pre-process** is the `CMD`: it holds `$PORT` on `0.0.0.0` and runs Next's standalone `server.js` internally
  on `<PORT+1>` (`KEEN_SITE_CHILD=auto` finds `server.js` in the `WORKDIR`, the folder it starts in). With the package
  `@keenagents/keen-site` the runner stage copies it beside the standalone output — Next's standalone trace leaves it
  out, nothing in the app imports it — and runs its entry with `node`:

  ```dockerfile
  COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@keenagents/keen-site ./node_modules/@keenagents/keen-site
  # only if the site ships its own pages:
  # COPY --from=builder --chown=nextjs:nodejs /app/keen-site/pages ./keen-site/pages
  CMD ["node", "node_modules/@keenagents/keen-site/bin/keen-site.mjs"]
  ```

  Not `npx keen-site`: the runner has no `node_modules/.bin`, so `npx` would fetch a package **named** `keen-site` from
  the registry at every cold start — not the code that was built — and it would stand between Cloud Run's SIGTERM and
  the pre-process. Install the package from the registry or a `.tgz` (a `file:` link to a folder leaves a symlink the
  `COPY` carries broken). The reference site today still carries its own copy: `COPY … /app/keen-site ./keen-site`
  and `CMD ["node", "keen-site/index.mjs"]` (its tests stay out through `.dockerignore`) — the same behaviour until it
  switches.
- **No secrets in the image.** `.dockerignore` / `.gcloudignore` exclude every `.env*` (`next build` would copy `.env`
  into the standalone output). The build needs no Keen config (the app layout is dynamic, nothing reads Keen at build).
- In production the Next server **exits** when its Keen config is missing, so the platform refuses that revision
  instead of serving a broken site.

**What changed with the pre-process** — an older Cloud Run setup of this site (before site control) ran
`CMD ["node", "server.js"]`, kept `KEEN_ORIGIN` and `KEEN_WEBHOOK_SECRET` only in the service's env, got the
certificate only by webhook (claim / redeem, re-tried every ~16 s while a rollout's webhook landed on the old
revision), and every third-party key lived in the cloud's secret manager. Now: the pre-process fronts Next, Keen
hands over the origin, the webhook secret, the certificate and the API key's Secrets at each start, and Keen's
Start / Stop / Restart / Refresh data reach the instances over the link. The newer `DEPLOYING.md` / `Dockerfile` of the
downloaded site win over any older copy.

## 2. Configuration and secrets

| Value | Where | Why |
|---|---|---|
| `KEEN_HOST`, `KEEN_API_KEY_ID`, `KEEN_CLIENT_ID` (+ `KEEN_WS` optional) | plain env vars of the service [code] | addresses and ids, useless alone |
| `KEEN_API_KEY_SECRET`, `KEEN_CLIENT_SECRET` | the **cloud's secret manager**, mounted as env vars [code: `cli/config.sh`] | the five container values are never Keen Secrets — the site needs them to reach Keen at all |
| `KEEN_WEBHOOK_SECRET` | the cloud's secret manager during 15.3 [code] | Keen also hands it over; kept for legacy mode |
| `KEEN_ORIGIN` | set by `deploy.sh` to the service's public address [code] | Keen also hands it over; kept for legacy mode |
| every other secret (voice, search, OAuth keys …) | the API key's **Secrets** card in the Keen console [code: the pre-process applies `launch.secrets`] | Keen encrypts it to the instance; one place for every instance; rotate without a deploy (**Save and restart**) |

- Secret-manager mounts should be **pinned to a version**, never `latest`, so every instance of a revision sees the
  same value and a rotation is an explicit deploy [guidance; the site's scripts do it].
- The service runs as its own service account allowed to read exactly its secrets [guidance; the scripts do it].
- When a secret moves into the Secrets card, remove it from the service's env after the first restart that delivers
  it; until then each start logs `WARN: Keen's secret <NAME> replaces the container's value …` (Keen's wins) [code].

## 3. The public URL is the origin — no tunnel

The service's own `https://` address (e.g. `https://my-site-….run.app`) or a mapped custom domain
(`https://site.example.com`) is the origin [code: the site needs `KEEN_ORIGIN` = its address]. It goes in the
webhook record's **origin** (exact) and in its **Webhook URL** (`<address>/api/keen-webhook/<secret>`). Hand out only
one address: the relay admits a chat socket only from the bound origin, and the service keeps answering on its other
URLs too [code: relay allow-list; DEPLOYING §8]. Moving from the default URL to a custom domain = change the record's
origin and `KEEN_ORIGIN` together, then Rebuild and refresh data — every token of the key ends (users sign in again).
The webhook URL may stay on the service's own URL.

The service must be publicly invokable; under an org policy that forbids `allUsers`, the site's scripts use
`--no-invoker-iam-check` (DEPLOYING §7) [guidance].

## 4. Instances and scale to zero

- **At most one instance** for this site [code + guidance]: the connector's token, certificate and caches, the
  webhook → long-poll event bus, the webhook's replay memory and the rate limits all live in process memory. Keen's
  webhooks (sign-outs, contract / space pushes) reach whichever instance the URL routes to; a second instance would
  never pass them to its own browsers. The site's scripts deploy `--min-instances 0 --max-instances 1`. The link to
  Keen itself works with any number of instances (up to 50 per key).
- **Scale to zero** (`--cpu-throttling`, request-based billing) [code: the pre-process is built for it]: every visible
  tab holds one `/api/events` long poll, so the instance runs while someone has the site open; a hidden tab pauses its
  poll. `--concurrency 1000` because each tab holds a poll for up to 25 s; `--cpu-boost` shortens the cold start.
- **An empty instance list is normal** while no instance is up ("A Cloud Run site with no traffic may run no instance
  at all."). A command given meanwhile (Stop, Start, Restart) arrives in the next instance's welcome; Rebuild and
  refresh data answers "the site gets the refreshed data when it next connects" [code].
- **An idle instance has no CPU**: no ping is sent and a frame from Keen waits in the socket. On the next request after
  > 35 s of silence the pre-process pings Keen and applies what waited (a Stop → this very request gets the maintenance
  page), reconnecting first if the socket died (a silent WebSocket is cut by proxies after ~100 s; Keen closes one idle
  for 10 minutes with 4410) [code].
- The runtime shows as **Cloud Run** on the card and the instance id starts with the revision name [code].
- Cold start: the first visitor after an idle spell is held while the site boots [code].

## 5. Restarts and changes

| Change | Do |
|---|---|
| new code | rebuild the image and roll a new revision (`cli/redeploy.sh`) — the new instances say hello, Keen sees the same state and they start; no Start needed |
| a Secrets-card value | **Save and restart** (or Restart) — no deploy |
| a container value (the five, a pre-process setting) | a new revision with the new value (`secrets.sh` + `deploy.sh`) |
| Rotate of the API key | every instance closes 4403 and never reconnects: put the new secret into the secret manager, deploy a new revision, then a **person** presses **Start** |
| Disable / Enable | instances park (4402) and start again by themselves after Enable — no deploy |
| Stop / Start / Restart / Rebuild and refresh data | from the Application card or MCP, as on a machine ([running.md](running.md) §2) |

## 6. Before going live — verify

1. The image runs the pre-process: the first log line `Mode managed — site control by Keen. Instance <revision>-…
   (cloud-run, site <version>, Node 24.x).`
2. The key is fully bound; the webhook origin = the service's address exactly; Rebuild and refresh data succeeded.
3. After the person's Start: the card shows **Running**, the instance **On the current configuration**, runtime
   Cloud Run, the site version you deployed; the log shows `Secrets (version n): …` with the expected names and
   `[BOOT] Application activated: true`.
4. The address opens the sign-in page; register (if the policy allows), sign in, chat; the chat socket goes straight
   to Keen.
5. A GET with a body is refused 400 (the proxy's framing fix is in): the instance version is the current site version.
6. No secret in the image (`.env*` excluded), none in plain env vars, none in the log.
7. One instance at most; the clock is right (the hello window is 60 s, the webhook's 300 s).
