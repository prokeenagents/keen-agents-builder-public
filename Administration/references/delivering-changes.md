# Delivering changes

How a change made in the console (or through MCP) reaches what is already running: the agent's chats and the partner
site. Use it to tell the person what happens after a save, and whether they must press anything more.

There are two receivers:

- **The agent** (its flows, inside Keen). Keen's own copies rebuild by themselves after every save; there is no
  "publish" step for the agent.
- **The partner site** (the application that runs with an API key). It keeps its own copy of spaces, agents, Front
  Settings, the contract and the certificate, and refreshes it only when Keen tells it to — through the
  **Application** card's buttons or, for an older site, through its webhook.

## The table

| Change | How it reaches the running agent / site | When | Does the person need to do anything |
|---|---|---|---|
| **Json Settings** (**AI › Agents** › the agent › **Json settings** › **Update settings**; MCP `update_agent_settings`) | The engine reads them when each Script node starts | From the next Script node — also in a chat already running | No |
| **Front Settings** (**Front settings** › **Update settings**; MCP `update_agent_front_settings`) | Keen's own read is fresh at once. The partner site keeps its copy until it is told to re-read | When someone presses **Rebuild and refresh data** on the API key (MCP `wake_api_key`), or the site starts or restarts | **Yes:** after the save, **Rebuild and refresh data** on every API key whose site shows this agent |
| **The agent's Secrets** (the agent's **Secrets** card › **Save**) | Fetched by each Script node that imports `system/secrets` | From the next such node, also in a running chat | No |
| **The application Secrets** — **Save** | Stored, not sent ("Saved changes are not running yet — restart the site to apply them.") | At the next **Start** or **Restart** on the Application card | **Yes:** **Restart** (while Running) or **Start** |
| **The application Secrets** — **Save and restart** | Stored and published; every instance restarts with the new environment | At once (a few seconds away) | No. Refused while the application waits for its first Start |
| **Start / Stop / Restart** (the **Application** card; MCP `set_api_key_site`) | Sent to EVERY connected instance of the key's site at once. **Stop** shows the maintenance page — open chats with Keen go on. **Restart** re-reads the configuration and the started secrets. **Start** publishes the saved secrets | At once | After a **Create** or a **Rotate** the application waits ("Waiting for start"): only a person's **Start** in the console releases it (MCP's start and any restart are refused: `The site waits for a person to start it after a new key secret!`) |
| **Rebuild and refresh data** (the Application card; MCP `wake_api_key`) | Keen rebuilds its copy of everything bound to the key (the key, its certificate, client, contract and policy, its spaces and their agents), then every connected instance re-reads spaces, agents, Front Settings, the contract and the certificate. An older site without site control gets the same as a webhook notice | At once; no restart, no chat ends. An instance that is not connected gets it when it connects | Press it after any change to spaces, agents, Front Settings or anything bound to the key. Off while the key is disabled ("Enable the key first.") or half-wired ("Bind a {missing} first.") |
| **Contract** changes (spaces, defaults, policy, key) and a new **Certificate Secret Key** | The bound key's site is told to re-read at once (no restart); an older site gets a webhook notice | At once | No |
| **Re-binding an API key** (another webhook, client, certificate or contract on the key's Details; MCP `update_api_key` with a binding) | Every token issued under the old binding stops; every instance restarts with the new set | At once — open chats end, users sign in again | Confirm with the person before saving; a rename alone changes nothing |
| **Webhook** — a new URL / a new origin of a bound webhook | A new URL restarts every instance (the site's webhook secret may have changed). A new origin also stops every token of the key | At once | Update the site's `KEEN_WEBHOOK_SECRET` when the secret segment changed |
| **The resource caches** (Keen's copies of roles, spaces, agents, api keys, certificates, clients, contracts, policy) | Rebuilt by themselves after every save in the console or through MCP, and all of them when the platform restarts | Seconds after the save | Only when **System › Cache** shows **Failed** or Present **No**, or after an **Invalidate**: **Create** on that card, or **Rebuild resource cache** on the record. This does NOT reach the partner site — that is **Rebuild and refresh data** |
| **API key Disable** (Danger zone; MCP `set_api_key_enabled false`) | Every chat, socket and token of the partner application stops; it can mint nothing; every instance goes unavailable and waits | At once | **Enable** brings the instances back by themselves; users sign in again |
| **API key Rotate** | The old secret and every token under it stop; every instance disconnects ("The service is temporarily unavailable") until its environment holds the new key | At once | Put the new secret into the site's `KEEN_API_KEY_SECRET`, restart the site's container, then a person presses **Start** |
| **API key Delete** | Everything of the partner application stops; every instance disconnects and stays unavailable | At once, cannot be undone | A new key and a new setup |
| **Client Rotate secret** | The old client secret is refused at once; tokens already issued keep working | At once | Update `KEEN_CLIENT_SECRET` in the site's environment and restart its container |
| **Space deployment token re-mint** | Deploys with the old token are refused | At once | Update `KEEN_DEPLOY_TOKEN` / `.vscode/keen.json`. Running agents are not touched |
| **Role save** (**Organization › Roles**) — a real change of its rights | Every holder's session ends (people and MCP accounts) — at the latest at its next token renewal; they sign in again with the new rights | Within about a minute | Tell the holders to sign in again; the builder calls `mcp_login` again. **Deleting** a role moves its people and MCP accounts to `default` and ends their sessions the same way |
| **MCP account** role, owner, Enabled or secret changed | The agent's MCP session ends | At once / within about a minute | `mcp_login` again (and the owner's code) |
| **Deploying a new project version** (`keen-deploy`) | Every engine swaps to the new version at once; a failed load leaves the old one running | From the next step of every chat — running chats are not stopped | Start a new chat to test. A chat that waits at a node the new version removed or renamed fails its next step — avoid renaming node ids while people chat |

## The pattern after a change

1. Save (console or MCP).
2. Read this table's last column. If the partner site must see it, press (or call) **Rebuild and refresh data** on
   each affected API key — once, after all the changes.
3. For anything that stops chats (Disable, Rotate, Delete, a re-binding, a new webhook origin): confirm with the
   person first and tell them their users sign in again.
4. Check: `get_api_key_site` shows each instance and whether it runs the current configuration ("{c} of {n} on the
   current configuration" while some are still updating).
