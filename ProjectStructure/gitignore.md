# `.gitignore`

## Description

Git's list of files that must never be committed. Its one essential job is to keep `.vscode/keen.json` out of git,
because that file holds the deployment token and the console password. It also keeps out what the project does not own:
installed packages, local env files and zips.

Who reads it:
- **git**.
- **Shira**, when it creates a project. Create Project writes the file, or adds the `keen.json` line to an existing one.
- **keen-validate**, to decide whether `.vscode/keen.json` is ignored.

keen-deploy, the deploy service and the engines never read it, and it is never uploaded.

## Location and name

- Path: `<project root>/.gitignore`. Only the root file counts for keen-validate when it checks without git.
- Required (house standard). Shira always creates it.
- Created by Shira's **Create Project**. With no `.gitignore`, it writes one holding `.vscode/keen.json`. With an existing
  one that lacks that line (or `/.vscode/keen.json`), it appends the line. Otherwise the builder writes it.
- Shira's Create Project is enabled only in an empty folder, and a `.gitignore` makes the folder not empty (only `.git`,
  `.vscode` and `.DS_Store` are ignored). So let Shira create the project first, then extend the file.

## Structure

One pattern per line. `#` starts a comment, and `!` re-includes a path. The house content:

| Line | Required | What it keeps out and why |
|---|---|---|
| `.vscode/keen.json` | Yes | The deployment token and the console password |
| `node_modules/` | Yes (house) | Prettier's install. Never committed, never uploaded |
| `.env` / `.env.*` | Yes (house) | keen-deploy's `.env` when it is run from the project root (host, space id, deployment token) |
| `!.env.example` | Yes (house) | re-includes the example file `.env.*` would also hide; it holds names, never values |
| `*.zip` | Yes (house) | Hand-made bundles or downloads |
| `.DS_Store` | No (house) | macOS folder files |

Do not ignore `src/`, `.claude/` (the services' skills), `package.json`, `package-lock.json`, `.prettierrc`,
`.prettierignore` or `.vscode/settings.json`.
They are the project and must be committed.

## Rules and validation

- keen-validate, inside a git work tree, runs `git check-ignore -q .vscode/keen.json`. Outside one, it matches the root
  `.gitignore` (the last matching line wins; `!` re-includes). `.vscode/keen.json`, `.vscode/` and `keen.json` all match.
  If the file is not ignored, it warns: `holds the deployment token and your password — add it to .gitignore; never
  commit it`.
- A `keen.json` that is already committed still gets that warning, because git does not treat tracked files as
  ignored. Untrack it with `git rm --cached .vscode/keen.json` and rotate the deployment token.
- (house standard — not checked by any tool yet) Use exactly the lines above. Ignore `.vscode/keen.json`, not the whole
  `.vscode/`.

## Security

This file is the main guard against leaking `keen.json`. If a token or password was ever committed, deleting it from the
repository is not enough, because it stays in the history. Reset the Space's deployment token in the console, and
change the console password.

## Mistakes that break it

| Mistake | What happens | Write instead |
|---|---|---|
| The `keen.json` line is missing | The token and password reach the next commit, and keen-validate warns | `.vscode/keen.json` |
| `!.vscode/keen.json` below an ignoring line | It is re-included and committed | Remove the `!` line |
| `.vscode/` | `keen.json` is safe, but `settings.json` is no longer shared | `.vscode/keen.json` |
| `src/` or `*.flow` | The agent's code is not committed | Never ignore `src/` |
| `.claude/` | The services' skills are not committed; the next session has none | Never ignore `.claude/skills/` |
| A `.gitignore` written before Create Project | Shira sees a non-empty folder and Create Project stays disabled | Run Create Project first, then add the house lines |

## The workspace's `.gitignore`

`keen-project.json` sits at the workspace root — the project folder itself or a folder holding it, never `src/` (`../ProjectSetup/keen-project.md`). It holds the
builder's MCP account secret, so when the workspace is a git repository its root `.gitignore` carries the line
`keen-project.json` before the first commit. If the file is already tracked: untrack it (`git rm --cached
keen-project.json`) and the person presses **Rotate secret** on the MCP account. The project's `.env` holds no MCP
account values.

## Example

```
# Local secrets — the deployment token and the console password
.vscode/keen.json

# Local tooling
node_modules/
.env
.env.*
!.env.example
*.zip
.DS_Store
```
