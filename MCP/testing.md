# Testing an agent — the runner, the trace, the logs

You test an agent by chatting with its **deployed** version through the runner (`MCP/agent-runner/run.ts`), as
an MCP consumer, and reading what every node did. The runner uses the same chat SDK a browser uses.

## 1. The loop

```
edit → keen-validate → keen-deploy → run.ts → read → fix → (again)
```

1. **Edit** the project (`../ProjectStructure/SKILL.md`, `../Flow/Nodes/SKILL.md`, `../Flow/Tools/SKILL.md`).
2. **Validate**: `keen-validate` → `0 error(s)` (`validator.md`).
3. **Deploy**: `keen-deploy` → `deployed` (`uploader.md`). Only now is the change live.
4. **Run**: `run.ts --prompt "…" --json`.
5. **Read** the trace (§4) and, for engine errors, the agent's Log record (§6).
6. **Fix** the cause, never the symptom; back to 1. A change to an agent record (`update_agent`, settings) needs
   no deploy; a change to anything bound to the api key needs `wake_api_key` (and a re-binding ends every token of
   the key: mint a new `KEEN_TOKEN`).

From the project root (where the git-ignored `.env` is) the three commands are:

```bash
keen-validate && keen-deploy && npx --prefix <MCP>/agent-runner tsx <MCP>/agent-runner/run.ts --prompt "Hello" --json
```

## 2. Set up the runner (once)

```bash
cd <MCP>/agent-runner && npm install     # Node 20 or newer; installs ws, dotenv, fflate, tsx
```

The `.env` is the project's (`golden-path.md` §13), copied from `agent-runner/.env.example`. `run.ts` reads `.env`
from the **current folder**, so run it from the project root. Write values unquoted.

**Tokens stay in `.env`, never on the command line.** Write a fresh `access_token` into `KEEN_TOKEN` (and the refresh
token into `KEEN_REFRESH_TOKEN`) and run `run.ts` without `--token`. Never put a token, a secret or a cookie value into a
command, a shell variable you echo, or a message: a command line lands in the chat's history and in the process list.

## 3. `run.ts` flags

Each value: the flag first, then `.env`. Flags take `--key value` or `--key=value`.

| Flag | `.env` | Meaning |
|---|---|---|
| `--host` | `KEEN_HOST` | the bare host (required) — the host of `server` in `keen-project.json` (`../ProjectSetup/keen-project.md`). The socket derives: `wss://<host>/ws-keen` |
| `--space` | `KEEN_SPACE_ID` | the space id (required; also the project id) |
| `--agent` | `KEEN_AGENT` | the agent **slug**, not the record id (required) |
| `--token` | `KEEN_TOKEN` | the consumer `access_token` (required; the only auth; lives 10 minutes). Use `.env`, not the flag |
| `--user-id` | `KEEN_USER_ID` | the consumer id — must equal the token's sealed subject |
| `--email` | `KEEN_EMAIL` | must be non-empty; not matched for an MCP consumer |
| `--origin` | `KEEN_ORIGIN` | the Origin header — `application` in `keen-project.json`; must equal the webhook origin of the fully bound key (required in practice) |
| `--prompt` | `KEEN_PROMPT` | the person's message (required; ≤ 20 000 characters) |
| `--chat-id` | `KEEN_CHAT_ID` | continue one conversation (default: a fresh id per run) |
| `--cookie name=value` | `KEEN_COOKIES="a=1;b=2"` | cookies the scripts read with `system/cookies` (repeatable; the flag wins) |
| `--json` | — | NDJSON on stdout (use it) |
| `-h`, `--help` | — | usage (needs `npm install` first) |

**Exit codes:** `0` the run settled — check `endReached`, it does not mean the flow reached an End node ·
`1` the run failed (the partial tree is printed first; a final error code ends the run at once with
`run FAILED: <code> <message>`) · `2` bad arguments, no token, or a prompt over the limit
(nothing sent) · `130` cancelled with Ctrl+C.

**Ctrl+C** cancels the flow on the platform (its dictionary, session and queue are wiped), then exits `130`. A
second Ctrl+C exits at once. Killing the process without Ctrl+C leaves the flow running until the platform's
grace (120 s by default) ends it.

## 4. Reading the trace (`--json`)

stdout holds only the runner's lines; tokens are printed as `"<redacted>"`; the SDK's own logging goes to stderr.

```jsonc
{"t":"meta","line":"connect wss://… · space=… · agent=… · chat=run-…"}
{"t":"meta","line":"ready — cid 49dece98-…"}
{"t":"stream","event":"token","data":{"text":"Hello! How can I help?"}}
{"t":"meta","line":"run complete — 1 flow bundle(s)"}
{"t":"flow","flowId":"<cid>_<sessionId>_<flowId>","endReached":true,"flowTask":{…},"nodeTasks":[…]}
{"t":"summary","ok":true,"flows":1,"endReached":1}
```

