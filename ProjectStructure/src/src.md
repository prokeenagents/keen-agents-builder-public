# `src/`

## Description

The agent's source code: the flows, the scripts and the tool registry. Only this folder is uploaded on a deploy, and
everything outside it stays on your machine.

Who reads it:
- **Shira** checks it for its Problems panel, zips `flows/`, `scripts/` and `keen-tools.json` on Upload (keen-deploy's
  rule), and re-uploads them on every change to them while connected — not while the Problems panel has an error.
- **keen-validate** checks the flows, the scripts and `keen-tools.json`.
- **keen-deploy** zips only `flows/`, `scripts/` and `keen-tools.json`.
- **The deploy service** builds the upload, checks its structure, scans every `.js` file and then makes it live.
- **The engines** run what was made live, never your local files.

## Location and name

- Path: `<project root>/src/`. The names `src`, `flows`, `scripts`, `tools` and `keen-tools.json` are fixed.
- Required. `src/flows/`, `src/scripts/` and `src/keen-tools.json` are Shira project markers.
- Created by Shira's **Create Project**, which writes `flows/Project.flow`, `scripts/init.js`, an empty `scripts/tools/`
  and `keen-tools.json` with `{ "tools": [] }`. Otherwise the builder creates it.

## Structure

| Entry | Required | What goes in it |
|---|---|---|
| `flows/` | Yes | Flow files only: `<Name>.flow`, PascalCase, **one level**, at least one. Use letters only, because a flow with a digit in its name cannot be the target of a Run / Jump / Flow Pointer / Parallel Context node or a flow tool. |
| `scripts/` | Yes | `.js` ES modules, at any depth. A file that a Script node runs exports `exec`. |
| `scripts/tools/` | Yes for script tools | The thin entry points that the agent calls as tools. A script tool's `entry` in `keen-tools.json` must start with `tools/`. |
| `scripts/services/<service>/` | No (house standard) | One folder per outside service: `service.js` (`connect(credentials, options)` + the instruments — the only file a tool imports, by a relative path), `connector.js` (`createConnection`: the authenticated client, the calls out — used by `service.js` only), `utils.js` (shared helpers), `settings.js` (code defaults and constants, never a secret). |
| `keen-tools.json` | Yes (marker) | The tool registry `{ "tools": [ { name, type, entry } ] }`. |

Nothing else belongs here. Never put `node_modules/`, `.env`, `keen.json`, `keen-project.json`, zips, READMEs, a service's `SKILL.md` or
build output inside `src/`. A service's skill lives at `<project>/.claude/skills/<service-in-kebab>-service/SKILL.md`,
outside `src/` (`../../Services/service-skill-template.md`).

What happens on deploy:
- **Shira** and **keen-deploy** upload the same: only `flows/`, `scripts/` and `keen-tools.json`. They skip
  dot-entries, `node_modules` and `*.zip` at any depth (Shira also never follows a symbolic link), and name any other
  top-level entry they left out — keen-deploy in `skipped`, Shira in **Output → Flow Builder** (`not sent (the platform
  builds only flows/, scripts/ and keen-tools.json): …`). (Shira 0.0.6 uploaded every file under `src/`, dot-files and
  `node_modules/` included.)
- **The deploy service** compiles each `.flow` into the engine's form and removes the raw file. It turns
  `keen-tools.json` into the tool map and removes it, and it adds its own `scripts/debux.js`, overwriting any copy you
  shipped. Then it scans **every `.js` file** in the upload. Other files are kept in the live tree but nothing uses them.
- The platform as shipped refuses an upload bundle over **50 MB** (the zip).

## Rules and validation

- The deploy service refuses the deploy with `flows/ directory is missing`, `flows/ contains no .flow files`,
  `flows/<file>: invalid JSON — …`, `keen-tools.json: invalid JSON — …`, `` `flows` must be a single level (no
  subfolders) `` or `` `flows` must contain only .js files `` (a stray non-flow file in `flows/`). The scan refuses any
  `.js` file with a critical or high issue, e.g. `require() is forbidden - use import statements only` or `Dynamic
  import() is forbidden - only static imports allowed`.
