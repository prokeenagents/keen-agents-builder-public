# `system/secrets`

## Description

Reads the agent's **Secrets** — the write-only values an admin saves on the agent's Secrets card in the console
(a third-party API key, a signing key, a password, a PEM). Read-only, by name.

Use it for anything whose leak costs money or access, then send it with `system/http`. Do not use it for plain
configuration (a URL, a retry count) — that is Json Settings (`settings.md`). A value **never passes from one
node to the next**: read it in every node that uses it. The node itself is in `../../script-skill.md`.

## Import

```js
import Secrets from 'system/secrets';                    // Secrets.get / getMany / has
import { get, getMany, has } from 'system/secrets';
```

The default export is frozen. There is no `all()`, no `names()` and no write.

**The import is what fetches them.** When a Script node starts and its script — or any file it imports — imports
`system/secrets`, the engine fetches the run's agent's **current** set once, for this node only, never cached. A
node that does not import it gets none. A save on the card applies from the next such node, also in a running chat.

## Functions

### `get(name)`
- `name` — string, required: capital letters, digits and `_`, starting with a letter, at most 128 characters
  (`ELEVENLABS_API_KEY`). Names are case-sensitive.
- Returns the value — a string, exactly the text that was typed — or **`undefined`** when there is no secret by
  that name (or `name` is not a string).
```js
const key = Secrets.get('SHOP_API_KEY');
```

### `getMany(...names)`
- `names` — strings, any number.
- Returns an array aligned to the names; `undefined` in each slot without a secret.
```js
const [clientId, clientSecret] = Secrets.getMany('CRM_CLIENT_ID', 'CRM_CLIENT_SECRET');
```

### `has(name)`
- Returns `true` when `get(name)` would return a string, else `false`.
```js
if (!Secrets.has('SHOP_API_KEY')) throw new Error('SHOP_API_KEY is not set on this agent.');
```

## Errors

| When | What the script sees | Node fails or catchable | What to do |
|---|---|---|---|
| the set cannot be fetched: no answer in 2 s, the agent deleted or renamed since the chat began, the run's agent not known, the platform could not read them | the node fails **before the script runs** with `The agent's secrets could not be read.`; the Log Record gets `[ERROR] Script "<script path>" failed: The agent's secrets could not be read.` | error edge; the script cannot catch it | wire `error`; retry the chat step; after a rename start a new chat |
| any call while the platform runs its emergency script engine (off by default, the platform's setting) | `Error: Secrets are not available on this engine path.` | catchable; uncaught → error edge | none in the script |
| `Secrets.all()` / `Secrets.names()` | `TypeError: Secrets.all is not a function` | catchable; uncaught → error edge | name each secret |
| `import { all } from 'system/secrets'` | the node does not start: `The requested module 'system/secrets' does not provide an export named 'all'` | error edge | `get` / `getMany` / `has` |
| a name that is not saved | `undefined` | neither | check it and throw your own words |

## Statuses

| Status | What a call gives |
|---|---|
| **present** | `get` → the string; `has` → `true` |
| **absent** (not saved on this agent, removed before this node started, spelled differently, the agent has no secrets) | `get` → `undefined`; `has` → `false` |
| **store unreadable** | no call happens: the node fails as in Errors — it never runs with `undefined` values |

## Limits

| Limit | Value | Where | When exceeded |
|---|---|---|---|
| Secrets per agent | 50 | on save (console card) | `This agent holds the most secrets allowed (50).` |
| Value size | 8 to 8192 bytes (UTF-8; a non-ASCII character is more than 1 byte) | on save | `Row <n>: a secret must be at least 8 bytes — a shorter value cannot be masked.` / `Row <n>: the value is longer than 8192 bytes.` |
| All names + values | 65536 bytes | on save | `The secrets of this agent would exceed 65536 bytes.` |
| Name | `^[A-Z][A-Z0-9_]{0,127}$` | on save | `Row <n>: invalid secret name! Use capital letters, digits and _, starting with a letter, at most 128 characters.` |
| NUL in a value | not allowed | on save | `Row <n>: the value cannot contain a NUL character.` |
| Fetch time | 2 s | at the node's start | the node fails (Errors) |

The script itself checks none of these: it reads what was saved.

**Masking — what it does.** In a node that fetched secrets, every value of 8 bytes or more is replaced with
`••••` wherever it appears, also inside longer text, and also in these forms: JSON-escaped, URL-encoded
(`encodeURIComponent`), base64 and base64url (also inside a longer base64 text such as a Basic header). It
applies to everything the node lets out: `system/log` lines, `system/chat` messages, the dictionary, the
session (also on the error edge), the agent state (and so the model's prompt), the return value, the error
message, and the debugger. Keys are masked as well as values. In those outputs a structure nested deeper than
64 levels becomes `••••`, and a binary value that holds a secret is replaced whole.

**What masking does not promise.**
- `system/http` sends the real value (that is its purpose); the request is not masked.
- A value transformed past those forms (reversed, hex, split, hashed, sliced) is not recognised.
- A value under 8 bytes is never masked — such a value cannot be saved.
- Masking acts only in the node that imported `system/secrets`; a value obtained another way (e.g. echoed by an
  API) in a later node is not masked.
- Anyone who may deploy code to the space or debug it can make a script send the values out.

## Mistakes that break it

| Mistake | What happens | Write instead |
|---|---|---|
| `dictionary.apiKey = Secrets.get('API_KEY')` for a later node | the dictionary stores `••••`; the later node sends `••••` | `Secrets.get` in the node that calls the API |
| expecting a value saved on the card while the node runs | not seen — the node keeps the set it started with | it applies from the next node that imports `system/secrets` |
| passing the key on through `props`, the session or the return value | each carries `••••` | read it again with `Secrets.get` where it is used |
| `Secrets.get('shop_api_key')` for `SHOP_API_KEY` | `undefined` | the exact capital name |
| sending a request without checking the value | a keyless call fails later with a vague 401 | `if (!key) throw new Error('SHOP_API_KEY is not set on this agent.')` |
| `Log.info(key)` to check it | the line says `••••` | `Log.info(Secrets.has('SHOP_API_KEY'))` |
| a secret value that is an ordinary word (`password123`) | that text becomes `••••` in every output of the node | use a real random key |
| no `error` edge on the node | a fetch failure stalls the run, the person gets no answer | wire `error` to an LLM / End Flow |
| `Promise.all` of several `Http` calls that use the key | `E_SAB_BUSY` | `await` each call |

## Example

```js
import Http from 'system/http';
import Log from 'system/log';
import Secrets from 'system/secrets';

export const exec = async (props) => {
    const key = Secrets.get('SHOP_API_KEY');
    if (key === undefined) throw new Error('SHOP_API_KEY is not set on this agent.');   // → error edge

    const res = await Http.getJson(`https://shop.example.com/orders/${encodeURIComponent(props.orderId)}`, {
        headers: { authorization: `Bearer ${key}` }
    });
    if (!res.ok) {
        Log.warning(`shop answered ${res.status}`);          // the key never appears here; if it did: ••••
        throw new Error(`The shop answered ${res.status}.`);
    }
    dictionary.order = { id: res.body.id, status: res.body.status };   // data, never the key
};
```
