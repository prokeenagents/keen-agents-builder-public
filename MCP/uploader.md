# keen-deploy — upload the project to its space

A flow runs from the platform's **deployed** copy, never from the files on disk. `keen-deploy` uploads the
project to its space: connect → zip → upload → disconnect, in one synchronous call that answers `deployed` or
`rejected` with the reasons. Run `keen-validate` first (`validator.md`); deploy only on `0 error(s)`.

**Never run it as a test.** Every run replaces the live project of the space. Confirm the space with the person
when you are not sure it is a test space.

## 1. Install (once)

Same as `keen-validate`: copy the binary for this machine from `MCP/bin/` onto the PATH under the plain name.

| OS | Binary |
|---|---|
| Linux x86-64 / ARM64 | `keen-deploy-linux-amd64` / `keen-deploy-linux-arm64` |
| macOS Intel / Apple silicon | `keen-deploy-darwin-amd64` / `keen-deploy-darwin-arm64` |
| Windows x64 / ARM64 | `keen-deploy-windows-amd64.exe` / `keen-deploy-windows-arm64.exe` (install as `keen-deploy.exe`) |

```bash
mkdir -p ~/.local/bin
cp <MCP>/bin/keen-deploy-linux-amd64 ~/.local/bin/keen-deploy && chmod +x ~/.local/bin/keen-deploy
keen-deploy --help
```

No Node, no Go, no `zip` needed. (`agent-runner/deploy.ts` is a TypeScript copy of the same
protocol; use the binary.)

## 2. Configuration

Each value: the flag first, then a real environment variable, then `.env` in the **current folder** (a real
environment variable wins over `.env`). Flags take `--key value` or `--key=value`.

| Flag | `.env` key | Meaning |
|---|---|---|
| `--host` | `KEEN_HOST` | the bare host, e.g. `keen.example.com` (a stray `https://` is removed) — the host of `server` in `keen-project.json` (`../ProjectSetup/keen-project.md`). The deploy address derives: `https://<host>/ms/deploy` |
| `--space` | `KEEN_SPACE_ID` | the space id (the deploy target) |
| `--deploy-token` | `KEEN_DEPLOY_TOKEN` | the space's deployment token |
| `--project` | `KEEN_PROJECT_DIR` | the project ROOT (the folder that holds `src/`); default `.`; `~` is expanded |
| `--json` | — | NDJSON output for you to parse |
| `-h`, `--help` | — | usage |

Write `.env` values **unquoted**: the binary keeps quotes as part of the value. Run it from the project root
with the project's git-ignored `.env` (`golden-path.md` §13). Missing host, space or token → exit `2`, nothing sent.

**The deployment token** belongs to the space. Read it with `get_space_deployment_token { id }` (scope `sp2`,
a confirmed session); the `create_space` reply carries it too. `reset_space_deployment_token { id }` re-mints it
(destructive: confirm first; refused while another user holds the space): the old token is refused for every new
connection at once (a deploy session already open with it may finish its short window), so update `.env` and
`.vscode/keen.json` right after. Never print it.

## 3. What it uploads — and never uploads

- If `<root>/src/` exists, it zips the **contents of `src/`**; otherwise the root itself.
- That folder must hold `flows/`, or the tool stops with exit `2` **before sending anything** (so pointing it at
  the wrong folder can never upload a `.env`).
- Only three top-level entries go up: **`flows/`**, **`scripts/`**, **`keen-tools.json`**. Every other top-level
  entry is left out and named in the `zip` line's `skipped`.
- Never uploaded, at any depth: dot-entries (`.env`, `.vscode/`, `.git`, …), `node_modules`, `*.zip` files,
  anything that is not a regular file.
- `package.json`, `.gitignore`, `.vscode/keen.json` and Prettier files stay local.

The platform then builds the raw project in place: each `<Name>.flow` becomes the engine's compiled flow files,
`keen-tools.json` becomes the tool map, and the engine's debug probe is added to `scripts/`. You never write or
ship those generated files.

## 4. The four steps

1. **connect** — `POST https://<host>/ms/deploy/v1/project/connect` with headers `X-Deployment-Token` (the real
   token) and `X-AI-Space-Id`. Answer: a short-lived session token (`expiresIn` 300 s). The platform holds ONE
   deploy connection at a time: a connect for another space replaces it; a connect for the same space keeps it.
2. **zip** — in memory.
3. **upload** — `POST …/v1/project/upload`, multipart field `bundle`, with the session token in
   `X-Deployment-Token`. The platform unpacks, builds, checks the structure, security-scans every `.js` and, only
   if everything passes, **replaces** the live project at once. The answer comes in the same call.
4. **disconnect** — best effort.

The client waits up to 120 s. The upload limit is **50 MB**.

## 5. Output and every answer

`--json` lines (without `--json` the same facts print as `[meta] step=connect …`):

