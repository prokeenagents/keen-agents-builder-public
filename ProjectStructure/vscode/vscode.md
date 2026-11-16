# `.vscode/`

## Description

The project's editor folder. It holds the files the VS Code extension "Shira" reads: `keen.json` (where to deploy and
how the debuggers sign in) and `settings.json` (editor settings for this project).

Who reads it:
- **Shira**: `keen.json` is one of the five project markers. Connect / Upload and the two debuggers read it.
- **keen-validate**: checks that `keen.json` is git-ignored and that its login fields look right.
- **agent-runner `debug.ts`**: reads `keen.json` to sign in for a debugger attach by hand.
- **keen-deploy, the deploy service, the engines**: never. The folder sits outside `src/`, so it is never uploaded.

## Location and name

- Path: `<project root>/.vscode/`, beside `src/` and `package.json`. The name is fixed: a dot, then lowercase `vscode`.
- Required: yes. Shira detects a project only when all five markers exist: `.vscode/keen.json`, `src/keen-tools.json`,
  `package.json`, `src/flows/`, `src/scripts/`.
- Created by: Shira's **Create Project**, which writes `keen.json` and `settings.json` when they are missing. A builder
  that works without VS Code creates the folder and both files by hand.
- Shira still treats a folder as empty when it holds only `.vscode`, `.git` or `.DS_Store`, so **Create Project** stays
  enabled after you add a `.vscode/` by hand. Shira 0.0.7 keeps a filled-in `keen.json` (and an existing
  `settings.json`) and says `Flow Builder project created — your existing .vscode/keen.json was kept as it is.`;
  0.0.6 overwrote both.

## Structure

| Entry | Required | What it is for |
|---|---|---|
| `keen.json` | Yes (a project marker) | The deploy target and the debugger login. See `keen-json.md`. |
| `settings.json` | No (Shira writes it, no tool reads it) | Editor settings for this project. See `settings.md`. |
| `launch.json` | No | Not needed. Shira starts its debuggers from its own commands. Its `keen-flow` attach setting `cdpUrl` exists only to force a manual debugger address. |

Do not put anything else here. In particular, never put `.env` files, keys or copies of `src/` in this folder.

## Rules and validation

- Shira: if `.vscode/keen.json` is missing, the project is not detected and Connect / Upload stay off.
- keen-validate: `.vscode/keen.json` not git-ignored → warning `holds the deployment token and your password — add it to
  .gitignore; never commit it`.
- keen-deploy and the deploy service do not look at this folder.
- (house standard — not checked by any tool yet) Git-ignore `.vscode/keen.json` only, not the whole `.vscode/`. That
  way `settings.json` is shared with everyone who clones the project.

## Security

`keen.json` holds a deployment token and a console password. It must be git-ignored, and you never zip it, paste it or
share it. `settings.json` holds no secrets and may be committed.

## Mistakes that break it

| Mistake | What happens | Write instead |
|---|---|---|
| The folder is named `vscode/` or `.VSCode/` | Shira does not detect the project; the debuggers find no `keen.json` | `.vscode/` exactly |
| `keen.json` sits in the project root or in `src/` | Shira does not detect the project (Shira 0.0.7 does not upload a `src/keen.json`, 0.0.6 did) | `.vscode/keen.json` |
| `.gitignore` lists `.vscode/` | Works, but `settings.json` is no longer shared | `.vscode/keen.json` |
| A `.env` with deploy values put here "to keep it together" | It is committed unless ignored, and keen-deploy never reads it here | Keep keen-deploy's `.env` in the directory you run it from, outside the project |

## Example

```
my-agent/
    .claude/
        skills/          ← one <service-in-kebab>-service/SKILL.md per service (committed, never uploaded)
    .vscode/
        keen.json        ← git-ignored
        settings.json
    src/
    package.json
    .prettierrc
    .prettierignore
    .gitignore
```
