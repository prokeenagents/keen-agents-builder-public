---
name: keen-agent-architectures
description: Keen 15.3 — How to build a Keen agent that uses several LLMs — the five architectures (routing, prompt chaining, parallelization, evaluator-optimizer, orchestrator-worker), which one fits a request, how each is assembled from Keen nodes, tools and the run's three stores, what the person sees, its limits and cost, with a complete validated example project for each. Use this skill whenever an agent needs more than one model call per answer — a classifier that picks a flow, a pipeline of steps, parallel work, a draft that is checked and retried, or a main agent that delegates to sub-agents — or when the person asks for a "multi-agent", "router", "supervisor", "pipeline", "reviewer" or "workers" setup, even if they never name an architecture.
---

# Keen agent architectures

> **Keen 15.3.** This skill describes Keen 15.3 in full — it is the baseline. A later release (15.4, …) gets an
> additions-only skill with just what changed; read this one first, then the additions for the platform's version.

Five ways to put several LLMs to work on one request. All five can be built on Keen today from ordinary nodes and
tools; each file below explains one, with a complete project in `examples/<name>/project/` that passes keen-validate.

| Architecture | Use when | File |
|---|---|---|
| **Routing** | different kinds of request need different handling; a cheap classifier (or a Script) picks the flow | `routing.md` |
| **Prompt chaining** | the work splits into fixed steps; each step's answer is the next step's input; gates between steps | `prompt-chaining.md` |
| **Parallelization** | independent parts can run at once (sectioning: different flows) or the same task several times (voting) | `parallelization.md` |
| **Evaluator-optimizer** | there is a clear quality bar; a judge model scores a draft and the writer retries with the feedback, bounded | `evaluator-optimizer.md` |
| **Orchestrator-worker** | the sub-tasks are not known in advance; a main agent decides and delegates to specialised sub-agents (each with its own model and tools) | `orchestrator-worker.md` |

**Start with the simplest that works.** One LLM with good tools beats a pipeline; a pipeline beats an orchestrator.
Add an architecture only when one model call cannot do the job reliably — every extra LLM adds cost, time and a place to
fail.

## What all five share

- **One node per request.** The person's browser (the SDK) coordinates the run, the server executes one node per request
  (`../Flow/Nodes/SKILL.md`, "How a run works") — every helper, sub-agent and branch is just the next node, and every
  value between them goes through the run's stores.
- **The run's three stores carry the data** — session storage, channels (`system/agent`) and each flow's private
  dictionary. Which to use for each step, who sees what in parallel, and how to clean up:
  `references/communication.md`. The verified building blocks (passing an answer on with `agentResponse`, branching,
  sub-agents, parallel runs, loops, agentId rules, limits): `references/building-blocks.md`.
- **Every LLM node's answer is visible to the client — by design.** The client runs every node itself and gets each
  LLM node's whole answer and its token use, so the cost of a round is easy to compute. The site shows everything
  behind the main agent (helpers, sub-agents, tool calls) in ONE accordion and waits for ONE final answer — the
  answering node's: the console agent's ID on the run's own session. Write helpers' answers short and plain; only the
  final answer is saved as the chat's answer.
- **A helper LLM carries its own agentId** and gets its input from a prompt turn that reads the dictionary (a Script
  copies the person's message there); the node that answers the person carries the console agent's ID.
- **A sub-agent's working memory is its dictionary key** (its task and notes, read by its prompt; Interact with DB off);
  results from parallel branches come back on a channel; a Parallel Context fan-out merges back by itself.
- **Nothing limits rounds, loops or depth for you** — bound every loop with a counter and a Condition, and state a tool
  budget in the system prompt.
- **Memory across turns** is the conversation: the answering agent keeps what helpers and tools returned, and a
  Summarizer compresses it. **Business state lives in the partner's own system**: a cart, an order, a booking is
  changed and computed by the store's API through tools — the agent never computes totals and never keeps ids. The
  user's token (from the site, as a cookie — `system/cookies`, never through the conversation) gives the API the
  user's own session; when the agent needs the current state it simply asks again ("what is in the cart") and the
  API returns the products, the total and the applied coupons.

## Before you finish

Every LLM node of every architecture follows the house standard: a Fallback to the same agent on another provider,
and — when it keeps the chat — a Summary to one Summarizer with its own Fallback Summarizer
(`../Flow/Nodes/SKILL.md`, "The house standard"). `keen-validate <project-dir>` (0 errors; node ids unique across the
project; no unwired-Fallback warning), then a test chat with the runner that exercises every branch — and read what
the person would see, not only the final answer.
