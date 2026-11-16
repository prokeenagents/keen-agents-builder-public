# Orchestrator-worker

## What it is

One main agent splits the person's request into tasks and hands each task to a **specialised sub-agent**. Each
sub-agent has its own LLM (its own model, system prompt and settings) and may have tools or sub-agents of its own.
The main agent then answers with what the workers returned.

Use it when one request needs several kinds of expertise, and a single prompt would have to hold all of them: a
support question that is half technical and half warranty, or research that spans several sources. Do not use it
when one LLM node with a few tools can answer. That is cheaper, faster and shows the person less noise. If the steps
are always the same, use a fixed chain instead ([prompt-chaining.md](prompt-chaining.md)). If the request only
needs to reach the right single handler, use [routing.md](routing.md).

## On Keen

- [LLM](../Flow/Nodes/LLM/llm-skill.md): the orchestrator, every worker and the synthesizer, each with its own `agentId` and model.
- [Flow tool](../Flow/Tools/FlowTool/flow-tool-skill.md): a worker as a sub-agent the orchestrator calls with `<SYSTEM CALL>` (§1.6, §1.7a).
- [Script tool](../Flow/Tools/ScriptTool/script-tool-skill.md): a worker's own tools.
- [Script](../Flow/Nodes/Script/script-skill.md): seeds a worker, parses the plan, collects the results, cleans up.
- [Condition](../Flow/Nodes/Condition/condition-skill.md): stops an invalid task, and picks a worker by `kind`.
- [Parallel Context](../Flow/Nodes/ParallelContext/parallel-context-skill.md): runs one worker flow per planned task, in parallel, and merges the results.
- How the information travels between them: [references/communication.md](references/communication.md). Every
  rule below comes from [references/building-blocks.md](references/building-blocks.md) (c), (d), (f) and (g).

There are two ways to build it:

| | **A — workers as flow tools** | **B — a plan + Parallel Context** |
|---|---|---|
| Who decides | the orchestrator's model, round by round: it can ask the warranty desk *after* reading the technician's answer | the orchestrator answers once with a JSON plan; a Script turns it into a list |
| Order | **one after another**: only the first `<SYSTEM CALL>` of an answer runs | **in parallel**: one Worker run per task, in waves of 15 |
| Workers' own tools | yes, the recommended setup below | keep them without tools (see Limits) |
| Answers the person | the orchestrator itself | a separate synthesizer node with the console agent's ID |

Pick **A** when the next task depends on an earlier result, or when the workers need tools. Pick **B** when the tasks
are independent and the person should not wait for them one by one. You can also mix the two (Variations).

## The shape

```
A  Project.flow
   Start ─▶ LLM bike-support (orchestrator) ─▶ End
              │ <SYSTEM CALL> Ask Technician          ▲ reply "Ask Technician result: …"
              ▼                                       │
   TechnicianTool.flow  (WarrantyTool.flow is the same)
   Start ─▶ Start worker ─▶ Condition ok? ─true─▶ LLM bike-technician ─▶ Finish worker ─▶ End
              │error         └false─▶ Drop memory ─▶ End   │  ▲
              ▼                                            │  │ short reply ("Added to your notes: …")
            Worker failed ◀── Fallback of the LLM,         ▼  │
            ─▶ End            error of every Script     Fault Code Lookup / Battery Health
                                                        (each appends to dictionary.technician.notes)

B  PlanProject.flow
   Start ─▶ Seed ─▶ LLM task-orchestrator ─▶ Parse plan ─▶ Parallel Context ─▶ Collect ─▶ LLM bike-support ─▶ End
                    (JSON plan)                             │  Worker-Start × N
                                                            ▼
                    Worker.flow: Start ─▶ kind technical? ─▶ tech-specialist ───────┐
                                          └▶ kind warranty? ─▶ warranty-specialist ─┼─▶ End  (the run's dictionary is
                                                            └▶ parts-specialist ────┘         merged into its element)

In A and B the chat LLM bike-support also has its
   Fallback ─▶ the same LLM on gemini-2.5-flash (same Out and Summary; its Fallback ─▶ End)
   Summary ─▶ Summarizer (claude-haiku-4-5) ─Fallback─▶ Summarizer (gpt-4o-mini); both Outs ─▶ End  (both LLMs)
```

## How the data moves

The three means (session, channels, private dictionaries) are defined in
[references/communication.md](references/communication.md).

