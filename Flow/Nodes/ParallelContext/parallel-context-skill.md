# Parallel Context (`parallelContextNode`)

## Description

Map-reduce over a dictionary list. The node takes a **list** from the current flow's dictionary and runs **one
template flow once per element**, the runs side by side. Each run starts with a **copy of its element as its whole
dictionary**; when a run reaches its End Flow, its final dictionary **replaces** that element in the list. When
every run has finished, the flow continues out of `next_1` and reads the finished list.

Use it when N items need the same multi-step treatment and the items do not depend on each other: look up a price
for each of 20 products, score each of 10 candidates with an LLM, fetch details for each order id.

- **Loop** walks the list **one item at a time** in this flow (the body runs, comes back into `next_2`, next item).
  Use it when items depend on the previous ones, or when order and pacing matter.
- **Parallel Flows** runs **different** flows (one Flow Pointer each), each from an **empty** dictionary, and
  merges nothing back. Parallel Context runs **one** flow N times and merges each result into its element.

## In / Out

**In** — `in`, exactly **one** edge (single-in). Any ordinary output may connect into it: Start's `next`, the
`next_1` of LLM, Script, Assignment, Run Flow, Join Flow, Parallel Flows, Parallel Context or a Summarizer's Out, a
Loop's `out` / `next_1`, a Condition's `true` / `false`, a Script's `error`, an LLM's Fallback (`error`). Not
allowed: an LLM's `summary` (only to a Summarizer), a Summarizer's Fallback (only to another Summarizer), a Flow
Pointer's `next` (only into a Parallel Flows `wait`). Two paths into one Parallel Context → a **Join Flow** in front.

**Out** — `next_1` only ("Out" on the card). It may lead into the `in` of any node that has one (not a Summarizer)
or into a Loop's `next_2`. It runs **after all the runs have finished** — never while they run. Unwired: the runs
still happen and merge, then this path ends; keen-validate warns (*that path dead-ends*). If nothing else reaches an
End Flow, the person gets no answer.

## Fallback

No.

## Error

No error output. The node itself fails only when merging a run's result back would take the dictionary over its
1.5 MB cap (E2201, final; see *How the engine runs it*). A missing or empty list, a value that is not a list, or a target
flow that does not exist **all skip the fan-out silently** and continue out of `next_1` — no run, no error, no log.

A failure **inside one run** follows the rules of the node that failed (see its file):

- the run ends early without reaching End Flow (a Script throw with no `error` edge, an unwired output) → that
  element is **not** merged — it keeps its value from before; the other runs and `next_1` go on as normal;
- a failure that ends the run (a terminal code such as `E8101 Script time limit reached!`, a cancel) ends **the
  whole run** — the other runs, the merge and `next_1` included.

## Settings

| Field (canvas) | JSON key | Rule | What it is for |
|---|---|---|---|
| Flow Pointer | `data.settings.pipe` | required; a File-Label `^[A-Z][a-zA-Z]*-[A-Z][a-zA-Z]*$`, ≤ 120; a literal (no `${…}`, never interpolated) | the flow run once per element: `<FlowFile>-<StartLabel>`, e.g. `Pricing-Start` |
| Context Collection | `data.settings.contextCollection` | required; starts with `dictionary.`, ≤ 120 | the list to fan out over: a dot path through objects (no `[0]`, no `session.`) |
| Assign result to dictionary property | `data.settings.assignTo` | required by the canvas form (1–80) | **not read by the engine**. Results land in the list itself. Write a name such as `"products"` to keep the form valid |
| Description | `data.description` | ≤ 250 | a note; not read by the engine |

Write `contextCollection` bare (`dictionary.products`). The engine also takes `${dictionary.products}`, and so does the
canvas form; keen-validate accepts both.

## Rotate

Yes. `data.handlePosition` is where **In** sits: `top` (default), `right`, `bottom`, `left`. Out is always on the
opposite side. The key is absent until someone rotates the node. Cosmetic only. Leave it out.

## JSON structure

| Property | Required | What it means and what it is for |
|---|---|---|
| `id` | yes | `parallelContextNode_` + exactly 12 characters `A–Z a–z 0–9`, unique in the project. The engine reads the kind from the prefix; a prefix that disagrees with `type` → keen-validate error; a body not 12 characters → warning. |
| `type` | yes, `"parallelContextNode"` | the node's kind for the canvas, the validator and deploy |
| `position.x`, `position.y` | yes | canvas place, multiples of 16. Not read by the engine; missing → warning. |
| `data.label` | no (write `""`) | not shown by the card and not read by the engine |
| `data.description` | no | ≤ 250, a note. Not read by the engine. |
| `data.labelNode` | yes, `"Parallel Context"` | fixed title; anything else → keen-validate error |
| `data.descriptionNode` | yes, `"Point to the single flow that must be awaited with predefined context"` | fixed subtitle; anything else → keen-validate error |
| `data.open` | no — leave it out | the canvas no longer reads or writes it (every panel opens closed; one already in a file is kept). Not read by the engine. |
| `data.handlePosition` | no | see *Rotate*. Leave it out. |
| `data.settings.contextCollection` | **yes** | the list — read by the engine. Missing → error; not starting with `dictionary.` → error. |
| `data.settings.pipe` | **yes** | the target flow — read by the engine as a literal. Missing → error; not a File-Label → error; a File-Label no flow's Start defines → error (*does not resolve to any flow's Start*). |
| `data.settings.assignTo` | form-required | ignored by the engine; empty → keen-validate warning |
| `dragHandle` | yes, `".drag-handle__custom"` | anything else → warning |

## In the `.flow` file

