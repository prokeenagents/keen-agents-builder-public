# Import / Export

Move a kind's records out of an organisation as a file, and into an organisation from such a file — to copy a setup to
another instance, keep a copy, or edit in bulk. An import only CREATES and UPDATES; it never deletes. No export ever
carries a secret.

**Reachable through MCP: no.** There is no import or export tool, and the routes refuse an MCP account. The builder can
PREPARE a file (write the NDJSON for the person) and then tells the person what to click.

## 1. Which kinds, and who may

| Kind | Who may import / export | Matched by (natural key) |
|---|---|---|
| Roles | owner / admin | slug |
| Accounts | owner / admin | e-mail |
| MCP accounts | owner / admin | name |
| Spaces | `sp3` / `sp4` | title |
| Agents | `ag3` / `ag4` | agent ID |
| Contracts | `co3` / `co4` | contract key |
| Consumers | `cs3` / `cs4` | e-mail (+ the contract) |
| Clients | `ct3` / `ct4` | name |
| Webhooks | `wk3` / `wk4` | name |

**Never** importable or exportable (no page at all): certificates, API keys, logs, log records, MCP consumers.

- Import and Export are switches on the role's board under Write: on only while Write is on (see `rights.md`).
- People only, and MFA is required: without it the pages show **Turn on two-factor sign-in first**; a call answers
  `MFA required!`.
- A person without the switch sees no Import / Export entry; a direct link shows **You don't have access to this page**.

**Where:** the section's sidebar rows **Import** and **Export**; on the list page **Import** (next to the primary button)
and **⋮** › **Export**; the section's landing page cards.

## 2. The file

- **NDJSON**: one JSON object per line, UTF-8. Optionally gzip-compressed (`.ndjson.gz`, detected by its content).
- Every line carries `"type"` = the kind. A file of another kind is refused.
- The kind's JSON Schema is the COMPLETE list of fields. Any other key is an error (the whole file is invalid). Keys
  starting with `$` (`$meta`: dates, lock state, names) are information only and ignored on import.
