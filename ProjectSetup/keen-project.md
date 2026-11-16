# `keen-project.json` — the workspace file you always read first

> **Keen 15.3.**

One JSON file at the top of the person's workspace tells you which Keen to work with, where the agent project lives,
where the partner site is published and where its code lives, and the MCP account you sign in with. **Every Keen task starts by finding and
reading it.** It is the one source of these values: everything else (the project's `.env`, `.vscode/keen.json`, the
site's `.env.local`) takes them from here.

## 1. Find it — every time, before anything else

1. Look for `keen-project.json` in the current working directory, then in each parent folder up to the root of the
   disk. The first one found is the workspace's file; its folder is the **workspace root**. The agent project and the site
   live in the folders the file names (`agent_project_dir`, `application_dir`).
2. **Not found → ask the person** in one line: "Where is your `keen-project.json`?" Read the file at the path they
   give. Do not search the whole disk and do not guess.
3. **They have none → offer to create it** at the workspace root from the template (section 3). Fill `server`,
   `agent_project_dir`, `application` and `application_dir` with what the person tells you; leave `mcp_id` and `mcp_secret` as placeholders
   and ask the person to type them into the file themselves.
4. **Check the MCP server right after reading it** (Claude Code): `claude mcp list` must show a server whose URL is
   `<server>/mcp`. Missing → `claude mcp add --transport http keen <server>/mcp`; pointing elsewhere → `claude mcp
   remove keen`, then add it again. A server added or changed in a session loads only when a session starts, so ask the
   person **once, before anything else**, to restart Claude Code in this folder (or connect it from `/mcp`), and continue
   after that — never discover it in the middle of a task (`../MCP/connect.md` §3).
5. Read it again whenever the person says they changed it, and at the start of every session — never rely on values
   remembered from an earlier one.

A value that is empty or still starts with `[REPLACE` counts as missing: name the field and ask the person to fill it
in the file. Never continue with a guessed value.

## 2. The fields

| Field | Required | Value | You use it for |
|---|---|---|---|
| `server` | yes | the Keen instance's base address **with** `https://`, no path: `https://keen.example.com` | the MCP endpoint `<server>/mcp` (`../MCP/connect.md`); its bare host (`keen.example.com`) is `KEEN_HOST` in the agent project's `.env` (keen-deploy, the runner), the chat socket `wss://<host>/ws-keen`; `server` in `.vscode/keen.json` (Shira); `KEEN_HOST` in the site's `.env.local` (the full URL there) |
| `agent_project_dir` | yes | the agent project's folder — the one with `src/`, `.vscode/`, `package.json` and the project's `.env` — **relative to this file's folder** (`./agent`) or absolute; `.` when the workspace root is the project itself | where you create and change the project (`../ProjectStructure/SKILL.md`); run `keen-validate`, `keen-deploy` and the runner from there (each reads `.env` from the folder it runs in); the folder the person opens in VS Code for Shira — Shira sees a project only when it is the **first** folder of the window (`../ShiraFlowBuilder/project.md`) |
| `application` | when there is a partner site | the site's **public** `https://` origin, no path: `https://site.example.com`. A local address is not acceptable — the site needs a public address (a tunnel on the person's machine) | the webhook record's `origin`; `KEEN_ORIGIN` in the agent project's `.env` (the runner's `--origin`) and in the site's `.env.local` |
| `application_dir` | when there is a partner site | the folder the Entanglement site lives in, **relative to this file's folder** (`./entanglement`) or absolute | where you read, change and start the site (`../Entanglement/SKILL.md`) |
| `mcp_id` | yes, for MCP | the builder's **MCP account ID** (console › **Organization › MCP Accounts**) | `mcp_login { id }` |
| `mcp_secret` | yes, for MCP | that MCP account's **secret** — shown to the person once, at **Create** or after **Rotate secret** | `mcp_login { secret }` — nothing else |

**`mcp_id` / `mcp_secret` are not a console e-mail and password.** The MCP server signs in only an MCP account, with its
ID and secret. A person's console e-mail and password belong in `.vscode/keen.json` (Shira's debuggers,
`../ShiraFlowBuilder/project.md`), never here. An MCP account with an owner still needs the owner's 6-digit code at
every sign-in — the person gives it in the chat (`../MCP/connect.md` §5).

