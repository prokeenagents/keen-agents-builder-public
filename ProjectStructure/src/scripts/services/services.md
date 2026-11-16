# `src/scripts/services/`

## Description

The folder that holds every external service an agent talks to (a document store, a search API, a CRM, a shop). Each service
gets one subfolder with the same four files. The LLM never reaches a service directly: it calls a **tool** under
`src/scripts/tools/`, and the tool uses the service's files.

| File | Role |
|---|---|
| `service.js` | the service the tool uses: its `connect(credentials, options)` — called as `<Name>Service.connect(…)` through `import * as <Name>Service` — assembles the connection and returns the instruments, one function per action the LLM may take — [`service.md`](service.md) |
| `connector.js` | the connection itself: `createConnection(credentials, options)` builds an authenticated client from the credentials; used by `service.js` only — [`connector.md`](connector.md) |
| `utils.js` | small pure helpers both of them use — [`utils.md`](utils.md) |
| `settings.js` | code constants and defaults, never a secret — [`settings.md`](settings.md) |

Why the standard wants it: about 90% of agent projects are written by the builder. When every integration has the
same shape, the builder writes a new one from a template, finds any function by its place, and a reviewer knows
where a key may appear (only in the tool) and where it must not (everywhere else). The tool stays thin: it checks
the Json Settings switch, reads the input and the agent's Secret (and the person's cookie when needed), connects,
calls one instrument and replies to the model. How to build a service end to end: [`Services/SKILL.md`](../../../../Services/SKILL.md).

## Location and name

- `src/scripts/services/<service>/` — `<service>` in camelCase (`docStore`, `webSearch`, `hubCrm`), the same style as the
  tool file. (house standard — Shira checks only script FILE names: letters and digits, starting with a letter.)
- In it, exactly `service.js`, `connector.js`, `utils.js`, `settings.js` (all four required, house standard).
- **Recommended (not mandatory): the service's skill** at `<project>/.claude/skills/<service-in-kebab>-service/SKILL.md` (`docStore` →
  `.claude/skills/doc-store-service/SKILL.md`) — when and why to use each instrument, its input and reply, the
  limits and errors, the connection's steps, the Secret / setting / cookie names and what the person sets in the
  console. It is written from [`Services/service-skill-template.md`](../../../../Services/service-skill-template.md)
  and updated in the same change as the service. Not beside the code: everything under `src/scripts/` is uploaded on a
  deploy, `.claude/` never is, and Claude Code loads skills from there. A service is not finished without it.
- The tools that use the service: `src/scripts/tools/<service><Action>Tool.js`, one per instrument (camelCase — Shira refuses `_` or `-` in a script
  file name: *Script file names must start with a letter and contain only letters and numbers*, an error that
  disables Connect and Upload), registered in `src/keen-tools.json`.
  A Script node in a flow may import the same service files.

## Structure

| Path | Required | What it is for |
|---|---|---|
| `tools/<service><Action>Tool.js` | yes, one per instrument the LLM uses | the entry: `export const exec = async () => {…}` — a tool gets no `props`; it reads its input from `toolOptions` and answers with `Agent.setRootAgentPrompt` (see [`name-tool.md`](../tools/name-tool.md)); the only file that imports `system/secrets`, `system/settings`, `system/cookies` |
| `services/<service>/service.js` | yes | `connect(credentials, options)` + the instruments (+ any constant a tool needs, re-exported); the ONLY service file the tool imports |
| `services/<service>/connector.js` | yes | `createConnection(credentials, options)` → a connection object (imported by `service.js` only) |
| `services/<service>/utils.js` | yes (may be short) | pure helpers |
| `services/<service>/settings.js` | yes | named constants |

Not in this folder: an `exec` (these are helper modules, nothing runs them directly), a `keen-tools.json` entry
(a tool entry must start with `tools/`), one service's file importing another service's files.

## Rules and validation

What the platform enforces today:

- These are ordinary ES modules. Imports are **relative** and exact: `'../services/docStore/service.js'`,
  with `.js`, resolved from the importing file. There is no root alias, no `index.js`, no extension guessing.
- Only `system/*` modules and the project's own relative files may be imported; an npm package or `node:*` fails
  the node (`ivm: import "<name>" not supported — …`). keen-validate lints every file under `src/scripts/`: a
  file no Script node and no tool runs is linted as a **helper** (no `exec` needed), with the same import rules,
  the missing-target check and the forbidden globals the deploy refuses.
- A script tool's entry must start with `tools/` and contain no `..` — keen-validate refuses it, and the engine
  refuses to run it (the model reads `No tool response`). So a `services/` file can never be a tool entry.
