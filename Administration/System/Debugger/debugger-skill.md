# Debugger

## Description

The **Debugger** page switches the sandbox's two debuggers on and off for the whole organisation and tells a person
how to attach VS Code. The debuggers let a person stop a real run at a breakpoint and read its live values:

- **Flow Debugger** — stops at a node boundary. The person marks the nodes to stop at in the extension's flow view (F9 on a
  node); the extension sets the matching breakpoint on the platform side itself (no file in the project). At each
  stopped node the person sees the `dictionary` and the `session`.
- **Script Debugger** — stops inside the project's own scripts (`scripts/*.js`), mid-execution.

The debuggers exist on sandbox servers (where agents are built and tested). They are **off by default**. While off,
every connection is refused.

How a session works: the Keen VS Code extension (Shira Flow Builder **0.0.7**, the console offers it; 0.0.6 or newer can sign in) signs in with the person's own console account
from `.vscode/keen.json`, receives a single-use debug pass valid for 5 minutes, and attaches. The pass debugs ONE
space (the `space` in `keen.json`): only runs of that space that reach a breakpoint stop; everything else runs at
full speed. One VS Code window per debugger at a time — a second is refused (`Debugger in use`).

Limits: a run paused at the same point for 15 minutes resumes by itself (a step or continue restarts the clock); one
node run under the debugger is cut at 1 hour in total. A session ends when the person's role loses the Debugger
permission, their password or role changes, the debugger is switched off, or the space is deleted.

At a breakpoint the person reads the real conversation's data. Debug with test users and test data.

When the person needs it: a flow takes the wrong branch and the Log Record does not explain why; a script's values
must be inspected step by step. For anything on a live, non-sandbox run use the Log Record instead
([../Log Records/log-records-skill.md](../Log%20Records/log-records-skill.md)).

## Who may

| Who | May |
|---|---|
| A role with **Debugger** (`dg1`, **Read only** — there is no write level) | Open the page, attach VS Code. |
| Owner and admin (as people) | Everything above, plus the **Control** card: the switch and **Kill and resume**. |
| An MCP account | Nothing — the debugger is for people only, whatever the role. |

- The right's console text: **Attach VS Code to the flow and script debuggers while the debugger is switched on. Read
  only.** It applies to the whole organisation (every space).
- Without `dg1`: **You don't have access to this page**; the sidebar row is hidden.
- A reader without owner / admin sees no **Control** card; while off they see **The debugger is off: it refuses every
  connection. Ask the owner or an admin to switch it on.**
- Give **Debugger** only to developers who debug. See [../../references/rights.md](../../references/rights.md).

## MFA

- **Attaching** needs two-step sign-in on the person's own account, the owner included — although `dg1` is a read
  right. Without it the platform refuses the ticket (403 `MFA required!`), and Shira Flow Builder 0.0.7 shows
  *The debugger needs two-step sign-in on your account — set it up in the console (My Account › Security).* (0.0.6
  showed the no-permission line instead — on 0.0.6, check the two-step sign-in of a person who has the right). With MFA
  on, the extension asks the 6-digit code on every attach and every reconnect; a wrong code is asked again, up to 4 per
  sign-in.
- The switch and **Kill and resume** are changes: `MFA required!` without it.

Why: a debugger shows live conversations. With only a stolen password someone could switch the debugger on and read
every user's messages and session at a breakpoint. See
[../../references/sign-in-and-mfa.md](../../references/sign-in-and-mfa.md).

## Through MCP

**Reachable through MCP: no.** There is no MCP tool for the debugger, and the platform refuses any MCP token.

**Not through MCP — tell the person:**

- Switch on: **System → Debugger** → **Control** → switch **Debugger switched on** (owner / admin).
- Attach: put the login in `.vscode/keen.json` (below), then **Start Flow Debugger** or **Start Script Debugger**
  from the Keen extension.
- When done: switch it off, or **Kill and resume**.

The builder may prepare `keen.json` with placeholders only. It never writes the person's password or the deployment
token into it, and never asks for them in the chat — the person types them into the file themselves.

## Create

Not available — there is nothing to create. The page shows the **Connect from VS Code** steps; the file the person
writes is:

```json
{
  "server": "https://sandbox.example.com",
  "space": "<space id>",
  "token": "<deployment token>",
  "user": "you@example.com",
  "password": "<your password>"
}
```

`space` must be a real space id — the only space the debugger stops in (unknown → `Space not found`). The page warns:
**`.vscode/keen.json` holds your password and the deployment token: keep it in .gitignore and never commit it.** If
it was ever committed or shared, the person changes their password at once.

