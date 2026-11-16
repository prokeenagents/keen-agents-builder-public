# Setting the SDK up in a site

How the reference site wires the chat SDK, and what any site must get right. Entry: [sdk.md](sdk.md).

## 0. Install

```sh
npm install @keenagents/chat-sdk
```

```ts
import { ChatAPI, KeenChat, FlowError, CHAT_SETTINGS } from '@keenagents/chat-sdk';
import type { FlowTaskBundle, ConnectStatus } from '@keenagents/chat-sdk';
```

ESM and CommonJS builds with types; no runtime dependencies; Node ≥ 22 or any current browser. On npm since
2026-11-15 (`npm install @keenagents/chat-sdk@15.3.0` — the version is the Keen release it speaks). An older site
still carries its own copy under `src/service/services/chat/`, with the types as the global `App.Chat.*`: move it to
the package.

## 1. The settings — `CHAT_SETTINGS` (`settings.ts`)

The SDK keeps every constant in one object, exported for reading. Per instance (`ChatAPIOptions`) a site passes
**`url` (required)** and, when it needs them, `contextBatchSize`, `cookies`, `onAuthExpired` and `errors` (the
chat's error policy, §8); the rest are constants.

| Setting | Value | What it is |
|---|---|---|
| `url` (the option) | **required, no default** | the relay's public endpoint, `wss://keen.example.com/ws-keen`. `new ChatAPI(...)` without it (or with an empty one) throws `` ChatAPI: `url` is required … `` (`KeenChat`: `ws`). It is opened in the end user's browser, so never a local address. (The site's copy still has a placeholder default `CHAT_SETTINGS.WS_URL`; the package has none) |
| `RESPONSE_TIMEOUT_MS` | 600 000 | how long one node's reply is awaited before the visit is re-sent (same request id) |
| `RETRY_DELAY_MS` | 1 000 | the pause of the transport retry and of the run frame's refusals without a `retryAfterMs` |
| `RUN_FRAME_RETRY_AFTER_MAX_MS` | 60 000 | the longest `retryAfterMs` of a refused first prompt the SDK waits; a longer one (an account blocked for minutes) settles the run at once with the refusal |
| `RETRY_BASE_DELAY_MS` / `RETRY_MAX_DELAY_MS` | 1 000 / 10 000 | a node's response retries (`E4…` / `E7…` only): full jitter, caps 1 → 2 → 4 → 8 → 10 s; a chat's `delay_ms` replaces it (§8) |
| `INITIAL_MAX_RETRIES` | 10 | attempts for the run frame (the first prompt) only; a chat's `errors` policy with `max_retry` replaces it for the codes its key matches (§8) |
| `HEARTBEAT_INTERVAL_MS` | 5 000 | the `ping` while a run is in flight |
| `LIVENESS_MS` | 15 000 | no inbound frame this long during a run → the socket is taken as dead (closed 4000, reconnected) |
| `CONTEXT_BATCH_SIZE` | 15 | Parallel Context runs per wave |
| `MAX_FRAME_BYTES` | 8 MiB | a larger outbound frame fails at once (`FatalSendError`) instead of retrying forever |
| `RECONNECT_BASE_MS` / `RECONNECT_MAX_MS` / `RESTART_JITTER_MS` | 1 000 / 10 000 / 1 000 | the reconnect backoff; after a relay restart (1012) 0–1 s |
| `RESUME_MAX_ATTEMPTS_PER_SOCKET` | 5 | refused resumes before the SDK opens a new socket |
| `PROTOCOL` | 2 | the wire protocol (resume, `pong`) |
| `errors` (the option) | none | the chat's error policy — how many times and how far apart `E4…` / `E7…` are re-sent (§8) |

**The URL in the reference site:** the server reads `KEEN_WS` (`.env.local`) in `getConsumerData()` and hands it to
the browser as `consumer.wsUrl`; `ChatShell` passes it as `url`. Use `wss://` for an https site (a browser blocks `ws://`
from an https page). The relay's public path is `/ws-keen`. A free tunnel that cannot carry a WebSocket upgrade does
not work for `KEEN_WS` — point it at Keen's real host.

## 2. The end user's token

The relay checks the consumer **access token on every frame** (the run frame, every node, every `resume`). The SDK
never mints one; it carries it in `userContext.accessToken` and re-stamps the current value on every frame.

| Step | Where (reference site) | What happens |
|---|---|---|
| sign-in | the site's server → Keen `POST /keen-api/auth/access_token` (and the OTP confirm) | Keen's consumer auth mints the pair; the site stores both tokens in **httpOnly** cookies |
| to the browser | `getConsumerData()` → `ConsumerProvider` | the browser receives the **access** token only (never the refresh token), plus the token's payload (`sub`, `email`, `space`) |
| into the SDK | `ChatShell` | `new ChatAPI({ accessToken, userId: payload.sub, email: payload.email, … })` |
| rotation | browser → `POST /api/refresh` → Keen `/keen-api/auth/refresh_token` | the server rotates with the refresh cookie and returns the new access token; when the current one still has life Keen answers "still valid" and nothing is minted |

The relay's checks, in order (each refusal is a frame, not a close): token valid and not revoked (`E3002`), the
API key's state (`E3002` stale, close **4401** stopped, `E7002` list unavailable), `userContext.userId` = the token's
`sub` (`E3002`), `userContext.email` = the token's e-mail (`E3002`), the space in the token's `space` claim and in the
contract (`E3101`), the agent slug in that space (`E3101`). So **`userId` must be the token's `sub`** — `KeenChat`
decodes it for you.

**Refreshing while a chat is open** — the token is renewed when the relay says so, never on a timer. The reference
site does two things, and a new site should copy both:

1. `onAuthExpired: checkAndRefreshToken` — the relay refuses an expired or revoked token with `E3002` at once (before
   anything runs, so the same request can be sent again), and the SDK calls the hook ONCE — on the first prompt, on a
   node, or when a `resume` is refused `token`; every node refused at the same moment awaits that one renewal. A
   string becomes the new token (`setAccessToken`) and the same request is sent again; `null` ends the run with
   `Invalid token`; a throw is retried after the backoff (a passing Keen outage never signs the person out).
2. When the server re-renders a new token (a page load renews an expired one), an effect calls `setAccessToken` —
   no reconnect.

No timer: an idle open tab does not renew, so it does not keep the person's session alive — only real use does.

**How long a session lives.** The access token lives 10 minutes; each renewal mints a new refresh token, so a
session slides while the person uses the site and ends after the refresh token's lifetime without use. Since
2026-11-14 it also ends **30 days after the sign-in** whatever the activity (Keen refuses the renewal → `null` →
sign in again). **Signing out** (`/api/logout`) ends the session on Keen too — the pair is revoked, so a copied
cookie stops working — and then clears the cookies.

`checkAndRefreshToken` shares ONE request in flight: a rotation spends the refresh token, so two at once would make the
second one fail. `/api/refresh` answers 401 (session over → `null`) or 502 (Keen did not answer → a throw).

## 3. The origin

The browser sets the WebSocket's `Origin` header to **the page's origin** (scheme + host + port). The relay accepts the
upgrade only when that origin is **exactly** one of the origins on the API keys' webhook records (its allow-list is
built from them). Otherwise:

- the TCP socket is dropped before the upgrade — the browser sees close **1006** with no reason, like a dead server;
- the SDK stays `disconnected` (it reconnects only after a first `welcome`), and `whenReady()` never resolves — race it
  against a timeout.

**In Node** the built-in `WebSocket` sends **no** `Origin`, so the relay refuses it. A headless caller installs a
`WebSocket` that sends the allow-listed origin before `connect()` — e.g. the `ws` package:
`globalThis.WebSocket = class extends WS { constructor(u, p) { super(u, p, { origin }); } }` (the package README has
the full example; the builder's agent runner does the same with `--origin`).

When the origin belongs to an API key that is **stopped** (disabled, deleted, rotated, re-bound) the relay closes the
socket **4401** `service unavailable` before the welcome: status `unavailable` (see [using.md](using.md) § 4401).
The WebSocket host does not have to be the page's host; the origin is what counts. The site's own address must be a
public `https://` address (see [../SKILL.md](../SKILL.md) rule 1).

## 4. What a chat is opened for

| Value | Reference site | Rule |
|---|---|---|
| `spaceID` | the route `/space/[id]/[agentID]/[chatID]` | `projectID` defaults to it (space id = project id); the relay checks it on every frame |
| `agentID` | the route carries the agent's **row id**; `ChatShell` maps it to the agent's **slug** (`agent.agentId`) from `consumer.agents` (active ones) | always the **slug** — a row id is answered `E3101` |
| `chatId` | the route's `chatID` | required on every `runFlow`; every history row is keyed by it; the same id on every turn of one conversation, a new id for a new conversation |
| `userId` / `email` | the access token's `sub` / `email` | must match the token |

One `ChatAPI` per open chat. `ChatShell` builds it once per (chat, space, agent, user) and disconnects it on unmount.

## 5. Cookies — which ones each agent gets

**The site decides, per agent, which cookies reach that agent's scripts — at the moment it creates the SDK.**

- The site creates a `ChatAPI` for **every chat with an agent**: the reference site does it in
  `src/components/ui-chat/chat-shell/component.tsx`, once per chat thread, and again when the chat, the agent or the
  person changes (not on a token refresh). That constructor call is THE place to choose the cookies for that agent:
  pass `cookies` there.
- What the option takes:
  - `cookies: ['vp_connect', …]` — an allow-list of names; only those JavaScript-readable cookies are forwarded;
    `[]` = none.
  - `cookies: { name: 'value' }` — a ready map, used as is (a headless caller with no browser, e.g. the runner).
  - no `cookies` option → **every** cookie JavaScript can read (`document.cookie`) is forwarded — the reference site
    passes none today, so every agent gets every cookie. Give each agent only what its tools need.
- What they are for: a connector's token cookie (e.g. VectorPoint's `vp_connect`, `../connectors.md`) that the agent's
  tool reads with `system/cookies` and hands to the agent-side service (`../../Services/access.md`). List exactly the
  cookies the agent's tools use; an agent without such tools gets `[]`.
- When and how they travel: on the **run frame only** (each new message of the person) as
  `requestContext.cookies`; the engine keeps them for that run (wiped at the root End) and Script nodes read them with
  `system/cookies`. HttpOnly cookies (the session cookies) are never visible to `document.cookie`, so never sent.
  Cookie values are **not masked** in the run — never log them or put them into a prompt.

```ts
// the site, where it opens a chat with the agent `agentSlug`
const forward = agentSlug === 'omega-agent' ? ['vp_connect'] : [];   // the cookies THIS agent's tools need
const chat = new ChatAPI({ url, spaceID, agentID: agentSlug, userId, email, accessToken, cookies: forward });
```

## 6. Reconnect and resume

A dropped socket never ends a started flow. On a drop after the first welcome the SDK reconnects (full-jitter backoff
up to 10 s, no attempt limit; 0–1 s after a relay restart). On the new socket's welcome, if a flow was running, it
sends `resume` with the old `cid` and its resume handle; the relay re-binds the old `cid` (`resumed`), the SDK re-sends
every unanswered frame **with its original request id**, and the run goes on. The relay holds a detached flow for its
grace (120 s by default) and keeps the engines' TTLs alive meanwhile.

The token stream emitted while the socket was away is **not replayed**: `onResume` fires; the reference site re-reads
the chat history when the resumed turn ends. Refusals of a resume: `token` → refresh, `unavailable` → retry on the same
socket, `gone` / `protocol` → the flow is lost (`connection lost — the server no longer holds this flow`); if nothing
had started yet, the SDK re-sends the start on the new `cid`. Close codes: [protocol.md](protocol.md) § Closes.

## 7. More than one tab

Each tab builds its own `ChatAPI` → its own socket → its own `cid`. Request ids are random v4 UUIDs, unique across
tabs. Two tabs on the same `chatId` run two independent flows that write the same chat's history; nothing locks one
against the other — disable Send while `running` in each tab. Close **4409** (`superseded`) happens only when the same
`cid` is resumed on a newer socket; that older socket's run fails with `connection taken over by another session`.
The relay caps open sockets per replica (5 000) and per client address (1 000): above them the upgrade is refused 429.
Per account it caps 8 running flows and 60 started runs a minute; above them the run frame is refused `E4001`.

## 8. Error policy per chat

**What is final and what is retried — the default.** The SDK treats as final exactly what the Keen relay treats as
final. The relay keeps every reply except `E4…` and `E7…` in a reply buffer and answers every re-send of the same
request id from it, so re-sending such a reply can never succeed. So:

| Code | Default | Why |
|---|---|---|
| `E4…` | **retried** — a node without a limit (full-jitter backoff, 1 → 10 s); the first prompt 10 attempts, 1 s apart (or the refusal's `retryAfterMs`, up to 60 s) | nothing ran: the engine is overloaded or refused at admission; it is usually free again in 5–10 s |
| `E7…` | **retried** — as `E4…` | a timeout or a transport error (NATS, Dragonfly): nothing was answered, the relay did not buffer it |
| everything else (`E2…`, `E3…`, `E5…`, `E6…`, `E8…`, an unknown code) | **final** — `runFlow` rejects with a `FlowError` and the SDK sends the cancel (the flow is killed) | the relay replays the same reply to every re-send |

While a node waits for its next re-send, the **heartbeat** (every 5 s) keeps the run's dictionary, session and agent
state alive on the server, so a long wait loses nothing. Every code: [errors.md](errors.md).

**The policy.** A site that wants a chat to behave differently passes `errors` when it creates the chat:

```ts
const chat = new ChatAPI({
    url, spaceID, agentID, userId, email, accessToken,
    errors: { "4XXX": { delay_ms: '5000', max_retry: 5 } },
});
// KeenChat takes the same option: new KeenChat({ ws, token, email, errors: { "4XXX": { delay_ms: '5000', max_retry: 5 } } })
```

Here: an `E4…` reply is re-sent at most **5 times**, **5 s** apart; the 6th `E4…` for the same node ends the run like a
final code (`FlowError` with the refusal's code and message, then the cancel). `E7…` keeps the default.

- **Keys** — one family or one code, with or without the leading `E`: `"4XXX"` / `"E4XXX"` (every `E4…`), `"40XX"`
  (a sub-family: `E4000`–`E4099`), `"4001"` / `"E4001"` (one code). `X` = any digit (`x` is accepted too).
- **The most specific key wins** — the one with the fewest `X`: with `{ "4XXX": { max_retry: 0 }, "4001": { max_retry:
  3 } }`, `E4001` is re-sent 3 times and every other `E4…` is final at once. Between two keys with as many `X`, the one
  whose digit comes first (left to right) wins.
- **`max_retry`** — how many times a node (and the first prompt) is re-sent for codes under that key, counted **per
  node visit** (a new node starts again from 0; codes under one key share its count). When used up, the failure is
  final. `0` = final at once. Absent = the default: unlimited on a node; the first prompt keeps its 10 attempts.
- **`delay_ms`** — the pause before each re-send for codes under that key (ms). Absent = the default pause (the backoff
  on a node, 1 s on the first prompt). A server `retryAfterMs` still wins when it is larger (capped at 10 s on a node,
  60 s on the first prompt).
- **Values** — a number or a numeric string (`5`, `'5'`, `'5000'`; whitespace trimmed), so the policy can come from
  hand-written JSON.
- **A final family cannot be retried.** A policy on `"6XXX"`, `"E5XXX"`, `"2XXX"` … would only make the relay replay
  the same reply, so the SDK ignores it and logs **one console warning** naming the key when the chat is created
  (`max_retry: 0` there asks for what is already true — no warning). A key that starts with `X` (`"XXXX"`) applies to
  `E4…` / `E7…` only; with `max_retry > 0` it warns so.
- **Checked at construction** — the constructor throws a `TypeError` naming the key on: a key that is not 4 characters
  of digits / `X` after an optional `E`; two keys for the same codes (`"4XXX"` and `"E4XXX"`); a field other than
  `max_retry` / `delay_ms` (a typo is never ignored); a `max_retry` that is negative or not a whole number; a `delay_ms`
  that is negative or not a number.

**When a site sets it.** The default waits for a busy engine as long as it takes — right for a chat where the person
waits for the answer anyway. Set a policy when a chat must **give up sooner** and say so: a small widget that should
show "busy, try again" after half a minute (`"4XXX": { delay_ms: '5000', max_retry: 5 }`), a background or scheduled
chat that should fail fast and be retried by its caller (`"4XXX": { max_retry: 0 }, "7XXX": { max_retry: 2 }`), or a
first prompt that may wait longer than 10 s for a free engine (`"4XXX": { max_retry: 30 }`). One policy per `ChatAPI`
— the site can choose it per agent in the same place it chooses the cookies (§5).
