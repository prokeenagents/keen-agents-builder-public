# `src/scripts/`

## Description

The agent's JavaScript: the files Script nodes run, the tool scripts an LLM calls, and the helper modules both
import. Every file is an ES module that runs in a sandbox with no Node.js, no npm and no network of its own; it
reaches the platform only through the ten `system/*` modules.

Who reads it:

- **keen-validate** lints every `.js` file here (imports, the `exec` export, the sandbox rules, the tool reply).
- **keen-deploy** uploads the whole folder, any depth, except dot-entries, `node_modules` and `.zip` files.
- **The deploy service** scans every `.js` file; one forbidden construct in any file rejects the whole deploy.
  It also writes its own `scripts/debux.js` (the debugger's probe).
- **The script-engine** runs a Script node's file or a tool's file, and loads its relative imports from here.

## Location and name

- `src/scripts/`, one per project. Optional for keen-validate (a warning) and the deploy (it creates the folder),
  but any Script node or script tool needs it.
- Subfolders: any depth; folder names are not checked (`services/docStore/`).
- File names: camelCase, a letter first, then letters and digits only (`fetchOrder.js`, `webSearchTool.js`). The
  engines accept any name, but the VS Code extension refuses a `.js` file whose base name is not
  `^[A-Za-z][A-Za-z0-9]*$` — an error that disables Connect and Upload: `Script file names must start with a letter and contain only letters and numbers (e.g. myScript.js).`
  A non-`.js` file here gets its warning `File does not belong to the project structure (expected *.js).`
  The paths you write must match the names exactly (case included).
- **Reserved:** `debux.js` — the deploy overwrites it; keen-validate warns and does not lint it.
- Paths are **relative to `src/scripts/`**: a Script node's `data.settings.value` `orders/fetchOrder.js` runs
  `src/scripts/orders/fetchOrder.js`; a script tool's `entry` `tools/webSearchTool.js` runs
  `src/scripts/tools/webSearchTool.js`. The engine adds `scripts/` and reads that exact path: no `./`, no leading
  `/`, no `src/scripts/` prefix, no missing `.js`.

## Structure

| Item | What it is | Needs `exec`? |
|---|---|---|
| a Script node's file (anywhere here, e.g. `orders/fetchOrder.js`) | an **entry**: the node runs `exec(props)` | yes, a **named** export |
| `tools/<name>Tool.js` | an **entry** an LLM calls as a tool (`tools/tools.md`) | yes |
| `services/<service>/*.js` | helper modules of the house standard (below) | no |
| any other `.js` only imported by others | a helper module | no |
| non-`.js` files (`.json`, `.md`) | uploaded and kept, never run; cannot be imported | — |

Imports a file may use (keen-validate and the script-engine agree):

- the ten system modules: `system/log`, `chat`, `session`, `dictionary`, `agent`, `settings`, `secrets`,
  `cookies`, `http`, `tools` (`../../../Flow/Nodes/Script/references/system-modules.md`);
- its own files by a **relative** path with the extension: `./util.js`, `../services/webSearch/service.js`. The
  path is resolved from the importing file and must stay inside `src/scripts/`. No extension guessing, no
  `index.js`.

Nothing else: no npm package, no absolute path, no `node:*`. The bare globals are `dictionary`, `flowContext`,
and in a tool `toolOptions`; there is no `console`, `fetch`, `crypto`, `Buffer`, `process` or timer.

**The house standard** (not checked by any tool yet):

```
scripts/
    tools/                     thin entry points the LLM calls: one file per tool, <name>Tool.js
    services/<service>/        one camelCase folder per outside service (webSearch, docStore)
        service.js             connect(credentials, options) + the instruments — the only file a tool imports
        connector.js           createConnection(credentials, options): the authenticated client (only service.js calls it)
        utils.js               helpers both use
        settings.js            code constants: URLs, scopes, page sizes — deployed and visible, never a secret
    <other Script-node files>
```

- Only a tool (or a Script node's entry) reads Secrets, Json Settings and cookies, then hands them to the service:
  `WebSearchService.connect({ apiKey: Secrets.get('WEBSEARCH_KEY') }, { maxResults })`. A service never imports
  `system/secrets`.
- A service's files import each other relatively (`./connector.js`); one service never imports another. A tool
  imports only the service's `service.js`: `import * as WebSearchService from '../services/webSearch/service.js';`.
- Every service should carry its skill (recommended) at `<project>/.claude/skills/<service-in-kebab>-service/SKILL.md` — outside
  `src/`, never uploaded (`../../../Services/service-skill-template.md`).
- A service holds the logic; a tool holds none (`tools/name-tool.md`).

## Rules and validation

keen-validate, per file (errors unless marked): `no exported \`exec\` …` (entries only) · `uses \`export default\` …` ·
`import '<x>' — only 'system/*' and relative './' '../' files are allowed (no npm packages, no absolute paths)` ·
`import 'system/<x>' — unknown system module (allowed: …)` · `import 'system/logs' — it is 'system/log' (singular)` ·
`import '<x>' escapes src/scripts (resolves to "<path>") …` ·
`import '<x>' → scripts/<path> does not exist — the runner reads the exact path (no extension inference, no index.js) …` ·
`uses fetch() …` · `uses require() …` · `references \`<name>\` — forbidden in the sandbox …` ·
`uses dynamic import() …` · `uses a \`with\` statement …` · `accesses \`.<name>\` — prototype-pollution vector …` ·
`syntax pre-check: …` · (warning) `uses crypto …` · (warning) `Promise.all over system/http, system/agent or system/dictionary reads …`.

The deploy service rejects the deploy (`Project rejected by the security scan — <n> issue(s) must be fixed`) for
any file that does not parse (`Code parsing failed: …`), uses `eval`, `Function`, `require`, dynamic `import()`,
`with`, refers to `process`, `global`, `globalThis`, `module`, `exports`, `__dirname` or `__filename` — **even as
your own variable name** (`Reference to module is forbidden`) — touches `__proto__`, `constructor`, `prototype`,
`getPrototypeOf`, `setPrototypeOf` (or `__define/lookupGetter/Setter__`) on a named object, or imports an npm
package or absolute path.

Imports: the deploy accepts only relative imports and the engine's ten `system/*` modules — an npm package, an
absolute path, any `node:*` or another `system/<word>` is refused (`Unauthorized import "<x>" - only relative (./, ../)
imports and the engine's system/ modules (…) allowed`), the same rule the script-engine applies at run time. One gap
remains, caught only by keen-validate:

- A relative import of a file that does not exist deploys, then fails the node when it runs.

## Limits

- **256 modules** per run: the engine walks a script's import graph up to 256 files (the top script included)
  to decide whether to fetch the agent's Secrets and to match debugger breakpoints. A larger graph still runs,
  but the engine then fetches the agent's Secrets on every run of that script (imported or not) and treats every
  debugger breakpoint as a possible hit. A syntax error in any module of the graph has the same effect.
  Keep a run's graph well under 256.
- Memory **30 MB** per run for the script and every module it loads (code included), plus a fixed 10 MB buffer
  for data coming in; time **15 minutes** per run. Details: `../../../Flow/Nodes/Script/script-skill.md` → *Limits*.
- Script node path: ends in `.js`, at most 160 characters.
- The uploaded bundle: at most 50 MB zipped (the platform as shipped).

## Mistakes that break it

| Mistake | What happens | Write instead |
|---|---|---|
| `settings.value` = `./orders/fetch.js` or `src/scripts/orders/fetch.js` | file not found; the node's error output | `orders/fetch.js` |
| `import { x } from './util'` | not found (no extension guessing) | `'./util.js'` |
| `import cfg from './config.json'` | the JSON is compiled as JavaScript and fails | `export const config = { … }` in `config.js` |
| `import axios from 'axios'` / `import { createHash } from 'node:crypto'` | deploy refused (both) | `system/http`; `system/tools` for ids |
| `fetch-order.js`, `web_search_tool.js`, `my script.js` | the VS Code extension shows an error and disables Connect / Upload | `fetchOrder.js`, `webSearchTool.js` |
| `const module = …`, `let process = …` | the whole deploy is refused | another name |
| a service imports `system/secrets` | works, but breaks the house standard and spreads secret reads | read in the tool, pass the value in |
| a tool file used as a Script node | `ReferenceError: toolOptions is not defined` → error output | keep node scripts outside `tools/` |
| your own `debux.js` | replaced by the deploy | another name |

## Example

```
src/scripts/
    orders/fetchOrder.js           ← Script node: settings.value "orders/fetchOrder.js"
    tools/
        webSearchTool.js              ← keen-tools.json entry "tools/webSearchTool.js"
        docStoreSearchTool.js
        docStoreReadTool.js
    services/
        webSearch/{service,connector,utils,settings}.js
        docStore/{service,connector,utils,settings}.js
```
