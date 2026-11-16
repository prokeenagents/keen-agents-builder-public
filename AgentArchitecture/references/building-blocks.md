# Building blocks for multi-LLM agents

A Keen agent can hold many LLM nodes in one run: a classifier, a planner, workers, a judge, a writer. This file
lists the pieces you build them from, what each piece really does, and where it stops. Every rule here was checked
against the platform's code (2026-11-12). Read the node files (`Flow/Nodes/*`) for the full JSON of each node.

Three words used below:

- **The answering node** — the LLM node whose `agentId` is the agent's ID in the console. It gets the person's
  message and its final text is the chat's saved answer.
- **A helper** — any other LLM node in the run: a classifier, a planner, a worker, a judge, a voter.
- **The main path** — the agent's Start flow and anything reached from it by edges or by **Jump Flow**. A Run Flow
  sub-flow, a flow tool, a Parallel Flows branch and a Parallel Context run are *not* the main path.

## (a) Passing an answer on

Set two keys on the LLM node (there is no canvas control; a canvas save keeps them):

```json
"settings": { "agentId": "draft-judge", "...": "...", "agentResponse": true, "agentResponseProperty": "verdictRaw" }
```

After the node, `dictionary.verdictRaw` holds the model's text and the next node reads `${dictionary.verdictRaw}`.

- **Text answers only.** A tool call (`<SYSTEM CALL>` turn) and a failed call (provider error) write nothing. An
  answer cut at Max Tokens is still text and is written as it is.
- **A failure leaves the old value.** In a loop the key still holds the previous round's answer after a failed
  call. Clear the key yourself in the Script that reads it, and wire the node's Fallback — with Fallback UNWIRED a
  failed call leaves on Out (the error text as its answer, nothing written to the key), so the next step runs on the
  stale value.
