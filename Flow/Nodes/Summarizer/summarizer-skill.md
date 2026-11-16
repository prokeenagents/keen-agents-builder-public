# Summarizer (`summarizerNode`)

## Description

Keeps a long chat inside the model's context. Without it, an LLM node sees only the last 50 turns of its chat and
everything older is forgotten. Wire the LLM node's `summary` output to a Summarizer and the platform keeps a
**rolling summary** of the chat. The summary is at most 1500 tokens, and it is written into every later answer's
system text.

The LLM node always answers first; the summary never delays an answer. After a successful **text** answer the
node checks whether a summary is **due**: the turns since the last summary, counting the exchange just answered,
reach **20 turns or 50 000 tokens**, whichever comes first. A turn is one finished exchange of this `agentId` in
this chat. Tool-call turns do not count. On a due answer the LLM node leaves by `summary` **instead of**
`next_1`. The Summarizer then runs as its own flow step with its own model and prompt, and the flow continues from
**its** Out. The answer has already streamed. The summary never streams, writes no chat-history row and shows
nothing in the chat. The chat stays busy until the flow ends; the Chat SDK reports it with `onSummarizing`.

Do not trim history in a Script instead. The engine loads the history itself, and a Script cannot change what the
model is sent. The 20 / 50 000 / 1500 thresholds are platform-wide, not node settings. The user's message is
capped at 20 000 characters on every agent (E2101 at the relay), with or without a Summarizer.

## In / Out

**In:** `in`, **several** edges allowed. Only two sources may connect: an LLM node's `summary`, or another
Summarizer's `error` (Fallback). The canvas, keen-validate and deploy refuse anything else. Several LLM nodes may
share one Summarizer. Each keeps its own summary under its own `agentId`. Nodes with the **same** `agentId`
(a failover copy) share one summary.

**Out:** `next_1` (canvas label Out). It leads to the `in` of any node except a Summarizer (or into a Loop's
`next_2`). It is optional. A Summarizer without Out still deploys with no warning, but on a due turn **the path
ends there**. Normally wire it to where the LLM node's own `next_1` leads, such as the same End Flow or Jump Flow.
Nothing checks that the two Outs agree. The canvas allows one edge per out handle.

## Fallback

Yes. `error` is the Fallback, used for **model failover**. When this Summarizer's summary fails, the next
Summarizer tries it. Its edge goes **only** into another Summarizer's `in`, and it must be **exactly one** edge.
Two edges, or a target that is not a Summarizer, refuse the deploy, and a chain of Fallbacks must not loop. Give
each Summarizer in the chain a different provider. A Summarizer that fails with no Fallback continues by its own
Out, so a failed summary never stops the flow. The engine also never re-enters a Summarizer that this task
already tried. In an agent you build, give every Summarizer a Fallback Summarizer on another provider by default (the
house standard, `../SKILL.md`).

## Error

There is no separate Error output. Failures go to **Fallback** (`error`), or to Out when it is unwired. A failed
summary saves nothing. The chat continues on its **newest saved summary**, and the next answer tries again.

## Settings

There are two canvas menus, Model and Instructions. There is no General panel, and no `agentId`, `agentName`,
`specialRules`, Interact with DB or Use tools. The summary call runs under the **main** LLM node's identity:
its `agentId` names the summary, and its `agentName` appears on the usage record.

| Menu · field | JSON key (`data.settings.…`) | Rule | What it is for |
|---|---|---|---|
| Model · Company / Model | `llm.company`, `llm.model`, `llm.modelId` | company + model **required** (the canvas refuses Save without them and, while none is saved, says "No model saved yet" / "A Summarizer node needs a model."); the same providers, models and ids as the LLM node (see `LLM/llm-skill.md`) | the model that writes the summary. `modelId` is only for the canvas |
| Model · Max Tokens | `llm.parameters.maxTokens` | the canvas caps it at 1500. The engine sends `min(maxTokens, 1500)`, or 1500 when it is absent or not a positive number | the summary's length cap. Below 1500 it may cut the summary, and a cut summary is discarded |
| Model · Temperature / Top p | `llm.parameters.temperature`, `top_p` | as on the LLM node | low (≈ 0.2) keeps summaries factual |
| Model · reasoning | `effort` / `reasoningEffort` / `thinkingLevel` / `thinkingBudget` | as on the LLM node | keep it off or low; see the warning below |
| Instructions | `prompts[]` `{ id, role: "system", content }` | the canvas writes the first prompt as the system turn (pre-filled with the recommended prompt on a new node; any further prompt in the file is kept); `content` takes `${…}` | *how* to summarize. The platform adds the previous summary and the new turns |

