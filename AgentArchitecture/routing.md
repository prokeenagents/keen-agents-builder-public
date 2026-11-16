# Routing

## What it is

A light classifier, or a cheaper model, reads the person's message and decides which flow handles it. Each
handler flow is built for one kind of request: its own prompt, its own model, its own steps. The classifier only
picks; it never answers.

Use it when the requests fall into a few clearly different kinds that need different instructions, different
models or different steps (billing questions vs repair help), and one prompt that covers all of them gets long and
confused.

Do not use it when:

- one system prompt handles every kind well — keep one answering node;
- the kinds can be told apart by rules (a keyword, an order number pattern, a button value the site sends) — route
  with a **Script** alone: free, instant and silent (see Variations);
- the "kinds" are really steps of one task — that is [prompt chaining](prompt-chaining.md).

## On Keen

- [LLM](../Flow/Nodes/LLM/llm-skill.md) as the **classifier**: its own `agentId`, a small model, Interact with DB
  off, Use tools off, `agentResponse` → `dictionary.routeRaw`.
- [Script](../Flow/Nodes/Script/script-skill.md) **readMessage.js**: puts the person's message into
  `dictionary.userMessage` with `getRootAgentPrompt` (the classifier has its own ID, so it cannot see the message).
- [Script](../Flow/Nodes/Script/script-skill.md) **normaliseRoute.js**: turns the model's text into one known word,
  with a default.
- [Condition](../Flow/Nodes/Condition/condition-skill.md) chain: one test per route; the last `false` is the default.
- [Jump Flow](../Flow/Nodes/JumpFlow/jump-flow-skill.md): hands the run to the handler flow for good. The handler
  stays on the main path, so its answer is the chat's saved answer.
- [LLM](../Flow/Nodes/LLM/llm-skill.md) as the **answering node** in each handler flow: the console agent's ID,
  Interact with DB on.
- [Script](../Flow/Nodes/Script/script-skill.md) **cleanUp.js** at the end of each handler: deletes the keys the
  routing created.
- No tools. The rules behind each choice: [building-blocks.md](references/building-blocks.md) (b), (f), (g); the
  three means of passing information: [communication.md](references/communication.md).

## The shape

```
Project.flow  (entry Project-Start = the agent's Start flow)

Start
  └─▶ Script readMessage
        └─▶ LLM route-classifier            (Out and Fallback both ─▶ normaliseRoute)
              └─▶ Script normaliseRoute
                    └─▶ Condition ${dictionary.route} == "billing"
                          ├─ true ──▶ Jump Flow Billing-Start
                          └─ false ─▶ Condition ${dictionary.route} == "technical"
                                        ├─ true ──▶ Jump Flow Technical-Start
                                        └─ false ─▶ Jump Flow General-Start   ◀── both Scripts' error

Billing.flow · Technical.flow · General.flow  (entries Billing-Start, Technical-Start, General-Start)

Start ─▶ LLM help-desk-agent (the desk's own system prompt) ─▶ Script cleanUp ─▶ End
                                                               (cleanUp's error ─▶ the same End)
                     (Fallback ─▶ the same LLM on gemini-2.5-flash (same Out and Summary; its Fallback ─▶ cleanUp))
                     (Summary ─▶ Summarizer (claude-haiku-4-5) ─Fallback─▶ Summarizer (gpt-4o-mini); both Outs ─▶ cleanUp)
```

## How the data moves

Of the three means in [communication.md](references/communication.md),
routing uses two: the **channels** (`system/agent`) — where the
person's message is filed for the console agent's ID and read back by a Script — and the **private dictionary** of
the root flow, which the Jump Flow targets share. The session is not needed.

1. **Start → readMessage.js.** The person's message is filed only under the console agent's ID
   (`help-desk-agent`). The Script reads it with `Agent.getRootAgentPrompt('help-desk-agent')` and writes
   `dictionary.userMessage` (channel → dictionary). It also clears `dictionary.routeRaw` and `dictionary.route`,
   because a failed model call leaves the old value in its key.
2. **route-classifier** (agentId `route-classifier`, its own ID so nothing of it mixes into the person's
   conversation). Its system turn names the three words; its authored `user` turn is `${dictionary.userMessage}`.
   `agentResponse: true` + `agentResponseProperty: "routeRaw"` copy its text answer to `dictionary.routeRaw`
   (dictionary).
3. **normaliseRoute.js** reads `dictionary.routeRaw`, trims it, lowercases it, drops anything that is not a letter,
   and writes `dictionary.route` = `billing`, `technical` or — for anything else, empty included — `general`.
4. **The Conditions** read `${dictionary.route}`: `== "billing"` → Jump `Billing-Start`; else `== "technical"` →
   Jump `Technical-Start`; else Jump `General-Start`.
5. **Jump Flow** continues in the handler flow on the same dictionary and session; nothing comes back.
6. **The handler's LLM** (agentId `help-desk-agent`, the console agent's ID) gets the person's message by itself —
   it is filed under that ID — plus the desk's own system prompt and the chat history of `help-desk-agent`. Its
   answer is the chat's answer. `dictionary.userMessage` is not needed here.
