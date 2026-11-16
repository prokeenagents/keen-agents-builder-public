# Run Flow (`runFlowNode`)

## Description

A call to another flow that comes back. When the run reaches a Run Flow, the target flow starts at the Start
node its target names, runs **to the end of all its paths**, and only then does the caller continue out of
its own `next_1`. It is the flow's function call.

Use it to:

- reuse a piece of logic from several places (one `Lookup.flow` called by every flow that needs it);
- keep a big flow short by moving a self-contained chunk into its own file;
- run a sub-flow as a **Loop** body, one item at a time (Loop `out` → Run Flow → its `next_1` → Loop `next_2`).

The sub-flow works on the **same dictionary and session** as the caller, so whatever it writes is there for
the caller's next node. That is how a sub-flow "returns" a value: it writes a key, the caller reads it.

Use something else when:

- the current path is done and should finish inside the other flow → **Jump Flow** (no way back);
- several different flows should run at the same time → **Parallel Flows** + one **Flow Pointer** each;
- one flow should run once per item of a list, in parallel (waves of up to 15) → **Parallel Context**;
- the sub-flow must not touch the caller's dictionary → Parallel Flows (empty dictionary) or Parallel Context
  (a copy of one item). A Run Flow child has no private dictionary.

## In / Out

**In** — yes, `in`, takes **several** edges (multi-in). Any ordinary output may connect into it: Start's
`next`; the `next_1` of LLM, Script, Assignment, Run Flow, Join Flow, Parallel Flows, Parallel Context or a
Summarizer's Out; a Loop's `out` (body) or `next_1` (Finish); a Condition's `true` / `false`; a Script's
`error`; an LLM's `error` (Fallback). Not allowed: an LLM's `summary` (only to a Summarizer), a Summarizer's
Fallback (only to another Summarizer), a Flow Pointer's `next` (only into a Parallel Flows `wait`).

**Out** — yes, one: **`next_1`**, taken after the sub-flow has finished. It may lead into the `in` of any node
that has one (Condition, Loop, LLM, Script, Assignment, Run Flow, Jump Flow, Join Flow, Parallel Flows,
Parallel Context, End Flow) or into a Loop's `next_2` (to end a loop body). Not into a Summarizer's `in` or a
Parallel Flows `wait`. The canvas allows one edge per output. A single-in target (Condition, Assignment,
Parallel Context, Loop `next_2`) may have no other incoming edge — put a Join Flow in front.

**`next_1` unwired:** the sub-flow still runs to its end, then the caller's path stops there. keen-validate
warns (`out-handle "next_1" is not wired — that path dead-ends`). If nothing else reaches an End Flow, the
person gets only what the sub-flow produced.

## Fallback

No.

## Error

No error output. A target that is not an entry of the deployed project **stops the whole run** with
**E2201 "Agent project error"** — final, never retried, nothing of the sub-flow runs (see *How the engine runs
it*). A failure **inside** the sub-flow is handled there, by that node's own `error` edge; a Script in the
sub-flow that throws with no `error` edge stalls the sub-flow, and then the caller never resumes either.

## Settings

Yes, one field:

