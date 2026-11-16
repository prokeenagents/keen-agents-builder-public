# keen-validate — check the project before you deploy

`keen-validate` is a static check of a whole agent project on disk: every `src/flows/*.flow`, every
`src/scripts/**/*.js` and `src/keen-tools.json`. It mirrors the deploy service's gates, the engines' contracts
and the flow canvas's form rules, so a mistake shows up in seconds instead of as a refused deploy, a stalled
run or a silent wrong answer. It never sends anything anywhere.

**Rule: run it before every `keen-deploy`. `0 error(s)` = clear to deploy.** Warnings do not block, but read
each one: most name a real run-time consequence.

## 1. Install (once)

The binaries ship in `MCP/bin/` for six platforms. Copy the one for this machine onto the PATH under the plain
name `keen-validate`:

| OS | Binary | Install |
|---|---|---|
| Linux x86-64 | `keen-validate-linux-amd64` | `mkdir -p ~/.local/bin && cp <MCP>/bin/keen-validate-linux-amd64 ~/.local/bin/keen-validate && chmod +x ~/.local/bin/keen-validate` |
| Linux ARM64 | `keen-validate-linux-arm64` | same, with `-arm64` |
| macOS Intel | `keen-validate-darwin-amd64` | same into `~/.local/bin` (or `/usr/local/bin`); if macOS blocks it: `xattr -d com.apple.quarantine <path>` |
| macOS Apple silicon | `keen-validate-darwin-arm64` | same |
| Windows x64 / ARM64 | `keen-validate-windows-amd64.exe` / `-arm64.exe` | copy as `keen-validate.exe` into a folder on `%PATH%` (e.g. `%USERPROFILE%\bin`) |

Find the machine with `uname -sm` (Linux / macOS) or `$env:PROCESSOR_ARCHITECTURE` (PowerShell). Check with
`keen-validate --help`. `~/.local/bin` must be on PATH (`echo $PATH`). Replace an older copy: an old build may
refuse things the platform now allows (or miss newer rules), so always install from this folder.

## 2. Run

```bash
keen-validate                    # the project = KEEN_PROJECT_DIR from ./.env, else the current folder
keen-validate ./my-project       # an explicit project ROOT (the folder that holds src/)
keen-validate --project=./my-project
keen-validate --json             # NDJSON for you to parse
keen-validate --help
```

Resolution of the project folder: the `DIR` argument → `--project=DIR` → `KEEN_PROJECT_DIR` from a `.env` in
the **working folder** → `.`. That is the only value it reads from `.env`. The project root is the folder with
`src/flows`, `src/scripts`, `src/keen-tools.json` — the same `KEEN_PROJECT_DIR` `keen-deploy` uses.

## 3. Output

**Human** (default): two lines per finding, sorted errors → warnings → info, then a summary. Real output on a
broken fixture:

```
✗ ERROR  Second.flow › startNode_t88HrlfaYLiD
           the node id is used again in Assistant.flow
✗ ERROR  project › src/flows
           stray file "README.txt" — only .flow files may live in src/flows; it survives the build and the deploy is rejected ("flows must contain only .js files")
✗ ERROR  scripts/bad.js (helper)
           import 'node:crypto' — only 'system/*' and relative './' '../' files are allowed (no npm packages, no absolute paths)
✗ ERROR  scripts/bad.js (helper)
           references `eval` — forbidden in the sandbox; the platform's deploy refuses it as critical ("Reference to eval is forbidden")
⚠ WARN   Assistant.flow › agentNode_d1QRdKj9fOK3
           agentNode "error" (Fallback) edge is not wired — on a provider failure the flow continues on next_1 with the error text AS the answer (wire it to handle failures explicitly)

──────────────────────────────────────────
entries (File-Labels) found: Assistant-Start, Second-Second
flows: 2 · scripts: 2 · tools: 0
7 error(s), 2 warning(s), 0 info
```