- **One top-level key.** `agentResponseProperty: "a.b"` makes one key named `a.b`, not `a` → `b`.
- **Not over the cap.** An answer that would take the dictionary over its 1.5 MB cap is not written (only the
  engine's own log warns); the run goes on and the key keeps its old value.
- **Which dictionary.** The one the node works on:

| Where the LLM node runs | Where the answer lands | Still there after… |
|---|---|---|
| the main path, a Run Flow sub-flow, a Jump Flow target | the agent's dictionary | yes |
| a flow tool | the calling agent's dictionary | yes, the caller sees it after the tool ends |
| a Parallel Flows branch | the branch's own dictionary | **no** — it is deleted when the branch ends |
| a Parallel Context run | that run's copy of its list element | yes — merged into `list[i]` when the run reaches End Flow |

- **Other ways to get an answer.** A Script reads any agent's answers of this run from `system/agent`:
  `Agent.getAgentLastResponse('<agentId>')`, `Agent.getAgentLastResponseBySessionId('<agentId>', flowContext.sessionId)`
  (the one from this flow), `Agent.getAgentLastResponses('<agentId>')` (newest first). Each returns objects with
  `response` (the text), `sessionID`, `requestID`. A Script can then put it in the dictionary, or in the session
  (`Session.setSessionValue('key', text)`; the session holds only strings, numbers, booleans and `null`, 1.5 MB in all).

```js
import Agent from 'system/agent';

export const exec = () => {
    const mine = Agent.getAgentLastResponseBySessionId('draft-judge', flowContext.sessionId);
    dictionary.verdict = mine?.response?.trim() ?? '';
    return { ok: true };
};
```

## (b) Branching on an answer

A Condition cannot judge text and compares exactly (`"Billing\n"` is not `"billing"`). So: ask the model for one
fixed word or a small JSON, copy it into the dictionary with `agentResponse`, **normalise it in a Script**, then test
the clean value.

```js
// route.js — after the classifier wrote dictionary.routeRaw
export const exec = () => {
    const word = String(dictionary.routeRaw ?? '').trim().toLowerCase();
    dictionary.route = ['billing', 'technical'].includes(word) ? word : 'general';
    return { ok: true };
};
```

```json
"settings": { "value": "${dictionary.route} == \"billing\"" }
```

- More than two routes: chain Conditions (`false` of one into the next), or let the Script compute the route.
- A Condition whose placeholder holds a list or an object cannot be parsed and stops the whole run (E2201 Agent
  project error, final). Test a word, a number or a flag.
- Route to a handler flow with **Jump Flow** when the handler's LLM node answers the person (see (f): an answer
  given inside a Run Flow sub-flow is shown live but is not kept as the chat's saved answer). Use **Run Flow** when
  the handler only prepares data and the answering node sits after it on the main path.
- A Script alone (keywords, a regular expression, a lookup) is a free and silent router when rules are enough.

## (c) Calling another flow or a sub-agent

| Piece | What it does | Comes back? | Its dictionary |
|---|---|---|---|
| **Run Flow** | runs another flow to its end | yes, to `next_1` | the caller's (shared) |
| **Jump Flow** | continues in another flow | never | the caller's (shared) |
| **Flow tool** | an LLM node calls a flow by writing a `<SYSTEM CALL>` | yes, the LLM node runs again with the tool's reply | the calling agent's |

A **sub-agent** is a flow tool whose flow holds its own LLM node, with its own `agentId`, model, prompts and its own
tools (see `Flow/Tools/FlowTool/flow-tool-skill.md` §1.6 and §1.7a; verified end to end). So a worker can have
sub-agents of its own.

- **One tool call per answer.** If the model writes several `<SYSTEM CALL>` blocks, only the **first** runs. The
  calling node waits for the tool to finish, then runs again. Several workers through tools therefore run **one
  after another**, one per round.
- **No limit on rounds or depth.** Write the maximum number of calls into every prompt, and never list a flow
  tool in the prompt of an agent inside it.
- The tool's result reaches the model only as a message the tool files for the calling agent:

```js
Agent.setRootAgentPrompt(toolOptions.toolContext.agentId, {
    prompt: 'Worker result: …',
    sessionID: toolOptions.agentNode.flowContext.sessionId,   // the CALLER's session
    requestID: Tools.generateUUID()
});
```

## (d) Running LLMs in parallel and collecting the results

Two nodes run flows side by side. The reference chat client waits for all of them before the flow goes on.

| | **Parallel Context** | **Parallel Flows** |
|---|---|---|
| Runs | one flow, once per element of a dictionary list | different flows, one Flow Pointer each (two pointers may name the same flow) |
| Each run starts with | a copy of its element as its whole dictionary | an empty dictionary |
| Results come back | **merged**: each run's final dictionary replaces its element when it reaches End Flow | **never through the dictionary** — only the session or `system/agent` |
| How many at once | waves of **15** in the reference client (the next wave starts when the whole wave has finished) | all at once, no cap |
| `${session.…}` in an LLM prompt | **empty** — put every value the LLM needs into the element | read normally in a branch started from the main path |

**Parallel Context is the collector of choice for LLMs.** Put the input in each element, let the worker LLM write
its answer with `agentResponse`, and read the list after the node:

```json
"settings": { "pipe": "Worker-Start", "contextCollection": "dictionary.tasks", "assignTo": "tasks" }
```

`dictionary.tasks` = `[{ "task": "Check the warranty terms" }, { "task": "Compare the two plans" }]`. In
`Worker.flow`: Start → LLM (`agentId` `task-worker`, an authored `user` turn `${dictionary.task}`,
`agentResponse` → `result`) → End Flow, Fallback → the same End. After the node every element carries `result`.
A prompt cannot read a list, so a Script turns the list into text for the next LLM:

```js
export const exec = () => {
    const items = Array.isArray(dictionary.tasks) ? dictionary.tasks : [];
    dictionary.findings = items.map((t, i) => `${i + 1}. ${t.task}: ${t.result ?? '(no answer)'}`).join('\n');
    return { ok: true };
};
```

- **Voting** (the same flow N times): a list of N elements with the same question (`[{ "q": "…", "n": 1 }, …]`),
  one worker flow, a Script that counts the answers. A list element that is not an object becomes `{}`.
- **Sectioning** (different flows): either Parallel Flows with one Flow Pointer per flow (each branch's result goes to a
  CHANNEL for the task — see `communication.md`; a session key only for a few small values), or Parallel Context whose elements carry a `kind` and whose
  one flow branches on it with a Condition into Run Flows — that keeps the merge-back.
- Keep Parallel Context on the main path (or in a Run Flow / Jump Flow / flow tool reached from it). Inside a
  Parallel Flows branch or a Parallel Context run, its runs seed from and merge into the list at the same path in
  the agent's **main** dictionary, not the branch's — usually there is none, so they start from `{}` and nothing
  merges.
- A final error in any one run (for example a Script's time limit) ends the **whole** run.
- The merged list counts toward the dictionary's 1.5 MB cap; a merge over it stops the run (E2201).

## (e) Loops and how to bound them

**An edge may go back to an earlier node.** keen-validate, the deploy step, the flow engine and the reference client
all accept it (the only loop they refuse is between Summarizer Fallbacks). The client queues a revisited node again;
it only ignores a node that is already waiting in the queue. A test project with the back edge below passes
keen-validate with 0 errors and 0 warnings.

**Nothing stops an unbounded loop** — no step count and no time limit for a flow run. It runs until the person
cancels. Every loop needs its own bound:

```
Join ─▶ LLM "writer" ─▶ LLM "judge" ─▶ Script score.js ─▶ Condition ─true─▶ LLM answering node ─▶ End
  ▲                                                          └─false─┐
  └──────────────────────────────────────────────────────────────────┘
```

```js
// score.js — reads the judge's JSON, counts the round, clears the raw key for the next round
export const exec = () => {
    let verdict = {};
    const raw = String(dictionary.verdictRaw ?? '');
    const json = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);   // a judge often wraps its JSON in fences
    try { verdict = JSON.parse(json); } catch { verdict = {}; }
    dictionary.verdictRaw = '';
    dictionary.attempts = Number(dictionary.attempts ?? 0) + 1;
    dictionary.passed = typeof verdict.score === 'number' && verdict.score >= 8;
    // the feedback goes to the WRITER on the next round — a writer-facing default when the judge's JSON was unusable
    dictionary.feedback = typeof verdict.feedback === 'string' ? verdict.feedback : 'Improve the draft: make it clearer and more specific.';
    return { ok: true };
};
```

```json
"settings": { "value": "${dictionary.passed} == true || ${dictionary.attempts} >= 3" }
```

- The counter must be a Script: an Assignment writes values, it cannot add one.
- Set `attempts` to `0` before the loop (a Script at the start), or a second pass through the same loop in the same run
  starts with the old count (the dictionary lives for the whole run; the root End wipes it).
- The back edge goes into a node whose `in` takes several edges (an LLM, a Script, a Join Flow), not into a
  Condition or an Assignment (single-in) — put a Join Flow there.
- A prompt is resolved again on every visit, so `${dictionary.feedback}` in the writer's prompt is the newest one.
- Another bound: a **Loop** over a list of N items is at most N rounds. When the work is done early, set a flag and
  route the remaining passes straight back to the Loop's `next_2` (leaving the body by another path ends the loop
  and leaves its state behind).

## (f) Visibility — what the person sees from each LLM node

**Every LLM node's text streams to the chat while it is written — helpers included. This is by design: the
client sees what every agent answered and what each answer cost in tokens, so the cost of a round is
easy to compute.**

- **The client runs every node itself.** For each LLM node the SDK sends the call and waits for that node's result:
  the whole answer, its token use (`response.usage`) and the agent's name. Who called whom — a tool, a sub-agent, a
  branch — does not matter to it; it only sees the next node. The live text (`token` frames) is a preview of the same
  answers.
- **The final answer is ONE** — the answering node's: the console agent's ID on the run's own session (reach it by
  Jump Flow, not Run Flow — (g)). The site waits for that one (the SDK recognises it by the root flow's session and request ids —
  `../../Entanglement/SDK/using.md`); everything else (helpers, sub-agents, tool calls) it shows in one accordion
  behind it. How it draws them is the site's own logic, not the platform's.
