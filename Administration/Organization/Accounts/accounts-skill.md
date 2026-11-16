# Accounts

## Description

Accounts are the **people** who sign in to the organization console: an e-mail, a first and last name (the person sets
them), exactly one **Role**, a status (**New** until they confirm, then **Active**), a **Blocked** flag, and their
two-step sign-in (**MFA Off** / **MFA E-mail** / **MFA App**). Every person is invited by e-mail; there is exactly one
**owner**, created once when the organization is activated.

The person needs this page when:

- a colleague must get console access (invite them with a role);
- the invitation mail expired or was lost (**Resend invitation**);
- someone forgot their password or lost their phone (**Reset password**, **Reset MFA**);
- someone must be stopped at once (**Block account**) or removed (**Delete account**);
- someone is locked out after too many wrong codes (**Sign-in blocked › Unblock**);
- your MCP account's owner must change, or the owner has no two-step sign-in (it is a person here).

Related: [Roles](../Roles/roles-skill.md) define what a role allows; [My Account](../Account/account-skill.md) is the
person's own page; [MCP Accounts](../MCP%20Accounts/mcp-accounts-skill.md) name a person here as their owner.
Shared mechanics: [sign-in-and-mfa.md](../../references/sign-in-and-mfa.md), [rights.md](../../references/rights.md).

## Who may