- Line 1: `✗ ERROR` / `⚠ WARN ` / `ℹ INFO `, then `<file> › <where>` (a node id, `src/flows`, or empty).
- Line 2: the rule and its consequence.
- `entries (File-Labels) found` — every `<Flow>-<StartLabel>` a Run / Jump / Parallel node or flow tool can target.
- The last line is always `N error(s), N warning(s), N info`.

**JSON** (`--json`): one object per finding, then a summary (key order is not significant):

```jsonc
{"t":"error","file":"Second.flow","where":"startNode_t88HrlfaYLiD","msg":"the node id is used again in Assistant.flow"}
{"t":"warn","file":"Assistant.flow","where":"agentNode_d1QRdKj9fOK3","msg":"agentNode \"error\" (Fallback) edge is not wired — …"}
{"t":"summary","errors":7,"warnings":2,"info":0,"flows":2,"scripts":2,"tools":0,"entries":["Assistant-Start","Second-Second"],"ok":false}
```

Gate on the summary's `"ok"` (false when `errors > 0`) or on the exit code.

| Exit | Meaning |
|---|---|
| `0` | no errors (warnings allowed) — clear to deploy |
| `1` | at least one error — fix before `keen-deploy` |
| `2` | usage / IO: e.g. `no such directory: <path>` |

## 4. What it checks

Two kinds of rule: **deploy / engine rules** (a violation fails the deploy or the run) and **canvas rules**
(the Shira canvas forms; stricter than the engines, enforced so the project stays editable on the canvas —
marked [canvas]).

