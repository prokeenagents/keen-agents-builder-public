# Parallel Flows (`parallelInNode`)

## Description

Runs several **different** flows at the same time, waits until **all** of them have finished, then continues
out of **Out** (`next_1`). Use it when independent pieces of work can happen side by side and the next step
needs all of them: prices from two suppliers, a customer record and an order history, three checks that do
not depend on each other. The time taken is about that of the slowest flow.

It never works alone. **Which flows run is declared by Flow Pointer nodes** (`parallelFlowNode`, see
`../FlowPointer/flow-pointer-skill.md`): one Flow Pointer per flow, each wired into this node's `wait` handle.
No Flow Pointer, no parallel work.

Each started flow (a **branch**) runs on its **own empty dictionary** and never sees the caller's dictionary or
another branch's; when it ends its dictionary is thrown away. All branches and the caller share the run's
**session**. So values go in and come back through the session (or the conversation via `system/agent`),
never through the dictionary.

Use something else when:

- the same flow must run once per item of a list → **Parallel Context** (it also merges each run's dictionary
  back into its item);
- one other flow must run and its dictionary writes must come back → **Run Flow** (shared dictionary);
- the steps depend on each other → plain nodes in a row;
- you only want two paths to meet → **Join Flow** (it does not wait for anything).

## In / Out

- **In:** two input handles.
  - `in` — takes **several** edges. Any ordinary output may lead into it: Start Flow `next`; the `next_1` of
    LLM, Script, Assignment, Run Flow, Join Flow, Parallel Flows, Parallel Context, a Summarizer's Out; LLM /
    Script `error`; Condition `true` / `false`; Loop `out` / `next_1`. Not an LLM's `summary` or a Summarizer's
    Fallback. **Every arrival runs the node again** and starts every branch again.
  - `wait` — takes **several** edges, and **only from a Flow Pointer's `next`**. Anything else into `wait` is
    a keen-validate error and the canvas refuses it. One edge per Flow Pointer = one branch.
- **Out:** `next_1` (Out). It may lead to the `in` of any node that has one, or to a Loop's `next_2`; not to a
  Summarizer, a Parallel Flows `wait`, Start Flow, Flow Pointer or Note. It runs **once, after the last branch
  has finished**. Unwired: the branches still run and are waited for, then the run ends there — the person
  gets no answer unless something else answers; keen-validate warns.

## Fallback

No.

## Error

No error output. The node itself does not fail on a bad Flow Pointer: a pointer whose target is not a flow
entry is **skipped silently** and the other branches run. What a failing branch does:

- **Its own handled failure** (a Script's or an LLM's `error` edge) stays inside the branch, like in any flow.
- **A Script that throws with no `error` edge** ends that branch's path there; the branch counts as finished,
  and Out still runs once the others finish. Session writes made before the throw are kept.
- **A final error** in any branch — `E2…` (for example `E2201 Agent project error`), `E3…`, or `E8…` (for
  example `E8101 Script time limit reached!`; the 15-minute limit is per Script node run) —
  **ends the whole run**: every other branch is stopped, Out never runs, and the person gets that error.
- Other errors (`E4…`–`E7…`, the platform being busy) are retried by the client, and the wait goes on.

## Settings

The engine reads **no** setting of this node. Two canvas fields exist:

| Field (canvas) | JSON key | Rule | What it is for |
|---|---|---|---|
| Condition | `data.label` | optional, ≤ 60; no `${…}` | only the card's title. Despite its name it is **not** a condition and gates nothing |
| Assign results to dictionary property | `data.settings.value` | optional, ≤ 60 | **ignored by the engine**: no result is ever written into the dictionary. Leave it out |
| Description | `data.description` | optional, ≤ 250 | a note under the card |

## Rotate

Yes. `data.handlePosition` = `top` (default) / `right` / `bottom` / `left` names the side of `in`; `wait` sits
on the next side clockwise (`right` by default) and Out on the side opposite `in`. Absent from the JSON until
someone rotates the node. Cosmetic: never changes the wiring or the run. Leave it out.

## JSON structure