## 3. The template

```json
{
    "server": "https://keen.example.com",
    "agent_project_dir": "./agent",
    "application": "https://site.example.com",
    "application_dir": "./entanglement",
    "mcp_id": "[REPLACE_WITH_MCP_ACCOUNT_ID]",
    "mcp_secret": "[REPLACE_WITH_MCP_ACCOUNT_SECRET]"
}
```

Plain JSON: no comments, no trailing commas. No other field is read.

## 4. Keep it secret

`mcp_secret` is the MCP account's secret: whoever has it acts as your MCP account.

- **Never print it.** Do not show the file, quote `mcp_secret`, or copy it into a message, a log, a commit message, a
  draft or another file. Its only use is the `mcp_login` call.
- **Never ask for it in the chat.** The person types it into the file. If they paste it into the chat anyway, use the
  file, not the chat, and suggest **Rotate secret** afterwards.
- **Git-ignored.** When the workspace is a git repository, `keen-project.json` must be in its `.gitignore` before the
  first commit — add the line. If the file is already tracked, stop and tell the person: untrack it and rotate the
  secret.
- **Never uploaded.** It stays at the workspace root — never inside an agent project's `src/` (Shira uploads all of
  `src/`), never in a site's `public/`, never zipped or sent.
- **A leak** (pushed, pasted, shared): the person presses **Rotate secret** on the MCP account and types the new secret
  into the file; you `mcp_login` again.

## 5. Where its values go

| From `keen-project.json` | Written by you into | Note |
|---|---|---|
| `server` → its bare host | `<agent_project_dir>/.env` `KEEN_HOST` | keen-deploy and the runner read `.env` from the folder they run in |
| `server` | `<agent_project_dir>/.vscode/keen.json` `server` | with `https://` |
| `server` | `<application_dir>/.env.local` `KEEN_HOST` | the full URL |
| `application` | `<agent_project_dir>/.env` `KEEN_ORIGIN`; `<application_dir>/.env.local` `KEEN_ORIGIN`; the webhook record's `origin` | all three equal |
| `mcp_id` / `mcp_secret` | nowhere | read from this file at each `mcp_login` |

When `keen-project.json` and one of those files disagree, `keen-project.json` wins: correct the other file and tell
the person. For `application` also check the webhook record's `origin` (`get_webhook`): under site control Keen sends
the site its `KEEN_ORIGIN` from that record at every start, so a different record wins at run time — correct it with
`update_webhook` under its lock — a new origin ends every token of the site's API key (every open chat), so confirm
with the person first (`../MCP/tools.md`, `../MCP/golden-path.md`). The values that are not in this file stay where `values.md` puts them (the space id, the deployment token,
the MCP consumer's id and secret, the site's client and API key credentials).

## 6. Example

The person runs Claude Code in `~/work/shop`. You find `~/work/shop/keen-project.json`; `server` is
`https://keen.example.com`, `agent_project_dir` `./agent`, `application` `https://shop-site.example.com`,
`application_dir` `./entanglement`. You sign in with `mcp_login` using `mcp_id` and `mcp_secret` (the person gives the
owner's code), build the agent project in `~/work/shop/agent`, write `KEEN_HOST=keen.example.com` and
`KEEN_ORIGIN=https://shop-site.example.com` into `~/work/shop/agent/.env`, run `keen-validate` and `keen-deploy` from
`~/work/shop/agent`, tell the person to open `~/work/shop/agent` in VS Code for Shira, and work on the site in
`~/work/shop/entanglement`. You check `~/work/shop/.gitignore` has the line `keen-project.json`.
