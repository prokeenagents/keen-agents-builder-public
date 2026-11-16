# `system/tools`

## Description

Two small utilities the sandbox lacks or that every script needs: a random UUID and the current time.

Use `generateUUID()` for a fresh id — above all a fresh `requestID` for a `system/agent` write (see
`../../../LLM/references/tool-calling.md`). The sandbox has no `crypto`, so there is no other way to get one. Use
`getTimestamp()` (or `Date.now()`, the same thing) for the time. The node itself is in `../../script-skill.md`.

## Import

```js
import Tools from 'system/tools';                        // Tools.generateUUID / Tools.getTimestamp
import { generateUUID, getTimestamp } from 'system/tools';
```

The default export is frozen. There is no `getMemoryStatus` and nothing else.

## Functions

### `generateUUID()`
- No arguments (any are ignored).
- Returns a random UUID version 4 as a lowercase string, 36 characters: `"3b241101-e2bb-4255-8caf-4136c566a962"`.
  A new one on every call.
```js
const requestID = Tools.generateUUID();
```

### `getTimestamp()`
- No arguments (any are ignored).
- Returns the current time in **milliseconds** since 1970-01-01 UTC (a number) — `Date.now()`.
```js
dictionary.fetchedAt = Tools.getTimestamp();
```

## Errors

| When | What the script sees | Node fails or catchable | What to do |
|---|---|---|---|
| `crypto.randomUUID()` instead | `ReferenceError: crypto is not defined`; keen-validate warns `uses crypto — the sandbox has no crypto; use \`Tools.generateUUID()\` from system/tools` | catchable; uncaught → error edge | `Tools.generateUUID()` |
| `Tools.uuid()` or another name | `TypeError: Tools.uuid is not a function` | catchable; uncaught → error edge | the two names above |

Neither function throws on its own.

## Statuses

None — each call returns a value.

## Limits

None.

## Mistakes that break it

| Mistake | What happens | Write instead |
|---|---|---|
| `requestID: Tools.generateUUID` (no parentheses) | the write carries a function, not an id | `Tools.generateUUID()` |
| one UUID kept in the dictionary and reused for every reply | a later reply has the same `requestID` as an earlier one | a new `generateUUID()` per write |
| treating `getTimestamp()` as seconds | dates 1000× too far in the future | `Math.floor(Tools.getTimestamp() / 1000)` for seconds |

## Example

```js
import Agent from 'system/agent';
import Tools from 'system/tools';

export const exec = (props) => {
    dictionary.startedAt = Tools.getTimestamp();
    Agent.setRootAgentPrompt('order-agent', {
        prompt: `Summarise order ${props.orderId} for the customer.`,
        sessionID: flowContext.sessionId,
        requestID: Tools.generateUUID()
    });
};
```
