# `system/settings`

## Description

Reads the agent's **Json Settings** — the configuration an admin writes on the agent's page in the console
(a URL, a retry count, a model name, a client id). Read-only.

Use it for plain configuration that should change without a code deploy. Do not use it for an API key, a
password or a token: Json Settings are readable by everyone who can read the agent and travel in its export —
put those in Secrets (`secrets.md`). Values the person or the flow produces belong in the `dictionary` or
`system/session`, not here. The node itself is in `../../script-skill.md`.

## Import

```js
import Settings from 'system/settings';                 // Settings.get / getMany / has
import { get, getMany, has } from 'system/settings';
```

The default export is frozen. There is no `all()`, no list of keys and no write.

## Functions

The settings belong to the run's agent (the chat's agent). The engine reads them when **each** Script node starts
(whether or not it imports this module), so a save in the console applies from the next Script node, also in a
chat already running. How the stored text becomes fields:

| Stored text | Fields |
|---|---|
| a JSON object `{"retries": 3, "shop": {"url": "…"}}` | its top-level keys, values with their JSON type (`get('retries')` → `3`, `get('shop')` → the object) |
| the old rows `[{"fieldId": "x", "value": …}]` | `x` → its `value`; a row stamped `"valid": false`, without a string `fieldId`, or with an empty one is skipped; a later row with the same `fieldId` wins |
| anything else (a number, a string, `null`, a list without rows, `''`) | no fields |

`__proto__`, `constructor` and `prototype` are never fields. Only own keys answer (`get('toString')` →
`undefined`). In a JSON object with the same key twice, the last one wins.

### `get(key)`
- `key` — string, required. A non-string returns `undefined`.
- Returns the value (string, number, boolean, `null`, array or object), or **`undefined`** when the field is
  absent.
```js
const retries = Settings.get('retries') ?? 3;
```

### `getMany(...keys)`
- `keys` — strings, any number.
- Returns an array aligned to the keys; `undefined` in each slot whose field is absent (or whose key is not a
  string).
```js
const [url, timeoutMs] = Settings.getMany('shopUrl', 'timeoutMs');
```

### `has(key)`
- `key` — string, required. A non-string returns `false`.
- Returns `true` when the field exists — also when its value is `null`.
```js
if (!Settings.has('shopUrl')) throw new Error('shopUrl is not set on this agent');
```

## Errors

| When | What the script sees | Node fails or catchable | What to do |
|---|---|---|---|
| the settings cannot be read (no answer in 2 s, the agent unknown, the run's agent not known) | every field absent: `get` → `undefined`, `has` → `false` | neither: the node runs on | always give a default or check `has` |
| the stored text is not valid JSON | every field absent | neither | — (the console refuses it on save) |
| `Settings.all()` | `TypeError: Settings.all is not a function` | catchable; uncaught → error edge | name each key |
| `Settings.x = 1` | `TypeError: Cannot add property x, object is not extensible` | catchable; uncaught → error edge | settings are edited only in the console |
| `import { all } from 'system/settings'` | the node does not start: `The requested module 'system/settings' does not provide an export named 'all'` | error edge | `get` / `getMany` / `has` |

No function of this module throws on its own.

## Statuses

| Status | What a call gives |
|---|---|
| **found** | `get` → the value; `has` → `true` |
| **missing** (the key is not in the settings) | `get` → `undefined`; `has` → `false` |
| **unreadable** (the read failed or the text gives no fields) | the same as missing for every key — the script cannot tell the two apart; the cause is written only to the platform's own log, not to the Log Record |

## Limits

| Limit | Value | Where | When exceeded |
|---|---|---|---|
| Stored text | any valid JSON, at most 1000 characters; `''` clears it | on save (console, MCP, import) | the save is refused: `jsonSettings must be valid JSON of at most 1000 characters` |
| Read time | 2 s | when each Script node starts | no fields (see unreadable) |
| Freshness | read at each Script node's start | — | a node already running keeps what it read |

The returned objects are this node's copy: changing one changes nothing stored and nothing in the next node.

## Mistakes that break it

| Mistake | What happens | Write instead |
|---|---|---|
| an API key in Json Settings | readable by anyone who can read the agent, exported with it, not masked | Secrets + `system/secrets` |
| `Settings.get('retries') + 1` with no default | `NaN` when the field is absent or the read failed | `(Settings.get('retries') ?? 3) + 1` |
| reading a nested path `Settings.get('shop.url')` | `undefined` — keys are top-level only | `Settings.get('shop')?.url` |
| `[{"retries": 3}]` as the settings | no fields (a list without `fieldId` rows) | `{"retries": 3}` |
| a number stored as `"3"` | `get` returns the string `"3"` | store `3`, or `Number(Settings.get('retries'))` |
| expecting a settings change inside the running node | not seen | it applies from the next Script node |
| `Settings.get('Retries')` for `retries` | `undefined` — keys are case-sensitive | the exact key |

## Example

Json Settings: `{"shopUrl": "https://shop.example.com", "timeoutMs": 8000, "currencies": ["EUR", "USD"]}`

```js
import Log from 'system/log';
import Settings from 'system/settings';

export const exec = (props) => {
    const [shopUrl, currencies] = Settings.getMany('shopUrl', 'currencies');
    if (typeof shopUrl !== 'string') {
        Log.error('Json Settings: shopUrl is missing');
        throw new Error('The shop is not configured for this agent.');   // → error edge
    }
    dictionary.shopUrl = shopUrl;
    dictionary.currency = Array.isArray(currencies) && currencies.includes(props.currency) ? props.currency : 'EUR';
};
```
