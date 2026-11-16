# The canvas — node by node

> **Keen 15.3 · Shira Flow Builder 0.0.6.**

For every node the canvas offers: where it is on the palette, its handles and what they may connect to, every form
field and the exact `.flow` property it sets, and what the canvas does that the engine does not care about. How the
canvas works in general (forms, saving, reloads, breakpoints) is `canvas.md`; what each node does at run time and its
full `.flow` reference are the node files under `../Flow/Nodes/`.

## Read this first

**Palette.** One flat list, no groups. Every dropped node starts as
`data: { "label": "", "labelNode": <palette name>, "descriptionNode": <palette description> }`, with no `settings`
(the Summarizer is the one exception) and `dragHandle: ".drag-handle__custom"`.

**Handles.** "In" handles are inputs (`targetHandle`), "Out"-type handles are outputs (`sourceHandle`). The position
column is where the handle sits with the default rotation; Rotate turns them all together (`canvas.md`).

**What an output may connect to.** Unless the node's section says otherwise, an output may go to **any input of any
other node** except a **Summarizer's `in`** and a **Parallel Flows `wait`**. Always: no edge to the same node, one edge
per output, one edge per single-input handle. A refused connection simply does not attach — **the canvas shows no
words**; the messages come later from the Problems panel, keen-validate and the deploy (`problems.md`).

**Forms.** "Box" is the input's own typing limit (`maxLength`); "Check" is the form's validation, whose message is shown
under the field and blocks Save. Where the box is shorter than the check, a person can type only up to the box. Every
**Settings** panel and the LLM's **General Settings** end with a **Description** textarea (box 250, check ≤ 250,
"Description must be at most 250 characters") writing `data.description` — listed once here, not in every table. A
Description left empty is saved as `"description": ""`. The Summarizer's menus, the LLM's other two panels and the Join
(no form) have no Description field.

## Start Flow — `startNode`

**On the palette.** "Start Flow", 1st. Description "Flow entry point".

**Handles.**

| Handle | Id | Kind | Default side | May connect to |
|---|---|---|---|---|
| out | `next` | output (green) | bottom | the general rule (any input but a Summarizer `in` / Parallel Flows `wait`) |

No input: nothing can be drawn into a Start.

**The form** (sliders icon → Settings).

| Field | Control | Default | Check | Box | Writes |
|---|---|---|---|---|---|
| Label | text | `data.label` | required ("Label is required"), ≤ 60, `/^[A-Z][a-zA-Z]*$/` ("Label must start with an uppercase letter and contain only letters") | 60 | `data.label`, `data.settings.value`, `data.settings.label` (all three the same) |

**Canvas-only behaviour.** The card shows `data.label` (the form also reads its field from `data.label`, not from
`settings.label`). The canvas does not stop a second Start Flow in the file or two Starts with the same label (a pasted
Start keeps its label). The Start card moves like any other card.

Node file: `../Flow/Nodes/StartFlow/start-flow-skill.md`

## LLM — `agentNode`

**On the palette.** "LLM", 2nd. Description "Use LLM processor".

**Handles.**

| Handle | Id | Kind | Default side | May connect to |
|---|---|---|---|---|
| In | `in` | input (blue), **takes many** | top | — |
| Fallback | `error` | output (red) | left | the general rule (e.g. another LLM with the same agent on another provider) |
| Out | `next_1` | output (green) | bottom | the general rule |
| Summary | `summary` | output (yellow) | right | **only a Summarizer's `in`**; anything else is refused |

**The forms.** Three panels from the head icons: **General settings** (sliders), **LLM settings** (robot),
**Prompt settings** (prompt icon, a wide panel). Only one is open at a time.

*General Settings*

| Field | Control | Default | Check | Box | Writes |
|---|---|---|---|---|---|
| Agent Name | text | `settings.agentName` or `""` | 4–60 ("Agent Name must be at least 4 characters") | 60 | `data.settings.agentName` |
| Agent ID | text | `settings.agentId` or `""` | 4–60, `/^[a-z]+(-[a-z]+)*$/` ("Agent ID must be lowercase letters and dashes only (e.g. agent-one)") — no digits, no `${…}` | 60 | `data.settings.agentId` |
| Session ID | text | `settings.sessionId` or `""` | ≤ 60 | 60 | `data.settings.sessionId` |
| Request ID | text | `settings.requestId` or `""` | ≤ 60 | 60 | `data.settings.requestId` |

