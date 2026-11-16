---
name: keen-flow-nodes
description: Keen 15.3 — How to write the nodes and edges of a Keen agent flow (`.flow` files under `src/flows/`) so the project passes keen-validate, deploys, and runs the way the engines actually behave. Covers all 15 node types (Start Flow, LLM, Summarizer, Condition, Loop, Run Flow, Jump Flow, Join Flow, Assignment, Script, Parallel Flows, Flow Pointer, Parallel Context, Note, End Flow), which node to pick for a need, the exact JSON of each node, handle ids and wiring, the dictionary / session data rules, and the mistakes that make a flow stall or fail. Use this skill whenever you create, edit, review or debug a `.flow` file, add or rewire a node, design an agent's flow from a person's goal, or read a keen-validate finding — even when the person only describes what the agent should do and never names a node.
---

# Keen flow nodes

> **Keen 15.3.** This skill describes Keen 15.3 in full — it is the baseline. A later release (15.4, …) gets an
> additions-only skill with just what changed; read this one first, then the additions for the platform's version.

A Keen agent runs a **flow**: a graph of **nodes** wired by **edges**, saved as JSON in `src/flows/<FlowName>.flow`.
A person draws it on a canvas; you write the same file by hand. The file you save must be one the canvas would
have saved, because `keen-validate` checks the canvas rules as well as the engine rules. The canvas itself checks
nothing when it opens a file: an edge it cannot draw stays in the file unseen, and a value its form would refuse stays
until a person opens that form and fixes it. What the canvas reads and writes: `../../ShiraFlowBuilder/canvas.md`.

This file is the map. Every node has its own file next to this one with the exact JSON, settings, engine
behaviour and mistakes. **Before you write or change a node, read its file** — the details there (handle ids,
which fields take `${…}`, what an unwired output does) are exactly the ones that are easy to get wrong from memory.

| Node (palette name) | `type` | File |
|---|---|---|
| Start Flow | `startNode` | `StartFlow/start-flow-skill.md` |
| End Flow | `endNode` | `EndFlow/end-flow-skill.md` |
| LLM | `agentNode` | `LLM/llm-skill.md` |
| Summarizer | `summarizerNode` | `Summarizer/summarizer-skill.md` |
| Condition | `conditionNode` | `Condition/condition-skill.md` |
| Loop | `loopNode` | `Loop/loop-skill.md` |
| Assignment | `assignmentNode` | `Assignment/assignment-skill.md` |
| Script | `scriptNode` | `Script/script-skill.md` |
| Run Flow | `runFlowNode` | `RunFlow/run-flow-skill.md` |
| Jump Flow | `jumpFlowNode` | `JumpFlow/jump-flow-skill.md` |
| Join Flow | `joinNode` | `JoinFlow/join-flow-skill.md` |
| Parallel Flows | `parallelInNode` | `ParallelFlows/parallel-flows-skill.md` |
| Flow Pointer | `parallelFlowNode` | `FlowPointer/flow-pointer-skill.md` |
| Parallel Context | `parallelContextNode` | `ParallelContext/parallel-context-skill.md` |
| Note | `noteNode` | `Note/note-skill.md` |

Note the two names that do not match their palette name: **LLM** is `agentNode`, and **Parallel Flows** is
`parallelInNode` while **Flow Pointer** is `parallelFlowNode`.

## How a run works — one node per request

The work is split between the person's **browser** and the **server**: the browser (the chat SDK) is the run's
**coordinator**, the server is the **task executor**. The server never runs a whole flow — the SDK sends one request per
node, and the engine does exactly that one node and answers with a status and the next node(s):

1. The person's message starts the run: the SDK sends the Start node; the engine runs it and answers with the next one.
2. The SDK sends that node, and so on, until an End Flow ends the root flow.
3. For a sub-flow (Run Flow, Jump Flow, a flow tool, a Parallel Flows branch, a Parallel Context run) the engine
   answers with the new flow; the SDK runs it, telling the engine which session to continue on and whose child it is.
4. Parallel work is the SDK sending several node requests at once.

So each engine is a plain request / response server, not a job runner: one short task per request, nothing held in
memory between requests — which is why it stays reliable under heavy traffic even on a small machine.

What this means when you build:

- **Nothing lives in memory between nodes.** Every value one node leaves for the next goes through the run's stores —
  the dictionary, the session, the channels (`../../AgentArchitecture/references/communication.md`). A Script's local
  variables are gone when it returns.
- **Every node visit is a request.** A loop of 10 rounds over 5 nodes is 50 requests — bound every loop, and let one
  Script do a job rather than a long chain of small nodes.
- **Limits are per node run** (a Script's 15 minutes and 30 MB, an LLM's tokens; each flow node — Condition, Loop,
  Assignment, … — gets 30 s and 20 MB) — split long work over several nodes. The flow's dictionary and the run's
  session are capped at **1.5 MB** each: a node whose writes would pass the cap stops the run with E2201.
