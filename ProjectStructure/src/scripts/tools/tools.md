# `src/scripts/tools/`

## Description

The folder of **tool scripts**: the JavaScript files an LLM node calls with a `<SYSTEM CALL>` block. A script is
a tool because a `"type": "script"` entry in `src/keen-tools.json` points at it, and the platform runs a script
tool **only** from this folder.

Who reads it:

- **keen-validate** checks that every script tool's `entry` starts with `tools/`, has no `..` and exists, and lints
  each registered file as a tool.
- **The llms-engine** refuses, before anything runs, a script tool whose `entry` is outside `tools/`.
- **The script-engine** checks the same rule again before it loads the file, then runs it.

## Location and name

- `src/scripts/tools/`. Optional — needed only when the agent has script tools. A new project starts with it
  empty.
- Subfolders are allowed: `tools/billing/chargeTool.js` (entry `"tools/billing/chargeTool.js"`).
- File names: `<name>Tool.js`, camelCase, one file per tool. A service's tool is `<service><Action>Tool.js`, one per
  instrument (`docStoreSearchTool.js`, `docStoreReadTool.js`); a service with a single action may be just
  `<service>Tool.js` (`webSearchTool.js`) (house standard). The engines accept any name, but the VS Code extension refuses a script file whose name
  (without `.js`) is not `^[A-Za-z][A-Za-z0-9]*$` — an error that disables Connect and Upload:
  `Script file names must start with a letter and contain only letters and numbers (e.g. myScript.js).` So no `_`, `-`, space or dot in a tool's file name; folder names are not checked.

## Structure

What goes in: tool entry points only — files with a named `exec` that an entry in `keen-tools.json` names.
The shape of one file is in `name-tool.md`.

What must not go in:

- **Script node files.** A Script node may point into `tools/`, but there is no `toolOptions` global outside a
  tool, so a tool file run as a node fails with `ReferenceError: toolOptions is not defined`. Keep node scripts elsewhere in `src/scripts/`.
- **Business logic and helpers** (house standard — not checked by any tool yet): they live in
  `src/scripts/services/<service>/`. A tool imports only `../services/<service>/service.js` (one level deeper in a
  subfolder: `../../services/…`) — never the service's `connector.js`, `utils.js` or `settings.js`.

**The path rule.** The llms-engine and the script-engine apply the same check to a script tool's `entry`:

- it is a non-empty string;
- it **starts with `tools/`** (relative to `src/scripts/`; not `scripts/tools/`, not `./tools/`);
- it does **not contain `..`** anywhere.

Anything else is refused. The file must also exist at exactly that path.

**How a tool script differs from a node script:**

| | Script node file | Tool script |
|---|---|---|
| Started by | the flow reaching the node | an LLM node's `<SYSTEM CALL>` naming the tool |
| `props` | the node's Key/Value Pairs | always `{}` — a tool has no pairs |
| Its input | `props`, `dictionary`, the session | `toolOptions.toolContext.options` (the parsed `!*context` and any other `!*key`) |
| `toolOptions` global | absent | present: `toolContext` (the call) and `agentNode` (the caller) |
| `dictionary` | the current flow's | the **calling agent's** flow dictionary |
| `flowContext.sessionId` | the run's session | the tool's **own** new session — not the caller's |
| Output | writes to the dictionary / session; continues out of `next_1` | must **file a user message** for the calling agent; the return value never reaches the model |
| On a throw | the node's `error` output (or the run stalls) | dictionary and agent writes dropped, session kept, one Log Record line; the agent reads `No tool response` |

The session contract: the reply goes to `toolOptions.toolContext.agentId`, stamped with
`sessionID: toolOptions.agentNode.flowContext.sessionId` and a fresh `requestID`. Full detail:
`../../../../Flow/Nodes/LLM/references/tool-calling.md` §4.

## Rules and validation

keen-validate (on `keen-tools.json`):

- `script tool entry "<entry>" must start with "tools/"`
- `script tool entry "<entry>" must not contain ".."`
- `script tool entry "<entry>" not found under src/scripts/`

and on each registered file (marked `(tool)` in the report): the script lint of `../scripts.md`, plus the reply
checks — for example `… reply has no \`sessionID\` …` (error), `… stamps \`requestID\` with the CALLER's request id …`
(error), `… stamps \`sessionID: flowContext.sessionId\` — for a script TOOL that is the tool's OWN session …`
(warning), `script tool replies but never references \`toolOptions.toolContext\` …` (warning).

At run time:

- outside `tools/` or with `..` → the llms-engine runs nothing and files `No tool response` as the next user
  turn; the same LLM node runs again. Nothing is written to the Log Record.
- the same path reaching the script-engine (a defence in depth) → Log Record
  `virtualScriptNode rejected — tool path must live under "scripts/tools/" (got "<path>")`; the agent reads
  `No tool response`.
- the file is missing → Log Record `Script "<entry>" failed: File not found: …`; the agent reads `No tool response`.

The deploy service checks none of this; it only scans the files like every other script.

## Limits

- Same as every script (`../scripts.md` → *Limits*): 30 MB memory, 15 minutes per run, 256 modules in the graph.
- One tool runs per LLM answer (the first `<SYSTEM CALL>` block); the LLM node waits until it has finished.

## Mistakes that break it

| Mistake | What happens | Write instead |
|---|---|---|
| entry `"scripts/tools/webSearchTool.js"` | keen-validate error; at run time `No tool response` | `"tools/webSearchTool.js"` |
| entry `"tools/../lib/webSearch.js"` | refused (`..`) | move the file into `tools/` |
| tool file at `src/scripts/webSearchTool.js` | refused: not under `tools/` | `src/scripts/tools/webSearchTool.js` |
| business logic inside the tool file | works, but no other tool or node can reuse it (house standard) | a service under `services/` |
| a Script node pointing at `tools/webSearchTool.js` | `ReferenceError: toolOptions is not defined` → the node's `error` | a separate node script |
| expecting `props.query` in a tool | `props` is `{}` | `toolOptions.toolContext.options.context` |

## Example

```
src/scripts/tools/
    webSearchTool.js            ← "tools/webSearchTool.js"
    docStoreSearchTool.js       ← "tools/docStoreSearchTool.js"
    docStoreReadTool.js         ← "tools/docStoreReadTool.js"
    billing/chargeTool.js    ← "tools/billing/chargeTool.js" (imports ../../services/billing/service.js)
```
