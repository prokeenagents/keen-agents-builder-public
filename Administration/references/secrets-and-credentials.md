# Secrets and credentials

Every kind of secret in Keen, in one place. There are two groups:

- **Secrets a person types** — values that belong to someone else (a third-party API key, a password, a PEM). Keen
  stores them write-only and hands them to one consumer: the agent's scripts, or the partner site's process.
- **Credentials Keen issues** — keys, tokens and secrets Keen mints itself. Each is shown once (or masked), and is
  replaced by Rotate / Reset, never typed back in.

## The builder's rules

1. **Never ask the person to paste a secret into the chat.** Not a value for a Secrets card, not an API key secret,
   not a password, not a code other than the 6-digit sign-in code that `mcp_login` asks for. Tell the person where
   to type it (the exact console path below) and let them do it.
2. **You see names, never values.** `list_agent_secrets` and `list_api_key_secrets` answer the NAMES (with who set
   each and when), the limits and the history. There is no MCP tool that sets, replaces or removes a secret value —
   on purpose: a value in your context would sit in the model's logs.
3. **A credential that reaches you in a tool reply** (`create_mcp_consumer`, `rotate_mcp_consumer_secret`,
   `create_client`, `rotate_client`, `create_api_key`, `rotate_api_key`, `get_space_deployment_token`) goes straight
   into the git-ignored env file it belongs in (the project's `.env`, see the ProjectStructure skill; the site's
   `.env.local`). The one exception is the Log Record stream token from `reveal_log_token`: keep it only in a shell
   variable for the stream you open, never in a project file. Never repeat any of them in the chat, a file that is
   committed, Json Settings or Front Settings. (`create_certificate` answers the secret key you sent; Keen delivers it
   to a managed site, so no tool or file needs it — keeping it in the git-ignored `.env` as a record is optional.)
4. **Configuration is not a secret.** Json Settings and Front Settings hold plain values only — a switch, a label,
   a URL, a model name, a retry count, e.g. `{ "service_available": true, "service_title": "My Service" }` (anyone who
   can read the agent reads them, and they are exported). The scripts turn a service on or off from Json Settings; the
   partner site turns its connector on or off from Front Settings. Anything whose leak costs money or access goes into
   Secrets — the agent's (for the project's services) or the API key's (for the site's own server code).
5. **Before a Rotate / Reset / Delete, say what stops.** Use the "What a leak allows / what replacing it stops"
   columns below and confirm with the person.

## Secrets a person types

### The agent's Secrets — for the agent's own flows