- **Who called whom does not matter to the client.** A helper LLM, a sub-agent in a flow tool or a branch is just the
  next node; each LLM node's result brings its whole answer and its token use. The chat's final answer is the one from
  the console agent on the run's own session.

## Choosing a node

Start from what the agent must do, not from the palette.

| The agent needs to… | Use | Not |
|---|---|---|
| answer, reason, or call tools with a model | **LLM** | a Script that calls a model API |
| keep a long chat within the model's context | **Summarizer**, wired from the LLM's `summary` output | trimming history in a Script |
| go one way or another on a value | **Condition** | a Script that returns a flag and nothing reads it |
| do the same steps for each item of a list | **Loop** | a Script with a `for` that does everything inside |
| put a few known values into the dictionary | **Assignment** | a Script just to set constants |
| fetch data, call an HTTP API, compute, read Secrets / Settings | **Script** | an LLM to do arithmetic |
| call another flow and come back here | **Run Flow** | Jump Flow |
| hand the run over to another flow for good | **Jump Flow** | Run Flow followed by nothing |
| bring several branches back into one path | **Join Flow** (or a node whose `in` is multi-in) | duplicating the tail of the flow |
| run several different flows at once, each with its own empty dictionary, wait for all, then continue | **Parallel Flows** + one **Flow Pointer** per flow | several Run Flows in a row |
| run one flow once per item of a dictionary list, in parallel (waves of 15), and merge the results back | **Parallel Context** | Loop + Run Flow (that is one at a time) |
| leave a note for the next person on the canvas | **Note** | a description on an unrelated node |
| finish | **End Flow** | leaving the last output unwired |

### Nodes that look alike

- **Run Flow vs Jump Flow.** Run Flow runs the target flow and **returns** to its own `next_1`. Jump Flow
  **continues in the target and never comes back** — it has no output. Read both files before you choose.
- **Parallel Flows vs Parallel Context.** Parallel Flows runs **different** flows (one Flow Pointer each) side by
  side, each starting from an **empty** dictionary of its own. Parallel Context runs **one** flow **once per item**
  of a dictionary list, each run on its own copy of that item, and merges each result back when its run reaches
  End Flow. Results of Parallel Flows come back only through the session (or `system/agent`), never the dictionary.
- **Loop vs Parallel Context.** Loop walks a list **one item at a time** in this flow (body out of `out`, back
  into `next_2`). Parallel Context fans the items out to another flow, many at a time (in waves of 15), and merges each item
  back when its run reaches End Flow.
- **Assignment vs Script.** Assignment only writes literal or `${…}` values into the dictionary (≤ 10 pairs). Any
  logic, I/O or reading of Secrets / Settings is a Script.
- **Join Flow vs a multi-in node.** Many nodes accept several incoming edges on `in` (see the handle table), so
  you only need Join Flow when the merge target is single-in (Condition, Assignment, Parallel Context) or to make
  the merge visible.

## The file

Top level is exactly `{ "nodes": [...], "edges": [...] }`.

**A node:**

```json
{
  "id": "conditionNode_E0eqDp5b0fUs",
  "type": "conditionNode",
  "position": { "x": 304, "y": 304 },
  "data": {
    "label": "…", "description": "…",
    "labelNode": "Condition", "descriptionNode": "Set condition flow direction",
    "open": false,
    "settings": { … }
  },
  "dragHandle": ".drag-handle__custom"
}
```

- `id` = `<type>_` + exactly 12 characters from `A–Z a–z 0–9`, unique in the project. The engine reads the node's
  kind from this prefix, so a wrong prefix is a different (or unknown) node.
  Unique means across **every** flow file: the engines keep all flows' nodes in one map, so keen-validate errors on a
  repeated id and the deploy refuses the project (`the node id is used again in flows/<file>`). Never copy a flow
  file without giving every node a new id.
- `labelNode` / `descriptionNode` are fixed per type (each node file gives them). `dragHandle` is always
  `".drag-handle__custom"`.
- `position` values are multiples of 16 (the canvas grid); place the next node in a chain ~432 px below.

**An edge** carries control, never data, and has exactly these fields:

```json
{
  "id": "xy-edge__<source><sourceHandle>-<target><targetHandle>",
  "type": "step",
  "source": "<node id>", "sourceHandle": "<out handle>",
  "target": "<node id>", "targetHandle": "<in handle>"
}
```

### Handle ids

Write the **canvas** handle ids below. The deploy step renames four of them to engine keys (`next` → `next_1`,
`true` → `next_1`, `false` → `next_2`, Loop `out` → `next_2`); never write the engine key in their place —
keen-validate rejects a handle that is not in the node's canvas set.

