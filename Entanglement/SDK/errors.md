# Status codes the SDK can meet

Every reply is an envelope `{ code, success, message, data | details }` ([protocol.md](protocol.md) §3). The codes are
one shared catalogue, byte-identical in the relay and the engines (`GLOBAL/status/catalog/e*.ts`).

**The rule: the SDK treats as final exactly what the relay treats as final.** The
relay (`retry-policy.ts` `isFinalEnvelope`) keeps every reply except `E4…` and `E7…` in its reply buffer and answers
every re-send of the same request id from that buffer — so re-sending a final reply can never succeed: it loops every
second while the tab is open, and when the buffer was full the node runs again. The SDK therefore re-sends **only**
`E4…` (nothing ran — an engine is overloaded or refused at admission; it is usually free again in 5–10 s) and `E7…`
(a timeout or a transport error). `isFinalErrorCode(code)` (`utils.ts`) says final = every code except those two
families (`RETRIED_ERROR_FAMILIES = ['E4', 'E7']`); `isRetriedErrorCode(code)` the opposite. While a node waits, the
heartbeat keeps the run's memory alive on the server.

A site can bound the retries per chat with the **error policy** — `new ChatAPI({ …, errors: { "4XXX": { delay_ms:
'5000', max_retry: 5 } } })` ([setup.md](setup.md) "Error policy per chat"). It can make an `E4` / `E7` code final
sooner (`max_retry`) and set the pause (`delay_ms`); it can never make a final code retried — a policy on a final
family is ignored with one console warning.

| Family | Meaning | Default on a node | Default on the run frame (the first prompt) | Can the policy change it? |
|---|---|---|---|---|
| `E1…` | success | follows `data` | follows `data` | — |
| `E2…` | the request or the author's project is wrong | **final** — the flow is killed (below) | final | no (ignored + warning) |
| `E3…` | authentication / permission | **final** (`E3002` refreshed once first when `onAuthExpired` is set) | final (`E3002` refreshed once first when `onAuthExpired` is set) | no (ignored + warning) |
| `E4…` | capacity — nothing ran | **retried, no limit**, backoff ≤ 10 s (a `retryAfterMs` honoured up to 10 s) | **10 attempts, 1 s apart (or the refusal's `retryAfterMs` up to 60 s; a longer one rejects at once), then rejects** ("busy, try again in a minute") | **yes** — `max_retry` bounds it (per node visit, and the run frame's budget), `delay_ms` sets the pause |
| `E5…` | resource | **final** | final | no (ignored + warning) |
| `E6…` | system / invariant | **final** | final | no (ignored + warning) |
| `E7…` | upstream — a timeout, NATS, Dragonfly | **retried, no limit**, backoff ≤ 10 s | 10 attempts, 1 s apart, then rejects | **yes** — as `E4…` |
| `E8…` | cancelled / aborted | **final** | final | no (ignored + warning) |
| any other | an unknown code | final | final | no |

"Retried, no limit" means the SDK re-sends the same visit (same request id) with full-jitter backoff (caps 1 → 2 → 4 →
8 → 10 s) until a reply that is not retried, or the person's cancel. Under a policy with `max_retry` the visit is
re-sent at most that many times for codes under the key; the next such reply is final.

**A final code kills the flow** (a flow problem means killing the flow directly): the run ends at once and `runFlow` rejects — once — with a `FlowError` (`message` = the
envelope's message, `code`, `details`); the SDK sends the **cancel** for the `cid` so the server releases the flow;
no other node of the run keeps retrying ([task-queue.md](task-queue.md) §4). The site shows the message in an error
row. The same happens when a policy's `max_retry` is used up.

> **The reference site's own copy, before it switches to the package, still retries every `E5…` / `E6…`** (only `E2…`,
> `E3…`, `E8…` end its run) — `E6101`, `E5201`, `E6003`, `E6001` there are re-sent forever (the run spins, the person
> sees "thinking" until they cancel), and its `KeenChat.cancel()` sends only the frame. On a site still on that copy,
> the builder prevents it: wire every LLM node's Out (and Fallback), never leave a Run / Jump target empty, run
> `keen-validate` before every deploy.

