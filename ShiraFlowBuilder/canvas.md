# The canvas — the visual `.flow` editor

> **Keen 15.3 · Shira Flow Builder 0.0.7.**

What a person sees and does on the canvas, and exactly what the canvas reads from and writes to a `.flow` file.
Read it before you write or rewrite a `.flow` that a person also opens on the canvas. What each node *does* at run
time and every `.flow` property is in the node skill (`../Flow/Nodes/SKILL.md` and its node files); the canvas side of
each node (handles, forms, which field sets which property) is in `canvas-nodes.md` next to this file.

## What it is

- The canvas is a **VS Code custom text editor** (view type `flowBuilder.editor`, title "Shira Flow Builder")
  registered for `*.flow` with priority `default`, so a `.flow` opens on the canvas, not as text.
- The canvas app is **bundled in the extension** (`media/builder/`) and runs directly inside the editor's webview.
  It needs no server and no network.
- The `.flow` file is plain JSON: `{ "nodes": [ … ], "edges": [ … ] }`. The canvas works on the open VS Code text
  document: the extension hands the document's text to the canvas, which parses and checks it (*What a hand-written
  `.flow` needs to open cleanly*, below), and every change on the canvas replaces the whole document text.
- One canvas per document (multiple canvases on the same file are not supported). The webview is kept alive while
  its tab is hidden, so switching tabs keeps its state.

## Opening a flow

- Open any `*.flow` in VS Code → the canvas opens. On start the canvas asks the extension for the file, then gets the
  theme, the flow, the file's breakpoints and the file's view settings (palette, pan / zoom).
- The palette starts **hidden**. On the very first open of a file (no saved pan / zoom) the canvas fits the whole flow
  into view once; after that it restores the last pan / zoom of that file.
- **Opening never writes the file.** The canvas checks the file's shape and either draws it as it is or shows the
  error state (below); it changes nothing in either case.
- A new flow made with the extension's Create Flow command starts as `{ "nodes": [], "edges": [] }` (how to create
  one: `project.md`).

**Opening a `.flow` as text.** Use VS Code's *Reopen Editor With… → Text Editor* (or *Open With…*). The extension
registers the language `keen-flow` (with a syntax grammar) for `.flow`. The text editor and the canvas can be open on
the same file at once: every text edit is pushed into the canvas immediately, and every canvas change rewrites the
text.

## The palette and placing a node

- Show / hide the palette with the **Show palette / Hide palette** button in the canvas's bottom-left controls (or
  the ✕ in the palette's head). Its open / closed state is remembered per file (see *Theme and view settings*).
- The palette is **one flat list** (no groups), in this order: Start Flow · LLM · Summarizer · Condition · Loop ·
  Run Flow · Jump Flow · Join Flow · Assignment · Script · Parallel Flows · Flow Pointer · Parallel Context · Note ·
  End Flow. Each entry shows its name and a one-line description; the footer says "Drag a node onto the canvas".
- **Drag** an entry onto the canvas to place a node at the drop point. The canvas creates:

```json
{
  "id": "<type>_<12 random A–Z a–z 0–9>",
  "type": "<type>",
  "position": { "x": 320, "y": 96 },
  "data": { "label": "", "labelNode": "<palette name>", "descriptionNode": "<palette description>" },
  "dragHandle": ".drag-handle__custom"
}
```

- The drop position is snapped to the **16 px grid**.
- Only one node gets more on drop: a **Summarizer** starts with `settings` = `sessionId: ""`, `requestId: ""` and one
  system prompt holding the recommended summary instructions (see `canvas-nodes.md`). Every other node starts with
  **no `settings` at all** until its form is saved.
- The canvas places any number of nodes of any kind. It does not stop a second Start Flow, a node that is never wired,
  or a flow with no End.

## Connecting