**Reasoning warning.** Reasoning tokens count toward the 1500-token cap. A summary cut there is discarded and
the Summarizer fails. keen-validate and deploy **warn**, but do not refuse, for `o1` / `o4-mini` (keen-validate
only), and for `effort` / `reasoningEffort` / `thinkingLevel` above `none` / `minimal` / `low` (or a number ≥ 1).
They do not warn when the knob is **absent** on a model that reasons by default, such as Gemini 3 (HIGH) or
gpt-5*, and they never check `thinkingBudget`. Pick a fast non-reasoning model (`claude-haiku-4-5-20251001`,
`gpt-4o-mini`, `gpt-4.1-2025-04-14`), or set the knob to `"low"` / `"LOW"` explicitly.

## Rotate

Yes. It is cosmetic: it moves where the dots are drawn and never changes the wiring. The value is stored as
`data.handlePosition` (`"top"` / `"right"` / `"bottom"` / `"left"`) and is **absent until the person rotates**.
The default is `top`: In at the top, Fallback on the left, Out at the bottom. Do not write it.

## JSON structure

| Property | Required | What it means and what it is for |
|---|---|---|
| `id` | yes | `summarizerNode_` + exactly 12 `A–Z a–z 0–9`, unique in the project. The engine routes the task by this prefix. A prefix that disagrees with `type` → keen-validate error; a body that is not 12 characters → warning |
| `type` | yes, `"summarizerNode"` | the node kind |
| `position.x`, `position.y` | yes | canvas place, multiples of 16. Not read by the engine; missing → warning |
| `data.label`, `data.description` | write `""` | the canvas has no field for them. Not read by the engine |
| `data.labelNode` | yes, `"Summarizer"` | fixed; anything else → keen-validate error |
| `data.descriptionNode` | yes, `"Writes the chat summary for an LLM node's Summary output"` | fixed; anything else → keen-validate error |
| `data.openLLM`, `data.openPrompt` | no — leave them out | the canvas no longer reads or writes them (both menus open closed; ones already in a file are kept). Not read by the engine |
| `data.handlePosition` | no | see *Rotate*. Leave it out |
| `data.settings.llm.company` / `.model` | **yes** | missing on a reached Summarizer → error `A Summarizer node needs a model.`; a company other than anthropic / openai / google → error; an unknown model passes keen-validate and fails at run time (`bad-target`) |
| `data.settings.llm.modelId` | yes (for the canvas) | the model's id from the LLM table. Not read by the engine |
| `data.settings.llm.parameters` | `maxTokens` advised | see *Settings* |
| `data.settings.prompts[]` | yes (one system turn) | `content` takes `${dictionary.…}` / `${session.…}`, resolved like any node's. keen-validate checks the placeholders |
| `data.settings.sessionId`, `requestId` | no (the canvas writes `""`) | left over from the LLM form. Not read by the engine |
| `dragHandle` | yes, `".drag-handle__custom"` | anything else → warning |

## In the `.flow` file

The main Summarizer (Anthropic) with a Fallback Summarizer (OpenAI). The LLM node `agentNode_kM6oI3DsNdH3` is as in
`LLM/llm-skill.md`. Its `next_1` and both Summarizers' Outs go to the same End Flow.

