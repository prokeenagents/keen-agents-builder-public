# Join Flow (`joinNode`)

## Description

A merge point: several paths wire into its one `in`, and one `next_1` continues from it. Use it so that branches
which should end up doing the same next step all point at one node instead of each at the target, and above all
when the target is **single-in** (Condition, Assignment, Parallel Context, a Loop's `next_2`), which accepts
only one incoming edge. It also makes a merge visible on the canvas.

It is **not a barrier**. It does not wait for the other paths. Each path that arrives continues out at once, so if
two live paths reach one Join, everything after it runs **twice**, once per arrival. To wait for several flows
and continue once, use **Parallel Flows** with Flow Pointers (or **Parallel Context** for one flow over a list).
Normally only one path of a flow is live (a Condition's `true` or `false`), so the Join just joins the
alternatives. It does nothing to the data and is not a "do nothing" step to put in a line: a node whose `in`
is already multi-in needs no Join.

## In / Out

**In** — yes, `in`, and it takes **several** edges (multi-in). Any node's ordinary output may connect into it:
Start's `next`, the `next_1` of LLM, Script, Assignment, Run Flow, another Join Flow, Parallel Flows, Parallel
Context or a Summarizer's Out, a Loop's `out` or `next_1`, a Condition's `true` / `false`, a Script's `error`, an
LLM's Fallback (`error`). Not allowed: an LLM's `summary` (only to a Summarizer), a Summarizer's Fallback (only
to another Summarizer), a Flow Pointer's `next` (only into a Parallel Flows `wait`).

**Out** — yes, one: **`next_1`**. It may lead into the `in` of any node that has one (Condition, Loop, LLM,
Script, Assignment, Run Flow, Jump Flow, Join Flow, Parallel Flows, Parallel Context, End Flow) or into a Loop's
`next_2`. Not into a Summarizer's `in` or a Parallel Flows `wait`. Write one edge on `next_1` (the canvas refuses a
second). When `next_1` is unwired the merged path ends silently and keen-validate warns.

## Fallback

No.

## Error

No. The node has nothing that can fail.

## Settings

None. A Join has no settings form: no label, no description, no expression.

## Rotate

Yes, and only Rotate. `data.handlePosition` = `top` (default) / `right` / `bottom` / `left`, absent from the JSON
until someone rotates the node. Cosmetic. Leave it out.

## JSON structure

| Property | Required | What it means and what it is for |
|---|---|---|
| `id` | yes | `joinNode_` + exactly 12 characters `A–Z a–z 0–9`, unique in the project. The engine reads the node's kind from the prefix. A prefix that disagrees with `type` is a keen-validate error; a body that is not 12 characters is a warning. |
| `type` | yes, `"joinNode"` | the node's kind |
| `position.x`, `position.y` | yes | where the card sits, multiples of 16. Not read by the engine; missing → warning. |
| `data.label` | write `""` | the canvas saves an empty label. Not read by the engine. |
| `data.labelNode` | yes, `"Join Flow"` | fixed title; anything else is a keen-validate error. Not read by the engine. |
| `data.descriptionNode` | yes, `"Common merge point"` | fixed subtitle; anything else is a keen-validate error. Not read by the engine. |
| `data.handlePosition` | no | see *Rotate*. Leave it out. |
| `data.settings`, `data.open`, `data.description` | no, leave out | a Join has no settings and no settings panel; the canvas does not write them. |
| `dragHandle` | yes, `".drag-handle__custom"` | the canvas's drag handle; anything else → warning. Not read by the engine. |

## In the `.flow` file

```json
{
  "id": "joinNode_qhkiuQBPh7El",
  "type": "joinNode",
  "position": { "x": 304, "y": 592 },
  "data": { "label": "", "labelNode": "Join Flow", "descriptionNode": "Common merge point" },
  "dragHandle": ".drag-handle__custom"
}
```

Two branches in, one out:

```json
{ "id": "xy-edge__scriptNode_Kq81LmZx0PaBnext_1-joinNode_qhkiuQBPh7Elin", "type": "step",
  "source": "scriptNode_Kq81LmZx0PaB", "sourceHandle": "next_1",
  "target": "joinNode_qhkiuQBPh7El", "targetHandle": "in" },
{ "id": "xy-edge__assignmentNode_0zrqPkDvJIHcnext_1-joinNode_qhkiuQBPh7Elin", "type": "step",
  "source": "assignmentNode_0zrqPkDvJIHc", "sourceHandle": "next_1",
  "target": "joinNode_qhkiuQBPh7El", "targetHandle": "in" },
{ "id": "xy-edge__joinNode_qhkiuQBPh7Elnext_1-conditionNode_E0eqDp5b0fUsin", "type": "step",
  "source": "joinNode_qhkiuQBPh7El", "sourceHandle": "next_1",
  "target": "conditionNode_E0eqDp5b0fUs", "targetHandle": "in" }
```

## How the engine runs it

1. When a path arrives at the Join, the engine starts every node wired to `next_1`. That is all: it reads no
   setting, changes no dictionary or session value and sends nothing.
2. It does not count or wait for other arrivals. Two arrivals mean two runs of everything downstream, each
   on the same shared dictionary.
3. With no edge on `next_1`, that path ends silently with no error.

## Mistakes that break it

| Mistake | What happens | Write instead |
|---|---|---|
| a Join to "wait for both branches" | it fires per arrival; the tail runs twice, the second run may see half the data | Parallel Flows + Flow Pointers + its `wait` |
| `next_1` unwired | the merged path ends at the Join; keen-validate warns | wire it onward, ending in an End Flow |
| an edge out of a handle other than `next_1` | keen-validate error | `next_1` |
| an LLM's `summary` or a Summarizer's Fallback into it | keen-validate error | `summary` to one Summarizer |
| a Join in front of a node whose `in` is already multi-in, "to be safe" | works, adds nothing | wire straight into that node |
| writing `settings` for it | not read by the engine (the canvas keeps `data` as it is) | leave them out |
| `id` not `joinNode_` + 12 letters / digits | another or an unknown node kind | `joinNode_` + 12 characters |

## Example

A Condition tests the score. `true` goes to an Assignment that writes `tier` = `gold`, `false` to one that
writes `tier` = `basic`. Both Assignments wire their `next_1` into one Join Flow, and the Join's `next_1` goes
into a single LLM that answers using `${dictionary.tier}`. Only one branch is live per turn, so the LLM runs once.
