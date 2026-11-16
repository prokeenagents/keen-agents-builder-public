# Flow tool

A **flow tool** is a flow that an LLM node calls as a tool. The model writes a `<SYSTEM CALL>` naming the tool, the
platform runs the flow from one of its Start nodes, the flow does its work, and a Script in it **files a user
message for the calling agent**. That message is the tool's result: the calling LLM node runs again and reads it.

Read first: [the `<SYSTEM CALL>` protocol](../../Nodes/LLM/references/tool-calling.md) (the block, the loop, the
recovery messages) and [the registry file](../../../ProjectStructure/src/keen-tools.md). This file adds what is
special about a tool that is a **flow**. Complete, validated projects are in
[references/examples.md](references/examples.md).

## 1.1 How it is defined in `keen-tools.json`

One object in the `tools` array of `src/keen-tools.json`:

```json
{ "tools": [ { "name": "Price Quote", "type": "flow", "entry": "PriceQuote-Start" } ] }
```

| Field | Rule |
|---|---|
| `name` | the exact text the model writes after `!*tool` (case-sensitive). Unique in the file |
| `type` | `"flow"` |
| `entry` | a `File-Label`: the flow file's name without `.flow` + `-` + the label of a Start node in it. Both parts letters only, a capital first: `/^[A-Z][a-zA-Z]*-[A-Z][a-zA-Z]*$/` |

- `PriceQuote-Start` runs the Start node labelled `Start` in `src/flows/PriceQuote.flow`. A file named
  `Quote2.flow` can never be a tool (a digit does not fit a `File-Label`).
- There are no other fields. A `description` or `parameters` here is never shown to the model (see 1.8).
- keen-validate errors: `flow tool entry "<entry>" must be a File-Label (…)` and
  `flow tool entry "<entry>" does not resolve to any flow's Start`. The deploy checks only the file's shape and
  copies the list as it is, so a wrong `entry` that skipped the validator deploys and fails at call time.
- The registry is **project-wide**: every LLM node of the project can call every tool its system prompt names.
- The engine reads the deployed copy. Change the file → `keen-validate` → `keen-deploy`.

## 1.2 How the agent (the LLM node) calls it

Exactly like a script tool. The LLM node has **Use tools** on (no `skip-internal-tooling` rule), its system prompt
teaches the block and the tool, and the model answers with:

```
<SYSTEM CALL>
!*action
use tool
!*tool
Price Quote
!*context
{"sku": "LH-LAMP-01", "quantity": 12}
</SYSTEM CALL>
```

What the platform does:

1. It parses the **first** block, finds the **first** registry entry whose `name` equals `!*tool`, sees
   `type: "flow"`, and looks up `entry` among the deployed flow entries.
2. It starts the flow at that Start node as a **separate run of that flow**: a new session id of its own, the
   **calling agent's dictionary**, and the call attached to every node as `toolOptions` (1.7).
3. The calling LLM node **waits until the tool flow has finished** (every path ended, Run Flow sub-flows
   included). Then the same LLM node runs again with the tool's reply as its newest user message (1.3).
4. The model answers again: another block → another tool round; plain text → the node leaves by `next_1`.

The model does not know whether a tool is a flow or a script; `!*action` decides nothing.

## 1.3 How it returns its result

**Neither an End Flow nor a Script's `return` value reaches the model.** The tool must **file a user message for
the calling agent, on the calling agent's session**, from a Script node of the tool flow:

```js
import Agent from 'system/agent';
import Tools from 'system/tools';

Agent.setRootAgentPrompt(toolOptions.toolContext.agentId, {          // the agent that called
    prompt: 'Price Quote for 12 x LH-LAMP-01: … total EUR 487.49.',  // non-empty text
    sessionID: toolOptions.agentNode.flowContext.sessionId,          // the CALLER's session
    requestID: Tools.generateUUID()                                  // a fresh id
});
```

- When the calling node runs again, it takes the **newest** user message filed for its agent on its session. If
  that is still the message it answered before the call, the tool filed nothing and the engine files
  `No tool response` instead.
