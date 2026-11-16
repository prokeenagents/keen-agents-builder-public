# Prompt chaining

## What it is

The work is cut into fixed steps that run one after another, and the answer of one LLM is the input of the next.
Each step has a small, clear job and its own prompt: step 1 extracts, step 2 organises, step 3 writes. Between two
steps a Script may check the output (a **gate**) and stop the chain early.

Use it when one task always goes through the same stages, and one big prompt that does everything at once gets
sloppy: it skips a stage, mixes them, or invents. Small steps are easier to test, and a cheap model can do the easy
ones.

Do not use it when:

- one prompt does the job well — every extra step is one more model call and more text in the chat;
- the order of the steps depends on the request — let one LLM call tools (see `../Flow/Tools/SKILL.md`), or route
  ([routing](routing.md));
- the steps do not depend on each other — run them side by side (parallelization);
- a step needs no judgement (count, filter, format, look up) — make it a Script, not an LLM.

## On Keen

- [LLM](../Flow/Nodes/LLM/llm-skill.md) per **helper step**: its own `agentId`, a small model, Interact with DB off,
  Use tools off, `agentResponse` → its own dictionary key (`changes`, `outline`).
- `${dictionary.<key>}` in the **next** step's prompt — in an authored `user` turn or in the system turn.
- [Script](../Flow/Nodes/Script/script-skill.md) **readMessage.js**: the person's message into
  `dictionary.userMessage` (`getRootAgentPrompt`), and every chain key cleared.
- [Script](../Flow/Nodes/Script/script-skill.md) **checkChanges.js** as the **gate**: cleans step 1's text and sets a
  flag.
- [Condition](../Flow/Nodes/Condition/condition-skill.md) on the flag: go on, or leave the chain.
- [LLM](../Flow/Nodes/LLM/llm-skill.md) as the **last step = the answering node**: the console agent's ID,
  Interact with DB on, on the main path. A second answering node handles the gate's "no".
- [Script](../Flow/Nodes/Script/script-skill.md) **cleanUp.js** after the answer: deletes the chain's keys.
- No tools. The rules: [building-blocks.md](references/building-blocks.md) (a), (b), (f), (g); the three means of
  passing information: [communication.md](references/communication.md).

## The shape

```
Project.flow  (entry Project-Start = the agent's Start flow)

Start
  └─▶ Script readMessage                                   error ─▶ LLM Release Notes Asker
        └─▶ LLM change-extractor   (step 1)                Out and Fallback ─▶ checkChanges
              └─▶ Script checkChanges   (the gate)         error ─▶ LLM Release Notes Asker
                    └─▶ Condition ${dictionary.changesOk} == true
                          ├─ true ──▶ LLM notes-planner   (step 2)      Out and Fallback ─▶ step 3
                          │             └─▶ LLM release-notes-agent "Release Notes Writer" (step 3, the answer) ─▶ cleanUp ─▶ End
                          └─ false ─▶ LLM release-notes-agent "Release Notes Asker" (asks for the changes) ─▶ cleanUp

Writer and Asker (both release-notes-agent, both Out ─▶ cleanUp): each has its own
  Fallback ─▶ the same LLM on gemini-2.5-flash (same Out and Summary; its Fallback ─▶ cleanUp)
and all four share one Summary:
  Summary ─▶ Summarizer (claude-haiku-4-5) ─Fallback─▶ Summarizer (gpt-4o-mini); both Outs ─▶ cleanUp
```

## How the data moves

Of the three means in [communication.md](references/communication.md),
the chain uses the **private dictionary** for every hand-over (one
LLM's `agentResponse` key is the next LLM's `${dictionary.…}`), and the **channels** (`system/agent`) only to
read the person's message. The session is not needed.