*LLM Settings*

| Field | Control | Default | Check | Writes |
|---|---|---|---|---|
| Company | menu: google, openai, anthropic | `settings.llm`, else the catalogue's first model (google `gemini-2.0-flash-001`) | a company and model are needed to Save | `data.settings.llm.company`; choosing it selects that company's first model |
| Model | menu of the company's models | as above | — | `data.settings.llm.model` (the name) and `data.settings.llm.modelId` (the catalogue id) |
| one slider per parameter the model declares | Temperature, Top p, Max Tokens: number sliders (step 0.1 when the maximum is ≤ 2, else 1); Effort, Reasoning Effort, Thinking Level: stepped sliders over the option names | the model's defaults | within the model's min / max | `data.settings.llm.parameters.<name>` — numbers as numbers (2 decimals), a choice as its **index** in the option list |
| Sampling Parameter (select one) | radio, only on models whose Temperature and Top p exclude each other | the first of the pair | — | only the chosen one is saved; the other key is removed |
| Interact with DB | switch, on | on when the rule is absent | — | off → adds `{ "type": "skip-internal-database-interactions" }` to `data.settings.specialRules` |
| Use tools | switch, on | on when the rule is absent | — | off → adds `{ "type": "skip-internal-tooling" }` to `data.settings.specialRules` |

Saving writes `llm` and `specialRules` (an empty array `[]` when both switches are on). The **default model shown is
not saved until a person changes something** in the panel (Save stays disabled), so a fresh LLM has no
`settings.llm` in the file.

*Prompt Settings*

| Field | Control | Check | Writes |
|---|---|---|---|
| Conversation Roles | list of turns; **Add Turn** (disabled at 20 turns); the first turn is always **System** (cannot be moved, deleted or re-roled); every later turn toggles **user ↔ assistant** with ◀ ▶, moves with ↑ ↓, deletes with ✕; a new turn takes the opposite role of the selected one | — | `data.settings.prompts[]` in list order |
| Conversation Prompts | the rich-text Markdown editor for the selected turn, with the two Keen tool buttons (`canvas.md`) | each turn's content required ("Prompt cannot be empty") | `prompts[i].content` |

On Save every turn gets `{ "id", "role", "content" }`: a missing `id` gets a new UUID, and turn 1's `role` is forced to
`"system"`. The same Save also writes `data.label` and `data.description` back with the values the node had when its
card was first drawn (the panel has no fields for them) — this erases a Description saved in General Settings in the
same session.

**Canvas-only behaviour.**

- The card body shows `settings.agentName`, `ID: <agentId>`, `settings.value` (no form writes it), the company and
  model, and `data.description`. `data.label` is not shown anywhere and has no field.
- Panel flags `data.open` (General), `data.openLLM`, `data.openPrompt` are written to the file.
- The canvas cannot leave out a parameter the model declares (except the unchosen one of a "select one" pair): to send
  no Effort / Reasoning Effort / Thinking Level, the file must be edited.
- A saved `modelId` that is not in the bundled catalogue opens with the company selected, an empty Model box and the
  sliders of the catalogue's first model.
- Unknown keys in `settings` (e.g. `agentResponse`, `agentResponseProperty`, which have no field) are kept by every
  Save.

**The bundled model catalogue** (the menus of both LLM and Summarizer; `flowBuilder.aiModels` does not change it):

