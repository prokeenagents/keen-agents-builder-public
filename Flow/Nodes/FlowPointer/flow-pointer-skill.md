# Flow Pointer (`parallelFlowNode`)

## Description

Names **one flow** that a **Parallel Flows** node (`parallelInNode`) must start and wait for. It is a
declaration, not a step: it has no input, the engine never runs it, and on its own it does nothing. It exists
only to be wired into a Parallel Flows node's `wait` handle — read `../ParallelFlows/parallel-flows-skill.md`
first; that file explains the whole pair (empty dictionaries per branch, the shared session, waiting for all).

One Flow Pointer = one branch. To run three flows side by side, place three Flow Pointers, each with its own
target, all wired into the same Parallel Flows `wait`. Two pointers may name the same flow; it then runs twice.

Use something else when:

- you want to call one flow and come back with its dictionary writes → **Run Flow**;
- you want to hand the run over to another flow → **Jump Flow**;
- you want one flow per item of a list → **Parallel Context** (its target sits in its own `pipe` setting; it
  needs no Flow Pointer node).

## In / Out

- **In:** none. Nothing can lead into a Flow Pointer; an edge that targets it is a keen-validate error.
- **Out:** one, `next` (the canvas id; the deploy step renames it `next_1` — never write `next_1`). Wire it
  **once**, into a **Parallel Flows `wait`** (`targetHandle: "wait"`). That is its only meaningful target.
  - keen-validate does not stop `next` going to another node's `in`, but such an edge does nothing: the
    pointer is never run, so the target is never reached from it and the pointed flow never starts.
  - Into a Parallel Flows `in` instead of `wait`: the deploy step still counts it as a branch, but the canvas
    shows a wrong picture — always use `wait`.
- **Left unwired:** the pointer is ignored and its flow never runs; keen-validate warns
  (`out-handle "next" is not wired`).

## Fallback

No.

## Error

No. A target that is not a flow entry does not fail anything: that branch is **skipped silently** and the
other branches run. keen-validate catches a literal target that matches no Start node in the project. What a
failing branch does to the others and to the run is in the Parallel Flows file (*Error*).

## Settings

| Field (canvas) | JSON key | Rule | What it is for |
|---|---|---|---|
| Flow | `data.settings.value` | **required**; a `File-Label`: `/^[A-Z][a-zA-Z]*-[A-Z][a-zA-Z]*$/` (letters only, one dash); ≤ 120 in the form's schema, but its input box stops typing at 60, so stay ≤ 60; **no `${…}`** | the entry the branch starts at: `<FlowFileName>-<StartLabel>`, in any flow file of the project. The only property the engine reads |
| (Flow, copy) | `data.settings.label` | same text as `value` | the canvas writes it; not read by the engine or deploy |
| (Flow, copy) | `data.label` | same text as `value` | the card's title; not read |
| Description | `data.description` | optional, ≤ 250 | a note under the card; not read |

The engine would resolve a `${dictionary.…}` / `${session.…}` placeholder in `value` (against the caller's
dictionary and session), but the canvas form and keen-validate reject one (the form refuses to Save; the file keeps
what it had). Write a literal entry name.

## Rotate

Yes. `data.handlePosition` = `top` / `right` / `bottom` / `left` names the side of the `next` dot. The default
is **`bottom`**; the key is absent from the JSON until someone rotates the node. Cosmetic: never changes the
wiring or the run. Leave it out.

## JSON structure

| Property | Required | What it means and what it is for |
|---|---|---|
| `id` | yes | `parallelFlowNode_` + exactly 12 characters `A–Z a–z 0–9`, unique in the project. The deploy step counts an edge as a branch only when its source id has this prefix. A prefix that disagrees with `type` is a keen-validate error; a body that is not 12 characters is a warning. |
| `type` | yes, `"parallelFlowNode"` | the node's kind for the canvas, the validator and deploy |
| `position.x`, `position.y` | yes | where the card sits, multiples of 16 (beside the Parallel Flows node, on its `wait` side — the right by default). Not read by the engine; missing → a warning. |
| `data.label` | yes (write it) | a copy of the target; the card's title. Not read by the engine. |
| `data.description` | no | a note, ≤ 250. Not read by the engine. |
| `data.labelNode` | yes, `"Flow Pointer"` | fixed; anything else is a keen-validate error. Not read by the engine. |
| `data.descriptionNode` | yes, `"Point to the flow that must be awaited"` | fixed; anything else is a keen-validate error. Not read by the engine. |
| `data.open` | no (write `false`) | whether the settings panel is open. Not read by the engine. |
| `data.handlePosition` | no | see *Rotate*. Leave it out. |
| `data.settings.value` | **yes** | the target `File-Label`. Read by the engine when the Parallel Flows node runs. Missing or empty → keen-validate error; not a `File-Label` → error; no such Start in the project → error. |
| `data.settings.label` | yes (write it) | the same text as `value`; written by the canvas. Not read. |
| `dragHandle` | yes, `".drag-handle__custom"` | the canvas's drag handle; anything else → a warning. Not read by the engine. |

