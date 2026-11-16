# Script tool

A **script tool** is one JavaScript file under `src/scripts/tools/` that an LLM node runs by writing a
`<SYSTEM CALL>` block. The tool reads the call, does the work (computes, reads Json Settings, calls an API with a
key from Secrets), and **files one user message** for the agent that called it. That message is the only thing
the model reads back. Then the same LLM node runs again and answers.

Read first: the call protocol in [`tool-calling.md`](../../Nodes/LLM/references/tool-calling.md), the LLM node in
[`llm-skill.md`](../../Nodes/LLM/llm-skill.md), the script sandbox in
[`script-skill.md`](../../Nodes/Script/script-skill.md) and the `system/*` modules in
[`system-modules.md`](../../Nodes/Script/references/system-modules.md). The file rules are in
[`keen-tools.md`](../../../ProjectStructure/src/keen-tools.md),
[`tools.md`](../../../ProjectStructure/src/scripts/tools/tools.md),
[`name-tool.md`](../../../ProjectStructure/src/scripts/tools/name-tool.md) and
[`services/`](../../../ProjectStructure/src/scripts/services/services.md). Complete examples:
[`references/examples.md`](references/examples.md).

## 1.1 How it is defined in `keen-tools.json`

One object per tool in `src/keen-tools.json`:

```json
{ "tools": [ { "name": "Days Until", "type": "script", "entry": "tools/daysUntilTool.js" } ] }
```

| Field | Rule |
|---|---|
| `name` | what the model writes after `!*tool`, exactly (case-sensitive). Unique in the file |
| `type` | `"script"` |
| `entry` | the file's path **relative to `src/scripts/`**: starts with `tools/`, no `..`, ends in `.js`, the file exists. Subfolders are fine (`tools/billing/chargeTool.js`) |

There are no other fields. A `description`, `parameters` or `schema` you add is not checked, not used and not
shown to the model; it only travels to the running tool inside `toolOptions.toolContext.projectTool`. The engine
reads the registry from the **deployed** project, so every change needs `keen-validate` → `keen-deploy`. Full rules:
[`keen-tools.md`](../../../ProjectStructure/src/keen-tools.md).

## 1.2 How the agent (the LLM node) calls it

The model writes one block in its answer:

```
<SYSTEM CALL>
!*action
use tool
!*tool
Days Until
!*context
2026-12-24
</SYSTEM CALL>
```

- The node must have **Use tools** on (no `skip-internal-tooling` rule). The block needs both markers, the closer
  after the opener; a block cut at Max Tokens is plain text and nothing runs.
- Each field is `!*<word>` followed by whitespace; its value is the trimmed text up to the next `!*<word>` + whitespace
  or the closer. So a value must not itself contain `!*word ` or `</SYSTEM CALL>`. A field repeated twice: the last wins.
- Only `!*tool` routes. `!*action` decides nothing. `!*context` and any other `!*<key>` (`!*limit 5`) reach the
  tool as **strings**.
- Text around the block is allowed. **Only the first block** of an answer runs.
- The tool runs as a separate sub-run; the calling LLM node waits until it has finished.

Details and the loop: [`tool-calling.md`](../../Nodes/LLM/references/tool-calling.md) §2–§3.

## 1.3 How it returns its result

The `return` value of `exec` **never reaches the model**. The tool must file a user message for the caller with
`system/agent`:

```js
Agent.setRootAgentPrompt(toolOptions.toolContext.agentId, {
    prompt: text,                                            // a non-empty string
    sessionID: toolOptions.agentNode.flowContext.sessionId,  // the CALLER's session
    requestID: Tools.generateUUID()                          // a fresh id
});
```

- **Answer whoever called.** The agent id is `toolOptions.toolContext.agentId` and the session is
  `toolOptions.agentNode.flowContext.sessionId`. Both describe the LLM node that wrote this call — the top agent,
  or an **inner agent** (an LLM node inside a flow tool) that calls the same script tool. A new call always brings
  a new `toolOptions`, so a tool written this way works for both. Never write an agent id as a literal: when a
  sub-agent calls the tool, the reply goes to the wrong agent and the sub-agent reads `No tool response`. Chaining
  tools and sub-agents: [`flow-tool-skill.md`](../FlowTool/flow-tool-skill.md).
- The write keys are `sessionID` and `requestID` (capital `ID`). The bare `flowContext.sessionId` inside a tool is
  the tool's **own** session — a reply stamped with it is not found.