- File the reply **last** in the Script, after everything that can throw: a throw drops the queued reply.
- File **one** reply per run of the tool. Two replies on the same session: the model reads only the newer one.
- `flowContext.sessionId` inside the tool flow is the **tool flow's own** session, not the caller's. A reply
  stamped with it is not found (`No tool response`).
- The reply is plain text. The model reads it as if the person had written it, so write it as a result the model
  can use: what was done, the values, and on a problem what to send instead (the model corrects its call).

## 1.4 The structure of the tool's `.flow` file

```
Start ──▶ Script (validate + work + reply) ──▶ End
              └─ error ──▶ Script (reply failure) ──▶ End
```

- **Start:** a Start node whose `data.settings.label` is the label of the entry (`Start`). It has no input and no
  settings that carry the call: the call is read by Scripts from `toolOptions`. A tool flow file may hold other
  Start nodes too (other tools or Run Flow entries).
- **The nodes:** any node a flow may use. The first Script usually reads `!*context`, checks it, and either
  replies "input invalid" or writes what the next nodes need into the dictionary.
- **The end of every path is a reply, then an End.** Every path, the `false` of a Condition and every `error` /
  Fallback included, files exactly one reply before it ends. An unwired Script `error` **stalls** the tool: the
  calling node never runs again and the person gets no answer for this turn.
- **End Flow** finishes the tool flow. `terminateDictionary` is ignored here (the dictionary is the caller's);
  leave it `false`.
- Node ids are unique in the **whole project**: never copy a node from another flow with its id.

The node files: [Start Flow](../../Nodes/StartFlow/start-flow-skill.md), [Script](../../Nodes/Script/script-skill.md),
[Condition](../../Nodes/Condition/condition-skill.md), [LLM](../../Nodes/LLM/llm-skill.md),
[Run Flow](../../Nodes/RunFlow/run-flow-skill.md), [End Flow](../../Nodes/EndFlow/end-flow-skill.md).

## 1.5 When it is the best choice (vs a Script Tool)

| The tool's work | Build |
|---|---|
| one function: validate, call one API, compute, reply | a **script tool** ([../ScriptTool/](../ScriptTool/)) — one file, one sandbox, fewer things to fail |
| needs a **model's judgement** inside the tool (summarise, classify, research) | a **flow tool** with an LLM node (1.6) |
| several steps you want visible and separately failing: branch on a value, loop over items, run flows in parallel, reuse an existing flow with Run Flow | a **flow tool** |
| the same steps already exist as a flow the agent runs elsewhere | a flow tool whose Start leads into them (mind 1.7: `toolOptions` is gone inside a Run Flow sub-flow) |

A flow tool costs more: every node is a separate step, every Script a separate sandbox, and every path needs its
own reply. A flow tool with one Script and no branch works (Example 1), but the same code as a script tool is
simpler. Choose the flow when the graph earns its place.

## 1.6 An AGENT as a tool (a sub-agent)

A flow tool whose flow runs its **own LLM node**: the calling agent hands a task to a second agent with its own
system prompt, model and settings, and gets its answer back as the tool's result.

```
Start ─▶ Script "seed" ─▶ Condition ok? ─true─▶ LLM (sub-agent) ─next_1─▶ Script "return" ─▶ End
           │error            └false (seed already replied) ─▶ End      │error (Fallback) ─▶ Script "reply failure" ─▶ End
```

**Its `agentId`.** The answering node of a chat must carry the console agent's ID
([llm-skill.md](../../Nodes/LLM/llm-skill.md)) — the sub-agent's node must **not**. Give it its own literal
kebab-case ID (`doc-summariser`), different from the calling agent's. Conversations are kept per agent ID: a
sub-agent with the caller's ID would write its turns into the caller's chat history and, with Interact with DB on,
read the caller's whole conversation as its own. The sub-agent's ID needs no record in the
console; it only names a conversation.

**Its conversation (what it sees).** An LLM node answers the newest user message filed for **its own `agentId`**,
preferring one on its session; nothing gives the sub-agent one automatically. So the "seed" Script files it:

```js
Agent.setRootAgentPrompt('doc-summariser', {
    prompt: JSON.stringify({ text, focus }),
    sessionID: flowContext.sessionId,        // the tool flow's session = the sub-agent's session
    requestID: Tools.generateUUID()
});
```

Without it the sub-agent has no user message: Anthropic and Google refuse the conversation (E6002), which takes
the node's Fallback. The sub-agent sees: its own prompts (with `${dictionary.*}` / `${session.*}` resolved against
the **caller's** dictionary and the run's session), its own earlier turns in this chat if **Interact with DB** is on,
and the seeded message. It does **not** see the calling agent's conversation, unless you put it into the message.