- A tool's `props` is empty: its input is `toolOptions.toolContext.options.context` (the `!*context` text). Its
  return value never reaches the model (it does reach the person's browser — return `{ ok: true }`); it answers the model with `Agent.setRootAgentPrompt` on the caller's session —
  see [`tool-calling.md`](../../../../Flow/Nodes/LLM/references/tool-calling.md) §4.
- A tool that throws logs `Script "<path>" failed: <message>` and the model reads `No tool response`. Catch every
  error in the tool and reply in words.
- Any file in the node's import graph that imports `system/secrets` makes the engine fetch the agent's Secrets for
  that node and mask their values in everything the node lets out. The engine has no folder rule for it.

House standard (not checked by any tool yet): the four files per service; the tool imports only `service.js`; one
tool per instrument; the service's skill at `.claude/skills/<service-in-kebab>-service/SKILL.md` (recommended); only
files under `tools/` import `system/secrets`, `system/settings` and `system/cookies`; Json Settings keys snake_case,
plain values only, with a `<service>_available` switch the tool checks first; nothing key-like in `settings.js`; one
service never imports another.

## Limits

One node run loads the tool and all its imports into one fresh sandbox: 30 MB for the code and its data, a 10 MB
buffer for each HTTP body, one HTTP call at a time, 15 s per call, 15 minutes per run, and module-level variables
die with the sandbox (no cache between runs). The engine reads an import graph of up to 256 modules; past that it
treats the graph as unreadable and fetches the Secrets for the node anyway. Details:
[`script-skill.md`](../../../../Flow/Nodes/Script/script-skill.md) → Limits,
[`http.md`](../../../../Flow/Nodes/Script/references/system/http.md).

## Mistakes that break it

| Mistake | What happens | Write instead |
|---|---|---|
| `import S from 'services/webSearch/service.js'` | not relative → the import is refused | `'../services/webSearch/service.js'` |
| `'../services/webSearch/service'` | the file `service` does not exist | the exact name with `.js` |
| registering `services/webSearch/service.js` in `keen-tools.json` | refused: a tool entry starts with `tools/` | a tool under `tools/` that imports it |
| the tool returns the result | the model reads `No tool response` | `Agent.setRootAgentPrompt(...)` on the caller's session |
| reading `props.query` in a tool | `undefined` — a tool has no props | parse `toolOptions.toolContext.options.context` |
| an uncaught throw in the tool | the model reads `No tool response` | catch, reply `{ ok: false, error }` |

## Example

> `docStore` and `webSearch` are **fictional** services used only to show the shape: their names, addresses, routes and
> secret names are made up. A real integration follows the same pattern with its own names.

`src/keen-tools.json`: `{ "tools": [ { "name": "Document Search", "type": "script", "entry": "tools/docStoreSearchTool.js" } ] }`

The agent's Json Settings: `{"doc_store_available": true, "doc_store_shelf": "manuals"}`; its Secret: `DOCSTORE_KEY`.

```js
// src/scripts/tools/docStoreSearchTool.js — Document Search: switch, input, Secret, connect through service.js, one instrument, one reply.
import Agent from 'system/agent';
import Chat from 'system/chat';
import Secrets from 'system/secrets';
import Settings from 'system/settings';
import Tools from 'system/tools';
import * as DocStoreService from '../services/docStore/service.js';

export const exec = async () => {
    const call = toolOptions.toolContext;
    const reply = data =>
        Agent.setRootAgentPrompt(call.agentId, {
            prompt: JSON.stringify(data),
            sessionID: toolOptions.agentNode.flowContext.sessionId,
            requestID: Tools.generateUUID()
        });

    // 1. The switch first: the agent's Json Settings say whether document search is on (and, optionally, where and which shelf).
    const [available, baseUrl, shelf] = Settings.getMany('doc_store_available', 'doc_store_api_url', 'doc_store_shelf');
    if (available !== true) {
        reply({ ok: false, retryable: false, error: 'Document search is not available on this agent. Tell the person it cannot be used right now.' });
        return { ok: false };
    }

    // 2. The input: !*context is JSON text from the model — parse and check it before anything else.
    let input;
    try {
        input = JSON.parse(call.options.context ?? '');
    } catch {
        input = null;
    }
    if (!input || typeof input.query !== 'string' || input.query.trim() === '') {
        reply({ ok: false, retryable: true, error: 'Document Search input is invalid. Send !*context as JSON {"query": "<text>", "limit": 5}.' });
        return { ok: false };
    }

    // 3. The key: read here, in the tool, on every run.
    const apiKey = Secrets.get('DOCSTORE_KEY');
    if (apiKey === undefined) {
        reply({ ok: false, retryable: false, error: 'Document search is not set up on this agent (no DOCSTORE_KEY). Tell the person.' });
        return { ok: false };
    }

    // 4. Connect through the service, call one instrument, reply. Every failure becomes a reply in words.
    try {
        Chat.writeOut('Searching the documents…');
        const docStore = DocStoreService.connect({ apiKey }, { baseUrl });
        const result = await docStore.search({ query: input.query, limit: input.limit, shelf });
        reply({ ok: true, ...result });
        return { ok: true };
    } catch (err) {
        reply({ ok: false, retryable: err.retryable === true, error: err.message });
        return { ok: false };
    }
};
```
