# Connect, Upload Project and auto-sync

> **Keen 15.3 · Shira Flow Builder 0.0.6.**

## What it is

The panel's deploy path. A flow runs from the space's **deployed** copy, never from the files on disk, so the person
must deploy after a change. Shira talks to the platform's deploy service on the `server` in `.vscode/keen.json`:

| Leg | Request | Headers |
|---|---|---|
| connect | `POST <server>/ms/deploy/v1/project/connect` | `X-AI-Space-Id: <space>`, `X-Deployment-Token: <the real deployment token>` → a session token, valid 300 s on the server |
| upload | `POST <server>/ms/deploy/v1/project/upload`, multipart field `bundle` = `bundle.zip` | `X-AI-Space-Id`, `X-Deployment-Token: <the session token>` |
| disconnect | `POST <server>/ms/deploy/v1/project/disconnect` | the same two |

The TLS certificate of the instance is verified.

## What the person does

1. **Connect** (enabled while the panel says `— detected`). Toast `Connected to the deployment service ✓`; the button
   becomes **Disconnect**; the status bar shows `Connected`.
2. **Upload Project** (enabled while connected). A progress toast `Uploading project…`, then
   `Project deployed ✓`, or a refusal (below).
3. From now on **every change under `src/` is deployed** (auto-sync, below) until **Disconnect** or a window reload.
4. **Disconnect** when done editing, or before a series of edits that should not go live one by one.

## The deployment token and the session

- The **deployment token** belongs to the space (console → AI → Spaces → the space → **Deployment Token**, revealed with
  `sp2` and two-step sign-in — `../Administration/AI/Spaces/spaces-skill.md`). It sits only in `.vscode/keen.json`
  `token`; the person types it there. It travels only on the connect leg.
- The **session token** the connect returns lives only in the extension's memory, for this window. It is never written
  to disk. A window reload, closing VS Code or an extension update drops it — the person presses **Connect** again.
- The connection is the person's intent: it stays until **Disconnect**. The server forgets an idle session after 5
  minutes; before each upload, when the session is expired or within 15 s of it, Shira connects again silently (same
  space → the same session continues). An upload answered `403` triggers one forced re-connect and one retry.
- The platform keeps **one** deploy connection at a time for the whole instance. A connect for another space (another
  window, `keen-deploy`, a colleague) replaces it; Shira's next upload then gets `403`, re-connects and takes it back.
  Two windows deploying two spaces to the same instance keep evicting each other.

## What is packed — and what never is

Shira zips **the whole `src/` folder, recursively, every file**: flows, scripts, `keen-tools.json` — and also anything
else that happens to be there: dot-files (a `.env`!), `node_modules/`, notes, zips, images. Nothing is filtered.
Outside `src/` nothing is sent: `.vscode/` (with `keen.json`), `.claude/`, `package.json`, `.gitignore` stay local.
The **Output → Flow Builder** channel lists every file of each upload:

```
[upload 2026-11-13T09:00:00.000Z] bundling src/ → 6 file(s)
  • flows/Assistant.flow
  • keen-tools.json
  • scripts/tools/docStoreSearchTool.js
  ...
```

The platform then builds and checks it exactly as for `keen-deploy`: each `.flow` is compiled, the debug probe is
added, the structure is checked, every `.js` is security-scanned, and only if all pass is the live project
**replaced** (a whole-tree replace: files deleted locally disappear from the deployment too). A refusal changes
nothing live. The build reasons and scan rules: `../MCP/uploader.md` §5.

## Auto-sync

While connected, any file **created, changed or deleted under `src/`** — by the canvas, the person's editor, an
Explorer paste, git, or **you writing files** — schedules a full upload 800 ms after the last change:

- the first change after Connect, when nothing was uploaded yet in this session, is a full upload with the
  `Project deployed ✓` toast;
- later ones are quiet: the status bar shows `Project synced` for 2 s; a failure still toasts.
- While **not connected**, saves stay local; nothing is sent.

Auto-sync does not look at the Problems panel: a project marked `— invalid` keeps syncing while connected (and
**Disconnect** is greyed out in that state — a window reload drops the connection).

## Every message the person can see

