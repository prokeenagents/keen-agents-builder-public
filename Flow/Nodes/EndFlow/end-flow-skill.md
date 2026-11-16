# End Flow (`endNode`)

## Description

The terminator: it marks the place where a flow is finished. Use it:

- at the end of **every** path of a flow, including the `error` and `false` paths: the last node of a chat turn,
  the end of a sub-flow called by Run Flow, the end of a Parallel Flows branch or of a Parallel Context run.
- so that every finished path is visible on the canvas, and so the run is cleaned up properly (see *How the
  engine runs it*).

Use something else when control must go on in **another flow and never come back** (**Jump Flow**; the target
flow's own End finishes the run), or when paths only need to meet and carry on (**Join Flow** or a multi-in
node, not an End per path).

## In / Out

- **In:** `in`, and it takes **several** edges (multi-in). Any node output may be wired into it:
  Start `next`; LLM `next_1` and `error`; Summarizer `next_1`; Condition `true` / `false`; Loop `out` and
  `next_1`; Assignment, Run Flow, Join Flow, Parallel Flows, Parallel Context `next_1`; Script `next_1` and
  `error`. Exceptions: an LLM's `summary` must go to exactly one Summarizer, and a Summarizer's Fallback
  (`error`) only to another Summarizer, so neither may reach an End. A Flow Pointer's `next` is not forbidden
  by the validator but belongs only to a Parallel Flows `wait`; do not point it at an End. Jump Flow and Note
  have no output.
- **Out:** none. Nothing runs after an End, and the flow it ends is finished. Never use an End as an edge
  `source`; keen-validate rejects it.

## Fallback

No.

## Error

No.

## Settings

| Field (JSON key) | Rule | What it is for |
|---|---|---|
| Label: `data.settings.value`, `data.settings.label`, `data.label` | the same short text in all three | the card's title; the engine never reads it |
| Terminate dictionary: `data.settings.terminateDictionary` | boolean; `false` or omitted | delete the dictionary the flow owns at its End; see *How the engine runs it*, step 4; almost never needed |
| Description: `data.description` | optional | a note under the card; no effect |

`keen-validate` checks nothing about an End's settings, but write the file as the canvas would save it.

## Rotate

Yes. Rotate moves where the `in` dot is drawn: `data.handlePosition` = `top`, `right`, `bottom` or `left`. The
default for End is `top`, and the key is absent from the JSON until the node is rotated. It is cosmetic: it
never changes the wiring. Do not write it unless a layout needs it.

## JSON structure

| Property | Required | What it means and what it is for |
|---|---|---|
| `id` | yes | `endNode_` + exactly 12 characters from `A–Z a–z 0–9`, unique in the project. The engine reads the node's kind from the prefix. |
| `type` | fixed `"endNode"` | the node kind; it must agree with the id prefix. |
| `position.x`, `position.y` | yes | where the card sits on the canvas; multiples of 16. Not read by the engine. |
| `data.label` | yes | the card's title; copy of `settings.label`. Not read by the engine. |
| `data.description` | no | a free note under the card (may be `""`). Not read by the engine. |
| `data.labelNode` | fixed `"End Flow"` | the node kind's title on the canvas. Not read by the engine. |
| `data.descriptionNode` | fixed `"Flow terminal"` | the node kind's subtitle. Not read by the engine. |
| `data.open` | no (write `false`) | whether the card's settings panel is open on the canvas. Not read by the engine. |
| `data.handlePosition` | no | `top` / `right` / `bottom` / `left`; absent until rotated (default `top`). See Rotate. Cosmetic. |
| `data.settings.value` | yes (the label) | the Label text; same as `settings.label`. Not read by the engine. |
| `data.settings.label` | yes (the label) | the Label text. Not read by the engine. |
| `data.settings.terminateDictionary` | no (default `false`) | boolean; the only setting the engine reads. See Settings. |
| `dragHandle` | fixed `".drag-handle__custom"` | the canvas drag handle. Not read by the engine. |

