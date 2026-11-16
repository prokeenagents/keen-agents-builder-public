# Loop (`loopNode`)

## Description

A `for … of` on the flow. It reads a **list** from the dictionary, writes its first element into another
dictionary key, and runs the **body**: the nodes wired from **`out`**. The body's last node wires back into the
Loop's **`next_2`**. The Loop then writes the next element and runs the body again. After the last element it
continues out of **`next_1`** (Finish). One element at a time, in order, in this flow and on this flow's
dictionary.

Use it when the same steps must run for every item and each step may depend on the one before: for each order
line compute a total, for each address call an API, for each question ask an LLM. Keep the body short. A Script
that loops over a small list inside its own code is often simpler than a Loop around a one-node body. Use the
Loop when the body needs several nodes, an LLM, a Condition or a Run Flow.

**Loop vs Parallel Context.** Parallel Context runs **another flow** once per item, **in parallel** (in waves of up to 15), each run on
its own copy of the item, and merges the results back into the list. The Loop runs **this flow's** body
**one item at a time**. The body sees and changes the shared dictionary, so a running total or a "stop at the
first match" flag works. Pick the Loop when the order matters or the items depend on each other. Pick Parallel
Context when the items are independent and time matters.

## In / Out

**In: two handles.**

- **`in`** (the entry, multi-in): any node's ordinary output may connect into it. That means Start `next`, the
  `next_1` of LLM / Script / Assignment / Run Flow / Join Flow / Parallel Flows / Parallel Context /
  Summarizer, a Condition's `true` / `false`, a Script's or LLM's `error`, and an outer Loop's `out` or
  `next_1`. Three outputs may not connect here: an LLM's `summary`, a Summarizer's Fallback and a Flow
  Pointer's `next`.
