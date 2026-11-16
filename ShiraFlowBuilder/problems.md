# Shira's checks in the Problems panel

> **Keen 15.3 · Shira Flow Builder 0.0.6.**

## What it is

Shira scans the project and writes what it finds to VS Code's **Problems** panel (**View → Problems**), source
**Flow Builder**, each entry pinned to the first line of the file (or to the folder) it is about. The same findings
fill the panel's red `✕` lines and `⚠ Structure warnings:` list and the number badge on the activity-bar icon
(`panel.md`). **Any error marks the project `— invalid` and disables Connect and Upload Project.** Warnings do not.

The scan runs only when the folder is a project (all five markers — `project.md` §1). It re-runs:

- on any file **created or deleted** anywhere in the workspace,
- on a **change of a `.flow` file** (300 ms after the last write — one canvas save can write twice),
- when the Shira view becomes visible again, and when workspace folders change.

The first scan happens when the Shira view is opened (or at the first file event after the extension activated). A change of a `.js` file's content does not trigger a scan.

## The rules (11)

| # | Where | Severity | Exact message | When |
|---|---|---|---|---|
| 1 | a folder inside `src/flows` | Warning | `Directories are not allowed in src/flows — only top-level *.flow files.` | `src/flows` must be flat |
| 2 | a file in `src/flows` | Warning | `File does not belong to the project structure (expected *.flow).` | any file not ending in `.flow` |
| 3 | a `.flow` in `src/flows` | **Error** | `.flow file names must be PascalCase, starting with a capital letter (e.g. Project.flow).` | name ≠ `^[A-Z][A-Za-z0-9]*$` |
| 4 | a file anywhere under `src/scripts` | Warning | `File does not belong to the project structure (expected *.js).` | any file not ending in `.js` (a `.md`, a `.json`, `.DS_Store`) |
| 5 | a `.js` anywhere under `src/scripts` | **Error** | `Script file names must start with a letter and contain only letters and numbers (e.g. myScript.js).` | name ≠ `^[A-Za-z][A-Za-z0-9]*$` (`my-script.js`, `doc_store.js`, `script copy.js`) |
| 6 | `src/flows` | **Error** | `The flows directory must contain at least one [FILE_NAME].flow file for the project to be valid.` | no `.flow` file directly in `src/flows` |
| 7 | a `.flow` | **Error** | `Summary output must connect to exactly one Summarizer node.` | an LLM node's Summary output has edges, and they are not exactly one edge to a Summarizer node |
| 8 | a `.flow` | **Error** | `A Summarizer node needs a model.` | a Summarizer reached by a Summary output or by another Summarizer's Fallback has no `settings.llm.company` + `settings.llm.model` |
| 9 | a `.flow` | **Error** | `A Summarizer node's In takes only a Summary output or a Summarizer's Fallback.` | any other edge enters a Summarizer |
| 10 | a `.flow` | **Error** | `A Summarizer node's Fallback connects only to a Summarizer node.` | a Summarizer's Fallback has more than one edge, or one to another node type |
| 11 | a `.flow` | **Error** | `Summarizer Fallbacks must not form a loop.` | following Summarizer Fallbacks comes back to the start (a self-loop too) |

Rules 7–11 run on every top-level `.flow` in `src/flows` and use the deploy service's own words (the Summarizer:
`../Flow/Nodes/Summarizer/`). A `.flow` that is not valid JSON is **skipped silently** by them — no entry at all.

Two more name checks show up as **toasts**, not Problems entries: creating or renaming a `.flow` in `src/flows` / a
`.js` in `src/scripts` with a bad name shows `<file> — Flow names must be PascalCase — start with a capital letter,
letters and numbers only (e.g. MyFlow).` / `<file> — Script names must start with a letter and contain only letters and
numbers (e.g. myScript).`

## How it relates to `keen-validate`

`keen-validate` (`../MCP/validator.md`) is the check you run; Shira's scan is what the person sees. They overlap only
in part. **Run `keen-validate` before every deploy, and keep Shira's Problems panel empty too** — each catches things
the other does not.

| Shira rule | keen-validate | The deploy |
|---|---|---|
| 1 folder in `src/flows` | **error** (Shira only warns) | refuses: `` `flows` must be a single level (no subfolders) `` |
| 2 stray file in `src/flows` | **error** (Shira only warns) | refuses: `` `flows` must contain only .js files `` |
| 3 `.flow` name not PascalCase | error, same pattern; **also warns on digits** (a flow with digits cannot be a Run / Jump / Flow Pointer / Parallel Context target) | does not check names |
| 4 non-`.js` file in `src/scripts` | not checked | accepted and **uploaded** |
| 5 script file name | **not checked** | not checked |
| 6 no `.flow` | error | refuses: `flows/ contains no .flow files` |
| 7–11 Summary / Summarizer | errors, same words; plus warnings (an unreached Summarizer, an LLM node with "Interact with DB" off, a reasoning model on a Summarizer) | refuses with the same words, prefixed `flows/<F>: <nodeId> — ` |

**Only keen-validate catches** (Shira says nothing, the panel stays `— detected`): a `.flow` that is not valid JSON or
not `{ nodes, edges }`; a node id used twice (in one file or across flows — the deploy refuses it); every node's own
settings; Run / Jump / Flow Pointer / Parallel Context / flow-tool targets that resolve to no Start; a Script node's
file that does not exist; `keen-tools.json` shape, names and entries; the script lint (forbidden imports and globals the
deploy's security scan refuses, `exec` exported); `.vscode/keen.json` not git-ignored.

**Only Shira catches**: script file names (rule 5), non-`.js` files under `src/scripts` (rule 4), and the five project
markers (a missing `package.json` or `.vscode/keen.json` means "not a project" — keen-validate does not require them,
and only warns when `src/scripts` is missing).

## What the person does

Opens **View → Problems** (or reads the red lines in the Shira panel), fixes or tells you the messages. An entry goes
away by itself on the next scan.

## What you (the builder) can do yourself

- You cannot read the person's Problems panel; you can predict it. After writing files, check them against the
  table: bad script names (`get-order.js`, `shop_api.js`), a README or JSON file inside `src/scripts`, anything but
  `.flow` files in `src/flows`, the Summary wiring.
- Run `keen-validate <project>`; it covers rules 1–3, 6–11 and much more.
- Keep notes and docs for a service outside `src/` (`.claude/skills/<service>-service/SKILL.md`,
  `../ProjectStructure/SKILL.md`) — inside `src/scripts` they are warnings and they get uploaded.

## Mistakes that break it

| Mistake | What happens | Do instead |
|---|---|---|
| A file `src/scripts/services/docStore/doc-store-utils.js` (folder names are not checked, file names are) | Error 5 → `— invalid`, Connect off | `utils.js`, `docStoreUtils.js` |
| `src/flows/Assistant.flow.bak` or `src/flows/notes.md` | Warning only in Shira, but the deploy refuses the whole project | keep only `.flow` files in `src/flows` |
| Trusting "no Problems" as "deployable" | A broken JSON flow or a duplicate node id passes Shira and fails the deploy | `keen-validate` first |
| A `.flow` hand-edited with a syntax error | No Problems entry; the canvas cannot show it as it is | validate the JSON; `keen-validate` names the line |

## Example

The person sends: "✕ Script file names must start with a letter and contain only letters and numbers (e.g. myScript.js)."
You find `src/scripts/tools/shop-api-search.js`, rename it to `shopApiSearchTool.js`, update its entry in
`src/keen-tools.json` and every import of it, run `keen-validate`, and tell the person the panel should show
`— detected` again.
