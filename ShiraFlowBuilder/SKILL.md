---
name: shira-flow-builder
description: Keen 15.3 — Shira Flow Builder 0.0.7, the VS Code extension a person uses to draw a Keen agent's flows, deploy the project and debug it — installing the .vsix, Create Project / Connect / Upload Project and auto-sync, `.vscode/keen.json` field by field, the sidebar panel, the Breakpoints view, the commands and settings, the extension's checks in the Problems panel, the `.flow` canvas (palette, handles, what may connect to what, every node's form and the .flow property each field sets, what the canvas reads and writes, what a hand-written .flow needs to open cleanly), and the Flow Debugger and Script Debugger with their sign-in and two-step code. Use this skill whenever the person works in VS Code with Shira, opens or edits a .flow on the canvas, presses Connect or Upload, sets a breakpoint, starts a debugger, sees a Shira message or a Problems-panel line, or asks "how do I draw / connect / debug / deploy in VS Code" — and before you rewrite a .flow file the person may have open.
---

# Shira Flow Builder

> **Keen 15.3 · Shira Flow Builder 0.0.7.** This skill describes the extension's version 0.0.7 (the latest; the console
> offers it) on Keen 15.3. A later version gets an additions-only skill; read this one first.

Shira Flow Builder is the person's side of building an agent: the canvas they draw flows on, the panel that deploys
the project, and the two debuggers. You write the same project files by hand (`../Flow/Nodes/SKILL.md`,
`../ProjectStructure/SKILL.md`) and deploy with `keen-deploy` (`../MCP/uploader.md`); this skill tells you what the
person sees and does in VS Code, the exact words on screen, and where your work and theirs touch. Read the file for
the area before you act or advise.

## The map

| Area | What it covers | File |
|---|---|---|
| Install | what the extension is, the `.vsix` from the console, VS Code ≥ 1.90, updating, what it needs on the platform | [`install.md`](install.md) |
| Project | when a folder is a project, **Create Project**, `.vscode/keen.json` field by field, **Connect**, **Create Flow** / **Create Script** | [`project.md`](project.md) |
| Panel | the sidebar view line by line, the **Breakpoints** view, every command and where it appears, the two settings, what the extension stores outside the project | [`panel.md`](panel.md) |
| Problems | the extension's 15 checks in the Problems panel (four of them the deploy's own refusals, in its words), and what only `keen-validate` catches | [`problems.md`](problems.md) |
| Upload | **Connect**, **Upload Project**, auto-sync and its hold while the project has errors, the deployment token, what is packed (keen-deploy's rule), every message, how it differs from `keen-deploy` | [`upload.md`](upload.md) |
| Debugging | **Start Flow Debugger** / **Start Script Debugger**, every prerequisite, the sign-in and two-step code on every attach, where it connects, how a session ends, every message and its fix | [`debugging.md`](debugging.md) |
| Canvas | opening a flow, the palette, connecting, a node's form, undo, what the canvas writes into the file, what a hand-written `.flow` needs, breakpoints on the canvas, theme | [`canvas.md`](canvas.md) |
| Canvas, node by node | all 15 nodes: palette name, handles and what each may connect to, every form field and the `.flow` property it sets, canvas-only behaviour, the built-in model list | [`canvas-nodes.md`](canvas-nodes.md) |

## Rules for you

- **Never ask for the deployment token or the console password in the chat**, never write them into
  `.vscode/keen.json` yourself, never print that file. Write `server` and `space`, leave the secrets as placeholders,
  and tell the person to type them into the file. The file stays git-ignored.
- **Your writes may deploy.** While the person's Shira is connected, every file you save in `src/flows/`,
  `src/scripts/` or `src/keen-tools.json` is uploaded about 800 ms later — a half-finished one too, unless it makes the
  Problems panel show an error (then auto-sync holds: `upload.md`). Not every broken file is a Problems error. Before a
  multi-file change, ask the person to press **Disconnect** (it is always enabled while connected) or confirm they are
  not connected; deploy once with `keen-deploy` when `keen-validate` passes.
- **Keep `src/` clean.** Shira sends only what the platform builds — `flows/`, `scripts/`, `keen-tools.json`, never a
  dot-file, `node_modules` or a `.zip` — but a stray file inside `flows/` or `scripts/` (notes, a JSON) is still sent.
  Secrets belong in the console's Secrets cards, never in the project; a `.env` under `src/` is not uploaded, but it
  does not belong there.
- **Before you rewrite a `.flow` the person has open**, ask them to save it first. The canvas reloads the file and every
  open node form shows your values, but unsaved canvas changes and your write collide in VS Code's document. Never
  rewrite a file with unsaved canvas changes.
- **Name the screen exactly** — the button, the title-bar icon, the input box — in the extension's own words.

## Facts that are easy to get wrong

1. **The canvas checks only a file's shape when it opens it.** Invalid JSON, a node without `id` / `type` / `position` /
   `data`, an edge without `id` / `source` / `target`, or a node id used twice opens as an error screen ("This .flow
   file cannot be opened on the canvas") listing every reason, and nothing is written; empty text opens as a new, empty
   flow. Past the shape it checks nothing: an edge it cannot draw stays in the file unseen, and a value its form would
   refuse stays until someone opens that form. `keen-validate` is the check — run it on every file you write.
2. **On its first change the canvas keeps only `nodes` and `edges`** at the top, and only `id`, `type`, `position`,
   `data` (and `dragHandle`) on a node. Everything inside `data` survives.
3. **`flowBuilder.aiModels` does not reach the canvas.** It feeds only the panel's **Models** chip; the LLM and
   Summarizer menus use the canvas's built-in list, which is the platform's own 24 models (`canvas-nodes.md`). A fresh
   LLM or Summarizer has no `settings.llm` until a person saves a model; its menu says "No model saved yet".
4. **Breakpoints are kept by node id**, per flow name, in the workspace — not in the file. A node you give a new id
   loses its breakpoint.
5. **Every debugger refusal now says its real reason.** An account without two-step sign-in gets `The debugger needs
   two-step sign-in on your account — set it up in the console (My Account › Security).`; `Your role has no Debugger
   permission — …` means exactly that. 0.0.6 showed the no-permission line for both — on 0.0.6, check MFA first.
6. **Create Project keeps a filled-in `.vscode/keen.json`** (a folder that has only `.vscode` counts as empty) and
   writes only the missing files; 0.0.6 overwrote it with placeholders. On 0.0.6, never let the person press it on a
   project you set up.

## Related skills

- The nodes and the `.flow` file at run time: `../Flow/Nodes/SKILL.md`. The project's files: `../ProjectStructure/SKILL.md`.
- `keen-validate`, `keen-deploy`, the flow runner: `../MCP/SKILL.md`.
- The console's Debugger page (the switch, Kill and resume, the right): `../Administration/System/Debugger/debugger-skill.md`.
- Two-step sign-in: `../Administration/references/sign-in-and-mfa.md`.