| Company | Model (`modelId`) | Parameters the canvas shows and saves |
|---|---|---|
| google | `gemini-2.0-flash-001` (4912), `gemini-2.5-flash` (4913), `gemini-2.5-pro` (4914), `gemini-flash-latest` (4918) | temperature 0–2 (0.8), top_p 0–1 (0.8), maxTokens ≤ 65536 (65536) |
| google | `gemini-3-flash-preview` (4931) | as above (temperature default 1) + thinkingLevel MINIMAL / LOW / HIGH (default index 1) |
| google | `gemini-3.1-pro-preview` (4932) | as above + thinkingLevel LOW / MEDIUM / HIGH (default index 1) |
| google | `gemini-3.1-flash-lite-preview` (4940) | as above + thinkingLevel MINIMAL / LOW / MEDIUM / HIGH (default index 1) |
| openai | `gpt-4.1-2025-04-14` (4919), `gpt-4o` (4920), `gpt-4o-mini` (4921) | temperature 0–1 (0.8), top_p 0–1 (0.8), maxTokens ≤ 16384 (16384) |
| openai | `o1` (4923), `o4-mini` (4925) | maxTokens ≤ 100000 (100000), reasoningEffort low / medium / high (default index 0) |
| openai | `gpt-5.4` (4933) | maxTokens ≤ 128000 (128000), reasoningEffort none / low / medium / high / xhigh (default index 0) |
| openai | `gpt-5.4-mini` (4935), `gpt-5.4-nano` (4936) | temperature fixed 1 (slider disabled), maxTokens ≤ 128000, reasoningEffort none … xhigh (default index 0) |
| anthropic | `claude-opus-4-5-20251101` (4926), `claude-opus-4-5` (4927) | temperature (1) **or** top_p (select one), maxTokens ≤ 64000 (8192), effort low / medium / high (default index 1) |
| anthropic | `claude-sonnet-4-5-20250929` (4928), `claude-sonnet-4-5` (4929), `claude-haiku-4-5-20251001` (4939) | temperature (1 on the two Sonnets, 0.8 on Haiku) **or** top_p, maxTokens ≤ 64000 (8192) |
| anthropic | `claude-opus-4-6` (4937) | temperature (0.8) **or** top_p, maxTokens ≤ 128000 (8192), effort low / medium / high / max (default index 2) |
| anthropic | `claude-sonnet-4-6` (4938) | temperature (0.8) **or** top_p, maxTokens ≤ 64000 (8192), effort low / medium / high (default index 2) |

Which models the engine actually runs, and how it reads each knob: `../Flow/Nodes/LLM/llm-skill.md`.

Node file: `../Flow/Nodes/LLM/llm-skill.md`

## Summarizer — `summarizerNode`

**On the palette.** "Summarizer", 3rd. Description "Writes the chat summary for an LLM node's Summary output".
Dropped with `data.settings` = `{ "sessionId": "", "requestId": "", "prompts": [{ "id": <UUID>, "role": "system",
"content": <the recommended summary instructions> }] }` and no `llm`.

**Handles.**

| Handle | Id | Kind | Default side | May connect to |
|---|---|---|---|---|
| In | `in` | input (**yellow**), takes many | top | accepts **only** an LLM's `summary` or a Summarizer's `error`; anything else is refused |
| Fallback | `error` | output (red) | left | **only another Summarizer's `in`** (for a model failover); anything else is refused |
| Out | `next_1` | output (green) | bottom | the general rule |

The canvas does not stop Fallbacks that come back round in a circle (A → B → A); the Problems panel and the deploy do
(`Summarizer Fallbacks must not form a loop.`).

**The forms.** Two menus: **Model** (robot icon) and **Instructions** (prompt icon, a wide panel). No General panel.

| Menu · field | Control | Check | Writes |
|---|---|---|---|
| Model · Company / Model / parameters | the LLM's selector (above), with **Max Tokens capped at 1500**: the slider's maximum is min(model maximum, 1500), and the saved value is capped at 1500 | a company and model to Save | `data.settings.llm` (`company`, `model`, `modelId`, `parameters`) |
| Instructions · System Prompt | the Markdown editor, **without** the two Keen tool buttons | required ("Instructions cannot be empty") | `data.settings.prompts` = exactly one `{ id, role: "system", content }` (the existing `id` is kept) |

**Canvas-only behaviour.**

