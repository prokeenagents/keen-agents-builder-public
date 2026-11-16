# Sign-in and MFA (two-factor sign-in)

How a person gets into the organisation console, how the second factor works, what locks a session, and why most changes
refuse a person without MFA. Also how YOU (the builder, an MCP account) sign in. Every segment file links here.

Console words are in **bold**, exactly as the console shows them. Wire refusals are in `code`.

## 1. The first person — activating an organisation

Only while the organisation has no confirmed owner. The page is `/activate` (nothing links to it; the person types it).

1. Fields: **Email** (the owner's e-mail — "the owner can change everything in the organization") and **Bootstrap code**
   (the operator of the server reads it on the server; the field's help names where). Button **Send Activation Mail**.
2. The owner opens the mail's link → **Confirm Account** page → types **Email**, **First Name**, **Last Name**,
   **Password**, **Confirm Password** → **Confirm Account**. Then **Sign In**.
3. Sending again replaces the pending owner; only the newest mail's link works. Once an owner has confirmed, the page shows
   **Activation is closed**.

Refusals: **Activation failed. Try again.** (general on purpose) · **Too many attempts!** + the wait.

## 2. Everyone else — the invitation

An owner or admin creates the account in **Accounts** (see the Accounts segment). The person gets an "Account Verification"
mail; its link opens **Confirm Account** (same fields as above).

- The link lives **24 hours** and works once. A newer mail kills the older link.
- Password: **12 to 128 characters** (refusal `Password must be 12 to 128 characters!`; the console: **Use 12 to 128 characters**).
- Any failure on that page is one general line: **Confirmation failed. Check the email and use the latest mail link.**
- A lost or expired invitation: an owner / admin presses **Resend invitation** on the account (at most 3 per 24 hours;
  `Too many attempts!` after that).

## 3. Signing in to the console

**Step 1 — Sign In:** **Email** + **Password** → **Sign In**.
- Every wrong answer looks the same: **Sign in failed. Check your credentials and try again.** (never says which part was wrong).
- 5 failures for one e-mail in 15 minutes (or 10 from one network address) → **Too many attempts!** + "Try again in N
  minutes." The block runs out by itself (15 minutes); a correct password does not lift it.

**Step 2 — Enter the code** (only for an account with a second factor):
- E-mail method: "We sent a code to your e-mail. It expires in 5 minutes." **Send a new code** works after 60 s, at most 3
  new codes.
- App method: "Enter the 6-digit code from your authenticator app."
- 4 wrong codes end this attempt → back to step 1 with **The code is not valid or has expired.**

**Step 2 — Set up two-factor sign-in** (the organisation requires MFA and this account has none): the person picks
**Authenticator app** or **E-mail code** and finishes the setup on the spot (see §5), then is signed in.

**Lost password:** the sign-in page says **Lost it? An Owner or an Admin sends you a reset link by e-mail.** See §4.

## 4. Password reset

Two ways, both by mail; the link opens **Set New Password** (**Email**, **New Password**, **Confirm Password** → **Set Password**).

| Who starts it | Where | Note |
|---|---|---|
| The person, for themselves | **My Account** › **Password** › **Send Reset Mail** | Confirm: "Your current password stops working the moment it is sent." |
| Owner / admin, for someone else | **Accounts** › the account › Danger zone › **Reset password** | Confirm: "Their current password stops working now; the link in the mail sets the new one." |

- The old password dies when the reset is SENT, not when the link is used. Every session of that account ends.
- The link lives 24 hours; a newer reset kills the older link. Failure on the page: **Password reset failed. Check the email
  and use the latest mail link.**
- Nobody resets the owner's password but the owner. An admin's password: only the owner (or that admin, for themselves).
- An unconfirmed account cannot be reset: `Not confirmed yet — resend the invitation instead!`

## 5. Two-factor sign-in (MFA): turning it on, off, resetting it

Where: **My Account** › **Security** (the person's own account; nobody else can turn it on for them).

| Action | Button | What happens |
|---|---|---|
| Turn on with an app | **Enable authenticator app** | Scan the QR code (or type the key under **Can't scan? Enter this key in the app**), enter the app's 6-digit code → **Turn on**. The setup lives 10 minutes. |
| Turn on with e-mail | **Enable e-mail codes** | A code is mailed; enter it → **Turn on**. |
| Turn off | **Disable** | Asks the current code. **Turning it off signs you out on every device.** Refused while the organisation requires MFA (`MFA is required`). |
| Switch method (MFA required) | **Change method** | Asks the current code, signs the person out; the new method is set up at the next sign-in. |

- Which to recommend: the authenticator app ("Works offline: a new code every 30 seconds"); e-mail codes depend on the mailbox.
- There are **no recovery codes**. A lost phone = an owner or admin resets the person's MFA.
- Turning MFA ON does not sign the person out; the console renews the session and the changes open at once.
- Wrong codes: 5 wrong codes kill a mailed code or a pending setup; at most 5 mails per 15 minutes (`Too many attempts!`).

**Reset MFA (owner / admin, for a person who lost the device):** **Accounts** › the account › Danger zone › **Reset MFA**
→ "Reset this account's MFA? This ends their sessions; they set up MFA again at the next sign-in if the organization requires it."
- Never one's own account (use **Disable**). Never the owner's account. An admin's only by the owner.
- Every MCP account this person owns loses its sessions and becomes read-only until the person has MFA again (§9).

**Require MFA for every account (owner only):** the **Require MFA for every account** switch on the **Accounts** list.
- The owner must have MFA first (**Set up MFA on your account first (My Account › Security).**).
- Turning it on signs out every account without MFA; each sets it up at the next sign-in before using the console.

## 6. The idle lock and session expiry

- After about **20 minutes** without a request the console locks: an unclosable **Session locked** window asks the
  password (and the code, if the account has MFA). The page behind it keeps everything typed; after a correct password the
  work continues in place.
- A sign-in not used for about **two days** expires: the same window says **Session expired**.
- The third wrong password in that window ends the session → sign-in page. **Go to sign in** leaves at once.
- While locked every call is refused: **Session is locked — sign in again to continue**.
- **Your access changed — please sign in again.** = an owner / admin changed something about this person (role saved or
  changed, password or MFA reset, block, delete, MFA required). Just sign in again.
- Neither the idle lock nor a sign-out releases a record lock (see `record-locks.md`).

## 7. The sign-in block after too many wrong codes

20 wrong codes for one account within 24 hours block that account's sign-in (even with the right password and code).
The sign-in page says **Too many attempts!** + "Try again in about N hours." and never says that the code tripped it.

On the account's record the console shows **Sign-in blocked** — "Too many wrong sign-in codes. Sign-in is blocked until {time}."
- Owner / admin lift it: **Unblock** → **Unblock sign-in?** → "{email} can sign in again at once. The wrong codes counted so far are cleared."
- Not one's own block. The owner's block **ends by itself** (nobody can lift it). An admin's: only the owner.
- This is NOT **Block account** (that one shuts a person out on purpose until unblocked).
- Tell the person: if they did not type those codes, someone has their password — reset it (§4).

## 8. THE MFA GATE — what needs MFA and why

**The rule:** a person without MFA can READ whatever their role allows, but every change is refused — owner and admin
included. Refused: every create / update / delete, every import and export, every **Lock**, and these reads that hand out
credentials: a space's deployment token, a log record's stream token, a debugger ticket (attaching VS Code).

**Not gated:** reading; the person's own **My Account** (profile, password reset mail, MFA setup); signing in and out.

**What the console shows BEFORE the action** (the person never has to try first):
- on a create page, an Import or Export page, and in place of the record's **Lock** button: **Turn on two-factor sign-in
  first** — "Changes, imports, exports and record locks need a second factor on this account." + **Open Security**;
- on disabled buttons (Danger zone, Rotate …): the tooltip **Turn on two-factor sign-in to edit**.

**If a request still comes back refused:** `MFA required!` (403) + "Turn on two-factor sign-in in My Account › Security to continue."

**Why Keen asks for it (tell the person when they push back):** with only a stolen password, an attacker could
- rotate or delete API keys and stop every partner site at once, or start a site with new secrets;
- read a space's deployment token and deploy their own code as the agents;
- change agent settings or secrets, contracts and webhooks — redirect what the agents say and where data goes;
- create accounts, raise roles, export the organisation's people and end users in a file;
- lock records so the real team cannot edit, or attach a debugger and watch live conversations.
The second factor makes a password alone worth nothing for any of these.

**Fix:** tell the person to open **My Account** › **Security** and press **Enable authenticator app**. No sign-out needed.

## 9. How YOU (an MCP account) sign in

| Tool | When | Result |
|---|---|---|
| `mcp_login { id, secret }` | First, with the MCP account's id and secret | Either "Step 2 of 2" (a code is needed) or signed in at once read-only |
| `mcp_login_verify { code }` | After "Step 2 of 2" | Signed in "(confirmed by its owner)" — changes allowed, within the role |
| `mcp_login_resend {}` | The owner's method is e-mail and the code did not arrive | A new code is mailed to the owner (60 s apart, at most 3) |
| `logout {}` | When done, or to switch account | Ends the session on the server |

- Every MCP account has a human **owner**. The code you need is the OWNER's: from the owner's authenticator app, or mailed
  to the owner. Ask the person in the chat for that 6-digit code. It is good for 5 minutes; 4 wrong codes end the sign-in
  (call `mcp_login` again). Never ask for the MCP secret in the chat if the person already configured it; never repeat it.
- **Read-only sign-in:** without a ready owner the login succeeds but every change answers `MFA required!` with the note
  "This session is read-only: the MCP account's owner has not confirmed it". Causes and the fix (an owner / admin in the
  console: **MCP Accounts** › the account › **Owner** › **Change owner**; only people with two-step sign-in are offered):
  no owner named · the owner has no two-step sign-in · the owner is blocked or not confirmed · the owner's role does not
  cover the MCP account's role (every Read / Write / Import / Export switch of the MCP role must be on in the owner's role,
  unless the owner is owner / admin).
- So yes: the MFA gate applies to you exactly as to a person, through your owner. The credential reads (deployment token,
  log stream token, MCP consumer tokens) need the confirmed session too.
- 20 wrong owner codes in 24 hours block the MCP account's sign-in. An owner / admin lifts it on the MCP account's record:
  **Sign-in blocked** › **Unblock**.
- One session per MCP account: a newer completed sign-in elsewhere ends yours. Disabling the account, rotating its secret,
  changing its role, or the owner losing MFA / being blocked or deleted ends your session — sign in again.
- An MCP account can never be owner or admin and never opens **Accounts**, **Roles**, **MCP Accounts**, **My Account**,
  Import / Export or the debugger ticket (`MCP accounts may not access this resource`). Send the person there.