7. **cleanUp.js** deletes `userMessage`, `routeRaw` and `route` from the dictionary. The root End wipes the run's
   stores anyway; deleting what you created keeps the rule simple when the handler grows (tools, loops).

All three handlers use the **same** `agentId`, so the history is one conversation whichever desk answered before.

## What the person sees

| Node | Streams to the chat? | Saved? | After a reload |
|---|---|---|---|
| route-classifier | **yes** — one word, e.g. `billing` | no (Interact with DB off) | not shown |
| the handler's help-desk-agent | yes — the answer | yes, the chat's row for this message | shown |

Every LLM node's text streams to the person while it is written — by design: the client gets each node's answer and its token use; the site shows everything behind the main agent in one accordion and waits for ONE final answer, the answering node's
([building-blocks.md](references/building-blocks.md) (f)). The classifier's word `billing` is a step in the accordion; the desk's answer is
the final answer. Keep the step short:

- ask for **exactly one lowercase word** and set `maxTokens` to `16` — no sentence, no reasoning;
- never let the classifier explain its choice;
- it is part of the record and of the round's cost — one word costs least.

After a reload the chat shows only the person's message and the desk's answer.

## Limits, cost and risks

- **Model calls:** 2 per message — one small (`claude-haiku-4-5-20251001`, temperature 0, 16 tokens) and one
  answering model (`claude-sonnet-4-6`). The classifier sends only its two prompts: with Interact with DB off it loads
  no history, so its cost stays flat as the chat grows.
- **Per-node model:** each handler can use a different model or provider; change its `llm` block only.
- **The classifier answers something unexpected** (`Billing.`, `refund`, a sentence): normaliseRoute.js maps every
  unknown word to `general`. The default desk must be able to handle any request.
- **The classifier fails** (provider error): its Fallback goes into normaliseRoute.js; `routeRaw` is still the `''`
  readMessage.js wrote, so the route is `general`.
- **A Script fails:** both Scripts' `error` outputs jump to `General-Start`; the answering node there still gets the
  person's message by its own ID.
- **No loop**, so no bound is needed. The dictionary holds three short strings — far below the 1.5 MB cap.
- **A wrong Jump target** (`billing-start`, a renamed Start) is a keen-validate error; at run time it would stop the
  whole run (E2201).

## The complete example

The Northwind Cycles help desk (a fictional bicycle shop). Console agent: ID `help-desk-agent`, Start Flow
`Project`, Start Node `Start`. The classifier picks billing, technical or general; each desk has its own prompt.

Files — [examples/routing/project](examples/routing/project):

| File | What it holds |
|---|---|
| [src/flows/Project.flow](examples/routing/project/src/flows/Project.flow) | Start → readMessage → classifier → normaliseRoute → 2 Conditions → 3 Jump Flows |
| [src/flows/Billing.flow](examples/routing/project/src/flows/Billing.flow), [Technical.flow](examples/routing/project/src/flows/Technical.flow), [General.flow](examples/routing/project/src/flows/General.flow) | Start → help-desk-agent → cleanUp → End, one prompt each |
| [src/scripts/routing/readMessage.js](examples/routing/project/src/scripts/routing/readMessage.js) | the message into the dictionary, keys cleared |
| [src/scripts/routing/cleanUp.js](examples/routing/project/src/scripts/routing/cleanUp.js) | deletes the routing keys |
| [src/scripts/routing/normaliseRoute.js](examples/routing/project/src/scripts/routing/normaliseRoute.js) | any text → one of three words |
| [src/keen-tools.json](examples/routing/project/src/keen-tools.json) | `{ "tools": [] }` |

`keen-validate` on the project: 0 errors, 0 warnings.

**The classifier node** (from `Project.flow`):

```json
{
  "id": "agentNode_HS33pQhvU168",
  "type": "agentNode",
  "position": { "x": 304, "y": 944 },
  "data": {
    "label": "Route Classifier",
    "description": "Answers one word: billing, technical or general",
    "labelNode": "LLM",
    "descriptionNode": "Use LLM processor",
    "open": false,
    "openLLM": false,
    "openPrompt": false,
    "settings": {
      "agentId": "route-classifier",
      "agentName": "Route Classifier",
      "sessionId": "",
      "requestId": "",
      "llm": {
        "company": "anthropic",
        "model": "claude-haiku-4-5-20251001",
        "modelId": 4939,
        "parameters": { "temperature": 0, "maxTokens": 16 }
      },
      "prompts": [
        {
          "id": "067cfdf8-6ffb-4a5f-ae52-4fd57e60f8f3",
          "role": "system",
          "content": "You sort messages for the Northwind Cycles help desk. Answer with exactly one lowercase word and nothing else: billing (payments, invoices, refunds, prices), technical (the bike, the Northwind Ride app, repairs, faults) or general (anything else)."
        },
        {
          "id": "17745600-f51a-4163-8df4-a9e18508de5f",
          "role": "user",
          "content": "${dictionary.userMessage}"
        }
      ],
      "specialRules": [
        { "type": "skip-internal-database-interactions" },
        { "type": "skip-internal-tooling" }
      ],
      "agentResponse": true,
      "agentResponseProperty": "routeRaw"
    }
  },
  "dragHandle": ".drag-handle__custom"
}
```