- `requestID`: a fresh `Tools.generateUUID()`. keen-validate refuses `toolOptions.agentNode.flowContext.requestId`.
- File **one** reply, then return normally with small plain data (`{ ok: true }`). The reply is written only when
  `exec` returns: a throw drops it.
- The engine then runs the same LLM node again. If a new user message for that agent arrived since the call, it is
  the newest user turn; if not, the engine files `No tool response` and the model answers that.

## 1.4 The structure of a `<name>Tool.js` file

- Path `src/scripts/tools/<name>Tool.js`, camelCase, letters and digits only; a service's tool is
  `<service><Action>Tool.js` (`docStoreSearchTool.js`). The VS Code
  extension refuses `_`, `-`, a space or a dot in a script file name and disables Upload.
- An ES module with a **named** `exec`: `export const exec = async () => { … }` (or `export async function exec()`).
  `export default` fails.
- Imports: only the ten `system/*` modules and the project's own files by exact relative path with `.js`
  (`'../services/docStore/service.js'`).

The body always has the same steps, after `const call = toolOptions.toolContext;` and a `reply(…)` helper (§1.3):

1. **The switch** (a tool that fronts a service): the agent's Json Settings say whether the service is on
   (`Settings.getMany('doc_store_available', …)`); anything but `true` → reply "not available", return.
2. **Parse and check the input** (`call.options.context` is text). Bad input → reply what is wrong and what to
   send, then return. The model reads it and calls again.
3. **The credentials**: the Secret (`system/secrets`) — and the person's cookie (`system/cookies`) when the API
   acts as the person. A missing Secret → a reply that says the agent is not set up.
4. **Do the work** — inline for a few lines, else `<Name>Service.connect(credentials, options)` and ONE
   instrument (§1.5). Wrap it in `try` / `catch`.
5. **Reply once** with the result or the failure in words, then `return { ok }`.

A tool file is never a Script node's file: outside a tool there is no `toolOptions` global, and the node fails with
`ReferenceError: toolOptions is not defined`.

## 1.5 The structure of its service under `services/` (when one is needed)

Use a service whenever the tool talks to an external API (even with one action today), or when the work is more
than a few lines. House standard (not checked by a tool yet; how to build one: `../../../Services/SKILL.md`):

```
src/scripts/tools/docStoreSearchTool.js      ← one thin tool per instrument: switch, input, Secret, connect, one instrument, reply
src/scripts/tools/docStoreReadTool.js
src/scripts/services/docStore/service.js     ← connect(credentials, options) + the instruments; the ONLY file a tool imports
src/scripts/services/docStore/connector.js   ← createConnection(credentials, options) — the authenticated client; only service.js calls it
src/scripts/services/docStore/utils.js       ← pure helpers: serviceError(message, retryable), describeStatus, cleanText …
src/scripts/services/docStore/settings.js    ← constants: BASE_URL, paths, limits — never a key
.claude/skills/doc-store-service/SKILL.md    ← the service's skill — recommended, outside src/ (never uploaded)
```

- The tool imports only `service.js`: `import * as DocStoreService from '../services/docStore/service.js';`, then
  `DocStoreService.connect({ apiKey }, { baseUrl })` returns the instruments (`docStore.search({ … })`). A constant
  the tool needs is re-exported by `service.js`.
- Only the tool imports `system/secrets`, `system/settings` and `system/cookies`; it passes the values into
  `connect`. Json Settings hold plain values only, snake_case keys: the switch `doc_store_available` and display or
  address values.
- One instrument per action, one tool per instrument — never one tool with an `"action"` switch.
- An instrument returns a small plain object with only the fields the model needs, and throws
  `serviceError(message, retryable)` in words the model can repeat.
- One service never imports another. No module-level state: every run is a fresh sandbox.
- Give every service its skill (recommended, not mandatory) at `.claude/skills/<service-in-kebab>-service/SKILL.md`
  (`../../../Services/service-skill-template.md`).

The files one by one: [`service.md`](../../../ProjectStructure/src/scripts/services/service.md),
[`connector.md`](../../../ProjectStructure/src/scripts/services/connector.md),
[`utils.md`](../../../ProjectStructure/src/scripts/services/utils.md),
[`settings.md`](../../../ProjectStructure/src/scripts/services/settings.md). A full set:
[`references/examples.md`](references/examples.md) §2.

## 1.6 When and for what it is the best choice (vs a Flow Tool)