- Every LLM node streams, whatever its settings: Interact with DB off, Use tools off, another `agentId`, a Run Flow, a
  flow tool, a Parallel Flows branch, a Parallel Context run. The only model call that streams nothing is the
  **Summarizer**. Do not try to hide a helper; keep its text short and readable — it is part of the record and of the
  round's cost.
- **After a reload** the site shows the saved history: one row per message, the person's text and the answering
  node's final answer. Helpers' turns are not shown.
- **The runner** (`run.ts`) prints every stream event and, in the returned flow tree, every node's answer
  separately — the place to check what each helper said.

What is saved, and what the next message's prompt sees:

| The node | Saved? | Shown after a reload | In the next message's prompt |
|---|---|---|---|
| the answering node on the main path | yes, the chat's row for this message | yes | yes, for that agent ID |
| an LLM with the agent's ID inside a Run Flow sub-flow, a tool, a branch or a run | yes, as an extra row (not the chat's row) | **no** | yes — it is read as conversation |
| a helper with its own ID, Interact with DB on | yes, under its own ID | no | only for that helper ID |
| any node with Interact with DB off | nothing | no | nothing |

So the answering node must sit on the main path (the Start flow or a Jump Flow target). An answer produced inside a
Run Flow sub-flow streams normally but the message is missing from the saved chat on reload.