**Handles.** Each card has coloured dots (handles) with small labels: blue = an input (most `in` handles), green = the
normal output, red = Error / Fallback, yellow = the second branch (False, Finish, Summary, Wait, the Summarizer's In).
The full list per node is in `canvas-nodes.md`. Drag from one dot to a dot of the other kind (output → input) to draw
an edge. Every edge is drawn as a right-angled "step" line.

The canvas writes a new edge as:

```json
{ "type": "step", "source": "<node id>", "sourceHandle": "<out handle id>",
  "target": "<node id>", "targetHandle": "<in handle id>",
  "id": "xy-edge__<source><sourceHandle>-<target><targetHandle>" }
```

**The rules the canvas enforces while you draw** (one function decides every new edge):

1. **No edge from a node to itself.**
2. **One edge per output handle.** A second edge from the same output is refused.
3. **One edge per input handle**, except the merge inputs, which take many: the `in` of End Flow, Join Flow,
   Run Flow, Jump Flow, Script, Loop, LLM, Parallel Flows and Summarizer, and the `wait` of Parallel Flows.
   Single-input: the `in` of Condition, Assignment and Parallel Context, and a Loop's `next_2` (Next).
4. **Parallel Flows `wait`** accepts only a **Flow Pointer**.
5. **Summary / Summarizer wiring.** An LLM's **Summary** (`summary`) and a Summarizer's **Fallback** (`error`) may go
   only into a **Summarizer's `in`**, and a Summarizer's `in` accepts nothing else.

Everything else is allowed — the canvas does not check what kind of node an ordinary output leads to (a Flow Pointer
may lead into an LLM, a Condition's True into a Loop's Next, …).

**A refused connection has no words.** The line simply does not attach and nothing is written; the canvas shows no
message. Messages about wiring appear only later, in VS Code's Problems panel after the file is saved, from keen-validate
and from the deploy (`problems.md`). For example the Summarizer rules there read
`Summary output must connect to exactly one Summarizer node.` and
`A Summarizer node's In takes only a Summary output or a Summarizer's Fallback.`

**Changing an edge.** There is no way to drag an existing edge's end to another dot: select the edge (click it),
delete it, draw a new one.

**These rules apply only when a person draws.** An edge already in the file — hand-written, or from an older version —
is loaded as it is, even if it breaks every rule above.

## A node's form

Each card has a head with the node's palette name (the drag grip) and small icons on the right:

| Icon (tooltip) | Opens | Nodes |
|---|---|---|
| sliders — "Node settings" | the **Settings** panel | Start, End, Condition, Loop, Run Flow, Jump Flow, Assignment, Script, Parallel Flows, Flow Pointer, Parallel Context, Note |
| robot — "LLM settings" / "Prompt settings" / sliders — "General settings" | **LLM Settings** / **Prompt Settings** / **General Settings** | LLM |
| robot — "Model", prompt — "Instructions" | **Model** / **Instructions** | Summarizer |
| circular arrows — "Rotate connectors" | (turns the handles, below) | all but Note |

- Clicking an icon opens the panel **to the right of the card** and selects that node; clicking it again closes it. On
  the LLM and the Summarizer only one of the node's panels is open at a time. Several nodes may have panels open; a
  panel of a node that is not selected is dimmed and slightly blurred.
- **Which panel is open is not part of the file.** Opening or closing a panel writes nothing, does not mark the file
  modified and is no undo step. Every panel starts closed when a file opens. The keys `data.open`, `data.openLLM` and
  `data.openPrompt` that older files carry are neither read nor written — they stay in the file as they are.
- Every form has its own **Save** button, enabled only after a field was changed (the LLM's and Summarizer's model
  menus also need a company and model, and are enabled without a change while no model is saved — *The model menus*,
  below). Invalid fields show their message under the field in red and Save does not write anything. Typing in a field
  never drags the card.
- **Rotate connectors** moves the input to the next side, clockwise Bottom → Left → Top → Right, and the other
  handles keep their place relative to it. It writes `data.handlePosition` (`"top"`, `"right"`, `"bottom"` or
  `"left"`); the key is absent until the first rotate. Default: the input on top (Start Flow and Flow Pointer: their
  single output at the bottom; End Flow / Jump Flow: their input on top).

**A form always shows the node's current data.**

- **Each form loads exactly the keys it saves** (the key map per node is in `canvas-nodes.md`), so re-opening a saved
  node shows what was saved — on every node, the Flow Pointer, Parallel Flows and Parallel Context included.
- **A form follows the file.** Its fields are filled again each time its panel opens, and whenever the node's data
  changes underneath it — the file rewritten from outside (a text edit, a change on disk VS Code loads), an undo or a
  redo. A change to fields another form owns does not touch an edit in progress.
- **A Save writes only that form's own fields**, onto the node's data as it is at that moment. Every other key in
  `data` and `data.settings` is kept — a Description saved in General Settings survives a Prompt Settings Save, the
  LLM Settings Save keeps any `specialRules` entry other than its two switches, and unknown keys stay.

**The editors.**

- *Text fields* are plain inputs. Each input box stops typing at exactly the form's own limit for that field (e.g.
  Condition: 150) — `canvas-nodes.md` gives the limit and the accepted shape of each field.
