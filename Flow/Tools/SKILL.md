---
name: keen-tools
description: Keen 15.3 — How to give a Keen agent tools its LLM node can call — a Script Tool (one `<name>Tool.js` under `src/scripts/tools/`) or a Flow Tool (a whole flow, including an agent as a tool — a sub-agent with its own LLM and its own tools), how each is registered in `src/keen-tools.json`, described in the calling LLM's system prompt, called with `<SYSTEM CALL>`, how it answers (and talks back to the agent when the call was wrong, so the agent fixes it), what it can read and write, its errors and limits, and tool chaining. Use this skill whenever an agent must look something up, call an API, compute, act, or delegate to a helper agent; whenever you add, change or debug a tool; or when the person says "the agent should be able to …", "add a tool", "give it access to …", "a sub-agent", "chain tools" — even if they never say "tool".
---

# Keen tools

> **Keen 15.3.** This skill describes Keen 15.3 in full — it is the baseline. A later release (15.4, …) gets an
> additions-only skill with just what changed; read this one first, then the additions for the platform's version.

A tool is something an LLM node can decide to call in the middle of answering. The model writes a `<SYSTEM CALL>`
block, the engine runs the tool, the tool files its answer as the agent's next message, and the model continues.

| Kind | What it is | File |
|---|---|---|
| **Script Tool** | one script, `src/scripts/tools/<name>Tool.js` (+ its service under `services/<service>/` when it talks to the outside — the tool imports only that service's `service.js`; building one: `../../Services/SKILL.md`) | `ScriptTool/script-tool-skill.md` (examples: `ScriptTool/references/examples.md`) |
| **Flow Tool** | a whole flow with its own Start, nodes and End — also an AGENT as a tool (a sub-agent) and tool chaining | `FlowTool/flow-tool-skill.md` (examples: `FlowTool/references/examples.md`) |

**Read the kind's file before you build one.** The protocol details (`<SYSTEM CALL>`, the recovery messages) are in
`../Nodes/LLM/references/tool-calling.md`; the project layout (`keen-tools.json`, `tools/`, `services/`) in
`../../ProjectStructure/SKILL.md`.

## Why there are two kinds

A tool is either **code** or **a sequence of nodes**.

- A **Script Tool** is one function. It does one action with logic — call an API (`system/http`), compute, look data
  up, check something — fast and predictable, and it reads the agent's Secrets. But a script **cannot call a model**
  (no module does; `system/agent` only reads and writes the conversation), cannot run another flow, a Summarizer or
  parallel branches.
- A **Flow Tool** is a whole flow, so it can contain anything — a Script node too. You need it when the tool must
  **think with a model** (a sub-agent with its own system prompt: "summarise this document", "check the tone"), run
  **several steps** with branches (Condition, Loop, Run Flow, Parallel), or reuse a flow that already exists. It costs
  more: more steps, slower, more places to fail.

**The rule:** a Script Tool by default; a Flow Tool only when the tool needs a model (a sub-agent), several nodes, or an
existing flow. A third choice is "no tool": work that must happen on every turn belongs in a Script node *before* the
LLM, not in a tool the model may or may not call.

## What every tool has in common

1. **Registered** in `src/keen-tools.json` — `{ "name", "type": "script" | "flow", "entry" }` and nothing more. The
   model **never sees this file**: it is only how the engine finds the tool after the model names it.
2. **Described** in the calling LLM's **system prompt** — the only place the model learns the tool exists, what it does,
   when to use it and what to send. No description, no calls; a vague description, wrong calls.
3. **Called** by the model with a `<SYSTEM CALL>` block naming the tool by its registered `name` (exactly).
4. **Answers** by filing a prompt for the calling agent with `Agent.setRootAgentPrompt` on the caller's session, taken
   from `toolOptions` (it always describes the IMMEDIATE caller — the agent id is `toolOptions.toolContext.agentId`, the
   session `toolOptions.agentNode.flowContext.sessionId`; never hard-code either). A tool's `return` value never reaches the
   model — but it does travel to the person's browser in the node's reply (only the agent's Secrets are masked):
   return `{ ok: true }`, never an API's raw answer.
5. **Catches everything.** An uncaught throw leaves the model with only `No tool response`; a tool that replies with
   what went wrong lets the model correct itself.
6. **Runs on the caller's dictionary and the run's session** — no private dictionary; keep a tool's working data under
   one namespaced key and remove it at the end.
7. **Has no built-in limit on rounds or depth.** The engines do not stop a model that keeps calling tools, or a tool flow
   that (through its sub-agent) calls itself. Bound it in the system prompt and, for flows, with a counter.

## The tool talks back to the agent

A tool can **correspond with the agent that called it**. Its reply is the agent's next user message, so when the
call was wrong the tool says what is wrong and what to send, and the agent calls it again with the right input.

**Why.** A tool that throws (or returns without a reply) leaves the model with only `No tool response` — it cannot
tell a missing field from an outage, so it gives up or guesses. A reply in words lets it fix the call itself.

**The house reply shape** (JSON text in the reply's `prompt`):

```json
{ "ok": false, "retryable": true, "error": "<what is missing or wrong>", "correction": "<the exact input to send>" }
```

Example: the tool needs `city_id`, the model sent `{"city": "Varna"}`.

```js
let input;
try { input = JSON.parse(call.options.context ?? ''); } catch { input = null; }
if (!input || !Number.isInteger(input.city_id)) {
    reply({
        ok: false,
        retryable: true,
        error: 'Weather Forecast did not get city_id (a whole number).',
        correction: 'Send !*context as JSON {"city_id": <id from City Search>, "days": 3}.'
    });
    return { ok: false };                 // a normal return — the reply is written; never throw here
}
```

**How the engine runs it.** The reply is filed with `Agent.setRootAgentPrompt(toolOptions.toolContext.agentId, {
…, sessionID: toolOptions.agentNode.flowContext.sessionId })` and committed when `exec` returns. When the tool has
finished, the llms-engine runs the **same LLM node** again: it takes the newest user message filed for that agent
on its session — the tool's reply — as the newest user turn; if nothing newer than the call was filed, it files
`No tool response` instead. The model reads the correction and may write a new `<SYSTEM CALL>`: another round, run
the same way. With **Interact with DB on** the model also sees the earlier turns of this exchange (the person's
question, its first call, the reply). With it **off**, a recall loads no history: the model sees only its own
prompts and the tool's reply, and has lost the person's question — keep the node's DB on, or keep the task in the
dictionary (`${dictionary.task}` in the system prompt, resolved again on every round).

**The system-prompt line that makes the model use it** — and the bound, because the engine sets **no limit** on
tool rounds:

```md
If a tool answers "ok": false with "retryable": true, fix the call exactly as "correction" says and call it once
more. If it fails again, or "retryable" is false, do not call it again for this question — tell the person what
failed in plain words. Never call tools more than 4 times for one message.
```

**A value only the person can give.** When the missing value is not something the model can know (the person's
city, an order number), reply with `retryable: false` and say what to ask:
`{"ok": false, "retryable": false, "error": "No city given.", "correction": "Ask the person which city they mean, then call Weather Forecast again."}`.
The model asks the person; their answer comes in the next chat message, and the model calls the tool again then.

Every other failure (no Secret, a refused key, an outage, a timeout) follows the same shape — the full mapping:
[`ScriptTool/references/examples.md`](ScriptTool/references/examples.md) and
[`../../Services/instruments.md`](../../Services/instruments.md).

## Tools that change something (an order, a payment, a message)

The run is coordinated by the person's browser, one node per request (`../Nodes/SKILL.md`, "How a run works"). Three
consequences for a tool that changes something in the partner's system:

- **Decide rights inside the tool.** The partner's API, called with the person's own token, decides what this person
  may do. Never rely on an earlier Condition or Script as the check; treat the tool's input as the person's own words.
- **Safe to run twice.** In rare failures (a timeout after the request was delivered) a node is sent again. Ask the
  API first whether the action is already done, or send it a key it uses to drop a repeat.
- **One action, one call, last.** If the person closes the tab, the run stops at the current node. A change made in
  several steps can stay half done, so let one API call do the whole action, as the last step of the tool.

## Tool chaining — three patterns

| Pattern | How | Use when |
|---|---|---|
| **(a) The model chains** | ONE agent has several tools and calls them one after another ("find the customer, then their orders") | the default — the model decides the order |
| **(b) A fixed chain** | a Flow Tool that runs Script nodes / Run Flow in a set order, no model in between | the steps never change |
| **(c) A sub-agent with tools** | a Flow Tool whose LLM node has its own system prompt and its own tools; it answers the outer agent when done | a judgement is needed in the middle ("research this in the manuals and give me a short answer") |

For (c): the inner tools answer the **inner** agent (their `toolOptions` names it) and the inner agent's final answer
goes back to the outer one. Full rules and a validated example: `FlowTool/flow-tool-skill.md` §1.6 and §1.7a.

### A sub-agent's working memory lives in the dictionary (recommended)

With **Interact with DB off** an LLM node loads no chat history — on every return from a tool it sees only its own
prompts and the newest tool reply, so a sub-agent with tools would forget its task. But its prompts are **re-resolved on
every run** (`${dictionary.…}` is read again each time), so keep the sub-agent's memory in the dictionary instead of the
chat history:

1. The tool flow's first Script writes the task under ONE namespaced key: `dictionary.research = { task: "<text>",
   notes: "" }`.
2. The sub-agent's LLM node: Interact with DB **off** (nothing written to chat history, no memory across turns, no
   history tokens); its system prompt reads `Your task: ${dictionary.research.task}` and `What you found so far:
   ${dictionary.research.notes}`.
3. Every inner tool **appends** its finding to `dictionary.research.notes` as **text** and replies briefly — a list or an
   object placed in a prompt resolves to empty text, so notes must be a string.
4. The tool flow's last Script deletes `dictionary.research`.

The dictionary is the **caller's** (tools and flow tools run on it): one key per sub-agent, and mind the 1.5 MB cap.
Turn Interact with DB **on** only when the sub-agent *should* remember across turns.

### Collecting results from several tools or workers — channels

The dictionary is one agent's working memory (an LLM reads it through `${…}`). To **collect** information for a task from
several tools, sub-agents or parallel branches, use `system/agent` **channels** — named lanes in the run's conversation
store, shared by every branch of the run (a Parallel Flows branch's dictionary is deleted at its end; a channel is not):

- writers file entries on the task's channel (`Agent.setAgentResponse(…, { …, channel: 'quotes' })`; an LLM triggered by
  a prompt on a channel answers on the same channel);
- one Script, when the work is done, reads them with `Agent.consumeChannelResponses('quotes')` — **read and delete** in
  one step — and turns them into one text for the next LLM's prompt (through the dictionary);
- `Agent.deleteChannel('quotes')` deletes without reading.

Keep entries small (a consume answer above the 10 MB input buffer fails — and the lane is already gone), and give
parallel workers that share an agentId their own `sessionID` (or agentId) — a channel does not keep their triggers apart. Every function, error and limit:
`../Nodes/Script/references/system/agent.md`.

The three ways a run passes information (session storage, channels, private dictionaries) side by side:
`../../AgentArchitecture/references/communication.md`.

**Clean up what you create:** `delete dictionary.<key>` at the end of a tool flow, consume or delete channels when
their task is done. The root flow's End wipes the run's stores anyway, but a long run (many turns of tool calls) carries
everything until then.

## Before you finish

`keen-validate <project-dir>`: every registered tool must exist (`tools/…` for a script, a real `<File>-<Start>` entry for
a flow), names unique, node ids unique across the project. Then a test chat with the runner that makes the model call
the tool, and read what came back.
