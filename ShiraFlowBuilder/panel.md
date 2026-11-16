# The Shira panel, the Breakpoints view, the commands and the settings

> **Keen 15.3 · Shira Flow Builder 0.0.7.**

## 1. The Shira Flow Builder view

### What it is
The webview under the **Shira Flow Builder** icon in the activity bar. It shows the project's state and holds the
three action buttons. Its colours follow VS Code's theme (not `flowBuilder.theme`).

### What the person sees, top to bottom

1. **Title** `Shira Flow Builder` + the status: `— detected` (green), `— invalid` (red), or one of
   `Open a folder to create or load a project.` · `Empty folder — create a project below.` ·
   `This folder is not a Shira Flow Builder project.` (the conditions: `project.md` §1).
2. **Settings** — two read-only chips:
   - **Theme**: `dark` or `light` — the canvas theme (`flowBuilder.theme`).
   - **Models**: `<N> model(s)` / `none` (the setting is empty) / `invalid JSON` (it cannot be read — section 4)
     — counts the entries of `flowBuilder.aiModels`.
3. **Errors** — one red line per error, `✕ <message>` (the file is named only when the message itself names it, as the
   deploy's refusals do — `flows/<file>: …`; the Problems panel always names it).
4. **Warnings** — `⚠ Structure warnings:` and one line per warning, `<file> — <message>`.
5. Three buttons, each with a line of text above it:

| Button | Text above it | Enabled when | Click |
|---|---|---|---|
| **Create Project** | "Scaffolds a new project skeleton (flows, scripts, keen.json) into the current folder. Available only when the folder is empty." | a folder is open and empty | writes the skeleton (`project.md` §2) |
| **Connect** / **Disconnect** | "Connects to the deploy target defined in `.vscode/keen.json`. Available once a valid project is detected." | **Connect**: the project is `— detected` (no errors). **Disconnect**: always, while connected | Connect → a deploy session; while connected the same button reads **Disconnect** (`upload.md`) |
| **Upload Project** | "Deploys the entire project to the connected target. Requires an active connection." | `— detected` **and** connected | uploads what the platform builds — `src/flows/`, `src/scripts/`, `src/keen-tools.json` (`upload.md`) |

The activity-bar icon carries a badge with the number of errors + warnings (tooltip
`Flow Builder: <n> error(s), <n> warning(s)`), gone when the project is clean.

**Title-bar icon of the view:** **Toggle Theme** (the colour-mode icon) — flips `flowBuilder.theme` between `dark` and
`light` in the person's **user** settings; open canvases switch at once.

**Status bar** (bottom left, only while a folder is open): `Not connected` (tooltip "Shira Flow Builder — not
connected (open the Shira view to connect)") or `Connected` (tooltip "Shira Flow Builder — connected to <server>").
A click opens the view. When an auto-sync succeeds the status bar shows `Project synced` for 2 s; when it is held by an
error, `Auto-sync paused: the project has errors (see Problems) — nothing is uploaded until they are fixed.` for 5 s,
once (`upload.md`).

### When the view refreshes
On any file created or deleted in the workspace, on a change of a `.flow`, a `.js` or `keen-tools.json` (300 ms after
the last write), when the view becomes visible again, and when the workspace folders change (`problems.md`).

## 2. The Breakpoints view

### What it is
The second view under the Shira icon: the **flow** breakpoints (F9 on canvas nodes), one group per `.flow` file
(named by its base name, e.g. `Project`), one leaf per node. Script breakpoints (in `.js` files) are ordinary VS Code
breakpoints and appear in VS Code's own **Run and Debug → Breakpoints**, not here.

### What the person sees and does

- Empty: `No breakpoints set.` / `Press F9 on a node in a .flow file to add one.`
- A leaf: the node's name (or its id when it has none), with 6 characters of its id after it; tooltip
  `<file> · <node id>`. **Click a leaf** → the flow opens in the canvas with that node centred.
- Title bar: **Remove All Breakpoints** (the clear-all icon).
- Inline on a file group: **Remove File Breakpoints** (trash icon). Inline on a leaf: **Remove Breakpoint** (×).
- Breakpoints are added and removed on the canvas with **F9** on the selected node(s) (`debugging.md`).

## 3. Every command

All carry the category **Shira Flow Builder** in the Command Palette (e.g. `Shira Flow Builder: Create Flow`).

| Command | Where it appears besides the Palette | Does |
|---|---|---|
| **Toggle Theme** | title bar of the Shira Flow Builder view | dark ↔ light (user settings) |
| **Create Flow** | Explorer right-click on a folder named `flows` | `project.md` §5 |
| **Create Script** | Explorer right-click on `src/scripts` or a folder under it | `project.md` §5 |
| **Start Flow Debugger** | title bar of a `.flow` canvas tab (debug icon) | `debugging.md` |
| **Start Script Debugger** | title bar of a `.js` editor whose path contains a `scripts` folder (debug icon) | `debugging.md` |
| **Remove All Breakpoints** | Breakpoints view title bar | clears every flow breakpoint |
| **Remove File Breakpoints** | Breakpoints view, inline on a file | clears one file's |
| **Remove Breakpoint** | Breakpoints view, inline on a leaf | clears one |

The three Remove commands do nothing when run from the Palette (they need the item they were clicked on). The
**Create Project / Connect / Upload Project** buttons have no command — they exist only in the view.

## 4. The two settings

| Setting | Type, default | Effect |
|---|---|---|
| `flowBuilder.theme` | `"dark"` \| `"light"`, default `"dark"` | The canvas's colour theme and the panel's **Theme** chip. **Toggle Theme** writes it to the user settings. |
| `flowBuilder.aiModels` | a **string** (multi-line in the Settings UI) **or an array**, default `""` | Optional. Only **counted** on the panel's **Models** chip. Read as: a real array → its entries; a string holding a JSON array (e.g. a `models.json` paste) → its entries; any other text → a comma-separated list of model names (blank parts dropped); empty → `none`. Broken JSON, a JSON value that is not an array, or another type → `invalid JSON`. It never throws. |

**Fact to keep straight about `aiModels`:** it does **not** change the canvas. The LLM node's and the Summarizer's model
menus are the platform engine's own model list (24 models — `canvas-nodes.md`): the canvas saves a model's knobs by
their position in that list, so a local list must not feed it. The setting's description in the Settings UI says so
(0.0.6's description wrongly said it "drives the model selector").

Any of these in `settings.json` gives the chip `3 models`:

```json
{ "flowBuilder.aiModels": "gpt-5.5, claude-opus-4-7, gemini-3-flash-preview" }
{ "flowBuilder.aiModels": ["gpt-5.5", "claude-opus-4-7", "gemini-3-flash-preview"] }
{ "flowBuilder.aiModels": "[{\"id\":1},{\"id\":2},{\"id\":3}]" }
```

## 5. What the extension stores outside the project

Two stores in VS Code's **workspace state** (per machine, per opened workspace — not files, not in git, not shared
with anyone, not uploaded):

| Store | Holds | Keyed by |
|---|---|---|
| breakpoints (`kb_debugger`) | the flow breakpoints: node id + node name | the `.flow` file's **base name** (`Project`, not the path) |
| view settings (`kb_view_settings`) | per flow: palette open / closed, the canvas position and zoom | the same base name |

What that means for the person:

- Breakpoints and canvas positions are theirs alone; a colleague, another machine, or the same folder opened inside a
  different `.code-workspace` starts with none. You cannot set them by writing a file.
- A flow **renamed or deleted inside VS Code** keeps (or drops) its entries correctly. A flow renamed **outside VS Code**
  (git, a terminal, you writing files) loses its breakpoints and view the next time VS Code starts: at start the
  extension drops every group whose file no longer exists and every breakpoint whose node id is gone from the file.
- A node whose id changed (e.g. the duplicate-id regeneration after a copy) loses its breakpoint.

## What you (the builder) can do yourself

- Read the person's state from their words: ask what the status line says, which red `✕` lines they see, what the
  Models chip shows. You cannot see the panel.
- Write `flowBuilder.theme` / `flowBuilder.aiModels` into `.vscode/settings.json` if asked (no secrets there); it never
  changes the models the canvas offers.
- You cannot press the buttons or set flow breakpoints; you write files and run `keen-validate` / `keen-deploy`.

## Mistakes that break it

| Mistake | What happens | Do instead |
|---|---|---|
| `"flowBuilder.aiModels": { … }` (an object) or a number | the chip says `invalid JSON` | an array, a JSON array string or a comma list |
| Expecting `aiModels` to change the LLM node's model list | Nothing changes on the canvas | tell the person the list is the platform's own |
| Telling the person to look for flow breakpoints in VS Code's Run and Debug | They are not there | the **Breakpoints** view under the Shira icon |
| Renaming flows with `git mv` / by writing files | Their breakpoints vanish at the next start | rename in VS Code's Explorer, or let the person set them again |
| A project with errors while connected | auto-sync holds (`Auto-sync paused: …`, once); **Disconnect** stays enabled, **Upload Project** is off | fix the errors; the next change uploads |

## Example

The person: "The panel says `— invalid` and Connect is grey."
You: "Read me the red lines under **Settings** — each starts with ✕. Also open **View → Problems**: the same entries
are there with the file names." Then fix the files (`problems.md`) and ask again for the status line.
