# `src/flows/`

## Description

The folder that holds the agent's **flows**: one `.flow` file per flow. Every run of the agent starts in one of
these files, and every Run Flow, Jump Flow, Flow Pointer, Parallel Context and flow tool points into one of them.

Who reads it:

- **keen-validate** checks the folder's layout, every file name, and every flow inside (`project-flow.md`).
- **keen-deploy** refuses to upload a project that has no `flows/` folder, and uploads only this folder,
  `scripts/` and `keen-tools.json`.
- **The deploy service** compiles each `.flow` file into the form the engines run, then checks the folder's
  layout again. A layout problem rejects the **whole** deploy; the live project stays as it was.
- **The engines** load every compiled flow of the project together, so any flow can reach any other by name.

## Location and name

- Path: `src/flows/` under the project root (the folder `keen-validate` and `keen-deploy` are pointed at).
- Required, exactly one. It must hold **at least one** `.flow` file. There is no upper limit on the number of
  flows.
- File name: `<Name>.flow`. Use **PascalCase, letters only**: a capital letter first, then letters
  (`Orders.flow`, `RefundDesk.flow`).
  - keen-validate accepts `^[A-Z][A-Za-z0-9]*$` and only **warns** about digits. A digit is still a trap: every
    `File-Label` target (Run Flow, Jump Flow, Flow Pointer, Parallel Context, a flow tool) is letters only, so a
    flow named `Report2.flow` can never be called by another flow or used as a tool.
- The file name **is** the agent's **Start Flow**. In the console an agent names its entry with two fields:
  **Start Flow** = a file name without `.flow`, **Start Node** = a Start node's label in that file. The console
  takes a Start Flow of **3–60** characters, a capital first, letters and digits only. Take both values from the
  person or the agent's record; never invent them.
- A new project usually has one flow, `Project.flow`. Split the agent into several files when parts are reused
  or call each other — each file is one flow.

## Structure

What goes in:

| Item | Allowed | Notes |
|---|---|---|
| `<Name>.flow` files | yes, one or more | the flows; format in `project-flow.md` |
| subfolders | **no** | the folder is a single level |
| any other file (`.json`, `.js`, `.md`, `Orders.flow.json`, a backup) | **no** | only `.flow` files |
| dot-files (`.DS_Store`) | avoid | keen-deploy and Shira 0.0.7 never upload them, but keen-validate reports them as stray files |

One file may hold **several Start nodes**: each is its own entry, `<FileName>-<StartLabel>` (`Orders-Start`,
`Orders-Refund`). The entry names of the whole project are listed at the end of every keen-validate report
(`entries (File-Labels) found: …`).

## Rules and validation

keen-validate (all errors, exit 1):

- no folder → `missing src/flows directory`
- a subfolder → `subfolder "<name>" — flows/ must be a single level; the deploy structure gate rejects it ("flows must be a single level (no subfolders)")`
- any non-`.flow` file → `stray file "<name>" — only .flow files may live in src/flows; it survives the build and the deploy is rejected ("flows must contain only .js files")`
- no `.flow` file → `no .flow files — the deploy build rejects the project ("flows/ contains no .flow files")`
- a bad name → `flow file name "<base>" must be PascalCase (/^[A-Z][A-Za-z0-9]*$/)`
- digits in a name (warning) → `flow file name "<base>" has digits — it can be an agent's start flow, but no Run / Jump / Flow Pointer / Parallel Context node or flow tool can target it …`
- `.flow.json` files or a `keen-tools.json` at the project root → one warning that this is the VS Code-extension
  layout; then the flows are **not** checked at all.

keen-deploy: no `flows/` → `no flows/ in <dir> — --project / KEEN_PROJECT_DIR must be the flow project ROOT (the folder that holds src/flows)`
(exit 2, nothing sent).

The deploy service (reply `invalid-structure`, `Project rejected — invalid structure (<n> problem(s))`):

- `flows/ contains no .flow files`
- `` `flows` must be a single level (no subfolders) ``
- `` `flows` must contain only .js files `` — a stray file survives the compile step and lands here
- a file that is not valid JSON → `flows/<file>: invalid JSON — <parser message>`

The deploy service does **not** check file names; keen-validate, the console and the VS Code extension do. The
extension reports a non-PascalCase name as an error (`.flow file names must be PascalCase, starting with a capital
letter (e.g. Project.flow).`) and a subfolder or a non-`.flow` file only as a warning — keen-validate and the deploy
treat both as errors.

House standard (not checked by any tool yet): one flow per job, named for what it does (`Orders`, `Escalate`);
the agent's main flow keeps the name the agent's record uses.

## Limits

- Flows: no count limit. The uploaded bundle (all of `flows/`, `scripts/`, `keen-tools.json`, zipped) is at most
  **50 MB** (the platform's setting; larger uploads are refused).
- Start Flow name as the agent's entry: 3–60 characters. Start Node (the label): 3–60 characters in the console,
  at most 60 in keen-validate.
- Node ids must be unique across the whole project (all flows together): the deploy refuses a repeat, and Shira's
  Problems panel shows it on both files first (`flows/<A>.flow: <id> — the node id is used again in flows/<B>.flow`,
  `../../../ShiraFlowBuilder/problems.md`).
- Entry names must be unique across the project: `Orders-Start` in two files is impossible (the file name differs),
  but two Start nodes with the same label in **one** file register one entry — the later node wins.

## Mistakes that break it

| Mistake | What happens | Write instead |
|---|---|---|
| `src/flows/support/Orders.flow` | keen-validate error; the deploy is rejected | `src/flows/Orders.flow` |
| `src/flows/notes.md` or `Orders.flow.bak` next to the flows | keen-validate error; the deploy is rejected (`flows must contain only .js files`) | keep notes outside `src/flows/` (or in a Note node) |
| `orders.flow`, `order-desk.flow` | keen-validate error; no node can target it | `Orders.flow`, `OrderDesk.flow` |
| `Report2.flow` | can be the agent's Start Flow, but nothing can call it | `ReportTwo.flow` |
| the agent's Start Flow `Main` while the file is `Project.flow` | deploys, then the run stops with `E2201 Agent project error` | match the file name to the agent's record |
| `Orders.flow.json` (extension format) | keen-validate warns and skips every flow; the deploy is rejected | `.flow` files with `{ nodes, edges }` |

## Example

```
src/
    flows/
        Project.flow      ← the agent's Start Flow; Start node "Start" → entry Project-Start
        Orders.flow       ← Start nodes "Start" and "Refund" → Orders-Start, Orders-Refund
        Escalate.flow     ← a flow tool: keen-tools.json entry "Escalate-Start"
    scripts/
    keen-tools.json
```