| Node | Out | In | `in` takes several edges |
|---|---|---|---|
| Start Flow | `next` | — | — |
| End Flow | — | `in` | yes |
| LLM | `next_1`, `error`, `summary` | `in` | yes |
| Summarizer | `next_1` (Out), `error` (Fallback, only to another Summarizer) | `in` | yes |
| Condition | `true`, `false` | `in` | no |
| Loop | `out` (body), `next_1` (Finish) | `in`, `next_2` (the body's return) | `in` yes, `next_2` no |
| Assignment | `next_1` | `in` | no |
| Script | `next_1`, `error` | `in` | yes |
| Run Flow | `next_1` | `in` | yes |
| Jump Flow | — | `in` | yes |
| Join Flow | `next_1` | `in` | yes |
| Parallel Flows | `next_1` | `in`, `wait` (only from Flow Pointers) | yes |
| Flow Pointer | `next` (into a Parallel Flows `wait`) | — | — |
| Parallel Context | `next_1` | `in` | no |
| Note | — | — | — |

**One edge per output.** The canvas refuses a second edge from the same output handle (keen-validate does not check
it, and the engine would start every target), and a second edge into a handle the table marks single-in.

An output with no edge ends that path. Wire every output you rely on; two outputs matter most: a Script with no
`error` edge **stalls the run** when the script throws, and an LLM with no `error` edge **continues on `next_1`
with the provider's error text as its answer**.

## Data: the dictionary and the session

Nodes share data through stores, not through edges.

- **`dictionary`** — the current flow's scratchpad, nested JSON. Read with `${dictionary.a.b}` (dot-walk through
  objects only; no array indexing, and `.length` of a list does not resolve).
- **`session`** — the whole run's flat key/value store of primitives. `${session.a.b}` is the single key `"a.b"`.
- **The conversation** (the LLM's prompts and answers) is not a `${…}` field; Scripts reach it through
  `system/agent`.

`${dictionary.…}` and `${session.…}` are the only placeholders that exist. A field that is exactly one
placeholder keeps the value's type; a field that mixes text and placeholders becomes a string; a plain literal
typed into a field is a **string** (`1` is `"1"`). A missing value is `""` in text and `null` on its own.
Which fields take `${…}` differs per node — the node files say so per field.

The run has **three** ways to pass information between flows, branches, tools and sub-agents — session storage,
channels (`system/agent`) and each flow's private dictionary. Which to use when, who sees what in parallel, and how to
clean up: `../../AgentArchitecture/references/communication.md`.

## Names that must match exactly

- **Flow file name**: PascalCase, letters only (`Orders.flow`). A digit passes as an agent's Start Flow but no
  node or flow tool can ever target that flow.
- **Start Flow label**: one capitalised word, letters only (`Start`, `Refund`). A flow's entry is
  `<FileName>-<StartLabel>` (`Orders-Refund`); Run Flow, Jump Flow, Flow Pointer and Parallel Context name
  their target this way, as a literal.
- **The agent in the console** runs `Start Flow` = the file name and `Start Node` = the Start label (the console
  takes each only with 3–60 characters, so a 1–2 letter file name or Start label can never be an agent's entry). Never invent
  either; take them from the person or from the agent's record. A name that does not match saves and deploys, and
  then every chat fails with E2201 "Agent project error" (the Log Record names the missing entry).

## The house standard: every chat LLM has a Fallback and a Summary

Build this into every agent without being asked — a person should never have to point it out:

1. **Fallback.** Every LLM node that answers the person sends its `error` to a second LLM node with the **same Agent
   ID, Agent Name, prompts and settings** on **another provider** (Anthropic → Google, Google → OpenAI, …); its `next_1`
   and `summary` go where the main node's go. The last node of the chain sends its `error` where the flow goes on (End,
   the next step) — or to a third provider for more resilience; if every provider fails, the last one's error text is
   the answer. An `error` wired straight to End is **not** a Fallback: it only silences the validator.
2. **Summary.** Every LLM node that keeps the chat (Interact with DB on — the default) wires `summary` to **one**
   Summarizer; that Summarizer's `error` goes to a second Summarizer on another provider. When a summary is due the
   LLM leaves by `summary` **instead of** its Out, so the Summarizer's Out (and its fallback's) must lead where the
   LLM's Out leads. Share one Summarizer only between LLM nodes whose Outs lead to the same node — the main node and
   its fallbacks, usually. Without a summary edge the model gets up to 50 earlier turns with no token cap and
   remembers nothing older; with it, the newest summary plus turns capped at 50 000 tokens.
3. A helper LLM (not answering the person; often Interact with DB **off**, which never summarizes) gets a Fallback LLM
   too, or its `error` goes to a Script that handles the failure on purpose (the architectures' examples do this).
4. Use only providers the platform has a key for. When you do not know, ask the person; prove the Fallback once in a
   **test** space (a deliberately wrong model name on the main node, then restore) — never in a space people chat in.
5. A keen-validate warning about an unwired Fallback is an error for an agent you build. keen-validate does not warn
   about a missing summary edge: check it yourself.

Details: `LLM/llm-skill.md` (Fallback, In / Out), `Summarizer/summarizer-skill.md`.

## After writing

Run `keen-validate <project-dir>` (exit 0 = no errors; warnings are allowed but read them), fix every error
at its node, then `keen-deploy`, then prompt the deployed agent with the runner (`run.ts`) and read what came
back. The validator is the fastest check you have — run it after every change, not only before a deploy.
