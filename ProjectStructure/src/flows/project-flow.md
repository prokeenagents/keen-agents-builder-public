# `src/flows/<Name>.flow`

## Description

One flow: a graph of **nodes** wired by **edges**, saved as JSON. A person draws it on the canvas; you write the
same file by hand, so it must be a file the canvas would have saved.

Who reads it:

- **keen-validate** parses it and checks the file, every node, every edge, and every name it points to.
- **The deploy service** compiles it: each node becomes an engine step whose outputs are the targets of its
  edges, and each Start node with a label becomes an entry `<Name>-<Label>`. The `.flow` file itself is not
  kept on the platform.
- **The engines** run the compiled steps. They read a node's `id` (its kind comes from the id's prefix) and its
  `data.settings`; the canvas fields (`position`, `labelNode`, …) are never read.

This file covers the file as a whole. **The nodes themselves are in the node skill:**
`../../../Flow/Nodes/SKILL.md` (the map, handle table, data rules) and one
file per node next to it. Read the node's file before you write or change that node.

## Location and name

`src/flows/<Name>.flow` — PascalCase, letters only. Folder rules, naming and how many flows: `flows.md`.

## Structure

Top level is exactly `{ "nodes": [ … ], "edges": [ … ] }`.

| Property | Required | What it means and what it is for |
|---|---|---|
| `nodes` | yes | an array of node objects (may be empty, then the flow does nothing) |
| `edges` | yes | an array of edge objects; control only, never data |
| anything else | no | the canvas drops it on the next save; keen-validate warns |

A node (full detail per type in the node skill):

| Property | Required | What it means and what it is for |
|---|---|---|
| `id` | yes | `<type>_` + exactly 12 characters `A–Z a–z 0–9`; **unique in the whole project**, not just the file. The engine reads the node's kind from the prefix |
| `type` | yes | the node type (`startNode`, `agentNode`, `scriptNode`, …); must agree with the id's prefix |
| `position` | yes | `{ "x": …, "y": … }`, numbers, multiples of 16; canvas only |
| `data` | yes | `label`, `description`, the fixed `labelNode` / `descriptionNode`, `open`, `settings` (the only part the engine reads), optional `handlePosition` |
| `dragHandle` | yes | always `".drag-handle__custom"` |

An edge has exactly these fields:

| Property | Required | What it means and what it is for |
|---|---|---|
| `id` | yes | `xy-edge__<source><sourceHandle>-<target><targetHandle>`; not read by the deploy or the engines |
| `type` | yes | `"step"` |
| `source`, `sourceHandle` | yes | the node and its output handle (canvas ids: `next`, `true`, `false`, `out`, `next_1`, `error`, `summary`) |
| `target`, `targetHandle` | yes | the node and its input handle (`in`, `next_2`, `wait`) |

Both ends of an edge must be nodes **of this file**. Flows reach each other only by entry names, never by edges.

**Entries.** Every Start node whose `data.settings.label` is set registers `<FileName>-<Label>`
(`Orders.flow` + `Refund` → `Orders-Refund`). The deploy reads **only** `settings.label`; a Start with only
`settings.value` registers nothing. A file with no Start node has no entry: nothing can run it.

## Rules and validation

keen-validate — the file (errors unless marked):

- `cannot read: …` · `invalid JSON: <parser message>`
- `top level must be an object { nodes, edges }`
- `` `nodes` must be an array ``
- (warning) `` `edges` missing or not an array — treating as [] ``
- (warning) `unexpected top-level key "<k>" — the canvas keeps only { nodes, edges } and drops the rest`
- `node is not an object` · `node has no string id`

keen-validate — edges (checked per file):

- `edge is not an object` · `edge.source "<id>" is not a node in this flow` · `edge.target "<id>" is not a node in this flow`
- `edge has no sourceHandle` · `edge has no targetHandle`
- `sourceHandle "<h>" is not valid on <type> (valid: …)` · `targetHandle "<h>" is not valid on <type> (valid: …)`
- `handle "<h>" on <type> is single-in but has <n> incoming edges`
- `wait handle accepts only parallelFlowNode sources (got <type>)`
- (warning) `edge.type "<t>" — the canvas writes "step"`
- (warning) `<type> is not reachable from any Start node`