```json
{
  "id": "parallelContextNode_Pc7Rk2Lm9QwZ",
  "type": "parallelContextNode",
  "position": { "x": 304, "y": 736 },
  "data": {
    "label": "",
    "description": "Price every product at once",
    "labelNode": "Parallel Context",
    "descriptionNode": "Point to the single flow that must be awaited with predefined context",
    "open": false,
    "settings": { "pipe": "Pricing-Start", "contextCollection": "dictionary.products", "assignTo": "products" }
  },
  "dragHandle": ".drag-handle__custom"
}
```

```json
{ "id": "xy-edge__scriptNode_Ld4Pr0dUcTs1next_1-parallelContextNode_Pc7Rk2Lm9QwZin", "type": "step",
  "source": "scriptNode_Ld4Pr0dUcTs1", "sourceHandle": "next_1",
  "target": "parallelContextNode_Pc7Rk2Lm9QwZ", "targetHandle": "in" },
{ "id": "xy-edge__parallelContextNode_Pc7Rk2Lm9QwZnext_1-scriptNode_Fm8TaBlE2xYzin", "type": "step",
  "source": "parallelContextNode_Pc7Rk2Lm9QwZ", "sourceHandle": "next_1",
  "target": "scriptNode_Fm8TaBlE2xYz", "targetHandle": "in" }
```

## How the engine runs it

1. It strips `dictionary.` (and a `${…}` wrapper) from `contextCollection` and walks the path through objects in
   the current flow's dictionary. It looks `pipe` up among the project's flow entries.
2. **Skip:** no path, no `pipe`, an unknown `pipe`, a value that is not a list, or an **empty** list → straight on
   to `next_1`, nothing written.
3. Every element that is not a plain object (a number, a string, `null`, a nested list) is **replaced by `{}`** in
   the list itself, and the list is saved. `[1, 2, 3]` becomes `[{}, {}, {}]` — the values are lost. Wrap them:
   `[{ "sku": "A1" }, …]`.
4. One run per element. Each run starts at the target flow's Start with its **own dictionary = a deep copy of
   its element** (element `{ "sku": "A1" }` → the run reads `${dictionary.sku}`). It cannot see the parent's
   dictionary or its siblings'. A Run Flow / Jump Flow inside the run works on the run's dictionary too.
5. The **session is shared** with the whole run: Scripts and flow nodes in every copy read and write the same
   session (so do not have every run write the same session key — the last one wins). Exception: an **LLM**'s
   `${session.…}` fields read an empty session inside a run — pass such values in the element.
6. How many at once is the chat client's choice: the reference SDK runs them in waves of **15** (the next wave
   starts when every run of the previous one has finished); a site may set another size. 100 elements = 7 waves.
7. **Merge:** when a run reaches **End Flow**, its final dictionary **replaces** `list[i]` — keys it added appear,
   keys it deleted are gone. Each element keeps its index; the order of the list never changes, whatever order
   the runs finish in. A run that ends without End Flow merges nothing.
8. When every run has finished, the flow continues out of `next_1`, and nodes there read the finished list.

The merge reads and writes the list in the **agent's main dictionary** (the start flow's, shared by Run Flow /
Jump Flow). Inside a Parallel Flows branch or inside another Parallel Context run (their own dictionaries), the runs
get `{}` and their results are dropped — put the node on the main path.

The node shows nothing to the person; the runs' nodes behave as they always do. The list grows by what the runs
add, and it counts toward the dictionary's size cap (1.5 MB) — keep elements small. A merge-back that would take the
dictionary over the cap stops the run with **E2201** (final: the client does not re-send it) and one Log Record line naming the collection
and the element (`reason=dictionary-over-cap … collection=dictionary.<path> element=<i>`); nothing is merged.

## Mistakes that break it

| Mistake | What happens | Write instead |
|---|---|---|
| `"contextCollection": "products"` or `session.products` | keen-validate error; at run time no fan-out, `next_1` at once | `dictionary.products` |
| `"pipe": "${dictionary.flow}"` or `"Pricing"` | keen-validate error; the engine never interpolates `pipe` | a literal File-Label, `Pricing-Start` |
| reading the results from `dictionary.<assignTo>` | always empty — `assignTo` is ignored | read the list itself: `dictionary.products` |
| a list of strings / numbers | each element becomes `{}`; the runs get nothing | a list of objects `[{ "sku": "A1" }]` |
| the template flow has no End Flow on some path | that element is not merged; nothing reports it | end every path of the template flow in an End Flow |
| `${session.lang}` in an LLM inside the template flow | empty | put `lang` in each element: `${dictionary.lang}` |
| a Condition testing `${dictionary.products}` after the node | the run stops: a list cannot be tested | a Script counts / checks, stores a number or flag |
| two edges into `in` | keen-validate: single-in | a Join Flow in front |
| the node inside a Parallel Flows branch or a Parallel Context run | the runs start from `{}`, nothing merges | keep it on the agent's main path |

## Example: price every product at once

`Shop.flow`: a Script `products/load.js` stores
`dictionary.products = [{ "sku": "A1", "name": "Lamp" }, { "sku": "B7", "name": "Desk" }]` → **Parallel Context**
(`contextCollection` `dictionary.products`, `pipe` `Pricing-Start`) → a Script `products/summary.js` that builds
the text an LLM then presents.

`Pricing.flow` (Start label `Start`): Start → Script `pricing/lookup.js` with the pair `sku` = `${dictionary.sku}`,
which calls the price API and sets `dictionary.price` → End Flow. Its `error` → an Assignment that sets
`priceError` = `unavailable` → the same End Flow.

After the node: `[{ "sku": "A1", "name": "Lamp", "price": 49 }, { "sku": "B7", "name": "Desk", "priceError": "unavailable" }]`.
