# Script tool — complete examples

Four tools in three examples that pass `keen-validate` with 0 errors, 0 warnings when dropped into a project (checked
on a scratch project, 2026-11-12). Each one gives the `src/keen-tools.json` entry, the tool file, the service files (if any) and the
lines of the LLM node's system prompt that describe the tool. The rules behind them are in
[`../script-tool-skill.md`](../script-tool-skill.md).

> `docStore` is a **fictional** service used only to show the shape: its name, address, routes and secret name are
> made up. A real integration follows the same pattern with its own names.

All four tools in one registry:

```json
{
  "tools": [
    { "name": "Days Until", "type": "script", "entry": "tools/daysUntilTool.js" },
    { "name": "Document Search", "type": "script", "entry": "tools/docStoreSearchTool.js" },
    { "name": "Document Read", "type": "script", "entry": "tools/docStoreReadTool.js" },
    { "name": "Store Hours", "type": "script", "entry": "tools/storeHoursTool.js" }
  ]
}
```

The system prompt section they share (once per LLM node, above the tool list):

```md
When you need a tool, write exactly one block, with each marker at the start of a line:

<SYSTEM CALL>
!*action
use tool
!*tool
<the tool's name>
!*context
<the input the tool needs>
</SYSTEM CALL>

Write nothing else inside the block and only one block per answer. Then wait: the tool's reply arrives as the
next user message. If a reply says "ok": false and "retryable": true, or says "input invalid", correct the call
once as it tells you; otherwise tell the person what failed in plain words. Never call the same tool more than
3 times for one question.

Tools:
```

## 1. A minimal tool with no service — `Days Until`

The work is a few lines of arithmetic, so there is no service folder. The tool reads one date from `!*context`,
checks it, and replies in one sentence.

`src/keen-tools.json` entry:

```json
{ "name": "Days Until", "type": "script", "entry": "tools/daysUntilTool.js" }
```

```js
// src/scripts/tools/daysUntilTool.js — counts the days from today (UTC) to a date. No service, no secret.
import Agent from 'system/agent';
import Tools from 'system/tools';

const DAY_MS = 24 * 60 * 60 * 1000;

export const exec = async () => {
    const call = toolOptions.toolContext;                        // the parsed <SYSTEM CALL>
    const reply = (text) =>
        Agent.setRootAgentPrompt(call.agentId, {                 // the agent that called — never a literal id
            prompt: text,
            sessionID: toolOptions.agentNode.flowContext.sessionId,  // the caller's session
            requestID: Tools.generateUUID()
        });

    const raw = (call.options.context ?? '').trim();
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    if (!match) {
        reply('Days Until input invalid. Send !*context as one date YYYY-MM-DD, e.g. 2026-12-24. You sent: ' + (raw || '(empty)'));
        return { ok: false };
    }

    const target = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    const check = new Date(target);
    if (check.getUTCMonth() !== Number(match[2]) - 1 || check.getUTCDate() !== Number(match[3])) {
        reply(`Days Until: ${raw} is not a real date. Check the month and the day.`);
        return { ok: false };
    }

    const now = new Date(Tools.getTimestamp());
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const days = Math.round((target - today) / DAY_MS);

    const when = days === 0 ? 'today' : days > 0 ? `in ${days} day(s)` : `${-days} day(s) ago`;
    reply(`Days Until: ${raw} is ${when} (today is ${new Date(today).toISOString().slice(0, 10)}, UTC).`);
    return { ok: true };
};
```

System prompt lines:

```md
1. Days Until
Description: counts the days from today (UTC) to a date. Use it whenever the person asks how many days are left until a date.
Usage: !*context is one date, YYYY-MM-DD, e.g. 2026-12-24.
```

What the model reads back: `Days Until: 2026-12-24 is in 42 day(s) (today is 2026-11-12, UTC).`, or after a bad
call the sentence that names the right format.

## 2. A service with an API key from Secrets — `Document Search` and `Document Read`

The house standard (`../../../../Services/SKILL.md`): **one instrument per action, one thin tool per instrument**.
Each tool does the same steps — the Json Settings switch, the input, the Secret, `DocStoreService.connect(…)`, one
instrument, one reply — and imports **only** `service.js`. `service.js` assembles the connection with
`connector.js` and holds the instruments; `utils.js` and `settings.js` serve them. The agent needs the Secret
`DOCSTORE_KEY` and the Json Settings `{"doc_store_available": true}`; `doc_store_api_url` and `doc_store_shelf`
are optional (`{"doc_store_available": true, "doc_store_shelf": "manuals"}`). The service's own skill lives at
`.claude/skills/doc-store-service/SKILL.md` (`../../../../Services/service-skill-template.md`).

