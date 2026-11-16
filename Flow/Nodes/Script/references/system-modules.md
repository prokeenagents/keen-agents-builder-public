# The `system/*` modules — index

A Script node's file may import exactly these ten modules, plus its own relative files (`./x.js`, `../lib/y.js`).
Each module has its own file under `system/` with every function, error, status and limit. **Read a module's
file before you use a function from it for the first time in a project** — the errors and the limits there are
the ones that decide whether the node takes its error output, and they are easy to guess wrong.

| Module | For | Writes? | File |
|---|---|---|---|
| `system/log` | lines in the agent's Log Record | yes (log only) | [`system/log.md`](system/log.md) |
| `system/chat` | interim messages to the person in the chat | yes (stream only) | [`system/chat.md`](system/chat.md) |
| `system/session` | the run's flat key / value store | yes | [`system/session.md`](system/session.md) |
| `system/dictionary` | read (or drop) **another** flow's dictionary; also the rules of the bare `dictionary` global | delete only | [`system/dictionary.md`](system/dictionary.md) |
| `system/agent` | the conversation: prompts and responses per agent / channel | yes | [`system/agent.md`](system/agent.md) |
| ↳ channels | (part of `system/agent`) collect information for a task from several places, then consume / delete it | yes | [`system/channels.md`](system/channels.md) |
| `system/settings` | the agent's Json Settings | no | [`system/settings.md`](system/settings.md) |
| `system/secrets` | the agent's Secrets | no | [`system/secrets.md`](system/secrets.md) |
| `system/cookies` | the cookies the consumer sent with this run | no | [`system/cookies.md`](system/cookies.md) |
| `system/http` | outbound HTTP | — | [`system/http.md`](system/http.md) |
| `system/tools` | a UUID, a timestamp | — | [`system/tools.md`](system/tools.md) |

## What every module shares

- **Two import styles work:** `import Http from 'system/http'` (the whole frozen object) or
  `import { getJson } from 'system/http'` (one function). Nothing else is importable: an npm package, an
  absolute path, `node:*`, `system/logs`, `system/flow`, `system/files` or `system/connectors/...` fails the node
  with `ivm: import "<name>" not supported — …` (error output), and keen-validate reports it before deploy.
- **The current flow's dictionary is not a module.** It is the bare global `dictionary` — see
  [`system/dictionary.md`](system/dictionary.md) for its cap and value rules.
- **When writes are kept.** A node that returns normally commits its dictionary, session and conversation
  writes together, all or none. A node that throws (the error output) keeps **only the session** (if it passes
  its own checks); its dictionary and conversation writes are lost. The 15-minute limit, a cancel or an engine
  eviction keep nothing. Details and the one partial case in [`system/session.md`](system/session.md).
- **Secrets are masked everywhere.** A secret's value that reaches a log line, a chat message, an error text,
  the dictionary, the session or the conversation shows as `••••` (values under 8 bytes are not masked — see
  [`system/secrets.md`](system/secrets.md)).
- **One fixed 10 MB buffer** carries everything that comes **into** the script (an HTTP body, a
  `system/agent` or `system/dictionary` read); a single answer above it fails that call with `E_SAB_OVERFLOW`.
  The script's own memory is a separate 30 MB. The node's other limits are in `../script-skill.md` → *Limits*.