**A — workers as flow tools.** No session values are used.

1. The person's message is filed under `bike-support` (**channels**: the `root` lane of `system/agent`). The
   orchestrator takes it as its trigger. It keeps **Interact with DB on**: it is the answering node, and it calls tools.
2. It writes one `<SYSTEM CALL>` to `Ask Technician` with `!*context` `{"task": "…"}`. The tool flow runs on the
   **caller's dictionary**, the orchestrator's own.
3. `Start worker` stores the worker's working memory under one namespaced **dictionary** key:
   `dictionary.technician = { ok, task, notes: "", calls: 0 }`. It then files the task as the worker's first user
   message (**channels**: `setRootAgentPrompt`), on the tool flow's session.
4. `bike-technician` has **Interact with DB off**: it loads no history, saves nothing and sends no history tokens. Its
   system prompt reads `${dictionary.technician.task}` and `${dictionary.technician.notes}`. A prompt is resolved again
   on **every run of the node**, and every return from a tool is a new run, so the worker never loses its task.
5. Its tools (`Fault Code Lookup`, `Battery Health`) run on the same dictionary. Each one **appends** its finding to
   `notes` as text, counts the call, and replies briefly to the worker (**channels**; their `toolOptions` name `bike-technician`).
6. When the worker answers in plain text, `Finish worker` reads that answer from `system/agent` (it is stored for the
   run even with Interact with DB off). It then deletes `dictionary.technician` and files
   `Ask Technician result: …` for `bike-support` on the orchestrator's session (**channels**).
7. The orchestrator runs again. It may ask `Ask Warranty Desk` the same way (key `warranty`, worker
   `warranty-advisor`, tool `Order Lookup`), and then it answers. Its answer is the chat's saved answer.

Turn Interact with DB **on** for a worker only when it *should* remember across the person's messages. Every call
then sends up to 50 earlier turns.

**B — a plan + Parallel Context.**

1. `Seed` copies the person's message (filed only under the console agent's ID) into `dictionary.userMessage`.
2. `task-orchestrator` (Interact with DB off, Use tools off) reads it from an authored `user` turn. Its JSON answer
   goes to `dictionary.planRaw` through `agentResponse`.
3. `Parse plan` turns it into `dictionary.tasks = [{ kind, task, question }]` and clears `planRaw`.
4. Parallel Context gives each run **a copy of its element as its whole dictionary**. The specialist reads
   `${dictionary.question}` and `${dictionary.task}`; `${session.…}` would be empty in a run. `agentResponse` writes
   `result` into the run's dictionary, and at End Flow it is **merged** back into its element. The specialists file no
   trigger prompt (their input is the authored `user` turn), so runs that share one ID cannot take a sibling's message.
5. `Collect` joins the list (the **merge**, no extra store) into one text (`dictionary.findings`) and deletes the list. `bike-support`, the console
   agent's ID on the main path, sees the person's message by itself and answers from the findings.

| Node | `agentId` | Interact with DB | Why |
|---|---|---|---|
| orchestrator (A), synthesizer (B) | `bike-support` = the console agent | on | answers the person; its answer must be saved |
| workers with tools (A) | `bike-technician`, `warranty-advisor` | **off** | memory in the dictionary; nothing reaches the conversation |
| planner (B) | `task-orchestrator` | off | a stateless helper; input from the dictionary |
| specialists (B) | `tech-specialist`, `warranty-specialist`, `parts-specialist` | off | runs sharing one ID never see each other's turns |

## What the person sees

Every LLM node's text streams to the person's chat while it is written — by design: the client gets each node's answer and its token use; the site shows everything behind the main agent in one accordion and waits for ONE final answer, the answering node's
([building-blocks.md](references/building-blocks.md) (f)).

- **A:** the orchestrator's text, then the technician's text (its tool calls and its 80-word diagnosis), then the
  orchestrator again, then the warranty desk, and then the final answer. All of it but the final answer is steps in the
  accordion, **one after another**, because the workers run in turn. After a reload, only the person's message and the orchestrator's final
  answer remain.
- **B:** first the planner's JSON. Then up to four specialists write **at the same time** (each one's whole
  answer comes back in its own result). Then the synthesizer gives the final answer, and only its answer is saved.
- Keep helpers short: a small `maxTokens` per node, "at most 80 / 100 words", "notes for a colleague, no greeting",
  and a JSON-only planner. Every helper's tokens count in the round's cost.

