# LLM (`agentNode`)

Sends one conversation to a language model and continues with its answer. It can also call a tool and read the result.

## Description

Use it when the agent must answer the user, reason over text, classify or extract with judgement, or call
tools (a flow or a script) before answering. Every chat agent has at least one: the LLM node whose `agentId` is
the agent's ID in the console. That node gets the user's message and writes the answer the chat shows.

Use something else when:
- the work is arithmetic, I/O, an HTTP call, or reading Secrets / Settings: use a **Script**. A model is slow and can be wrong at it.
- you only need to put known values into the dictionary: use an **Assignment**.
- you need to branch on the answer: let the LLM answer with a fixed word, get it into the dictionary (`agentResponse`,
  see Settings), then use a **Condition**.
- you need to keep a long chat within the model's context: wire this node's `summary` output to a **Summarizer** — in
  every agent you build, by default (the house standard, `../SKILL.md`). Do not trim history in a Script.

## In / Out

**In:** `in`. It takes **several** edges. Any node with an out handle may connect to it, except:
an LLM's `summary` and a Summarizer's `error` reach only a Summarizer, and a node cannot connect to itself.

**Out** (canvas ids; write them as they are, because deploy passes them through unchanged):

| Handle | Canvas label | May lead to | Unwired at run time |
|---|---|---|---|
| `next_1` | Out | any node's `in` (or a Loop's `next_2`), but not a Summarizer | the path ends after a normal answer. keen-validate warns. |
| `error` | Fallback | the same targets as `next_1` | a failure continues on `next_1` instead (see Fallback) |
| `summary` | Summary | exactly **one** Summarizer's `in` | no chat summary is made; the node always leaves by `next_1` |

The canvas allows one edge per out handle. To do several things after the answer, chain them; to run several flows at
once, use a Parallel Flows.

## Fallback

Yes. The `error` handle is the Fallback. Use it for **model failover**: route it to a second LLM node with the
**same `agentId` and prompts** on a **different provider**, and from there to a third or to a node that gives a fixed
sentence. Wire it on every LLM node of an agent you build, by default (the house standard, `../SKILL.md`). The engine takes
it when:
- the provider call fails: a bad or missing API key (E6101), capacity (E4001), a timeout (E7001), another 4xx (E6002),
  a 5xx or transport error (E7002). The provider's message (e.g. `Anthropic 5xx: …`) becomes the answer and is recorded.
- the node fails before the call: an empty `agentName` / `agentId`, no `llm`, an unknown provider or model (E6101), or
  a conversation the provider parser refuses (E6002, e.g. no user message). The error message is the answer.

It does **not** fire for an answer cut at Max Tokens, a bad or unknown `<SYSTEM CALL>`, a tool that sends no reply
(the agent is called again instead), an empty or refusing answer (normal `next_1`), or a cancel.
If `error` is unwired, the flow continues on `next_1` with the error text as the answer. If neither is wired, a provider
failure ends the path, and a failure before the call fails the run with E6101 (a code the client re-sends, so the same
failure repeats until the project is fixed).

## Error

There is no separate Error output. Failures go to **Fallback** (`error`) above.

## Settings

Three panels on the canvas. Only the prompts' `content`, `agentName`, `sessionId` and `requestId` take `${…}`.