**Designing for it:**

1. Keep helper answers tiny (one word, a short JSON) and say in the agent's design that the person may see them.
2. Prefer a Script for routing and checks when rules are enough — a Script streams nothing.
3. Keep loops and fan-outs small; each round's text reaches the person.
4. How the accordion and the final answer are drawn is the site's own logic: in the returned flow tree each LLM
   node's entry carries its `agentName`, its `response.text` and its `response.usage`.

## (g) The agentId rules for helpers

1. **The person's message is filed only under the console agent's ID.** It is not in the dictionary and not in the
   session. An LLM node reads the newest message filed under **its own** `agentId` (preferring its own session).
2. **A helper with its own ID** (`route-classifier`, `task-worker`) gets the input one of two ways:
   - **Recommended:** a Script puts the text in the dictionary, and the helper has an authored `user` turn
     `${dictionary.userMessage}` (or the task in the system prompt). No seed message is needed.
   - Or a Script files a message for the helper: `Agent.setRootAgentPrompt('route-classifier', { prompt, sessionID: flowContext.sessionId, requestID: Tools.generateUUID() })`.

   Without either, a call to an Anthropic or Google model is refused before it is sent (no user message): the
   node takes its Fallback (Out when it is unwired) with the refusal text as its answer, and nothing is written to
   its `agentResponse` key.

```js
import Agent from 'system/agent';

export const exec = () => {
    dictionary.userMessage = Agent.getRootAgentPrompt('support-agent')?.prompt ?? '';   // the console agent's ID
    return { ok: true };
};
```

`getRootAgentPrompt(id)` returns the newest message filed for that ID — read it in the first Script, before any
tool files a reply for the same ID.

```json
"prompts": [
  { "id": "p0", "role": "system", "content": "Answer with exactly one word: billing, technical or general." },
  { "id": "p1", "role": "user", "content": "${dictionary.userMessage}" }
],
"specialRules": [ { "type": "skip-internal-database-interactions" }, { "type": "skip-internal-tooling" } ]
```

3. **Turn Interact with DB off on helpers without tools.** Then a helper loads no history and saves nothing: every
   call starts clean, and nothing of it reaches the conversation. With it on, a helper keeps its own history under
   its own ID in this chat — and **runs that share one ID at the same time see each other's turns of the current
   message** (history is kept per chat and ID, not per run).
4. **A helper that calls tools needs Interact with DB on** (on a recall it otherwise sees only the newest tool reply,
   not its task) — or put its task in the system prompt from the dictionary, which is resolved on every recall.
5. **A helper with the console agent's ID** sees the person's message without any Script. What it does to the
   conversation:
   - with Interact with DB **off**: nothing is saved — a workable shortcut for a classifier on the main path;
   - with it **on**, on the main path: it saves the chat's row for this message; the real answer then saves a
     **second** row, so the saved chat shows the person's message twice and the next prompt reads both answers;
   - with it **on**, in a branch, a run or a sub-flow: its answer is saved as conversation and read by the agent in
     later messages.
   - In parallel runs every copy gets the same person's message.
6. `agentId` is a literal kebab-case slug (no `${…}`), so all copies of one worker flow share one ID.

## (h) Limits and costs

| What | Limit today |
|---|---|
| Model per node | each LLM node has its own company, model and parameters — use a small model (`claude-haiku-4-5-20251001`, `gpt-5.4-nano`, `gemini-3.1-flash-lite-preview`) for classifiers, judges of simple rules and workers |
| Answer length | `maxTokens` per node; a cut answer is delivered marked truncated, never retried |
| Steps, loop rounds, tool rounds, nesting depth | **no limit** — set your own bound (counter + Condition, a Loop of N, "at most N calls" in prompts) |
| Total time of one run | **no limit** for the flow; the person can cancel |
| One Script node | 15 minutes from the moment it starts running (per node, not per run); then the whole run ends (E8101) |
| One model call | the platform waits about 5 minutes for one node's reply by default; keep large reasoning answers well under it |
| Parallel Context | waves of 15 at a time in the reference client; 100 elements = 7 waves |
| Parallel Flows | every branch at once, no cap |
| Dictionary / session | 1.5 MB each; the session holds primitives only |
| Cost | every model call is billed; nothing caps a run's tokens. Each LLM node's reply in the flow tree carries its token `usage` |
| Chat summary | the Summarizer node has its own model — a fast, non-reasoning one keeps it cheap |