| Property | Required | What it means and what it is for |
|---|---|---|
| `id` | yes | `parallelInNode_` + exactly 12 characters `A–Z a–z 0–9`, unique in the project. The deploy step collects the `wait` list only for ids with this prefix. A prefix that disagrees with `type` is a keen-validate error; a body that is not 12 characters is a warning. |
| `type` | yes, `"parallelInNode"` | the node's kind for the canvas, the validator and deploy |
| `position.x`, `position.y` | yes | where the card sits, multiples of 16. Not read by the engine; missing → a keen-validate warning. |
| `data.label` | no | the card's title (the "Condition" field). Not read by the engine. |
| `data.description` | no | a note, ≤ 250. Not read by the engine. |
| `data.labelNode` | yes, `"Parallel Flows"` | fixed; anything else is a keen-validate error. Not read by the engine. |
| `data.descriptionNode` | yes, `"Execute many flows in parallel with private context"` | fixed; anything else is a keen-validate error. Not read by the engine. |
| `data.open` | no (write `false`) | whether the settings panel is open. Not read by the engine. |
| `data.handlePosition` | no | see *Rotate*. Leave it out. |
| `data.settings` | yes (write `{}`) | no key in it is read. `value` (the "Assign results" field) is ignored; do not write one. |
| `dragHandle` | yes, `".drag-handle__custom"` | the canvas's drag handle; anything else → a warning. Not read by the engine. |

## In the `.flow` file

The node, two Flow Pointers and the edges (the pointers' JSON is explained in the Flow Pointer file):

```json
{ "id": "parallelInNode_Pq7RsT2uVw9x", "type": "parallelInNode", "position": { "x": 304, "y": 736 },
  "data": { "label": "Both prices", "description": "Ask both suppliers at once",
            "labelNode": "Parallel Flows",
            "descriptionNode": "Execute many flows in parallel with private context",
            "open": false, "settings": {} },
  "dragHandle": ".drag-handle__custom" },
{ "id": "parallelFlowNode_AcmEpr1ceFlw", "type": "parallelFlowNode", "position": { "x": 592, "y": 640 },
  "data": { "label": "PriceAcme-Start", "description": "", "labelNode": "Flow Pointer",
            "descriptionNode": "Point to the flow that must be awaited", "open": false,
            "settings": { "value": "PriceAcme-Start", "label": "PriceAcme-Start" } },
  "dragHandle": ".drag-handle__custom" },
{ "id": "parallelFlowNode_BoltPr1ceFlw", "type": "parallelFlowNode", "position": { "x": 592, "y": 832 },
  "data": { "label": "PriceBolt-Start", "description": "", "labelNode": "Flow Pointer",
            "descriptionNode": "Point to the flow that must be awaited", "open": false,
            "settings": { "value": "PriceBolt-Start", "label": "PriceBolt-Start" } },
  "dragHandle": ".drag-handle__custom" }
```

```json
{ "id": "xy-edge__scriptNode_SaveQuery001next_1-parallelInNode_Pq7RsT2uVw9xin", "type": "step",
  "source": "scriptNode_SaveQuery001", "sourceHandle": "next_1",
  "target": "parallelInNode_Pq7RsT2uVw9x", "targetHandle": "in" },
{ "id": "xy-edge__parallelFlowNode_AcmEpr1ceFlwnext-parallelInNode_Pq7RsT2uVw9xwait", "type": "step",
  "source": "parallelFlowNode_AcmEpr1ceFlw", "sourceHandle": "next",
  "target": "parallelInNode_Pq7RsT2uVw9x", "targetHandle": "wait" },
{ "id": "xy-edge__parallelFlowNode_BoltPr1ceFlwnext-parallelInNode_Pq7RsT2uVw9xwait", "type": "step",
  "source": "parallelFlowNode_BoltPr1ceFlw", "sourceHandle": "next",
  "target": "parallelInNode_Pq7RsT2uVw9x", "targetHandle": "wait" },
{ "id": "xy-edge__parallelInNode_Pq7RsT2uVw9xnext_1-agentNode_CompareOffr1in", "type": "step",
  "source": "parallelInNode_Pq7RsT2uVw9x", "sourceHandle": "next_1",
  "target": "agentNode_CompareOffr1", "targetHandle": "in" }
```

## How the engine runs it

1. At deploy, every edge from a Flow Pointer into this node becomes one entry of its `wait` list, in the
   order the edges appear in the file. The deploy looks only at the source's kind, not the target handle, so a Flow
   Pointer wired into `in` would also start a branch — always wire it into `wait`.
2. When the run reaches the node, the engine reads each listed pointer's `settings.value`, looks the entry
   (`File-Label`) up among the project's Start nodes (any flow file) and starts one branch per entry found.
   An empty or unknown entry is skipped without a word; with no branch at all, Out runs at once.
3. Each branch begins at its Start node with a **new, empty dictionary** of its own. A Run Flow or Jump Flow
   inside the branch shares that branch's dictionary. Nothing is copied in from the caller.
4. All branches and the caller use the **same session**. Session writes are stored key by key, so branches
   writing **different** keys never overwrite each other; the same key from two branches → the last write
   wins. Session values are primitives only (string, number, boolean, null), 1.5 MB in all.
5. All branches run **at the same time**; there is no cap on how many, and they finish in any order.
6. The client that drives the run holds Out until **every** branch has finished (reached an End Flow or run
   out of nodes), then continues the caller at `next_1` — once.
7. When a branch ends, its dictionary is deleted. **Nothing merges back**: the caller's dictionary after Out
   is exactly what it was before the node. Results come back only through what the branches wrote to the
   session (or the conversation, `system/agent`).
8. An LLM node inside a branch **streams its text to the person's chat** like every LLM node (by design: the client gets every node's answer
   and its token use; the site shows branch answers in its accordion), but its answer is not the chat's saved answer —
   let an LLM after Out answer the person, and keep branch LLMs short or prefer Script work in branches.