The End has no other keys under `data.settings`.

## In the `.flow` file

The minimal correct node:

```json
{
  "id": "endNode_w5BlB6SQOOVl",
  "type": "endNode",
  "position": { "x": 304, "y": 736 },
  "data": {
    "label": "Done",
    "description": "",
    "labelNode": "End Flow",
    "descriptionNode": "Flow terminal",
    "open": false,
    "settings": { "value": "Done", "label": "Done", "terminateDictionary": false }
  },
  "dragHandle": ".drag-handle__custom"
}
```

An edge into it:

```json
{ "id": "xy-edge__scriptNode_Kq81LmZx0PaBerror-endNode_w5BlB6SQOOVlin", "type": "step",
  "source": "scriptNode_Kq81LmZx0PaB", "sourceHandle": "error",
  "target": "endNode_w5BlB6SQOOVl", "targetHandle": "in" }
```

## How the engine runs it

1. The End decides nothing from its settings. It changes no dictionary or session value and sends no answer;
   it only reports "this flow is finished". Several Ends in one flow are fine; the one reached finishes the
   flow's branch.
2. **Root flow** (the flow the chat started): the run is over. The engine then clears everything the run kept:
   dictionary, session, conversation state and queued work. Nothing set in the dictionary or session survives
   the turn. Do not let another branch of the root flow still be working when one branch reaches the End.
3. **Flow called by Run Flow**: only that sub-flow finishes, and the caller carries on from its `next_1`. The
   sub-flow shares the caller's dictionary, so what it wrote is visible there. **Jump Flow**: the target keeps
   the role of the flow that jumped, so an End after a jump from the root flow ends the run, and after a jump
   from a sub-flow ends that sub-flow.
4. **`terminateDictionary: true`** deletes the dictionary the flow *owns* at that moment. In practice it adds
   nothing:
   - root flow: step 2 clears the run anyway;
   - **Parallel Flows** branch: its private dictionary is always dropped at its End;
   - **Parallel Context** run: the dictionary is first merged back into its list item, then dropped;
   - **Run Flow / Jump Flow** sub-flow: it shares the caller's dictionary, so the setting is ignored (a
     warning is logged) and the caller's data is never deleted.
   It never touches the session. Leave it `false`.
5. **A path with no End.** An unwired output simply stops that path: nothing further is sent and there is no
   error. The reference client treats a flow with nothing left to run as finished, so a Run Flow caller still
   resumes. But no End ran, so a root flow's end-of-run clearing of step 2 does **not** happen; the run's state
   is dropped only when it expires, about a minute later. Always finish with an End.

## Mistakes that break it

| Mistake | What happens | Write instead |
|---|---|---|
| an edge out of an End | keen-validate rejects it: no output handle | wire the next step from the node before it |
| an LLM `summary` or a Summarizer `error` wired to an End | keen-validate error | `summary` to one Summarizer; its Fallback to another Summarizer |
| expecting an End in a sub-flow to end the whole run | only that sub-flow finishes; the caller continues | a root-flow End, or a Condition after the Run Flow |
| an End in the root flow while another branch is still working | the End clears the run's state; the other branch fails or loses data | one End after the branches have met (Join Flow) |
| `terminateDictionary: true` in a sub-flow "to clean up" | ignored, with a warning | leave it `false` |
| reading a sub-flow's result from an End | the End returns nothing | the sub-flow writes into the dictionary; the caller reads `${dictionary.…}` |
| every path ends without an End | works, but the run's state lingers until it expires | an End on every path |
| `id` not `endNode_` + 12 letters / digits | another or an unknown node kind | `endNode_` + 12 characters |

## Example

A chat flow: `Start` → LLM; the LLM's `next_1` → End `Done`; its `error` → a second End `Failed`, so a failed
turn is also finished and cleared. Both Ends use the JSON above; only the label differs.
