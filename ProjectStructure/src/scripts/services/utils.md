# `src/scripts/services/<service>/utils.js`

## Description

Small helpers that `service.js` and `connector.js` both use: cleaning and cutting text, clamping numbers, checking
a URL, building the service's error in plain words, mapping an HTTP status to a sentence. One service's helpers
stay in its own folder, so a service can be copied to another project as one folder.

The standard wants it so that the instruments and the connector stay short and read as steps, and so that every
error the model sees about this service is worded in one place.

## Location and name

- `src/scripts/services/<service>/utils.js` — required (house standard), exactly this name. When the service needs
  no helper yet, the file still exists with the error helper, which every service has.
- Imported with `'./utils.js'` from `service.js` and `connector.js` only. The tool never imports it: the tool
  imports only `service.js`, which re-exports anything a tool needs.

## Structure

| Export | Required | What it is for |
|---|---|---|
| `serviceError(message, retryable)` | yes | an `Error` with a `retryable` flag; the one way this service throws |
| `describeStatus(status)` | when the service speaks HTTP | a status → a sentence the model can repeat |
| other pure helpers (`cleanText`, `clampInt`, `normaliseBaseUrl`, a date formatter, a response mapper) | as needed | shared by service and connector |

What belongs here: **pure functions** — the same input always gives the same output, nothing outside the
function changes. They may read constants from `./settings.js`.

What does NOT belong here (house standard): any `system/*` import — no `system/http` (I/O is the connector's), no
`system/secrets` or `system/settings` (the tool's), no `system/log`, `system/agent`, `system/session`; no use of
the bare `dictionary` global; no module-level state; nothing that knows about one instrument only (that stays in
`service.js`); nothing shared by two services (copy it — one service never imports another).

## Rules and validation

What the platform enforces today: an ordinary ES module, linted by keen-validate as a helper — only `system/*` and
existing relative `.js` imports, none of the forbidden globals or prototype names the deploy refuses (`eval`,
`Function`, `require`, dynamic `import()`, `with`, `process`, `global`, `globalThis`, `module`, `exports`,
`__dirname`, `__filename`, `__proto__`, `constructor`, `prototype`, `getPrototypeOf`, `setPrototypeOf`), a
warning for `crypto`. Nothing checks that a helper is pure. There is no `console`, `fetch`, `Buffer` or timer in
the sandbox; `Tools.generateUUID()` and a timestamp come from `system/tools` — call those in the tool, not here.

House standard (not checked by any tool yet): pure functions only; no `system/*` import; the service's errors all
made by `serviceError`.

## Limits

Helpers run in the node's sandbox, inside its 30 MB. A helper that cuts text is how the service keeps a reply and
the dictionary small (the dictionary and the session are capped at 1.5 MB each). Details:
[`script-skill.md`](../../../../Flow/Nodes/Script/script-skill.md) → Limits.

## Mistakes that break it

| Mistake | What happens | Write instead |
|---|---|---|
| `import Http from 'system/http'` in utils | the I/O is split across two files; the connector is no longer the only caller | make the call in `connector.js` |
| `let cache = {}` at the top, filled by a helper | empty again at every node run — the sandbox is fresh | no state; pass values in |
| `if (x.constructor === Object)` | the deploy refuses the script (`constructor`) | `x !== null && typeof x === 'object' && !Array.isArray(x)` |
| `crypto.randomUUID()` | `crypto` is not defined | `Tools.generateUUID()` in the tool |
| `throw new Error(...)` scattered with different words | the model gets five wordings for one failure | `serviceError(message, retryable)` |
| a helper that writes `dictionary.x` | a hidden write the tool does not see | return the value; the caller writes it |

## Example

```js
// src/scripts/services/docStore/utils.js
// Pure helpers of the DocStore service: no system/* import, no state.

/** The one way this service fails: a message the model can repeat, and whether a retry may help. */
export function serviceError(message, retryable) {
    const err = new Error(message);
    err.retryable = retryable === true;
    return err;
}

/** An HTTP status from DocStore, in words. */
export function describeStatus(status) {
    if (status === 401 || status === 403) return `DocStore refused the API key (${status}). Tell the person to check DOCSTORE_KEY on the agent.`;
    if (status === 404) return 'DocStore does not know this shelf or document (404).';
    if (status === 429) return 'DocStore is busy (429). Try again in a minute.';
    if (status >= 500) return `DocStore is unavailable (${status}).`;
    return `DocStore answered ${status}.`;
}

/** An https:// address without a trailing slash, or null. */
export function normaliseBaseUrl(value) {
    if (typeof value !== 'string') return null;
    const url = value.trim().replace(/\/+$/, '');
    return /^https:\/\/[^\s/]+(\/\S*)?$/.test(url) ? url : null;
}

/** A whole number between min and max, or the fallback when the value is not a number. */
export function clampInt(value, min, max, fallback) {
    const n = Number(value);
    if (value === null || value === undefined || value === '' || !Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, Math.trunc(n)));
}

/** Text on one line, trimmed, at most maxChars characters. */
export function cleanText(value, maxChars) {
    return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, maxChars);
}
```
