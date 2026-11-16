# Jump Flow (`jumpFlowNode`)

## Description

A hand-over to another flow that never comes back. When the run reaches a Jump Flow, the current path
continues at the Start node its target names, **as if that flow's nodes were part of the flow that jumped**:
the same dictionary, the same session, the same place in the run. The Jump Flow has no output, so nothing
after it runs on this path.

Use it to:

- route: Start → Condition → one Jump Flow per case, each into the flow that handles that case;
- share a closing part: several branches that all end the same way jump into one `Closing-Start` flow
  instead of repeating its nodes;
- hand a conversation to another stage for good (from a welcome flow into the main chat flow).

Use something else when:

- the caller must continue after the other flow → **Run Flow** (it waits and comes back to its `next_1`);
- several flows should run at the same time → **Parallel Flows** + **Flow Pointer**, or **Parallel Context**;
- you only need branches to meet again in this flow → **Join Flow**.

## In / Out

**In** — yes, `in`, takes **several** edges (multi-in). Any ordinary output may connect into it: Start's
`next`; the `next_1` of LLM, Script, Assignment, Run Flow, Join Flow, Parallel Flows, Parallel Context or a
Summarizer's Out; a Loop's `out` or `next_1`; a Condition's `true` / `false`; a Script's `error`; an LLM's
`error` (Fallback). Not allowed: an LLM's `summary` (only to a Summarizer), a Summarizer's Fallback (only to
another Summarizer), a Flow Pointer's `next` (only into a Parallel Flows `wait`).

**Out** — none. Never use a Jump Flow as an edge `source`; keen-validate rejects any source handle on it.
What comes "after" the jump belongs in the target flow.

## Fallback

No.

## Error

No error output. A target that is not an entry of the deployed project **stops the whole run** with
**E2201 "Agent project error"** — final, never retried (see *How the engine runs it*). Failures inside the
target are handled by the target's own nodes.

## Settings

Yes, one field:

