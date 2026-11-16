# Evaluator-optimizer

## What it is

One model generates a result, another model checks it and scores it. When the score is too low, the generator gets
the checker's feedback and tries again — until the result passes or a fixed number of rounds is used up. Then the
best result goes to the person.

Use it when there are clear criteria a reviewer can check (a word limit, "only the given facts", a style rule, a
format), and a second pass with concrete feedback really makes the result better.

Do not use it when:

- the criteria can be checked by code (length, banned words, valid JSON, a required field) — a **Script** evaluator
  is free, exact and silent (see Variations);
- the first answer is usually good enough — one well-written prompt is cheaper;
- there are no clear criteria — the judge then scores at random and the loop only adds cost;
- the person must see one clean answer with nothing before it — every draft and every verdict streams today.

## On Keen

- [Script](../Flow/Nodes/Script/script-skill.md) **prepareRound.js**: the person's message into
  `dictionary.userMessage` (`getRootAgentPrompt`), the round counter set to `0`, every loop key reset.
- [Join Flow](../Flow/Nodes/JoinFlow/join-flow-skill.md): where the back edge comes in (the first entry and every
  retry).
- [LLM](../Flow/Nodes/LLM/llm-skill.md) **the generator** (`blurb-writer`): its own ID, Interact with DB off, the
  feedback in its prompt, `agentResponse` → `draft`.
- [LLM](../Flow/Nodes/LLM/llm-skill.md) **the evaluator** (`blurb-judge`): its own ID, a small model, temperature 0,
  answers a small JSON, `agentResponse` → `verdictRaw`.
- [Script](../Flow/Nodes/Script/script-skill.md) **scoreDraft.js**: parses the verdict, counts the round, keeps the
  best draft, clears the raw key.
- [Condition](../Flow/Nodes/Condition/condition-skill.md) `passed or attempts ≥ 3`: the bound. `false` is the back
  edge to the Join Flow.
