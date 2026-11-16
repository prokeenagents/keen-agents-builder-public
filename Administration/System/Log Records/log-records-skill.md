# Log Records

## Description

A **Log Record** turns on an agent's runtime log. Without one, nothing an agent's runs write is kept anywhere. It is
scoped either to a **Whole space** (every agent in that space, badge **Space-wide**) or to a **Single agent**
(badge **Single agent**). It is the builder's main window into a deployed flow: production has no debugger.

What lands in it (one line per event, each starting with its tag `[INFO]`, `[WARNING]`, `[ERROR]` or `[DEBUG]`):

- the scripts' own `Log.info / warning / error / debug` lines, as `[INFO] <caller> | <text>` — see
  [`system/log`](../../../Flow/Nodes/Script/references/system/log.md);
- one platform line per failure: `Script "<file>" failed: <message>`, `Flow node failed: node=… type=… error=… req=…`
  (also `reason=entry-not-found` for a missing Run Flow / Jump Flow target, `reason=dictionary-over-cap`),
  `Flow run failed: reason=entry-not-found …` (the agent's Start Flow / Start Node is not deployed),
  `LLM answer cut at maxTokens: …` (warning), `Chat summary failed: …` (warning),
  `virtualScriptNode rejected — tool path must live under "scripts/tools/" …`;
- `Project load failed: project=… reason=security-scan issues=…` with up to 10 findings (file:line, rule) when the
  deployed project is refused — the chat then gets the final "Agent project error" (E2201); a warning instead of an
  error when the engine keeps running the version it loaded before.

`req=` is the request id, so the builder can match a line to one chat message. A node that is not reached, a summary
that is not due and a run the user cancelled write nothing. The lines never carry a prompt, a user's message, an
answer, the dictionary or the session. A secret an agent's script read is replaced by `••••` in that node's lines.

Which record catches a line: the agent's own record if it has one (even when that record is **Paused** — it still
wins), else the space's **Space-wide** record, else nothing. Paused = the line is dropped.

Kept 30 days, one file per level per day. The console has NO view of the stored lines, and no MCP tool reads
them. The way to read a record is its **live stream** (below).

When the person needs it:

- right after the first deploy of an agent — create a **Single agent** record before testing;
- a chat answers "Something went wrong" / an E2201 — the record says which node, file and line;
- a partner developer wants to watch their agent's runs live — hand them the stream token.

Not the audit log ([../Logs/logs-skill.md](../Logs/logs-skill.md)): that one records who changed what.

## Who may

| Right | Opens |
|---|---|
| `l1` (Logs · Read) | The list, the record page (read-only). |
| `l2` (Logs · Write) | Create, Save (incl. **Emitting** / **Client-readable**), Delete, lock, and reveal the stream token. |

- Owner and admin always have both. A reader with `l1` only sees the form disabled, no footer, no Danger zone, and on
  the token card: **Available to roles that may write logs.**
- No `l1` → **You don't have access to this page**; the sidebar row is hidden.
- The Space / Agent pickers need `sp1` / `ag1` to list choices, else
  **Choices unavailable — requires spaces read permission.** (or agents).

## MFA

Create, Save, Delete, lock and **reveal the stream token** need two-step sign-in: refused with `MFA required!`
(console: **Turn on two-factor sign-in first**). Why: the stream token lets anyone watch an agent's runs live, and
with only a stolen password someone could reveal it, or pause / delete the record to hide what an agent does. An MCP
session needs its owner's code for the same actions. See
[../../references/sign-in-and-mfa.md](../../references/sign-in-and-mfa.md).

## Through MCP

**Reachable through MCP: yes** (all but reading the stored lines).

| Tool | What it does | Needs |
|---|---|---|
| `list_log_records { spaceId? }` | The records (no token), newest first. | `l1` |
| `create_log_record { title, selector, spaceId, agentSlug?, description?, allowClientRead? }` | `selector` `SPACE` or `AGENT`; `agentSlug` = the agent's ID, only for `AGENT`. | `l2` + MFA |
| `lock_record { kind: "log_record", id }` / `unlock_record` | Reserve before a change or a delete. | `l2` + MFA |
| `update_log_record { id, title?, description?, spaceId?, agentSlug?, enable?, allowClientRead? }` | Partial change; `enable: false` pauses. | `l2` + MFA, your lock |
| `delete_log_record { id }` | Permanent. Confirm with the person first. | `l2` + MFA, your lock |
| `reveal_log_token { id }` | The record's stream token. | `l2` + MFA |

The token is a credential: use it only to open the stream, never write it into a project file, a commit or the
chat. Every reveal writes an action line (`Log record stream token read: <id> / <title> by <who>`).

**Not through MCP — tell the person:** nothing is missing except a view of the stored lines, which does not exist
anywhere yet.

### How the builder reads an agent's log

1. `list_log_records { spaceId }` — is there a record for the agent (or the space)? If not, create one.
2. The record must be **Emitting** (`enable: true`) and **Client-readable** (`allowClientRead: true`): the stream
   refuses every new connection while Client read is off.
