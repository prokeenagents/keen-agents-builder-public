# @keenagents/chat-sdk

The chat client for **Keen** agents. It opens one WebSocket to the Keen relay and drives an agent's run: it sends the
person's prompt, then every node of the agent's flow one request at a time (the server runs one node per request),
and streams the answer back while it is written. It reconnects and resumes a running flow on its own.

The version follows the Keen release whose protocol it speaks: **15.3.x** speaks Keen 15.3 (wire protocol 2).

- No runtime dependencies. ESM and CommonJS builds, TypeScript types included.
- Runs in the browser and in Node ≥ 22 (it uses the global `WebSocket`).

## Install

```sh
npm install @keenagents/chat-sdk
```

## The URL and the origin

- **`url` is required** — there is no default. It is the relay's public endpoint,
  `wss://<your-keen-host>/ws-keen` (e.g. `wss://keen.example.com/ws-keen`). It is opened from the end user's
  machine, so it must be the public host; use `wss://` on an https page.
- **The origin rule.** The relay accepts the WebSocket only when its `Origin` header is **exactly** an origin that is
  allow-listed for your application in Keen (the origin on your API key's webhook record). A browser sends the page's
  origin by itself. Otherwise the upgrade is refused and the socket closes with code 1006 and no reason; the client
  stays `disconnected`.
- **The token.** Every frame carries the consumer's access token (never the URL). `userId` must be the token's `sub`
  and `email` its e-mail.

## In the browser

```ts
import { ChatAPI } from '@keenagents/chat-sdk';

const chat = new ChatAPI({
    url: 'wss://keen.example.com/ws-keen',
    spaceID: '<space id>',
    agentID: '<agent slug>',          // the agent's ID (slug), not a row id
    userId: '<token sub>',
    email: '<token e-mail>',
    accessToken: '<consumer access token>',
    onAuthExpired: refreshToken,      // () => Promise<string | null>
    errors: { "4XXX": { delay_ms: '5000', max_retry: 5 } },   // optional — see "A per-chat error policy"
});

chat.onStatus((status) => showStatus(status));
chat.onRunning((running) => setSendEnabled(!running));
chat.onStream((event, data) => {
    if (event === 'token' && typeof data.text === 'string') appendToAnswer(data.text);
});

chat.connect();
await chat.whenReady();

try {
    await chat.runFlow({ chatId: '<chat id>', prompt: 'Where is my order?' });
} catch (err) {
    if ((err as Error).message !== 'TaskQueue cancelled') showError((err as Error).message);
}
```

Build the client in the browser only (e.g. in an effect, never during server rendering), one per open chat, and call
`chat.disconnect()` when the chat closes.

## In Node

Node's built-in `WebSocket` sends no `Origin` header, so the relay refuses it. Provide a `WebSocket` that sends your
allow-listed origin — for example with the [`ws`](https://www.npmjs.com/package/ws) package — before connecting:

```ts
import WS from 'ws';
import { KeenChat } from '@keenagents/chat-sdk';

const ORIGIN = 'https://app.example.com'; // the origin allow-listed for your application

globalThis.WebSocket = class extends WS {
    constructor(url: string, protocols?: string | string[]) {
        super(url, protocols, { origin: ORIGIN });
    }
} as unknown as typeof WebSocket;

const chat = new KeenChat({ ws: 'wss://keen.example.com/ws-keen', token: process.env.KEEN_TOKEN!, email: 'ana@example.com' });

chat.onStream((event, data) => {
    if (event === 'token' && typeof data.text === 'string') process.stdout.write(data.text);
});
chat.connect();
await chat.api.whenReady();
await chat.run({ agentId: '<agent slug>', spaceId: '<space id>', chatId: '<chat id>', prompt: 'Hello' });
chat.disconnect();
```

`KeenChat` is the minimal wrapper: `{ ws, token, email }` (the `userId` is read from the token's `sub`; `errors`
optional, as on `ChatAPI`). Its `api` field is the full `ChatAPI`.

## The main API — `ChatAPI`

| Call | What it does |
|---|---|
| `connect()` / `disconnect()` | open the socket / cancel a running flow, close, stop reconnecting |
| `whenReady()` | resolves with the connection id on the relay's welcome; never rejects — race it with a timeout |
| `runFlow({ chatId, prompt, agentId?, projectId?, userId?, email? })` | runs one turn to the end; resolves with the flow tree, rejects on a final error, a lost connection or a cancel. One run at a time |
| `cancel()` | stops the run at once (`runFlow` rejects `TaskQueue cancelled`) and tells the server to drop it |
| `setAccessToken(token)` | the token for the next frame; no reconnect |
| `tryAgain()` | after `unavailable`: opens one new socket; resolves `true` once welcomed |
| `getStatus()`, `isRunning()`, `getPromptLimit()`, `getCorrelationID()` | snapshots; the prompt limit comes from the welcome |

`CHAT_SETTINGS` exports every constant (retries, heartbeat, reconnect, limits) for reading.

## Events

Each `on…` call returns an unsubscribe function.

| Subscription | Fires |
|---|---|
| `onStatus(status)` | `disconnected` · `connecting` · `connected` · `reconnecting` · `unavailable` |
| `onRunning(running)` | `true` when a run starts, `false` when it settles — gate Send on `connected && !running` |
| `onSummarizing(active)` | `true` while the agent compresses the conversation |
| `onStream(event, data)` | the live stream: `token` (`{ text }`, the answer as it is written), `thinking`, `message`, `progress`, `error` (a message, not a failure) and others |
| `onResponse(envelope, requestId)` | every node's reply |
| `onWelcome` / `onResume` | a new connection / a flow resumed after a dropped socket (the stream of the gap is not replayed) |
| `onSystem(text)` | the transport's narration, for logs |

## Errors

`runFlow` rejects with an `Error`. A reply the server marks **final** rejects with a `FlowError`
(`message` = the server's words, `code`, `details`).

The client treats as final exactly what the Keen relay treats as final:

- **Retried** — only `E4…` (nothing ran: an engine is overloaded or refused at admission) and `E7…` (a timeout or a
  transport error). On a node the same request is re-sent with backoff (up to 10 s) **without a limit** — an engine
  that is busy now is usually free again in 5–10 s, and the heartbeat keeps the run's memory alive meanwhile. The
  first prompt is bounded: 10 attempts (1 s apart, or the refusal's own `retryAfterMs` up to 60 s), then `runFlow`
  rejects with the refusal's message.
- **Final** — every other code: `E2…` (the request or the agent's project — e.g. `E2201`), `E3…` (the token or a
  permission; `E3002` is first refreshed once through `onAuthExpired`), `E5…`, `E6…` (`E5001`, `E6001`, `E6101` …),
  `E8…` (cancelled), an unknown code. The relay keeps a final reply and answers every re-send of the same request
  with it, so re-sending can never help. The run ends at once and the client tells the server to drop the flow.

`isFinalErrorCode(code)` / `isRetriedErrorCode(code)` answer the same question; `RETRIED_ERROR_FAMILIES` is
`['E4', 'E7']`.

### A per-chat error policy

A site can bound the retries for a chat when it creates it:

```ts
const chat = new ChatAPI({
    // … url, spaceID, agentID, userId, email, accessToken …
    errors: { "4XXX": { delay_ms: '5000', max_retry: 5 } },
});
// KeenChat takes the same option: new KeenChat({ ws, token, email, errors: { … } })
```

- **Keys** — a family or one code, with or without the leading `E`: `"4XXX"` / `"E4XXX"` (every `E4…`), `"40XX"`
  (a sub-family), `"4001"` / `"E4001"` (one code). `X` = any digit. The **most specific** key wins (the fewest `X`).
- **`max_retry`** — how many times a node (and the first prompt) is re-sent for a code under the key, counted per
  node visit. When they are used up the failure is final: `FlowError`, and the flow is cancelled. `0` = final at once.
  Absent = the default (unlimited on a node; the first prompt's 10 attempts).
- **`delay_ms`** — the pause before each re-send (default: the backoff above; 1 s on the first prompt). A server
  `retryAfterMs` still wins when it is larger.
- Both take a number or a numeric string (`'5000'`), so the policy can come from hand-written JSON.
- Only `E4…` / `E7…` can be retried. A policy on a final family (`"6XXX"`, `"E5XXX"` …) cannot help — the relay
  answers the re-send with the same reply — so it is ignored and the constructor logs one console warning naming the
  key.
- The constructor throws a `TypeError` on a bad key (not 4 digits / `X` after an optional `E`), two keys for the same
  codes, an unknown field, a negative or fractional `max_retry`, or a negative `delay_ms`.

Use it for a chat that must give up sooner than "until the engine is free" — e.g. a widget that should show
"busy, try again" after half a minute instead of waiting.

The texts the client itself uses are exported as `CONNECTION_LOST_TEXT` — match on them:
`The service is temporarily unavailable` (status `unavailable`: the application is stopped; no automatic reconnect,
offer a Try again that calls `tryAgain()`), `Invalid token` (sign the person in again),
`connection lost — the server no longer holds this flow`, `connection taken over by another session`,
`connection lost — this Keen server cannot resume a flow`. `TaskQueue cancelled` is the person's own cancel.

## Types

Every type is exported by name (`Envelope`, `FlowTaskBundle`, `NodeTask`, `ConnectStatus`, `ChatAPIOptions`,
`ErrorPolicy`, `ErrorPolicies`, …):

```ts
import type { FlowTaskBundle, ConnectStatus } from '@keenagents/chat-sdk';
import type * as Chat from '@keenagents/chat-sdk'; // Chat.Envelope, Chat.StreamEventHandler, …
```