| Line | What it tells you |
|---|---|
| `t:"meta"` | the runner's notes: connect, ready (the relay's welcome), a minted chat id, reconnect / resume lines, `run FAILED: <reason>` (`run FAILED: <code> <message>` for an error code from the platform) |
| `t:"stream"` | the **live** view, one per frame: `event` ∈ `thinking`, `processing`, `progress`, `token`, `error`; `data.text`. Every LLM node's answer streams, helpers included; `<SYSTEM CALL>…</SYSTEM CALL>` marks a tool call |
| `t:"flow"` | the **structural** view, one per flow bundle (a Run Flow child or a parallel branch is its own bundle). `nodeTasks[]` = each node that ran, in order: `nodeContext.kind` + `id`, the request (`flowContext`, `options`), and `response` (`success`, the output, or `code` + `message` for an error). An LLM node's response also carries `provider`, `model`, `usage`, `finishReason` and the answer `text` |
| `endReached` | `true` = the flow's End node answered `{ final: true }`; `false` = an unwired output ended it (usually a bug) |
| `t:"summary"` | always last: `ok`, `flows`, `endReached`, and `error` when `ok` is false |

Read in this order: the summary → the failing `flow` line → the last node with `success: false` or the node
whose output is not what you expected → its request (what it was given) → its response (what it did).

## 5. The consumer token and multi-turn tests

- **10 minutes.** `KEEN_TOKEN` is the MCP consumer's access token; `expires_in` says how long (600 s on a standard
  install). Mint a fresh one right before a test session: `refresh_mcp_consumer_token { refresh_token }` (a NEW
  pair — replace both values) or `get_mcp_consumer_token { id, secret }`. Write it into `.env`.
- **Why the runner cannot refresh it:** an MCP consumer's token is minted only through the MCP server, by an MCP
  account with a confirmed session; the runner holds no MCP sign-in and no consumer secret. A token that expires
  mid-run ends the run with `Invalid token` (exit 1); just mint and rerun.