- [LLM](../Flow/Nodes/LLM/llm-skill.md) **the answering node** (`blurb-agent`, the console agent's ID): gives the
  person the best draft.
- [Script](../Flow/Nodes/Script/script-skill.md) **cleanUp.js** after the answer: deletes the loop's keys.
- No tools. The rules: [building-blocks.md](references/building-blocks.md) (a), (e), (f), (g); the three means of
  passing information: [communication.md](references/communication.md).

## The shape

```
Project.flow  (entry Project-Start = the agent's Start flow)

Start
  └─▶ Script prepareRound                                   error ─▶ Blurb Presenter
        └─▶ Join Flow ◀──────────────────────────────────────────────────────┐
              └─▶ LLM blurb-writer   (generator)            Fallback ─▶ Blurb Presenter
                    └─▶ LLM blurb-judge   (evaluator)       Out and Fallback ─▶ scoreDraft
                          └─▶ Script scoreDraft             error ─▶ Blurb Presenter
                                └─▶ Condition passed == true || attempts >= 3
                                      ├─ false ─────────────────────────────────┘   (the next round)
                                      └─ true ──▶ LLM blurb-agent "Blurb Presenter" ─▶ cleanUp ─▶ End
                                                    Fallback ─▶ the same LLM on gemini-2.5-flash (same Out and Summary; its Fallback ─▶ cleanUp)
                                                    Summary ─▶ Summarizer (claude-haiku-4-5) ─Fallback─▶ Summarizer (gpt-4o-mini); both Outs ─▶ cleanUp
```

The back edge enters a Join Flow because a Condition's `in` takes one edge only; the Join's `in` takes several.

## How the data moves

Of the three means in [communication.md](references/communication.md),
the loop keeps everything in the root flow's **private dictionary**:
the drafts, the verdicts, the feedback and the round counter (one flow, so the dictionary is enough; a counter that
other flows must see would go in the **session**). The **channels** (`system/agent`) are used only to read the
person's message.

1. **prepareRound.js** reads `Agent.getRootAgentPrompt('blurb-agent')` into `dictionary.userMessage` and resets
   `attempts = 0`, `passed = false`, `draft = ''`, `verdictRaw = ''`, `feedback = 'none yet (first draft)'`,
   `bestDraft = ''`, `bestScore = 0`. Without this reset a counter from an earlier pass through the loop in the same
   run would carry over.
2. **blurb-writer** (generator, agentId `blurb-writer`). Its user turn holds `${dictionary.userMessage}`,
   `${dictionary.draft}` (its previous draft, empty in round 1) and `${dictionary.feedback}`. A prompt is resolved
   again on every visit, so each round sees the newest draft and feedback. `agentResponse` → `dictionary.draft`.
3. **blurb-judge** (evaluator, agentId `blurb-judge`). Its user turn holds the facts and `${dictionary.draft}`. It
   answers `{"score": n, "feedback": "…"}`. `agentResponse` → `dictionary.verdictRaw`.
4. **scoreDraft.js** takes the text between the first `{` and the last `}` (so a fenced or chatty answer still
   parses), clears `verdictRaw`, adds 1 to `attempts`, and writes `passed` (score ≥ 8) and `feedback` (the judge's
   sentence, or a default fix when the verdict was unusable). When this draft scored higher than every earlier one —
   or no draft is kept yet — it becomes `bestDraft`.
5. **The Condition** `${dictionary.passed} == true || ${dictionary.attempts} >= 3`: `false` → the Join → the writer
   again with the new feedback; `true` → the answering node.
6. **Blurb Presenter** (agentId `blurb-agent`, the console agent, Interact with DB on). Its system turn holds
   `${dictionary.bestDraft}`; the person's message arrives by itself. Its answer is the chat's answer.
7. **cleanUp.js** deletes the eight keys prepareRound.js created.

Both loop LLMs have their own IDs and Interact with DB off: each call sends only its prompts, and none of their turns
enters the person's conversation.

## What the person sees

| Node | Streams to the chat? | Saved? | After a reload |
|---|---|---|---|
| blurb-writer, each round | **yes** — every draft (1 to 3) | no | not shown |
| blurb-judge, each round | **yes** — every JSON verdict (1 to 3) | no | not shown |
| Blurb Presenter | yes — one line and the chosen blurb | yes, the chat's row | shown |

Every LLM node's text streams while it is written — by design: the client gets each node's answer and its token use; the site shows everything behind the main agent in one accordion and waits for ONE final answer, the answering node's
([building-blocks.md](references/building-blocks.md) (f)). The accordion holds, in order: draft 1, verdict 1,
draft 2, verdict 2, …; then comes the final answer. This pattern writes the most and costs the most. Keep it
bounded:

- a short output: a 60-word blurb, a one-sentence feedback, `maxTokens` 400 / 200;
- few rounds: 3 at most here — 2 is often enough;
- every draft and verdict counts in the round's cost.

After a reload only the person's message and the final answer are shown.

## Limits, cost and risks

- **Model calls:** 2 per round + 1 = **3 to 7** per message. The writer uses `claude-sonnet-4-6`; the judge and the
  presenter (which only copies the blurb) use `claude-haiku-4-5-20251001`. A judge on another provider gives a more
  independent opinion (`gemini-3.1-flash-lite-preview`, `gpt-5.4-nano`) — change its `llm` block only.
- **The bound is yours.** Nothing stops a loop on the platform: no step count and no time limit. The counter lives in
  a Script (an Assignment cannot add 1), starts at `0` in the first Script, and the Condition tests it on every round.
- **The judge answers something unusable** (prose, broken JSON): the score is 0, the round still counts, the writer
  gets the default feedback. The loop ends at the bound at the latest.
- **The judge fails** (provider error): its Fallback goes into scoreDraft.js; `verdictRaw` is the `''` the previous
  round left, so the round counts as a fail. A failed call writes nothing — that is why the Script clears the key
  after reading it.
- **The writer fails:** its Fallback goes straight to the presenter, which gives the best earlier draft — or, in
  round 1, says it could not write one.
- **The last round is not always the best:** the Script keeps `bestDraft`, so the person gets the highest-scored one.
- **Dictionary:** a few short strings; the loop overwrites them instead of collecting them. Far below 1.5 MB.

## The complete example

A product-blurb writer for Fernhill Outdoor (a fictional outdoor gear shop). The person sends product facts; the
agent answers with a blurb of at most 60 words that a judge scored 8 or more — or the best of 3 rounds. Console
agent: ID `blurb-agent`, Start Flow `Project`, Start Node `Start`.

Files — [examples/evaluator-optimizer/project](examples/evaluator-optimizer/project):

| File | What it holds |
|---|---|
| [src/flows/Project.flow](examples/evaluator-optimizer/project/src/flows/Project.flow) | the loop: 3 Scripts, Join Flow, 3 LLM nodes, Condition, End |
| [src/scripts/review/prepareRound.js](examples/evaluator-optimizer/project/src/scripts/review/prepareRound.js) | the message, the counter, the reset |
| [src/scripts/review/cleanUp.js](examples/evaluator-optimizer/project/src/scripts/review/cleanUp.js) | deletes the loop's keys |
| [src/scripts/review/scoreDraft.js](examples/evaluator-optimizer/project/src/scripts/review/scoreDraft.js) | parse, count, keep the best, clear |
| [src/keen-tools.json](examples/evaluator-optimizer/project/src/keen-tools.json) | `{ "tools": [] }` |

`keen-validate` on the project: 0 errors, 0 warnings — the back edge included.

**The evaluator** (the settings of the blurb-judge node in `Project.flow`):

```json
"settings": {
  "agentId": "blurb-judge",
  "agentName": "Blurb Judge",
  "sessionId": "",
  "requestId": "",
  "llm": {
    "company": "anthropic",
    "model": "claude-haiku-4-5-20251001",
    "modelId": 4939,
    "parameters": { "temperature": 0, "maxTokens": 200 }
  },
  "prompts": [
    {
      "id": "73907ff1-e1ad-41ba-a6a0-972d2827483b",
      "role": "system",
      "content": "You review a product blurb for Fernhill Outdoor. Check: at most 60 words; every claim comes from the product facts; no superlatives; it reads well. Answer with JSON only, no other text: {\"score\": <1-10>, \"feedback\": \"<one sentence: the most important fix>\"}"
    },
    {
      "id": "0f127ec0-6908-428f-8260-45c39bbb3182",
      "role": "user",
      "content": "Product facts:\n${dictionary.userMessage}\n\nBlurb:\n${dictionary.draft}"
    }
  ],
  "specialRules": [
    { "type": "skip-internal-database-interactions" },
    { "type": "skip-internal-tooling" }
  ],
  "agentResponse": true,
  "agentResponseProperty": "verdictRaw"
}
```

**The generator's settings** — the feedback and its previous draft in its user turn:

```json
"settings": {
  "agentId": "blurb-writer",
  "agentName": "Blurb Writer",
  "sessionId": "",
  "requestId": "",
  "llm": {
    "company": "anthropic",
    "model": "claude-sonnet-4-6",
    "modelId": 4938,
    "parameters": { "temperature": 0.7, "maxTokens": 400 }
  },
  "prompts": [
    {
      "id": "abc15b4c-5908-49d1-909c-049b1d82cffc",
      "role": "system",
      "content": "You write product blurbs for Fernhill Outdoor, an outdoor gear shop. Write one blurb of at most 60 words from the product facts. Use only those facts. No superlatives such as best or ultimate. When there is reviewer feedback, rewrite your previous draft to fix it. Answer with the blurb only."
    },
    {
      "id": "12dbed84-5c77-4392-a0f3-9e52e52073a6",
      "role": "user",
      "content": "Product facts:\n${dictionary.userMessage}\n\nYour previous draft:\n${dictionary.draft}\n\nReviewer feedback to fix:\n${dictionary.feedback}"
    }
  ],
  "specialRules": [
    { "type": "skip-internal-database-interactions" },
    { "type": "skip-internal-tooling" }
  ],
  "agentResponse": true,
  "agentResponseProperty": "draft"
}
```

**The two Scripts:**

```js
import Agent from 'system/agent';

export const exec = () => {
    dictionary.userMessage = Agent.getRootAgentPrompt('blurb-agent')?.prompt ?? '';
    dictionary.attempts = 0;
    dictionary.passed = false;
    dictionary.draft = '';
    dictionary.verdictRaw = '';
    dictionary.feedback = 'none yet (first draft)';
    dictionary.bestDraft = '';
    dictionary.bestScore = 0;
    return { ok: true };
};
```

```js
export const exec = () => {
    const raw = String(dictionary.verdictRaw ?? '');
    dictionary.verdictRaw = '';
    let verdict = {};
    try { verdict = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)); } catch { verdict = {}; }
    const score = Number.isFinite(Number(verdict.score)) ? Number(verdict.score) : 0;
    dictionary.attempts = Number(dictionary.attempts ?? 0) + 1;
    if (score > Number(dictionary.bestScore ?? 0) || !dictionary.bestDraft) {
        dictionary.bestScore = Math.max(score, Number(dictionary.bestScore ?? 0));
        dictionary.bestDraft = String(dictionary.draft ?? '');
    }
    dictionary.passed = score >= 8;
    dictionary.feedback = typeof verdict.feedback === 'string' && verdict.feedback.trim()
        ? verdict.feedback.trim()
        : 'Keep it under 60 words and use only the product facts.';
    return { ok: true };
};
```

**The bound:**

```json
"settings": { "value": "${dictionary.passed} == true || ${dictionary.attempts} >= 3" }
```

**To adapt it:**

1. Put your console agent's ID in the presenter and in prepareRound.js.
2. Write the criteria **once**, the same in the writer's and the judge's system prompts. The judge scores against
   them and names the most important fix in one sentence.
3. Choose the pass mark (`score >= 8` in scoreDraft.js) and the round limit (`>= 3` in the Condition).
4. Wire every Fallback, run `keen-validate`, `keen-deploy`, then test an easy input (passes in round 1) and a hard
   one (uses every round); read each round's draft and verdict in the runner's flow tree.

## Variations

- **A Script evaluator.** Replace the judge with a Script that checks rules (word count, banned words, required
  facts present) and writes `passed` and a `feedback` sentence. No model call, nothing streams, exact.
- **Both.** The Script checks the hard rules first; only a draft that passes them goes to the LLM judge for the
  soft ones (tone, clarity). Fewer model calls per round.
- **A pass / fail word instead of a score.** The judge answers `PASS` or `FAIL: <fix>`; the Script sets `passed`
  from the first word. Simpler, but there is no "best" draft to keep.
- **A Loop as the bound.** A [Loop](../Flow/Nodes/Loop/loop-skill.md) over a list of N items gives at most N
  rounds. When a draft passes early, set a flag and route the remaining passes straight back to the Loop's
  `next_2` ([building-blocks.md](references/building-blocks.md) (e)).

## Mistakes that break it

| Mistake | What happens | Write instead |
|---|---|---|
| no counter, only `${dictionary.passed} == true` | a draft that never passes loops until the person cancels; every round is billed | `passed == true \|\| attempts >= N` |
| the counter set by an Assignment | an Assignment writes values, it cannot add 1; the bound never moves | a Script: `Number(dictionary.attempts ?? 0) + 1` |
| `attempts` not reset in the first Script | a second pass through the loop in the same run starts at the old count and ends at once | `dictionary.attempts = 0` before the loop |
| the back edge into the Condition | keen-validate: a Condition's `in` is single-in | the back edge into a Join Flow in front of the writer |
| `verdictRaw` not cleared after reading | a failed judge call leaves the previous verdict; the round is scored twice | clear it in the Script that reads it |
| `JSON.parse` on the raw answer without a `try` | a fenced or chatty verdict throws; the Script takes its error output | slice from `{` to `}` inside `try` / `catch` |
| the writer with the console agent's ID and Interact with DB on | every draft is saved as a row; the saved chat shows the message several times | its own ID, Interact with DB off |
| a Condition on the verdict text: `${dictionary.verdictRaw} == "PASS"` | an object or extra text never matches; a list or object stops the run (E2201) | a Script writes a boolean; test it |
| different criteria in the writer and the judge | the writer cannot satisfy the judge; every message uses all rounds | the same criteria in both prompts |