```json
{
  "id": "summarizerNode_Qw3Er5Ty7Ui9",
  "type": "summarizerNode",
  "position": { "x": 624, "y": 736 },
  "data": {
    "label": "", "description": "",
    "labelNode": "Summarizer", "descriptionNode": "Writes the chat summary for an LLM node's Summary output",
    "openLLM": false, "openPrompt": false,
    "settings": {
      "sessionId": "", "requestId": "",
      "llm": { "company": "anthropic", "model": "claude-haiku-4-5-20251001", "modelId": 4939,
               "parameters": { "temperature": 0.2, "maxTokens": 1500 } },
      "prompts": [ { "id": "9d2f6a1e-4b7c-4e0a-8f3d-2c1b0a9e8d7f", "role": "system",
        "content": "You maintain a running summary of a conversation between a user and an AI agent.\nYou receive the previous summary (or \"(none)\") and the newest part of the conversation.\nWrite the updated summary of the WHOLE conversation so far.\n\nKeep: facts the user stated, decisions made, names, numbers, dates, identifiers, the user's preferences and\nconstraints, tasks done, and open questions or promised next steps.\nDrop: greetings, small talk, repetition, and wording that adds nothing.\nWrite in the language of the conversation. Be concise: plain short sentences or bullets, no headings.\nNever invent anything that is not in the conversation. If something changed, keep the newest version.\nReturn only the summary text." } ]
    }
  },
  "dragHandle": ".drag-handle__custom"
}
```

The Fallback `summarizerNode_Lk2Jh4Gf6Ds8` is the same node at `{ "x": 944, "y": 736 }`, with
`"llm": { "company": "openai", "model": "gpt-4o-mini", "modelId": 4921, "parameters": { "temperature": 0.2, "maxTokens": 1500 } }`
and the same prompt. The edges:

```json
{ "id": "xy-edge__agentNode_kM6oI3DsNdH3summary-summarizerNode_Qw3Er5Ty7Ui9in", "type": "step",
  "source": "agentNode_kM6oI3DsNdH3", "sourceHandle": "summary", "target": "summarizerNode_Qw3Er5Ty7Ui9", "targetHandle": "in" },
{ "id": "xy-edge__summarizerNode_Qw3Er5Ty7Ui9error-summarizerNode_Lk2Jh4Gf6Ds8in", "type": "step",
  "source": "summarizerNode_Qw3Er5Ty7Ui9", "sourceHandle": "error", "target": "summarizerNode_Lk2Jh4Gf6Ds8", "targetHandle": "in" },
{ "id": "xy-edge__summarizerNode_Qw3Er5Ty7Ui9next_1-endNode_Rr3TtUu7Vv9Win", "type": "step",
  "source": "summarizerNode_Qw3Er5Ty7Ui9", "sourceHandle": "next_1", "target": "endNode_Rr3TtUu7Vv9W", "targetHandle": "in" },
{ "id": "xy-edge__summarizerNode_Lk2Jh4Gf6Ds8next_1-endNode_Rr3TtUu7Vv9Win", "type": "step",
  "source": "summarizerNode_Lk2Jh4Gf6Ds8", "sourceHandle": "next_1", "target": "endNode_Rr3TtUu7Vv9W", "targetHandle": "in" }
```

## How the engine runs it

1. **Every answer of the LLM node.** A node with a `summary` edge reads the newest saved summary and appends it
   to its system text as `Summary of the earlier conversation:\n<text>`. Its history is the last 50 turns, cut
   from the oldest to fit **50 000 tokens**. This happens even while the Summarizer keeps failing.
2. **Due?** The check runs only after a successful **text** answer, with chat history on (Interact with DB on)
   and a `summary` edge to exactly one Summarizer. The tail is the finished non-tool turns of
   `(chat, agentId)` after the last summary, counting the exchange just answered. If it holds ≥ 20 turns or
   ≥ 50 000 tokens, the node leaves by `summary` only, carrying the main agent's `agentId` / `agentName`.
   Otherwise it leaves by `next_1`. A tool call, a provider failure or a cancel never leads to `summary`.
3. **The Summarizer task.** A lease admits one Summarizer per `(chat, agentId)`. If another tab or replica holds
   it, the task leaves by Out and does nothing. The engine re-checks under the lease that a summary is still due
   (if not: Out). Then it summarizes **portions** of the oldest tail turns, whole turns only, each ≤ 20 turns and
   ≤ 50 000 tokens. A single turn above 50 000 tokens is sent as its first 20 000 + last 20 000 tokens. Each call
   gets this node's prompts plus a platform-built user turn: `[Previous summary]` (or `(none)`),
   `[Conversation, oldest first]` as `User: … / Agent: …`, and *"at most 1200 tokens. Return only the summary."*
   The call does not stream. One task makes at most **3 portions** within **one 60 s budget**. The budget is per
   Summarizer task, so each Fallback gets its own.