- **`next_2`** (the body's return, **single-in**): exactly **one** edge, from the body's last node. Any of the
  outputs above may be that edge: a Script's `next_1`, a Condition's branch, a Run Flow's `next_1`, an inner
  Loop's `next_1`. When two paths of the body must both return, merge them in a **Join Flow** first. The
  canvas refuses an edge from the Loop to itself.

**Out: two handles.**

- **`out`** (the body): one edge to the **first node of the body**. It may go to the `in` of any node that has
  one, except a Summarizer, and never to a Parallel Flows `wait`. The canvas allows one edge per output.
- **`next_1`** (Finish): taken once, after the last element. It may go where `out` may, and also into an outer
  Loop's `next_2` when this Loop is the last step of an outer body.

Write the canvas ids. At deploy, `out` becomes the engine key `next_2`, and `next_1` stays `next_1`.
keen-validate rejects `next_2` as a source handle on a Loop. The deploy drops **target** handles, so at run
time the engine cannot tell an arrival on `in` from one on `next_2`. What it does depends only on whether the
Loop is mid-iteration (see *How the engine runs it*). Still write `next_2` for the return: that is the
canvas's wiring.

- **The body never returns into `next_2`:** the body runs once, for the first element, and its path ends.
  Finish never runs, and if nothing else reaches an End Flow, the person gets no answer. keen-validate does
  **not** detect this.
- **`out` unwired:** the Loop has no body and goes straight to Finish without writing **Set to**.
  keen-validate warns.
- **`next_1` unwired:** every element runs, then the path ends silently. keen-validate warns.

## Fallback

No.

## Error

No error output. A bad setting **stops the run**. The run is answered with **`E2201` "Agent project error"**,
which is final, so the client does not re-send it. The agent's Log Record gets one line:
`Flow node failed: node=<id> type=loopNode error=<class> req=<requestId> — it was refused: <rule>; the run
stopped at this node.` The `<rule>` is one of these:

- `LoopNode: invalid "value" — expected "dictionary.<path>" or "session.<key>"`: Read from is empty, or not
  prefixed (`items`, `dict.items`).
- `LoopNode: invalid "setto" — expected "dictionary.<path>" or "session.<key>"`: the same for Set to.
- `Session key '<key>': type 'object' is not allowed; session values must be primitive (string, number,
  boolean, null)`: Set to is `session.<key>` and the element is an object or a list.

A missing value, a value that is **not a list**, and an **empty list** are **not** errors. The Loop goes to
Finish silently and writes nothing into Set to.

## Settings

| Field (canvas) | JSON key | Rule | What it is for |
|---|---|---|---|
| Read from | `data.settings.value` | required; ≤ 120 (the form's schema; its input box stops typing at 60, so stay ≤ 60); must start `dictionary.` or `session.` | **which key** holds the list |
| Set to | `data.settings.setto` | same rules; must differ from Read from | **which key** receives the current element on each pass |
| Description | `data.description` | ≤ 250 | a note; not read by the engine |

Both fields are **references** to a key, not values. `dictionary.order.lines` names the key. An optional
`${…}` wrapper around the whole reference (`${dictionary.order.lines}`) means the same thing; it is **not**
evaluated. A dictionary path may be nested (`dictionary.order.lines`) and walks through objects only, so
`dictionary.orders.0` resolves to nothing and the Loop finishes. A session reference is one flat key.

The prefix rule differs between the three checks:

- **The canvas form** accepts any text and only checks the required, ≤ 120 and "must differ" rules. A bare
  `items` saves fine on the canvas.
- **The engine** throws on a bare name. The run stops (see *Error*).
- **keen-validate** errors on an empty field, on a field that does not match
  `^(\$\{)?(dictionary|session)\..+`, and on Read from = Set to. A half wrapper such as `${dictionary.items`
  passes keen-validate but throws in the engine, so write the wrapper whole or leave it out.

In practice, write **`dictionary.`** in both fields. A session value can never be a list, so a `session.`
Read from always finishes at once. A `session.` Set to works only when every element is a string, number,
boolean or null.

## Rotate

Yes. `data.handlePosition` says where **In** sits: `top` (the default), `right`, `bottom` or `left`. The other
handles follow it. With the default, **Out** is at the bottom, **Next** (`next_2`) on the left and **Finish**
(`next_1`) on the right. The key is absent until the node is rotated. It is cosmetic and never changes the
wiring or the run, so leave it out.

## JSON structure

| Property | Required | What it means and what it is for |
|---|---|---|
| `id` | yes | `loopNode_` + exactly 12 characters `A–Z a–z 0–9`, unique in the project. The engine keeps the iteration's state under this id. A prefix that disagrees with `type` is a keen-validate error; a body that is not 12 characters is a warning. |
| `type` | yes, `"loopNode"` | the node's kind for the canvas, the validator and deploy |
| `position.x`, `position.y` | yes | canvas place, multiples of 16. Not read by the engine; missing → a keen-validate warning. |
| `data.label` | no (write `""`) | the card shows it above the icon; the canvas creates it empty and the form never sets it. Not read by the engine. |
| `data.description` | no | a note under the card, ≤ 250. Not read by the engine. |
| `data.labelNode` | yes, `"Loop"` | the fixed title; anything else is a keen-validate error. Not read by the engine. |
| `data.descriptionNode` | yes, `"Loop dictionary iterable segment"` | the fixed subtitle; anything else is a keen-validate error. Not read by the engine. |
| `data.open` | no (write `false`) | whether the settings panel is open on the canvas. Not read by the engine. |
| `data.handlePosition` | no | see *Rotate*. Leave it out. |
| `data.settings.value` | **yes** | Read from, see *Settings*. Read by the engine. No `${…}` evaluation. Empty or unprefixed → a keen-validate error. |
| `data.settings.setto` | **yes** | Set to, see *Settings*. Read by the engine. The same rules apply, and it must differ from `value` (keen-validate error). |
| `dragHandle` | yes, `".drag-handle__custom"` | the canvas's drag handle. Anything else → a keen-validate warning. Not read by the engine. |

## In the `.flow` file

The Loop, a one-Script body that returns into `next_2`, and Finish → End Flow:

```json
{
  "id": "loopNode_Lp4Wq9Rt2Xs7",
  "type": "loopNode",
  "position": { "x": 304, "y": 304 },
  "data": {
    "label": "",
    "description": "For each order line",
    "labelNode": "Loop",
    "descriptionNode": "Loop dictionary iterable segment",
    "open": false,
    "settings": { "value": "dictionary.order.lines", "setto": "dictionary.line" }
  },
  "dragHandle": ".drag-handle__custom"
}
```

```json
{ "id": "xy-edge__loopNode_Lp4Wq9Rt2Xs7out-scriptNode_Ln7Tt3Qa8Kd1in", "type": "step",
  "source": "loopNode_Lp4Wq9Rt2Xs7", "sourceHandle": "out",
  "target": "scriptNode_Ln7Tt3Qa8Kd1", "targetHandle": "in" },
{ "id": "xy-edge__scriptNode_Ln7Tt3Qa8Kd1next_1-loopNode_Lp4Wq9Rt2Xs7next_2", "type": "step",
  "source": "scriptNode_Ln7Tt3Qa8Kd1", "sourceHandle": "next_1",
  "target": "loopNode_Lp4Wq9Rt2Xs7", "targetHandle": "next_2" },
{ "id": "xy-edge__scriptNode_Ln7Tt3Qa8Kd1error-endNode_Ed5Hj2Kp6Mn3in", "type": "step",
  "source": "scriptNode_Ln7Tt3Qa8Kd1", "sourceHandle": "error",
  "target": "endNode_Ed5Hj2Kp6Mn3", "targetHandle": "in" },
{ "id": "xy-edge__loopNode_Lp4Wq9Rt2Xs7next_1-endNode_Ed5Hj2Kp6Mn3in", "type": "step",
  "source": "loopNode_Lp4Wq9Rt2Xs7", "sourceHandle": "next_1",
  "target": "endNode_Ed5Hj2Kp6Mn3", "targetHandle": "in" }
```

The Script sits ~432 px below the Loop at `(304, 736)`, and the End Flow to the right of the Loop.

## How the engine runs it

1. **Parsing the settings.** On every arrival the engine first parses Read from and Set to. A field that is
   not `dictionary.<path>` / `session.<key>` (with or without the whole `${…}`) stops the run with `E2201`.
2. **Mid-iteration or not.** The Loop keeps its state in the current flow's dictionary at
   `__loops.<this node's id>` = `{ snapshot, index }`. If that state exists, the arrival is a **return**
   (step 5). Otherwise it is a **start** (step 3). The handle the edge arrived on plays no part.
3. **Start.** The engine reads the value at Read from. If the value is missing, is not a list, or is empty,
   or if `out` has no edge, the Loop goes to **Finish**. Nothing is written into Set to and no state is
   left behind.
4. **First element.** Otherwise the engine takes a **deep copy** of the list: the snapshot. It writes
   element `[0]` into Set to and stores `{ snapshot, index: 0 }`. It commits the dictionary, plus the session
   when Set to is a `session.` key, and runs the body.
5. **Return.** The engine moves the index on by one. Past the end, it deletes this Loop's state (and
   `__loops` when that is now empty) and goes to **Finish**. Otherwise it writes `snapshot[index]` into Set
   to, commits, and runs the body again.
6. **What Set to holds.** It holds a **copy** of the element as it was when the loop started. Set to may be a
   nested path; missing or non-object parts of the path are replaced with `{}` on the way. The body may read
   the element (`${dictionary.line.qty}`, or `dictionary.line` in a Script) and change it. Those changes do
   not reach the list or the snapshot. To keep results, write them to **another key** (a total, a results
   list). After Finish, Set to still holds the **last** element.
7. **Changing the list.** The body may change or replace the list at Read from. That is kept in the
   dictionary but does not change the iteration, which walks the snapshot. Removing an item skips nothing,
   and adding one does not add a pass.
8. **Index and position.** The current index is only inside `__loops`, which is the engine's own key, so
   never read or write it. When the body needs a position or count, let a Script keep its own counter in the
   dictionary.
9. **Nested loops.** Each Loop has its own state under its own id, so an inner Loop inside an outer body
   works. Wire the inner Finish into the outer `next_2`, directly or through the rest of the outer body.
   The inner Loop clears its state on Finish. On the outer Loop's next pass, the inner Loop starts fresh and
   reads its list again. It may read that list from the current outer element (`dictionary.order.lines`).
10. **Limits.** The Loop has no cap on the number of passes and no time limit of its own. Each pass costs
    one Loop step plus the body's steps. A long loop still runs into the run-wide limits of its body's nodes,
    such as the Script's 15 minutes per Script node run. The
    snapshot is held in the dictionary next to the list and the element, so a list counts about **twice**
    against the dictionary's **1.5 MB** cap. A commit over the cap stops the run with **E2201** "Agent project
    error" (final: the client does not re-send it) and one Log Record line
    `Flow node failed: … reason=dictionary-over-cap bytes=<n> cap=<cap> …` (`session-over-cap` for a `session.` Set
    to). Nothing of the node is written. Keep large lists out of a Loop; store ids and fetch per item.
11. **A body path that never returns.** If a body path stops (an End Flow, a Jump Flow, an unwired output),
    the Loop's state stays in the dictionary until the run ends. If the same run reaches this Loop again,
    the engine takes that arrival as a **return** and continues from the old index; it does not restart.
12. **What the person sees.** Nothing. The Loop writes no chat message. Only the body's nodes (an LLM, a
    Script's `system/agent` writes) produce output.

## Mistakes that break it

| Mistake | What happens | Write instead |
|---|---|---|
| Read from `items` / `order.lines` (no prefix) | the run stops: `LoopNode: invalid "value"`, `E2201`; keen-validate error | `dictionary.items` |
| Read from `session.cart` | a session value is never a list → straight to Finish, the body never runs | keep the list in the dictionary |
| Set to `session.line` with object elements | the run stops: `Session key 'line': type 'object' is not allowed` | `dictionary.line` |
| the body's last node not wired back into the Loop | one pass, then the path ends; Finish never runs | wire it into `next_2` |
| two body paths both wired into `next_2` | keen-validate: single-in | merge them in a Join Flow, then one edge into `next_2` |
| a Condition in the body sends one branch elsewhere to "skip" an item | that branch ends the loop for good, and the state stays behind | route both branches back (through a Join Flow) |
| Set to under Read from (`dictionary.items.current`) | the first write replaces the list with `{}`; the iteration still runs from the snapshot, but the list is gone | a separate key: `dictionary.item` |
| expecting changes to Set to to land in the list | they change only the copy | write results to their own key |
| `out` / Finish written as `next_2` / `finish` | keen-validate rejects the handle | `out` and `next_1` |
| a 5 000-row list in the dictionary | the snapshot doubles it → over 1.5 MB: the run stops with E2201 and a `dictionary-over-cap` line | page the list; keep ids only |
| a body that Run-Flows the flow holding this same Loop | the same node id shares one state → passes jump | do not recurse through a looping flow |

## Example: total each order line

A Script fetched the order into `dictionary.order`, with `lines` = `[{ "sku": "A1", "qty": 2, "price": 9.5 }, …]`.
The Loop walks the lines, and a Script prices each one and adds it to the order total. When all lines are done,
an LLM answers with the total.

```json
"settings": { "value": "dictionary.order.lines", "setto": "dictionary.line" }
```

`out` → the Script `orders/price-line.js` (no key / value pairs: it reads `dictionary.line`). The Script's
`next_1` → the Loop's `next_2`, and its `error` → an LLM that apologises. The Loop's `next_1` → the LLM that
answers with `${dictionary.orderTotal}`.

```js
// src/scripts/orders/price-line.js
export async function exec() {
    const line = dictionary.line;                       // the current element (a copy)
    const qty = Number(line?.qty), price = Number(line?.price);
    if (!Number.isFinite(qty) || !Number.isFinite(price)) throw new Error(`bad line ${line?.sku}`);
    const total = Math.round(qty * price * 100) / 100;
    dictionary.lineTotals = [...(dictionary.lineTotals ?? []), { sku: line.sku, total }];
    dictionary.orderTotal = Math.round(((dictionary.orderTotal ?? 0) + total) * 100) / 100;
    return { ok: true };
}
```

Reset `orderTotal` and `lineTotals` in a Script before the Loop. An Assignment would store a typed `0` as the
string `"0"`, and `+` would then join text. Without the reset, a second order in the same run starts from the
first order's sums.