- *Key/Value Pairs* (Assignment, Script): rows of Key + Value with **Add Pair** (disabled at 10 rows) and a remove ✕
  per row.
- *Instructions / prompts* (LLM Prompt Settings, Summarizer Instructions): a rich-text editor that stores
  **Markdown**. Toolbar: Heading 1 · Heading 2 · Heading 3 · Bold · Italic · Underline · Strike · Bullet list ·
  Numbered list · Inline code · Code block · Insert line, and on the LLM only two **Keen tool buttons**:
  - **Insert Keen Tool introduction** — inserts the tool-call instructions: the model must answer a tool call
    between `<SYSTEM CALL>` and `</SYSTEM CALL>` with `!*action`, `!*tool` and `!*context` lines at the start of the
    line (the inserted example names a tool `Simple Tool`), plus the formatting rules;
  - **Insert Tool definition** — inserts a catalogue entry to fill in:
    `### [TOOL_NUMBER]. [TOOL_NAME]` with `**Description**: [TOOL_DESCRIPTION]` and `**Usage**: [TOOL_USAGE]`.

  Both only insert text at the cursor; nothing else is generated. How tool calls work:
  `../Flow/Nodes/LLM/references/tool-calling.md`. Underline is saved as `<u>…</u>`; angle brackets typed as plain text
  are saved escaped (`&lt;` / `&gt;`), so the inserted tool introduction keeps `<SYSTEM CALL>` inside a code block. A
  turn a person types into is saved as the editor's own Markdown, which can differ in formatting from hand-written
  Markdown; turns nobody touched are saved unchanged.
- *JSON*: the canvas has **no JSON editor** in any node form.