`src/keen-tools.json` entries:

```json
{ "name": "Document Search", "type": "script", "entry": "tools/docStoreSearchTool.js" },
{ "name": "Document Read", "type": "script", "entry": "tools/docStoreReadTool.js" }
```

```js
// src/scripts/tools/docStoreSearchTool.js — Document Search: switch, input, Secret, connect through service.js, one instrument, one reply.
import Agent from 'system/agent';
import Chat from 'system/chat';
import Secrets from 'system/secrets';
import Settings from 'system/settings';
import Tools from 'system/tools';
import * as DocStoreService from '../services/docStore/service.js';

export const exec = async () => {
    const call = toolOptions.toolContext;
    const reply = data =>
        Agent.setRootAgentPrompt(call.agentId, {
            prompt: JSON.stringify(data),
            sessionID: toolOptions.agentNode.flowContext.sessionId,
            requestID: Tools.generateUUID()
        });

    // 1. The switch first: the agent's Json Settings say whether document search is on (and, optionally, where and which shelf).
    const [available, baseUrl, shelf] = Settings.getMany('doc_store_available', 'doc_store_api_url', 'doc_store_shelf');
    if (available !== true) {
        reply({ ok: false, retryable: false, error: 'Document search is not available on this agent. Tell the person it cannot be used right now.' });
        return { ok: false };
    }

    // 2. The input: !*context is JSON text from the model — parse and check it before anything else.
    let input;
    try {
        input = JSON.parse(call.options.context ?? '');
    } catch {
        input = null;
    }
    if (!input || typeof input.query !== 'string' || input.query.trim() === '') {
        reply({ ok: false, retryable: true, error: 'Document Search input is invalid. Send !*context as JSON {"query": "<text>", "limit": 5}.' });
        return { ok: false };
    }

    // 3. The key: read here, in the tool, on every run.
    const apiKey = Secrets.get('DOCSTORE_KEY');
    if (apiKey === undefined) {
        reply({ ok: false, retryable: false, error: 'Document search is not set up on this agent (no DOCSTORE_KEY). Tell the person.' });
        return { ok: false };
    }

    // 4. Connect through the service, call one instrument, reply. Every failure becomes a reply in words.
    try {
        Chat.writeOut('Searching the documents…');
        const docStore = DocStoreService.connect({ apiKey }, { baseUrl });
        const result = await docStore.search({ query: input.query, limit: input.limit, shelf });
        reply({ ok: true, ...result });
        return { ok: true };
    } catch (err) {
        reply({ ok: false, retryable: err.retryable === true, error: err.message });
        return { ok: false };
    }
};
```

```js
// src/scripts/tools/docStoreReadTool.js — Document Read: the same five steps, the instrument getChunk.
import Agent from 'system/agent';
import Secrets from 'system/secrets';
import Settings from 'system/settings';
import Tools from 'system/tools';
import * as DocStoreService from '../services/docStore/service.js';

export const exec = async () => {
    const call = toolOptions.toolContext;
    const reply = data =>
        Agent.setRootAgentPrompt(call.agentId, {
            prompt: JSON.stringify(data),
            sessionID: toolOptions.agentNode.flowContext.sessionId,
            requestID: Tools.generateUUID()
        });

    const [available, baseUrl] = Settings.getMany('doc_store_available', 'doc_store_api_url');
    if (available !== true) {
        reply({ ok: false, retryable: false, error: 'Document search is not available on this agent. Tell the person it cannot be used right now.' });
        return { ok: false };
    }

    let input;
    try {
        input = JSON.parse(call.options.context ?? '');
    } catch {
        input = null;
    }
    if (!input || typeof input.documentId !== 'string' || input.documentId.trim() === '') {
        reply({ ok: false, retryable: true, error: 'Document Read input is invalid. Send !*context as JSON {"documentId": "<id from a search hit>", "index": <number from the same hit>}.' });
        return { ok: false };
    }

    const apiKey = Secrets.get('DOCSTORE_KEY');
    if (apiKey === undefined) {
        reply({ ok: false, retryable: false, error: 'Document search is not set up on this agent (no DOCSTORE_KEY). Tell the person.' });
        return { ok: false };
    }

    try {
        const docStore = DocStoreService.connect({ apiKey }, { baseUrl });
        reply({ ok: true, ...(await docStore.getChunk({ documentId: input.documentId, index: input.index })) });
        return { ok: true };
    } catch (err) {
        reply({ ok: false, retryable: err.retryable === true, error: err.message });
        return { ok: false };
    }
};
```

The service folder `src/scripts/services/docStore/`. Each file is explained in
[`services/`](../../../../ProjectStructure/src/scripts/services/services.md).

