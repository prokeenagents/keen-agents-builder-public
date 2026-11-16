# Start Flow (`startNode`)

## Description

The door into a flow. It does no work of its own: it has one output, and its **label** is the name that agents,
Run Flow, Jump Flow and the other flow-calling nodes use to enter the flow.

Use it when:

- every flow file needs at least one. Without a Start node the file registers no entry, so nothing can run or
  call it.
- the file has more than one way in (a full path and a shortcut): add one Start node per entry, each with its own
  label. Entries are named `<FileName>-<Label>`, so `Orders.flow` with a Start labelled `Refund` is `Orders-Refund`.

Use something else when:

- you want a place where several branches come back together: use a **Join Flow**. A Start has no input.
- you want to set values at the beginning: put an **Assignment** or a **Script** right after the Start. The
  Start itself writes nothing.

How a label is used:

- **An agent** enters through two fields on its record in the console: **Start Flow** = the file name,
  **Start Node** = the Start label. The platform joins them as `<Start Flow>-<Start Node>`. Take both from the
  person or the agent's record and make the flow match; keen-validate cannot see that record.
- **Other nodes** name an entry as a literal `File-Label` in their own settings (Run Flow, Jump Flow, Flow
  Pointer, Parallel Context). A flow tool in `keen-tools.json` does the same in its `entry`. Both parts of a
  `File-Label` are letters only, so a flow file with a digit in its name can be an agent's Start Flow but no node
  or tool can target it.
- An agent's Start Node and Start Flow must each be **3–60 characters** (the console refuses less). A 1-2 letter
  label such as `Go`, or a flow file such as `Qa.flow`, passes the validator but can never be the agent's entry.
- A missing entry is a project error: the run stops with **E2201 "Agent project error"**. keen-validate catches a
  literal node target that matches no Start in the project.

## In / Out

- **In:** none. A Start is where a run begins, so nothing can lead into it; an edge that points at a Start is
  rejected by keen-validate.