**Project layout (the deploy's gate)**
- `src/flows` exists with at least one `.flow`; no subfolders; no non-`.flow` file (error each).
- `src/scripts` missing → warning (the deploy creates it); `src/keen-tools.json` missing → warning.
- A `src/scripts/debux.js` is warned and skipped (the deploy injects its own).
- A VS Code-extension project (`*.flow.json`) is detected and warned; its flows are not checked.

**`.vscode/keen.json`** (warnings; a value is never printed) — must be git-ignored (it holds the deployment
token and the console password); `user` must look like an e-mail, `password` non-empty; valid JSON object.

**Flow structure and node shape**
- A `.flow` is `{ nodes, edges }` (other top-level keys are flagged; missing `edges` is only a warning here — the
  deploy refuses it, see §6).
- Node `id` = `<type>_<12 letters/digits>`; `type` valid and matching the id prefix.
- **A node id used twice** — in one file or across files — is an error (the engines merge all flows' nodes into
  one map, so one would silently replace the other). Copy a node between flows only with a fresh id.
- [canvas] fixed `labelNode` / `descriptionNode`, `dragHandle`, `position`.

**Handles and wiring**
- Every edge's `sourceHandle` / `targetHandle` is valid for its node type; single-in vs multi-in rules; `wait`
  only from a Flow Pointer; edge `type` `"step"`.
- Required outputs wired (Condition `true` + `false`, Loop `out` + `next_1`, LLM / Script `next_1`) — warning.
- Unwired **Error** (Script) / **Fallback** (LLM) — warning with the real consequence: a script throw with no
  `error` edge stalls the turn; an LLM provider failure with no Fallback continues on `next_1` with the error text
  as the answer.
- Summary output / Summarizer: an LLM node's Summary edges reach exactly one Summarizer; a Summarizer needs a model;
  its In / Fallback rules; no Fallback loops (errors); reasoning summarizer, history-less source, unconnected
  Summarizer (warnings).
- Every runnable node reachable from a Start node (warning).

**Field rules**
- Start label from `settings.label`, `^[A-Z][a-zA-Z]*$`, ≤ 60 [canvas].
- Condition: after `${dictionary.*}` / `${session.*}` are stripped, a bare `dictionary.` / `session.` is an error
  (the engine throws "Member access is not allowed").
- Loop `value` / `setto` need the `dictionary.` / `session.` prefix and must differ [canvas].
- Assignment / Script key-value caps: ≤ 10 pairs, key ≤ 100, value ≤ 200, no duplicate keys [canvas]; Script path ends `.js`.
- Run / Jump / Flow Pointer targets are a `File-Label` `^[A-Z][a-zA-Z]*-[A-Z][a-zA-Z]*$` (no digits) or a whole
  `${dictionary.<path>}` / `${session.<key>}` placeholder (letters and `-` around it, ≤ 120; a half wrapper refused) [canvas]; Parallel Context `contextCollection` starts with `dictionary.`, `pipe` is a `File-Label`.
- LLM node: `agentId` 3–100 characters, kebab-case letters only, or a whole `${dictionary.…}` / `${session.…}` placeholder
  (lowercase letters and `-` around it, ≤ 100) [canvas]; `agentName` present; `settings.llm` with
  `company` ∈ anthropic / openai / google and a `model` (else E6101 at run time); Note ≤ 160.
- A placeholder root other than `dictionary` / `session` is warned: it stays literal text.

**Cross-file and tools**
- Flow file names PascalCase; a name with digits is a warning (no `File-Label` can target it).
- Every Run / Jump / Parallel target resolves to a real `File-Label`; every Script node's file exists.
- `keen-tools.json` is `{ "tools": [ { name, type, entry } ] }`, unique names; a `script` tool's entry under
  `scripts/tools/` (no `..`) and the file exists; a `flow` tool's entry is a `File-Label` that resolves.

**Scripts (a lexical pass, not a full parser)**
- Bracket / quote balance.
- An entry script (a Script node's file or a tool) exports a NAMED `exec`, not `export default`.
- Imports: only the ten `system/*` modules (`chat`, `log`, `session`, `tools`, `agent`, `cookies`, `http`,
  `dictionary`, `settings`, `secrets`) and relative files that exist under `src/scripts` (exact path, no
  extension guessing); no npm packages, absolute paths or `node:*`. `system/logs` → use `system/log`.
- The deploy scanner's sandbox rules, all errors: `fetch()`, `eval`, `Function`, `require`, `process`, `global`,
  `globalThis`, `module`, `exports`, `__dirname`, `__filename`, dynamic `import()`, `with`, prototype access.
  `crypto.` is a warning (there is no crypto in the sandbox).
- The agent-reply contract: every `setRootAgentPrompt` / `setAgentPrompt` reply carries `sessionID` (a lowercase
  `sessionId:` key is silently dropped — the "No tool response" bug); `setAgentPrompt` also `role: 'user'` +
  `agentChat: true`; never reuse the caller's `requestId`.
- `Promise.all` over `system/http` / `agent` / `dictionary` reads is warned (they share one buffer).

The node-by-node rules are in `../Flow/Nodes/SKILL.md`; the tool rules in `../Flow/Tools/SKILL.md`; the file
layout in `../ProjectStructure/SKILL.md`.

## 5. What it does NOT check

- Run-time behaviour: whether the model answers well, whether a provider call succeeds, whether a tool loop returns.
- A real JavaScript parse (only bracket balance) or the model name against the provider's list.
- Deep data flow in scripts (one variable hop at most).
- That the LLM node answering the person uses the agent's slug from the console as its Agent ID — check that yourself.
- Not yet checked although the engines depend on them: one edge per output handle and no self-edge; a Loop
  Set-to inside its own Read-from list; the ≤ 120 length of a File-Label.

That is the runner's job (`testing.md`).

## 6. Where it and the deploy differ

The deploy repeats the critical checks with its own words (`uploader.md` §5). Two known gaps:

| Case | keen-validate | the deploy |
|---|---|---|
| A `.flow` without an `edges` list | warning, treated as `[]` | **refused**: `flows/<F>: "edges" must be a list` |
| A `keen-tools.json` field error (a bad `name` / `entry`) | error | not checked (only the top-level shape) — a wrong tool deploys and fails at run time |
| An entry script without a named `exec` export | error | not checked — it deploys; the script engine throws when the node runs (``Script "<name>" does not export an async `exec` function …``) |

So: fix every error, and also every warning that the deploy treats as an error (the first row).