```js
// src/scripts/services/docStore/service.js
// The DocStore service: connect() assembles the connection (through connector.js) and returns the instruments —
// one method per action the model may take. The tools import ONLY this file.
import { createConnection } from './connector.js';
import { CHUNK_MAX_CHARS, DEFAULT_LIMIT, DOCUMENTS_PATH, MAX_LIMIT, QUERY_MAX_CHARS, QUERY_PATH, SNIPPET_MAX_CHARS, TITLE_MAX_CHARS } from './settings.js';
import { clampInt, cleanText, serviceError } from './utils.js';

/**
 * Connect and get the instruments.
 * credentials: { apiKey } (the Secret DOCSTORE_KEY).
 * options:     { baseUrl } (the Json Setting doc_store_api_url, optional).
 */
export function connect(credentials, options = {}) {
    const connection = createConnection(credentials, options);
    return Object.freeze({
        search: args => search(connection, args),
        getChunk: args => getChunk(connection, args)
    });
}

/** Search the document store; returns the best passages, each short enough for the model. */
async function search(connection, { query, limit, shelf } = {}) {
    const text = cleanText(query, QUERY_MAX_CHARS);
    if (text === '') throw serviceError('The search query is empty. Send {"query": "<text>"}.', true);

    const body = { query: text, limit: clampInt(limit, 1, MAX_LIMIT, DEFAULT_LIMIT) };
    if (typeof shelf === 'string' && shelf.trim() !== '') body.shelf = shelf.trim();

    const answer = await connection.post(QUERY_PATH, body);
    const hits = Array.isArray(answer.hits) ? answer.hits.slice(0, body.limit) : [];
    return {
        total: Number(answer.total) || hits.length,
        hits: hits.map(hit => ({
            documentId: cleanText(hit.documentId, 64),
            index: clampInt(hit.index, 0, 100000, 0),
            title: cleanText(hit.title, TITLE_MAX_CHARS),
            page: Number(hit.page) || null,
            text: cleanText(hit.text, SNIPPET_MAX_CHARS)
        }))
    };
}

/** Read one passage of a document the model found with `search`. */
async function getChunk(connection, { documentId, index } = {}) {
    const id = cleanText(documentId, 64);
    const n = clampInt(index, 0, 100000, -1);
    if (id === '' || n < 0) throw serviceError('Send {"documentId": "<id from a search hit>", "index": <number from the same hit>}.', true);

    const answer = await connection.get(`${DOCUMENTS_PATH}/${encodeURIComponent(id)}/chunks/${n}`);
    return { documentId: id, index: n, title: cleanText(answer.title, TITLE_MAX_CHARS), text: cleanText(answer.text, CHUNK_MAX_CHARS) };
}
```

```js
// src/scripts/services/docStore/connector.js
// The authenticated connection to the fictional DocStore. Every call goes through here; the key stays in the closure.
import Http from 'system/http';
import { BASE_URL } from './settings.js';
import { describeStatus, normaliseBaseUrl, serviceError } from './utils.js';

/**
 * Build the authenticated DocStore client. Only service.js calls it (inside its connect); the tool never imports this file.
 * credentials.apiKey — the agent's Secret DOCSTORE_KEY.
 * options.baseUrl    — the Json Setting "doc_store_api_url"; the default is BASE_URL.
 */
export function createConnection(credentials, options = {}) {
    const apiKey = credentials?.apiKey;
    if (typeof apiKey !== 'string' || apiKey.trim() === '') throw serviceError('DocStore is not set up on this agent (no API key).', false);

    const baseUrl = normaliseBaseUrl(options.baseUrl ?? BASE_URL);
    if (baseUrl === null) throw serviceError('The DocStore address on this agent is not a valid https:// URL (Json Setting doc_store_api_url).', false);

    const headers = { 'x-api-key': apiKey, accept: 'application/json' };

    const send = async (method, path, body) => {
        let res;
        try {
            res = method === 'GET' ? await Http.getJson(baseUrl + path, { headers }) : await Http.postJson(baseUrl + path, body, { headers });
        } catch (err) {
            // timeout, DNS, refused address, network, too many redirects — the message never holds a header
            throw serviceError(`DocStore could not be reached (${err.message}).`, true);
        }
        if (!res.ok) throw serviceError(describeStatus(res.status), res.status === 429 || res.status >= 500);
        if (res.body === null || typeof res.body !== 'object') throw serviceError('DocStore sent an answer that is not JSON.', true);
        return res.body;
    };

    return Object.freeze({
        get: path => send('GET', path),
        post: (path, body) => send('POST', path, body)
    });
}
```

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