- **Out:** `next` (the canvas id; the deploy step turns it into the engine's `next_1`, so never write `next_1`).
  One output, and one edge from it: the canvas refuses a second edge from the same output (keen-validate does not
  check it; the engine would start every target). To do several things, chain them, or start several flows with a
  Parallel Flows.
- **Where it may lead:** any node whose `in` accepts it: End Flow, LLM, Condition, Loop (`in`), Assignment,
  Script, Run Flow, Jump Flow, Join Flow, Parallel Flows (`in`), Parallel Context. Exceptions: **not** a
  Summarizer (its In takes only an LLM's `summary` or another Summarizer's Fallback), **not** a Parallel Flows
  `wait` (only Flow Pointers), **not** a Flow Pointer, Note or another Start (they have no input). Target handle
  is `in`. A Condition, Assignment, Parallel Context or Loop `next_2` is single-in, so two paths cannot both
  enter it; put a Join Flow in front.
- **Left unwired:** the run starts and ends at the Start, and the agent does nothing. keen-validate warns about
  it.

## Fallback

No. A Start cannot fail, so it has no fallback output.

## Error

No. It has no `error` output; the engine only passes control on.

## Settings

| Field (JSON key) | Rule | What it is for |
|---|---|---|
| Label (`data.settings.label`) | required; one capital letter first, then letters only (`/^[A-Z][a-zA-Z]*$/`); ≤ 60 characters; no `${…}` | the entry name. This is the key the deploy step reads |
| (`data.settings.value`) | write the same text as `label` | the canvas writes both. A Start with only `value` gets a validator warning and registers **no entry** after deploy |
| Description (`data.description`) | optional, ≤ 250; no `${…}` | a note under the card; no effect on running |
| (`data.label`) | copy of the label | the card's title on the canvas; no effect on running |

The label is a plain name. `${dictionary…}` / `${session…}` do not work in it: the entry is fixed at deploy,
before any run exists.

## Rotate

Yes. It moves the output dot to another side of the card and stores the side in `data.handlePosition`: `top`,
`right`, `bottom` or `left`. For a Start the default is `bottom`, and the key is absent from the JSON until the
node is rotated. It is cosmetic: it changes where the dot is drawn, never the wiring.

## JSON structure

| Property | Required | What it means and what it is for |
|---|---|---|
| `id` | yes | `startNode_` + exactly 12 characters from `A-Z a-z 0-9`, unique in the project. The engine reads the node's kind from this prefix, and deploy only registers an entry for ids that start with `startNode_`. A body that is not 12 characters gets a validator warning |
| `type` | yes, fixed `"startNode"` | the node kind; it must agree with the id prefix (keen-validate errors if not). No `${…}` |
| `position.x`, `position.y` | yes (numbers) | where the card sits on the canvas. Use multiples of 16. Not read by the engine or deploy; missing or non-numeric gets a warning |
| `data.label` | yes, copy of the label | the card's title on the canvas. Not read by the engine or deploy (deploy reads `settings.label`). No `${…}` |
| `data.description` | no, ≤ 250 | a note under the card (the canvas form's cap). Not read by the engine or deploy. No `${…}` |
| `data.labelNode` | fixed `"Start Flow"` | the card's fixed title; keen-validate errors on any other text. Not read by the engine |
| `data.descriptionNode` | fixed `"Flow entry point"` | the card's fixed subtitle; same rule |
| `data.open` | no — leave it out | the canvas no longer reads or writes it (every panel opens closed; one already in a file is kept). Not read by the engine. |
| `data.handlePosition` | no | the side of the output dot; see Rotate. Absent until rotated; cosmetic |
| `data.settings.label` | yes | the entry name; see Settings. Read by deploy only. No `${…}` |
| `data.settings.value` | yes (same text as `label`) | see Settings. Not read by deploy and not read by the engine; the canvas writes it, and a Start with only `value` registers no entry. No `${…}` |
| (other `data.settings` keys) | none | a Start has no other settings |
| `dragHandle` | fixed `".drag-handle__custom"` | the grip the canvas drags the card by. Not read by the engine; any other value gets a warning |

## In the `.flow` file

The minimal correct node:

```json
{
  "id": "startNode_mK8HmeWTUjYN",
  "type": "startNode",
  "position": { "x": 208, "y": 176 },
  "data": {
    "label": "Start",
    "description": "Entry for a new customer message",
    "labelNode": "Start Flow",
    "descriptionNode": "Flow entry point",
    "open": false,
    "settings": { "value": "Start", "label": "Start" }
  },
  "dragHandle": ".drag-handle__custom"
}
```

Its edge to the first node (`id` = `xy-edge__` + source + `next` + `-` + target + `in`; `type` is always `"step"`):

```json
{ "id": "xy-edge__startNode_mK8HmeWTUjYNnext-agentNode_G7h8I9j0K1l2in", "type": "step",
  "source": "startNode_mK8HmeWTUjYN", "sourceHandle": "next",
  "target": "agentNode_G7h8I9j0K1l2", "targetHandle": "in" }
```

## How the engine runs it

1. A chat starts at the Start node that the entry `<Start Flow>-<Start Node>` names. A Run Flow, Jump Flow, Flow
   Pointer or Parallel Context starts at the Start named by its `File-Label` target.
2. Nothing is read from the node's settings at run time; the label only decided the entry name at deploy.
3. It writes nothing: the dictionary and session are not changed by it.
4. It continues to every node wired from `next`. With none wired, the run ends there.
5. Other Start nodes in the same file are not run; each matters only when something enters through its label.

## Mistakes that break it

| Mistake | What happens | Write instead |
|---|---|---|
| the agent's Start Flow / Start Node differ from the file name / label (case, a digit, a typo) | saves and deploys, then every chat fails with E2201 "Agent project error" | take both from the agent's record; use them exactly |
| Start with `settings.value` only | validator warning; after deploy the entry does not exist | `"settings": { "value": "Start", "label": "Start" }` |
| label with a digit, space or dash (`Start2`, `my-start`), or in lowercase | keen-validate error; the canvas would reject it | `Start`, `Refund` |
| `${dictionary.name}` as the label | rejected; the entry is built at deploy | a fixed word |
| renaming a Start after other flows call it | those Run Flow / Jump Flow / Flow Pointer targets stop resolving; keen-validate errors on each | change every caller and the agent's Start Node with it |
| two Start nodes with the same label in one file | no error: they share one entry name and the **last** one in the file wins, so the other can never be entered | one distinct label per Start |
| `next_1` as the source handle | keen-validate rejects it | `next` |
| an edge from `next` into a Summarizer or a Parallel Flows `wait` | keen-validate error | wire it to a node's `in` |
| nothing wired from `next` | the flow ends at once | an edge to the first real node |
| a flow file with no Start node | no entry exists; nothing can call that file | add a Start |

## Example

`Support.flow` has a full path and a shortcut that skips the preparation:

- Start `Start` → Script (loads the customer) → LLM → End Flow
- Start `Quick` → LLM

Entries: `Support-Start` and `Support-Quick`. The agent record says Start Flow `Support`, Start Node `Start`.
Another flow can call the shortcut with a Run Flow whose target is `Support-Quick`.
