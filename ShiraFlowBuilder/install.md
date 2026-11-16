# Installing Shira Flow Builder

> **Keen 15.3 · Shira Flow Builder 0.0.6.**

## What it is

**Shira Flow Builder** (extension id `keen.shira-flow-builder-vs`, publisher `keen`) is the VS Code extension a person
uses to draw a Keen agent's flows, deploy the project to a space and debug it. It is a shell around four things:

| Part | Where the person sees it | File here |
|---|---|---|
| The **Shira Flow Builder** view in the activity bar (the shiba-inu icon): project status, **Create Project**, **Connect**, **Upload Project** | left sidebar | `panel.md`, `project.md`, `upload.md` |
| The **Breakpoints** view under the same icon | left sidebar | `panel.md`, `debugging.md` |
| The `.flow` **canvas** — a custom editor that opens every `*.flow` file | editor tabs | `canvas.md`, `canvas-nodes.md` |
| Two debuggers — **Start Flow Debugger** (debug type `keen-flow`) and **Start Script Debugger** (VS Code's built-in JavaScript debugger, type `node`) | editor title bar | `debugging.md` |

It also writes its own checks to the **Problems** panel (`problems.md`), a **Connected / Not connected** item in the
status bar, short "File … was saved" notices, and an output channel named **Flow Builder**.

The canvas is bundled inside the `.vsix` (`media/builder/`): nothing else runs on the person's machine — no dev
server, no Node.js install, no npm. The extension's own runtime dependencies (`ws`, `jszip`) are inside the `.vsix` too.

## What the person does

1. **Get the file.** The organisation console's Home page, card **Get started → Shira Flow Builder**, button
   **Download Ext** (hint: "Download the Shira Flow Builder extension"; the card says "Use version 0.0.6 or newer —
   the two-step sign-in and the debuggers need it."). The file is `shira-flow-builder-vs-0.0.6.vsix`.
2. **Check VS Code.** The extension requires VS Code **1.90.0 or newer** (`engines.vscode` `^1.90.0`). **Help →
   About** shows the version.
3. **Install it.** In VS Code: Extensions view → the **⋯** menu at the top → **Install from VSIX…** → pick the file.
   (From a terminal the same is `code --install-extension shira-flow-builder-vs-0.0.6.vsix`.)
4. **Open the project folder** (**File → Open Folder…**). The extension works on the **first** folder of the window
   only — open the project itself, not a parent folder and not a multi-root workspace with the project second.
5. Click the **Shira Flow Builder** icon in the activity bar.

## What appears after install

- Activity bar: the **Shira Flow Builder** icon with two views — **Shira Flow Builder** and **Breakpoints**.
  The icon carries a number badge when the project has errors or warnings (tooltip e.g. `Flow Builder: 1 error, 2 warnings`).
- Status bar (bottom left, only while a folder is open): `Not connected` / `Connected`; a click opens the view.
- Every `*.flow` file opens in the canvas by default (custom editor "Shira Flow Builder"); the file type is
  registered as the language **Keen Flow** (`keen-flow`) for the moments it is opened as text.
- Settings: **Shira Flow Builder** section with `flowBuilder.theme` and `flowBuilder.aiModels` (`panel.md`).
- Commands, all under the category **Shira Flow Builder** in the Command Palette: Create Flow, Create Script,
  Toggle Theme, Start Flow Debugger, Start Script Debugger, Remove Breakpoint, Remove File Breakpoints,
  Remove All Breakpoints (`panel.md`).
- Output: **View → Output → Flow Builder** — the upload's file list and refusals, the debuggers' sign-in steps.

The extension activates on first use (opening its view, opening a `.flow`, or running one of its commands); its
Problems entries appear when the view is first opened, or at the next file change after activation (`problems.md`).

## Updating to a newer .vsix

Install the newer file the same way (**Install from VSIX…**) over the old one, then reload the window when VS Code
asks (**Developer: Reload Window**). What survives and what does not:

| Kept | Lost |
|---|---|
| Flow breakpoints and each flow's canvas view (palette, zoom) — stored per workspace by the extension | The deploy connection (it lives in memory only): press **Connect** again |
| The settings `flowBuilder.theme` / `flowBuilder.aiModels` | A running debug session |

An extension older than 0.0.6 cannot answer the two-step sign-in code, so it cannot debug for an account that has
two-step sign-in (and debugging needs it — `debugging.md`).

## What you (the builder) can do yourself

- Tell the person exactly the steps above; you cannot install an extension into their VS Code.
- Check what they run: ask them for **Extensions → Shira Flow Builder** — the version shown under the name.
- Everything the extension does to the project on disk you can also do by hand (`project.md`), and its deploy has a
  command-line twin, `keen-deploy` (`../MCP/uploader.md`). The debuggers have no MCP path: they are the person's.

## What it needs on the platform side

| For | Needed |
|---|---|
| Drawing flows | Nothing — the canvas works offline |
| **Connect / Upload Project** | A Keen instance whose deploy service answers at `https://<instance>/ms/deploy/v1/project/…`, a space, and that space's **Deployment Token** (console → AI → Spaces → the space; `../Administration/AI/Spaces/spaces-skill.md`) |
| **The debuggers** | A sandbox instance with the flow and script debug services; the console's debugger switched on by the owner or an admin; the person's own console account with the **Debugger** permission and two-step sign-in; the project deployed. Details: `debugging.md`, `../Administration/System/Debugger/debugger-skill.md` |

## Mistakes that break it

| Mistake | What happens | Do instead |
|---|---|---|
| VS Code older than 1.90 | The `.vsix` refuses to install | Update VS Code |
| A parent folder (or a multi-root workspace) opened | The panel says `This folder is not a Shira Flow Builder project.`; Connect stays off | Open the project folder itself |
| An older `.vsix` (before 0.0.6) on an account with two-step sign-in | The debuggers cannot sign in | Install 0.0.6 |
| Expecting the connection to survive a reload / update | Saves stay local; `Not connected` in the status bar | **Connect** again after every reload |

## Example

The person: "I installed Shira but I see no buttons."
You: "Open the folder of your agent project with **File → Open Folder…** (the folder that holds `src/` and
`package.json`), then click the **Shira Flow Builder** icon in the left bar. The top line should read
**Shira Flow Builder — detected**. If it says `This folder is not a Shira Flow Builder project.`, tell me what the
folder contains."