- **Multi-turn:** set one `KEEN_CHAT_ID` (or `--chat-id`) and run once per turn; each run continues the same
  conversation. Without it every run starts a new chat (and fills the consumer's chat list). Switch to a new id
  to test from a clean slate or when the agent's memory went wrong.
- A dropped socket reconnects and resumes the flow by itself (meta lines `close (code …) — reconnecting …` and
  `resumed — …`). Stream frames sent while away are not replayed; the `flow` lines are complete.

## 6. The agent's Log record — the engine's own words

The trace shows each node's answer; the **Log record** shows what the engines wrote about the run: one line per
failed run (an `E2201` reason, a cap breach, a time limit), `LLM answer cut at maxTokens …`, `Chat summary failed …`,
and the scripts' own `Log.info / warning / error / debug` lines (`../Flow/Nodes/Script/references/system/log.md`).
A secret a script read shows as `••••`. Without an enabled record for the agent (or its space), these lines are
dropped.

The lines are stored (30 days) but **no MCP tool and no console page reads stored lines** (`get_log_file` reads
only the platform's own system log files by plain name). Read them **live**, before you send the test message:

1. `list_log_records { spaceId }`. None for the agent? Create one:
   `create_log_record { title, selector: 'AGENT', spaceId, agentSlug: '<slug>', allowClientRead: true }`.
   An existing one must have `enable: true` and `allowClientRead: true` (`lock_record { kind: 'log_record', id }`
   → `update_log_record` → `unlock_record`).
2. `reveal_log_token { id }` (l2, a confirmed session). The token is a credential: keep it in an environment
   variable, never in a file or the chat.
3. Open the stream in the background, then run the test:

```bash
cd <MCP>/agent-runner && KEEN_LOG_URL="wss://<host>/monitor/stream/<spaceId>/<slug>?token=<readToken>" \
node -e "const W=require('ws');const w=new W(process.env.KEEN_LOG_URL);w.on('message',m=>console.log(m.toString()));w.on('unexpected-response',(q,r)=>{console.error('refused',r.statusCode);process.exit(1)})" > /tmp/keen-log.ndjson &
```

The first frame is `{"type":"welcome",…}`; each line is
`{ spaceId, agentSlug, level, logMessage, meta }`; `{"type":"closed"}` = the record was deleted. A plain 401 =
wrong token, or Client read off. There is no history: lines written before you connected are not sent. When done,
stop the watcher and set `allowClientRead` back to false unless the person wants it on.

## 7. The debugger (short)

The flow and script debuggers stop a deployed run at a breakpoint. They need a **person's** console login, never
an MCP account: the project's `.vscode/keen.json` holds `server`, `space`, `user`, `password`
(`../ProjectStructure/vscode/keen-json.md`), the account needs the Debugger permission and two-step sign-in, and
an owner or admin must switch the debugger on (**System › Debugger**).

- **VS Code:** the Shira extension's Start Flow Debugger / Start Script Debugger does everything.
- **By hand:** `npx --prefix <MCP>/agent-runner tsx <MCP>/agent-runner/debug.ts --kind=flow|script --project <root> [--json]`
  prints a one-time attach address (one connection within 5 minutes); for `script` also a `launch.json`
  configuration. The two-step code is asked on the terminal, or read once from `KEEN_MFA_CODE`. It always signs
  out again. Details: `agent-runner/docs/DEBUG.md`.

A breakpoint stops only runs of that space. One debugger window per kind at a time.

## 8. Common failures

| You see | Meaning | Fix |
|---|---|---|
| `socket closed before the relay's welcome: Unexpected server response: 502` (or 403) | the Origin is not on the allow-list: wrong `KEEN_ORIGIN`, the webhook's origin changed, the key is half-wired, or not woken after a change | match `KEEN_ORIGIN` to the webhook record exactly; bind all four; `wake_api_key`. A 502 can also mean the relay is down |
| `… connect ECONNREFUSED` / a TLS error | wrong host | check `KEEN_HOST` |
| `no welcome from the relay within 15s` | the socket opened, the relay did not answer | retry; report if it persists |
| `run FAILED: E3002 Invalid token` (`run FAILED: Invalid token` when refused while resuming after a drop) | the token expired (10 min), was revoked (consumer disabled / rotated / re-homed or its spaces narrowed; the key rotated, disabled or re-bound — a binding changed, its webhook's origin changed, its client / certificate / contract deleted) | mint a new token (§5) |
| `userContext.userId does not match token subject` (E3002) | `KEEN_USER_ID` is not this consumer's id | set the MCP consumer id |
| E3101 `agent "<slug>" not found in space <id>` | wrong slug or space, the agent is inactive, or the cache is stale | check `KEEN_AGENT` (the slug) / `KEEN_SPACE_ID`; `update_agent { active: true }`; `wake_api_key` |
| E3101 `requested space is not in the consumer contract` / `consumer has no rights to this space` | the space is not on the contract or the consumer's grant | `assign_contract_spaces`, `assign_mcp_consumer_spaces`, then a new token |
| `The service is temporarily unavailable` (close 4401) | the api key was disabled, rotated or deleted | enable / rebuild the chain, then a new `KEEN_TOKEN` (old tokens never revive) |
| `connection taken over by another session` (close 4409) | another client took the same chat | rerun; do not share a chat id between two runners |
| E2101 `The message is too long …` | prompt over 20 000 characters | shorten it |
| E4001 `busy` / `too many prompts running for this account` | the consumer's limit (8 running runs by default), its per-minute limit, or no engine free. On the first prompt the SDK re-sends it up to 10 times (1 s apart, or the refusal's `retryAfterMs` up to 60 s), then `run FAILED: E4001 …`; on a later node it re-sends without a limit | wait for runs to end, rerun |
| **E2201** "Agent project error" (final, the run stops) | the author's project: the agent's `startFlow` / `startNode` not in the deployed project, a Run / Jump target missing, a node over its time or memory limit, a Condition that does not parse, a refused loop setting or session value, the dictionary or session over its cap, a project the engine refused to load | read the message and the Log record line (§6); fix the project or `update_agent` |
| `run FAILED: E6xxx …` / `E5xxx …` | a system / flow problem or a resource failed. Every code except the E4 / E7 families is final: the SDK stops the run at once and sends the cancel itself | read the message and the Log record; if it repeats, it is a platform fault to report |
| the run hangs on one node, no new lines | a node answered E4xxx (busy) or E7xxx (a timeout / transport error): the SDK re-sends those without a limit once the flow has started, with a backoff up to 10 s | wait; Ctrl+C to stop; read the Log record |
| E6101 | an LLM node's `settings.llm` lacks `company` or `model` | fix the node (`keen-validate` catches it) |
| The answer is an error text, or the LLM never saw the person's message | the answering LLM node's Agent ID is not the agent's slug, or its Fallback is unwired and the provider failed | set the node's `agentId` to the slug; wire the Fallback |
| `endReached: false` | an unwired output ended the flow | wire it to the next node or an End node |
| `wake_api_key` 406 `API key not found or not fully configured — bind its client, certificate, contract and webhook, then rebuild.` | a half-wired key | bind all four (`golden-path.md` §8) |
| `get_mcp_consumer_token` 406 (no reason) | unknown id, wrong secret, disabled, no contract, or the contract's key not fully bound | check each; rotate the secret if lost |