keen-validate — across files: a node target or flow tool that matches no entry →
`<type> target "<File-Label>" does not resolve to any flow's Start (File-Label). Known entries: …`; a Script node
whose file is missing → `Script file "<path>" not found under src/scripts/`. Node-level rules (ids, labels,
settings, Summary output) are listed in each node's file.

The deploy service (the whole deploy is refused; nothing goes live):

- `flows/<file>: invalid JSON — <parser message>`
- the Summary-output refusals, as `flows/<file>: <node id> — <words>` (see the LLM and Summarizer node files)
- the file's shape: `flows/<file>: the top level must be an object with "nodes" and "edges" lists`,
  `"nodes" must be a list`, `"edges" must be a list`, `node #<n> is not an object`, `node #<n> has no id`,
  `edge #<n> is not an object` (numbers count from 1).

**A node id used twice** — in one file or in two flows — is refused by keen-validate (`the node id is used twice in this
file` / `the node id is used again in <file>`) and by the deploy (`flows/<file>: <id> — the node id is used again in
flows/<other>`). The engines merge every flow's nodes into one map, so a repeated id that got past these checks
would silently replace the other node. Generate a fresh 12-character body for every node, also when you copy a node from
another file.

## Limits

- No limit on a file's size or its number of nodes or edges beyond the bundle cap (**50 MB** zipped, the
  platform as shipped). Keep flows small enough to read: split by job and call with Run Flow.
- Start label: one capital letter, then letters, at most 60; at least 3 when it is an agent's Start Node.
- An entry name is `File-Label`, both parts letters only: `^[A-Z][a-zA-Z]*-[A-Z][a-zA-Z]*$`.

## Mistakes that break it

| Mistake | What happens | Write instead |
|---|---|---|
| a top-level `"viewport"` or `"name"` | warning; dropped by the canvas | only `nodes` and `edges` |
| `"edges"` left out | warning; every node is an unwired dead end | `"edges": []` at least |
| an edge into a node of another file | `edge.target "…" is not a node in this flow` | a Run Flow / Jump Flow with the entry name |
| `"sourceHandle": "next_1"` on a Start node | invalid handle | the canvas id `next` (the deploy renames it) |
| a node copied from another flow with its id | one of the two nodes disappears at run time | a new id |
| `"label": "start"` on the Start node | keen-validate error; the entry is not registered | `"Start"` |
| a node object missing `id` | deploy refused: `flows/<file>: node #<n> has no id` | every node has a valid id |

## Example

A minimal flow, `src/flows/Project.flow` (entry `Project-Start`): Start → End.

```json
{
  "nodes": [
    {
      "id": "startNode_Qx7LmB2pZr4K",
      "type": "startNode",
      "position": { "x": 304, "y": 96 },
      "data": {
        "label": "Start", "description": "",
        "labelNode": "Start Flow", "descriptionNode": "Flow entry point",
        "open": false,
        "settings": { "label": "Start", "value": "Start" }
      },
      "dragHandle": ".drag-handle__custom"
    },
    {
      "id": "endNode_Hn4Ws8TcV1yE",
      "type": "endNode",
      "position": { "x": 304, "y": 528 },
      "data": {
        "label": "End", "description": "",
        "labelNode": "End Flow", "descriptionNode": "Flow terminal",
        "open": false,
        "settings": { "label": "End", "value": "End" }
      },
      "dragHandle": ".drag-handle__custom"
    }
  ],
  "edges": [
    {
      "id": "xy-edge__startNode_Qx7LmB2pZr4Knext-endNode_Hn4Ws8TcV1yEin",
      "type": "step",
      "source": "startNode_Qx7LmB2pZr4K", "sourceHandle": "next",
      "target": "endNode_Hn4Ws8TcV1yE", "targetHandle": "in"
    }
  ]
}
```

Take each node's exact `labelNode`, `descriptionNode` and `settings` from its node file before you rely on this
sample.