| Field | JSON key | Rule | What it is for |
|---|---|---|---|
| Flow | `data.settings.value` | required; a literal `File-Label` (`/^[A-Z][a-zA-Z]*-[A-Z][a-zA-Z]*$/`, ≤ 120 — the canvas form's cap); **no `${…}`** | the entry to call: `<FlowFileName>-<StartLabel>`, e.g. `Lookup-Start` for the Start labelled `Start` in `Lookup.flow`; any file of the project, the caller's own included |

The engine would resolve `${dictionary.…}` / `${session.…}` in this field, but the canvas form and
keen-validate refuse anything that is not a literal `File-Label`, and the canvas drops a placeholder the next
time the node is saved. Write a literal; to choose between flows at run time, put a **Condition** in front of
two Run Flows.

`data.description` is an optional note (≤ 250, the canvas form's cap). `data.label` is not a setting: the
canvas writes it as `""` and the card shows the target instead.

## Rotate

Yes. `data.handlePosition` is the side where **In** sits — `top` (the default), `right`, `bottom` or `left`;
Out is always on the opposite side. The key is absent from the JSON until the node is rotated. Cosmetic: it
never changes the wiring or the run. Leave it out.

## JSON structure

| Property | Required | What it means and what it is for |
|---|---|---|
| `id` | yes | `runFlowNode_` + exactly 12 characters `A–Z a–z 0–9`, unique in the project. The engine reads the node's kind from the prefix. A prefix that disagrees with `type` is a keen-validate error; a body that is not 12 characters is a warning. |
| `type` | yes, `"runFlowNode"` | the node's kind for the canvas, the validator and deploy |
| `position.x`, `position.y` | yes | where the card sits, multiples of 16. Not read by the engine; missing → a keen-validate warning. |
| `data.label` | yes (write `""`) | the canvas writes it empty. Not read by the engine. |
| `data.description` | no | a note under the card, ≤ 250. Not read by the engine. |
| `data.labelNode` | yes, `"Run Flow"` | fixed title; anything else is a keen-validate error. Not read by the engine. |
| `data.descriptionNode` | yes, `"Execute Flow in this context and return"` | fixed subtitle; anything else is a keen-validate error. Not read by the engine. |
| `data.open` | no (write `false`) | whether the settings panel is open on the canvas. Not read by the engine. |
| `data.handlePosition` | no | see *Rotate*. Leave it out. |
| `data.settings.value` | **yes** | the target `File-Label` — the only property the engine reads. Missing / empty → keen-validate error; not a `File-Label` (a digit, `${…}`, lowercase, no dash) → error; a `File-Label` that matches no Start in the project → error that lists the known entries. |
| `dragHandle` | yes, `".drag-handle__custom"` | the canvas's drag handle. Anything else → a keen-validate warning. Not read by the engine. |

## In the `.flow` file

```json
{
  "id": "runFlowNode_Rf4Kp9Tz2LmQ",
  "type": "runFlowNode",
  "position": { "x": 304, "y": 736 },
  "data": {
    "label": "",
    "description": "Look the customer up, then come back",
    "labelNode": "Run Flow",
    "descriptionNode": "Execute Flow in this context and return",
    "open": false,
    "settings": { "value": "Lookup-Start" }
  },
  "dragHandle": ".drag-handle__custom"
}
```

```json
{ "id": "xy-edge__startNode_mK8HmeWTUjYNnext-runFlowNode_Rf4Kp9Tz2LmQin", "type": "step",
  "source": "startNode_mK8HmeWTUjYN", "sourceHandle": "next",
  "target": "runFlowNode_Rf4Kp9Tz2LmQ", "targetHandle": "in" },
{ "id": "xy-edge__runFlowNode_Rf4Kp9Tz2LmQnext_1-agentNode_Ab12Cd34Ef56in", "type": "step",
  "source": "runFlowNode_Rf4Kp9Tz2LmQ", "sourceHandle": "next_1",
  "target": "agentNode_Ab12Cd34Ef56", "targetHandle": "in" }
```

## How the engine runs it

1. Reads `data.settings.value` (a placeholder would be resolved first; it must give a non-empty string).
2. Looks the name up among the deployed project's entries (`<FileName>-<StartLabel>`, built from every Start's
   label at deploy).
   - Not an entry → the run stops with **E2201 "Agent project error"**, message `Entry "<target>" not found in
     project`. It is final (not retried); the chat gets an error, and the agent's Log Record gets one line:
     `Flow node failed: node=<id> type=runFlowNode reason=entry-not-found entry=<target> … the run stopped at
     this node.`
   - Empty, or a placeholder that resolves to nothing or to a non-string → **E6101** (`Run Flow Node called
     with empty entry`). The client re-sends an E6101 without a limit, so the run never moves on and never
     answers. keen-validate rules this out for a literal.
3. Starts the sub-flow at that Start node as a **child** of the caller: a new flow of its own inside the same
   run, on the **caller's dictionary** (the same store, not a copy) and the **same session**. The Run Flow
   itself writes nothing.
4. The caller waits. The sub-flow runs every path its Start leads to; it is finished when nothing in it is left
   to run (an End Flow, or paths that simply stop). Its LLM answers reach the person's chat as they come.
5. Then the caller continues out of `next_1`, and the next node reads whatever the sub-flow wrote.

What the child does **not** get: inside a flow that runs as an LLM's flow tool, `toolOptions` is absent in the
Run Flow child (a spawned flow starts a new tool boundary) — copy what you need into the dictionary first.

An End Flow in the sub-flow finishes only the sub-flow; the run goes on in the caller. `terminateDictionary`
on that End is ignored (the dictionary is the caller's). A Jump Flow inside the sub-flow continues the
sub-flow in its target; the caller still resumes when that target finishes.

The engine sets no depth limit. A flow may call itself, but a call with no Condition that stops it runs
until the person cancels.

## Mistakes that break it

| Mistake | What happens | Write instead |
|---|---|---|
| target `Lookup` or `lookup-start` | keen-validate error; at run time E2201 | `Lookup-Start` (`<FileName>-<StartLabel>`) |
| target names a Start that does not exist, or a renamed Start | keen-validate error; at run time E2201 "Agent project error", final | the exact file name and Start label |
| target `${dictionary.flowName}` | keen-validate error; the canvas form refuses to save it | a Condition in front of two literal Run Flows |
| a flow file with a digit (`Report2.flow`) | no `File-Label` can name it | letters-only file names |
| `next` or `out` as the source handle | keen-validate rejects it | `next_1` |
| expecting the sub-flow to work on a copy | it writes the caller's dictionary; same keys get overwritten | distinct key names, or Parallel Context for a private copy |
| reading a "return value" from the sub-flow's End | an End returns nothing | the sub-flow writes `dictionary.x`; the caller reads `${dictionary.x}` |
| a Script in the sub-flow without an `error` edge | a throw stalls the sub-flow and the caller never resumes | wire every Script's `error` in the sub-flow |
| `toolOptions` read in a sub-flow of a flow tool | `undefined` | save it to the dictionary at the tool flow's first node |
| a flow that calls itself unconditionally | never ends | a Condition that stops the recursion |

## Example: a shared customer lookup

`Lookup.flow`: Start `Start` → Script `customers/find-customer.js` (writes `dictionary.customer`, its `error` →
an End) → End. Every chat flow that needs the customer calls it:

```json
"settings": { "value": "Lookup-Start" }
```

`Support.flow`: Start → Run Flow `Lookup-Start` → LLM whose prompt uses `${dictionary.customer.name}` → End.
The LLM runs only after the lookup has finished, and sees the customer the sub-flow stored.