| Panel · field | JSON key (`data.settings.…`) | Rule | What it is for |
|---|---|---|---|
| General · Agent Name | `agentName` | required, 4–60 chars, takes `${…}` | the agent's display name, used in logs |
| General · Agent ID | `agentId` | required, kebab-case letters only, 4–60, **no `${…}`** (the canvas and keen-validate refuse it) | whose conversation this is. The node that answers the user must use the agent's ID **from the console**: the user's message is filed under that ID |
| General · Session ID / Request ID | `sessionId`, `requestId` | optional, ≤ 60, take `${…}`; write `""` | point this turn at another chat-history slot. If empty or it resolves to empty, the run's own ids are used |
| General · Description | `data.description` | ≤ 250 | a note under the card |
| LLM · Company / Model | `llm.company`, `llm.model`, `llm.modelId` | required, literal; pick from the table below | which provider and model are called. `modelId` is the model's id in the table: the engine ignores it, but the canvas uses it to choose which model to show |
| LLM · Temperature / Top p / Max Tokens / Effort | `llm.parameters.*` | literal; only knobs the model declares (below) | sampling, answer length and reasoning |
| LLM · Interact with DB | `specialRules` `{ "type": "skip-internal-database-interactions" }` when **off** | on by default (rule absent) | off = no chat history is loaded or saved for this turn. Use for a stateless helper agent. It also never summarizes |
| LLM · Use tools | `specialRules` `{ "type": "skip-internal-tooling" }` when **off** | on by default | off = a `<SYSTEM CALL>` is plain text and no tool runs |
| Prompt · turns | `prompts[]` `{ id, role, content }` | ≤ 20 turns; turn 1 has `role: "system"`; others `user` / `assistant`; `content` non-empty, takes `${…}` | the system instructions and any few-shot turns |
| (no canvas control) | `data.label` | ≤ 60 | not shown on the LLM card; the Prompt form's save keeps whatever is there |
| (no canvas control) | `agentResponse`, `agentResponseProperty` | `true` + a key name | also write a **text** answer to `dictionary.<key>`. The key is one flat top-level name (a dot is not a path). Not written for a tool call or an error answer; a write the dictionary cap refuses is skipped silently. Canvas saves keep it |

**Providers and models.** The engine can call exactly `anthropic`, `openai` and `google`. Any other company is refused by
keen-validate. A model name not in the engine's registry passes the validator but fails at run time (E6101). Write the
`model` exactly, with its `modelId` (`name id`). `gpt-5.5` (1) and `claude-opus-4-7` (2) run in the engine but are not in
the canvas's model list yet: a person who opens such a node on the canvas does not see its model.

The engine sends every number you write in `temperature`, `top_p` and `maxTokens` as it is — it does not check them
against the model's declared knobs or ranges — so write only the knobs the table lists for the model; the provider may
refuse a call with a knob its model does not take (that is a provider failure: Fallback). The enum knobs (`effort`,
`reasoningEffort`, `thinkingLevel`) are different: the engine sends them only when the value is one of the model's own
options.