## In the `.flow` file

The pointer and its edge into a Parallel Flows `wait` (the target flow `PriceAcme.flow` has a Start labelled
`Start`):

```json
{
  "id": "parallelFlowNode_AcmEpr1ceFlw",
  "type": "parallelFlowNode",
  "position": { "x": 592, "y": 640 },
  "data": {
    "label": "PriceAcme-Start",
    "description": "Ask supplier Acme",
    "labelNode": "Flow Pointer",
    "descriptionNode": "Point to the flow that must be awaited",
    "open": false,
    "settings": { "value": "PriceAcme-Start", "label": "PriceAcme-Start" }
  },
  "dragHandle": ".drag-handle__custom"
}
```

```json
{ "id": "xy-edge__parallelFlowNode_AcmEpr1ceFlwnext-parallelInNode_Pq7RsT2uVw9xwait", "type": "step",
  "source": "parallelFlowNode_AcmEpr1ceFlw", "sourceHandle": "next",
  "target": "parallelInNode_Pq7RsT2uVw9x", "targetHandle": "wait" }
```

The complete pair — Parallel Flows, two Flow Pointers and all edges — is in the Parallel Flows file.

## How the engine runs it

1. The pointer itself never runs. At deploy, its edge into a Parallel Flows node puts its id on that node's
   `wait` list.
2. When the Parallel Flows node runs, it reads this pointer's `settings.value` and looks the entry up among
   the Start nodes of the whole project. Found → one branch starts there; not found or empty → no branch, no
   error, no log line.
3. The branch runs with a **new, empty dictionary** of its own and the run's **shared session**; its
   dictionary is deleted when it ends and nothing merges back. Results come back through the session (or
   `system/agent`).
4. The Parallel Flows node continues out of its `next_1` only after this branch and every other branch have
   finished.

## Mistakes that break it

| Mistake | What happens | Write instead |
|---|---|---|
| `next` wired to an LLM / Script / End Flow `in` | no error, nothing ever runs from it | `next` → a Parallel Flows `wait` |
| no edge from `next` | the flow is never started; keen-validate warns | wire it into `wait` |
| `"value": "${dictionary.flow}"` | keen-validate error; the canvas form refuses to save it | a literal `File-Label` |
| `"value": "PriceAcme"` (no Start label) or `"priceacme-start"` | keen-validate error; at run time the branch is skipped | `"PriceAcme-Start"` — file name and Start label, exactly |
| the target flow file has a digit (`Price2.flow`) | no `File-Label` can name it | letters-only file names |
| renaming the target's Start label later | keen-validate error on the pointer; deployed, the branch silently stops running | change the pointer with it |
| `next_1` as the source handle | keen-validate rejects it (not a canvas id) | `next` |
| an edge into the pointer | keen-validate error: it has no input | nothing leads into a Flow Pointer |
| expecting the branch to see the caller's dictionary | it starts empty | pass values through the session |

## Example

A support agent checks two things before it answers: `Support.flow` has a Parallel Flows node with two Flow
Pointers, `CustomerLookup-Start` (a Script reads the customer's plan from `shopApi` and writes
`Session.setSessionValue('plan', 'pro')`) and `Outages-Start` (a Script reads the status page and writes
`Session.setSessionValue('outage', true)`). After both, the LLM's prompt reads `${session.plan}` and
`${session.outage}`. Each pointer:

```json
"settings": { "value": "CustomerLookup-Start", "label": "CustomerLookup-Start" }
```