- **Where:** **AI › Agents** › the agent › the **Secrets** card. **Add secret** → **Name** + **Value** (the
  **Multi-line** switch for a PEM) → **Save**. To replace a value: type into the saved row ("Saved — type to
  replace") and **Save**. To remove: × on the row ("Removed when you save.") → **Save**.
- **Who may:** reading the names needs `ag1`; saving needs `ag2`, the person's MFA and the agent's record lock.
- **Rules:** name `^[A-Z][A-Z0-9_]{0,127}$` ("Capital letters, digits and _ — for example ELEVENLABS_API_KEY.
  The name is visible to everyone who can read this agent."); value 8 to 8192 bytes, no NUL; at most 50 per agent
  and 65536 bytes in all. The browser encrypts each value before it leaves; Keen never shows a value again.
- **Who reads it:** the script engine, for this agent's scripts only, with `Secrets.get('NAME')` from
  `system/secrets` (`../../Flow/Nodes/Script/references/system/secrets.md`). The agent project's services use them: a
  tool reads the secret and hands it to its `service.js`, which assembles the connection with `connector.js`. A value is replaced with `••••` wherever a script lets
  it out — the LLM, the logs, the chat, the debuggers.
- **When it applies:** from the next Script node that imports `system/secrets`, also in a chat already running
  (toast: "Secrets saved — scripts read them from the next Script node.").
- **Never exported or imported**, not even the names. After an import the person enters them again.

### The application Secrets — for the partner site on an API key

- **Where:** **API › Api Keys** › the key › the **Secrets** card (after the **Application** card). Same rows as above;
  footer **Save** and **Save and restart** (the second only while the application is Running).
- **Who may:** reading the names needs `ak1`; saving needs `ak2`, MFA and the key's record lock.
- **Rules:** the same name shape; names starting with `NEXT_PUBLIC_` are refused (they would be built into the
  browser bundle), and a list of names the site process owns is reserved (`Row <n>: "<NAME>" is reserved and cannot
  be set here.`); value 1 to 8192 bytes; at most 50 per key, 65536 bytes in all.
- **Who reads it:** the partner site's process, as environment variables, when the application starts or restarts;
  the site's own server code (its API routes) uses them, never the browser. Only a site instance holding the key's
  API Key Secret receives them, and after a Create or a Rotate only once a person has pressed **Start**. A variable of
  the same name already in the site's container is replaced by Keen's value (the site logs a warning once per start).
  The five values the site needs to reach Keen (`KEEN_HOST`, `KEEN_API_KEY_ID`, `KEEN_API_KEY_SECRET`,
  `KEEN_CLIENT_ID`, `KEEN_CLIENT_SECRET`) are never Secrets: they stay in the site's own environment.
- **When it applies:** **Save** stores them — "Saved changes are not running yet — restart the site to apply
  them."; they go out at the next **Start** or **Restart** pressed on the Application card. **Save and restart**
  stores and restarts every instance at once. A container that restarts on its own gets the last *started* set,
  not a merely saved one.
- **Unavailable** on a key from before site control: "Rotate the key once to use secrets."
- Instances on an older start-up process do not apply them: "… an older start-up process that does not apply
  secrets — update the site."

## Credentials Keen issues

| Kind | Where it is set or shown | Who / what reads it | How it is replaced | What a leak allows / what replacing it stops |
|---|---|---|---|---|
| **API Key Secret** (with the **Api Key ID**) | Shown once: the reveal after **Create** and after **Rotate key** ("Copy the Key Secret now"). Then only the prefix. | The partner site's server (`KEEN_API_KEY_ID` + `KEEN_API_KEY_SECRET` in its own environment) to mint the application token and to connect its instances. | **Rotate key** in the key's Danger zone (`ak2`, MFA, lock; `ca2` too when a certificate is bound). Through MCP: `rotate_api_key`. | Leak: minting application tokens and, once the application is started, running an instance that receives the application Secrets and the certificate. Rotate stops the partner application at once: every open chat ends, every token stops, users sign in again; the application waits for a person's **Start**. |
| **Client ID + Client Secret** | Shown once after create and after **Rotate secret**. | The partner site's server (`KEEN_CLIENT_ID` / `KEEN_CLIENT_SECRET` in its own environment), with the API key, to get an application token. | **Rotate secret** on **API › Clients** (`ct2`; refused while another person holds the record). MCP: `rotate_client`. | Leak (with the API Key Secret): new application tokens. Rotate retires the old secret at once — the site cannot get a new token until its environment holds the new one; tokens already issued keep working. |
| **Certificate key pair** | Generated by Keen. The private key never leaves Keen; the **Public Key** (PEM) is always shown. | Keen signs the end users' tokens with it; the partner verifies with the PEM. | **Rotate** the key pair (`ca2`). MCP: `rotate_certificate`. | The private key cannot leak from the console. Rotate: "Everything verifying against the OLD public key fails immediately." |
| **Certificate Secret Key** (shared, 16–32 characters) | Typed or generated at create, shown once. Never read back; replaced with **Replace secret key**. | The partner site (delivered by Keen with the certificate) to check the signature of Keen's notices. | **Replace secret key** on the certificate (`ca2`). MCP: `update_certificate { secretKey }`. | Leak: signing notices the site accepts as Keen's. Replace: "Every consumer token of this tenant stops verifying, and the partner must fetch the certificate again." |
| **Space deployment token** | Shown at create; readable later with `sp2` (**Copy deployment token** on the space; MCP `get_space_deployment_token`). | `keen-deploy` and the VS Code extension (`KEEN_DEPLOY_TOKEN`, `.vscode/keen.json`). | Re-mint on the space (`sp2`). MCP: `reset_space_deployment_token`. | Leak: uploading code to the space — and that code can read the agents' Secrets. Re-mint: "Every new deploy with the old token is refused from now on." Running agents are not touched. |
| **Webhook secret** (`KEEN_WEBHOOK_SECRET`) | Chosen by the person: the last segment of the **Webhook URL** (`…/api/keen-webhook/<secret>`) and the same value in the site's environment. A site under site control receives it from Keen. | The partner site's webhook route compares the path. | Edit the webhook's URL (`wk2`, lock; `ca2` when the bound key has a certificate) and the site's value. | Leak: reaching the site's webhook route (each notice is still checked against Keen's signature). Treat the whole URL as a secret. |
| **MCP account secret** (with its ID) | Shown once after create and after **Rotate secret** — console only, owner or admin. | The builder's `mcp_login`. Keep it in the project's git-ignored `.env`. | **Rotate secret** on **Organization › MCP Accounts** › the account. | Leak: with a ready owner, nothing without the owner's 6-digit code; without one, read-only access. Rotate ends the agent's session at once. |
| **MCP consumer secret** (with its ID) | Shown once in the reply of `create_mcp_consumer` / `rotate_mcp_consumer_secret`. | `get_mcp_consumer_token` (the builder acting as an end user). | `rotate_mcp_consumer_secret`, or **Rotate** on **AI › MCP Consumers**. | Leak: chatting as that end user in its spaces. Rotate revokes every token pair of it at once. |
| **Log Record stream token** | **Reveal** on the Log Record (`l2`, MFA). MCP: `reveal_log_token`. Keep it in a shell variable, never in a project file. | A live-log viewer the person hands it to; a stream opens only while **Client-readable** is on. | It cannot be rotated: turn **Client-readable** off (no new stream) or delete the record and create it again. | Leak: reading that live log stream. |
| **Account password** | Typed by the person at activation, reset or on **My Account**. | The console sign-in. | The person changes it on **My Account**; an owner or admin sends **Reset password**. | Leak: with MFA on, nothing without the second step. |
| **Two-step sign-in** (authenticator app or e-mail code) | Set up by the person on **My Account** › Security. | The console sign-in and every write (`MFA required!` without it); an MCP account's owner confirms its sign-in with it. | The person re-enrols; an owner or admin can reset it. | With the password: the whole account. |

## Mistakes that break it

| Mistake | What happens | Do instead |
|---|---|---|
| Asking the person to paste a key into the chat "so you can save it" | The value sits in the model's logs; MCP still cannot save it | Give the console path; the person types it on the card |
| Putting an API key into Json Settings | Everyone who reads the agent sees it; it travels in the export | The agent's Secrets |
| Expecting an application secret saved with **Save** to be live | The site still runs the last started set | **Save and restart**, or **Restart** after **Save** |
| Rotating the API key "to be safe" during business hours | Every chat of the partner application ends at once | Rotate only on a leak; plan the env update and the **Start** |
| Rotating a client without telling the person to update the site | The site cannot mint its next application token | Update `KEEN_CLIENT_SECRET` in the site's environment and restart its container |
| Losing a shown-once value | It cannot be read again | Rotate / Replace and update every holder |
