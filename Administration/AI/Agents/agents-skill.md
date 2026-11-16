# Agents

## Description

An agent is the runnable assistant inside one space. It names where the deployed flow starts and how clients call it:

- **Display Name** — the label people see;
- **Agent ID** — the slug clients, the chat and every LLM node of the flow run by (`support-agent`);
- **Start Flow** / **Start Node** — the run entry, joined as `StartFlow-StartNode` (`MainFlow-Start`);
- **Active** — an inactive agent is refused at run time;
- three side channels: **Json Settings** (read by the flow's Scripts), **Front Settings** (read by the partner site)
  and **Secrets** (write-only values a Script reads).

How the three serve the agent project's services: **Secrets** go to the script engine and only the project's services
use them — a tool reads one with `system/secrets` and hands it to its `service.js`, which assembles the connection
with `connector.js`. **Json Settings** and **Front Settings** hold plain values only, e.g.
`{ "service_available": true, "service_title": "My Service" }`: the scripts turn a service on or off from Json
Settings, the partner site turns its connector on or off (and shows its title) from Front Settings.

The person needs this segment when they register a new agent after its first deploy, rename or re-point it, take it
out of service, change its configuration without a redeploy, give its Scripts an API key, or change what the partner
site shows for it.

Related: it lives in one [space](../Spaces/spaces-skill.md) (the space cannot be changed later); it is reached by end
users through a contract that offers that space ([Contracts](../../API/Contracts/contracts-skill.md)); the builder
test-chats it as an [MCP consumer](../MCP%20Consumers/mcp-consumers-skill.md). The flow side:
[`system/settings`](../../../Flow/Nodes/Script/references/system/settings.md),
[`system/secrets`](../../../Flow/Nodes/Script/references/system/secrets.md),
[LLM node](../../../Flow/Nodes/LLM/llm-skill.md).

## Who may

| Right | Opens |
|---|---|
| `ag1` (Agents · Read) | the list (per space), every agent record, both settings pages (read), the Secrets card's **names** and history |
| `ag2` (Agents · Write) | **Create agent**, **Save** (incl. **Active**), **Update settings** on both settings pages, **Add secret** / remove / **Save** on Secrets, **Delete agent**, Lock |
| `ag3` / `ag4` | Import / Export of agents |
| `sp1` | the Space select on the list and on Create Agent (without it the select shows only the space in the link, with "Choices unavailable — requires spaces read permission.") |
| `ce2` | **Rebuild resource cache** in the page header |

Owner and admin pass every gate. Without `ag2` the record is read-only (no footer, no Danger zone, Secrets shows names
and "Updated …" only). Nobody — owner included — can ever read a secret's value back. See [rights](../../references/rights.md).

## MFA

Every write needs the person's two-factor sign-in: create, save, lock, both settings saves, the Secrets save, delete,
import, export. Reads (the record, the settings, the secret names) do not. The console shows "Turn on two-factor
sign-in first"; a call answers `MFA required!`. Why: with only a stolen password, someone could point the agent at
another flow, swap its Json Settings (for example a service URL, so the Scripts send customer data elsewhere), replace
a secret with their own key, or delete the agent. An MCP account follows the same rule: without its owner's code it
is read-only ([sign-in-and-mfa](../../references/sign-in-and-mfa.md)).

## Through MCP

**Reachable through MCP: partly** — everything except writing Secrets and import / export.

| Tool | What it does | Needs |
|---|---|---|
| `list_agents { spaceId }` | the agents of one space | `ag1` |
| `get_agent { id }` | one agent by its **row id** | `ag1` |
| `create_agent { spaceId, displayName, agentId, startFlow, startNode }` | creates it, Active | `ag2` + MFA; refused while another holds the space |
| `update_agent { id, … , active? }` | partial change; rename, re-point, switch Active | `ag2` + MFA + the agent locked by you |
| `delete_agent { id }` | deletes it with its settings and secrets | `ag2` + MFA + locked by you; ask first |
| `get_agent_settings` / `update_agent_settings { id, jsonSettings }` | read / replace the whole Json Settings text | `ag1` / `ag2` + MFA + locked by you |
| `get_agent_front_settings` / `update_agent_front_settings { id, jsonSettings }` | read / replace the whole Front Settings text | `ag1` / `ag2` + MFA + locked by you |
| `list_agent_secrets { id }` | **names only**, who set each and when, the limits, the history | `ag1` |
| `create_cache { resource: 'agents' }` | the console's **Rebuild resource cache** | `ce2` + MFA |
| `lock_record` / `unlock_record` `{ kind: 'agent', id }` | reserve / release the agent | `ag2` + MFA |

**Not through MCP — tell the person:**

- **Setting, replacing or removing a secret.** There is no tool, on purpose. Never ask for the value in the chat. Tell
  the person: open **AI › Agents › Agent List**, pick the space, **Open** the agent, press **Lock**, in **Secrets**
  press **Add secret**, type the **Name** (e.g. `SHOP_API_KEY`) and the **Value**, press **Save**. Then confirm with
  `list_agent_secrets` that the name is there.
- **Import / Export of agents** — console only.

## Create

Console: **AI › Agents › Create Agent** (or **New agent** on the Agent List or on the space's Assigned Agents card).
Card **Agent & Flow Binding**:

| Field | Required | Limits | Note |
|---|---|---|---|
| **Space** | yes | an existing space | cannot be changed later; max 10 agents per space |
| **Display Name** | yes | 3–150 characters | fills Agent ID while Agent ID is untouched |
| **Agent ID** | yes | 3–100, `^[a-z]+(-[a-z]+)*$`, unique on the platform | lowercase letters and single dashes, **no digits** |
| **Start Flow** | yes | 3–60, PascalCase `^[A-Z][A-Za-z0-9]*$` | the `.flow` file's flow name, no dash |
| **Start Node** | yes | 3–60, PascalCase | the Start node of that flow |

Press **Create agent**. Refusals: `Not Acceptable` (the Agent ID is taken anywhere on the platform),
`Agent limit reached — a maximum of 10 agents per space is allowed!`, the form words (`Agent ID must be kebab-case —
lowercase letters only, words separated by single dashes`, `Start Flow must be PascalCase — start with a capital
letter, letters and digits only`, …), and while another person holds the space: "<space> is locked by <email> until
<time> — nothing can be created under it until it is released." Right after: toast `Agent "<name>" created`; the
agent is **Active**, has empty settings and no secrets. Creating it does not check that the flow is deployed — a run
fails until the space holds a project with that Start Flow / Start Node.

## Change

Record: **AI › Agents › Agent List** (pick the space) › **Open**. Lock the agent first
([record-locks](../../references/record-locks.md)). Every change of the agent (Details, both settings, Secrets,
Delete) needs **your** lock on the agent **and** its space not held by someone else ("<space> is locked by <email>
until <time> — its agents cannot be changed until it is released.").

| Where | What it does |
|---|---|
| **Identity & Run Entry** › **Active** / Display Name / Agent ID / Start Flow / Start Node › **Save** | a changed Agent ID asks "Rename the Agent ID from "<old>" to "<new>"? Anything still pointing at the old slug stops working." |
| **Agent settings** › **Json settings** | the editor page; **Update settings** → "Agent settings updated!" |
| **Agent settings** › **Front settings** | the editor page; **Update settings** → "Front agent settings updated!" |
| **Secrets** › **Add secret** / × / **Undo** › **Save** | write-only values → "Secrets saved — scripts read them from the next Script node." **Show history (n)** lists who set, replaced or removed what |
| header › **Rebuild resource cache** (`ce2`) | rebuilds the platform's served copy of agents |

Settings rules (both channels): any valid JSON of at most 1,000 characters, stored exactly as typed; an empty text
clears them. Refusal: `jsonSettings must be valid JSON of at most 1000 characters`. Scripts read the **top-level keys
of a JSON object** (`{"service_available": true, "retries": 3}`). Settings hold plain values only — switches, labels,
limits, a base URL; they are visible to everyone with `ag1` and travel in an export, so never put a key or password
there; use Secrets.

Secrets rules: name `^[A-Z][A-Z0-9_]{0,127}$` ("Capital letters, digits and _ — for example ELEVENLABS_API_KEY. The
name is visible to everyone who can read this agent."); value 8 to 8,192 bytes, no NUL; at most 50 per agent and
65,536 bytes in all. The value is encrypted in the browser before it leaves; no reply, tool, log or export ever
carries it, and a Script that lets it out shows `••••`.

**How the change reaches what runs** ([delivering-changes](../../references/delivering-changes.md)):

| Change | Reaches |
|---|---|
| **Active** off / on | within seconds, from the next run request (a turn already running finishes) |
| Start Flow / Start Node | within seconds, from the next run request |
| **Agent ID** rename | within seconds: clients, the partner site, the runner's `KEEN_AGENT` and every LLM node whose `agentId` is the old slug must change — fix the flow and redeploy; running chats lose their settings and secrets (a Script importing `system/secrets` fails with `The agent's secrets could not be read.`) — start a new chat |
| **Json Settings** | from the next **Script node** that starts — also in a chat already running; no redeploy, no restart |
| **Secrets** | from the next Script node that imports `system/secrets`; a node already running keeps what it read |
| **Front Settings** | **not pushed** to the partner site by the save. The site re-reads them when someone presses **Rebuild and refresh data** on its API key ([API Keys](../../API/API%20Keys/api-keys-skill.md); MCP `wake_api_key`); a managed site's instances re-read without a restart, an older site gets the webhook notice and re-fetches. The site keeps its copy in its process memory, so a **Restart** (or any new start) of the site also reads them fresh, as does a site that never used this agent before. Scripts never see Front Settings. |

## Delete

Record › **Danger zone** › **Delete agent** ("Deleting an agent removes it and its Json and Front settings. Its space
stays."). Confirm: `Delete "<name>"? Its Json and Front settings go with it.` Toast `Agent "<name>" deleted`.

Goes with it at once: its Json / Front settings and all its Secrets (the history keeps one "Removed with the agent"
line). Run requests for its slug are refused within seconds. The deployed flow files stay in the space. It cannot be
undone: an import or a re-create gives a new row id, empty secrets. Deleting the **space** deletes all its agents.

## Import / Export

Supported (`ag3` / `ag4` + MFA): **AI › Agents › Import / Export**. Matched by **Agent ID**; the space is required and
set once. Carried: display name, Agent ID, Start Flow / Start Node, Active, the space (by title), **Json and Front
Settings as they are** ("remove anything secret from them first"). **Never carried: Secrets — not even their names**
("An agent's secrets are never exported or imported — enter them on the agent's Secrets card after an import."). Import
spaces first. See [import-export](../../references/import-export.md).

## Mistakes that break it

| Mistake | What happens | Do instead |
|---|---|---|
| An LLM node's `agentId` differs from the console **Agent ID** | the node sees no user message; the chat shows nothing from it (E6002) | the console Agent ID exactly, in every LLM node |
| Running the agent by its row id | "agent not found in space" | run by the **Agent ID** slug |
| Digits or `_` in the Agent ID (`agent-2`, `my_agent`) | refused | `agent-two`, `my-agent` |
| A dash in Start Flow / Start Node (`Main-Flow`) | refused; the entry would be ambiguous | `MainFlow` |
| An API key in Json or Front Settings | readable by every `ag1` reader, exported as is | Secrets + `system/secrets` |
| `[{"retries":3}]` as Json Settings | Scripts find no fields | a JSON object `{"retries":3}` |
| A service switched off in Json Settings but left on in Front Settings (or the reverse) | the site offers a connector the scripts refuse, or hides one that works | change both, then **Rebuild and refresh data** |
| Expecting the site to show new Front Settings after Save | it keeps the old ones | **Rebuild and refresh data** on its API key |
| Renaming the Agent ID mid-project | runs, chats and flows still using the old slug break | pick the slug once; if renamed, update flows, `.env`, the site, redeploy |
| Asking the person to paste a secret into the chat | the value is in the chat history | they type it on the Secrets card |
| Expecting a secret change inside a running Script node | not seen | it applies from the next Script node |

## Example

Goal: the "Support" assistant is deployed (`MainFlow` / `Start`) and needs a shop URL and the shop's API key.

1. `create_agent { spaceId: "<Support space id>", displayName: "Support Agent", agentId: "support-agent",
   startFlow: "MainFlow", startNode: "Start" }`. Make sure every LLM node's `agentId` is `support-agent`.
2. `lock_record { kind: 'agent', id: "<row id>" }`, then `update_agent_settings { id, jsonSettings:
   "{\"shop_available\": true, \"shopUrl\": \"https://shop.example.com\", \"timeoutMs\": 8000}" }`, then
   `unlock_record`. (The `shopApi` service's tool checks `shop_available` before it calls the service.)
3. Tell the person: "Open **AI › Agents › Agent List**, pick **Support**, **Open** *Support Agent*, press **Lock**.
   In **Secrets** press **Add secret**, Name `SHOP_API_KEY`, paste the shop key as Value, press **Save**, then
   **Unlock**. Do not send me the key."
4. `list_agent_secrets { id }` — confirm `SHOP_API_KEY` is listed.
5. Test-chat through an MCP consumer ([MCP Consumers](../MCP%20Consumers/mcp-consumers-skill.md)); the next Script
   node reads both: the tool reads `SHOP_API_KEY` with `system/secrets` and the settings with `system/settings`, and
   hands them to `services/shopApi/service.js`.