9. Getting data into a branch: write it to the session before this node and read `${session.<key>}` in the
   branch; or, in a branch started from the agent's main flow, a Script can read the caller's dictionary with
   `system/dictionary` `get({ flowID: flowContext.parentFlowId, path })` (read-only).

## Mistakes that break it

| Mistake | What happens | Write instead |
|---|---|---|
| a branch writes its result to `dictionary.x`, the caller reads `${dictionary.x}` after Out | empty: the branch's dictionary is discarded | the branch's Script writes `Session.setSessionValue('x', …)`; read `${session.x}` |
| the branch reads `${dictionary.query}` the caller set | empty: the branch starts with an empty dictionary | the caller puts it in the session first |
| `"settings": { "value": "results" }` expecting results there | nothing is written | `"settings": {}`; use the session |
| two branches write the same session key | the last one wins, the other result is lost | one key per branch (`priceAcme`, `priceBolt`) |
| storing a list or object in the session | that Script node fails (session values must be primitive) | a number / string per key, or `JSON.stringify` and parse it later |
| no Flow Pointer into `wait` | no branch runs; Out continues at once | one Flow Pointer per flow, into `wait` |
| an edge into `wait` from any other node | keen-validate error; the canvas refuses it | only Flow Pointer `next` → `wait` |
| two paths into `in` | the node runs twice: every branch runs twice | let only one path reach it |
| a Script without `error` in a branch, relied on for a result | a throw ends that branch silently; the key is just missing after Out | wire `error`; write a fallback value (`priceAcme = null`) there |
| a slow branch near the 15-minute run limit | `E8101` ends the **whole** run | keep branches short; set your own HTTP time-outs |
| using it as a barrier for two paths of the same flow | not possible: it starts flows, it does not wait for paths | put each piece of work in its own flow file |

## Example: prices from two suppliers at once

`Quote.flow` (the agent's main flow): Start → Script `quote/save-query.js` (reads the person's message with
`system/agent`, writes `Session.setSessionValue('product', 'tyre 205/55 R16')`) → **Parallel Flows** with two
Flow Pointers `PriceAcme-Start` and `PriceBolt-Start` → LLM "Compare" whose system prompt says
`Acme: ${session.priceAcme} EUR. Bolt: ${session.priceBolt} EUR. Recommend the cheaper one; if a price is empty,
say that supplier did not answer.` → End Flow.

`PriceAcme.flow`: Start `Start` → Script `prices/acme.js` → End Flow, with the Script's `error` also wired to
the End Flow. `PriceBolt.flow` is the same with `prices/bolt.js`:

```js
import Http from 'system/http';
import Session from 'system/session';

export async function exec() {
    const product = Session.getSessionValue('product') ?? '';
    const res = await Http.getJson(`https://api.acme.example/price?q=${encodeURIComponent(product)}`);
    Session.setSessionValue('priceAcme', res.ok && typeof res.body?.price === 'number' ? res.body.price : null);
}
```

Both suppliers are asked at the same time; the LLM runs once, after both Scripts have finished.