**Interact with DB.** Off (`skip-internal-database-interactions`) = a stateless helper: nothing of this chat is
loaded, nothing is saved; each call starts fresh. Use it for a sub-agent **without tools** (summarise, classify,
translate). On = the sub-agent keeps its own history in this chat, under its own ID: its earlier final answers
(across the person's messages) and every turn of the current message. A sub-agent **with tools** needs it on (1.7a).
Also turn **Use tools** off (`skip-internal-tooling`) on a sub-agent that must not call tools.

**How its answer goes back.** Its answer stays with it: the sub-agent's text answer is stored as **its** response
and it leaves by `next_1`. A Script after it reads the answer and files it for the caller:

```js
const answer = Agent.getAgentLastResponseBySessionId('doc-summariser', flowContext.sessionId)?.response ?? '';
// … then setRootAgentPrompt(toolOptions.toolContext.agentId, { …caller's session… }) as in 1.3
```

(`agentResponse: true` + `agentResponseProperty` also copies a text answer into the dictionary, which is the
caller's.) Wire the sub-agent's **Fallback** (`error`) to the reply-failure Script: unwired, a provider failure
continues on `next_1` with the error text as the "answer", and your return Script would forward it as a result.

**What the person sees.** Every LLM node's text streams to the chat client while it is written, the sub-agent's
included. The chat's saved, displayed answer is only the console agent's final text answer; with Interact with DB
on, the sub-agent's turns are saved as audit rows, not shown as the chat's answer. Keep the sub-agent's answer short and factual — the calling agent words the reply.

## 1.7 The shared objects and how parameters are passed

| Object | In the tool flow | Read / write | Reaches the calling model? |
|---|---|---|---|
| **The tool's input** | `toolOptions.toolContext.options.context` — the `!*context` text, trimmed, a **string** (parse it yourself). Other `!*key` fields are there too (`options.<key>`), and `toolContext.prompt` is the model's whole text | read | — |
| **`toolOptions`** | a global in every Script of the tool flow: `toolContext.agentId` (the caller), `toolContext.options`, `toolContext.prompt`, `toolContext.path` (the entry), `toolContext.projectTool` (the registry object), `agentNode.flowContext.sessionId` (the caller's session). Present on every node of the tool flow; **absent inside a Run Flow / Parallel Flows / Parallel Context sub-flow** the tool flow starts (a spawned flow resets the tool boundary) and in a Script outside any tool | read | — |
| **`props`** | a Script node's own Key/Value Pairs, resolved against the dictionary and session. The Start passes nothing: there are no tool parameters as props | read | — |
| **The dictionary** | **the calling agent's dictionary itself** — not a copy and not a private one. The tool reads what the caller's flow wrote and its writes stay after the tool ends | read / write | only through `${dictionary.*}` in the caller's prompts, which are resolved again on every tool round |
| **A "private" dictionary** | none. Keep the tool's working data under one key (`dictionary.research`) and delete it at the end. A truly private, empty dictionary exists only inside a Parallel Flows branch, whose results come back only through the session or `system/agent` | — | — |
| **The session** | the run's one session (flat, primitive values), shared by the caller, the tool and every sub-flow | read / write | through `${session.*}` in the caller's prompts |
| **`flowContext`** | the tool flow's **own** ids: `flowContext.sessionId` is the tool's session (the sub-agent's session in 1.6) | read | — |
| **The conversation** (`system/agent`) | one store for the run: the reply for the caller, the seed for a sub-agent, any agent's answers | read / write | **yes — the reply** filed for the caller's `agentId` on its session is what the model reads |
| **Secrets / Json Settings** | the agent's own, as in any Script | read | no (a Secret's value in a reply shows as `••••`) |

What reaches the calling model, in short: **the reply text**, plus whatever its own prompts resolve from the
dictionary and session. Also: the tool turns of the current message (its `<SYSTEM CALL>` turns and the replies)
come from chat history, so a **calling** node with Interact with DB off sees only its prompts and the newest
reply on a recall — it no longer sees the original question. Keep Interact with DB on in a node that calls tools.

When a Script deep in the tool must reach the caller where `toolOptions` is absent (a Run Flow sub-flow), copy
`toolOptions.toolContext.agentId` and `toolOptions.agentNode.flowContext.sessionId` into the dictionary in the
first Script and read them from there.

## 1.7a Tool chaining

**Three patterns.**

| Pattern | Who decides the order | Use when |
|---|---|---|
| (a) **one agent calls several tools in turn** | the calling model, round by round | the next step depends on the last result, and the calling agent should see each result |
| (b) **a deterministic flow tool**: Scripts / Run Flows / Conditions in a fixed order, no model inside | the graph | the steps are always the same; cheapest and repeatable |
| (c) **a sub-agent with its own tools**: a flow tool whose LLM node calls other tools | the sub-agent's model | a separate expert task with its own instructions, whose intermediate results would only clutter the calling agent's conversation |

Pattern (b) cannot "call a tool": only an LLM node calls tools. To reuse another flow, use Run Flow — and note that
the sub-flow has no `toolOptions`.

**(c) How it works** (verified end to end; Example 4 is complete):

1. **Which tools the inner agent can call.** Any tool of the project's one `keen-tools.json`; in practice exactly
   the tools **its own system prompt** describes, with the same block format. The outer agent's prompt names only
   the flow tool; the inner agent's prompt names only its tools. Do not list the flow tool in its own inner
   agent's prompt.
2. **Where an inner tool's answer goes.** When the inner LLM node calls a tool, `toolOptions` of **that** tool
   names the **inner** agent (`toolContext.agentId` = the inner ID, `agentNode.flowContext.sessionId` = the inner
   agent's session, which is the outer tool flow's session). The same reply code as 1.3 therefore answers the
   inner agent, and the inner node runs again — the outer agent is still waiting.
3. **The `toolOptions` boundary.** Each tool call starts a new tool run with its own `toolOptions`. Inside the
   outer flow tool every node (the Scripts before and after the inner LLM node included) keeps the **outer**
   call's `toolOptions`; inside the inner tool, the inner call's. A Run Flow / parallel sub-flow has none.
4. **Back to the outer agent.** The inner node leaves by `next_1` only after its final text answer. A Script
   after it reads that answer (`getAgentLastResponseBySessionId(<inner id>, flowContext.sessionId)`) and files it
   for the outer agent with the **outer** `toolOptions` — the outer agent then runs again.
5. **The inner agent's ID and history.** Its own ID (1.6). Keep **Interact with DB on**: on each recall it rebuilds
   its context from chat history, and with it off it would see only the newest tool reply, not its task. It does
   not share the outer agent's history (history is per agent ID); it keeps its own final answers in this chat. If
   it must not remember earlier calls, put the task into its system prompt from the dictionary
   (`${dictionary.research.question}`, resolved on every round) and state "use only this question".
6. **All levels share one dictionary** (the outer caller's) and the run's session.

**Limits and risks.** The platform sets **no limit** on tool rounds or on nesting depth. A flow tool whose inner
agent can call the same flow tool (directly or through another tool) recurses until a model stops, a Script hits its
15-minute limit (1.10), or the person cancels. Every level adds model calls (cost) and waiting (the person
waits for the whole chain). So: never list a tool in the prompt of an agent inside it; state a maximum number of
tool calls in every prompt; prefer (a) or (b) when one model is enough.

## 1.8 The description in the calling LLM's system prompt, and naming

**The model never sees `keen-tools.json`.** The engine uses the registry only to find the tool after the model
named it; it adds no tool list and no instructions. Write into the calling node's system prompt:

- the block format (copy the section in [tool-calling.md](../../Nodes/LLM/references/tool-calling.md) §2);
- one entry per tool: the **exact `name`**, what it returns, when to use it, and the `!*context` shape (a JSON
  example with the types and limits). The model learns the input only from here;
- when to stop: a maximum number of calls per message, and what to do after an "input invalid" reply.

```
3. Summarise Document
Description: a short summary of a long text the customer pasted (a contract, a manual page, an e-mail).
Usage: !*context is JSON {"text": "<the full text>", "focus": "<optional: what the customer cares about>"}.
```

**Naming.** The tool `name` in words (`Summarise Document`), identical in the registry and the prompt. The flow
file in PascalCase, letters only, named for the job (`SummariseDocument.flow`); the Start label `Start`; the entry
`SummariseDocument-Start`. The sub-agent's ID in kebab-case, named for its role (`doc-summariser`). Scripts of a
flow tool are ordinary Script-node files (camelCase, any folder, e.g. `flowTools/summarise/seedSummariser.js`) —
`tools/` is for script tools only.

## 1.9 Errors — what the calling model sees, and what the person sees

| What goes wrong | What the calling model reads next | What the person sees |
|---|---|---|
| no `!*key` field in the block | `Could not parse the SYSTEM CALL block.` | the agent's next answer |
| `!*tool` names no registry entry | `The requested tool does not exist.` | the agent's next answer |
| the entry matches no deployed Start | `No tool response` | the agent's next answer |
| the tool ended without filing a reply, or filed it on the wrong session | `No tool response` | the agent's next answer |
| a Script threw and its `error` leads to a reply-failure Script | that Script's text | the agent's next answer |
| a Script threw and its `error` is **unwired** | nothing: the tool stalls, the calling node never runs again | **no answer** for this message; one `Script "<path>" failed: …` line in the agent's Log Record |
| the sub-agent's provider fails, Fallback wired | the reply-failure text | the agent's next answer |
| the sub-agent's provider fails, Fallback unwired | the provider's error text, forwarded as a "result" | a garbled answer |
| a Condition expression breaks, or a Run Flow names a missing entry | nothing: the **whole run stops** (E6001 / E2201) | an error, no answer |
| a Script hits its 15-minute limit | nothing: the run ends with `E8101 Script time limit reached!` | an error, no answer |

The corrective messages never take the calling node's Fallback; the node simply runs again. The model may call the
tool again after any of them, so tell it in the prompt how often to retry. A tool's own "input invalid" reply
(validate `!*context`, say what to send) is the cheapest recovery: the model fixes its call.

## 1.10 Limits

| What | Limit |
|---|---|
| Tool rounds per message, nesting depth, tools per project | none set by the platform — set them in the prompts |
| Blocks per answer | only the **first** `<SYSTEM CALL>` runs |
| Time | each Script node run has its own 15 minutes (queue time not counted); the flow itself has no time limit, so many rounds / nested model calls just take long ([Script limits](../../Nodes/Script/script-skill.md#limits)) |
| The reply | a non-empty string; one conversation entry ≤ 8 MB. Keep it far smaller: it becomes the model's next user turn and counts against its context |
| `!*context` | no cap of its own; bounded by the calling node's Max Tokens (a block cut at Max Tokens is plain text and nothing runs) |
| The dictionary / the session | 1.5 MB each after every Script ([Script limits](../../Nodes/Script/script-skill.md#limits)); the tool writes into the caller's |
| A tool flow calling a tool | only through an LLM node inside it (1.7a). A Script cannot call a tool |
| A tool flow calling a flow | Run Flow / Jump Flow / parallel nodes work as anywhere; the started flow has no `toolOptions` |

## 1.11 How to test it

1. `keen-validate <project-dir>` until 0 errors. For flow tools it checks: the entry is a `File-Label` and matches
   a Start (`does not resolve to any flow's Start` otherwise), names are unique, every Script file exists, node ids
   are unique across all flows, and in script tools the reply's `sessionID`. It does **not** read prompts: it cannot
   see that a prompt names a tool missing from the registry, or a different spelling.
2. Read the warnings: an unwired `error` on a Script of the tool flow is the stall of 1.9.
3. `keen-deploy`, then a test chat with the runner: `npx tsx run.ts --prompt "<a message that needs the tool>" --json`.
   In the flow tree check, in order: the calling LLM node's tool turn (the block), the tool flow's nodes from its
   Start, the reply Script, then the calling node again with a text answer. `No tool response` as the next turn
   means the reply was missing or on the wrong session.
4. Test the failure paths too: a message that makes the model send bad input (expect "input invalid" and a second
   call), and for a sub-agent a run where it answers nothing useful.

## 1.12 Mistakes that break it

| Mistake | What happens | Write instead |
|---|---|---|
| `"entry": "PriceQuote"` / `"Price-Quote-Start"` / into `Quote2.flow` | keen-validate error; at run time `No tool response` | `"PriceQuote-Start"`, a letters-only file name |
| the Start's label `start`, or only `settings.value` set | the entry is not registered; `No tool response` | `"settings": { "label": "Start", "value": "Start" }` |
| the reply stamped with `flowContext.sessionId` | `No tool response` | `toolOptions.agentNode.flowContext.sessionId` |
| expecting End Flow or `return { … }` to answer | `No tool response` | a Script files the reply (1.3) |
| a Script's `error` unwired | the tool stalls; no answer for the message | wire it to a reply-failure Script, then End |
| a sub-agent with the caller's `agentId` | the two conversations mix in one chat history | its own ID |
| no seed message for the sub-agent | E6002 → its Fallback (or the error text forwarded as the result) | `setRootAgentPrompt(<sub id>, { sessionID: flowContext.sessionId, … })` first |
| the sub-agent's Fallback unwired | a provider error is returned as the tool's result | Fallback → reply-failure Script |
| a sub-agent with tools and Interact with DB off | on each recall it sees only the newest tool reply and loses its task | Interact with DB on (1.7a) |
| an "input invalid" reply, then the flow goes on to the sub-agent | two replies; the sub-agent fails without a seed | write a flag, branch with a Condition, end the invalid path |
| `toolOptions` read inside a Run Flow sub-flow | `TypeError`: the Script throws | copy the caller's ID and session into the dictionary first |
| the tool's working data at the top of the dictionary (`dictionary.items`) | overwrites the caller's own keys | one namespaced key, deleted at the end |
| a Condition on `${dictionary.input}` where `input` is the raw JSON text | it compares a string; an object or list stops the run | a Script stores a boolean or number first |
| the flow tool listed in the prompt of its own inner agent | unbounded recursion | never; cap tool calls in every prompt |
| `description` / `parameters` in `keen-tools.json` instead of the prompt | the model does not know the tool | describe it in the system prompt |
| changed the registry or a flow, did not deploy | the old project runs | `keen-validate` → `keen-deploy` |

## 1.13 Examples

All in [references/examples.md](references/examples.md), as one project that passes `keen-validate` with
0 errors: the calling agent (`Project.flow`) and its system prompt, the whole `keen-tools.json`, every `.flow`
and every script.

| Example | Flow | Shows |
|---|---|---|
| 1. Price Quote | `PriceQuote.flow` | one Script computes and replies; the reply-failure path |
| 2. Summarise Document | `SummariseDocument.flow` | a sub-agent: seed, stateless LLM node, return Script |
| 3. Shipping Check | `ShippingCheck.flow` | a Condition branches on a value a Script prepared |
| 4. Research Manuals | `ResearchTool.flow` + two script tools | pattern (c): a sub-agent with its own tools |