## Limits, cost and risks

- **Model calls per request.** A: the orchestrator runs once at the start and once after every worker, and each worker
  runs once plus once per tool call. "E07 on BV-1001, order BW-50017, is it covered?" costs 3 + 3 + 2 = 8 calls.
  B: 1 planner + N specialists + 1 synthesizer (at most 6 here).
- **Waves of 15.** B's runs start 15 at a time in the reference client; 16 tasks take two waves. `MAX_TASKS` is 4.
- **No limit on tool rounds or depth.** The platform stops nothing. This example bounds it three ways: "at most 3
  specialists" in the orchestrator's prompt, "at most 4 tool calls" in each worker's prompt, and
  `MAX_WORKER_TOOL_CALLS`. After the fourth call a worker's tools do no more work; they only reply "no tool calls
  left". A model that keeps calling anyway is still not stopped. Never list a flow tool in the prompt of an agent
  inside it.
- **The dictionary cap (1.5 MB).** A worker's notes grow inside the **caller's** dictionary. A Script whose writes
  pass the cap fails, and a tool's reply is then dropped (the worker reads `No tool response`). B's merged list grows
  inside the main dictionary, and a merge over the cap stops the whole run with **E2201**. Keep findings short,
  delete each key when its work is done, and copy at most 4000 characters of the question into each element.