1. **readMessage.js** reads `Agent.getRootAgentPrompt('release-notes-agent')` (the person's message is filed only
   under the console agent's ID) into `dictionary.userMessage`, and sets `dictionary.changes` and
   `dictionary.outline` to `''` — a failed step leaves the old value in its key, so no step reads a stale value.
2. **Step 1, change-extractor** (agentId `change-extractor`). User turn: `${dictionary.userMessage}`. It answers
   one `- ` line per user-visible change, or `NONE`. `agentResponse` → `dictionary.changes`.
3. **The gate, checkChanges.js**, keeps only the lines that start with `- ` (at most 30), writes them back to
   `dictionary.changes`, and sets `dictionary.changeCount` (a number) and `dictionary.changesOk` (a boolean). A
   `NONE`, an empty answer or a failed call all give `changesOk = false`.
4. **The Condition** tests `${dictionary.changesOk} == true`.
5. **Step 2, notes-planner** (agentId `notes-planner`). User turn: `${dictionary.changes}` — step 1's cleaned answer.
   It groups the lines under New / Improved / Fixed. `agentResponse` → `dictionary.outline`.
6. **Step 3, Release Notes Writer** (agentId `release-notes-agent`, the console agent). Its system turn holds
   `${dictionary.outline}` and `${dictionary.changes}`; the person's message arrives by itself as the last user turn
   (it is filed under this ID). Its answer is the chat's answer.
7. **The gate said no → Release Notes Asker** (also `release-notes-agent`): one sentence asking for the list of
   changes. Only one of the two answering nodes runs per message, so the chat gets exactly one saved answer.
8. **cleanUp.js** (after either answering node) deletes `userMessage`, `changes`, `changeCount`, `changesOk` and
   `outline` — the dictionary keys this chain created.

Why the helpers have their own IDs: their turns must not enter the person's conversation, and with Interact with DB
off they load and save nothing. A prompt cannot read a list or an object (it becomes empty text), so every key
passed between steps here is a string.

## What the person sees

| Node | Streams to the chat? | Saved? | After a reload |
|---|---|---|---|
| change-extractor (step 1) | **yes** — the `- ` lines, or `NONE` | no | not shown |
| notes-planner (step 2) | **yes** — the headed outline | no | not shown |
| Release Notes Writer (step 3) | yes — the release notes | yes, the chat's row | shown |
| Release Notes Asker | yes — the question | yes, the chat's row | shown |

Every LLM node's text streams while it is written — by design: the client gets each node's answer and its token use; the site shows everything behind the main agent in one accordion and waits for ONE final answer, the answering node's
([building-blocks.md](references/building-blocks.md) (f)). The extracted lines and the outline are steps in the
accordion; the release notes are the final answer. Keep the steps readable and cheap:

- make each helper's output **short and plain** (lines, headings — not chatty prose), and state its format exactly;
- cap each helper's `maxTokens` to what its step needs (600 here);
- every step's tokens count in the round's cost.

After a reload only the person's message and the final release notes are shown.

## Limits, cost and risks

- **Model calls:** 3 per message on the happy path (2 small `claude-haiku-4-5-20251001` + 1 `claude-sonnet-4-6`),
  2 when the gate says no. Each helper sends only its prompts (Interact with DB off), so its cost does not grow with
  the chat. Put the strong model on the step that needs it — usually the last.
- **No loop**, no bound needed. Long inputs: every step resends its input, so cost ≈ the input size × the steps.
  The gate's `slice(0, 30)` caps what step 2 receives.
- **A step fails** (provider error): it writes nothing. Step 1's Fallback goes into the gate (`changes` is `''`
  → the asker). Step 2's Fallback goes straight to step 3, whose prompt says to use the change lines when the
  outline is empty.
- **A step answers in the wrong format:** the gate drops every line that is not `- …`; if none is left the chain
  stops at the asker instead of writing notes from nothing.
- **A cut answer** (Max Tokens) is still written to its key as it is; the gate keeps its complete lines.
- **Dictionary:** a few short strings, far below the 1.5 MB cap. Each step overwrites its own key; cleanUp.js deletes them at the end.

## The complete example

A release-notes writer for Larkspur Notes (a fictional note-taking app). The person pastes the team's list of
changes; the agent answers with customer-facing release notes. Console agent: ID `release-notes-agent`, Start Flow
`Project`, Start Node `Start`.

Files — [examples/prompt-chaining/project](examples/prompt-chaining/project):

| File | What it holds |
|---|---|
| [src/flows/Project.flow](examples/prompt-chaining/project/src/flows/Project.flow) | the whole chain: 3 Scripts, 1 Condition, 4 LLM nodes, 1 End |
| [src/scripts/chain/readMessage.js](examples/prompt-chaining/project/src/scripts/chain/readMessage.js) | the message into the dictionary, keys cleared |
| [src/scripts/chain/cleanUp.js](examples/prompt-chaining/project/src/scripts/chain/cleanUp.js) | deletes the chain's keys |
| [src/scripts/chain/checkChanges.js](examples/prompt-chaining/project/src/scripts/chain/checkChanges.js) | the gate |
| [src/keen-tools.json](examples/prompt-chaining/project/src/keen-tools.json) | `{ "tools": [] }` |

`keen-validate` on the project: 0 errors, 0 warnings.

**Step 1** (the settings of the change-extractor node):

```json
"settings": {
  "agentId": "change-extractor",
  "agentName": "Change Extractor",
  "sessionId": "",
  "requestId": "",
  "llm": {
    "company": "anthropic",
    "model": "claude-haiku-4-5-20251001",
    "modelId": 4939,
    "parameters": { "temperature": 0, "maxTokens": 600 }
  },
  "prompts": [
    {
      "id": "a6f10fc4-539c-4cf3-a2f7-ecc80777527c",
      "role": "system",
      "content": "You read a team's list of changes to Larkspur Notes, a note-taking app. List every change a user would notice, one per line, each line starting with \"- \". Leave out internal work (refactoring, tests, build tooling). If there is no change a user would notice, answer exactly NONE."
    },
    {
      "id": "fa3630f6-5f9e-474c-9f97-4fb3c1df8746",
      "role": "user",
      "content": "${dictionary.userMessage}"
    }
  ],
  "specialRules": [
    { "type": "skip-internal-database-interactions" },
    { "type": "skip-internal-tooling" }
  ],
  "agentResponse": true,
  "agentResponseProperty": "changes"
}
```