- A reference to another record is `{ id, <its natural key> }` (e.g. an agent's `space: { id, title }`), so another
  organisation finds the same record by its name or key even though the id differs. `id` is optional on import.
- The template: **Download the template** on the Import page (the schema).
- What each kind's line holds:

| Kind | Fields on a line |
|---|---|
| Roles | title, slug, levels (the permission switches), system |
| Accounts | e-mail, role — no names, no password, no second factor |
| MCP accounts | name, role, enabled — no secret, no owner |
| Spaces | title, description — no deployment token |
| Agents | agent ID, display name, start flow, start node, active, space, Json settings, Front settings — no secrets |
| Contracts | name, key, the registration policy switches, the three space lists — no API key binding, no webhook |
| Consumers | e-mail, contract, external, spaces — no password, no sign-in tokens |
| Clients | name — no secret, no secret prefix, no API key binding |
| Webhooks | name, origin, webhook URL (masked), webhookMasked — no API key binding |

## 3. What is NEVER carried

- Passwords, second factors, session data (accounts, consumers).
- Secrets, secret prefixes and tokens (MCP accounts, clients, spaces' deployment tokens).
- API key bindings (clients, contracts, webhooks) — API keys themselves never move.
- **An agent's Secrets: never — not the values and not even the names.** The agent schema has no field for them, so a
  line that tries to carry them is refused. After an import the person types them again on the agent's Secrets card.
- Webhook URLs leave **masked**: the last path segment (where a partner may keep a secret) becomes `KEEN-MASKED-<id>` and
  the query is dropped.
- **Agent Json / Front settings ARE exported as they are** — "Json and Front settings are exported as they are — remove
  anything secret from them first." Never put a secret in settings; secrets belong in the agent's Secrets.

The Export page shows the list per kind: **Never exported: {fields}.**

## 4. Limits

| Limit | Value |
|---|---|
| File size | 256 MB (compressed size); 1 GB decompressed |
| Lines | 200,000 |
| One line | 1 MB (an agent line 6 MB) |
| Picked records in one export | 10,000 |
| File name | letters, digits, `_` and `-`, up to 120 (`Invalid file name!`) |
| Jobs | one import or export per kind at a time (`A job is already running for this kind!`) |
| Unfinished upload | dropped after 30 minutes without a piece (`Unknown upload!`) |
| Keeping files | exports, uploads and failed-records files are deleted after 7 days by default |

## 5. Export — the console steps

1. Open the kind's **Export** page.
2. Choose: **All {objects}** · **The list's filters** (accounts, MCP accounts, consumers, roles; the list's **⋮** ›
   **Export** carries the current filters) · **Picked {objects}** (tick rows in the table inside the card).
3. **File name** (the worker appends `_exported` and the extension; an existing name is refused) and **Compress the file
   (gzip)**.
4. **Start export** → **Export started**. When the job finishes, **Download** in the **Exports** table.

An export never locks anything. A downloaded file names people, partners and end users — treat it as that data.

## 6. Import — the console steps

1. Open the kind's **Import** page. Follow the recommended order when moving a whole setup: Roles → Accounts → MCP
   accounts → Spaces → Agents → Contracts → Consumers → Clients → Webhooks (nothing points backwards).
2. **Choose file** (or drop it) → **Upload**. The browser checks the size, fingerprints the file and sends it in pieces;
   **Cancel** stops it. Refusals: `File too large!`, `File already exists!`, `Checksum mismatch!`, `Incomplete upload!`.
3. Open the uploaded file (its name in the files table) → the file page.
4. **Operation**: **Create** (default — "Only records that do not exist yet are created; a line matching an existing record
   … is skipped") or **Merge** ("Create what is new, update what exists — only the fields present on the line are written").
5. **Run import**. The whole file is VALIDATED first (shape, schema, rules, identities, references); nothing is written yet.
   - Invalid: "{invalid} of {total} lines are refused. Nothing was written." + the problems by line (the first 200) +
     **Download failed records** (each bad line with its error) to fix and upload again.
   - Valid: the import starts by itself and shows as a second job; the jobs table refreshes every 5 s.
6. **Accounts and consumers ask first**: the first **Run import** only validates and reports how many mails would go;
   pressing **Run import** again asks "… {n} mails will be sent. Run the import?" → **Yes**. Accounts get an invitation
   (24 hours; an owner / admin can resend), consumers a confirmation mail (24 hours, no resend).
7. A running job can be cancelled (its starter or the owner): it stops after the current line; lines written stay.

**Validate only** = the first Run on accounts / consumers. For other kinds there is no separate button: a file that
passes validation is imported at once — so validate with care, or prepare the file and let the person review it first.

## 7. What an import does to records that exist

- Matching: by `id` first, then by the natural key (§1). Two candidates → `Ambiguous match (n candidates)`, the line is
  refused. Ids are never carried over: a created record gets a new id.
- **Create** skips every match (a "duplicate"). **Merge** updates only the fields on the line; a line that changes
  nothing is skipped as unchanged. Nothing is ever deleted.
- Skipped on purpose: the built-in roles (owner, admin, default; developer on Create), the owner's account, the
  importer's own account line, a blocked account on Create.
- The usual rules and caps apply (e.g. `Too many agents!`, `Name already exists!`); `The key of a contract cannot be changed
  by an import!`; `The space of an agent cannot be changed!`.
- The import writes AS the person who started it, one record at a time; one refused line does not stop the others.
- **Locks:** the import TAKES OVER a record someone else holds, writes it and releases it. The holder's next save is
  refused with `Locked by <the importer's e-mail> …`. Warn the team before a Merge.
- Re-importing the same file is safe.

## 8. After an import — what the person must do

| Kind | What the import made | What to do |
|---|---|---|
| Accounts | unconfirmed accounts + invitation mails (24 h) | each person confirms and sets a name and a password |
| Consumers | unconfirmed consumers + confirmation mails (24 h, no resend) | each end user confirms |
| MCP accounts | the account with a secret nobody holds ("Imported without a secret"); the importer is its owner | **Rotate** once to get the secret; check the owner |
| Clients | the client with a secret nobody holds | **Rotate** once ("The partner's server cannot sign in until then.") |
| Spaces | a new deployment token | reveal or reset it and update the project's `.env` / `keen.json` |
| Webhooks | a masked URL ("Re-enter the URL") | re-enter the real URL; until then no API key can bind it (`Re-enter the webhook URL first!`) |
| Contracts | same key, policy and space lists | bind an API key |
| Agents | the agent with its settings, no secrets | check the settings; type the secrets again |
| Roles | the role with its switches | check the switches |

API keys and certificates never move: create them on the new instance. A partner site that used the old instance's
secrets keeps failing until the new ones are handed over — plan a window.
