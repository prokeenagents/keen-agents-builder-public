# Logs

## Description

**Logs** (console title **Log Management**) is the organisation's own audit log: who did what in the console,
through the API or through MCP, plus the platform's own errors. It has two tabs:

- **Channels** (**Channel Switchboard**) — five channels, one switch each, fleet-wide: **Action**, **Error**,
  **Warning**, **Debug**, **Info**. **Action** and **Error** are **Permanently engaged**: always on, nobody can
  switch them off.
- **Audit** (**Audit Browser**) — pick a **Sink** (**System / Action** … **System / Info**), see its dated daily
  files newest first, press **View** to read a file's newest lines (**The last 40 records, newest first.**).

This is NOT an agent's runtime log. What a flow or a script writes while it runs goes to a Log Record
([../Log Records/log-records-skill.md](../Log%20Records/log-records-skill.md)). Send the builder's own debugging
there, not here.

When the person needs Logs:

- "Who changed this agent / key / role, and when?" — the **Action** sink.
- "Why did the platform fail?" — the **Error** sink (the platform's own failures, not a flow's).
- Investigating refused sign-ins or other refusals — switch **Warning** (or **Debug**) on for a while, read, switch
  it off again.
- An audit question from a client or a security review.

What a line contains: one JSON record `{ timestamp, level, channel, message }`. An action line names who did it
(e-mail / user id / role; an MCP account by its id, it has no e-mail) and the record it touched, by id and often by
name. Examples of what writes an action line: sign-ins and sign-outs, creating / changing / deleting any record,
reading a space's deployment token, revealing a Log Record's stream token, record locks, switching a log channel,
the debugger switch and every debug attach, cache builds.

What it never contains: a password, a sign-in code, a token, an API key, a key secret, a certificate's secret, an
agent secret's value (only how many names were saved). A refused sign-in never names what was typed. A chat's
messages, prompts, answers, the dictionary and the session are not in it either.

Retention: 30 days of daily files per channel; the oldest day goes. A line written while its channel was off is
lost — switching on does not bring it back.

## Who may

| Right | Opens |
|---|---|
| `l1` (Logs · Read) | Both tabs, the files, the tails. |
| `l2` (Logs · Write) | The channel switches (and everything of Log Records). |

- Owner and admin always have both.
- Without `l1` the sidebar row **Logs** is hidden and the page shows **You don't have access to this page**.
- With `l1` only, the **Status** column shows **On** / **Off** badges instead of switches.
- **Action** and **Error** can be switched by nobody, owner included. The badge **Permanently engaged** shows; the
  platform refuses an attempt through the API too.
- See [../../references/rights.md](../../references/rights.md).

## MFA

Switching a channel is a change, so it needs two-step sign-in on the person's account. Without it the switch is
refused with `MFA required!` (the console: **Turn on two-factor sign-in first**). Reading never needs MFA.

Why: with only a stolen password someone could switch **Warning** off to hide the warnings about refused sign-ins,
or switch **Debug** on to flood the files. For an MCP session the owner's code counts: a read-only MCP session can
read but not switch. See [../../references/sign-in-and-mfa.md](../../references/sign-in-and-mfa.md).

## Through MCP

**Reachable through MCP: yes.**

| Tool | What it does | Needs |
|---|---|---|
| `list_log_settings` | The switchboard: one row per channel, `id` = the channel name, `value` = on. | `l1` |
| `update_log_setting { id }` | FLIPS one channel (`warning`, `info`, `debug`). It is a toggle, not a set: read the state first. | `l2` + MFA |
| `get_log_audit { audit }` | A sink's file list (`system-action`, `system-error`, `system-warning`, `system-debug`, `system-info`), newest first, plus the channel's on/off. | `l1` |
| `get_log_file { filename }` | The newest lines of one file, e.g. `system-action-2026-11-12.log`. | `l1` |

Notes for the builder:

- File names come from `get_log_audit` without `.log`; add `.log` for `get_log_file`. The warning sink's files are
  named `system-warn-<date>`, not `system-warning-<date>`.
- `update_log_setting` on `action` or `error` is refused with the general `Not Acceptable`. Do not retry.
- Calling `update_log_setting` twice puts the channel back. Always `list_log_settings` before and after.
- A switch is fleet-wide and acts from that moment. Tell the person before you switch **Debug** on, and switch it
  back off when the investigation is over.

**Not through MCP — tell the person:** nothing is missing. The console is only easier for browsing:
**System → Logs → Audit**, pick the **Sink**, press **View** on a day, **Refresh** for newer lines, **Copy** to copy
them.

## Create

Not available — the five channels are created by the platform itself. Nobody adds or renames a channel.

## Change

Switching a channel is the only change. There is no record lock and no confirmation (it is reversible).

1. **System → Logs → Channels**.
2. Find the row (**Warning**, **Debug** or **Info**) and flip the switch in **Status**.
3. The toast says e.g. **System / Warning channel turned off**. A refusal shows in an Alert above the table and the
   row keeps its old state.

The switch itself writes an action line: `Log Settings: <who> set log setting: <channel> / <true|false>`.

**How the change reaches what runs:** immediately, fleet-wide — every service starts or stops writing that
channel's lines. Nothing restarts; no chat or agent is affected. See
[../../references/delivering-changes.md](../../references/delivering-changes.md).

## Delete

Not available — channels, files and lines cannot be deleted from the console or MCP. Files age out after 30 days.

## Import / Export

Not available for Logs. To keep a copy, the person uses **Copy** in the file drawer. See
[../../references/import-export.md](../../references/import-export.md).

## Mistakes that break it

| Mistake | What happens | Do instead |
|---|---|---|
| Looking here for a flow's `Log.*` lines or a node failure | They are not here — this is the audit log | Use the agent's Log Record |
| Calling `update_log_setting` to "make sure it is on" | It flips: an on channel goes off | `list_log_settings` first; call only if the state is wrong |
| Leaving **Debug** on after an investigation | Every service writes debug lines fleet-wide; the files grow | Switch it off when done |
| Expecting lines from the time a channel was off | They were never written | Switch on first, then reproduce the problem |
| Asking `get_log_file` for `system-warning-<date>.log` | Refused (no such file) | Use the names `get_log_audit` returns (`system-warn-<date>`) |
| Treating **View** as the whole day | It is a tail of the newest lines | Read the day's file again later with **Refresh** for newer lines |

## Example

The person: "Someone changed the Support agent's start flow yesterday and the chat broke. Who was it?"

1. Builder: `get_log_audit { audit: "system-action" }` → the newest file names.
2. Builder: `get_log_file { filename: "system-action-2026-11-11.log" }` → look for an `updated agent` line naming
   the agent; it names who (e-mail / id / role) and when.
3. If yesterday's tail does not reach far enough back, tell the person: "Open **System → Logs → Audit**, pick
   **System / Action**, press **View** on 2026-11-11 and press **Copy**, then paste the lines here." (These lines
   carry no secrets, so pasting them is fine.)
4. If the question is about refused sign-ins: `list_log_settings` → **Warning** is off → tell the person you will
   switch it on fleet-wide, `update_log_setting { id: "warning" }`, ask them to reproduce, read
   `get_log_audit { audit: "system-warning" }` and the newest `system-warn-<date>.log`, then
   `update_log_setting { id: "warning" }` again to switch it off, and `list_log_settings` to confirm.
