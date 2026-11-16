# How flows and agents pass information — the three means

A Keen agent's flows, branches, tools and sub-agents never call each other with arguments. They pass information through
three stores of the run. Pick the one that fits the job; most architectures use all three.

| | **1. Session storage** | **2. Channels** (`system/agent`) | **3. Private dictionaries** |
|---|---|---|---|
| What it is | ONE flat key → value store for the whole run | named lanes of prompts / responses, per agent, for the whole run | each flow's own scratchpad (nested JSON) |
| Values | strings, numbers, booleans, `null` only | entries `{ prompt / response, sessionID, requestID, channel, … }` | any JSON (objects, lists) |
| Written by | Scripts (`system/session`), a Loop's `session.` Set to | Scripts (`system/agent`), and every LLM node (its answer, on the channel of the prompt that triggered it) | Assignment, Scripts (the `dictionary` global), an LLM node's `agentResponse`, a Loop's `dictionary.` Set to |
| Read by | any node field `${session.key}`; Scripts | **Scripts only** (`getChannel…`, `consumeChannel…`); an LLM reads the newest prompt filed under its own agentId as its trigger | any node field `${dictionary.path}`; Scripts; another flow's only through `system/dictionary` (read-only) |
| Seen by | every flow of the run: root, Run / Jump children, tool flows, Parallel Flows branches, Parallel Context runs | every flow of the run | the flow that owns it — see "Which flow owns which dictionary" |
| Lives | the run; wiped at the root End (60 s idle backstop) | the run; wiped at the root End; `consume…` / `deleteChannel` earlier | the run; a branch's at its end, a Parallel Context run's after its merge |
| Limits | 1.5 MB in all | 8 MB per entry and per node's writes; 200 entries per agent and channel (oldest dropped); one read ≤ 10 MB | 1.5 MB per dictionary (over it: a Script node takes its `error` output; a flow node — Loop, Assignment — or a Parallel Context merge stops the run with E2201; an LLM's `agentResponse` is simply not written) |

## 1. Session storage — small facts every flow must see

- Use it for a language, a user id, a flag, a counter, an error note for the `error` handler (a throwing Script still
  keeps its session writes).
- Flat: `${session.user.plan}` is the single key `"user.plan"`, not a nested walk. Keys: letters, digits, `_`.
- **Inside a Parallel Context run, and in a branch started from a branch, an LLM node reads `${session.…}` as EMPTY**
  (other nodes and Scripts read it normally) — put what such an LLM needs into its element / its dictionary.
- Details: `../../Flow/Nodes/Script/references/system/session.md`.

## 2. Channels — collect information for a task, then delete it

- Use them to **gather** results from several tools, sub-agents or parallel branches for one task, and to hand a message
  to a specific agent: a prompt filed for agent `X` (on any channel) is what `X`'s LLM node answers next; its answer goes
  to the **same** channel.
- A collecting Script reads with `consumeChannelResponses('<task>')` — **read and delete** in one step — and turns the
  entries into ONE text that it puts in the dictionary for the next LLM's prompt. `deleteChannel('<task>')` deletes
  without reading. A filter (`consumeChannelResponses('<task>', { sessionID })`) narrows only what is RETURNED — the
  whole lane is deleted, the other entries are lost; filter with `getChannelResponses` when others still need them.
- Keep entries small: a consume answer above the 10 MB input buffer fails **after** the lane was already deleted.
  **A channel does not keep triggers apart:** an LLM node takes the newest prompt for its agentId from ALL channels,
  preferring one on its own session — parallel runs that share an agentId stay apart only when each files its
  trigger with its OWN `sessionID` (`flowContext.sessionId`), or uses its own agentId. Never mix runs that file a
  prompt with runs that do not (one with nothing falls back to a sibling's).
- **A failed LLM call still leaves an entry:** the provider's error text is stored as the agent's answer on the
  trigger's channel (even with Interact with DB off) — a collector must skip it; route the LLM's Fallback to a Script
  that deletes that entry (`deleteAgentResponse(agentID, { channel, sessionID })`).
- Details: `../../Flow/Nodes/Script/references/system/agent.md`.

## 3. Private dictionaries — each flow's working memory

### Which flow owns which dictionary

| Flow | Its dictionary |
|---|---|
| the root flow and its Run Flow / Jump Flow children | ONE shared dictionary |
| a tool (script or flow) | the dictionary of the flow whose LLM node called it |
| a Parallel Flows branch | its **own, empty** dictionary — deleted when the branch ends, nothing merges back |
| a Parallel Context run | its own copy of its collection **element** — merged back into the element when the run reaches End Flow |

- An LLM reads the dictionary through its prompts, and the prompts are **re-resolved on every run of the node** (every
  return from a tool too) — so the dictionary is a sub-agent's working memory: its task, its notes so far.
- A list or an object placed into prompt text resolves to **empty text** — keep what a prompt shows as a string.
- A branch or a Parallel Context run may READ the flow that started it with
  `Dict.get({ flowID: flowContext.parentFlowId, path })` (`system/dictionary`); there is no write into another flow's
  dictionary — hand results back through your own dictionary (merged for Parallel Context), a channel, or the session.
  The read finds nothing when the starting flow is a Run Flow sub-flow or a tool flow: those work on their caller's
  dictionary and own none under their own id (a Jump Flow keeps the id of the flow it jumped from).
- `Dict.closeDictionary(flowID)` frees a dictionary you know is finished.
- Details: `../../Flow/Nodes/Script/references/system/dictionary.md` and `../../Flow/Nodes/SKILL.md` (Data).

## Choosing

| I need to… | Use |
|---|---|
| keep a sub-agent's task and notes across its tool calls | its **dictionary** key, read by its prompt (`${dictionary.research.task}`) — Interact with DB off |
| pass one LLM's answer to the next LLM | `agentResponse` → **dictionary** → `${dictionary.<key>}` in the next prompt |
| collect results from parallel **Parallel Flows** branches | a **channel** per task (branch Scripts / branch LLMs write; one Script after Out consumes; drop failed-call entries) — or session keys for a few small values |
| collect results from a **Parallel Context** fan-out | the **merge**: each run's dictionary becomes its element (no extra store needed) |
| give every flow of the run a small fact (language, plan, counter) | the **session** |
| start a specific agent with a specific message | a prompt filed for that agent (`setRootAgentPrompt`, optionally on a channel) |
| read a value of the flow that started this branch | `system/dictionary` `get` with `flowContext.parentFlowId` |

## What survives a turn

All three stores live for ONE run — one message of the person. What carries on to the next message:

- **The conversation** (chat history of the LLM nodes with Interact with DB on) — the agent's memory: what the
  person said, what tools and sub-agents returned. A Summarizer compresses it. Only LLM nodes read it — a Script
  cannot.
- **The partner's own system** — carts, orders, bookings, accounts live behind the partner's API; tools read and
  change them there, and the API does the computing. The agent keeps no ids: the user's token gives the API the
  user's own session, so the agent simply asks again ("what is in the cart") whenever it needs the current state.
- **The site** — what the person's browser sends with every message: cookies (`system/cookies`, read-only, not
  masked). The right place for a shopper's / user's token: it never enters a prompt.

## Clean up what you create

`delete dictionary.<key>` at the end of a tool flow or sub-agent; consume or delete a channel when its task is done;
remove session keys you no longer need. The root flow's End wipes all three anyway, but a long turn (many tool rounds,
loops) carries everything until then — and the dictionary cap stops the run (E2201) when it fills.
