# Keen skills — Keen 15.3

The Keen agent builder's skills as one installable skill (`keen-skills`). Built 2026-11-17 from KeenAgentsBuilder.

## Install (Claude Code)

- For every project on this machine: copy the whole folder to `~/.claude/skills/keen-skills/`.
- For one project only: copy it to `<project>/.claude/skills/keen-skills/`.
- To update: replace the whole folder with the new one (never merge — a file removed from the kit must go), then run
  `npm install` again in `MCP/agent-runner` (its `node_modules` went with the old folder).

Then put `keen-validate` and `keen-deploy` for your system on the PATH (`MCP/validator.md`, `MCP/uploader.md`).

## What is inside

| Skill | Read | What it covers |
|---|---|---|
| `keen-project-setup` | [`ProjectSetup/SKILL.md`](ProjectSetup/SKILL.md) | setting up and starting a project: the first time (from an idea to a running agent) and every next time; who does what; every value and where it lives |
| `keen-project-structure` | [`ProjectStructure/SKILL.md`](ProjectStructure/SKILL.md) | the agent project's layout, file by file |
| `keen-flow-nodes` | [`Flow/Nodes/SKILL.md`](Flow/Nodes/SKILL.md) | the 15 flow nodes, the `.flow` file, the 10 `system/*` modules, how a run works |
| `keen-tools` | [`Flow/Tools/SKILL.md`](Flow/Tools/SKILL.md) | Script Tools and Flow Tools, tool chaining, tools that change something |
| `keen-agent-architectures` | [`AgentArchitecture/SKILL.md`](AgentArchitecture/SKILL.md) | routing, prompt chaining, parallelization, evaluator-optimizer, orchestrator-worker; how flows pass information |
| `keen-services` | [`Services/SKILL.md`](Services/SKILL.md) | making a service: connecting an agent to an external API in the house standard (service / connector / utils / settings, the tool, the service's own skill), with a validated example |
| `keen-mcp` | [`MCP/SKILL.md`](MCP/SKILL.md) | the MCP server, the golden path, `keen-validate`, `keen-deploy`, testing with the runner (`bin/`, `agent-runner/`) |
| `shira-flow-builder` | [`ShiraFlowBuilder/SKILL.md`](ShiraFlowBuilder/SKILL.md) | the Shira Flow Builder 0.0.7 VS Code extension: install, project and `keen.json`, the panel, the Problems checks, upload and auto-sync, the `.flow` canvas node by node, the flow and script debuggers |
| `keen-administration` | [`Administration/SKILL.md`](Administration/SKILL.md) | the organisation console, segment by segment: rights, MFA, what MCP reaches, create / change / delete |
| `keen-entanglement` | [`Entanglement/SKILL.md`](Entanglement/SKILL.md) | the partner site (Next.js + the Keen pre-process): setup, the public address, the pre-process, running and controlling it, Cloud Run later; `SDK/` — the chat SDK, its protocol and error codes |

