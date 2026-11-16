---
name: keen-entanglement
description: Keen 15.3 — The partner site "Entanglement", the reference Next.js site a person downloads from Keen and runs so that end users can register, sign in and chat with the agents of a Keen contract. Explains its two parts (the Next.js app and the keen-site pre-process that holds the public port, keeps a signed link to Keen and starts / stops / restarts Next on Keen's word), how it is set up (Download Site, .env.local, which values are secrets), why it must have a public https address (Cloudflare Tunnel, ngrok — never a local address), how it is bound to the API key and the contract, how Keen feeds it (the launch set, the API key's Secrets, Rebuild and refresh data, webhooks, the chat SDK), how it is started as a supervised service, how it is stopped / restarted / watched from the API key's Application card and MCP (get_api_key_site / set_api_key_site), "Waiting for start", and how it moves to Cloud Run later. Use this skill whenever the person mentions the partner site, Entanglement, the site, the chat site, Download Site, keen-site, @keenagents/keen-site, dev:managed, .env.local of the site, a tunnel, ngrok, Cloudflare Tunnel, the origin, the Application card, "Waiting for start", instances, "the site shows maintenance / unavailable", "the chat does not connect", Invalid token after a change, or deploying the site to Cloud Run — even if they never say "Entanglement".
---

# Entanglement — the partner site

> **Keen 15.3.** This skill describes Keen 15.3 in full — it is the baseline. A later release (15.4, …) gets an
> additions-only skill with just what changed; read this one first, then the additions for the platform's version.

Entanglement is the **partner site**: the web application the person runs so that *their* users (end users, Keen
calls them consumers) can register, sign in, see the spaces and agents their contract gives them, and chat. Keen
owns identity, tenancy and the agents; the site owns the end-user experience. The person gets it from the console
(the Home page › **Get started** › **Download Site**, a zip) and runs it themselves — today on their own machine or a server, later most
likely on **Cloud Run** or a similar container service.

It is what any partner's backend would do with an API key, a client, a certificate and a contract — so it is also
the reference when the person builds their own site.

## The two parts

