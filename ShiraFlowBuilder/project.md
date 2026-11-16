# Creating and connecting a project in Shira

> **Keen 15.3 · Shira Flow Builder 0.0.6.**

The full project layout (what every file is for, the house standard for `services/`) is in
`../ProjectStructure/SKILL.md`. This page is only what the **extension** creates, detects and reads.

## 1. When Shira calls a folder a project

Shira looks at the **first** folder of the VS Code window. When the workspace's `keen-project.json` names the agent
project in a subfolder (`agent_project_dir`, e.g. `./agent` — `../ProjectSetup/keen-project.md`), the person opens
**that** folder (**File › Open Folder…**), not the workspace root. It is a project only when **all five** exist:

```
.vscode/keen.json   src/keen-tools.json   package.json   src/flows/   src/scripts/
```

| Folder state | Panel status line | Buttons |
|---|---|---|
| no folder open | `Open a folder to create or load a project.` | all off |
| empty (only `.git`, `.vscode`, `.DS_Store` count as empty) | `Empty folder — create a project below.` | **Create Project** on |
| not empty, a marker missing | `This folder is not a Shira Flow Builder project.` | all off |
| all markers, no errors | `Shira Flow Builder — detected` (green) | **Connect** on |
| all markers, at least one error | `Shira Flow Builder — invalid` (red) + the error lines | **Connect** off |

The errors and warnings are the extension's own checks (`problems.md`).

## 2. Create Project

### What it is
The panel button **Create Project** writes a minimal skeleton into the open folder.

### What the person does
Opens an **empty** folder, clicks **Shira Flow Builder** in the activity bar, clicks **Create Project**. A toast says
`Flow Builder project created.` and the status becomes `— detected`. (`Open a folder first, then create a project.`
when no folder is open; `Could not create project: <reason>` on a disk error.)

### What it writes

| Path | Content |
|---|---|
| `.vscode/settings.json` | `{}` |
| `.vscode/keen.json` | the five fields with placeholders (section 3) |
| `.gitignore` | a new file with the line `.vscode/keen.json`; if a `.gitignore` already exists the line is appended (left alone when `.vscode/keen.json` or `/.vscode/keen.json` is already there) |
| `src/keen-tools.json` | `{ "tools": [] }` |
| `src/flows/Project.flow` | `{ "nodes": [], "edges": [] }` — an empty canvas, no Start node yet |
| `src/scripts/init.js` | `export const exec = (props) => { /** Project init script. */ };` |
| `src/scripts/tools/` | an empty folder |
| `package.json` | `{ "name": "<folder name>", "version": "0.0.1", "private": true, "type": "module" }` |

JSON files are written with 4-space indentation. `scripts/debux.js` is **not** created: the platform adds its own
debug probe at deploy time — never ship one.

### What you (the builder) can do yourself
Write the same skeleton by hand — usually better, because you write the house version straight away
(`../ProjectStructure/SKILL.md`, "A new project, in order"). Whichever you do, the five markers must exist or the
panel will not offer **Connect**.

### Mistakes that break it

| Mistake | What happens | Do instead |
|---|---|---|
| **Create Project** pressed in a folder that holds only `.vscode/keen.json` (filled in) | The folder counts as empty, the button is on, and Create Project **overwrites** `keen.json` with placeholders and `settings.json` with `{}` | Write the skeleton by hand when `keen.json` already exists, or fill `keen.json` after Create Project |
| Expecting `Project.flow` to be deployable as is | It has no nodes; add the Start node and the agent's flow first (`../Flow/Nodes/SKILL.md`) | — |
| A `scripts/debux.js` added "for the debugger" | The deploy replaces it with its own; keen-validate warns | Leave it out |

## 3. `.vscode/keen.json` — field by field

The file Create Project writes:

```json
{
    "server": "[REPLACE_WITH_KEENAGENTS_INSTANCE_URL]",
    "space": "[REPLACE_WITH_KEENAGENTS_SPACE_ID]",
    "token": "[REPLACE_WITH_KEENAGENTS_SPACE_DEPLOYMENT_TOKEN]",
    "user": "[REPLACE_WITH_YOUR_CONSOLE_EMAIL]",
    "password": "[REPLACE_WITH_YOUR_CONSOLE_PASSWORD]"
}
```

Any value that is empty or still starts with `[REPLACE` counts as missing.

| Field | Read by | Required | Value | Who fills it |
|---|---|---|---|---|
| `server` | Connect / Upload / auto-sync, both debuggers | yes | the instance's base address **with** `https://`, no path: `https://keen.example.com`. Deploy calls go to `<server>/ms/deploy/v1/project/…` (trailing `/` dropped). The debuggers use only its origin and accept a bare host, the deploy does not — always write the scheme | you (the person tells you the instance) |
| `space` | Connect / Upload, both debuggers | yes | the **Space ID** (console → AI → Spaces), not its name. It is also the only space the debuggers stop in | you (MCP lists spaces) |
| `token` | Connect / Upload only | for deploy | the space's **Deployment Token** | **the person types it** into the file |
| `user` | the debuggers only | for debugging | the e-mail of the person's own console account (not an MCP account, not a consumer) | the person |
| `password` | the debuggers only | for debugging | that account's password, read byte for byte (not trimmed) | **the person types it** into the file |
| `debugHost` | the debuggers only | no | a host name only (no scheme, port, path) — used only for the fallback ports 7101 / 7100 when the server has no TLS debug edge (`debugging.md`) | rarely needed |