**The gate** and its Condition:

```js
export const exec = () => {
    const lines = String(dictionary.changes ?? '')
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.startsWith('- ') && line.length > 2)
        .slice(0, 30);
    dictionary.changes = lines.join('\n');
    dictionary.changeCount = lines.length;
    dictionary.changesOk = lines.length > 0;
    return { ok: true };
};
```

```json
"settings": { "value": "${dictionary.changesOk} == true" }
```

**Step 2** — its user turn is step 1's answer:

```json
"settings": {
  "agentId": "notes-planner",
  "agentName": "Notes Planner",
  "sessionId": "",
  "requestId": "",
  "llm": {
    "company": "anthropic",
    "model": "claude-haiku-4-5-20251001",
    "modelId": 4939,
    "parameters": { "temperature": 0, "maxTokens": 600 }
  },
  "prompts": [
    {
      "id": "36f4385b-d9ab-4b80-8865-cd302cca3f78",
      "role": "system",
      "content": "Group these changes under at most three headings: New, Improved, Fixed. Leave out a heading that has no change. Answer with the headings and their \"- \" lines only, nothing else."
    },
    { "id": "30335fc8-d3dc-4be3-b52f-b11ba352cde5", "role": "user", "content": "${dictionary.changes}" }
  ],
  "specialRules": [
    { "type": "skip-internal-database-interactions" },
    { "type": "skip-internal-tooling" }
  ],
  "agentResponse": true,
  "agentResponseProperty": "outline"
}
```

**Step 3**, the answering node — the outline in its system turn:

```json
"settings": {
  "agentId": "release-notes-agent",
  "agentName": "Release Notes Writer",
  "sessionId": "",
  "requestId": "",
  "llm": {
    "company": "anthropic",
    "model": "claude-sonnet-4-6",
    "modelId": 4938,
    "parameters": { "temperature": 0.5, "maxTokens": 2048 }
  },
  "prompts": [
    {
      "id": "b6d7525e-f8a9-4e6f-8e07-06c4ca1bf34c",
      "role": "system",
      "content": "You write release notes for Larkspur Notes, a note-taking app. Turn the outline below into friendly release notes in the language of the person's message. Keep every heading. Write one short sentence per change. Add nothing that is not in the outline. If the outline is empty, use the change lines instead.\n\nOutline:\n${dictionary.outline}\n\nThe change lines it was made from:\n${dictionary.changes}"
    }
  ],
  "specialRules": []
}
```

The first Script, readMessage.js, is the same as in [routing](routing.md) with this agent's ID, and it sets
`changes` and `outline` to `''`.

**To adapt it:**

1. Put your console agent's ID in both answering nodes and in readMessage.js.
2. Write the steps: one helper LLM per step, each with one job, an exact output format, its own `agentResponse`
   key, and the previous key in its prompt.
3. After a step whose output can be empty or wrong, add a gate: a Script that cleans it and sets a boolean, and a
   Condition on it. Send the `false` side to an answering node that says what is missing.
4. Clear every key in the first Script, wire every Fallback, run `keen-validate`, `keen-deploy`, and test one good
   input and one with nothing to do; read each step's answer in the runner's flow tree.

## Variations

- **No gate.** Step 1 → step 2 → step 3 directly. Fine when step 1 can never come back empty (it reformats, it does
  not search).
- **A Script step in the middle.** Between two LLMs, a Script looks something up or computes (prices, dates, a
  record by number) and writes a string key the next LLM reads. Silent and free.
- **A gate after every step**, each with its own flag and Condition, when each step's output can fail on its own.
- **A structured hand-over.** A step answers a small JSON; a Script parses it into string keys
  (`dictionary.title`, `dictionary.summary`) for the next prompt — never put the object itself into a prompt.

## Mistakes that break it

| Mistake | What happens | Write instead |
|---|---|---|
| reading `${dictionary.changes}` from a step without `agentResponse` | the key is empty; the next step gets nothing | `"agentResponse": true, "agentResponseProperty": "changes"` |
| a step's helper with its own ID and no input turn | no user message: the call is refused before it is sent (Anthropic, Google), the Fallback runs | an authored `user` turn with the previous key |
| putting a list or object (`${dictionary.items}`) in a prompt | empty text in its place | a Script joins it into a string first |
| the keys not cleared at the start | a failed step leaves a stale value; the chain works on old data | clear them in the first Script, delete them at the end |
| the last step inside a **Run Flow** sub-flow | the answer streams but is not the chat's saved answer | keep the answering node on the main path (or reach it by Jump Flow) |
| a helper with the console agent's ID and Interact with DB on | it saves a row for the message; the chat shows the message twice | its own ID and Interact with DB off |
| helpers asked to "explain your reasoning" | long text in the accordion and in the round's cost | an exact, short output format |
| a Condition on the raw text: `${dictionary.changes} == "NONE"` | `"NONE\n"` or `"None."` passes as changes | a Script sets a boolean; test the boolean |
| a Fallback left unwired | a failed step leaves by Out as if it had answered; its key keeps its old value and the next step runs on it | wire every `error`, clear the keys first |