```jsonc
{"t":"meta","step":"connect","base":"https://<host>/ms/deploy","space":"<space>"}
{"t":"meta","step":"connected","session":"b9946d53…"}
{"t":"meta","step":"zip","root":"<abs root>","zipping":"<abs root>/src","skipped":["README.md"]}
{"t":"meta","step":"upload","bytes":130}
{"t":"deployed","project":"<space>","generation":3}
```

| Answer | Meaning | What you do |
|---|---|---|
| `{"t":"deployed","project","generation"}` (exit 0) | live now | run the test (`testing.md`) |
| `{"t":"rejected","error":"Deployment rejected","message":"Project rejected by the security scan — N issue(s) must be fixed","issues":[{severity,message,line,column,file}]}` (HTTP 422, exit 1) | a script broke a sandbox rule | fix each `file:line`; `keen-validate` names the same rules |
| `{"t":"rejected","error":"Invalid project structure","message":"Project rejected — invalid structure (N problem(s))","reasons":[…]}` (422, exit 1) | the build or the layout failed | fix each reason (list below) |
| `{"t":"fail","step":"connect","status":401}` | a header is missing | set host / space / token |
| `… "step":"connect","status":403` | the token does not belong to this space (or a bad space id) | `get_space_deployment_token` for the right space |
| `… "step":"connect","status":503` | the deploy service is still starting | wait, retry |
| `… "step":"upload","status":403` `No active connection — connect before deploying` | the session expired or another space connected meanwhile | run again |
| `… "step":"upload","status":409` `A newer upload superseded this deployment` | a newer upload for the same space won | run again only if yours is the newest |
| `… "step":"upload","status":413` | the bundle is over 50 MB | remove large files from `scripts/` |
| `… "step":"upload","status":400` `Failed to unpack the uploaded bundle (corrupt or invalid zip)` | a real unzip failure | run again; report if it repeats |
| `… "status":0` | network / TLS failure (wrong host) | check `KEEN_HOST` |

Exit codes: `0` deployed · `1` rejected or failed · `2` bad arguments or no `flows/` (nothing sent).

**Structure / build reasons** (verbatim; `<F>` = the flow file):

- `flows/ directory is missing` · `flows/ contains no .flow files`
- `` `flows` must be a single level (no subfolders) `` · `` `flows` must contain only .js files `` (a stray non-`.flow` file)
- `flows/<F>: invalid JSON — <parser message>`
- `flows/<F>: the top level must be an object with "nodes" and "edges" lists` · `flows/<F>: "nodes" must be a list` ·
  `flows/<F>: "edges" must be a list` · `flows/<F>: node #<n> is not an object` · `flows/<F>: node #<n> has no id` ·
  `flows/<F>: edge #<n> is not an object`
- `flows/<F>: <id> — the node id is used again in flows/<other F>` · `flows/<F>: <id> — the node id is used twice in this file`
- `flows/<F>: <nodeId> — Summary output must connect to exactly one Summarizer node.` · `… — A Summarizer node needs a model.` ·
  `… — A Summarizer node's In takes only a Summary output or a Summarizer's Fallback.` ·
  `… — A Summarizer node's Fallback connects only to a Summarizer node.` · `… — Summarizer Fallbacks must not form a loop.`
- `flows/<F>: could not be compiled — <message>`
- `keen-tools.json: invalid JSON — <message>` · `keen-tools.json: "tools" must be a list of tool objects`

The checks run in this order: every flow's JSON and shape, the node ids across all flows, the Summary / Summarizer
wiring — all of these refusals of every flow are reported together; only when they all pass is `keen-tools.json`
read, and then each flow compiled. A refused build changes nothing. Two Summary cases are only warnings (an LLM node
that keeps no history, so its Summary never runs; a Summarizer no Summary reaches): the platform logs them, the
answer does not carry them — `keen-validate` reports them.

**Security-scan issues** (critical; each with `file`, `line`, `column`):
`Unauthorized import "<x>" - only relative (./, ../) imports and the engine's system/ modules (…) allowed`
(`node:*`, npm packages and any `system/<word>` outside the ten modules) · `eval() is forbidden …` ·
`Function() constructor is forbidden …` · `require() is forbidden - use import statements only` ·
`Dynamic import() is forbidden …` · `Reference to <name> is forbidden` (`process`, `global`, `globalThis`, …) ·
`Access to <obj> is forbidden` · `__proto__ access is forbidden …` · prototype-pollution access or assignment ·
`with statement is forbidden` · `Code parsing failed: <message>`.
A `debugger` statement is a low issue (not a refusal). The deploy does **not** check that a script exports `exec` —
only `keen-validate` does, so run it first.

## 6. What happens to running chats

- Nothing is touched until the new project passes every check: a refused deploy leaves the live version as it was.
- After `deployed`, the engines load the new version and swap it in at once; every node task started after that
  reads the new version. A run that is mid-way when you deploy finishes its current node on the old version, and
  its later nodes run on the new one — a run can straddle two versions. Deploy **between** test runs.
- Conversations, dictionaries, sessions, agent settings and secrets are not part of the project: a deploy keeps them.
- No cache wake is needed for a code change. `wake_api_key` is for records bound to an api key (`golden-path.md` §10).