- **A failing worker.** A: the worker's Fallback and every Script `error` lead to `Worker failed`, which deletes the
  key and tells the orchestrator. The orchestrator goes on with the other worker. B: a failed specialist call writes
  no `result`, the run still reaches End and merges, and `Collect` shows `(no answer)`. A **final** error in any run
  ends the whole run (for example E8101, a Script's 15-minute limit).
- **No tools for B's workers.** Runs that share one ID with Interact with DB on see each other's turns, and a flow
  tool inside a run is not verified. Put their facts in the prompt, or use way A.
- **Cost of history.** Interact with DB on adds up to 50 earlier turns to every call. That is why the workers keep
  their memory in the dictionary; only the orchestrator pays for history.

## The complete example

Brightway Bikes, a fictional e-bike shop. The customer writes: "My Volt shows E07, the battery is BV-1001 and only
lasts 25 km. Order BW-50017 – is it covered?" In A, the orchestrator asks the technician, who looks up the code and
the battery (54 % health). It then asks the warranty desk, which looks up the order (bought 2025-03-14). Then it
answers. B answers the same request from a plan, with three specialists in parallel.

Files ([examples/orchestrator-worker/project](examples/orchestrator-worker/project), `keen-validate`: 0 errors,
0 warnings):

```
flows/Project.flow                     A: the console agent bike-support (Start Flow "Project", Start Node "Start")
flows/{TechnicianTool,WarrantyTool}.flow   A: the two workers      flows/Worker.flow   B: one run per task
flows/PlanProject.flow                 B: set the console agent's Start Flow to "PlanProject" to use it
scripts/workers/shared/  tools/  plan/  keen-tools.json
scripts/services/workshop/{service,connector,utils,settings}.js   the fictional workshop (the tools import only service.js)
```

**A — the orchestrator.** `keen-tools.json` registers `Ask Technician` → `TechnicianTool-Start` and `Ask Warranty
Desk` → `WarrantyTool-Start` (flow tools), plus the workers' three script tools. The model learns about tools only from
a system prompt, and each prompt lists only its own agent's tools:

```json
  "settings": {
   "agentId": "bike-support", "agentName": "Brightway Support", "sessionId": "", "requestId": "",
   "llm": {"company": "anthropic", "model": "claude-sonnet-4-6", "modelId": 4938, "parameters": {"temperature": 0.3, "maxTokens": 4096}},
   "prompts": [
    {"id": "p0", "role": "system", "content": "You are the support agent of Brightway Bikes, a fictional e-bike shop. You coordinate two specialists, then answer the customer yourself, briefly and in the customer's language.\n\nWhen you need a tool, write exactly one block, with each marker at the start of a line:\n\n<SYSTEM CALL>\n!*action\nuse tool\n!*tool\n<the tool's name>\n!*context\n<the input the tool needs>\n</SYSTEM CALL>\n\nWrite nothing else inside the block, then wait: the tool's reply arrives as the next user message. Only the first block of an answer runs. So ask one specialist, wait for the reply, then ask the next one. Ask at most 3 specialists for one customer message, then answer with what you have.\n\nSpecialists:\n1. Ask Technician\nDescription: diagnoses faults, display fault codes and battery health; has its own workshop tools.\nUsage: !*context is JSON {\"task\": \"<one clear task with every fault code, battery serial number and symptom the customer gave>\"}.\n2. Ask Warranty Desk\nDescription: decides whether a repair or a replacement is covered; looks the customer's order up.\nUsage: !*context is JSON {\"task\": \"<the question, with the order number and the technician's diagnosis when you have it>\"}.\n\nNever invent prices, dates or policies: use only what the specialists return. If a specialist says its input was invalid, fix the input and ask once more."}
   ],
   "specialRules": []
  }
```

**A — the worker flow tool.** `Start worker` (`workers/shared/startWorker.js`, Key/Value Pairs `key` `technician`,
`worker` `bike-technician`, `tool` `Ask Technician`) first checks `!*context`. An invalid task gets its own reply and
`{ ok: false }`, so the Condition sends it to `Drop memory`. A valid task ends like this:

```js
    // The working memory the worker's system prompt reads on EVERY run (every return from a tool too).
    dictionary[key] = { ok: true, task, notes: '', calls: 0 };
    // The worker's first user message, on THIS flow's session (= the worker's session).
    Agent.setRootAgentPrompt(String(props.worker), {
        prompt: task,
        sessionID: flowContext.sessionId,
        requestID: Tools.generateUUID()
    });
    return { ok: true };
}
```

The worker: Interact with DB off, Use tools on, its memory in its system prompt:

```json
  "settings": {
   "agentId": "bike-technician", "agentName": "Bike Technician", "sessionId": "", "requestId": "",
   "llm": {"company": "anthropic", "model": "claude-haiku-4-5-20251001", "modelId": 4939, "parameters": {"temperature": 0.2, "maxTokens": 2048}},
   "prompts": [
    {"id": "p0", "role": "system", "content": "You are the workshop technician of Brightway Bikes (fictional). You work for the support agent, not for the customer.\n\nYour task: ${dictionary.technician.task}\n\nYour notes so far (what your tools found):\n${dictionary.technician.notes}\n\nWhen you need a tool, write exactly one block, with each marker at the start of a line:\n\n<SYSTEM CALL>\n!*action\nuse tool\n!*tool\n<the tool's name>\n!*context\n<the input the tool needs>\n</SYSTEM CALL>\n\nWrite nothing else inside the block, then wait: the tool's reply arrives as the next user message. Only the first block of an answer runs.\n\nTools:\n1. Fault Code Lookup\nDescription: what a display fault code means and what to do about it.\nUsage: !*context is JSON {\"code\": \"E07\"}.\n2. Battery Health\nDescription: a battery's health in percent, its charge cycles and its purchase date, by serial number.\nUsage: !*context is JSON {\"serial\": \"BV-1001\"}.\n\nUse at most 4 tool calls. When your notes answer the task, or a tool says you have no calls left, answer in at most 80 words: the diagnosis and the next step. No greeting."}
   ],
   "specialRules": [{"type": "skip-internal-database-interactions"}]
  }
```

Its tools append to the notes (from `workers/shared/workerCall.js`):

```js
/**
 * The worker's working memory lives in the dictionary under ONE key: { ok, task, notes, calls }.
 * Append a finding to its notes and count the call, then reply briefly. The notes stay a STRING:
 * a list or an object placed into prompt text resolves to empty text.
 */
export function noteAndReply(key, finding, maxCalls) {
    const memory = dictionary[key];
    if (!memory || typeof memory.notes !== 'string') {
        replyToCaller(finding);                                   // called outside its worker: plain reply
        return;
    }
    const used = Number(memory.calls ?? 0);
    if (used >= maxCalls) {                                       // the bound: no more work, only the reminder
        replyToCaller('You have no tool calls left. Answer now from your notes.');
        return;
    }
    dictionary[key] = { ...memory, calls: used + 1, notes: `${memory.notes}- ${finding}\n` };
    replyToCaller(used + 1 >= maxCalls
        ? `Added to your notes: ${finding} That was your last tool call: answer now from your notes.`
        : `Added to your notes: ${finding}`);
}
```

`Finish worker` reads the worker's answer with `getAgentLastResponseBySessionId('bike-technician',
flowContext.sessionId)`, deletes `dictionary.technician`, and replies `Ask Technician result: …` to the orchestrator.
`Worker failed` does the same on every `error` and Fallback path, with a failure sentence instead.

**B — the orchestrator (a planner) and the plan Script.** Parallel Context then runs `Worker-Start` over
`dictionary.tasks`:

```json
  "settings": {
   "agentId": "task-orchestrator", "agentName": "Task Orchestrator", "sessionId": "", "requestId": "",
   "llm": {"company": "anthropic", "model": "claude-sonnet-4-6", "modelId": 4938, "parameters": {"temperature": 0, "maxTokens": 1024}},
   "prompts": [
    {"id": "p0", "role": "system", "content": "You plan the work of Brightway Bikes' support team (fictional). You do not answer the customer. Split the customer's message into sub-tasks for the specialists:\n- technical: faults, fault codes, range, charging, battery health\n- warranty: warranty, returns, repairs under guarantee\n- parts: prices, stock and delivery of parts and accessories\nAt most 4 sub-tasks, one sentence each, only for what the message asks. Answer with JSON only, no other text: {\"tasks\": [{\"kind\": \"technical\", \"task\": \"...\"}]}. If nothing needs a specialist, answer {\"tasks\": []}."},
    {"id": "p1", "role": "user", "content": "${dictionary.userMessage}"}
   ],
   "specialRules": [{"type": "skip-internal-database-interactions"}, {"type": "skip-internal-tooling"}],
   "agentResponse": true, "agentResponseProperty": "planRaw"
  }