Choose a **script tool** when the work is one function: call an API, look something up, compute, reshape data,
read the agent's Json Settings. It is one file, one session to stamp, and the script debugger steps through it.

Choose a **flow tool** ([`flow-tool-skill.md`](../FlowTool/flow-tool-skill.md)) when the work needs the
graph: an inner LLM that judges or writes, branches, a Loop or parallel work over a list, several steps that
each may fail on their own edge.

Choose **neither** when the step must happen every turn whatever the model decides: put a Script node in the flow
before the LLM and pass the result in the prompt with `${dictionary.x}`. A tool runs only when the model asks.

Start with a script tool; move to a flow tool only when you need a second model or a structure one file cannot hold.

## 1.7 The shared objects — what a tool can read and write, and what reaches the model

| Object | In a script tool | Read / write | Reaches the model? |
|---|---|---|---|
| `props` (the `exec` argument) | always `{}` — a tool has no Key/Value Pairs | — | no |
| `toolOptions.toolContext.options` | the parsed call: `action`, `tool`, `context`, any other `!*<key>`; every value a string | read | it is what the model wrote |
| `toolOptions.toolContext.agentId` | the calling LLM node's agent id — reply to it | read | — |
| `toolOptions.toolContext.prompt` | the model's whole answer that held the block | read | — |
| `toolOptions.toolContext.path`, `.projectTool` | this file's `entry` and its whole `keen-tools.json` object | read | — |
| `toolOptions.agentNode.flowContext.sessionId` | the calling LLM node's session — stamp the reply with it | read | — |
| `dictionary` (bare global) | the **calling agent's** dictionary: the shared one of the run, a Parallel Flows branch's own (private) one, or a Parallel Context clone's — whichever the caller works on | read + write; committed only on a clean return | only through `${dictionary.x}` in that LLM node's prompts, which are resolved again on every round |
| other flows' dictionaries | `system/dictionary` `get({ flowID, path })` | read only | no |
| the session (`system/session`) | the run's one flat store, shared by every flow of the run; primitive values only | read + write; kept even when the tool throws | only through `${session.key}` in a prompt |
| the conversation (`system/agent`) | prompts and answers per agent / channel; the reply is one entry | read + queued writes | the reply is the next user turn |
| Json Settings (`system/settings`) | the chat agent's configuration — the same set when a sub-agent calls the tool | read | no |
| Secrets (`system/secrets`) | the chat agent's Secrets, fetched because the tool imports the module | read | never in clear: shown as `••••` |
| Cookies (`system/cookies`) | the cookies the person's site sent with this message | read | no (not masked — never echo one) |
| `flowContext` (bare global) | the tool's **own** run ids — not the caller's | read | no |
| interim chat lines (`system/chat`) | `Chat.writeOut('Searching…')` — the person sees them at once | write | no |
| Log Record (`system/log`) | `Log.info(…)` lines for the admin | write | no |
| the `return` value | ends the tool | — | no |

What the model gets, in short: the **reply text**, and whatever its prompts pull in with `${dictionary.*}` /
`${session.*}`. During the tool loop it also sees the earlier tool turns of the same exchange. The reply is stored
in the chat history like any turn, so treat it as part of the record. Nothing in the dictionary or session lives
beyond the current run; the next chat message starts both empty. Module details:
[`system/`](../../Nodes/Script/references/system-modules.md).

## 1.8 The tool's description in the system prompt, and naming

The model **never sees `keen-tools.json`**. The engine adds no tool list, no format and no schema: the LLM node's
own prompts are the whole conversation it sends before the history. So write in the **system prompt** of every
LLM node that may call the tool:

1. the call format (once) — copy the section in [`references/examples.md`](references/examples.md);
2. one entry per tool: its `name` exactly as in `keen-tools.json`, what it does and **when** to use it, the exact
   `!*context` shape with an example, and what the reply looks like;
3. when to stop: the engine sets no limit on rounds ("call a tool at most 3 times for one question").

```md
1. Days Until
Description: counts the days from today (UTC) to a date. Use it whenever the person asks how many days are left until a date.
Usage: !*context is one date, YYYY-MM-DD, e.g. 2026-12-24.
```

Naming (house standard): the registry `name` in words, Title Case (`Document Search`), the same words in the prompt;
the file `<service><Action>Tool.js` in camelCase, one per instrument (`docStoreSearchTool.js`); the service folder the
same camelCase word (`docStore`); Json Settings keys snake_case (`doc_store_available`). Prompt
`content` takes `${dictionary.*}` / `${session.*}`, so a tool list can come from the dictionary.

