# Service packages — one outside service, ready to install

> **Keen 15.3.**

A **service package** installs one outside service (Google, a shop, a CRM) into a workspace in one go: the part for the
partner site, the part for the Keen platform and the part for the agent project. Packages live in a catalog folder,
one folder per service (e.g. `keen_services/google/`); the person tells you where the catalog is. Install from it; build
a new package in the same format once a service works in a real project.

## The layout

```
<service>/
    SKILL.md                          what it does, how it works, the three parts in order, limits
    entanglement/                     → the site (`application_dir` in keen-project.json)
        INTEGRATION.md                    merge the two entries, the Secrets, the redirect URI, the check
        merge/<id>.connector.ts           the CONNECTORS entry  (src/configs/connectors.config.ts)
        merge/<id>.provider.ts            the PROVIDERS entry   (src/service/connectors/providers.ts)
        public/connectors/<id>.svg        the icon
    keen/                             → the platform (the person in the consoles, you through MCP)
        INTEGRATION.md                    the provider's console (the OAuth client, the redirect URI), the API key's
                                          Secrets card, the agent's Json Settings switches, the checks
        json-settings.json                the plain switch values (no secret)
    agent/                            → the agent project (`agent_project_dir`)
        INTEGRATION.md                    copy, register, the prompt, the skills, validate, deploy, test
        src/scripts/services/<service>/   service.js, connector.js, utils.js, settings.js (Services/SKILL.md)
        src/scripts/tools/<name>Tool.js   one tool per instrument
        src/keen-tools.json               the registry entries — MERGE, never overwrite
        system-prompt-tools.md            the tools section for the answering LLM node's system prompt
        .claude/skills/<service>-service/SKILL.md   each service's own skill
```

Every path under `entanglement/` and `agent/` is the path in the target folder.

## The rules of a package

1. **No OAuth code for the site.** The site's connector mechanism does the flow, the cookies, the token refresh and
   the revoke for every provider ([../Entanglement/connectors.md](../Entanglement/connectors.md)); a package brings
   only the two entries and the icon. An `adapter` in the provider entry only for a non-standard provider, with its test.
2. **No secret in a package.** The client pair goes on the API key's **Secrets** card, agent keys on the agent's
   **Secrets** card, both typed by the person; the package names them, never holds them.
3. **Merge, never overwrite**: `CONNECTORS`, `PROVIDERS`, `keen-tools.json`, the system prompt.
4. **The agent part follows the service standard** ([recipe.md](recipe.md), [access.md](access.md)): the tool imports
   only `service.js`; the token comes from the site cookie the connector sets; the house standard of the flow (every
   chat LLM: a Fallback LLM and a Summary → Summarizer, `../Flow/Nodes/SKILL.md`) is the project's, not the package's.
5. **The package states its version** — the Keen release it was built and run on — in its `SKILL.md`.

## Installing one

1. Read `keen-project.json` (`../ProjectSetup/keen-project.md`): `application_dir`, `agent_project_dir`, `application`.
2. `entanglement/INTEGRATION.md` → the site: merge the entries, copy the icon, `npx tsc --noEmit` and `npx vitest run`
   green.
3. `keen/INTEGRATION.md` → the person registers the redirect URI `<application>/api/<id>/callback` with the provider
   and types the client pair into the API key's **Secrets** card (**Save and restart**); you set the Json Settings
   switches through MCP.
4. `agent/INTEGRATION.md` → copy the services and tools, merge the registry, add the prompt's tools section, copy the
   services' skills; `keen-validate` (0 errors), `keen-deploy`, a runner test; add the token cookie to the site's
   `cookies` allow-list for this agent (`../Entanglement/SDK/setup.md` §5).
5. In the site: **Connect** in the Connections dialog, then a chat that uses each tool.

A package's `agent/` folder alone is not a project (it has no `src/flows/`): validate after merging it into the real one.

## Example

`keen_services/google/` — Google Connect for the site (one sign-in, refresh on the site), the `gmail` and `gdrive`
services with four tools (Gmail Recent, Drive Search, Drive Read, Drive Create), no agent Secret.