Cost scales with **(number of LLM calls) × (prompt size)**. A helper with Interact with DB on also sends up to 50
earlier turns of its own history on every call; Interact with DB off sends only its prompts.

## Feasibility of the five architectures

| Architecture | Possible today? | How (the building blocks) | Caveats |
|---|---|---|---|
| **1. Orchestrator-worker** | **yes** | **Dynamic, one after another:** the orchestrator LLM calls workers as flow tools (c); each worker flow has its own LLM, model and its own tools (sub-agents). **Parallel:** the orchestrator answers a JSON plan (a) → a Script turns it into `[{ "task": … }]` → Parallel Context runs a worker flow per task (d) → a Script joins the results → the answering node writes the reply. Both can be combined: one flow tool "Run workers" takes the plan in `!*context` and fans it out with Parallel Context inside the tool flow, then replies with the joined results. | All workers' text goes to the accordion (f). Only one tool call per orchestrator answer. No limit on rounds — state one in the prompt. Parallel workers that call tools: keep each worker's task and notes in its own dictionary key with Interact with DB OFF (`communication.md`), or with DB on they share one ID and see each other's turns of the current message (g.3). |
| **2. Routing** | **yes** | A cheap classifier LLM (own ID, Interact with DB off, input via `${dictionary.userMessage}`) → `agentResponse` → a Script normalises → Condition(s) → **Jump Flow** to the handler flow (b, g). A Script-only router when rules suffice. | The classifier's word goes to the accordion (f). Route with Jump Flow, not Run Flow, when the handler answers (an answer inside a Run Flow sub-flow is not saved as the chat's answer). |
| **3. Prompt chaining** | **yes** | LLM A (`agentResponse` → `step1`) → optional gate: a Script checks `step1` and sets a flag → Condition → LLM B with `${dictionary.step1}` in its prompt → … → the answering node (a, b). | Every step's text goes to the accordion (f). Text only; a failed step does not write its key — wire Fallback. A list or object in a prompt resolves to empty text — a Script makes a string first. |
| **4. Parallelization** | **yes** | **Voting:** Parallel Context over N copies of one element, the worker LLM writes its answer with `agentResponse`, a Script counts. **Sectioning:** Parallel Flows (results on a channel) or Parallel Context with a `kind` per element. The answering node combines (d). | Parallel LLMs stream at the same time; each node's whole answer still comes back to the client in its own result (f). `${session.…}` is empty in Parallel Context runs. Waves of 15; Parallel Flows has no cap. One final error ends the whole run. |
| **5. Evaluator-optimizer** | **yes** | Writer LLM → judge LLM (JSON score + feedback) → Script (parse, count, clear) → Condition `passed or attempts ≥ N` → back edge through a Join Flow to the writer, or on to the answering node (e). | Every draft and every verdict goes to the accordion (f). Nothing stops a loop without the counter. |

**All five can be built today.** Helpers' text is visible by design: the client gets every node's answer and token use, the site puts the helpers in one accordion and waits for the one final answer.

### The smallest platform changes that would close the gaps (findings, not built)

1. **Save the answer of a Run Flow sub-flow as the chat's answer.** The saved chat row is made only when the
   answering node runs with the run's own request id; a Run Flow sub-flow gets a new one. Deciding it by the console
   agent's ID on the run's own session (which a Run Flow sub-flow shares) would fix it.
2. **Keep parallel runs of one helper ID apart.** For the current message, load only the turns of this node's own
   session, so runs that share an ID and keep history do not read each other's turns.
3. **Read `${session.…}` in an LLM prompt from the run's session everywhere**, as Scripts and Conditions already do,
   so it is no longer empty inside Parallel Context runs, in a branch started from a branch, or in a Run Flow inside
   a branch.
4. **An optional cap on node visits per run** in the client (stop with a clear error after N visits) as a safety net
   for a loop whose bound was forgotten.
