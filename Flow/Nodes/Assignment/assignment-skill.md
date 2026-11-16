# Assignment (`assignmentNode`)

## Description

Writes a few known values into the flow's **dictionary** and carries on. Use it to seed or update working data
in the middle of a flow: a constant (`status` = `new`), a copy of something already held (`name` =
`${session.userName}`), a sentence built from stored values (`Hello ${dictionary.name}`), a small list
(`${Array(["a", "b"])}`), or a number / boolean carried over from another key.

It writes the dictionary only: never the session, never another flow's dictionary, never the conversation.
It does no logic: no arithmetic, no branching, no reading of Secrets or Settings, no I/O. Use a **Script** for
any of that (it can also write the session), a **Condition** to branch on a value, an **LLM** when the value
must come from a model. It cannot store an **object** (see *Settings*); put an object in the dictionary with a
Script.

## In / Out

**In** — yes, `in`, exactly **one** edge (single-in). Any node's ordinary output may connect into it: Start's
`next`, the `next_1` of LLM, Script, Assignment, Run Flow, Join Flow, Parallel Flows, Parallel Context or a
Summarizer's Out, a Loop's `out` (body) or `next_1` (Finish), a Condition's `true` / `false`, a Script's
`error`, an LLM's Fallback. Not allowed: an LLM's `summary` (only to a Summarizer), a Summarizer's Fallback
(only to another Summarizer), a Flow Pointer's `next` (only into a Parallel Flows `wait`). To bring several paths
into one Assignment, merge them in a **Join Flow** first (a second edge into `in` is a keen-validate error).

**Out** — yes, one: **`next_1`**. It may lead into the `in` of any node that has one (Condition, Loop, LLM,
Script, Assignment, Run Flow, Jump Flow, Join Flow, Parallel Flows, Parallel Context, End Flow) or into a Loop's
`next_2` (to end a loop body). Not into a Summarizer's `in` or a Parallel Flows `wait`. Write one edge from
`next_1`: the canvas refuses a second (the engine would start every target). When `next_1` is unwired the path ends silently after the values are written;
keen-validate warns.

## Fallback

No.

## Error

No error output. A bad value does not fail the node: a value that cannot be stored (an object, or a placeholder
that resolves to nothing) is stored as `null` and the flow carries on. A reference to a missing key is not an
error either. The node fails in two cases, and both discard all of its writes:

- its writes would take the flow's dictionary over its **1.5 MB** cap (a large list copied under a new key counts
  in full): the run stops with **E2201 "Agent project error"** and one line in the agent's Log Record
  (`reason=dictionary-over-cap`, the two sizes, never a value). It is final; the client does not re-send it.
- an unexpected exception inside the node's sandbox: its time or memory limit is E2201 too; anything else is
  E6001 (`ivm assignmentNode: …`), which the client re-sends. A correctly written node does not reach it.

## Settings

Yes. The work is done by the **key / value pairs**; the rest is labelling.

| Field | JSON key | Rule | What it is for |
|---|---|---|---|
| Label | `data.settings.value`, `data.settings.label`, `data.label` | the same short text in all three | the card's title; the engine never reads it |
| Pairs | `data.settings.keyValuePairs` | an array of `{ "key": …, "value": … }`; at most **10**; zero pairs is a valid no-op | each pair writes `dictionary[key] = <resolved value>`, in order |
| `key` | `keyValuePairs[].key` | a string, ≤ 100; **no duplicates** within the node (keen-validate error) | the name of the dictionary property |
| `value` | `keyValuePairs[].value` | a string, ≤ 200; `${dictionary.…}` / `${session.…}` resolve | what is stored |
| Description | `data.description` | optional, ≤ 250 | a note; no effect on running |

**`key` is literal and flat.** It is used as it is: `${…}` in a key is not resolved, and a dot is not a path.
`"user.name"` creates one top-level property literally named `user.name`, which `${dictionary.user.name}` can
never read (that walks `user` then `name`). Use plain names: `userName`, `total`, `status`.

**`value` is resolved, and its type follows these rules:**

| The value is | Stored as |
|---|---|
| plain text with no placeholder (`"1"`, `"new"`, `"true"`) | that **string**. There is no number or boolean coercion: `"1"` is the string `"1"`. |
| exactly one placeholder (`"${dictionary.count}"`) | the referenced value **with its own type**: number stays number, boolean stays boolean, string stays string, a list stays a list |
| text mixed with placeholders (`"Hello ${dictionary.name}"`) | one **string**; a number or boolean is written as text; a list, an object or a missing value becomes an empty string |
| exactly `${Array([…])}` | a **list** of the literals inside; quoted elements may hold placeholders, resolved with their types; if any element is not a plain literal, or resolves to an object or list, the **whole list becomes `[]`** |
| one placeholder that resolves to an **object**, to nothing (missing key, missing session key) or to `null` | **`null`** |
| a JSON number or boolean written in the file (`"value": 5`) | stored as it is. The canvas form writes strings; write strings. |
| a JSON object or `null` written in the file | `null` |

Pairs run **in order** and each sees the writes before it, so a later pair may read an earlier key of the same
node. A key that already exists is overwritten. `${session.…}` is a flat key: `${session.a.b}` reads the one key
`"a.b"`.

## Rotate

Yes. It moves the side where the node's dots are drawn: `data.handlePosition` = `top` (default) / `right` /
`bottom` / `left`, absent from the JSON until someone rotates the node. Cosmetic: it never changes the wiring or
the run. Leave it out when you write the node.

## JSON structure

