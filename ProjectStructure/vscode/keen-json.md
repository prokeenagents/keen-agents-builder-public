# `.vscode/keen.json`

## Description

This is the project's local connection file. It says which Keen instance and which AI Space the project deploys to, and
it holds the console login that the debuggers sign in with.

Who reads it:
- **Shira (the VS Code extension)** reads it in two places. **Connect / Upload** read `server`, `space` and `token`.
  The **flow and script debuggers** read `server`, `space`, `user`, `password` and `debugHost`.
- **agent-runner `debug.ts`** (a debugger attach by hand) reads `server`, `space`, `user`, `password` and `debugHost`.
  It never reads `token`.
- **keen-validate** checks that the file is git-ignored and checks the login fields. It never prints a value.
- **keen-deploy does NOT read it.** keen-deploy takes `KEEN_HOST`, `KEEN_SPACE_ID` and `KEEN_DEPLOY_TOKEN` from a `.env`
  file or from flags. The deploy service and the engines never see this file.

## Location and name

- The path is fixed: `<project root>/.vscode/keen.json`.
- It is required, because it is one of Shira's five project markers.
- Shira's **Create Project** writes it with `[REPLACE_WITH_…]` placeholders when there is none (or it is blank). A
  filled-in one is kept byte for byte, and the toast says `Flow Builder project created — your existing
  .vscode/keen.json was kept as it is.` (0.0.6 overwrote it). A builder working without VS Code writes it by hand, or
  copies it from the person.

## Structure

A single JSON object. Every value is a string.

| Property | Required | What it means and what it is for |
|---|---|---|
| `server` | Yes | The instance's base address with its scheme, e.g. `https://keen.example.com` (no path; a trailing `/` is dropped). Deploy calls go to this address, and the debuggers attach to its host. |
| `space` | Yes | The AI Space id from the console. The deployed code lives under this id. |
| `token` | For Connect / Upload | The Space's deployment token (console → the Space → Deployment token). |
| `user` | For debugging | The e-mail of your console account. |
| `password` | For debugging | That account's password. It is read exactly as written, without trimming. |
| `debugHost` | No | A host name only (no scheme, port or path). Use it only when the debugger ports are reached on a different host than `server`. |

Shira writes no other properties, and every reader ignores any others.

## Rules and validation

- Shira's Connect fails with `Set "server" in .vscode/keen.json first.` (and the same for `"space"` and `"token"`)
  while a value is empty or still starts with `[REPLACE`. If the file cannot be read or parsed, Connect fails with
  `Could not read .vscode/keen.json.`
- The debuggers show `Add your console login ("user" and "password") to .vscode/keen.json to debug` while either
  field is missing. They show `"server" in .vscode/keen.json is not a URL.` for a bad `server`, and `"debugHost" in
  .vscode/keen.json must be a host name only (no scheme, port or path).` for a bad `debugHost`.
- keen-validate gives warnings only:
  - `holds the deployment token and your password — add it to .gitignore; never commit it`
  - `is not valid JSON — …`
  - `must be a JSON object { server, space, token, user, password }`
  - when `user` or `password` is present: `` `user` must be your console account e-mail … `` and `` `password` is empty … ``
- (house standard — not checked by any tool yet) Write all five main properties, and leave `debugHost` out unless you
  need it. Indent with 4 spaces.

## Security

This file holds a deployment token and a password, so it must be git-ignored (`.vscode/keen.json` in `.gitignore`).
Shira's Create Project adds that line itself. The file is never uploaded, because Upload sends only `src/flows/`, `src/scripts/` and `src/keen-tools.json`.
A builder never prints, logs, commits or echoes its values. In examples, use placeholders like `<deployment token>`.

## Mistakes that break it

| Mistake | What happens | Write instead |
|---|---|---|
| `"server": "keen.example.com"` (no scheme) | Shira's Connect builds a bad address and fails | `"server": "https://keen.example.com"` |
| `"server": "https://keen.example.com/ms/deploy"` | Shira adds its own deploy path after it, so every call misses | The base address only |
| A `[REPLACE_WITH_…]` placeholder left in place | `Set "token" in .vscode/keen.json first.` | The real value |
| `"user"` set to a consumer or an MCP account | The debugger sign-in is refused | Your console account's e-mail |
| `"debugHost": "https://keen.example.com:7101"` | The debuggers refuse the file | `"debugHost": "keen.example.com"` |
| Comments or trailing commas | The file is invalid JSON, so nothing can read it | Plain JSON |
| Expecting keen-deploy to use this file | keen-deploy says `missing --host (or KEEN_HOST in .env)` | Set `KEEN_HOST`, `KEEN_SPACE_ID` and `KEEN_DEPLOY_TOKEN` in keen-deploy's `.env` |

## Example

```json
{
    "server": "https://keen.example.com",
    "space": "<space id>",
    "token": "<deployment token>",
    "user": "<console e-mail>",
    "password": "<console password>"
}
```
