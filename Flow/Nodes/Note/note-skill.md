# Note (`noteNode`)

## Description

A sticky note on the canvas: a comment for the next person who opens the flow. Use it to say why a branch exists,
which dictionary key a part of the flow expects, or what to change before going live. It is not part of the flow:
it has no dots, cannot be wired, and the engine never runs it.

It does not carry data or behaviour. For a step that does nothing but lets paths meet, use a **Join Flow**. For
a description of one node, use that node's own description field. Do not put anything the agent needs in a Note,
and do not put secrets in one (it is stored in the flow file and deployed).

## In / Out

**In** — none. **Out** — none. A Note has no handles, so no edge may start or end at it; keen-validate rejects
an edge that names a Note as source or target. It is never reached, so it is never "unreachable".

## Fallback

No.

## Error

No. It never runs, so it cannot fail.

## Settings

Yes, the text only.

| Field | JSON key | Rule | What it is for |
|---|---|---|---|
| Label (the note text) | `data.label`, `data.settings.value`, `data.settings.label` | the same text in all three; 1–160 characters (the canvas form and its input box; keen-validate warns above 160) | what the card shows |
| Description | `data.description` | optional, ≤ 250 | a secondary note; may be `""` |

Plain text for people: no `${…}` is resolved.

## Rotate

No. There are no handles to rotate, so `data.handlePosition` is never written.

## JSON structure

| Property | Required | What it means and what it is for |
|---|---|---|
| `id` | yes | `noteNode_` + exactly 12 characters `A–Z a–z 0–9`, unique in the project. A prefix that disagrees with `type` is a keen-validate error; a body that is not 12 characters is a warning. |
| `type` | yes, `"noteNode"` | the node's kind |
| `position.x`, `position.y` | yes | where the card sits, multiples of 16; missing → warning. Not read by the engine. |
| `data.label` | yes | the note text. Not read by the engine. |
| `data.description` | no | a secondary note. Not read by the engine. |
| `data.labelNode` | yes, `"Note"` | fixed title; anything else is a keen-validate error |
| `data.descriptionNode` | yes, `"Write your notes here"` | fixed subtitle; anything else is a keen-validate error |
| `data.open` | no — leave it out | the canvas no longer reads or writes it (every panel opens closed; one already in a file is kept). Not read by the engine. |
| `data.settings.value`, `data.settings.label` | yes (write both) | the note text again |
| `dragHandle` | yes, `".drag-handle__custom"` | the canvas's drag handle; anything else → warning |

## In the `.flow` file

```json
{
  "id": "noteNode_Xy12Ab34Cd56",
  "type": "noteNode",
  "position": { "x": 704, "y": 128 },
  "data": {
    "label": "The Condition below expects dictionary.score to be set by the Script above.",
    "description": "",
    "labelNode": "Note",
    "descriptionNode": "Write your notes here",
    "open": false,
    "settings": {
      "value": "The Condition below expects dictionary.score to be set by the Script above.",
      "label": "The Condition below expects dictionary.score to be set by the Script above."
    }
  },
  "dragHandle": ".drag-handle__custom"
}
```

No edge mentions it.

## How the engine runs it

The engine never runs it. Deploy keeps the node in the flow it sends to the engine (its settings are carried
over with every other node), with no outgoing edges, and nothing ever starts it. Nothing is read from it, written
by it or sent to the client. Its only effects are the canvas card and the keen-validate checks above.

## Mistakes that break it

| Mistake | What happens | Write instead |
|---|---|---|
| an edge to or from a Note | keen-validate error: no such handle | no edge; wire the real nodes to each other |
| a Note as the "do nothing, then continue" step | the path ends; the Note runs nothing | a Join Flow |
| text over 160 characters | keen-validate warning; the canvas form refuses to save it (its input box takes 160) | ≤ 160 characters, or several Notes |
| `${dictionary.x}` in the text, expecting a value | shown as typed | plain text |
| a password or key written in the text | it is stored in the file and deployed | never |
| `id` not `noteNode_` + 12 letters / digits | another or an unknown node kind | `noteNode_` + 12 characters |

## Example

Above a Condition that tests a score, a Note reads: "Score comes from the Script above; the cut-off 25 is
agreed with sales." It sits at the side, wired to nothing.