- **Only the owner and administrators, as persons.** Reads included: the `a` scope is never grantable, so no custom
  role opens this section, and an MCP token is always refused. Anyone else does not see it in the sidebar
  (**You don't have access to this page**).
- **The hierarchy** (checked on the server; every refusal is `Not allowed!`):
  - nobody acts on the **owner's** account (only the owner resets their own password from My Account); an admin does
    not see the owner's row in the list;
  - only the owner acts on an **admin's** account, and only the owner may invite or grant `admin`;
  - nobody changes their **own** role, blocks, deletes or resets the MFA of their own account;
  - `owner` is never offered and never granted.
- **Require MFA for every account** (the list's switch): the owner only, and only once the owner has two-step sign-in.

## MFA

- Every change here — invite, role change, Block / Unblock, Reset password, Resend invitation, Reset MFA, Unblock
  sign-in, Delete, Lock, import, export — needs the acting person's two-step sign-in. Without it: **Turn on two-factor
  sign-in first** in the console, `MFA required!` on the wire. Reading the list does not.
- **Why:** this page hands out and removes access. With only a stolen password, someone could invite themselves as
  admin, reset another person's MFA, or delete the people who would notice.
- **Require MFA for every account** ON: accounts without a factor are signed out now and must set one up at their next
  sign-in before they can use the console.

## Through MCP

**Reachable through MCP: no.** The Keen MCP server has no account tools: you cannot list, read, invite or change people, and you
cannot see your own owner's account.

**Not through MCP — tell the person** (sidebar **Organization › Accounts**):

| Need | Console steps |
|---|---|
| Invite | **Accounts › Create Account** → Email, Role → **Create** |
| Change a role | open the account → **Lock** → **Role** → **Save** |
| New invitation link | open the **New** account → **Danger zone › Resend invitation** |
| Forgotten password | open the account → **Danger zone › Reset password** |
| Lost phone / mailbox | open the account → **Danger zone › Reset MFA** |
| Stop someone now | open the account → **Lock** → **Danger zone › Block account** |
| Lift a wrong-code block | the **Sign-in blocked** alert → **Unblock** |
| Remove someone | open the account → **Lock** → **Danger zone › Delete account** |
| Everyone must use MFA (owner) | **Account List** → switch **Require MFA for every account** |

## Create

Path: **Organization › Accounts › Create Account** (or the list's **New account**). No lock needed.

| Field | Required | Limits | Note |
|---|---|---|---|
| **Email** | yes | a valid e-mail, up to 254 characters, unique | "The confirmation link is emailed here — the user finishes the registration themselves." |
| **Role** | yes | any role except `owner`; `admin` only when the person is the owner | can be changed later |

Refusals (verbatim): `This account is already created!` · `No such role!` · `Not allowed!` · `Forbidden` ·
`MFA required!`; in the form: `Enter a valid email` · `Email must be at most 254 characters` · `Role is required`.

**Right after:** toast `Account "<email>" created — confirmation email sent`; the account shows **New**. The mail's
link is valid **24 hours**. On it the invitee enters the e-mail, first name, last name and a password (12 to 128
characters, `Password must be 12 to 128 characters!` otherwise) and confirms. Then the account is **Active** and can
sign in. If the organization requires MFA, the first sign-in sets it up.

## Change

The role change, Block / Unblock and Delete need the record lock — see
[record-locks.md](../../references/record-locks.md) (**Lock** in the banner; 30 minutes from the last save). The
credential actions (Reset password, Resend invitation, Reset MFA, Unblock sign-in) need no lock of their own and are
refused only while someone else holds it.

| Action | Shown when | Confirm (verbatim) | What it stops at once |
|---|---|---|---|
| **Role** + **Save** | not the owner, not yourself, an admin only for the owner | — ("Changing the role signs the account out; its new permissions apply at its next sign-in.") | the person's sessions; the sessions of the MCP accounts they own (re-checked against the new role) |
| **Resend invitation** | **New** and not blocked | "Resend the invitation to {email}? A new link goes out, valid 24 hours. The link sent earlier stops working." | the earlier link |
| **Reset password** | **Active** | "Reset the password of {email}? Their current password stops working now; the link in the mail sets the new one." | the password and the sessions |
| **Reset MFA** | has a factor (else "No two-factor sign-in to reset.") | "Reset this account's MFA? This ends their sessions; they set up MFA again at the next sign-in if the organization requires it." | sessions; owned MCP accounts go read-only until the person enrolls again |
| **Block account** | as Role | "Block {email}? They are signed out at once and cannot sign in until the account is unblocked; they are told by mail." | sessions; owned MCP accounts go read-only |
| **Unblock account** | blocked | "Unblock {email}? They can sign in again." | nothing; owned MCP accounts are ready again by themselves |
| **Unblock** (Sign-in blocked) | 20 wrong codes in 24 h | "{email} can sign in again at once. The wrong codes counted so far are cleared." | nothing |

Resend invitation is capped at **3 per account per 24 hours**: `Too many attempts! Try again after {time}.` Other
refusals: `This account is already confirmed!` · `Unblock the account first!` · `Not confirmed yet — resend the
invitation instead!` (Reset password on a **New** account). A typo in the e-mail is fixed by delete + create.

The **sign-in block**: 4 wrong codes end one sign-in attempt; 20 wrong codes in 24 hours block the person's sign-in
for 24 hours. The owner's own block cannot be lifted by anyone — it ends by itself.

When the person owns MCP accounts, the confirms of Role, Block, Reset MFA and Delete add: "This person owns N MCP
account(s); their sessions end, and they become read-only until <name> is eligible again or a new owner is named."
If that is **your** owner, tell the person you will be read-only after it.

Names and the e-mail cannot be changed here — the person changes their own names on My Account.

**How the change reaches what runs:** immediately. A role change, password reset, MFA reset, block or delete ends the
person's console sessions at once (an open console shows "Your access changed — please sign in again."). Agents, keys
and partner sites are not affected. See [delivering-changes.md](../../references/delivering-changes.md).

## Delete

Record → **Lock** → **Danger zone › Delete account** → "Delete the account {email}? It loses access at once and its
sessions end." The owner's account and your own cannot be deleted; an admin's only by the owner. The MCP accounts the
person owned lose their owner (read-only until a new owner is named). It cannot be undone — invite again for a new
account.

## Import / Export

Supported (owner / admin, with two-step sign-in), see [import-export.md](../../references/import-export.md).
Carried: e-mail and role. Never carried: the password, the confirmation link, the second factor, the names. An import
**creates invitations**: "Every new account in this file gets an invitation mail, valid 24 hours (an owner or an
administrator can resend it)." An existing e-mail only gets its role updated.

## Mistakes that break it

| Mistake | What happens | Do instead |
|---|---|---|
| Asking to invite with role `owner` | refused `Not allowed!` | there is one owner; use `admin` (owner only) or a custom role |
| An admin acting on another admin | `Not allowed!` | the owner does it |
| Reset password on a **New** account | `Not confirmed yet — resend the invitation instead!` | **Resend invitation** |
| Resending more than 3 times a day | `Too many attempts!` | wait; or delete + create with the right e-mail |
| Blocking / resetting MFA of your MCP account's owner | you go read-only at once | name another owner first on the MCP account |
| Changing a person's role to a narrower one | their owned MCP accounts become read-only (`not-covered`) | widen the role or change the MCP account's owner |
| Person without MFA tries to change anything | `MFA required!` | My Account › Security first |

## Example

Goal: a new developer, `dev@company.com`, must review agents in the console.

1. You cannot invite through MCP. Tell the person: "Open **Organization › Accounts › Create Account**, Email
   `dev@company.com`, Role `Developer`, **Create**."
2. Tell them: "The invitation link works 24 hours. If it expires, open the account and press **Danger zone › Resend
   invitation**."
3. Later the developer locks themselves out with wrong codes. Tell the person (owner / admin): "Open the account; in the
   **Sign-in blocked** alert press **Unblock** and confirm."