| Field | JSON key | Rule | What it is for |
|---|---|---|---|
| Flow | `data.settings.value` | required; a literal `File-Label` (`/^[A-Z][a-zA-Z]*-[A-Z][a-zA-Z]*$/`, ≤ 120 — the canvas form's cap); a placeholder: the canvas form accepts one, keen-validate refuses it | the entry to continue in: `<FlowFileName>-<StartLabel>`, e.g. `Refund-Start`; any file of the project, the jumping flow's own included |

The engine resolves `${dictionary.…}` / `${session.…}` in this field, and the canvas form accepts one (a whole
placeholder, or placeholders mixed with letters and `-`; a half wrapper such as `${flow}` or `${dictionary.next`
stays refused). keen-validate still refuses anything that is not a literal `File-Label`. Write a literal; to choose at run time, put a **Condition** in front of two Jump Flows.

`data.description` is an optional note (≤ 250, the canvas form's cap). `data.label` is not a setting: the
canvas writes it as `""` and the card shows the target instead.

## Rotate

Yes. `data.handlePosition` is the side where **In** sits — `top` (the default), `right`, `bottom` or `left`.
The key is absent from the JSON until the node is rotated. Cosmetic: it never changes the wiring or the run.
Leave it out.

## JSON structure

| Property | Required | What it means and what it is for |
|---|---|---|
| `id` | yes | `jumpFlowNode_` + exactly 12 characters `A–Z a–z 0–9`, unique in the project. The engine reads the node's kind from the prefix. A prefix that disagrees with `type` is a keen-validate error; a body that is not 12 characters is a warning. |
| `type` | yes, `"jumpFlowNode"` | the node's kind for the canvas, the validator and deploy |
| `position.x`, `position.y` | yes | where the card sits, multiples of 16. Not read by the engine; missing → a keen-validate warning. |
| `data.label` | yes (write `""`) | the canvas writes it empty. Not read by the engine. |
| `data.description` | no | a note under the card, ≤ 250. Not read by the engine. |
| `data.labelNode` | yes, `"Jump Flow"` | fixed title; anything else is a keen-validate error. Not read by the engine. |
| `data.descriptionNode` | yes, `"Execute Flow in this context and continue"` | fixed subtitle; anything else is a keen-validate error. Not read by the engine. |
| `data.open` | no — leave it out | the canvas no longer reads or writes it (every panel opens closed; one already in a file is kept). Not read by the engine. |
| `data.handlePosition` | no | see *Rotate*. Leave it out. |
| `data.settings.value` | **yes** | the target `File-Label` — the only property the engine reads. Missing / empty → keen-validate error; not a `File-Label` (a digit, `${…}`, lowercase, no dash) → error; a `File-Label` that matches no Start in the project → error that lists the known entries. |
| `dragHandle` | yes, `".drag-handle__custom"` | the canvas's drag handle. Anything else → a keen-validate warning. Not read by the engine. |

## In the `.flow` file

```json
{
  "id": "jumpFlowNode_Jp7Wx3Nc8HdY",
  "type": "jumpFlowNode",
  "position": { "x": 304, "y": 736 },
  "data": {
    "label": "",
    "description": "Refund requests continue in the refund flow",
    "labelNode": "Jump Flow",
    "descriptionNode": "Execute Flow in this context and continue",
    "open": false,
    "settings": { "value": "Refund-Start" }
  },
  "dragHandle": ".drag-handle__custom"
}
```

The only edges are into it:

```json
{ "id": "xy-edge__conditionNode_E0eqDp5b0fUstrue-jumpFlowNode_Jp7Wx3Nc8HdYin", "type": "step",
  "source": "conditionNode_E0eqDp5b0fUs", "sourceHandle": "true",
  "target": "jumpFlowNode_Jp7Wx3Nc8HdY", "targetHandle": "in" }
```

## How the engine runs it

1. Reads `data.settings.value` (a placeholder would be resolved first; it must give a non-empty string).
2. Looks the name up among the deployed project's entries (`<FileName>-<StartLabel>`).
   - Not an entry → the run stops with **E2201 "Agent project error"**, message `Entry "<target>" not found in
     project`. Final (not retried); the chat gets an error, and the agent's Log Record gets one line:
     `Flow node failed: node=<id> type=jumpFlowNode reason=entry-not-found entry=<target> … the run stopped at
     this node.`
   - Empty, or a placeholder that resolves to nothing or to a non-string → **E6101** with the message
     `Run Flow Node called with empty entry` (Run Flow's words, also here). The client re-sends an E6101 without a limit, so the run never moves on.
3. Continues this path at the target's Start node **in the same flow**: no new flow is started, nothing waits
   for it. The target's nodes use the jumping flow's dictionary (the same store) and the same session. The
   Jump Flow itself writes nothing.
4. The target takes over the role of the flow that jumped:
   - from the **root flow** (the one the chat started) → an End Flow in the target ends the whole run and
     clears its state;
   - from a **Run Flow** sub-flow → an End in the target finishes that sub-flow, and the Run Flow's caller
     then continues out of its `next_1`;
   - from a **Parallel Flows** branch or a **Parallel Context** run → the target runs on that branch's own
     dictionary, and the branch finishes when the target does;
   - inside a flow tool → the target keeps `toolOptions`.
5. Only the path that reached the Jump Flow moves. Other paths of the same flow that are still running go on.

The engine sets no limit on jumps. Jumping back to an entry that already ran re-runs its nodes (a loop); give
it a Condition that ends it, or it runs until the person cancels.

## Mistakes that break it

| Mistake | What happens | Write instead |
|---|---|---|
| an edge out of the Jump Flow | keen-validate rejects it: no output handle | put the follow-up work at the end of the target flow, or use Run Flow |
| using Jump Flow where the caller must go on | nothing after it runs on this path | Run Flow |
| target `Refund` or `refund-start` | keen-validate error; at run time E2201 | `Refund-Start` (`<FileName>-<StartLabel>`) |
| target names a Start that does not exist, or a renamed Start | keen-validate error; at run time E2201 "Agent project error", final | the exact file name and Start label |
| target `${dictionary.route}` | keen-validate error (the canvas form accepts it) | a Condition in front of two literal Jump Flows |
| expecting a fresh dictionary in the target | the target sees and overwrites the caller's keys | clear or rename keys in the target; Parallel Flows for an empty dictionary |
| expecting a jump from a sub-flow to end the whole run | only the sub-flow ends; its Run Flow caller continues | end the run in the root flow |
| jumping back to an earlier entry with no exit | the path loops forever | a Condition that stops it |
| two paths of the root flow, one jumps into a flow that hits an End | that End clears the run while the other path still works | let the paths meet (Join Flow) before the jump |

## Example: route by intent

`Main.flow`: Start → LLM (classifies the message; a Script copies its answer into `dictionary.intent`) →
Condition `${dictionary.intent} == "refund"`:

- `true` → Jump Flow `Refund-Start` (`Refund.flow` asks for the order, books the refund, ends with an End);
- `false` → Jump Flow `Support-Start`.

```json
"settings": { "value": "Refund-Start" }
```

Neither branch comes back to `Main.flow`; the End in `Refund.flow` or `Support.flow` ends the chat turn,
because the jump happened in the root flow.