## E1 — success

| Code | Words | Who | When |
|---|---|---|---|
| `E1001` | OK | flow / script / LLM engine | every successful node; `data` = the next step ([protocol.md](protocol.md) §4) |
| `E1002`, `E1101` | Created, Accepted | — | not used on the chat path |

## E2 — the request or the project (final)

| Code | Words | Who · when | Show the person | The builder checks |
|---|---|---|---|---|
| `E2001` | Missing required field | **relay**: no / too long `requestId`, a frame between welcome and `resumed` (`resume in progress — wait for resumed`), no welcome `cid`, `flowContext.correlationId` ≠ the socket's `cid`, no `rootAgentContext.agentId`; **engines**: no `correlationId`, `requestId`, `chatContext.chatId` / `projectId`, start entry | "Something went wrong — please try again." | the site's SDK copy is unmodified; the run passes an agent slug, a chat id and the space |
| `E2002` | Invalid envelope | engines: the request body is not a valid envelope | as above | an SDK / relay version mismatch |
| `E2003` | Duplicate identifier | not sent today (a duplicate request id joins the running dispatch) | — | — |
| `E2101` | Validation failed | relay: the prompt is not text, or longer than `limits.promptChars` (20 000): `The message is too long (at most 20000 characters).` | the message as is; stop Send above the limit (`getPromptLimit()`) | the composer's counter |
| `E2201` | Agent project error | flow / script / LLM engine: the project was refused (the security scan, a flow file that does not import); an entry not in the project (the agent's start entry, a Run / Jump target); a node failure that is the author's (its time or memory limit, a condition that does not parse, a refused expression / Loop setting / session value); a commit that takes the dictionary or the session over its cap (1.5 MB), also a Parallel Context merge-back. One line goes to the agent's Log Record | "This agent cannot answer right now." (the message names the project fault, not for the person) | the agent's **Log Record** in the console; fix the project and deploy again |

## E3 — authentication and permission (final)

| Code | Words | Who · when | Show | Check |
|---|---|---|---|---|
| `E3002` | Invalid token | **relay**: no token, an invalid / expired / revoked token, `userId` ≠ the token's `sub`, the e-mail ≠ the token's, the API key's generation is stale (rotated); **flow engine**: its own check of the consumer. In a `resume-refused` as reason `token` | with `onAuthExpired`: nothing (the SDK refreshes once and retries); a `null` refresh → `Invalid token` → sign the person in again | `onAuthExpired` is wired; the token's `sub` is the `userId` |
| `E3101` | Permission denied | relay: no `projectId`; the space not in the token's `space` claim or not in the contract; the contract key rotated (a stale token); the agent not in the space — **an agent row id instead of its slug** | "You do not have access to this agent." | the slug (`agent.agentId`); the contract's spaces; the consumer's spaces |
| `E3001`, `E3003`, `E3201` | Unauthenticated, Invalid instance secret, Insufficient credits | — | not used on the chat path (`E3201` reserved) | — |

## E4 — capacity, nothing ran (retried; the policy can bound it)

| Code | Words | Who · when | Show | Check |
|---|---|---|---|---|
| `E4001` | Engine refused at admission — retry | **relay**, run frame only: `too many prompts running for this account` (8 at once), `too many prompts this minute for this account` (60 a minute; `details.retryAfterMs` = when the window allows — the SDK waits it, ≤ 60 s), `account blocked for new prompts` (`details.retryAfterMs` up to the block, 15 min by default — the SDK rejects at once); any frame: `No engine in the queue group` (no engine up); **engines**: memory admission | on the first prompt after 10 tries (or at once for a block): the message ("busy — try again in a minute"); on a node: nothing (it retries — or, with a policy's `max_retry` used up, the message) | the agent's loops do not start runs in a burst; the engines are up |
| `E4002` | Queue wait timeout — retry | engines: the task waited too long for a slot | nothing | load |
| `E4101` | Memory pressure — retry | engines: the memory guardian evicted the run's node (the retry starts clean) | nothing | very large dictionary / Script data |

## E5 — resource (final)

| Code | Words | Who · when | Show | Check |
|---|---|---|---|---|
| `E5001` | Resource not found | engines: `Project <id> not found` — the project is not on disk (perhaps mid-deploy) | **final** — "This agent cannot answer right now — try again in a moment." (the relay replays this reply to a re-send of the visit; the person's next prompt is a new run) | the space's project is deployed; the space id |
| `E5201` | Resource gone | relay: `the flow is no longer held` — a resume of an ended / expired / cancelled `cid` (`resume-refused gone`), or a node frame for such a `cid` | **final** — after a resume: `connection lost — the server no longer holds this flow`; on a node: `the flow is no longer held` (nothing would ever answer a re-send) | — |
| `E5101` | Resource conflict | — | not used | — |

## E6 — system (final)

| Code | Words | Who · when | Show | Check |
|---|---|---|---|---|
| `E6001` | Internal error | flow engine: a node failed in a way not provably the author's (`ConditionNode: …`, `LoopNode: …`, `EndNode: …`), a commit to Dragonfly failed | **final** — "Something went wrong — please try again." (a re-send of the visit would get the same buffered reply) | the agent's Log Record and the platform logs |
| `E6002` | Unhandled exception | engines: an unexpected exception (no status of its own) | as above | as above |
| `E6003` | Response exceeds transport max payload | flow engine: its reply is over the NATS limit (typically a huge fan-out). The catalogue: "NOT retryable — retrying produces the same oversized reply" | **final** — "This step produced too much data." | split the data; a Parallel Context over a smaller list |
| `E6101` | Invariant violation | **flow engine**: `Run Flow Node called with empty entry` (Run Flow and Jump Flow), `Node "<id>" missing from project` (Run / Jump / Parallel In, a broken entries → nodes mapping); **LLM engine**: an LLM node's setup error — missing agent name / agent ID / LLM settings, an unknown provider or model, a prompt list the provider cannot take — **when the node has neither a Fallback nor an Out** (with one, the error text becomes the node's answer, `responseType: 'error'`, and the flow goes on) | **final** — the flow is killed with the engine's message ("This agent cannot answer right now."); the site's own copy still spins (see above) | every LLM node wired; no empty Run / Jump target; `keen-validate` |

## E7 — upstream (retried; the policy can bound it)

| Code | Words | Who · when | Show | Check |
|---|---|---|---|---|
| `E7001` | NATS request timeout | relay: the engine did not answer in time | nothing (it retries; on the first prompt 10 attempts) | the platform |
| `E7002` | NATS transport error | relay: NATS failed; also `revocation list unavailable` (the relay cannot check revocations yet — never a sign-out), as a reply or a `resume-refused unavailable` | nothing | the platform |
| `E7101` | Redis unavailable | relay: Dragonfly cannot be asked before a dispatch or a resume; flow engine: the signing chain could not be read | nothing | the platform |
| `E7301` | LLM upstream error | — not sent: a provider's failure (also its timeout) becomes the LLM node's answer with `responseType: 'error'` | — | the node's Fallback edge handles it |

## E8 — cancelled (final)

| Code | Words | Who · when | Show | Check |
|---|---|---|---|---|
| `E8001` | Cancelled | engines: the run was cancelled (the person's cancel, the flow torn down); relay: a debugged run past its debug limit | nothing extra — the SDK already rejected `TaskQueue cancelled` → "Canceled." | — |
| `E8101` | Aborted by guardian | script engine: the Script reached its wall-clock limit (15 min); a retry would run it again | "This took too long." | split the Script's work over several nodes |
| `E8002` | Client disconnected | — | not used | — |

## Failures that are not codes

| What | Seen as |
|---|---|
| close 4401 | status `unavailable`; the run fails `The service is temporarily unavailable` (the SDK labels it `E3002`) |
| close 4409 | the run fails `connection taken over by another session` |
| a frame over 8 MiB | `frame is … MB, over the 8.0MB limit …` — final, the run is cancelled (a `FatalSendError`) |
| a final reply code | a `FlowError` with `code` and `details` (the message is the envelope's) |
| a Script's `system/chat` error | an `error` **stream** frame — a message, the run goes on |
| an LLM provider failure | a normal reply with `responseType: 'error'` |