No other field is read. Who reads the file: the extension only. `keen-deploy` does not (it reads `.env` / flags —
`../MCP/uploader.md`); the platform never sees the file (Upload sends `src/` only). More: `../ProjectStructure/vscode/keen-json.md`.

**It holds a deployment token and a console password.** It must stay git-ignored (`.vscode/keen.json` in
`.gitignore`), never committed, never zipped, never pasted anywhere. The person types `token` and `password` into the
file in their editor. **Never ask for them in the chat, never write them yourself, never print the file.** You may write
the file with `server` and `space` filled in and the three secrets as placeholders.

## 4. Connect

**Connect** (enabled while the project is `— detected`) exchanges the deployment token for a deploy session and turns
into **Disconnect**. It is described with Upload in `upload.md`; the toasts the person can see on click:

| Toast | Meaning |
|---|---|
| `Connected to the deployment service ✓` | done; status bar `Connected` |
| `Could not read .vscode/keen.json.` | missing or not JSON |
| `Set "server" in .vscode/keen.json first.` (same for `"space"`, `"token"`) | empty or a placeholder |
| `Invalid deployment token or space id` | the platform refused the pair (wrong token, or the token of another space) |
| `the deployment service did not answer (<code>)` | network / TLS failure, or `server` without `https://` (`ERR_INVALID_URL`) |
| `Service is bootstrapping (503)` | the deploy service is still starting — try again |

## 5. Create Flow / Create Script

### What it is
Two commands that create a correctly named file and open it.

### What the person does

| Command | Where | Input box | Creates |
|---|---|---|---|
| **Create Flow** | right-click a folder named `flows` in the Explorer, or the Command Palette | title `Create Flow`, prompt `Flow file name`, placeholder `MyFlow` | `<Name>.flow` with `{ "nodes": [], "edges": [] }`, opened in the canvas |
| **Create Script** | right-click `src/scripts` or any folder under it in the Explorer, or the Command Palette | title `Create Script`, prompt `Script file name`, placeholder `myScript` | `<name>.js` with `export const exec = (props) => { /** <name> script. */ };`, opened as text |

From the Command Palette the file goes into `src/flows` / `src/scripts` (the project root when that folder is
missing). A typed `.flow` / `.js` ending is removed. The box refuses, live: an empty name (`Enter a file name.`), a bad
name, and an existing file (`<Name>.flow already exists.`):

- flow names: `Flow names must be PascalCase — start with a capital letter, letters and numbers only (e.g. MyFlow).`
- script names: `Script names must start with a letter and contain only letters and numbers (e.g. myScript).`

The script rule accepts `MyScript` too; camelCase (`docStoreSearchTool`) is the house rule.

### What happens around file changes (automatic)

- A file created or renamed under `src/flows` / `src/scripts` with a bad name (an Explorer paste gives `X copy.flow`)
  gets a warning toast `<file> — <rule>` and a Problems entry.
- A new `.flow` whose node ids already exist in another `src/**/*.flow` (a copy) gets **every** node id regenerated
  (`<type>_<12 letters/digits>`, edges `edge_<12>`, edges re-pointed); the status bar says
  `<File>.flow — duplicate node ids regenerated`. Only on **create** — ids duplicated by editing a file are not fixed.
- A save / create / delete / rename of a `.flow`, `.js` or `keen-tools.json` under `src/` flashes
  `File <name> was saved` (`created`, `deleted`, `renamed to <new>`) for about a second.
- **While connected, every change under `src/` is deployed** (`upload.md`).

### What you (the builder) can do yourself
Write the files directly — same names, same content rules (`../ProjectStructure/SKILL.md`). When you copy a `.flow`,
give its nodes new ids yourself: the regeneration above only runs inside the person's VS Code.

## Example

You set up a new agent for the person; MCP gave you the space id `cmspace0001` on `https://keen.example.com`.

1. Write the skeleton by hand (house version), including `.gitignore` with `.vscode/keen.json`, and `keen.json`:
   ```json
   {
       "server": "https://keen.example.com",
       "space": "cmspace0001",
       "token": "[REPLACE_WITH_KEENAGENTS_SPACE_DEPLOYMENT_TOKEN]",
       "user": "[REPLACE_WITH_YOUR_CONSOLE_EMAIL]",
       "password": "[REPLACE_WITH_YOUR_CONSOLE_PASSWORD]"
   }
   ```
2. Tell the person: "Open `.vscode/keen.json` in VS Code and replace the three `[REPLACE_…]` values yourself: the
   space's **Deployment Token** (console → AI → Spaces → the space → **Reveal**), and — only if you will debug — your
   console e-mail and password. Do not paste them here. Then open the **Shira Flow Builder** view: it should say
   **— detected**; press **Connect**."