## Change

**Control** card (owner / admin, human, MFA):

| Control | What it does | Confirmation |
|---|---|---|
| **Debugger switched on** → on | Connections are accepted from now on. Toast **Debugger switched on**. | none |
| **Debugger switched on** → off | Closes every open session and resumes every paused run. Toast **Debugger switched off — connections closed and runs resumed**. | **Switch the debugger off?** → **Switch off** |
| **Kill and resume** (only while on) | Closes every session and resumes every paused run; the debugger stays on. | **Kill all debugger connections?** → **Kill and resume** |

After off / kill a block shows **Sessions closed**, **Runs resumed** and **Instances answered**; a service that did
not answer within 2 seconds still picks the change up shortly. The card shows **Last changed by <name> · <time>**.
Every change is written to the audit log (switch, attach, detach, refusals).

Refusals at attach time, in the platform's words → what Shira Flow Builder 0.0.7 shows (it maps each by the
platform's words; any other refusal is shown with the platform's words verbatim):

| The platform | The extension |
|---|---|
| 403 `Debugger is off` | *The debugger is off — the owner or an admin switches it on in the console (Debugger page).* |
| 403 `Forbidden` (no **Debugger** right) | *Your role has no Debugger permission — ask the owner or an admin.* |
| 403 `MFA required!` | *The debugger needs two-step sign-in on your account — set it up in the console (My Account › Security).* |
| 404 `Space not found` | *Space "<space>" was not found — check "space" in .vscode/keen.json.* |
| 406 about `space` | *The platform refused the debug ticket (406) — is "space" a space id?* |
| any other 403 / 404 / 406 (e.g. 403 `MCP accounts may not access this resource`) | *The platform refused the debug ticket (<status>): <the platform's words>* |
| close 1013 (in use) | *The flow / script debugger is already in use — one window per debugger at a time.* |

The full list with every fix: [../../../ShiraFlowBuilder/debugging.md](../../../ShiraFlowBuilder/debugging.md). Use the
Kill button for "someone forgot a breakpoint and a chat hangs".

**How the change reaches what runs:** immediately. Switching on changes nothing until someone attaches; a run stops
only in the debugged space at a breakpoint. Switching off / Kill releases every paused run at once. See
[../../references/delivering-changes.md](../../references/delivering-changes.md).

## Delete

Not available — switching the debugger off is the "stop" (see Change).

## Import / Export

Not available for Debugger. The **Debugger** right is part of a role's export (see
[../../references/import-export.md](../../references/import-export.md)); the switch is not.

## Mistakes that break it

| Mistake | What happens | Do instead |
|---|---|---|
| Leaving the debugger on after the session | Anyone with **Debugger** can attach and read live chats | Switch it off when done |
| A breakpoint left in a busy space | Real users' runs wait up to 15 minutes each | **Kill and resume**; debug in a test space |
| `keen.json` committed | Password + deployment token leaked | `.gitignore` first; if leaked, change the password and reset the space's token |
| Breakpoint in a normal script while using the **Flow Debugger** | Never stops (the Flow Debugger stops only at the nodes marked in the flow view) | Use the **Script Debugger** for `scripts/*.js` |
| Wrong `space` in `keen.json` | `Space not found`, or the breakpoints of the real space never bind | Use the space the code is deployed to |
| An extension older than 0.0.6 on an account with MFA | It cannot sign in | Update the extension to 0.0.7 |
| Expecting the builder (MCP) to attach | Refused — people only | The person attaches in VS Code |

## Example

The person: "The Checkout flow takes the 'no stock' branch even when the item is in stock. I want to step through it."

1. Builder checks first: is there a Log Record for the agent? If its lines do not explain it, the debugger is next.
2. Builder tells the person: "Your role needs the **Debugger** permission and two-step sign-in must be on for your
   account. If the page says the debugger is off, an owner or admin opens **System → Debugger** and switches
   **Debugger switched on**."
3. Builder adds `.vscode/keen.json` to `.gitignore` and writes the file with the placeholders above, the real
   `server` and `space` (`cmspace0001`). Tells the person: "Type your e-mail, password and the space's deployment
   token into `.vscode/keen.json` yourself — do not paste them here."
4. The person marks the node to stop at (F9 in the flow view), clicks **Start Flow Debugger**, enters the code, and sends
   a test message (with a test user). At each node they read `dictionary.stock` and find the wrong key.
5. Builder fixes the flow; the person deploys and re-tests.
6. Builder: "Done — ask the owner or admin to switch the debugger off (**System → Debugger** → **Switch off**)."
