---
name: keen-skills
description: Keen 15.3 — The Keen agent builder's complete kit, one skill that holds all the others — setting up and starting a project, the project's files, writing .flow files and their nodes, tools, multi-LLM architectures, services that connect an agent to an external API, the Keen MCP server with keen-validate, keen-deploy and the flow runner, the Shira Flow Builder VS Code extension, the organisation console, and the Entanglement partner site with its chat SDK. Use it whenever the person wants a Keen agent planned, built, changed, validated, deployed, run, tested or debugged; a flow, node, script, tool or service written; anything created or changed on the Keen platform, in the console or through MCP; or a partner site set up, run or connected — even if they only say "agent", "flow", "Keen", "Shira" or "the site". Read the matching skill's own SKILL.md before acting.
---

# Keen skills — the agent builder's kit

> **Keen 15.3.** Every skill here describes Keen 15.3 in full and was checked against the platform's code.
> A later release gets additions-only skills; read these first, then the additions up to the platform's version.

This folder holds all of the builder's skills. Each one lives in its own folder with its own `SKILL.md`, and they link
to each other by relative paths, so keep the folder whole.

## First, always: `keen-project.json`

Before any Keen task, find the workspace's `keen-project.json`: the current folder first, then each parent folder.
**Not found → ask the person where it is**; never guess the Keen, the site or the MCP account. It holds `server`
(the Keen), `agent_project_dir` (where the agent project lives), `application` (the partner site's public
address), `application_dir` (where the site's code lives) and
`mcp_id` / `mcp_secret` (the MCP account's ID and secret, used only for `mcp_login`). Never print the file or its
`mcp_secret`, never commit it (it belongs in `.gitignore`), never put it under `src/`. Every field and rule:
[`ProjectSetup/keen-project.md`](ProjectSetup/keen-project.md).

## How to use it

1. Find the skill that fits the task in the table and read its `SKILL.md` first, whole, before you act or advise.
2. Follow its links to the files it names (a node, a console segment, a reference) and read them before you write that part.
3. A task that spans several skills, such as a new agent from an idea, starts with `keen-project-setup`: it walks the
   whole order and names the skill for every step.

## The skills

| Skill | Read | What it covers |
|---|---|---|
| `keen-project-setup` | [`ProjectSetup/SKILL.md`](ProjectSetup/SKILL.md) | setting up and starting a project: the first time (from an idea to a running agent) and every next time; who does what; every value and where it lives |
| `keen-project-structure` | [`ProjectStructure/SKILL.md`](ProjectStructure/SKILL.md) | the agent project's layout, file by file |
| `keen-flow-nodes` | [`Flow/Nodes/SKILL.md`](Flow/Nodes/SKILL.md) | the 15 flow nodes, the `.flow` file, the 10 `system/*` modules, how a run works |
| `keen-tools` | [`Flow/Tools/SKILL.md`](Flow/Tools/SKILL.md) | Script Tools and Flow Tools, tool chaining, tools that change something |
| `keen-agent-architectures` | [`AgentArchitecture/SKILL.md`](AgentArchitecture/SKILL.md) | routing, prompt chaining, parallelization, evaluator-optimizer, orchestrator-worker; how flows pass information |
| `keen-services` | [`Services/SKILL.md`](Services/SKILL.md) | making a service: connecting an agent to an external API in the house standard (service / connector / utils / settings, the tool, the service's own skill), with a validated example |
| `keen-mcp` | [`MCP/SKILL.md`](MCP/SKILL.md) | the MCP server, the golden path, `keen-validate`, `keen-deploy`, testing with the runner (`bin/`, `agent-runner/`) |
| `shira-flow-builder` | [`ShiraFlowBuilder/SKILL.md`](ShiraFlowBuilder/SKILL.md) | the Shira Flow Builder 0.0.6 VS Code extension: install, project and `keen.json`, the panel, the Problems checks, upload and auto-sync, the `.flow` canvas node by node, the flow and script debuggers |
| `keen-administration` | [`Administration/SKILL.md`](Administration/SKILL.md) | the organisation console, segment by segment: rights, MFA, what MCP reaches, create / change / delete |
| `keen-entanglement` | [`Entanglement/SKILL.md`](Entanglement/SKILL.md) | the partner site (Next.js + the Keen pre-process): setup, the public address, the pre-process, running and controlling it, Cloud Run later; `SDK/` — the chat SDK, its protocol and error codes |

## The tools in this kit

- `MCP/bin/` — `keen-validate` and `keen-deploy`, compiled for Linux, macOS and Windows (amd64 / arm64). Install and use: [`MCP/validator.md`](MCP/validator.md), [`MCP/uploader.md`](MCP/uploader.md).
- `MCP/agent-runner/` — the flow runner (`npm install` once, then `npx tsx run.ts`): [`MCP/testing.md`](MCP/testing.md).
- The chat SDK and the site's Keen pre-process are on npm: `@keenagents/chat-sdk`, `@keenagents/keen-site` ([`Entanglement/SDK/setup.md`](Entanglement/SDK/setup.md), [`Entanglement/pre-process.md`](Entanglement/pre-process.md)).

## Versions

- **15.3 is the baseline**: these skills carry everything.
- **A later release (15.4, …) does not repeat it.** Its skills carry only the additions and changes since the release
  before. The builder reads the 15.3 skill first, then the additions up to the platform's version.
- When a release changes a fact written here, its additions say so plainly ("in 15.4 this changed: …"); the 15.3
  files stay as they are.
