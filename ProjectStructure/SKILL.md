---
name: keen-project-structure
description: Keen 15.3 — The layout of a Keen agent project and what every file and folder in it is for — `.vscode/keen.json` and `settings.json`, `src/flows/*.flow`, `src/scripts/` with `tools/` (the LLM-facing tool scripts) and `services/<service>/` (service.js, connector.js, utils.js, settings.js — the house standard for an external integration such as a CRM, a document store or a search API; the tool imports only service.js), the required per-service skill in `.claude/skills/<service>-service/`, `src/keen-tools.json`, `package.json`, Prettier and `.gitignore`; who reads each one (keen-validate, keen-deploy, the engines), the exact rules and validations, and where each rule is only our convention. Use this skill whenever you create a new agent project, add a file or folder to one, add a tool or connect an external service or API, move scripts around, prepare a project for deploy, or wonder where something belongs — even when the person only says "connect our CRM to my agent" or "add a tool that searches our documents".
---

# Keen agent project structure

> **Keen 15.3.** This skill describes Keen 15.3 in full — it is the baseline. A later release (15.4, …) gets an
> additions-only skill with just what changed; read this one first, then the additions for the platform's version.

A Keen agent's project is a folder the builder writes by hand and ships with `keen-deploy`. Every agent built
with the builder has the same shape, so a person (or the next builder session) always knows where to look and
the builder can write a new integration from the same template instead of inventing one.

```
<project>/
    .claude/
        skills/
            <service-in-kebab>-service/
                SKILL.md      ← src/scripts/services/services.md   the service's skill — recommended for every service, never uploaded
    .vscode/
        keen.json             ← vscode/keen-json.md     the deploy target + the debugger login (never commit)
        settings.json         ← vscode/settings.md
    src/                      ← src/src.md               everything that is deployed lives here
        flows/                ← src/flows/flows.md
            <Project>.flow    ← src/flows/project-flow.md   the flow graph (nodes: ../Flow/Nodes/SKILL.md)
        scripts/              ← src/scripts/scripts.md   every Script node's file and its own imports
            tools/            ← src/scripts/tools/tools.md
                <name>Tool.js  ← src/scripts/tools/name-tool.md   a thin tool the LLM calls — one per service instrument
            services/         ← src/scripts/services/services.md   one folder per external service
                <service>/
                    service.js    ← src/scripts/services/service.md     connect(credentials, options) + the instruments — the only file a tool imports
                    connector.js  ← src/scripts/services/connector.md   createConnection(): the authenticated client (only service.js calls it)
                    utils.js      ← src/scripts/services/utils.md       helpers both use
                    settings.js   ← src/scripts/services/settings.md    code constants — never a secret
        keen-tools.json       ← src/keen-tools.md       the tools the LLM may call
    package.json              ← package-json.md
    .prettierrc               ← prettier.md               (+ .prettierignore: src/flows/ — the canvas writes the .flow files)
    .gitignore                ← gitignore.md
```

**The workspace around it.** The person's workspace root holds `keen-project.json` — the Keen (`server`), this
project's folder (`agent_project_dir`, e.g. `./agent`; `.` when the workspace root is the project), the site's address
and folder (`application`, `application_dir`) and the builder's MCP account (`mcp_id`, `mcp_secret`);
`../ProjectSetup/keen-project.md`. The file is never in `src/` (everything in `src/` is uploaded) and is git-ignored
(`gitignore.md`). For Shira the person opens the project folder itself in VS Code — Shira sees a project only when it
is the first folder of the window.

```
<workspace>/
    keen-project.json         ← ../ProjectSetup/keen-project.md   read first, every session (never commit, never print)
    .gitignore                ← gitignore.md   lists keen-project.json
    <project>/                the agent project above = agent_project_dir
    <site>/                   the partner site = application_dir
```

**Before you create or change an item, read its file.** To build a whole service (from the API's documentation to a
tested tool), follow `../Services/SKILL.md`. The services in the examples (`docStore`, `webSearch`) are
fictional — they only show the shape; no integration ships with the platform. Each one says who reads the item, its exact structure,
what keen-validate and deploy refuse, its limits and the usual mistakes.

## Platform rules and house rules

Two kinds of rule appear in these files, and every file says which is which:

- **Platform rules** are enforced by a tool: keen-validate refuses or warns, the deploy refuses, or an engine
  fails the node at run time. Breaking one costs a failed deploy or a broken chat.
- **House rules** — marked *(house standard — not checked by any tool yet)* — are our convention: the
  `services/<service>/` split, the tool imports only `service.js`, thin tools (one per instrument), only tools read
  Secrets, nothing secret in `settings.js`, snake_case Json Settings keys, a skill per service, Prettier.
  No tool stops you from breaking them, which is exactly why you keep them: they are what lets the next person
  and the next builder session read and extend the project.

## Where values belong

| Kind of value | Where | Changes need |
|---|---|---|
| Code constants: a base URL, a page size, a timeout | `src/scripts/services/<service>/settings.js` | a deploy |
| Values a person tunes per agent: a feature switch, a title, an address — plain values, snake_case keys (`{"doc_store_available": true, "doc_store_title": "Manuals"}`) | the agent's **Json Settings** (console), read with `system/settings` — only in a tool | nothing — the next Script node sees them |
| Keys, passwords, client secrets | the agent's **Secrets** (console), read with `system/secrets` — only in a tool | nothing |
| The person's own sign-in at the partner (their token) | a JS-readable cookie the person's site sets, read with `system/cookies` — only in a tool (`../Services/access.md` §6) | — |
| The deploy target and the debugger login | `.vscode/keen.json` — git-ignored (`server` copied from `keen-project.json`) | — |
| The Keen, the site's address and folder, the builder's MCP account ID + secret | `<workspace>/keen-project.json` — git-ignored, never in `src/` | the person edits the file |

A secret never goes into `settings.js`, the `.flow` file, `keen-tools.json`, a Script node's key / value pairs, a
log line or the dictionary.

## A new project, in order

0. Read the workspace's `keen-project.json` (`../ProjectSetup/keen-project.md`); create the project folder beside it.
1. The skeleton: `.vscode/keen.json` (`server` from `keen-project.json`; never invent the token), `.vscode/settings.json`,
   `package.json`, `.prettierrc` + `.prettierignore`, `.gitignore` (it must list `.vscode/keen.json`).
2. `src/flows/<Project>.flow` with the agent's Start Flow name and Start node label (`Flow/Nodes/SKILL.md`).
3. For each external service (`../Services/SKILL.md`): `src/scripts/services/<service>/` (the four files), then one
   tool per instrument in `src/scripts/tools/<service><Action>Tool.js`, their entries in `src/keen-tools.json`, the
   service's skill `.claude/skills/<service-in-kebab>-service/SKILL.md` (recommended), then the LLM node that offers
   the tools.
4. `keen-validate <project>` until it reports 0 errors, then `keen-deploy`, then a test chat.