| Part | What it is | What it does |
|---|---|---|
| **The Next.js app** (`src/`) | Next.js 16 (App Router), React 19, TypeScript, Chakra UI v3 | the pages (sign-up, sign-in with a code, password reset, the spaces, the chat), its server routes (`/api/*`), the **Keen connector** (a server-only singleton: the application token, the certificate, cached copies of the contract, policy, spaces and agents' Front Settings), the webhook receiver `/api/keen-webhook/<secret>`, the event long poll to the browser |
| **The pre-process** (the npm package `@keenagents/keen-site`, bin `keen-site`; the reference site still carries its own copy in `keen-site/` until it switches) | plain Node ESM, no dependencies, Node ≥ 22.9 | holds the public port and proxies every request to Next on an internal port; keeps **one signed WebSocket to Keen** (`<KEEN_HOST>/keen-site/link`); starts, stops and restarts Next on Keen's word, putting Keen's values (the origin, the webhook secret, the certificate, the API key's Secrets) into Next's environment; serves its own maintenance / starting / unavailable pages while Next is not serving |

The **chat** itself goes from the end user's browser straight to Keen's relay over `wss://` (the site's chat SDK) —
not through the site. How the SDK is set up and used: [SDK/sdk.md](SDK/sdk.md).

```
browser ──https──▶ pre-process (public port) ──▶ Next (internal only, its own port)
browser ──wss────▶ Keen relay (the chat)                │
pre-process ──signed wss──▶ Keen (/keen-site/link)      │ server calls (token, resources)
Keen ──https webhooks──▶ the site's /api/keen-webhook/<secret> ◀┘
```

## Files

| File | Read it when |
|---|---|
| [setup.md](setup.md) | getting the site, `.env.local` (every value, where it comes from, which are secrets), the public address and tunnel, the webhook record and origin, the first start, what success looks like |
| [pre-process.md](pre-process.md) | the package `@keenagents/keen-site` — installing it, the `keen-site` bin and its `--dotenv` option, where it looks for files (the site's folder) — and what it listens for and does: the link, the commands, the hold, the launch set and Secrets in Next's env, Refresh data without a restart, its own settings, close codes, its log lines |
| [running.md](running.md) | starting it (the reference managed setup as a supervised service), Start / Stop / Restart from Keen vs on the machine, the contract binding, the Application card, troubleshooting, the rules when changing the site's code (§6) |
| [cloud-run.md](cloud-run.md) | moving it to Cloud Run or a similar container service: the image, configuration and secrets, one instance, scale to zero, what to verify |
| [connectors.md](connectors.md) | the site-side connector standard: an outside account a person links (the registry, the OAuth routes, the JS-readable token cookie that the agent's tool reads with `system/cookies`), a server service with one key, the template for a new one; the Front Settings switch that is not yet in the reference site |
| [SDK/sdk.md](SDK/sdk.md) | the chat SDK the site's pages use (its setup, use and task queue) |

Linked, not repeated here: the API key and its four bindings —
[api-keys](../Administration/API/API%20Keys/api-keys-skill.md) (incl. *One partner site — the records and their
order*), [contracts](../Administration/API/Contracts/contracts-skill.md),
[webhooks](../Administration/API/Webhooks/webhooks-skill.md), [clients](../Administration/API/Clients/clients-skill.md),
[certificates](../Administration/API/Certificates/certificates-skill.md);
[delivering changes](../Administration/references/delivering-changes.md) (what each console change does to the running
site); [secrets and credentials](../Administration/references/secrets-and-credentials.md); the MCP order
[golden path](../MCP/golden-path.md) §6–10 and [tools](../MCP/tools.md); the project order
[ProjectSetup/first-setup.md](../ProjectSetup/first-setup.md) §6–7 and [ProjectSetup/values.md](../ProjectSetup/values.md).

## Rules

1. **A public `https://` address only.** The site's address is its **origin** — the webhook record's origin, the
   relay's allow-list entry, the base of every e-mail link. On the person's machine that means a tunnel (Cloudflare
   Tunnel, ngrok or similar) to the port the pre-process prints. A local address is not acceptable: Keen cannot POST
   to it, the relay will not admit it, and the e-mailed links would point nowhere (why: [setup.md](setup.md) §4).
   The word "localhost" appears in this skill only to say that.
   That public address is `application` in the workspace's `keen-project.json`, and the site's folder is its
   `application_dir` ([keen-project.md](../ProjectSetup/keen-project.md)) — read the file first; it wins over any
   other copy of these values.
2. **Five values in the site's own environment, never Secrets:** `KEEN_HOST`, `KEEN_API_KEY_ID`,
   `KEEN_API_KEY_SECRET`, `KEEN_CLIENT_ID`, `KEEN_CLIENT_SECRET`. Keen refuses `KEEN_*` as a Secret name.
3. **Every other secret goes in the API key's Secrets card** (typed by the person in the console; the browser
   encrypts it). The site's server code reads it as `process.env.NAME`; the browser never sees it. Never ask for a
   value in the chat; never print a `.env*` file.
4. **Front Settings hold plain values only** (`{ "service_available": true, "service_title": "My Service" }`); the
   site's code can turn a connector on or off from them (the target shape — not yet in the reference site,
   [connectors.md](connectors.md)). A Front Settings save reaches the site only after
   **Rebuild and refresh data** (or a restart).
5. **An environment change needs a restart.** The site reads `.env.local` / its container env at start. A saved
   Secret waits for **Start / Restart** (or **Save and restart**).
6. **After Create or Rotate of the key the site waits** ("Waiting for start") until a **person** presses Start in the
   console. MCP cannot lift it — tell the person.
7. **A change of the key's bindings, or of the bound webhook's origin, ends every token of the key** — every open
   chat ends, users sign in again. Confirm with the person first.
8. **Disable stops the application at once** (chats, tokens); **Stop** only shows the maintenance page — chats go on.
9. **One instance** of this site per key while its event bus and webhook replay memory live in process memory
   ([cloud-run.md](cloud-run.md)).
10. **Read only the site's `.env.example`**, never another `.env*` file you did not write. Never commit `.env.local`.
11. **Cookies reach an agent only if the site lists them for that agent** — the `cookies` allow-list it passes
   when it creates the SDK for a chat with that agent (`SDK/setup.md` §5); without it every JavaScript-readable cookie goes.
12. **The chat retries only `E4…` (an overloaded engine) and `E7…` (a timeout); every other failure ends the run.**
   A chat that must give up sooner gets an error policy when the site creates its SDK —
   `errors: { "4XXX": { delay_ms: '5000', max_retry: 5 } }` (`SDK/setup.md` §8); a policy on a final family is ignored.

## Who does what

| Step | Who |
|---|---|
| the records (certificate, client, contract, webhook, API key) | the builder through MCP, or the person in the console ([golden path](../MCP/golden-path.md)) |
| Download Site, `npm install`, `.env.local`, the tunnel, the service on the machine | the person on their machine (the builder if it has a shell there) |
| the Secrets' values | the person in the console only |
| **Start** after Create / Rotate | the person in the console only |
| Stop / Restart / Rebuild and refresh data, reading the instances | the builder (`set_api_key_site`, `wake_api_key`, `get_api_key_site`) after the person confirms, or the person |