3. `reveal_log_token { id }`.
4. Open `wss://<host>/monitor/stream/<spaceId>/<agentId>?token=<token>` (the console's host) with any WebSocket client,
   the token passed from an environment variable. One stream = one agent; for a **Space-wide** record open one per
   agent with the same token. A wrong or missing token, or Client read off → plain 401, no socket.
5. The first frame is `{ "type": "welcome", … }`; each line is `{ spaceId, agentSlug, level, logMessage, meta }`.
   `{ "type": "closed" }` = the record was deleted: stop reconnecting.
6. The stream has no history: open it BEFORE sending the test message (e.g. with the agent runner).
7. When done, set **Client-readable** back off unless a partner holds the token.

## Create

Console: **System → Log Records → New log record** (or the **Create Log Record** card). One card, **Log Scope**:

| Field | Required | Limits | Note |
|---|---|---|---|
| **Title** | yes | ≤ 150 | `Title is required` · `Title must be at most 150 characters` |
| **Description** | no | ≤ 500 | `Description must be at most 500 characters` |
| **Scope** | yes | **Whole space** / **Single agent** | Fixed forever — a change of scope is a new record. |
| **Space** | yes | one of the spaces | `Space is required`; changing it clears **Agent**. |
| **Agent** | Single agent only | ≤ 100, an agent of that space | `An agent-grained log requires an agent` · `A space-wide log must not name an agent` |
| **Client-readable** | no | switch, default off | Needed for any stream to open. |

Press **Create** → toast `Log "<title>" created`, the new record opens. It starts **Emitting**. No token is shown
(reveal it on demand). Server refusals: `A log already exists for this space/agent` (one record per exact space or
agent), the general `Not Acceptable` for a space or agent that does not exist. Through MCP the coupling words are
`An agent-grained log requires an agentSlug` / `A space-wide log must not carry an agentSlug`.

## Change

Lock first: **Lock** on the record's banner, or `lock_record { kind: "log_record", id }`; see
[../../references/record-locks.md](../../references/record-locks.md). Then on **Log Record**:

- **Emitting** on / off — off = **Paused**: nothing is stored from now on, not back-filled on resume;
- **Title**, **Description**, **Space**, **Agent** (the scope itself cannot change);
- **Client-readable** — off refuses every new stream; one already open keeps flowing until it reconnects.

**Save** (only after a change) → `Log "<title>" updated`. The **Stream token** card: **Reveal** + **Copy**
(`l2`). The token cannot be rotated: to revoke a leaked one, delete the record and create it again.

**How the change reaches what runs:** immediately — the next line an agent writes follows the new setting. No
deploy, no restart, no chat ends. See [../../references/delivering-changes.md](../../references/delivering-changes.md).

## Delete

Record page → **Danger zone** → **Delete** → **Delete the log record "<title>"?** → **Delete**. Needs your lock.
Toast `Log "<title>" deleted`. At once: the agent's lines stop being kept, the stored lines are deleted, every open
stream gets `closed`; a partner holding the token loses it. Cannot be undone. Deleting a space or an agent also
removes its records.

## Import / Export

Not available for Log Records — they are never exported or imported, and their tokens never leave by file. See
[../../references/import-export.md](../../references/import-export.md).

## Mistakes that break it

| Mistake | What happens | Do instead |
|---|---|---|
| Testing a new agent with no record | Its failures are written nowhere | Create a **Single agent** record first |
| An agent record that is **Paused** next to an emitting space record | The agent's lines are dropped (its own record wins) | Resume it, or delete it |
| Opening the stream with Client read off | 401, no socket | Turn **Client-readable** on |
| Opening the stream after sending the message | The lines are gone from the stream | Open it first, then send |
| A second record for the same agent | `A log already exists for this space/agent` | Change the existing one |
| Writing the token into `.env` of the project or a chat | Anyone with it watches the runs | Keep it in a shell variable; delete + recreate if leaked |
| `update_log_record` without `lock_record` | `Reserve the record first!` | Lock, change, unlock |

## Example

The person: "The Support agent says 'Something went wrong' — find out why." (space `cmspace0001`, agent `support-agent`)

1. `list_log_records { spaceId: "cmspace0001" }` → none for `support-agent`.
2. `create_log_record { title: "Support agent debug", selector: "AGENT", spaceId: "cmspace0001", agentSlug: "support-agent", allowClientRead: true }`.
3. `reveal_log_token { id }` → open `wss://<host>/monitor/stream/cmspace0001/support-agent?token=$KEEN_LOG_TOKEN`.
4. Send the failing message (agent runner). The stream shows
   `[ERROR] … Script "tools/orderTool.js" failed: Cannot read properties of undefined` → fix the script, deploy, repeat.
5. When fixed: `lock_record { kind: "log_record", id }`, `update_log_record { id, allowClientRead: false }`,
   `unlock_record`. Keep the record Emitting while the agent is young.
6. If the MCP session is read-only (`MFA required!`), tell the person: "Open **System → Log Records → New log
   record**, Title *Support agent debug*, Scope **Single agent**, Space *Main*, Agent *support-agent*, switch
   **Client-readable** on, press **Create**." A read-only session cannot reveal the token either (`MFA required!`):
   ask the person to sign the builder in again with the owner's code, then `reveal_log_token`. The person never
   pastes the token into the chat.