4. **Accepted** only on a normal stop with non-empty text of ≤ 1500 tokens. Each accepted portion is saved as the
   newest summary of `(chat, agentId)`, and the last 5 are kept. Then the task leaves by Out.
5. **Failure reasons:**
   - `timeout`: the budget ran out.
   - `provider`: the call failed.
   - `cut`: any stop that is not normal, the token limit included.
   - `empty`, or `too-long` (more than 1500 tokens).
   - `bad-target`: no model, an unknown model, or a prompt the parser refuses (e.g. empty `content` on openai).
     These go to the Fallback, and so do the reasons above.
   - `bad-target` because the Summarizer was reached other than by a `summary` / Fallback edge: it leaves by Out.
   - `error`: the summary store or the lease failed. It leaves by Out, because another model would not help.

   A failure saves nothing, so the tail keeps growing. **Every following answer is due again**, and the
   Summarizer runs and fails on every turn until it succeeds.
6. **The log line.** Each failed task writes ONE warning to the agent's Log Record. Success, not due,
   a busy lease and a cancel write nothing. The line:
   `[WARNING] Chat summary failed: node=<summarizer> agent=<main agentId> provider=… model=… reason=<reason> [code= finishReason= maxTokens= summaryTokens= budgetMs= savedPortions=] req=<id> — <what happened>; <what next>`.
   The *what next* part is `the Fallback <id> tries next.`, or `the chat continues on its newest saved summary
   and the next answer that is due tries again.`. For a wiring fault it is `no summary was made; the flow
   continues via Out.`. The line never holds the prompt, the turns or the summary.

## Mistakes that break it

| Mistake | What happens | Write instead |
|---|---|---|
| `summary` → an LLM node, or two `summary` edges | deploy refused: `Summary output must connect to exactly one Summarizer node.` | one edge to one Summarizer |
| no `llm` / no model on a reached Summarizer | refused: `A Summarizer node needs a model.` | company + model + `modelId` |
| a Start / Script / LLM `next_1` into the Summarizer's `in` | refused: `A Summarizer node's In takes only a Summary output or a Summarizer's Fallback.` | only `summary` or a Summarizer's `error` |
| Fallback → an End / LLM node, or two Fallback edges | refused: `A Summarizer node's Fallback connects only to a Summarizer node.` | one edge to another Summarizer's `in` |
| A → B → A through Fallbacks | refused: `Summarizer Fallbacks must not form a loop.` | a chain that ends |
| Summarizer Out unwired | a due turn ends the path there, while a normal turn goes on by the LLM's Out | wire it to where the LLM node's `next_1` leads |
| a reasoning model, or `maxTokens` 400 | the summary is `cut` and discarded, every turn | a non-reasoning model, `maxTokens` 1500 |
| source LLM with Interact with DB off | warning; it never summarizes | keep chat history on |
| expecting the LLM's `next_1` to run on a due turn | it does not; only `summary` is followed | put the shared tail behind both Outs |

## Example

A support agent. The main LLM `support-agent` (Anthropic) has a failover copy (Google) with the same `agentId`,
reached by its `error`. Both LLM nodes wire `summary` into one Summarizer on `claude-haiku-4-5-20251001`. They
share one summary because their `agentId` is the same. That Summarizer's Fallback is a `gpt-4o-mini` Summarizer.
Both LLMs' `next_1` and both Summarizers' Outs go into one End Flow.

On turn 20 the answer streams, the node leaves by `summary`, Haiku writes the summary, and the run ends through
the Summarizer's Out. If Anthropic is down, the line
`[WARNING] Chat summary failed: node=summarizerNode_Qw3Er5Ty7Ui9 agent=support-agent provider=anthropic
model=claude-haiku-4-5-20251001 reason=provider code=… req=… — the provider call failed; the summary was not
brought up to date; the Fallback summarizerNode_Lk2Jh4Gf6Ds8 tries next.` appears, and `gpt-4o-mini` writes the
summary instead.