| `company` | models | knobs in `llm.parameters` the engine sends |
|---|---|---|
| anthropic | `claude-opus-4-7` 2 · `claude-opus-4-6` 4937 · `claude-opus-4-5` 4927 · `claude-opus-4-5-20251101` 4926 · `claude-sonnet-4-6` 4938 · `claude-sonnet-4-5` 4929 · `claude-sonnet-4-5-20250929` 4928 · `claude-haiku-4-5-20251001` 4939 | `temperature` (0–1) or `top_p` (0–1) — write one of them: the engine sends both when both are written; on opus-4-7 neither is sent; `maxTokens` (8192 if absent; cap 64000, 128000 on opus-4-6/4-7); `effort` sent only on opus-4-5* and opus-4-7: a value from the model's options (`"low"`/`"medium"`/`"high"`, plus `"max"` on opus-4-7) or its index in that list; absent = medium; not sent on other models |
| openai | `gpt-5.5` 1 · `gpt-5.4` 4933 · `gpt-5.4-mini` 4935 · `gpt-5.4-nano` 4936 · `o1` 4923 · `o4-mini` 4925 · `gpt-4.1-2025-04-14` 4919 · `gpt-4o` 4920 · `gpt-4o-mini` 4921 | `temperature`, `top_p` (gpt-5.5 / 5.4-mini / 5.4-nano declare only `temperature` fixed at 1 and no `top_p`; gpt-5.4, o1, o4-mini declare neither); `maxTokens` (absent = not sent; cap 16384 on gpt-4*, 100000 on o*, 128000 on gpt-5*); `reasoningEffort` on gpt-5* (`none`…`xhigh`) and o1 / o4-mini (`low`/`medium`/`high`): a value from the model's options or its index in that list (the canvas saves the index) |
| google | `gemini-3.1-pro-preview` 4932 · `gemini-3.1-flash-lite-preview` 4940 · `gemini-3-flash-preview` 4931 · `gemini-2.5-pro` 4914 · `gemini-2.5-flash` 4913 · `gemini-flash-latest` 4918 · `gemini-2.0-flash-001` 4912 | `temperature` (0–2), `top_p` (0–1), `maxTokens` (≤ 65536; absent = not sent, the provider's default); Gemini 3: `thinkingLevel` from the model's own options (or its index) — gemini-3-flash `MINIMAL`/`LOW`/`HIGH`, gemini-3.1-pro `LOW`/`MEDIUM`/`HIGH`, gemini-3.1-flash-lite all four; a value outside them is not sent (the model's default runs); Gemini 2.5: numeric `thinkingBudget` (sent only when no `thinkingLevel` is sent) |

The parameter key is `top_p` (snake case), not `topP`. A reasoning model spends `maxTokens` on its thinking too.

## Rotate

Yes. It is cosmetic: it moves where the dots are drawn and never changes the wiring. The value is stored as
`data.handlePosition` (`"top"` / `"right"` / `"bottom"` / `"left"`) and is **absent until the person rotates**.
The default is `top`: In at the top, Out at the bottom, Fallback on the left, Summary on the right. Each click
moves In one step through bottom → left → top → right, and the other dots keep their places relative to In.
Do not write it.

## JSON structure

| Property | Required | What it means |
|---|---|---|
| `id` | yes | `agentNode_` + 12 `A–Za–z0–9`, unique in the project |
| `type` | `"agentNode"` | the node kind |
| `position.x`, `position.y` | yes | canvas place, multiples of 16. Not read by the engine |
| `data.label` | no | ≤ 60; not shown on the LLM card and not read by the engine |
| `data.description` | no | note (≤ 250). Not read by the engine |
| `data.labelNode` / `data.descriptionNode` | `"LLM"` / `"Use LLM processor"` | fixed |
| `data.open`, `data.openLLM`, `data.openPrompt` | `false` | which panel is open on the canvas. Not read by the engine |
| `data.handlePosition` | no (absent) | see Rotate. Not read by the engine |
| `data.settings.agentId` / `agentName` | yes | see Settings; `agentName` takes `${…}` |
| `data.settings.sessionId` / `requestId` | `""` | see Settings; take `${…}` |
| `data.settings.llm.company` / `.model` | yes | provider + model name from the table |
| `data.settings.llm.modelId` | yes (for the canvas) | the model's id from the table. Not read by the engine |
| `data.settings.llm.parameters.*` | `maxTokens` advised | `temperature` / `top_p` / `maxTokens` / `effort` / `reasoningEffort` / `thinkingLevel` / `thinkingBudget`: see the table |
| `data.settings.prompts[].id` | yes | a unique string (the canvas writes a UUID) |
| `data.settings.prompts[].role` | yes | `system` (turn 1), `user`, `assistant`; literal |
| `data.settings.prompts[].content` | yes | the turn's text; takes `${…}` |
| `data.settings.specialRules` | yes (`[]`) | the two `skip-…` rules, see Settings |
| `data.settings.agentResponse` / `agentResponseProperty` | no | dictionary copy of the answer, see Settings |
| `dragHandle` | `".drag-handle__custom"` | fixed |

## In the `.flow` file

The minimal correct node:

```json
{
  "id": "agentNode_kM6oI3DsNdH3",
  "type": "agentNode",
  "position": { "x": 304, "y": 736 },
  "data": {
    "label": "", "description": "Answers the customer",
    "labelNode": "LLM", "descriptionNode": "Use LLM processor",
    "open": false, "openLLM": false, "openPrompt": false,
    "settings": {
      "agentId": "support-agent", "agentName": "Support Agent",
      "sessionId": "", "requestId": "",
      "llm": { "company": "anthropic", "model": "claude-sonnet-4-6", "modelId": 4938,
               "parameters": { "temperature": 0.8, "maxTokens": 8192 } },
      "prompts": [
        { "id": "5b0c3c7e-2f4e-4c1a-9b8e-1f0a2d3c4b5a", "role": "system",
          "content": "You are the support agent of ${dictionary.shop.name}. Answer briefly." }
      ],
      "specialRules": []
    }
  },
  "dragHandle": ".drag-handle__custom"
}
```

Its edges, one per output (`summary` only when you want a chat summary):

```json
{ "id": "xy-edge__agentNode_kM6oI3DsNdH3next_1-endNode_Rr3TtUu7Vv9Win", "type": "step",
  "source": "agentNode_kM6oI3DsNdH3", "sourceHandle": "next_1", "target": "endNode_Rr3TtUu7Vv9W", "targetHandle": "in" },
{ "id": "xy-edge__agentNode_kM6oI3DsNdH3error-agentNode_Bk2Gm7Qa4Zx1in", "type": "step",
  "source": "agentNode_kM6oI3DsNdH3", "sourceHandle": "error", "target": "agentNode_Bk2Gm7Qa4Zx1", "targetHandle": "in" },
{ "id": "xy-edge__agentNode_kM6oI3DsNdH3summary-summarizerNode_Qw3Er5Ty7Ui9in", "type": "step",
  "source": "agentNode_kM6oI3DsNdH3", "sourceHandle": "summary", "target": "summarizerNode_Qw3Er5Ty7Ui9", "targetHandle": "in" }
```

## How the engine runs it

1. **Identity.** `agentName`, `agentId`, `sessionId` and `requestId` are resolved against the current dictionary and session.
   If the name or ID is empty, or a placeholder in it does not resolve to a string, the node fails with E6101
   (`agentNode "<id>" missing settings.agentName — …`). A missing `llm` also fails with E6101.
2. **The user's message.** This is the newest user message filed under **this `agentId`**, preferring the one
   for this run's session. At run start the chat message is filed under the console agent's ID. A tool's reply, or a
   Script's `Agent.setRootAgentPrompt(agentId, …)`, files a new one. An LLM node with any other `agentId` has no user
   message unless a Script gives it one.
3. **The conversation sent.** The engine builds it in this order:
   - the `prompts` (each `content` resolved; a placeholder that resolves to a list or an object becomes empty text);
   - the newest chat summary, appended to the system text when a `summary` edge exists;
   - up to 50 earlier turns of this chat for this `agentId`, each turn a user message plus an assistant message. Past
     tool-call turns are left out. With a `summary` edge, these turns are capped at 50 000 tokens. They are skipped
     entirely with Interact with DB off;
   - the user's message, last.

   Neighbouring turns with the same role are merged. Anthropic and Google get the system turns as the system text.
4. **Model check.** The company must be anthropic / openai / google and the model must be in the registry. Otherwise
   the node fails with E6101 (`Unsupported LLM provider "x".` / `Model record not found for provider "x" and model name "y".`).
   OpenAI also refuses an empty turn (E6002 `Prompt "<id>" has invalid or empty content.`).
5. **The call.** The text streams to the chat client as it is generated, from every LLM node in the run. A
   provider failure is turned into an error answer (codes under Fallback).
6. **Classify.** If the text holds a complete `<SYSTEM CALL>` … `</SYSTEM CALL>` block and Use tools is on, the answer is a
   **tool call**. Otherwise it is a **text answer**, or an **error** after a failure.
7. **Record.** The turn is saved to chat history (not with Interact with DB off). The chat's saved answer is the
   final text answer of the node whose `agentId` is the console agent ON THE MAIN PATH (the Start flow or a Jump Flow
   target — an answer inside a Run Flow sub-flow is not saved as the chat's answer). Every LLM node's text still streams
   live to the person while it runs. Other nodes' turns are kept as audit rows.
   The answer is also readable in this run by Scripts (`Agent.getAgentLastResponse('<agentId>')` from `system/agent`).
   With `agentResponse` set, a text answer is also written to `dictionary.<agentResponseProperty>`.
8. **Cut at Max Tokens.** When the provider stops because of `maxTokens`, the answer is still delivered and routed as a
   normal answer. It is not retried and does not take Fallback. It is marked `truncated` in history and in the
   client's reply, and ONE WARN goes to the agent's Log Record:
   `LLM answer cut at maxTokens: node=<id> agent=<agentId> provider=… model=… maxTokens=<n> outputTokens=<n> chars=<n>
   responseType=<text|tool> toolCallCut=<yes|no> req=<id> — the answer was delivered marked truncated; raise Max Tokens on this node.`
   A cut inside a `<SYSTEM CALL>` is plain text (`toolCallCut=yes`) and no tool runs. Scripts do not see the flag.
9. **Route.**
   - A tool call runs the tool loop: the tool runs, then this node is called again with the tool's reply as the new
     user message, until a text answer.
   - A text answer leaves by `summary` when a summary is due (20 turns or 50 000 tokens since the last one, counted
     after this answer) and the `summary` edge points to one Summarizer. Otherwise it leaves by `next_1`.
   - Any failure leaves by `error`, else by `next_1` (steps 1, 4 and 5).

**Tools in short:** register each tool in `keen-tools.json` (`name`, `type` `flow` | `script`, `entry`), write the
`<SYSTEM CALL>` format and the tool list into the system prompt yourself (the engine adds nothing), and make every tool
send its result back with `Agent.setRootAgentPrompt` on the calling agent's session. **Read
`references/tool-calling.md` before you give an LLM node a tool or write a tool.**

## Mistakes that break it

| Mistake | What happens | Write instead |
|---|---|---|
| a chat LLM with no Fallback | a provider failure (a key, capacity, a timeout) puts the provider's error text in the chat as the answer | `error` → the same agent on another provider (the house standard, `../SKILL.md`) |
| a chat LLM with no `summary` edge | the model gets up to 50 earlier turns with no token cap and forgets everything older; a long chat outgrows the context | `summary` → one Summarizer, with its own Fallback Summarizer |
| the answering node's `agentId` differs from the console agent's ID | it sees no user message. Anthropic / Google answer with the E6002 parser error text, and the chat shows nothing from this node | the console agent's ID exactly |
| `"agentId": "${dictionary.agent}"` or digits in it | keen-validate rejects it | a literal kebab-case slug |
| a model not in the table, or `company: "Anthropic AI"` | provider: validator error. Model: run-time E6101 text as the answer, via Fallback / Out | `company` + `model` from the table |
| an enum knob (`effort` / `reasoningEffort` / `thinkingLevel`) the model does not list — e.g. `"reasoningEffort": "minimal"` on gpt-5.x, or an index past the end | not sent; the provider's default runs; one WARN in the engine's own service log, not in the agent's Log Record (a number is the index into THAT model's options, a string must be one of them in any case) | a value from the model's own options (the canvas saves the index; write the string — clearer) |
| `effort` on claude-opus-4-6 / claude-sonnet-4-6 | decoded but not sent to the API today (the engine sends `effort` only for opus-4-5 / opus-4-7) | leave it out on those models until the platform sends it |
| a `thinkingLevel` the model does not list (e.g. `"MEDIUM"` on gemini-3-flash) | not sent; the model's default runs; one WARN in the engine's service log | a level from that model's options |
| `effort` on haiku | not an option of the model — not sent | leave it out |
| `"topP": 0.9` | ignored (the key is `top_p`) | `"top_p": 0.9` |
| no `modelId`, or a wrong one | the run is fine, but the canvas shows another model and a Save there switches to it | the id from the table |
| an empty prompt, or `${…}` resolving to empty, on openai | E6002 `Prompt "<id>" has invalid or empty content.` becomes the answer | non-empty text around the placeholder |
| `${dictionary.items}` (a list) in a prompt | empty text in its place | have a Script write a string first |
| `summary` → two nodes, or → an LLM node | deploy refused: `Summary output must connect to exactly one Summarizer node.` | one edge to one Summarizer |
| expecting Fallback on a cut answer or a bad tool call | it never fires | raise `maxTokens`; fix the tool / prompt |
| reading `${dictionary.answer}` after the node without `agentResponse` | `null` / empty | `"agentResponse": true, "agentResponseProperty": "answer"` |
| sourceHandle `out` / `fallback` / `next` | keen-validate rejects it | `next_1` / `error` / `summary` |

## Example: a support agent with failover

The `.flow` above is the main node, `support-agent` on `claude-sonnet-4-6`. Its `error` goes to a copy with the same
`agentId`, `agentName` and `prompts`, but `llm` = `{ "company": "google", "model": "gemini-2.5-flash", "modelId": 4913,
"parameters": { "temperature": 0.8, "maxTokens": 8192 } }`. Both `next_1` edges go to one End Flow, whose `in` takes
several edges; the copy's own `error` goes to that End too. If both providers fail, the flow ends with Google's error
text as the answer. Both nodes' `summary` edges go to one Summarizer (on `claude-haiku-4-5-20251001`) whose Fallback is
a second Summarizer on `gpt-4o-mini`; both Summarizers' Outs lead to the same End. This is the house standard
(`../SKILL.md`); the example projects of `../../../AgentArchitecture/` and `../../../Services/` are built this way.
