# `src/keen-tools.json`

## Description

The agent project's **tool registry**: the list of tools an LLM node may call, and how each one runs — a script
under `src/scripts/tools/`, or a whole flow from one of its Start nodes.

It is a registry only. **The model never sees this file.** There is no description, parameter list or schema
here: the model learns a tool's name, purpose and input only from the LLM node's **system prompt**, which you
write (the call format and one entry per tool — see
`../../Flow/Nodes/LLM/references/tool-calling.md`).

Who reads it:

- **keen-validate** checks every entry against the project's scripts and flow entries.
- **keen-deploy** uploads it.
- **The deploy service** copies its `tools` array, unchanged and unchecked, into the compiled project, then
  removes the file. The deployed project has no `keen-tools.json`.
- **The llms-engine** reads that copy when an LLM node writes a `<SYSTEM CALL>`: it finds the tool by `name` and
  starts it by `type` and `entry`. Every change needs a new deploy.
- **The script-engine** re-checks a script tool's path before it runs it.

## Location and name

- Exactly `src/keen-tools.json`. One file per project.
- Optional: without it keen-validate warns `missing src/keen-tools.json (fine if the project declares no tools)`
  and the agent has no tools. A new project starts with `{ "tools": [] }`.
- A `keen-tools.json` at the project root (not in `src/`) is the VS Code-extension layout: keen-validate warns
  and stops checking flows, and keen-deploy does not upload it.

## Structure

The file:

| Property | Required | What it means and what it is for |
|---|---|---|
| `tools` | yes | an array, one object per tool. Any other top-level key is ignored and not deployed |

A tool:

| Property | Required | What it means and what it is for |
|---|---|---|
| `name` | yes | the tool's name. The model must write it **exactly** after `!*tool` (case-sensitive; the engine trims the model's text, not yours). Unique in the file. Use the same words in the system prompt |
| `type` | yes | `"script"` or `"flow"` — decides how the tool runs. `!*action` in the call decides nothing |
| `entry` | yes | for `"script"`: the script's path **relative to `src/scripts/`**, starting with `tools/`, no `..` (`tools/webSearchTool.js`, `tools/billing/chargeTool.js`). For `"flow"`: an entry name `File-Label` (`Escalate-Start`) = a flow file name and a Start node's label |

There are no other fields. `description`, `parameters`, `schema`, `attempts` or anything else you add is not
checked, not shown to the model and not used by the engine; the whole object only travels to the running tool as
`toolOptions.toolContext.projectTool`. Write descriptions in the system prompt instead.

How the model sees it: not at all. When its answer holds a `<SYSTEM CALL>` block, the engine takes the `!*tool`
value, finds the **first** tool whose `name` equals it, and runs it on the calling agent's dictionary; a script
tool's `exec` gets no `props` (an empty object) and reads the call from `toolOptions`
(`tools/name-tool.md`). The result reaches the model only as the user message the tool files.

## Rules and validation

keen-validate (errors):

- `invalid JSON: <parser message>`
- `expected { "tools": [ … ] }` — `tools` missing or not an array
- `tool has no string name` · `duplicate tool name "<name>"`
- `tool.type must be "script" or "flow" (got <value>)`
- `tool.entry is missing`
- `script tool entry "<entry>" must start with "tools/"` · `script tool entry "<entry>" must not contain ".."`
- `script tool entry "<entry>" not found under src/scripts/`
- `flow tool entry "<entry>" must be a File-Label (/^[A-Z][a-zA-Z]*-[A-Z][a-zA-Z]*$/)`
- `flow tool entry "<entry>" does not resolve to any flow's Start`

It also lints each registered script as a **tool** (its reply to the agent, `toolOptions`) — see
`scripts/tools/name-tool.md`.

The deploy service refuses invalid JSON (`keen-tools.json: invalid JSON — <parser message>`) and a wrong shape: `keen-tools.json: "tools" must be a list of tool objects` (an absent `tools` still means no tools). The
fields of each entry (name, type, entry) are checked only by keen-validate — a wrong `entry` deploys as written.

The llms-engine, at call time (no tool runs; the message below becomes the next user turn and the same LLM node
runs again):

- the block has no `!*key` field → `Could not parse the SYSTEM CALL block.`
- no tool has that `name` → `The requested tool does not exist.`
- a script tool whose `entry` does not start with `tools/` or contains `..` → `No tool response`
- a flow tool whose `entry` matches no Start node → `No tool response`

The script-engine refuses a script-tool path outside `tools/` again, with the Log Record line
`virtualScriptNode rejected — tool path must live under "scripts/tools/" (got "<path>")`. A script tool whose
file is missing fails with `Script "tools/x.js" failed: File not found: …` in the Log Record; the agent reads
`No tool response`.

## Limits

- No limit on the number of tools or the length of a name.
- The engine sets no limit on the number of tool rounds in one answer; say in the prompt when to stop.
- Only the first `<SYSTEM CALL>` block of an answer runs.

## Mistakes that break it

| Mistake | What happens | Write instead |
|---|---|---|
| `[ { … } ]` (an array at the top) | keen-validate error; the deploy refuses it (`"tools" must be a list of tool objects`) | `{ "tools": [ { … } ] }` |
| `"entry": "scripts/tools/webSearchTool.js"` or `"webSearchTool.js"` | keen-validate error; at run time `No tool response` | `"tools/webSearchTool.js"` |
| `"entry": "tools/webSearchTool"` | file not found | the exact path with `.js` |
| `"entry": "Escalate"` for a flow | not a `File-Label` | `"Escalate-Start"` |
| a flow tool into `Report2.flow` | keen-validate refuses a digit in a `File-Label` | a letters-only file name |
| `"name": "web search"` while the prompt says `Web Search` | `The requested tool does not exist.` | one spelling in both places |
| `"description"` / `"parameters"` here, nothing in the prompt | the model does not know the tool or its input | describe the tool in the system prompt |
| two entries with the same `name` | keen-validate error; at run time the first one wins | unique names |
| changed the file, did not deploy | the engine still uses the old registry | `keen-validate` → `keen-deploy` |

## Example

```json
{
  "tools": [
    { "name": "Web Search", "type": "script", "entry": "tools/webSearchTool.js" },
    { "name": "Document Search", "type": "script", "entry": "tools/docStoreSearchTool.js" },
    { "name": "Document Read", "type": "script", "entry": "tools/docStoreReadTool.js" },
    { "name": "Escalate", "type": "flow", "entry": "Escalate-Start" }
  ]
}
```

`tools/webSearchTool.js`, `tools/docStoreSearchTool.js` and `tools/docStoreReadTool.js` live in `src/scripts/tools/`
(one tool per service instrument); `Escalate-Start` is a Start
node labelled `Start` in `src/flows/Escalate.flow`. The LLM node's system prompt lists the same four names.
