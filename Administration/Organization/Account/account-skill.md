# My Account

## Description

My Account (route `/account`, opened from the header's account menu → **My account**) is the signed-in person's
**own** page. It has five cards:

- **Profile** — first and last name (the only thing the person edits about themselves).
- **Details** — e-mail, role, **Active** / **New**, **Blocked**, **Confirmed**, created date (read-only: "Email, role and
  status are managed by the organization — contact an administrator to change them.").
- **Password** — **Send Reset Mail** (a password change always goes through the mail link).
- **Security** — two-step sign-in: off, **E-mail code** or **Authenticator app**.
- **MCP accounts that ask your code** — the MCP accounts this person owns (name, Enabled, last login, **Ready** /
  **Read-only**).

There is no sessions card: **Logout** sits in the header's account menu; a password reset or an MFA change ends the
sessions on the server.

The person needs this page when:

- they must turn on two-step sign-in — **every change anywhere in the console needs it**, and so does owning your MCP
  account;
- `mcp_login` says your owner "has no two-step sign-in";
- they want to check which MCP accounts (you) ask their code;
- they forgot their password while still signed in, or want a new one;
- they changed phone (switch the method).

Related: [Accounts](../Accounts/accounts-skill.md) (an owner / admin resets other people), [MCP Accounts](../MCP%20Accounts/mcp-accounts-skill.md)
(why the owner's factor matters to you), [sign-in-and-mfa.md](../../references/sign-in-and-mfa.md).

## Who may

Any signed-in **person**, for their own account only — no right is needed and no other account can be targeted. An MCP
token is refused on this page (`MCP accounts may not access this resource`).

## MFA

- Nothing on this page needs MFA first — it is where MFA is turned on.
- Turning two-step sign-in **on** lifts the console's **Turn on two-factor sign-in first** gate at once (the session is
  renewed with the factor); the person does not sign in again.
- **Why it matters:** without two-step sign-in the person is read-only everywhere (`MFA required!` on every change,
  lock, import, export), cannot create an MCP account and cannot be an MCP account's owner — so you would be read-only.
- When the organization requires MFA (**Require MFA for every account**), it cannot be turned off here, only switched
  ("Your organization requires two-factor sign-in, so it cannot be turned off — use Change method to switch to another
  method. An owner or an admin can reset it if you lose your device.").
- There are no recovery codes: a lost device is reset by an owner or admin (Accounts › **Reset MFA**). The owner's own
  factor can be reset by nobody, so the owner should keep the device safe.

## Through MCP

**Reachable through MCP: no.** You cannot read or change the person's account. Everything is console steps.

**Not through MCP — tell the person** (header → account menu → **My account**):

| Need | Console steps |
|---|---|
| Turn on two-step sign-in (app) | **Security › Enable authenticator app** → scan the QR (or type the key) → enter the app's 6-digit code → **Turn on** |
| Turn on two-step sign-in (e-mail) | **Security › Enable e-mail codes** → enter the mailed code → **Turn on** |
| Turn it off (not required) | **Security › Disable** → the current code → **Turn off** |
| Switch method (required) | **Security › Change method** → the current code → **Change method** → sign in again and set up the new one |
| New password | **Password › Send Reset Mail** → confirm → open the mail link |
| Change the display name | **Profile** → First name, Last name → **Save** |
| See the MCP accounts that ask their code | the **MCP accounts that ask your code** card |

## Create

Not available — the account is created by an invitation (see [Accounts](../Accounts/accounts-skill.md)). What this
page "creates" is the second factor:

| Step | Authenticator app | E-mail code |
|---|---|---|
| Start | **Enable authenticator app** | **Enable e-mail codes** |
| Link | QR code + "Can't scan? Enter this key in the app" (the key is shown only during the setup) | "We sent a code to {email}." |
| Confirm | the app's 6-digit code → **Turn on** | the mailed code → **Turn on** |
| Done | toast "Two-factor sign-in is on" | same |

A wrong code: "The code is not valid or has expired." Too many wrong codes: "Too many wrong codes. Start the setup
again." The setup expires after 10 minutes; start again.

## Change

No record lock on this page.

| Action | Confirm / step | What it stops at once |
|---|---|---|
| **Profile › Save** | — (toast "Profile updated") | nothing; the header shows the new name with the next token |
| **Send Reset Mail** | "Send a reset mail to {email}? Your current password stops working the moment it is sent." | the current password, and every session of the account; sign in again after the link set the new one |
| **Disable** | the current code; "Turning it off signs you out on every device." | every session; owned MCP accounts' sessions — they go read-only |
| **Change method** | the current code | every session (signed out to the sign-in page, which sets up the new method); owned MCP accounts go read-only until the new method is on |
| **Enable** | the setup above | nothing ends; owned MCP accounts become ready by themselves |

If the person owns MCP accounts, Disable / Change method add: "You own N MCP account(s); their sessions end, and they
become read-only until you have two-step sign-in again or a new owner is named." **Warn the person before they do it
while you are working.**

**How the change reaches what runs:** immediately for the person's sessions and for the MCP accounts they own (your
session ends within about a minute; sign in again once their factor is back). Nothing else in the organization is
affected. See [delivering-changes.md](../../references/delivering-changes.md).

## Delete

Not available — a person cannot delete their own account; an owner or admin does it on Accounts (never the owner's).

## Import / Export

Not available for My Account.

## Mistakes that break it

| Mistake | What happens | Do instead |
|---|---|---|
| No two-step sign-in | read-only everywhere; cannot own or create an MCP account | **Enable authenticator app** or **Enable e-mail codes** |
| Disabling MFA while you (the builder) work | your session ends; you are read-only | finish first, or name another owner |
| Expecting a password field | there is none; only **Send Reset Mail** | send the mail, open the link |
| Sending the reset mail "just to check" | the current password stops working at once | only when a new password is wanted |
| Losing the phone with no recovery | cannot sign in | an owner / admin uses **Reset MFA** (the owner's cannot be reset) |
| Reading the owner's code to you from a stale app entry | "The code was not accepted" | the current code; 4 wrong end the sign-in |

## Example

Goal: `mcp_login` answered `Logged in READ-ONLY … its owner has no two-step sign-in`, and the owner is the person you
work with.

1. Tell the person: "Open the account menu in the header → **My account** → **Security** → **Enable authenticator
   app**. Scan the QR code, type the 6-digit code the app shows, press **Turn on**."
2. Tell them: "Check the card **MCP accounts that ask your code** — my account should now say **Ready**."
3. Call `logout`, then `mcp_login` again (a read-only session never upgrades in place); on "Step 2 of 2" ask for the
   code from their app and call `mcp_login_verify { code }`.