## 1.9 Errors — what the model sees, what the person sees

No tool error ever takes the LLM node's Fallback. In every row below the engine files the text as the next user
message and runs the same LLM node again.

| What happened | The model reads | The agent's Log Record |
|---|---|---|
| the block has no `!*<word>` field | `Could not parse the SYSTEM CALL block.` | — |
| `!*tool` names no registered tool | `The requested tool does not exist.` | — |
| `entry` not under `tools/` or with `..` | `No tool response` | — (or `virtualScriptNode rejected — tool path must live under "scripts/tools/" …`) |
| the file is missing, does not load, or has no named `exec` | `No tool response` | `Script "tools/<file>" failed: …` |
| the tool threw | `No tool response` (the dictionary changes and the reply are dropped; the session is kept) | `Script "tools/<file>" failed: <message>` |
| the tool returned without a reply, or stamped the wrong session | `No tool response` | — |
| the tool replied | the reply text | the tool's own `Log` lines |

`No tool response` tells the model nothing, so **catch every failure and reply in words**: bad input → what to
send instead; a missing Secret / setting → "not set up, tell the person"; a refused key, an outage, a timeout →
what failed and whether a retry may help (`{"ok": false, "retryable": true, "error": "…"}`).

Two failures end the whole run instead, with no reply and no retry by the model: the 15-minute time limit (the
run ends with `E8101 Script time limit reached!`) and a cancel by the person.

The person sees the model's final text answer, plus any interim `system/chat` line the tool wrote. The block itself
streams to the chat client like any answer text. Error texts go to the Log Record only.

## 1.10 Limits

| What | Limit | When crossed |
|---|---|---|
| Time for one tool run | **15 minutes** (queue wait not counted) | the run ends with `E8101`; nothing of the tool is written |
| The tool's memory (code, variables, data) | **30 MB** | the tool fails → `No tool response` |
| Data coming **in** (one HTTP body, one `system/agent` / `system/dictionary` read) | **10 MB** buffer | that call throws `E_SAB_OVERFLOW` — catchable |
| HTTP calls | one at a time (`Promise.all` throws `E_SAB_BUSY`), **15 s** each with redirects, at most **3** redirects, public hosts only (`E_HTTP_SSRF`) | the call throws — catchable |
| The reply | a non-empty string; at most **8 MB** after masking (also the sum of all agent writes of one run) | the tool fails → `No tool response` |
| The calling agent's dictionary / the session after the tool | **1.5 MB** each; session values primitive only | the tool fails → `No tool response` |
| Imports | **256** modules in the graph | — |
| Calls | one tool per answer (the first block); **no limit** on rounds | — say the limit in the prompt |
| Tools in the registry | no limit | — |

Every reply is read by the model on every following round of the exchange, so keep it to the few fields the model
needs (a page of results, short snippets) — far below the 8 MB cap. Details:
[`script-skill.md`](../../Nodes/Script/script-skill.md) → Limits, [`http.md`](../../Nodes/Script/references/system/http.md).

## 1.11 Secrets and security

- **Only the tool reads Secrets** (`Secrets.get('DOCSTORE_KEY')`), on every run, and hands the value to
  `DocStoreService.connect({ apiKey }, options)`. A service file never imports `system/secrets`. Plain configuration (a URL, a shelf) is a Json Setting; a
  constant default is in the service's `settings.js`; a key is never in code, in Json Settings or in a prompt.
- A tool whose import graph imports `system/secrets` gets the chat agent's current Secrets for this run only. If
  they cannot be read, the tool does not start (`The agent's secrets could not be read.` in the Log Record) and the
  model reads `No tool response`.
- **Masking**: every Secret value (8 bytes or more) is replaced with `••••` in the reply, the dictionary, the session,
  log lines, chat lines and error texts. The HTTP request itself carries the real value. A cookie or a token the tool
  got any other way is **not** masked.
- **Never put a secret into the answer** — masked or not. Reply with what the person needs, not with keys, headers,
  raw service answers or URLs that carry a token.
- The model's input is untrusted: check and clamp every field, `encodeURIComponent` every path part, and never let
  the model choose the host a key is sent to.
- A person's own OAuth token is not an agent Secret — see
  [`connector.md`](../../../ProjectStructure/src/scripts/services/connector.md) → OAuth, and
  [`access.md`](../../../Services/access.md) §6.