```js
// src/scripts/services/docStore/settings.js
// Defaults for the fictional DocStore service (api.docstore.example.com). Code, not configuration: never a key here.
// The agent's Json Settings (read by the tools, plain values only): "doc_store_available" (the switch — off unless
// true), "doc_store_api_url" (overrides BASE_URL), "doc_store_shelf" (no default).
// The tools read the agent's Secret DOCSTORE_KEY.

export const BASE_URL = 'https://api.docstore.example.com';
export const QUERY_PATH = '/v1/query';
export const DOCUMENTS_PATH = '/v1/documents';

export const DEFAULT_LIMIT = 5;
export const MAX_LIMIT = 10;

export const QUERY_MAX_CHARS = 500;
export const TITLE_MAX_CHARS = 120;
export const SNIPPET_MAX_CHARS = 600;
export const CHUNK_MAX_CHARS = 2400;
```

System prompt lines:

```md
2. Document Search
Description: searches the company's documents and returns the best passages with their documentId, index, title,
page and text. Use it before you answer any question about a product, a policy or a manual. Quote only what it returns.
Usage: !*context is JSON {"query": "<the question in a few words>", "limit": 5} (limit 1-10).
3. Document Read
Description: returns the longer text of one passage a Document Search hit named. Use it only when a hit's text is
too short to answer.
Usage: !*context is JSON {"documentId": "<id from a hit>", "index": <the hit's index>}.
```

What the model reads back: `{"ok":true,"total":2,"hits":[{"documentId":"d-17","index":4,"title":"Warranty","page":3,…}]}`,
or `{"ok":false,"retryable":false,"error":"DocStore refused the API key (401). Tell the person to check DOCSTORE_KEY on the agent."}`.
While Document Search runs, the person sees `Searching the documents…` as an interim chat line.

## 3. A tool that reads the agent's Json Settings — `Store Hours`

The answer lives in the agent's Json Settings, so an admin changes it in the console without a deploy. The tool
also leaves the day it answered in the calling agent's dictionary (`dictionary.lastStoreHoursDay`) for a later
node.

The agent's Json Settings (in the console; at most 1000 characters of JSON):

```json
{
  "store_hours": { "monday": "09:00-18:00", "tuesday": "09:00-18:00", "wednesday": "09:00-18:00",
                  "thursday": "09:00-18:00", "friday": "09:00-17:00", "saturday": "10:00-14:00" },
  "store_hours_note": "Holiday hours may differ."
}
```

`src/keen-tools.json` entry:

```json
{ "name": "Store Hours", "type": "script", "entry": "tools/storeHoursTool.js" }
```

```js
// src/scripts/tools/storeHoursTool.js — answers from the agent's Json Settings; no service, no secret.
import Agent from 'system/agent';
import Settings from 'system/settings';
import Tools from 'system/tools';

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export const exec = async () => {
    const call = toolOptions.toolContext;
    const reply = (text) =>
        Agent.setRootAgentPrompt(call.agentId, {
            prompt: text,
            sessionID: toolOptions.agentNode.flowContext.sessionId,
            requestID: Tools.generateUUID()
        });

    const hours = Settings.get('store_hours');               // {"monday": "09:00-18:00", …} or undefined
    if (hours === null || typeof hours !== 'object' || Array.isArray(hours)) {
        reply('Store Hours is not set up: the agent has no "store_hours" in its Json Settings. Tell the person the hours are not available.');
        return { ok: false };
    }

    // !*context is a day name; "today" or empty means today in UTC.
    const asked = (call.options.context ?? '').trim().toLowerCase();
    const day = asked === '' || asked === 'today' ? DAYS[new Date(Tools.getTimestamp()).getUTCDay()] : asked;
    if (!DAYS.includes(day)) {
        reply(`Store Hours input invalid. Send !*context as a day name (${DAYS.join(', ')}) or "today". You sent: ${asked}`);
        return { ok: false };
    }

    const value = typeof hours[day] === 'string' ? hours[day] : 'closed';
    const note = Settings.get('store_hours_note');            // optional free text, e.g. "Holiday hours may differ."
    dictionary.lastStoreHoursDay = day;                      // the calling agent's dictionary — later nodes may read it
    reply(`Store Hours: ${day} ${value}.${typeof note === 'string' && note !== '' ? ' ' + note : ''}`);
    return { ok: true };
};
```

System prompt lines:

```md
4. Store Hours
Description: returns the store's opening hours for one day. Use it for any question about when the store is open.
Usage: !*context is a day name in English (monday … sunday) or "today".
```

What the model reads back: `Store Hours: sunday closed. Holiday hours may differ.`