- No model is saved until a person changes something in the Model menu (Save is disabled until then). A Summarizer
  can be wired with no model; the Problems panel and the deploy then report `A Summarizer node needs a model.`
- The card shows the word "Summarizer", the company and model (or that there is no model), and the first line of the
  instructions. `data.label` / `data.description` have no field.
- Panel flags `data.openLLM` / `data.openPrompt` are written to the file.

Node file: `../Flow/Nodes/Summarizer/summarizer-skill.md`

## Condition — `conditionNode`

**On the palette.** "Condition", 4th. Description "Set condition flow direction".

**Handles.**

| Handle | Id | Kind | Default side | May connect to |
|---|---|---|---|---|
| In | `in` | input (blue), **one edge only** | top | — |
| True | `true` | output (green) | left | the general rule |
| False | `false` | output (yellow) | right | the general rule |

**The form.**

| Field | Control | Default | Check | Box | Writes |
|---|---|---|---|---|---|
| Condition | text | `settings.value` | required ("Condition is required"), ≤ 150 ("Condition must be at most 150 characters") | **60** | `data.settings.value` **and** `data.label` |

**Canvas-only behaviour.** A person can type at most 60 characters (a longer expression written into the file opens
and keeps its text, but cannot be extended on the canvas). The card shows `data.label`, i.e. the expression. The form
does not check the expression's syntax.

Node file: `../Flow/Nodes/Condition/condition-skill.md`

## Loop — `loopNode`

**On the palette.** "Loop", 5th. Description "Loop dictionary iterable segment".

**Handles.**

| Handle | Id | Kind | Default side | May connect to |
|---|---|---|---|---|
| In | `in` | input (blue), takes many | top | — |
| Next | `next_2` | **input** (green), **one edge only** — the body's way back | left | — |
| Finish | `next_1` | output (yellow) | right | the general rule |
| Out | `out` | output (green) — the body | bottom | the general rule |

The canvas refuses an edge from the Loop to itself, so the body needs at least one node between `out` and `next_2`.

**The form.**

| Field | Control | Default | Check | Box | Writes |
|---|---|---|---|---|---|
| Read from | text | `settings.value` | required ("Read from is required"), ≤ 120 | **60** | `data.settings.value` |
| Set to | text | `settings.setto` | required ("Set to is required"), ≤ 120, must differ from Read from ("Read from and Set to must be different") | **60** | `data.settings.setto` |

**Canvas-only behaviour.** The form does **not** check the `dictionary.` / `session.` prefix — a bare `items` saves. The
card body shows `data.label`, which no Loop field writes, so the card does not show what it loops over.

Node file: `../Flow/Nodes/Loop/loop-skill.md`

## Run Flow — `runFlowNode`

**On the palette.** "Run Flow", 6th. Description "Execute Flow in this context and return".

**Handles.**

| Handle | Id | Kind | Default side | May connect to |
|---|---|---|---|---|
| In | `in` | input (blue), takes many | top | — |
| Out | `next_1` | output (green) | bottom | the general rule |

**The form.**

| Field | Control | Default | Check | Box | Writes |
|---|---|---|---|---|---|
| Flow | text | `settings.value` | required ("Flow is required"), ≤ 120, `/^[A-Z][a-zA-Z]*-[A-Z][a-zA-Z]*$/` ("Flow must be two capitalized words joined by a hyphen (e.g. Start-Flow)") | 120 | `data.settings.value` |

**Canvas-only behaviour.** The card shows `settings.value`. The form refuses a `${…}` value, digits and any other
shape; a value already in the file is **kept as it is** (the canvas never strips it) — only a Save from this form is
refused until it is fixed. The form does not check that the named flow exists.

Node file: `../Flow/Nodes/RunFlow/run-flow-skill.md`

## Jump Flow — `jumpFlowNode`

**On the palette.** "Jump Flow", 7th. Description "Execute Flow in this context and continue".

**Handles.**

| Handle | Id | Kind | Default side | May connect to |
|---|---|---|---|---|
| In | `in` | input (blue), takes many | top | — |

No output.

