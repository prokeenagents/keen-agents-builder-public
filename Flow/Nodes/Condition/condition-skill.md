# Condition (`conditionNode`)

## Description

An if / else on the flow. It evaluates one expression against what the flow already holds — the dictionary and
the session — and continues out of **True** or **False**. Use it whenever the agent's path depends on a value:
a score above a threshold, a yes / no a Script stored, a status, a count, a flag.

It only reads; it writes nothing. It cannot judge text ("does the user sound angry?") — ask an **LLM** to answer
with a fixed word or put a flag in the dictionary, then test the flag here. It cannot test a **list** or an
**object** (is it empty, does it contain X, how long is it) — let a **Script** store a number or a boolean first.
For more than two outcomes, chain Conditions (the `false` of one into the `in` of the next) or let a Script
compute the route and branch on its result.

## In / Out

**In** — yes, `in`, exactly **one** edge (single-in). Any node's ordinary output may connect into it: Start's
`next`, the `next_1` of LLM, Script, Assignment, Run Flow, Join Flow, Parallel Flows, Parallel Context or a
Summarizer's Out, a Loop's `out` (body) or `next_1` (Finish), another Condition's `true` / `false`, a Script's
`error`, an LLM's Fallback. Not allowed: an LLM's `summary` (it goes only to a Summarizer), a Summarizer's
Fallback (only to another Summarizer), a Flow Pointer's `next` (only into a Parallel Flows `wait`). To bring
several paths into one Condition, merge them in a **Join Flow** first.

**Out** — yes, two: **`true`** and **`false`**. Each may lead into the `in` of any node that has one (Condition,
Loop, LLM, Script, Assignment, Run Flow, Jump Flow, Join Flow, Parallel Flows, Parallel Context, End Flow) or
into a Loop's `next_2` (to end a loop body). Not into a Summarizer's `in` or a Parallel Flows `wait`. Start Flow,
Flow Pointer and Note have no input.

Write the canvas ids `true` / `false`; the deploy step maps them to the engine's `next_1` / `next_2`, and
keen-validate rejects `next_1` / `next_2` here. An unwired output ends that path silently when it is taken —
keen-validate warns; leave one open only on purpose.

## Fallback

No.

## Error

No error output. A broken expression does **not** go to `false` — it stops the run with an error (see *How the
engine runs it*).

## Settings

Yes, one field:

| Field | JSON key | Rule | What it is for |
|---|---|---|---|
| Condition | `data.settings.value` | required, ≤ 150 characters (the form's rule; the canvas input box takes exactly that); placeholders `${dictionary.…}` / `${session.…}` | the expression the engine evaluates |

The other `data` fields are not settings: `data.label` repeats the expression as the card's title (no effect on
running), `data.description` is an optional note (≤ 250), and `data.labelNode` / `data.descriptionNode` are
fixed: `"Condition"` / `"Set condition flow direction"`.

## Rotate

Yes. It moves the side where the node's dots are drawn: `data.handlePosition` = `top` (default) / `right` /
`bottom` / `left`, absent from the JSON until someone rotates the node. Cosmetic — it never changes the wiring
or the run. Leave it out when you write the node.

## JSON structure