| Toast / place | Cause | What to do |
|---|---|---|
| `Set "server" in .vscode/keen.json first.` (also `"space"`, `"token"`) | empty or `[REPLACE…]` | fill the field (the person types the token) |
| `Could not read .vscode/keen.json.` | missing or not JSON | fix the file |
| `Invalid deployment token or space id` | the platform refused the pair (wrong token, a token of another space, a token that was reset) | the right **Space ID** and the current **Deployment Token** |
| `the deployment service did not answer (<code>)` | network / TLS failure; `ERR_INVALID_URL` = `server` without `https://` | fix `server` / the network |
| `Service is bootstrapping (503)` | the deploy service is starting | wait, Connect again |
| `Shira Flow Builder: Deploy connection refused: <message>` | the silent re-connect before an upload was refused (token reset, space changed); the connection is dropped, status `Not connected` | fix `token` / `space`, **Connect** |
| `Shira Flow Builder: Deploy connection not renewed: <message> — saves stay local until it answers.` | the deploy service did not answer the re-connect; the connection is kept, the next save retries (auto-sync warns once, a manual upload every time) | wait |
| `Upload rejected: Project rejected by the security scan — N issue(s) must be fixed — see Output ▸ Flow Builder` | HTTP 422: a script broke a sandbox rule. Output lists `• <severity> <file>:<line> — <message>` | fix each line; `keen-validate` names the same rules |
| `Upload rejected: Project rejected — invalid structure (N problem(s)) — see Output ▸ Flow Builder` | HTTP 422: the build or layout failed. Output lists `• <reason>` | fix each reason (`../MCP/uploader.md` §5) |
| `Upload failed (403): No active connection — connect before deploying — see Output ▸ Flow Builder` | the session was lost and the one retry failed too | **Connect** again |
| `Upload failed (409): A newer upload superseded this deployment — …` | a newer upload of the same space won (often two auto-syncs close together) | nothing, if the newer one was deployed |
| `Upload failed (400): Failed to unpack the uploaded bundle (corrupt or invalid zip) — …` | the zip could not be unpacked | upload again; report if it repeats |
| `Upload failed (413): … — …` | the bundle is over the platform's limit (50 MB on a sandbox as shipped) | remove large files from `src/` |
| `Upload failed: <error>` / `Sync failed: <error>` | the request itself failed (network) or `keen.json` became unreadable mid-session | check the network / the file |

Every refusal also opens **Output → Flow Builder** with `[upload <time>] HTTP <status>` and the details.

## How it differs from `keen-deploy`

Both use the same three legs of the same deploy service; the platform side is identical (`../MCP/uploader.md`).

| | Shira Upload | `keen-deploy` |
|---|---|---|
| Reads | `.vscode/keen.json` (`server` with scheme, `space`, `token`) | flags / env / `.env` (`KEEN_HOST` bare host, `KEEN_SPACE_ID`, `KEEN_DEPLOY_TOKEN`) |
| Packs | **everything** under `src/` | only `flows/`, `scripts/`, `keen-tools.json`; skips dot-entries, `node_modules`, `*.zip` at any depth |
| Before sending | nothing (no local check) | stops if there is no `flows/` |
| Connection | held open until Disconnect; every change re-deploys | connect → upload → disconnect, once |
| Output | toasts + Output channel | NDJSON lines for you, exit codes |
| Who runs it | the person | you |

Running `keen-deploy` while the person's Shira is connected to the **same** space ends with a disconnect that also
drops Shira's server session; Shira's next upload gets `403`, re-connects and retries by itself.

## What you (the builder) can do yourself

- Deploy with `keen-deploy` after `keen-validate` (`../MCP/uploader.md`) — the normal path for you.
- **Know that your file writes may deploy.** If the person's Shira is connected, each file you write under `src/` is
  uploaded 800 ms later, half-finished changes included. Before a multi-file change ask the person to press
  **Disconnect** (or confirm they are not connected), then deploy once when the project validates.
- Keep `src/` clean: no `.env`, no `node_modules`, no notes — Shira would upload them.
- Tell the person to open **Output → Flow Builder** and send you the lines after a refusal.

## Mistakes that break it

| Mistake | What happens | Do instead |
|---|---|---|
| A `.env` or credentials file under `src/` | Shira uploads it to the platform | keep secrets in the console's Secrets (`../Administration/references/secrets-and-credentials.md`), never in `src/` |
| `node_modules/` under `src/` | uploaded; its `.js` fail the security scan → 422 | packages are not allowed in scripts anyway; delete it |
| Editing while connected "just to try something" | each save is live in the space at once | Disconnect first, or work in a test space |
| `server` set to `https://keen.example.com/ms/deploy` | every call goes to a doubled path and fails | the base address only |
| Pressing Connect in two windows for two spaces | they evict each other on every upload | one space per instance at a time |

## Example

You changed three files of a connected project. The person sees `Upload rejected: Project rejected — invalid
structure (1 problem(s)) — see Output ▸ Flow Builder` and pastes the Output:

```
[upload 2026-11-13T09:12:04.120Z] HTTP 422
  Project rejected — invalid structure (1 problem(s))
  • flows/Assistant.flow: agentNode_8Hc2kPq0LmZt — the node id is used again in flows/Support.flow
```

You give the node in `Assistant.flow` a new unique id (and re-point its edges), run `keen-validate`, and — since the
person is still connected — the save itself redeploys; you ask them to watch for `Project synced`.
