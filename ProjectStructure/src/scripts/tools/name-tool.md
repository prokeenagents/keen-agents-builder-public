# `src/scripts/tools/<name>Tool.js`

## Description

One **script tool**: the file the platform runs when an LLM node writes a `<SYSTEM CALL>` naming this tool. It
reads the call, does the work, and **files a user message** for the calling agent — that message is the only
thing the model reads back.

Who reads it:

- **keen-validate** lints it as a tool (the `exec` export, the imports, the reply's session stamp).
- **The deploy service** scans it like every script.
- **The llms-engine** starts it: the entry in `src/keen-tools.json` whose `name` the model wrote, `"type": "script"`,
  `"entry": "tools/<name>Tool.js"`.
- **The script-engine** runs `exec` in a fresh sandbox, on the calling agent's flow dictionary.

## Location and name

- `src/scripts/tools/<name>Tool.js`, or deeper (`tools/billing/chargeTool.js`). One file per tool.
- The platform needs only: under `tools/`, ends in `.js`, and the exact path in a `keen-tools.json` entry.
- Name: camelCase `<service><Action>Tool.js`, one per service instrument (`docStoreSearchTool.js`,
  `docStoreReadTool.js`); a service with a single action may be `<service>Tool.js` (`webSearchTool.js`). The VS Code extension refuses any
  script file name (without `.js`) that is not `^[A-Za-z][A-Za-z0-9]*$`, as an error that disables Connect and
  Upload: `Script file names must start with a letter and contain only letters and numbers (e.g. myScript.js).` keen-validate, the deploy and the engines do not check it.
- House standard (not checked by any tool yet): the tool's `name` in `keen-tools.json` and in the system prompt says the same thing in
  words (`Web Search`).

## Structure

The file is an ES module with a **named** export `exec` (`export async function exec()` or
`export const exec = async () => …`). It may import the ten `system/*` modules and its own relative files.

What `exec` receives:

| Input | What it holds |
|---|---|
| `props` (the argument) | always `{}` — a tool has no Key/Value Pairs |
| `toolOptions.toolContext.options` | the parsed call: `action`, `tool`, `context` (the `!*context` text, trimmed) and any other `!*<key>` the model wrote; every value a **string** |
| `toolOptions.toolContext.agentId` | the calling agent — the one to reply to |
| `toolOptions.toolContext.prompt` | the model's whole answer that held the call |
| `toolOptions.toolContext.path`, `projectTool` | this file's entry and its whole `keen-tools.json` object |
| `toolOptions.agentNode.flowContext.sessionId` | the calling agent's session — stamp the reply with it |
| `dictionary` | the calling agent's flow dictionary (read and write) |
| `flowContext` | the tool's **own** run ids — `flowContext.sessionId` is not the caller's |

What it must do:

1. **Validate the input.** `!*context` is text; parse it yourself. On bad input, reply with what is wrong and what
   to send, then return — the model reads it and calls again.
2. **File exactly one reply** with `Agent.setRootAgentPrompt(agentId, { prompt, sessionID, requestID })`: `prompt` a
   non-empty string, `sessionID` = `toolOptions.agentNode.flowContext.sessionId`, `requestID` = a fresh
   `Tools.generateUUID()` (never the caller's request id).
3. **Return normally** with plain data. The reply is written only when `exec` returns: a throw drops it.

What the model sees:

| The tool… | The model's next user turn |
|---|---|
| filed a reply and returned | the reply text (a Secret's value in it shows as `••••`) |
| returned without a reply | `No tool response` |
| threw (or the file failed to load) | `No tool response`; the Log Record gets `Script "tools/<file>" failed: <message>`; dictionary and reply dropped, session kept |
| ran past 15 minutes | the run ends with `E8101 Script time limit reached!` |

The **return value never reaches the model**, but it travels to the person's browser in the node's reply (only
the agent's Secrets are masked) — keep it small and harmless (`{ ok: true }`). So catch every failure you can
and turn it into a reply in plain words.

**House standard — a thin entry point** (not checked by any tool yet):

- The tool keeps **no business logic**. In order: the Json Settings switch (`web_search_available` — anything but
  `true` → reply "not available"), the input, the Secret (`system/secrets`) — and the person's cookie
  (`system/cookies`) when the API acts as the person —, then `<Name>Service.connect(credentials, options)` and ONE
  instrument, and the result or the error as the reply.
- The service lives in `src/scripts/services/<service>/`: `service.js` (`connect` + the instruments),
  `connector.js` (`createConnection` — the authenticated client, called only by `service.js`), `utils.js`,
  `settings.js` (code constants — deployed and visible, never a secret).
- Only the tool reads Secrets, Json Settings and cookies:
  `WebSearchService.connect({ apiKey: Secrets.get('WEBSEARCH_KEY') }, { maxResults })`. Read them in the tool on every
  run; a value never passes to a later node. Json Settings keys are snake_case and hold plain values only.
- The tool imports **only** `service.js`, relative with `.js`:
  `import * as WebSearchService from '../services/webSearch/service.js';`. A constant the tool needs is re-exported
  by `service.js`.
- One tool per instrument; the service's skill (`.claude/skills/<service-in-kebab>-service/SKILL.md`) lists every
  tool. How to build a service: `../../../../Services/SKILL.md`.

## Rules and validation

- keen-validate on the file: every rule of `../scripts.md`, and as a tool — `… reply has no \`sessionID\` …`
  (error), `… uses \`sessionId:\` (lowercase) — the write key is \`sessionID\` …` (error),
  `… stamps \`requestID\` with the CALLER's request id …` (error), `… payload has no \`prompt\` …` (warning),
  `… stamps \`sessionID: flowContext.sessionId\` — for a script TOOL that is the tool's OWN session …` (warning),
  `script tool replies but never references \`toolOptions.toolContext\` …` / `… never reads an \`agentId\` …`
  (warnings), `no exported \`exec\` …` (error).
- keen-validate on `keen-tools.json`: the entry must start with `tools/`, have no `..`, and exist
  (`../../keen-tools.md`).
- At run time a missing `exec`: `Script "tools/<file>" does not export an async \`exec\` function (got: undefined)`
  in the Log Record; the agent reads `No tool response`.

## Limits

30 MB memory, a 10 MB buffer for data coming in, 15 minutes per run, 15 s per HTTP call, 256 modules in the
import graph — as every script (`../scripts.md`). The reply: a non-empty string, at most 8 MB.

## Mistakes that break it

| Mistake | What happens | Write instead |
|---|---|---|
| `return { result }` and no reply | the model reads `No tool response` | `Agent.setRootAgentPrompt(…)`, then return |
| `sessionID: flowContext.sessionId` | the agent does not find the reply → `No tool response` | `toolOptions.agentNode.flowContext.sessionId` |
| `sessionId:` (lowercase) | the key is dropped → `No tool response` | `sessionID:` |
| `requestID: toolOptions.agentNode.flowContext.requestId` | read as "no reply" → `No tool response` | `Tools.generateUUID()` |
| `throw new Error('API down')` | the model only reads `No tool response` | catch it and reply `Web Search failed: API down` |
| reply filed, then a throw | the reply is dropped | throw nothing after the reply |
| `props.query` | `undefined`; `props` is `{}` | parse `toolOptions.toolContext.options.context` |
| the HTTP calls and paging inside the tool | works; breaks the house standard, nothing can reuse it | move them into `services/<service>/service.js` |
| an API key in `services/webSearch/settings.js` | deployed in clear, visible to anyone with the project | an agent Secret, read in the tool |
| `import { createConnection } from '../services/webSearch/connector.js'` in the tool | works; breaks the house standard (the connection is assembled in two places) | `import * as WebSearchService from '../services/webSearch/service.js'` |
| `web_search_tool.js`, `web-search-tool.js` | the VS Code extension shows an error and disables Upload | `webSearchTool.js` |
| `export default async function exec` | keen-validate error; at run time `No tool response` | a named `exec` |

## Example

> `docStore` and `webSearch` are **fictional** services used only to show the shape: their names, addresses, routes and
> secret names are made up. A real integration follows the same pattern with its own names.

`src/keen-tools.json`: `{ "name": "Web Search", "type": "script", "entry": "tools/webSearchTool.js" }`.

```js
// src/scripts/tools/webSearchTool.js — a thin entry point: switch, input, Secret, connect, one instrument, one reply
import Agent from 'system/agent';
import Secrets from 'system/secrets';
import Settings from 'system/settings';
import Tools from 'system/tools';
import * as WebSearchService from '../services/webSearch/service.js';

export async function exec() {
    const call = toolOptions.toolContext;
    const reply = data => Agent.setRootAgentPrompt(call.agentId, {
        prompt: JSON.stringify(data),
        sessionID: toolOptions.agentNode.flowContext.sessionId,
        requestID: Tools.generateUUID()
    });

    const [available, maxResults] = Settings.getMany('web_search_available', 'web_search_max_results');
    if (available !== true) {
        reply({ ok: false, retryable: false, error: 'Web Search is not available on this agent. Tell the person.' });
        return { ok: false };
    }

    const raw = (call.options.context ?? '').trim();
    let input;
    try { input = JSON.parse(raw); } catch { input = null; }
    if (!input || typeof input.query !== 'string' || input.query.trim() === '') {
        reply({ ok: false, retryable: true, error: 'Web Search input is invalid.', correction: 'Send !*context as JSON {"query": "<text>"}.' });
        return { ok: false };
    }

    const apiKey = Secrets.get('WEBSEARCH_KEY');
    if (apiKey === undefined) {
        reply({ ok: false, retryable: false, error: 'Web Search is not set up: the agent has no WEBSEARCH_KEY secret. Tell the person.' });
        return { ok: false };
    }

    try {
        const webSearch = WebSearchService.connect({ apiKey }, { maxResults });
        reply({ ok: true, ...(await webSearch.search({ query: input.query })) });
        return { ok: true };
    } catch (err) {
        reply({ ok: false, retryable: err.retryable === true, error: `Web Search failed: ${err.message}` });
        return { ok: false };
    }
}
```

`WebSearchService.connect` (the named export `connect` of `services/webSearch/service.js`, reached through the
namespace import) builds the connection with `connector.js`'s `createConnection` and returns the instruments;
`search` checks its input, makes the request and maps the answer to the few fields the model needs. A full,
validated service: `../../../../Services/examples/shopApi/`.
