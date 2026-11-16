# Debugging with Shira: the Flow Debugger and the Script Debugger

> **Keen 15.3 · Shira Flow Builder 0.0.7.**

The console side (the switch, the **Debugger** permission, Kill and resume, the 15-minute and 1-hour limits) is in
`../Administration/System/Debugger/debugger-skill.md`; two-step sign-in in
`../Administration/references/sign-in-and-mfa.md`. This page is what happens in VS Code.

## What it is

| | Flow Debugger | Script Debugger |
|---|---|---|
| Stops | when a node marked with **F9** on the canvas runs | on ordinary line breakpoints in the project's `.js` scripts |
| Unit | a node — **Continue** and every Step run to the next marked node | a line — normal stepping |
| Shows | Variables **Dictionary**, **Session**, **globalThis**; the node lit on the canvas | the script's locals, call stack, watch — VS Code's JavaScript debugger |
| Debug session name | `Shira Flow Builder` (type `keen-flow`) | `Shira Script Debugger` (type `node`) |
| Connection lines | the **Debug Console** + Output → Flow Builder | the **status bar** (5 s) + Output → Flow Builder |

Both debug the code **as deployed** in the space, never the files on disk, and both stop only runs of the space in
`keen.json` `space`. Each platform debugger accepts **one** session at a time.

## Prerequisites (all of them)

