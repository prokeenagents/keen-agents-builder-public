# Connectors — the site-side standard

The reference site has two kinds of site-side integration, each with a fixed shape. Use them as the form for a new
one. Whether an integration belongs on the site or on the agent at all: [Services/SKILL.md](../Services/SKILL.md)
("Where a service lives").

| Kind | Example in the reference site | Who holds the credential |
|---|---|---|
| **A. An outside account a person links** | VectorPoint Connect — the end user connects their own document account, so the agent searches *their* documents | the end user's token, in a cookie of their browser |
| **B. A server service with no per-person account** | speech-to-text (dictation in the chat composer) | the site: one key in the site's environment (an **API key Secret**) |

## A. An outside account a person links

### The mechanism — one for every provider (verified)

A connector is **configuration**: one `CONNECTORS` entry, one `PROVIDERS` entry and an icon. The OAuth flow, the
cookies, the token refresh, the revoke and their tests are written once and serve every id.

| File | Holds |
|---|---|
| `src/configs/connectors.config.ts` | **`CONNECTORS`** (client-safe, the order the dialog shows them): `defineConnector({ id, name, description, icon, tokenCookie?, refresh? })` derives the routes (`connectorRoutes(id)`), the outcome flag (= the id) and the cookie names (`<id>_connect`, `<id>_connect_account`, with `refresh` also `<id>_connect_exp`). `tokenCookie` overrides the derived name — VectorPoint keeps `vp_connect` because deployed agents read it. No secrets: client components import it |
| `src/service/connectors/providers.ts` | **`PROVIDERS`**, server-only, the same ids: `authorizeUrl`, `tokenUrl`, `revokeUrl?`, `scope`, `authorizeParams?` (Google: `access_type: 'offline'`, `prompt: 'consent'`), `clientIdEnv` / `clientSecretEnv` (the env names of the client pair), `baseUrlEnv?` / `authorizeBaseUrlEnv?` (relative endpoints), `refresh`, and an `adapter` **only** where the provider is not standard OAuth (VectorPoint: its answer envelope, `expiresAt`, its revoke) — every missing hook is the RFC 6749 default (the account label from the id_token's e-mail) |
| `src/service/connectors/oauth.ts` | the one flow: settings from env (missing → 503 `<Name> Connect is not configured on this site.`), state + PKCE, the consent URL, the code exchange and the refresh **server to server**, the revoke, the sealed refresh cookie (`getKeen().seal(token, '<id>-refresh')`), the cookies, `resolveConnector` (an unknown id, or one whose two entries disagree about `refresh` → 404). Never logs or returns a token, a code or the provider's body |
| `src/app/api/[connector]/{connect,callback,disconnect,refresh}/route.ts` | the routes of EVERY connector at the same public paths as before (`/api/<id>/callback` — the redirect URI registered at the provider): connect (`GET ?return=<path>`, a 10-minute httpOnly flow cookie), callback (state in constant time, exchange, cookies, back with `?<id>=connected` or an error code), disconnect (revokes the refresh token when held, else the access token; cookies cleared even when the revoke fails), refresh (below) |
| `src/configs/api.config.ts` | the proxy's route list, generated from `CONNECTORS` (an unlisted `/api/*` route answers 404; a connector without refresh has no refresh route) |
| `src/utils/connectors.ts` | browser helpers: `connectorStatus` (connected = the token cookie, or with refresh the account cookie), `refreshConnections` (below) |
| `src/components/ui/connectors-dialog/` | the **Connections** dialog: one row per `CONNECTORS` entry, Connect / Disconnect, the toast from the outcome flag |
| `src/app/api/logout/route.ts` | ends the session ON KEEN first (`POST /keen-api/auth/logout` with the refresh token — the pair is revoked, a copied cookie stops working), then clears the session cookies and every connector's cookies (the refresh one on its own path) — the cookies go even when Keen cannot answer |
| `src/app/api/[connector]/connectors.test.ts` | the mechanism's tests, over VectorPoint and a test-only provider with refresh |

**The token cookie is JS-readable on purpose** (`httpOnly: false`, `secure`, `sameSite: lax`, it expires with the
token). The site's chat SDK forwards the cookies `document.cookie` can see with the chat message that starts a run
(the reference site passes no allow-list, so every JS-readable cookie goes); an httpOnly cookie never reaches the
agent. The SDK: [SDK/sdk.md](SDK/sdk.md).

### Keeping the token fresh — the site refreshes, never the agent

The agent can only read cookies (a script cannot set one and keeps nothing between messages), so a token the
provider refreshes must be refreshed **by the site**. The split is the usual one for browser apps:

| Cookie | Holds | Flags | Reaches the agent |
|---|---|---|---|
| `<id>_connect` | the **short-lived access token** only | `httpOnly: false`, `secure`, `sameSite: lax`, `maxAge` = the token's `expires_in` | yes — through the per-agent `cookies` allow-list |
| `<id>_connect_exp` | the access token's expiry (epoch seconds) — not a credential | `httpOnly: false`, `secure`, `sameSite: lax`; like `<id>_connect_account`, kept as long as the refresh cookie, so the Connections dialog shows "connected" between an access token's end and the next refresh | no (leave it out of the allow-list) |
| `<id>_connect_refresh` | the **refresh token**, sealed with the site's own key: `getKeen().seal(token, '<id>-refresh')` (AES-256-GCM, a key of its own per purpose — no new secret to type). A new site certificate makes old cookies unreadable → the person connects again | **`httpOnly: true`**, `secure`, `sameSite: lax`, `path: /api/<id>`, `maxAge` 180 days | never (an `HttpOnly` cookie is never forwarded) |

1. **Connect** asks the provider for a refresh token (Google: `access_type=offline` and `prompt=consent`; others:
   the `offline_access` scope) and sets all three cookies in the callback.
2. **A fourth route, `POST /api/<id>/refresh`** (the site session first — 401; 503 when not configured): opens the
   refresh cookie, calls the provider's token endpoint with the client secret, rewrites `<id>_connect` and
   `<id>_connect_exp`, and rewrites the refresh cookie when the provider rotated it. It answers `{ connected, exp }`
   — never a token.
3. **The page calls it** once on load and before it sends a chat message whenever `<id>_connect_exp` is missing or
   less than 5 minutes away, so the agent always receives a valid access token. In the site: the connector's entry in
   `CONNECTORS` carries `refreshUrl` and `expCookie`; `refreshConnections(CONNECTORS)` (`src/utils/connectors.ts`, one
   request in flight per connector, never throws) runs in the chat shell on mount and is **awaited right before
   `runFlow`** — the chat SDK reads `document.cookie` when it sends. `connectorStatus` counts a connector with
   `refreshUrl` as connected while its account cookie exists.
4. **A refused refresh** (`invalid_grant`, revoked consent): clear all three cookies; the Connections dialog shows
   the connector as not connected and the agent's tool answers "ask the person to connect again".
5. **Disconnect** revokes the refresh token at the provider (its revoke endpoint), then clears all three cookies.

Without a refresh token (VectorPoint issues none: its token lives 30 days and is useless without the app's secret)
the access cookie simply expires and the person presses **Connect** again — safe, only less convenient. Google
issues one with `access_type=offline` and `prompt=consent`; an app in Google's **Testing** publishing status gets
refresh tokens that end after 7 days.

**Hardening that goes with a JS-readable token:** any script on the page can read it, so keep the scopes as narrow as
the agent's tools need; forward it only to the agents that use it (the `cookies` allow-list, `SDK/setup.md` §5); serve
the chat pages with a strict Content-Security-Policy (no inline or third-party scripts); never put a token or the cookie
key in a `NEXT_PUBLIC_*` variable.

**This is the bridge to the agent.** The agent's tool reads the person's token with `system/cookies`
(`Cookies.get('vp_connect')`) and hands it to the agent-side service, whose connector sends it on each request —
[Services/access.md](../Services/access.md) §6 "The end user's own token — from a site cookie",
[system/cookies](../Flow/Nodes/Script/references/system/cookies.md). A cookie value is not masked like a Secret:
use it only in the request, never log or store it. A token lifted from the page should be useless alone — VectorPoint
refuses it without the app's own secret, which the agent side holds.

### A NEW connector `<id>` (e.g. `docstore`) — configuration only

No route, no OAuth code, no new test for a standard OAuth provider: the mechanism above is already tested.

1. **The `CONNECTORS` entry** — `src/configs/connectors.config.ts`:
   ```ts
   defineConnector({ id: 'docstore', name: 'DocStore', description: 'Let the agent read your DocStore files.',
       icon: '/connectors/docstore.svg', refresh: true })
   ```
   `refresh: true` only when the provider issues refresh tokens. The derived cookies are `docstore_connect`,
   `docstore_connect_account` (and `docstore_connect_exp`); pass `tokenCookie` only to keep a name agents already read.
2. **The `PROVIDERS` entry** — `src/service/connectors/providers.ts`, the same id:
   ```ts
   { id: 'docstore', authorizeUrl: 'https://auth.docstore.example.com/oauth/authorize',
     tokenUrl: 'https://auth.docstore.example.com/oauth/token', revokeUrl: 'https://auth.docstore.example.com/oauth/revoke',
     scope: 'files.read offline_access', clientIdEnv: 'DOCSTORE_CLIENT_ID', clientSecretEnv: 'DOCSTORE_CLIENT_SECRET',
     refresh: true }
   ```
   Add `authorizeParams` when the provider needs extra consent parameters (Google: `access_type: 'offline'`,
   `prompt: 'consent'`), and an `adapter` **only** for a non-standard answer — then add a test for that adapter.
3. **The icon** — `public/connectors/<id>.svg`.
4. **Secrets** — the client pair on the API key's **Secrets** card (`<ID>_CLIENT_ID`, `<ID>_CLIENT_SECRET`), then
   **Save and restart**. Never `NEXT_PUBLIC_*`.
5. **The provider side** — register the redirect URI `<application>/api/<id>/callback` (`application` from
   `keen-project.json` — the site's public origin, [setup.md](setup.md) §4).
6. **The agent side** — a service under `src/scripts/services/<service>/` whose tool reads the token cookie with
   `system/cookies` ([Services/SKILL.md](../Services/SKILL.md), [Services/access.md](../Services/access.md)), plus its
   service skill; add the cookie to the `cookies` allow-list the site passes for the agents that use it (`SDK/setup.md` §5).
7. **Check** — `npx tsc --noEmit`, `npx vitest run`, then Connect / Disconnect once in the dialog and a chat whose tool
   reads the token.

A ready Google connector (both entries) ships in the Google service package: `keen_services/google/entanglement/merge/`
— the format of such packages: [../Services/packages.md](../Services/packages.md).

## B. A server service with no per-person account

Verified shape (speech-to-text):

| File | Holds |
|---|---|
| `src/service/speech/scribe.ts` | server-only: the provider call, limits (audio ≤ 10 MB, 60 s timeout), a typed error; the key from `process.env.ELEVENLABS_API_KEY` (the model from `ELEVENLABS_STT_MODEL`, optional) |
| `src/app/api/speech-to-text/route.ts` | `POST` multipart; checks the session (401), the size before reading (413), the input (400); answers `{ success, text, languageCode, durationSecs }`; registered in `src/configs/api.config.ts` |

Template: `src/service/<name>/<name>.ts` (server-only, key from `process.env.<NAME>_API_KEY`, "not configured" →
503) + `src/app/api/<name>/route.ts` (session check, input limits, a clean reply) + the route in `api.config.ts` +
the key in the API key's **Secrets** card (**Save and restart**). Restrict the key at the provider to the one
capability the site uses. The browser calls the route; it never sees the key.

## Front Settings switch — not yet in the reference site

The model: an agent's **Front Settings** hold plain values such as
`{ "service_available": true, "service_title": "My Service" }`, and the site turns a connector on or off from them.

**What the reference site does today:** the Connections dialog lists every `CONNECTORS` entry, always. Nothing reads
a Front Settings field to show or hide a connector, and no `service_available` field is read anywhere. A connector is
off only when its settings are missing (its routes answer 503 "not configured").

**The target shape (not yet in the reference site):**

- the server reads the field **by name** through the connector's Front Settings cache —
  `globalThis.__keenConnector.frontSettings.get('<agent-slug>', '<name>_available')` (server-only, cache-first, never
  throws: a broken value reads as `undefined`); browser code goes through `GET /api/agent-front-settings?agentId=`;
- the list the dialog shows (and the connect route) keeps only the connectors whose switch is `true`; the title can
  come from `<name>_title`;
- a Front Settings save reaches the site only after **Rebuild and refresh data** (or a restart) —
  [delivering changes](../Administration/references/delivering-changes.md).

Until that exists, tell the person a Front Settings switch alone does not hide a connector on the reference site.