| Property | Required | What it means and what it is for |
|---|---|---|
| `id` | yes | `assignmentNode_` + exactly 12 characters `A–Z a–z 0–9`, unique in the project. The engine reads the node's kind from the prefix; edges point at this id. A prefix that disagrees with `type` is a keen-validate error; a body that is not 12 characters is a warning. |
| `type` | yes, `"assignmentNode"` | the node's kind for the canvas, the validator and deploy |
| `position.x`, `position.y` | yes | where the card sits, multiples of 16. Not read by the engine; missing → a keen-validate warning. |
| `data.label` | yes (write it) | the card's title, a copy of the Label. Not read by the engine. |
| `data.description` | no | a note under the card, ≤ 250. Not read by the engine. |
| `data.labelNode` | yes, `"Assignment"` | fixed title of this kind; anything else is a keen-validate error. Not read by the engine. |
| `data.descriptionNode` | yes, `"Set properties to the current dictionary"` | fixed subtitle; anything else is a keen-validate error. Not read by the engine. |
| `data.open` | no — leave it out | the canvas no longer reads or writes it (every panel opens closed; one already in a file is kept). Not read by the engine. |
| `data.handlePosition` | no | see *Rotate*. Leave it out. |
| `data.settings.value`, `data.settings.label` | yes (write both) | the Label text. Not read by the engine. |
| `data.settings.keyValuePairs` | no (write it) | the pairs; the only thing the engine reads. Absent or `[]` = nothing is written. Not an array, more than 10 pairs, a pair without a string `key`, a key over 100, a value over 200 or a duplicate key → keen-validate error. A `${x.…}` whose root is not `dictionary` / `session` → warning (it stays literal text). |
| `dragHandle` | yes, `".drag-handle__custom"` | the canvas's drag handle; anything else → warning. Not read by the engine. |

## In the `.flow` file

```json
{
  "id": "assignmentNode_0zrqPkDvJIHc",
  "type": "assignmentNode",
  "position": { "x": 304, "y": 304 },
  "data": {
    "label": "Set defaults",
    "description": "Start values for the offer",
    "labelNode": "Assignment",
    "descriptionNode": "Set properties to the current dictionary",
    "open": false,
    "settings": {
      "value": "Set defaults",
      "label": "Set defaults",
      "keyValuePairs": [
        { "key": "status", "value": "new" },
        { "key": "greeting", "value": "Hello ${dictionary.name}" },
        { "key": "total", "value": "${dictionary.price}" }
      ]
    }
  },
  "dragHandle": ".drag-handle__custom"
}
```

```json
{ "id": "xy-edge__assignmentNode_0zrqPkDvJIHcnext_1-endNode_Rr3TtUu7Vv9Win", "type": "step",
  "source": "assignmentNode_0zrqPkDvJIHc", "sourceHandle": "next_1",
  "target": "endNode_Rr3TtUu7Vv9W", "targetHandle": "in" }
```

## How the engine runs it

1. The node reads `data.settings.keyValuePairs` (none → an empty list).
2. For each pair, in order, the `value` is resolved: the placeholders are looked up (`${dictionary.a.b}` walks
   objects only, no list indexing; `${session.k}` is one flat key) and the result is accepted only if it is a
   string, number, boolean or list; anything else becomes `null`. The result is written to
   `dictionary[key]` at the top level.
3. The dictionary is saved once, after the last pair. The session is not touched.
4. Every edge on `next_1` is started. With no edge, the path ends and nothing is sent.

The node runs inside the flow engine's node sandbox (the default); a run without the sandbox behaves the same.

## Mistakes that break it

| Mistake | What happens | Write instead |
|---|---|---|
| `"value": "10"` then `${dictionary.limit} > 5` meaning a number | the stored `"10"` is a string; `"10" > 5` happens to be true but `=== 10` is false | compare with `==`, or have a Script store a real number |
| `"key": "user.name"` or `"key": "${dictionary.field}"` | one literal property named exactly that; nothing reads it | a plain top-level name |
| `"value": "${dictionary.customer}"` where `customer` is an object | stored as `null` | copy the fields one by one (`${dictionary.customer.name}`), or use a Script |
| `"value": "${dictionary.missing}"` | stored as `null`, not "unchanged" | check the key exists; a mixed text value gives `""` instead |
| `"value": "Items: ${dictionary.items}"` with a list | the list slots in as an empty string: `"Items: "` | a Script that builds the text |
| `${Array([${dictionary.a}, 2])}` | the whole list is `[]`; elements must be literals, placeholders go inside quotes | `${Array(["${dictionary.a}", 2])}` |
| the same key twice in one node | keen-validate error (the second would silently win) | one pair per key |
| 11 pairs, a value over 200 characters | keen-validate error | split over two Assignments, or a Script |
| two edges into `in` | keen-validate: single-in | a Join Flow in front |
| using it to write the session | the session is not touched | a Script |
| `next_1` left unwired | the path ends silently after the write; keen-validate warns | wire it, ending in an End Flow |

## Example: defaults before the branch

A chat flow reads `dictionary.price` (a number a Script stored) and has the customer's name in
`session.userName`. One Assignment prepares three values the Condition and the LLM prompt will use:

```json
"keyValuePairs": [
  { "key": "customer", "value": "${session.userName}" },
  { "key": "price", "value": "${dictionary.price}" },
  { "key": "banner", "value": "Hi ${session.userName}, your price is ${dictionary.price}" }
]
```

`price` stays a number (a single placeholder keeps its type), `banner` is a string, and the next Condition can
test `${dictionary.price} > 25`.
