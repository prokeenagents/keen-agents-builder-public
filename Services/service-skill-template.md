# The service's skill — recommended for every service

Every service should carry a skill (recommended, not mandatory): when and why to use each instrument, its input and reply, its limits and errors, the
connection's steps, the Secret / setting / cookie names, and what the person sets in the console. It is how the next
builder session (or a person) changes the service without re-reading the code and the API's documentation. A
service is not finished until its skill is written, and every change to an instrument, a name or a limit updates it
in the same change.

## 1. Where it lives — and why

**`<project>/.claude/skills/<service-in-kebab>-service/SKILL.md`** — e.g. `shopApi` →
`.claude/skills/shop-api-service/SKILL.md`. One folder per service; the kebab name is the camelCase folder name with
dashes, so the pair is mechanical.

The evidence, checked in the code on 2026-11-12:

| Option | What happens | Verdict |
|---|---|---|
| beside the code: `src/scripts/services/<service>/SKILL.md` | **keen-deploy uploads it** — it zips everything under `scripts/` except dot-entries, `node_modules` and `.zip` files. **The platform's deploy accepts it** — the structure check looks only at `flows/` (flat, only `.js`) and needs `scripts/**/debux.js`; the security scan reads only `*.js`. keen-validate reads only `.js` there (0 errors, 0 warnings on a scratch copy with the file). So it is not refused — it is **shipped into the platform's deployed project**, where no engine reads it, and Claude Code does not load it from there | no: documentation does not belong in the deployed project |
| `src/scripts/…` anything else | the same | no |
| `<project>/.claude/skills/<name>/SKILL.md` | **never uploaded**: `.claude` is a top-level dot-entry outside `src/` (keen-deploy zips only `src/flows`, `src/scripts`, `src/keen-tools.json` and skips every dot-entry at any depth). It travels with the project in git. Claude Code loads project skills from `.claude/skills/<name>/SKILL.md` on its own, so the builder working in this project gets it without being told | **yes** |

What "carry" costs: the skill is not inside the service folder, so **copying a service to another project copies
two folders** — `src/scripts/services/<service>/` and `.claude/skills/<service-in-kebab>-service/` (and its tools).

Claude Code's rules for the file: the folder name and the `name:` field use lowercase letters, digits and dashes;
the `description:` says when to load it (name the service, its tools, its Secret, setting and cookie names).

## 2. The template

Copy it, fill every section, delete nothing (write "none" where a section has nothing).

```markdown
---
name: <service-in-kebab>-service
description: The <Service> service of this agent project (<one line: what the external API is>) — its tools <Tool A>, <Tool B>, when the model should use each, their inputs and replies, the limits and errors, how service.js connects (<the Secret names>, <the cookie name>), the Json Settings switch <name>_available, and what the person must set in the console. Use it whenever you change, extend, debug or test anything under src/scripts/services/<service>/ or its tools, or when the person mentions <the service>, <its main objects>, <the Secret names>.
---

# <Service> service

Where it lives: <agent side | agent side + site side (what the site does)>.

Files: `src/scripts/services/<service>/{service,connector,utils,settings}.js`; the tools
`src/scripts/tools/<…>Tool.js`; their entries in `src/keen-tools.json`; their descriptions in the system prompt of the
LLM node <label> (`src/flows/<Flow>.flow`, agentId `<slug>`).

## Instruments

| Tool (`keen-tools.json` name) | Method | When the model uses it (and when not) | Input (`!*context`) | Reply (JSON) |
|---|---|---|---|---|

Every failure replies `{"ok": false, "retryable": <bool>, "error": "…"}`.

## Connection — the steps of each tool

1. The Json Settings switch and values.
2. The Secrets (names) and, for per-person calls, the cookie (name).
3. `<Service>Service.connect(credentials, options)` → what `connector.js` sends with every request (header names,
   never values); a token fetch if any (§ OAuth in access.md).
4. How a status and a transport throw become errors.

## Configuration — what the person sets

| What | Where (exact console path) | Value |
|---|---|---|

## Limits

The service's own (sizes, quantities, id patterns, page size) and the `system/http` ones that bite it.

## Errors the model may read

| Error text (start) | Cause | Retryable |
|---|---|---|

## Changes that need care

Actions that change something: how they are safe to run twice, who decides the rights.

## Testing

The runner prompts that exercise each tool, the cookie / switch cases, what a correct reply looks like.
```

## 3. A filled example

`examples/shopApi/project/.claude/skills/shop-api-service/SKILL.md` — the ShopApi service of the example project:
three tools, `SHOP_API_KEY`, the `shop_session` cookie, the `shop_available` / `shop_title` / `shop_api_url` Json
Settings, its errors and its tests. Read it next to its code.

## 4. Checks before you call the service done

- The skill exists at `.claude/skills/<service-in-kebab>-service/SKILL.md` and names every tool in `keen-tools.json`
  that imports the service.
- Every method `connect` returns has a row; every Secret, Json Setting and cookie the tools read is named; no value
  of a secret appears anywhere in it.
- The inputs and replies match the system prompt's tool entries word for word.
- No tool checks this yet — `keen-validate` reads only `.js`, `.flow` and `keen-tools.json`. Check it yourself.