**The model menus.** The LLM's LLM Settings and the Summarizer's Model menu share one selector: **Company** (google,
openai, anthropic), **Model** (the company's models), then one slider per parameter the model declares — Temperature,
Top p, Max Tokens, Effort, Reasoning Effort, Thinking Level. A choice-type parameter (Effort, Reasoning Effort,
Thinking Level) is a stepped slider that **saves the option's index**, not its name. A model whose Temperature and Top
p exclude each other shows **Sampling Parameter (select one)**, and only the chosen one is saved. A parameter fixed by
the model (minimum = maximum) is shown disabled. Choosing another company or model resets every parameter to that
model's defaults.

**While the node has no model saved**, the menu shows the catalogue's first model with a notice above it — title
"No model saved yet", then on the LLM "The LLM node runs only with a model. Choose one and Save — the model shown is
not in the file until then." and on the Summarizer "A Summarizer node needs a model. Choose one and Save — the model
shown is not in the file until then." Save is then enabled without a change, so the model shown can be saved as it
is. Save is never possible without a company and model.

The list comes from the **model catalogue bundled inside the canvas** — 24 models, **identical to the platform's own
model list**, in the same order (see `canvas-nodes.md`). It must be identical: a choice-type parameter is saved as
the option's index, and the platform reads that index against its own list. The extension setting
`flowBuilder.aiModels` does **not** reach the canvas: the bundled canvas never reads it. A node whose saved `modelId`
is not in the catalogue opens with its company selected, the Model box empty, and the sliders of the catalogue's first
model.

## Selecting, moving, copying, deleting, undo

| Action | How |
|---|---|
| Select | click a card or an edge; **Ctrl / Cmd + click** adds to the selection; **left-drag on empty canvas** draws a selection box (nodes fully inside are selected) |
| Pan | drag with the **middle or right** mouse button |
| Zoom | mouse wheel, double-click, or the + / − / fit-view buttons in the bottom-left controls (zoom 0.5–2); a minimap sits bottom-right |
| Move | drag a card by its head (the grip and the palette name). Cards snap to the 16 px grid while dragged. The Start Flow card moves like any other |
| Copy / paste | **Ctrl / Cmd + C** copies the selected nodes and the edges *between* them; **Ctrl / Cmd + V** pastes them 32 px down-right as the new selection |
| Delete | **Delete** or **Backspace** removes the selected nodes and edges; a deleted node takes its edges with it, and its breakpoint is removed |
| Undo / redo | **Ctrl / Cmd + Z**; **Ctrl / Cmd + Shift + Z** or **Ctrl / Cmd + Y** |
| Save | **Ctrl / Cmd + S** |

- **Paste** gives every pasted node a new id (`<type>_<12 random>`) and every pasted edge the id `edge_<12 random>` (not
  the `xy-edge__…` form). The data is copied as it is (old `open` keys included), so a pasted Start Flow keeps the same
  label. The clipboard lives inside one canvas: you cannot copy from one `.flow` and paste into another.
- Copy, paste, delete, undo, redo and F9 are ignored while the cursor is in a form field (the field's own text undo
  works there). Ctrl / Cmd + S works everywhere.
- **Undo / redo is VS Code's document history.** Every canvas change is one whole-document edit, so one undo reverts
  exactly one change (a form Save, a drop, a connect, a move, a rotate …) and the canvas reloads the result; an open
  form shows the reloaded values. Opening or closing a panel is not a change.

## Saving and the file

**When the document changes.** These write the whole document at once (the file is then *modified*, not saved): a
node dropped, pasted or deleted, an edge drawn or deleted, a move finished, a form saved, a rotate. These do **not**
touch the file: opening or closing a node's panel, selection, pan and zoom, showing / hiding the palette,
breakpoints, the theme.

**When the disk changes.** Only on save: **Ctrl / Cmd + S** on the canvas, or VS Code's own Save. The Problems panel
re-checks the project when a `.flow` changes on disk, so wiring problems appear after a save, not while editing.

**What the canvas writes.** On every change the document becomes:

```text
JSON.stringify({ nodes, edges }, null, 2) + "\n"
```

- **Top level:** only `nodes` and `edges`. Any other top-level key in a hand-written file is **dropped on the first
  canvas change**.
- **Each node:** exactly `id`, `type`, `position`, `data`, `dragHandle` (the last only when the node has one). Any other
  key on the node object is dropped. **`data` is kept whole** — unknown keys inside `data` or `data.settings`
  survive, because every form writes only its own keys onto the existing data (e.g. an LLM's `agentResponse` /
  `agentResponseProperty`, which have no field, stay).
- **Each edge:** kept whole except `selected` and `style`, which are removed. Unknown keys on an edge stay.
- **Ids are never changed** by the canvas, except for pasted copies.
- **Positions** are written as the card stands. Dragging snaps to 16; a position from the file is never snapped until
  the card is moved.
- **Canvas-only data the engine ignores**, all inside `data`: `labelNode`, `descriptionNode`, `label` (on most nodes),
  `description`, `handlePosition`, `llm.modelId`, plus `position` and `dragHandle`. (`open`, `openLLM`, `openPrompt`
  from older files are kept but no longer written or read.)
  The canvas does not write breakpoints, the palette state or the pan / zoom into the file.
- Nothing is re-ordered or re-formatted beyond that: 2-space indent, the keys in the order the objects have them, a
  final newline.

**When the file changes while it is open (e.g. you rewrote it).** The extension listens to the open document. Any
change that is not the canvas's own last write — an edit in a text editor on the same file, a change on disk that VS
Code loads into the document, an undo or redo — is **pushed into the canvas, which reloads the whole flow**. The
reload does not write anything back. After a reload:

- the nodes, edges, positions and data on screen are the new file's;
- **open node forms show the new values** (*A form always shows the node's current data*, above) — a value you wrote
  replaces what the form showed, including any unsaved typing in the fields you changed;
- if the new text is not a valid `.flow`, the canvas switches to the error state (next section); a valid text pushed
  in later draws the flow again;
- **breakpoints** stay keyed by node id: a node you gave a new id loses its breakpoint (it is dropped for good the next
  time the extension starts);
- if the person had **unsaved canvas changes**, your write and theirs collide in VS Code's document — see *Could not
  verify* below; do not rewrite a file the person is editing.

## What a hand-written `.flow` needs to open cleanly

The canvas checks the file's **shape** when it opens it and on every outside change. It fills nothing in and strips
nothing.

**A file that fails the check opens as an error state, not as a flow.** The screen shows the title "This .flow file
cannot be opened on the canvas", **every** reason as a list, and the line "Fix the file in the text editor (Reopen
Editor With… → Text Editor). Nothing here changes the file; the canvas opens it as soon as it is valid." No canvas is
drawn, so nothing can be edited, and nothing is written into the file (paste and F9 do nothing; Ctrl / Cmd + S, undo
and redo still reach VS Code — none of them writes the canvas into the file). When the text becomes valid (an edit in
the text editor, a rewrite on disk), the canvas draws it at once.

**Empty text** (or only whitespace) is not an error: it opens as a new, empty flow.

The reasons, word for word (node and edge numbers count from 1, in file order):

| The file has | The reason shown |
|---|---|
| text that is not JSON (a trailing comma, a comment) | `the file is not valid JSON: <the parser's message>` |
| a top level that is not an object | `the top level must be an object with "nodes" and "edges" lists` |
| no `nodes` list / no `edges` list | `"nodes" must be a list` / `"edges" must be a list` |
| a node that is not an object | `node #<n> is not an object` |
| a node without a non-empty string `id` | `node #<n> has no id` |
| a node id used twice in the file | `node #<n>: <id> — the node id is used twice in this file` |
| a node without a non-empty string `type` | `node #<n> (<id>) has no type` |
| a node without `position` `{ "x": <number>, "y": <number> }` | `node #<n> (<id>) has no position {"x": <number>, "y": <number>}` |
| a node without a `data` object | `node #<n> (<id>) has no "data" object` |
| an edge that is not an object | `edge #<n> is not an object` |
| an edge without a non-empty string `id` | `edge #<n> has no id` |
| an edge without a `source` and a `target` | `edge #<n> needs a "source" and a "target" node id` |

What a file that passes still needs, to look and behave right:

| Part | What the canvas does with it |
|---|---|
| `id` | Used as it is: the card's identity, the edges' ends, the breakpoint key. Not regenerated. Keep it `<type>_` + 12 letters / digits and unique in the project — the engine and the deploy depend on it (`../Flow/Nodes/SKILL.md`). |
| `type` | One of the 15 canvas types (`canvas-nodes.md`). Any other string passes the check but is drawn as a plain default box with no form. |
| `position` | Use multiples of 16 so the card lines up with the grid. |
| `data.labelNode`, `data.descriptionNode` | The card's head title and footer. Missing → an empty head / footer. Write the palette's texts (`canvas-nodes.md`). |
| `data.*` fields | The card body and each form read **specific keys** — put each value where that node's form reads it, or the card is blank and the form opens empty (e.g. the Start, End, Script, Assignment and Note forms read their Label from `data.label`, not `data.settings.label`). The key map per node is in `canvas-nodes.md`. |
| `data.open`, `openLLM`, `openPrompt` | Not read and not written: every panel opens closed. Ones already in a file are kept as they are. Leave them out of new files. |
| `dragHandle` | `".drag-handle__custom"` → the card drags by its head only. Missing → the card drags from anywhere on it (still saved without the key). |
| An edge | Its `source`, `target`, `sourceHandle`, `targetHandle` should exist. An edge to a missing node or a handle id the node does not have (wrong case, an engine key such as `next_2` on a Condition) passes the check but is **not drawn**; it is **kept** and written back on every save. An edge without `"type": "step"` is still drawn as a step line. |
| A form field's value | Loaded into the form as it is, even when the form would refuse it; only that form's next Save is refused until it is fixed. The limits and shapes per field are in `canvas-nodes.md`. |
| Unknown keys | Inside `data`: kept for ever. On the node object or the top level: dropped at the first canvas change. |

**Duplicate ids across files.** When a **new** `.flow` appears in the workspace (an Explorer copy, a `cp`, a file you
create) and any of its node ids already exists in another `src/**/*.flow`, the extension rewrites **all** its node ids
to fresh `<type>_<12 random>` ones, re-points its edges, gives every edge a new `edge_<12 random>` id, keeps every other
key, saves the file and shows "duplicate node ids regenerated" in the status bar. It does this only when a file is
created, never for a change to an existing file. Write fresh ids yourself; then nothing is rewritten under you.

## Breakpoints and the debugger's marks on the canvas

Only the canvas side; starting and driving the debugger is `debugging.md`.

- **F9** toggles a breakpoint on **every selected node** (not while typing in a field). The canvas sends it to the
  extension, which keeps it in VS Code's workspace state keyed by the `.flow` file's **base name** and the node id,
  with the node's label (else its palette name) as the name shown in the Breakpoints view. Breakpoints are **never
  written into the `.flow`**.
- A node with a breakpoint shows a **soft green halo** behind its card. F9 works on any node, including a Note or a
  Flow Pointer, which never run, so a breakpoint there is never hit.
- Deleting a node on the canvas removes its breakpoint. Clicking a breakpoint in the Breakpoints view opens its file
  and selects and centres the node.
- **The paused node.** While a debug session is paused, the extension opens that node's file (without taking the
  keyboard focus), selects and centres the node, and the card gets a **green outline with a blinking bug** in it. Only
  one node is marked at a time; the mark clears on resume, step or session end.

## Theme and view settings

- **Theme:** the setting `flowBuilder.theme` (`dark`, the default, or `light`) — the canvas follows it on open, on tab
  switch and whenever it changes. The **Toggle Theme** command (in the Shira Flow Builder sidebar view's title bar)
  flips it. The canvas itself has no theme button.
- **View settings per flow:** whether the palette is open and the pan / zoom are saved in VS Code's workspace state,
  keyed by the `.flow` **base name**, and restored on open and on tab switch. They follow a rename or delete done in
  VS Code. They are never in the `.flow`.
- Base-name keys mean two flows with the same file name in different folders share breakpoints and view settings,
  and a breakpoint or reveal opens the first file of that name the workspace search finds.

## Mistakes that break it

| Mistake | What happens | Do instead |
|---|---|---|
| Rewriting a `.flow` the person has open and is editing | their unsaved canvas edits and your write collide in VS Code's document; open forms switch to your values and drop what they were typing in those fields | rewrite only closed or saved, untouched files |
| Writing invalid JSON (comment, trailing comma), or a node without `type` / `position` / `data` | the canvas shows the error state with the reasons; the person cannot use the canvas until the file is fixed | `JSON.parse` your output and give every node `id`, `type`, `position`, `data` before writing |
| Extra top-level keys or extra keys on a node object | silently dropped on the first canvas change | keep top level `nodes` / `edges`; put node extras inside `data` (only if the engine reads them there) |
| An edge whose handle id is not the node's canvas id (`next_1` on a Start, `next_2` on a Condition, `In` for `in`) | the edge is invisible on the canvas but stays in the file | the canvas ids in `canvas-nodes.md` |
| Two edges from one output, two into a single-input `in`, Summary into a non-Summarizer | loaded and kept; a person could never draw it, and the run or deploy does not do what you meant | the rules in *Connecting* |
| A value in a key the form does not read (e.g. a Start label only in `settings.label`) | the card is blank and the form opens empty; a Save then writes the empty value | the key map in `canvas-nodes.md` |
| Changing a node's id in a rewrite | its breakpoint is lost | keep ids stable |
| Copying a node's id into a new file | the extension renumbers the whole new file | fresh 12-character ids |
| An LLM / Summarizer dropped but its model menu never saved | no `settings.llm` in the file; the menu says "No model saved yet" and the model it shows is not in the file | write `settings.llm` (see `canvas-nodes.md`) |

## Example — building a small flow on the canvas

A support flow `Orders.flow`: Start → a Script `lookupOrder.js` that reads the order from the fictional `shopApi`
service → an LLM that answers → End Flow, with the Script's Error and the LLM's Fallback also going to the End.

1. Create `Orders.flow` (Create Flow, `project.md`); it opens empty. Click **Show palette**.
2. Drag **Start Flow** onto the canvas. Click its sliders icon, type Label `Start`, **Save**, click the icon again to
   close the panel.
3. Drag **Script** below it. Open its Settings: Label `Lookup order`, Script path `lookupOrder.js`, **Add Pair** →
   Key `orderId`, Value `${session.orderId}`. **Save**, close.
4. Drag **LLM** below the Script.
   - **General settings:** Agent Name `Order Assistant`, Agent ID `order-assistant`, **Save**.
   - **LLM settings:** Company `anthropic`, Model `claude-sonnet-4-6` (Temperature 0.8, Max Tokens 8192, Effort
     high), leave Interact with DB and Use tools on, **Save**.
   - **Prompt settings:** **Add Turn** (it is the System turn), type the instructions, **Save**, close.
5. Drag **End Flow** at the bottom.
6. Draw the edges: Start **out** → Script **In**; Script **Out** → LLM **In**; Script **Error** → End **in**;
   LLM **Out** → End **in**; LLM **Fallback** → End **in** (End's `in` takes many).
7. **Ctrl + S**.

The file (ids and the prompt id are illustrative; key order may differ):

```json
{
  "nodes": [
    {
      "id": "startNode_Qm4TzR8bWx2L",
      "type": "startNode",
      "position": { "x": 320, "y": 96 },
      "data": {
        "label": "Start",
        "description": "",
        "labelNode": "Start Flow",
        "descriptionNode": "Flow entry point",
        "settings": { "value": "Start", "label": "Start" }
      },
      "dragHandle": ".drag-handle__custom"
    },
    {
      "id": "scriptNode_Hk7PvN3cYd9F",
      "type": "scriptNode",
      "position": { "x": 320, "y": 400 },
      "data": {
        "label": "Lookup order",
        "description": "",
        "labelNode": "Script",
        "descriptionNode": "Execute custom JS script",
        "settings": {
          "value": "lookupOrder.js",
          "label": "Lookup order",
          "keyValuePairs": [{ "key": "orderId", "value": "${session.orderId}" }]
        }
      },
      "dragHandle": ".drag-handle__custom"
    },
    {
      "id": "agentNode_Rt5WqZ2mLs8J",
      "type": "agentNode",
      "position": { "x": 320, "y": 704 },
      "data": {
        "label": "",
        "labelNode": "LLM",
        "descriptionNode": "Use LLM processor",
        "description": "",
        "settings": {
          "sessionId": "",
          "requestId": "",
          "agentId": "order-assistant",
          "agentName": "Order Assistant",
          "llm": {
            "company": "anthropic",
            "model": "claude-sonnet-4-6",
            "modelId": 4938,
            "parameters": { "temperature": 0.8, "maxTokens": 8192, "effort": 2 }
          },
          "specialRules": [],
          "prompts": [
            {
              "id": "3f6c1e2a-8b4d-4c7e-9a51-2d0f6b7e8c93",
              "role": "system",
              "content": "You are the order assistant. The order status is ${dictionary.orderStatus}. Answer briefly."
            }
          ]
        }
      },
      "dragHandle": ".drag-handle__custom"
    },
    {
      "id": "endNode_Bn6XyK4pVf1D",
      "type": "endNode",
      "position": { "x": 320, "y": 1008 },
      "data": { "label": "", "labelNode": "End Flow", "descriptionNode": "Flow terminal" },
      "dragHandle": ".drag-handle__custom"
    }
  ],
  "edges": [
    { "type": "step", "source": "startNode_Qm4TzR8bWx2L", "sourceHandle": "next", "target": "scriptNode_Hk7PvN3cYd9F", "targetHandle": "in", "id": "xy-edge__startNode_Qm4TzR8bWx2Lnext-scriptNode_Hk7PvN3cYd9Fin" },
    { "type": "step", "source": "scriptNode_Hk7PvN3cYd9F", "sourceHandle": "next_1", "target": "agentNode_Rt5WqZ2mLs8J", "targetHandle": "in", "id": "xy-edge__scriptNode_Hk7PvN3cYd9Fnext_1-agentNode_Rt5WqZ2mLs8Jin" },
    { "type": "step", "source": "scriptNode_Hk7PvN3cYd9F", "sourceHandle": "error", "target": "endNode_Bn6XyK4pVf1D", "targetHandle": "in", "id": "xy-edge__scriptNode_Hk7PvN3cYd9Ferror-endNode_Bn6XyK4pVf1Din" },
    { "type": "step", "source": "agentNode_Rt5WqZ2mLs8J", "sourceHandle": "next_1", "target": "endNode_Bn6XyK4pVf1D", "targetHandle": "in", "id": "xy-edge__agentNode_Rt5WqZ2mLs8Jnext_1-endNode_Bn6XyK4pVf1Din" },
    { "type": "step", "source": "agentNode_Rt5WqZ2mLs8J", "sourceHandle": "error", "target": "endNode_Bn6XyK4pVf1D", "targetHandle": "in", "id": "xy-edge__agentNode_Rt5WqZ2mLs8Jerror-endNode_Bn6XyK4pVf1Din" }
  ]
}
```

What the example shows:

- `effort: 2` is the **index** of `high` in that model's options (`low`, `medium`, `high`); `top_p` is absent because
  this model's Temperature and Top p are a "select one" pair.
- The LLM keeps the `"description": ""` its General settings saved: the LLM settings and Prompt settings Saves
  write only `settings.llm` / `settings.specialRules` and `settings.prompts`. No node has an `open` key — opening and
  closing the panels wrote nothing. The End Flow, never opened, has no `settings`.
- Entry for the agent: Start Flow `Orders`, Start Node `Start` (`../Flow/Nodes/StartFlow/start-flow-skill.md`). Run
  `keen-validate` before deploying.

## Could not verify

- What VS Code does when the `.flow` changes on disk while the document has **unsaved** canvas changes (VS Code's own
  dirty-file conflict handling; not in the extension's code), and whether `files.autoSave` saves canvas changes.
- The exact key order of a newly drawn edge object.