**The two Scripts:**

```js
import Agent from 'system/agent';

export const exec = () => {
    dictionary.userMessage = Agent.getRootAgentPrompt('help-desk-agent')?.prompt ?? '';
    dictionary.routeRaw = '';
    dictionary.route = '';
    return { ok: true };
};
```

```js
export const exec = () => {
    const word = String(dictionary.routeRaw ?? '').trim().toLowerCase().replace(/[^a-z]/g, '');
    dictionary.route = ['billing', 'technical'].includes(word) ? word : 'general';
    return { ok: true };
};
```

**The first Condition** (the second is the same with `"technical"`; its `false` is the default):

```json
"settings": { "value": "${dictionary.route} == \"billing\"" }
```

**A Jump Flow** and **a handler's answering node** (the settings of `Billing.flow`'s LLM):

```json
"settings": { "value": "Billing-Start" }
```

```json
"settings": {
  "agentId": "help-desk-agent",
  "agentName": "Billing Desk",
  "sessionId": "",
  "requestId": "",
  "llm": {
    "company": "anthropic",
    "model": "claude-sonnet-4-6",
    "modelId": 4938,
    "parameters": { "temperature": 0.4, "maxTokens": 2048 }
  },
  "prompts": [
    {
      "id": "062f73d5-dc74-4c22-a52c-1ff9ac9017dc",
      "role": "system",
      "content": "You are the billing desk of Northwind Cycles, a bicycle shop. Answer questions about payments, invoices, refunds and prices. Be brief and friendly. Never invent the status of an order: ask for the order number instead."
    }
  ],
  "specialRules": []
}
```

**To adapt it:**

1. Rename `help-desk-agent` to your console agent's ID — in the three handler nodes and in readMessage.js.
2. List your routes in the classifier's system prompt (one word each, with what belongs to it), in
   normaliseRoute.js's list, and as one Condition + one Jump Flow per route. Keep the last `false` as the default.
3. Write one handler flow per route (`<Name>.flow`, Start label `Start`), each with its own prompt — and tools,
   Scripts or a different model where that route needs them.
4. Run `keen-validate`, `keen-deploy`, then send one test message per route and one that fits none; read the
   classifier's word in the runner's output.

## Variations

- **A Script classifier, no model.** Replace the classifier and normaliseRoute.js with one Script that tests
  keywords or a regular expression on `dictionary.userMessage` and writes `dictionary.route`. Free, instant, nothing
  streams. Good when the site sends a topic, or the words are predictable.
- **The classifier with the console agent's ID.** Give it `help-desk-agent` and keep Interact with DB **off**: it
  sees the person's message by itself, so readMessage.js is not needed. With Interact with DB **on** it would save a
  second row for the message ([building-blocks.md](references/building-blocks.md) (g) 5) — never do that.
- **Prepare, then answer in one place.** When the routes differ only in the data they fetch, use **Run Flow** into a
  handler that fills the dictionary (no LLM that answers), then one answering node after the Run Flows on the main
  path. An answer written inside a Run Flow sub-flow streams but is not saved as the chat's answer.
- **A confidence gate.** Ask for a small JSON `{"route": "billing", "sure": true}`; the Script parses it and sends
  an unsure answer to `general` (or to a desk that asks a clarifying question).

## Mistakes that break it

| Mistake | What happens | Write instead |
|---|---|---|
| a Condition on the raw answer: `${dictionary.routeRaw} == "billing"` | `"Billing\n"` or `"billing."` is not equal; every message takes the default | normalise in a Script, test `${dictionary.route}` |
| **Run Flow** into a handler whose LLM answers | the answer streams, but after a reload the message has no saved answer | **Jump Flow** into the handler |
| the classifier has its own ID and no `${dictionary.userMessage}` turn | no user message: the call to the Anthropic model is refused before it is sent, the node takes its Fallback, every message goes to the default | readMessage.js + the authored `user` turn |
| the classifier keeps Interact with DB on | it loads and saves its own history: more cost on every message, no benefit | `skip-internal-database-interactions` |
| "Explain your choice, then give the category" | the explanation goes into the accordion and the round's cost | exactly one word, `maxTokens` 16 |
| no default branch (the last Condition's `false` unwired) | an unknown word ends the path silently: no answer | the last `false` → the default desk |
| a Jump Flow target `${dictionary.route}` or `billing-start` | keen-validate error; the canvas strips a placeholder | one literal Jump Flow per route: `Billing-Start` |
| the handlers use different `agentId`s | each desk sees only its own past turns; the person's message is not filed under them | the console agent's ID in every handler |
| `routeRaw` not cleared before the classifier | after a failed call a stale value (from an earlier visit in the run) is read as the route | clear it in the first Script |