- keen-validate reports these as errors: a subfolder or stray file in `flows/`, no `.flow` file, a non-PascalCase flow
  name, a relative import that leaves `scripts/` or names a missing file (the exact path, extension included). It warns
  about a digit in a flow name, a missing `scripts/` or `keen-tools.json`, and a shipped `scripts/debux.js`.
- Shira's Problems panel shows these, and errors keep Connect / Upload off:
  - error: `.flow file names must be PascalCase, starting with a capital letter (e.g. Project.flow).`
  - error: `Script file names must start with a letter and contain only letters and numbers (e.g. myScript.js).`
  - error: `The flows directory must contain at least one [FILE_NAME].flow file for the project to be valid.`
  - warning: `Directories are not allowed in src/flows — only top-level *.flow files.`
  - warning: `File does not belong to the project structure (expected *.js).` (and the same with `*.flow` for `flows/`)
  - error, in the deploy's own words, before an upload is refused: a `.flow` that is not JSON or not the `.flow` shape
    (`flows/<file>: invalid JSON — …`, `flows/<file>: "nodes" must be a list`, …), a node id used twice anywhere in
    the project (`flows/<A>.flow: <id> — the node id is used again in flows/<B>.flow`, on both files), a
    `keen-tools.json` that is not `{ "tools": [ … ] }` (`keen-tools.json: "tools" must be a list of tool objects`), and
    an import that is not relative or one of the ten `system/*` modules (`Unauthorized import "<x>" - …`) —
    `../../ShiraFlowBuilder/problems.md`.
- Note that Shira's script-name rule refuses `_` and `-`, so the tree's `tools/web_search_tool.js` is an error in Shira (no
  other tool checks script names). (house standard) Name it `tools/webSearchTool.js`.
- (house standard — not checked by any tool yet) Tools live under `scripts/tools/`, and each one imports its service as
  `../services/<service>/service.js` — and only that file of the service. Only a tool reads the agent's Secrets
  (`system/secrets`), Json Settings and cookies. `settings.js` never holds
  a key. Folder names under `services/` are lowercase letters and digits.

## Security

No secrets in `src/`. Everything in `flows/`, `scripts/` and `keen-tools.json` is uploaded, kept on the platform and
readable by anyone with the code; anything else in `src/` (a `.env`) is not uploaded but does not belong beside the
code either. App
credentials go in the agent's **Secrets** (read with `system/secrets`), plain config goes in the agent's **Json
settings** (`system/settings`), and the deploy token stays in `.vscode/keen.json`.

## Mistakes that break it

| Mistake | What happens | Write instead |
|---|---|---|
| `flows/agents/Main.flow` | The deploy is refused (single level) | `flows/Main.flow` |
| `flows/notes.md` | The deploy is refused (`` `flows` must contain only .js files ``) | Keep notes outside `src/` |
| `scripts/tools/web_search_tool.js` | Shira shows an error and disables Upload | `scripts/tools/webSearchTool.js` |
| `import x from '../services/webSearch/service'` | The run fails, because the import has no extension | `'../services/webSearch/service.js'` |
| `npm install` inside `src/` | `node_modules/` is not uploaded (Shira 0.0.6 uploaded it and the scan refused its `require()`), and an import of a package is refused | No packages; import only `system/*` and relative files |
| A secret in `services/<s>/settings.js` | It is deployed, readable and exported | The agent's Secrets, read in the tool |

## Example

```
src/
    flows/
        Project.flow
    scripts/
        init.js
        tools/
            webSearchTool.js
        services/
            webSearch/
                service.js
                connector.js
                utils.js
                settings.js
    keen-tools.json
```