**The form.** Same as Run Flow: **Flow** (placeholder "Flow to jump to"), same check, box 120, writes
`data.settings.value`.

**Canvas-only behaviour.** As Run Flow.

Node file: `../Flow/Nodes/JumpFlow/jump-flow-skill.md`

## Join Flow — `joinNode`

**On the palette.** "Join Flow", 8th. Description "Common merge point".

**Handles.**

| Handle | Id | Kind | Default side | May connect to |
|---|---|---|---|---|
| In | `in` | input (blue), takes many | top | — |
| Out | `next_1` | output (green) | bottom | the general rule |

**The form.** None — the head has only Rotate. The canvas never writes `settings`, `open` or `description` for a Join
(it keeps whatever the file has in `data`).

**Canvas-only behaviour.** The card shows `settings.value`, which nothing writes.

Node file: `../Flow/Nodes/JoinFlow/join-flow-skill.md`

## Assignment — `assignmentNode`

**On the palette.** "Assignment", 9th. Description "Set properties to the current dictionary".

**Handles.**

| Handle | Id | Kind | Default side | May connect to |
|---|---|---|---|---|
| In | `in` | input (blue), **one edge only** | top | — |
| Out | `next_1` | output (green) | bottom | the general rule |

**The form.**

| Field | Control | Default | Check | Box | Writes |
|---|---|---|---|---|---|
| Label | text | `data.label` | ≤ 60 | 60 | `data.label`, `data.settings.value`, `data.settings.label` |
| Dictionary Key/Value Pairs | rows of Key + Value, **Add Pair** (off at 10), ✕ per row | `settings.keyValuePairs` or none | ≤ 10 pairs; key required ("Key is required"), ≤ 100; value ≤ 200; no two rows with the same key after trimming ("Duplicate key") | key 100, value 200 | `data.settings.keyValuePairs` = `[{ "key", "value" }]`, values always strings |

**Canvas-only behaviour.** The card shows `settings.value` (the label). Values are typed text, so the form always saves
strings.

Node file: `../Flow/Nodes/Assignment/assignment-skill.md`

## Script — `scriptNode`

**On the palette.** "Script", 10th. Description "Execute custom JS script".

**Handles.**

| Handle | Id | Kind | Default side | May connect to |
|---|---|---|---|---|
| In | `in` | input (blue), takes many | top | — |
| Error | `error` | output (red) | left | the general rule |
| Out | `next_1` | output (green) | bottom | the general rule |

**The form.**

| Field | Control | Default | Check | Box | Writes |
|---|---|---|---|---|---|
| Label | text | `data.label` | ≤ 60 | 60 | `data.label`, `data.settings.label` |
| Script path | text (placeholder "e.g. init.js") | `settings.value` | required ("Script path is required"), ≤ 160, ends with `.js` ("Script must end with .js") | 160 | `data.settings.value` |
| Dictionary Key/Value Pairs | as Assignment | `settings.keyValuePairs` | as Assignment | as Assignment | `data.settings.keyValuePairs` |

**Canvas-only behaviour.** The card shows `settings.label` and the path. The form does not check that the script file
exists. The canvas does not stop an unwired Error output (keen-validate warns about it).

Node file: `../Flow/Nodes/Script/script-skill.md`

## Parallel Flows — `parallelInNode`

**On the palette.** "Parallel Flows", 11th. Description "Execute many flows in parallel with private context".

**Handles.**

| Handle | Id | Kind | Default side | May connect to |
|---|---|---|---|---|
| In | `in` | input (blue), takes many | top | — |
| Wait | `wait` | input (yellow), takes many, **only from a Flow Pointer** | right | — |
| Out | `next_1` | output (green) | bottom | the general rule |

**The form.**