| Property | Required | What it means and what it is for |
|---|---|---|
| `id` | yes | `conditionNode_` + exactly 12 characters `A–Z a–z 0–9`, unique in the project. The engine reads the node's kind from the prefix; edges point at this id. A prefix that disagrees with `type` is a keen-validate error; a body that is not 12 characters is a warning. |
| `type` | yes, `"conditionNode"` | the node's kind for the canvas, the validator and deploy |
| `position.x`, `position.y` | yes | where the card sits on the canvas, multiples of 16. Not read by the engine; missing → a keen-validate warning. |
| `data.label` | yes (write it) | the card's title: a copy of the expression. Not read by the engine. |
| `data.description` | no | a note under the card, ≤ 250 (the canvas form's cap). Not read by the engine. |
| `data.labelNode` | yes, `"Condition"` | the fixed title of this kind; anything else is a keen-validate error. Not read by the engine. |
| `data.descriptionNode` | yes, `"Set condition flow direction"` | the fixed subtitle; anything else is a keen-validate error. Not read by the engine. |
| `data.open` | no — leave it out | the canvas no longer reads or writes it (every panel opens closed; one already in a file is kept). Not read by the engine. |
| `data.handlePosition` | no | see *Rotate*. Leave it out. |
| `data.settings.value` | **yes** | the expression — see *Settings* and *How the engine runs it*. The only property the engine reads. Missing or empty → keen-validate error. |
| `dragHandle` | yes, `".drag-handle__custom"` | the canvas's drag handle. Anything else → a keen-validate warning. Not read by the engine. |

## In the `.flow` file

```json
{
  "id": "conditionNode_E0eqDp5b0fUs",
  "type": "conditionNode",
  "position": { "x": 304, "y": 304 },
  "data": {
    "label": "${dictionary.score} > 25",
    "description": "Enough points for the offer?",
    "labelNode": "Condition",
    "descriptionNode": "Set condition flow direction",
    "open": false,
    "settings": { "value": "${dictionary.score} > 25" }
  },
  "dragHandle": ".drag-handle__custom"
}
```

```json
{ "id": "xy-edge__conditionNode_E0eqDp5b0fUstrue-scriptNode_Kq81LmZx0PaBin", "type": "step",
  "source": "conditionNode_E0eqDp5b0fUs", "sourceHandle": "true",
  "target": "scriptNode_Kq81LmZx0PaB", "targetHandle": "in" },
{ "id": "xy-edge__conditionNode_E0eqDp5b0fUsfalse-endNode_Rr3TtUu7Vv9Win", "type": "step",
  "source": "conditionNode_E0eqDp5b0fUs", "sourceHandle": "false",
  "target": "endNode_Rr3TtUu7Vv9W", "targetHandle": "in" }
```

## How the engine runs it

1. Every `${dictionary.<path>}` and `${session.<key>}` in the expression is replaced by its value written as
   JSON: a number stays `30`, a string becomes `"yes"` (quoted), a boolean `true`, a missing value the literal
   `null`.
2. The result is parsed as one small expression and evaluated with JavaScript semantics. Allowed: number /
   string / boolean / `null` literals; `==` `===` `!=` `!==` `>` `<` `>=` `<=`; `+` `-` `*` `/` `%`; `&&` `||`
   `??`; unary `!` `-` `+`; `a ? b : c`; parentheses.
3. A truthy result continues out of `true`, anything else out of `false`.

Everything else **stops the run with an error** (E2201 "Agent project error", final, with the message `ivm conditionNode: <rule>` —
`ivm conditionNode: Failed to parse condition` when it does not parse — plus one line in the agent's Log Record): a bare name
(`dictionary.score > 25` → *Member access is not allowed*; `yes` → *Identifier "yes" is not allowed*), a function
call, several statements, and **any placeholder whose value is a list or an object** (a list becomes `[…]` →
*Array literals are not allowed*; an object does not parse). `${dictionary.items.length}` is not the length
either: paths walk objects only, so it resolves to `null`.

## Mistakes that break it

| Mistake | What happens | Write instead |
|---|---|---|
| `dictionary.score > 25` (no `${}`) | the run stops: *Member access is not allowed*; keen-validate rejects it | `${dictionary.score} > 25` |
| `${dictionary.answer} == yes` | the run stops: *Identifier "yes" is not allowed* | `${dictionary.answer} == "yes"` |
| `${dictionary.limit} === 10` where an Assignment typed `10` | typed values are strings: `"10" === 10` is false | `==`, or have a Script store a real number |
| `${dictionary.items.length} > 0` or `${dictionary.items}` | `null > 0` is false / the run stops on the list | a Script sets `dictionary.itemCount`; test `${dictionary.itemCount} > 0` |
| `${session.user.plan} == "pro"` meaning a nested object | session is flat: this reads the single key `"user.plan"` | store the plan under its own session key, or read it from the dictionary |
| `next_1` / `next_2` as source handles | keen-validate rejects them (not canvas ids) | `true` / `false` |
| two edges into `in` | keen-validate: single-in | a Join Flow in front |

## Example: route on the LLM's verdict

An LLM was told to answer only `APPROVE` or `REJECT`, and a Script copied its answer into
`dictionary.verdict`. The Condition:

```json
"settings": { "value": "${dictionary.verdict} == \"APPROVE\"" }
```

`true` → the Script that books the order; `false` → an LLM that explains the refusal.