## 1.12 How to test it

1. `keen-validate <project-dir>` after every change (exit 0 = no errors). For tools it checks the registry (the file
   shape, unique names, `type`, an `entry` under `tools/` that exists) and lints each registered file as a tool,
   marked `(tool)`: a named `exec`; imports; a reply without `sessionID` or with `sessionId:` (errors); a `requestID`
   equal to the caller's request id (error); a reply stamped with the bare `flowContext.sessionId` (warning); a tool
   that never reads `toolOptions.toolContext` or an `agentId` (warnings).
2. `keen-deploy`, then set the Secrets and Json Settings the tool needs on the agent in the console.
3. A test chat with the runner (`npx tsx run.ts --prompt "…"`, one stable `--chat-id`). Ask something that needs the
   tool, then something that should not call it, then bad input ("how many days until the 45th of May").
4. Read the trace: the `<SYSTEM CALL>` block streams like answer text; the final answer should use the reply. A
   final answer about "no tool response" means the reply was not found — check the session stamp first. Read the
   agent's Log Record for `Script "tools/…" failed: …`.

## 1.13 Mistakes that break it

| Mistake | What happens | Write instead |
|---|---|---|
| `return { result }` and no reply | the model reads `No tool response` | `Agent.setRootAgentPrompt(…)`, then return |
| `Agent.setRootAgentPrompt('support-agent', …)` — a hard-coded agent id | when a sub-agent calls the tool, the answer goes to the wrong agent; the caller reads `No tool response` | `toolOptions.toolContext.agentId` |
| `sessionID: flowContext.sessionId` | the tool's own session; the reply is not found → `No tool response` (keen-validate warns) | `toolOptions.agentNode.flowContext.sessionId` |
| `sessionId:` (lowercase) | keen-validate error; the stamp is missing | `sessionID:` |
| `requestID: toolOptions.agentNode.flowContext.requestId` | keen-validate error | `Tools.generateUUID()` |
| `throw new Error('API down')` | the model only reads `No tool response` | catch it, reply `Document Search failed: …` |
| a reply, then a throw | the reply is dropped | throw nothing after the reply |
| `props.query` | `undefined`; `props` is `{}` | parse `toolOptions.toolContext.options.context` |
| `JSON.parse(call.options.context)` without `try` | a model typo throws → `No tool response` | parse in `try`, reply the right shape |
| `"entry": "scripts/tools/docStoreSearchTool.js"` | keen-validate error; at run time `No tool response` | `"tools/docStoreSearchTool.js"` |
| the tool imports `connector.js` or `settings.js` | works, but breaks the house standard (the connection is assembled in two places) | import only `service.js`; `connect` builds the connection |
| one tool with `{"action": "search" \| "read"}` | the model mixes the inputs of two actions | one tool per instrument |
| `"name": "doc search"`, prompt says `Document Search` | `The requested tool does not exist.` | one spelling in both places |
| `"description"` in `keen-tools.json`, nothing in the prompt | the model does not know the tool | describe it in the system prompt |
| a Script node pointing at the tool file | `ReferenceError: toolOptions is not defined` | a separate node script |
| an API key in `services/<x>/settings.js` | deployed in clear, never masked | an agent Secret, read in the tool |
| the service's whole answer as the reply | tokens wasted every round; noise for the model | map to the few fields needed |
| `await Promise.all([...Http calls])` | `E_SAB_BUSY` | `await` one call after the other |
| `doc_store_search_tool.js` / `doc-store-search-tool.js` | the VS Code extension disables Upload | `docStoreSearchTool.js` |
| `export default async function exec` | keen-validate error; at run time `No tool response` | a named `exec` |
| changed the tool, did not deploy | the engine runs the old version | `keen-validate` → `keen-deploy` |

## 1.14 Examples

[`references/examples.md`](references/examples.md) holds three complete examples (four tools), each with its
`keen-tools.json` entry, the tool file, the service files and the system-prompt lines; all pass `keen-validate`:

1. **Days Until** — a minimal tool with no service: parses a date, replies in one sentence.
2. **Document Search** + **Document Read** — two thin tools over the fictional `docStore` service (the four
   files): the switch, address and shelf from Json Settings, the API key from Secrets, an interim chat line, one
   instrument per tool, every failure as a reply.
3. **Store Hours** — a tool that answers from the agent's Json Settings and writes to the calling agent's dictionary.