```

```js
// The orchestrator's JSON plan -> one list element per sub-task for Parallel Context.
// Each element becomes a Worker run's WHOLE dictionary, so it carries everything the worker's
// prompt reads (an LLM inside a Parallel Context run reads ${session.…} as empty).
const KINDS = ['technical', 'warranty', 'parts'];
const MAX_TASKS = 4;

export const exec = () => {
    const raw = String(dictionary.planRaw ?? '');
    dictionary.planRaw = '';                                     // a failed call next time must not reuse it
    let plan = {};
    try { plan = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)); } catch { plan = {}; }
    const items = Array.isArray(plan.tasks) ? plan.tasks : [];
    dictionary.tasks = items
        .map(t => ({ kind: String(t?.kind ?? '').trim().toLowerCase(), task: String(t?.task ?? '').trim().slice(0, 500) }))
        .filter(t => KINDS.includes(t.kind) && t.task)
        .slice(0, MAX_TASKS)
        .map(t => ({ ...t, question: dictionary.userMessage }));
    return { ok: true };                                         // an empty list: Parallel Context skips, the synthesizer answers alone
};
```

**B — the worker flow.** The Condition `${dictionary.kind} == "technical"` leads to `tech-specialist`. Its `false`
leads to a second Condition for `"warranty"`, whose `false` leads to `parts-specialist`. Every specialist's `next_1`
and Fallback go to End. The technical one:

```json
  "settings": {
   "agentId": "tech-specialist", "agentName": "Technical Specialist", "sessionId": "", "requestId": "",
   "llm": {"company": "anthropic", "model": "claude-haiku-4-5-20251001", "modelId": 4939, "parameters": {"temperature": 0.2, "maxTokens": 600}},
   "prompts": [
    {"id": "p0", "role": "system", "content": "You are the technical specialist of Brightway Bikes (fictional). Facts: the Volt battery (500 Wh) gives 60-90 km; under 40 km on a full charge means a worn battery; fault E07 = cells out of balance, E12 = display lost contact (hold power and minus for 10 seconds); charge between 0 and 35 °C. Answer only your sub-task, in at most 100 words, as notes for a colleague, not to the customer."},
    {"id": "p1", "role": "user", "content": "Customer's message: ${dictionary.question}\nYour sub-task: ${dictionary.task}"}
   ],
   "specialRules": [{"type": "skip-internal-database-interactions"}, {"type": "skip-internal-tooling"}],
   "agentResponse": true, "agentResponseProperty": "result"
  }