| Field | Control | Default | Check | Box | Writes |
|---|---|---|---|---|---|
| Condition (it is the card's title, not a condition) | text | **empty** (see below) | ≤ 60 | 60 | `data.label` |
| Assign results to dictionary property | text | **empty** | ≤ 60 | 60 | `data.settings.value` |

**Canvas-only behaviour.** The form never loads its two fields back: re-opening shows both empty (the Description is
loaded), and any later Save writes `""` over `data.label` and `data.settings.value`. The card shows `data.label`.

Node file: `../Flow/Nodes/ParallelFlows/parallel-flows-skill.md`

## Flow Pointer — `parallelFlowNode`

**On the palette.** "Flow Pointer", 12th. Description "Point to the flow that must be awaited".

**Handles.**

| Handle | Id | Kind | Default side | May connect to |
|---|---|---|---|---|
| out | `next` | output (green) | bottom | a Parallel Flows `wait` is its purpose, but the canvas **also lets it go into any other input** (except a Summarizer `in`) |

No input.

**The form.**

| Field | Control | Default | Check | Box | Writes |
|---|---|---|---|---|---|
| Flow | text | **empty** (see below) | required ("Flow is required"), ≤ 120, the Run Flow regex and message | **60** | `data.label`, `data.settings.value`, `data.settings.label` |

**Canvas-only behaviour.** The form loads its field from the wrong key, so re-opening a saved Flow Pointer shows Flow
**empty**; Save then demands the target again. The card shows `data.label`.

Node file: `../Flow/Nodes/FlowPointer/flow-pointer-skill.md`

## Parallel Context — `parallelContextNode`

**On the palette.** "Parallel Context", 13th. Description "Point to the single flow that must be awaited with
predefined context".

**Handles.**

| Handle | Id | Kind | Default side | May connect to |
|---|---|---|---|---|
| In | `in` | input (blue), **one edge only** | top | — |
| Out | `next_1` | output (green) | bottom | the general rule |

**The form.**

| Field | Control | Default | Check | Box | Writes |
|---|---|---|---|---|---|
| Flow Pointer | text | **empty** | required ("Flow is required"), ≤ 120, the Run Flow regex and message | 120 | `data.settings.pipe` |
| Context Collection | text | **empty** | required ("Collection Property is required"), ≤ 120, starts with `dictionary.` ('Collection Property must start with "dictionary."') | 120 | `data.settings.contextCollection` |
| Assign result to dictionary property | text | **empty** | required ("Assign Property is required"), ≤ 80 ("Assign Property must be at most 80 characters") | 120 | `data.settings.assignTo` |

**Canvas-only behaviour.** The card is 200 px wide (others 170) and shows `pipe` and `contextCollection`. Re-opening
shows all three fields empty; Save demands all three again. Assign result is required by the form although the engine
does not read it (`../Flow/Nodes/ParallelContext/parallel-context-skill.md`).

Node file: `../Flow/Nodes/ParallelContext/parallel-context-skill.md`

## Note — `noteNode`

**On the palette.** "Note", 14th. Description "Write your notes here".

**Handles.** None — a Note can never be wired. No Rotate.

**The form.**

| Field | Control | Default | Check | Box | Writes |
|---|---|---|---|---|---|
| Label (the note's text) | text | `data.label` | required ("Label is required"), ≤ 160 | **60** | `data.label`, `data.settings.value`, `data.settings.label` |

**Canvas-only behaviour.** The card is 500 px wide and shows the label and the Description (a note icon while there is
no Description). F9 puts a breakpoint on a Note, which never runs.

Node file: `../Flow/Nodes/Note/note-skill.md`

## End Flow — `endNode`

**On the palette.** "End Flow", 15th (last). Description "Flow terminal".

**Handles.**

| Handle | Id | Kind | Default side | May connect to |
|---|---|---|---|---|
| in | `in` | input (blue), takes many | top | — |

No output.

**The form.**

| Field | Control | Default | Check | Box | Writes |
|---|---|---|---|---|---|
| Label | text | `data.label` | ≤ 60 | 60 | `data.label`, `data.settings.value`, `data.settings.label` |
| Terminate Dictionary | switch | `settings.terminateDictionary`, else off | — | — | `data.settings.terminateDictionary` (`true` / `false`, always written on Save) |

**Canvas-only behaviour.** The card shows `data.label`. An End never opened has no `settings` in the file.

Node file: `../Flow/Nodes/EndFlow/end-flow-skill.md`