1. **A sandbox instance with its debug services** — the flow and script debug services, and the flow engine running
   with its debug bridge on (`DEBUX_ENABLED=true`, set by the sandbox's deployment, not by the console).
2. **The debugger switched on** — owner or admin, console **System → Debugger → Control → Debugger switched on**.
3. **The person's own console account** with the **Debugger** permission (`dg1`; owner / admin have it) **and two-step
   sign-in turned on** (My Account → Security) — the platform refuses a debug ticket without it. An MCP account can never debug.
4. **`.vscode/keen.json`** with `server`, `space` (the Space ID), `user` (that account's e-mail), `password`
   (`project.md` §3). `token` is not used by the debuggers. The person types `user` / `password` into the file.
5. **The project deployed** (`upload.md`), and for the Script Debugger the local scripts equal to the deployed ones —
   breakpoints bind by path (`src/…` ↔ the deployed project) and by line.
6. **A run to stop:** a chat or a test run in that space that reaches the marked node / line.
7. **Shira 0.0.7** (0.0.6 also signs in, but shows `MFA required!` as a missing permission and ends on a wrong code;
   older versions cannot answer the two-step code).

## What the person does — Flow Debugger

1. Open the `.flow` in the canvas, select one or more nodes and press **F9** (toggles a breakpoint on every selected
   node; they appear in the **Breakpoints** view). Breakpoints of **all** flows of the project are active together.
2. Click **Start Flow Debugger** — the debug icon in the `.flow` canvas tab's title bar (or Command Palette →
   `Shira Flow Builder: Start Flow Debugger`). No `launch.json` is needed.
3. Answer the two-step code prompt (below). The Debug Console says
   `Attached to the flow debugger (space <space>) over the TLS edge.` (or `… over port 7101.`).
4. Send a test message. When a marked node runs, VS Code stops: the canvas opens and centres the node with a green
   ring and a blinking bug; **Call Stack** shows one thread `Flow` and one frame `<nodeId> — <File>.flow`; **Variables**
   shows **Dictionary**, **Session**, **globalThis** — expand to read. If Variables is empty, click the frame once
   (VS Code does not always select a frame that has no source file).
5. **Continue** (F5) or any Step → runs to the next marked node. **Pause** does nothing (a flow cannot be paused
   between nodes). F9 changes during the session take effect at once. Expressions typed into the Debug Console are not
   evaluated, and values cannot be edited.
6. **Stop** (Shift+F5) ends the session.

## What the person does — Script Debugger

1. Open a script under `src/scripts/`, click in the gutter (or F9 in the text editor) to set line breakpoints — these
   are VS Code's own breakpoints (Run and Debug → Breakpoints), not the Shira Breakpoints view.
2. Click **Start Script Debugger** — the debug icon in the title bar of a `.js` editor whose path contains a
   `scripts` folder (or Command Palette → `Shira Flow Builder: Start Script Debugger`).
3. Answer the code prompt. The status bar shows `Attached to the script debugger (space <space>) over the TLS edge.`
4. Run the flow whose Script node (or tool) executes that file. VS Code stops on the line; step, inspect, continue as
   in any Node.js session. The isolate's first "entry" stop is skipped automatically, once.
5. **Stop** ends it. A second click while it runs: `Shira Flow Builder: the script debugger is already running in this window.`

## The sign-in on every attach and every reconnect

Each attach **and each automatic reconnect** signs in again for a fresh single-use ticket:
`POST <server origin>/keen-org-api/v1/auth/login` with `user` / `password` → (two-step code) → `POST …/debug/ticket
{ kind, space }` → `POST …/auth/logout` (always). The ticket is valid 300 s and used at once. The password, tokens,
code and ticket never appear in a toast, the Debug Console or the Output.

**The two-step code prompt** (VS Code's input box at the top of the window, title
`Shira Flow Builder: two-step sign-in`; it stays open while the person switches to the phone or the mail):

| Account's method | What the person sees |
|---|---|
| Authenticator app | an input box: `Enter the code from your authenticator app`, placeholder `123456` |
| E-mail | first a choice, `Enter the code` / `Send a new code` (hint `Enter the code we e-mailed to you`), then the same input box `Enter the code we e-mailed to you` |

- The code is 6 digits (spaces are ignored: `123 456` works); anything else: `The code is 6 digits.`
- **Send a new code** → the note `A new code is on its way.`; too early or too many (60 s apart, 3 per sign-in) →
  `A new code can be sent in <wait> — enter the last one meanwhile.` (or `No new code can be sent now — enter the last one.`).
- **A wrong code is asked again**, with the note `That code was not accepted — enter the current one.` — never the
  wrong-password text. The platform checks at most **4** codes per sign-in: after the 4th wrong one (or when a resend
  finds the step gone — it lives 300 s) the attempt ends with
  `The two-step code step has ended (too many wrong codes, or it expired) — start the debugger again to sign in anew.`
- **The code budget:** 20 wrong codes in 24 h block the code step for 24 h. The platform then answers with the wait,
  and the attempt ends with `Too many sign-in attempts — try again in <wait>.` (`24 h` right after the block).
- Escape ends it with `Sign-in cancelled — no two-step code was entered.` At most 7 prompts per sign-in (4 codes + 3
  resends).
- `<wait>` reads `<n> s` below 2 minutes, `<n> min` below 2 hours, `<n> h` above.
- A reconnect after a drop asks the code again. If nobody answers, the debugger waits on the prompt.

## Where it connects

1. **The TLS edge first**, on the `server`'s own origin (port 443): flow `https://<server>/keen-debug/flow`, script
   `wss://<server>/keen-debug/script`. A 15.3 sandbox has it; only 443 must be reachable.
2. **Fallback, on a server without the edge** (the probe gets a redirect, a 404 or a web page): the plain ports
   `http://<host>:7101` (flow) and `ws://<host>:7100` (script) with the same ticket, where `<host>` = `keen.json`
   `debugHost`, else the `server`'s host name. Output says once:
   `The server has no TLS debug edge for the <flow|script> debugger (HTTP <status> on /keen-debug/<kind>) — falling back to port <port>.`
   The mode found is kept for the whole session.
3. A hand-written `launch.json` configuration of type `keen-flow` with `cdpUrl` forces the ports mode — do not add one.

The instance's TLS certificate is verified; a certificate problem shows as `Connection lost (<CERT_… code> …)`.

## How a session ends

- **Stop** in VS Code (both debuggers).
- A **terminal** answer — the session ends with a warning toast `Shira Flow Builder: <message>` (and a Debug Console line
  for the flow): any sign-in or ticket refusal, the switch turned off, **Kill and resume**, revoked access, the
  debugger in use elsewhere, three refused tickets in a row.
- A **transient** drop (the debug service restarting, the network, no answer to the 30-second ping within 10 s) →
  `Connection lost (<code> <reason>) — reconnecting in <n> s…`, then a new sign-in and attach after 3, 5, 10, 20, 30,
  30 … s; `Reconnected to the <flow|script> debugger (space <space>).` on success; after 5 minutes of failures
  `Could not reconnect to the <flow|script> debugger — start it again.` A drop while paused clears the pause and the
  canvas marker (the flow thread shows as running). For scripts each reconnect is a **new** VS Code debug session.
- The platform's own limits (a run paused 15 min at the same point resumes by itself; one node run is cut at 1 hour):
  `../Administration/System/Debugger/debugger-skill.md`.

## Every message and its fix

| Message (toasts start with `Shira Flow Builder: `) | Cause | Fix |
|---|---|---|
| `Add your console login ("user" and "password") to .vscode/keen.json to debug` + button **Open keen.json** | `user` / `password` empty or `[REPLACE…]` | the person fills them in the file |
| `Could not read .vscode/keen.json.` · `.vscode/keen.json is not a JSON object.` | file missing / not JSON | fix the file |
| `Set "server" in .vscode/keen.json first.` · `Set "space" in .vscode/keen.json first.` · `"server" in .vscode/keen.json is not a URL.` | the field | fix it |
| `"debugHost" in .vscode/keen.json must be a host name only (no scheme, port or path).` | e.g. `https://keen.example.com:7101` | `keen.example.com`, or remove it |
| `open the project folder to debug flows.` / `… to debug scripts.` | no folder open | open the project folder |
| `Sign-in refused — check "user" and "password" in .vscode/keen.json (your console account).` | the password step refused: wrong e-mail / password, a blocked account | fix the login |
| `That code was not accepted — enter the current one.` (the code box's note) | a wrong two-step code | type the current code |
| `The two-step code step has ended (too many wrong codes, or it expired) — start the debugger again to sign in anew.` | 4 wrong codes on one sign-in, or the step expired (300 s) | Start again |
| `Too many sign-in attempts — try again in <wait>.` (`… try again later.` with no wait given) | the sign-in throttle (password step), or the code budget (20 wrong codes in 24 h → 24 h) | wait the time shown; fix the login first |
| `Set up two-step sign-in in the console first (My Account › Security).` | the organisation requires two-step sign-in and the account has none | the person sets it up, Start again |
| `Sign-in cancelled — no two-step code was entered.` | the prompt was dismissed | Start again |
| `The debugger is off — the owner or an admin switches it on in the console (Debugger page).` | the switch is off (or was turned off during the session) | owner / admin turns it on |
| `Your role has no Debugger permission — ask the owner or an admin.` | the ticket was refused 403 `Forbidden`: no Debugger permission (or a gone / blocked account) | a role with the Debugger permission |
| `The debugger needs two-step sign-in on your account — set it up in the console (My Account › Security).` | the ticket was refused 403 `MFA required!`: the account has no two-step sign-in | the person sets it up, Start again |
| `Space "<space>" was not found — check "space" in .vscode/keen.json.` | the ticket was refused 404 `Space not found` | the Space ID from the console |
| `The platform refused the debug ticket (406) — is "space" a space id?` | the ticket was refused 406 about `space`: not a valid id (a name was typed) | the Space ID |
| `The platform refused the debug ticket (<status>): <the platform's words>` (or `… (<status>).` with no words) | any other 403 / 404 / 406 of the ticket, its words verbatim — e.g. `The platform refused the debug ticket (403): MCP accounts may not access this resource` | act on the words |
| `An administrator ended the debug session (Kill & Resume).` | **Kill and resume** in the console | Start again when wanted |
| `Debug access was revoked — your role, password or the space changed.` | revoked | check role / password / space, Start again |
| `The <flow\|script> debugger is already in use — one window per debugger at a time.` | another window or person holds that debugger | close the other session (or an admin uses Kill and resume) |
| `The <flow\|script> debugger refused three debug tickets in a row — check "server" / "debugHost" in .vscode/keen.json, then start it again.` | the tickets reach a different instance (wrong `debugHost`) | fix `server` / `debugHost` |
| `Connection lost (1011 CDP upstream not connected) — reconnecting in <n> s…` (repeating) | the debug service is up but the engine's debug bridge is not reachable | the sandbox's engine / its debug bridge; it ends after 5 min |
| `Connection lost (HANDSHAKE_TIMEOUT …)` / `(ECONNREFUSED …)` / `(502 refused)` / `(503 refused)` | the debug service or the network is down; on the fallback, ports 7100 / 7101 not reachable from the person's machine | it retries; check the instance |
| `Could not reconnect to the <flow\|script> debugger — start it again.` | 5 minutes of failed attempts | fix the cause, Start again |
| `Could not start the script debugger session (js-debug).` · `js-debug did not attach to the script debugger — start it again.` | VS Code's JavaScript debugger did not start / attach within 30 s | Start again; check that the built-in JavaScript debugger is enabled |
| Attached, but it never stops | no run reached a marked node / line; the run belongs to another space; no breakpoints set (flow); the local script differs from the deployed one (script) | send a message in **that** space; deploy; set breakpoints |

## What you (the builder) can do yourself

- Check the prerequisites you can: the deploy is current (`keen-deploy` after `keen-validate`), `space` is the Space
  ID (MCP), `.vscode/keen.json` is git-ignored, the `server` has `https://`.
- Write `keen.json` with placeholders for `user` / `password` / `token`; **never** ask for them in the chat and never
  type them yourself. The two-step code is typed only into VS Code's box.
- You cannot switch the debugger on (no MCP tool), set F9 breakpoints (they live in the person's VS Code), or attach.
  Tell the person each step and what to read back to you (the node, a dictionary key, a variable).
- Before reaching for the debugger, read the agent's Log Record — it is often enough.

## Mistakes that break it

| Mistake | What happens | Do instead |
|---|---|---|
| An account without two-step sign-in | `The debugger needs two-step sign-in on your account — …` (on 0.0.6: `Your role has no Debugger permission — …` although the role has it) | turn on two-step sign-in (My Account → Security) |
| Breakpoints set in a script while using **Start Flow Debugger** | it never stops there | **Start Script Debugger** for `.js` |
| Debugging right after editing, before the upload finished | lines and nodes do not match what runs | wait for `Project deployed ✓` / `Project synced` |
| `space` = the space's name | `… (406) — is "space" a space id?` | the Space ID |
| A test message sent through an agent of another space | nothing stops | use an agent of the `keen.json` space |
| Leaving breakpoints in a shared sandbox and walking away | real runs wait (up to 15 min each) | Stop; ask an admin for Kill and resume |

## Example

The person: "The Checkout flow answers 'out of stock' for everything."

1. You redeploy the current project with `keen-deploy` and tell the person: "In VS Code open `Checkout.flow`, click the
   Condition node that checks the stock, press **F9**, then click the debug icon **Start Flow Debugger** in the tab's
   title bar. Type the 6-digit code from your authenticator app when asked."
2. "The Debug Console should say `Attached to the flow debugger (space cmspace0001) over the TLS edge.` Now send a test
   message to the shop agent asking for a product in stock."
3. "VS Code stops on the node. In **Variables** expand **Dictionary** and read me the value of `stock`." — the person
   reads `undefined`; the key is `inStock`. You fix the Condition, run `keen-validate`, deploy, and ask the person to
   press **Stop**, remove the breakpoint and try the chat again.