```

**B — collect and synthesize.** `plan/collect.js` joins the merged list into `dictionary.findings` (one line
`[kind] task` per element, then its `result` or `(no answer)`) and deletes the list. The synthesizer reads it:

```json
  "settings": {
   "agentId": "bike-support", "agentName": "Brightway Support", "sessionId": "", "requestId": "",
   "llm": {"company": "anthropic", "model": "claude-sonnet-4-6", "modelId": 4938, "parameters": {"temperature": 0.3, "maxTokens": 2048}},
   "prompts": [
    {"id": "p0", "role": "system", "content": "You are the support agent of Brightway Bikes, a fictional e-bike shop. Answer the customer's message in the customer's language, in at most 200 words. Build the answer from the specialists' findings below; never contradict them and never invent prices, dates or policies. Where a finding says \"(no answer)\", or there are no findings, answer what you can and say a colleague will follow up on the rest.\n\nSpecialists' findings:\n${dictionary.findings}"}
   ],
   "specialRules": [{"type": "skip-internal-tooling"}]
  }
```

**To adapt it:** rename the shop, the agents and the tools. To add a worker in A, copy `TechnicianTool.flow` with new
node ids, set the three Key/Value Pairs (a new dictionary key per worker), register it in `keen-tools.json`, and add
it to the orchestrator's prompt. Point its tools' `noteAndReply('<key>', …)` at that key. To add a kind in B, add it
to the planner's prompt and to `KINDS` in `plan.js`, then add one Condition and one specialist to `Worker.flow`.
Replace `services/workshop` with your real service: its `connector.js` builds the authenticated `system/http`
client, and each tool reads the key with `system/secrets` and passes it to `WorkshopService.connect({ apiKey })`. Then run `keen-validate` → `keen-deploy` → a test chat, and check
every node's answer in the flow tree.

## Variations

1. **A worker with its own sub-agents.** A worker's prompt lists another flow tool whose flow holds an LLM node, built
   with the same start / finish pattern and its own dictionary key and `agentId`. Each level adds model calls and
   waiting. Never list a flow tool in its own inner agent's prompt
   ([flow-tool-skill.md](../Flow/Tools/FlowTool/flow-tool-skill.md) §1.7a; Research Manuals in
   [its examples](../Flow/Tools/FlowTool/references/examples.md)).
2. **Mixing A and B.** One flow tool, "Run Specialists", takes the plan in `!*context`, runs Parallel Context over it,
   and replies with the joined results. The orchestrator stays dynamic, and the workers run in parallel. The reply
   Script sits after Parallel Context in the tool flow itself, because `toolOptions` is absent inside the runs.
3. **Specialists as different flows, reporting on a channel.** When specialists need different steps, not just
   different prompts, run one flow each with Parallel Flows. Each files its trigger on a channel per task, and one
   Script after Out consumes the channel (see [parallelization.md](parallelization.md)).
4. **A Script as the planner.** When fixed rules decide the tasks, a Script builds `dictionary.tasks`. It costs
   nothing and streams nothing.

## Mistakes that break it

| Mistake | What happens | Write instead |
|---|---|---|
| a worker with tools, Interact with DB off, its task only in the seeded message | on the first return from a tool it sees only the tool's reply and loses its task | the task and the notes in its system prompt from `${dictionary.<key>.…}` |
| the notes kept as a list or an object | `${dictionary.technician.notes}` resolves to empty text | append to a string |
| the worker's memory under a generic key (`dictionary.task`) | it overwrites the orchestrator's keys or another worker's | one namespaced key per worker, deleted at the end |
| a tool reply stamped with `flowContext.sessionId` | the caller reads `No tool response` | `toolOptions.agentNode.flowContext.sessionId` |
| several `<SYSTEM CALL>` blocks in one answer, expecting parallel work | only the first runs | way B, or Variation 2 |
| a worker with the console agent's ID | its turns mix into the person's chat history | its own kebab-case ID |
| `${session.…}` in a specialist inside Parallel Context | empty text | put the value in the element |
| `dictionary.tasks` as a list of strings | every element becomes `{}`, and the runs get nothing | `[{ "kind": …, "task": … }]` |
| `JSON.parse` on the planner's raw text | a code fence or a sentence makes it throw | cut from the first `{` to the last `}`, and fall back to `[]` |
| `planRaw` not cleared after reading | a failed call later leaves the old plan in place | clear it in the Script that reads it |
| a Script `error` unwired in a worker flow tool | the tool flow ends there: the worker's key stays in the dictionary and the orchestrator reads only `No tool response` | every `error` and Fallback → `Worker failed` → End |
| results read from `dictionary.<assignTo>` | always empty | read the list itself |
| the answering node inside a Run Flow sub-flow | it streams, but it is not saved as the chat's answer | keep it on the main path |
