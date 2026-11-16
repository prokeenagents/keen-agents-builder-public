# Flow tool examples

One project, `src/` below, that passes `keen-validate` with **0 errors** (one warning: the calling agent's Fallback
is unwired on purpose). Every `.flow` and script here is the validated file, unchanged. The shop, its products, its
postcodes and the `docStore` service are fictional. The rules behind each piece: [../flow-tool-skill.md](../flow-tool-skill.md).

```
src/
    keen-tools.json
    flows/
        Project.flow             the agent (Start Flow "Project", Start Node "Start") — the calling LLM node
        PriceQuote.flow          Example 1 — entry PriceQuote-Start
        SummariseDocument.flow   Example 2 — entry SummariseDocument-Start
        ShippingCheck.flow       Example 3 — entry ShippingCheck-Start
        ResearchTool.flow        Example 4 — entry ResearchTool-Start
    scripts/
        flowTools/shared/toolCall.js        helpers: read !*context, reply to the caller
        flowTools/shared/replyFailure.js    every error / Fallback path of every flow tool
        flowTools/priceQuote/…  flowTools/summarise/…  flowTools/shippingCheck/…  flowTools/research/…
        tools/docStoreSearchTool.js         script tool of the researcher (Example 4)
        tools/docStoreChunkTool.js          script tool of the researcher (Example 4)
        services/docStore/{service,connector,utils,settings}.js   the docStore service (the house standard)
```

## The registry — `src/keen-tools.json`

```json
{
  "tools": [
    { "name": "Price Quote", "type": "flow", "entry": "PriceQuote-Start" },
    { "name": "Shipping Check", "type": "flow", "entry": "ShippingCheck-Start" },
    { "name": "Summarise Document", "type": "flow", "entry": "SummariseDocument-Start" },
    { "name": "Research Manuals", "type": "flow", "entry": "ResearchTool-Start" },
    { "name": "DocStore Search", "type": "script", "entry": "tools/docStoreSearchTool.js" },
    { "name": "DocStore Chunk", "type": "script", "entry": "tools/docStoreChunkTool.js" }
  ]
}
```

The first four are the calling agent's tools. The last two are called only by the researcher inside Example 4: the
registry is one list for the whole project, and each agent's system prompt decides which tools it knows.

## The shared helpers

Every Script of every flow tool reads the call and replies through one helper. A helper module needs no `exec`;
the `toolOptions` global is visible in it, because it runs in the Script's sandbox.

```js
// src/scripts/flowTools/shared/toolCall.js
// Helpers for the Script nodes of a flow tool. `toolOptions` is present on the
// nodes of the tool flow itself (not inside a Run Flow sub-flow it starts).
import Agent from 'system/agent';
import Tools from 'system/tools';

/** The !*context text of the call, and its JSON value (null when it is not JSON). */
export function readContext() {
    const raw = String(toolOptions.toolContext.options?.context ?? '').trim();
    let value = null;
    try { value = JSON.parse(raw); } catch { value = null; }
    return { raw, value };
}

/** File the tool's reply for the agent that called it, on that agent's session. */
export function replyToCaller(text) {
    Agent.setRootAgentPrompt(toolOptions.toolContext.agentId, {
        prompt: String(text),
        sessionID: toolOptions.agentNode.flowContext.sessionId,
        requestID: Tools.generateUUID()
    });
}
```

```js
// src/scripts/flowTools/shared/replyFailure.js — Key/Value Pair "tool" = the tool's name
// Every error / Fallback edge of a flow tool ends here, so the caller always gets a reply.
import { replyToCaller } from './toolCall.js';

export async function exec(props) {
    const tool = String(props.tool || 'This tool');
    replyToCaller(`${tool} failed and has no result. Tell the customer it is not available right now; do not call it again for this message.`);
    return { ok: false };
}
```

## The calling agent — `src/flows/Project.flow`

Start → LLM `shop-assistant` → End. Its system prompt is the only place the model learns the four tools; each
example below quotes its own entry from it.

```json
{
  "nodes": [
    { "id": "startNode_nYGny0U4p9Mh", "type": "startNode", "position": {"x": 304, "y": 96},
      "data": { "label": "Start", "description": "The chat message enters here", "labelNode": "Start Flow", "descriptionNode": "Flow entry point", "open": false,
        "settings": {"label": "Start", "value": "Start"} },
      "dragHandle": ".drag-handle__custom" },
    { "id": "agentNode_4WpBwlYEIn9o", "type": "agentNode", "position": {"x": 304, "y": 528},
      "data": { "label": "", "description": "Answers the customer; calls the four tools", "labelNode": "LLM", "descriptionNode": "Use LLM processor", "open": false, "openLLM": false, "openPrompt": false,
        "settings": {
          "agentId": "shop-assistant",
          "agentName": "Shop Assistant",
          "sessionId": "",
          "requestId": "",
          "llm": {
            "company": "anthropic",
            "model": "claude-sonnet-4-6",
            "modelId": 4938,
            "parameters": {
              "temperature": 0.5,
              "maxTokens": 8192
            }
          },
          "prompts": [
            {
              "id": "067cfdf8-6ffb-4a5f-ae52-4fd57e60f8f3",
              "role": "system",
              "content": "You are the shop assistant of Lumen Home, a fictional home-goods shop. Answer briefly and in the customer's language.\n\nWhen you need a tool, write exactly one block, with each marker at the start of a line:\n\n<SYSTEM CALL>\n!*action\nuse tool\n!*tool\n<the tool's name>\n!*context\n<the input the tool needs>\n</SYSTEM CALL>\n\nWrite nothing else inside the block. Then wait: the tool's reply arrives as the next user message. Call at most 4 tools for one customer message, then answer with what you have. If a tool reply says the input was wrong, fix the input and call it once more.\n\nTools:\n1. Price Quote\nDescription: the exact price of an order line: unit price, volume discount, VAT and total, in EUR.\nUsage: !*context is JSON {\"sku\": \"<product code, e.g. LH-LAMP-01>\", \"quantity\": <whole number 1-500>}.\n2. Shipping Check\nDescription: whether we ship to a postcode and what delivery costs for a parcel weight.\nUsage: !*context is JSON {\"postcode\": \"<4 digits>\", \"weightKg\": <number>}.\n3. Summarise Document\nDescription: a short summary of a long text the customer pasted (a contract, a manual page, an e-mail).\nUsage: !*context is JSON {\"text\": \"<the full text>\", \"focus\": \"<optional: what the customer cares about>\"}.\n4. Research Manuals\nDescription: researches a technical question in Lumen Home's product manuals and answers with the sources. Slower than the other tools; use it only for technical questions about a product.\nUsage: !*context is JSON {\"question\": \"<the customer's question, complete>\"}."
            }
          ],
          "specialRules": []
        } },
      "dragHandle": ".drag-handle__custom" },
    { "id": "endNode_Ht9fHS33pQhv", "type": "endNode", "position": {"x": 304, "y": 960},
      "data": { "label": "End", "description": "", "labelNode": "End Flow", "descriptionNode": "Flow terminal", "open": false,
        "settings": {"value": "End", "label": "End", "terminateDictionary": false} },
      "dragHandle": ".drag-handle__custom" }
  ],
  "edges": [
    {"id": "xy-edge__startNode_nYGny0U4p9Mhnext-agentNode_4WpBwlYEIn9oin", "type": "step", "source": "startNode_nYGny0U4p9Mh", "sourceHandle": "next", "target": "agentNode_4WpBwlYEIn9o", "targetHandle": "in"},
    {"id": "xy-edge__agentNode_4WpBwlYEIn9onext_1-endNode_Ht9fHS33pQhvin", "type": "step", "source": "agentNode_4WpBwlYEIn9o", "sourceHandle": "next_1", "target": "endNode_Ht9fHS33pQhv", "targetHandle": "in"}
  ]
}
```

## Example 1 — Price Quote: a Script computes and answers

`Start → Compute quote → End`; the Script's `error` → Reply failure → End (that Script's own `error` → End, so a
failure there ends in `No tool response` instead of a stall).

The calling prompt's lines:

```
1. Price Quote
Description: the exact price of an order line: unit price, volume discount, VAT and total, in EUR.
Usage: !*context is JSON {"sku": "<product code, e.g. LH-LAMP-01>", "quantity": <whole number 1-500>}.
```

Registry entry: `{ "name": "Price Quote", "type": "flow", "entry": "PriceQuote-Start" }`.

```json
{
  "nodes": [
    { "id": "startNode_U168IbgNu92m", "type": "startNode", "position": {"x": 304, "y": 96},
      "data": { "label": "Start", "description": "Entry of the Price Quote tool", "labelNode": "Start Flow", "descriptionNode": "Flow entry point", "open": false,
        "settings": {"label": "Start", "value": "Start"} },
      "dragHandle": ".drag-handle__custom" },
    { "id": "scriptNode_AysddAV4O9Qr", "type": "scriptNode", "position": {"x": 304, "y": 528},
      "data": { "label": "Compute quote", "description": "Validates the input, computes the price and replies to the caller", "labelNode": "Script", "descriptionNode": "Execute custom JS script", "open": false,
        "settings": {"value": "flowTools/priceQuote/computeQuote.js", "label": "Compute quote", "keyValuePairs": []} },
      "dragHandle": ".drag-handle__custom" },
    { "id": "scriptNode_kBemQQJ2YevM", "type": "scriptNode", "position": {"x": 800, "y": 960},
      "data": { "label": "Reply failure", "description": "Tells the calling agent the tool failed", "labelNode": "Script", "descriptionNode": "Execute custom JS script", "open": false,
        "settings": {"value": "flowTools/shared/replyFailure.js", "label": "Reply failure", "keyValuePairs": [{"key": "tool", "value": "Price Quote"}]} },
      "dragHandle": ".drag-handle__custom" },
    { "id": "endNode_AqosoT5PiO6a", "type": "endNode", "position": {"x": 304, "y": 960},
      "data": { "label": "End", "description": "", "labelNode": "End Flow", "descriptionNode": "Flow terminal", "open": false,
        "settings": {"value": "End", "label": "End", "terminateDictionary": false} },
      "dragHandle": ".drag-handle__custom" }
  ],
  "edges": [
    {"id": "xy-edge__startNode_U168IbgNu92mnext-scriptNode_AysddAV4O9Qrin", "type": "step", "source": "startNode_U168IbgNu92m", "sourceHandle": "next", "target": "scriptNode_AysddAV4O9Qr", "targetHandle": "in"},
    {"id": "xy-edge__scriptNode_AysddAV4O9Qrnext_1-endNode_AqosoT5PiO6ain", "type": "step", "source": "scriptNode_AysddAV4O9Qr", "sourceHandle": "next_1", "target": "endNode_AqosoT5PiO6a", "targetHandle": "in"},
    {"id": "xy-edge__scriptNode_AysddAV4O9Qrerror-scriptNode_kBemQQJ2YevMin", "type": "step", "source": "scriptNode_AysddAV4O9Qr", "sourceHandle": "error", "target": "scriptNode_kBemQQJ2YevM", "targetHandle": "in"},
    {"id": "xy-edge__scriptNode_kBemQQJ2YevMnext_1-endNode_AqosoT5PiO6ain", "type": "step", "source": "scriptNode_kBemQQJ2YevM", "sourceHandle": "next_1", "target": "endNode_AqosoT5PiO6a", "targetHandle": "in"},
    {"id": "xy-edge__scriptNode_kBemQQJ2YevMerror-endNode_AqosoT5PiO6ain", "type": "step", "source": "scriptNode_kBemQQJ2YevM", "sourceHandle": "error", "target": "endNode_AqosoT5PiO6a", "targetHandle": "in"}
  ]
}
```

```js
// src/scripts/flowTools/priceQuote/computeQuote.js
import { readContext, replyToCaller } from '../shared/toolCall.js';
import { PRICES, VAT_RATE, discountPercent } from './priceTable.js';

const eur = cents => (cents / 100).toFixed(2);

export async function exec() {
    const { raw, value } = readContext();
    const sku = typeof value?.sku === 'string' ? value.sku.trim().toUpperCase() : '';
    const quantity = Number(value?.quantity);

    if (!sku || !Number.isInteger(quantity) || quantity < 1 || quantity > 500) {
        replyToCaller('Price Quote input invalid. Send !*context as JSON {"sku": "<code>", "quantity": <whole number 1-500>}. You sent: ' + (raw || '(empty)'));
        return { ok: false };
    }
    const unit = PRICES[sku];
    if (unit === undefined) {
        replyToCaller(`Price Quote: there is no product ${sku}. Known codes: ${Object.keys(PRICES).join(', ')}.`);
        return { ok: false };
    }

    const subtotal = unit * quantity;
    const percent = discountPercent(quantity);
    const discount = Math.round((subtotal * percent) / 100);
    const net = subtotal - discount;
    const vat = Math.round(net * VAT_RATE);
    const total = net + vat;

    dictionary.lastQuote = { sku, quantity, totalCents: total };   // the CALLER's dictionary
    replyToCaller(
        `Price Quote for ${quantity} x ${sku}: unit EUR ${eur(unit)}, subtotal EUR ${eur(subtotal)}, ` +
        `volume discount ${percent}% (EUR ${eur(discount)}), VAT 20% EUR ${eur(vat)}, total EUR ${eur(total)}.`
    );
    return { ok: true };
}
```

```js
// src/scripts/flowTools/priceQuote/priceTable.js
// Fictional catalogue, prices in euro cents (VAT excluded).
export const PRICES = { 'LH-LAMP-01': 3490, 'LH-LAMP-02': 5990, 'LH-RUG-10': 12900, 'LH-MUG-03': 890 };
export const VAT_RATE = 0.2;

/** Volume discount in percent for a quantity. */
export function discountPercent(quantity) {
    if (quantity >= 100) return 12;
    if (quantity >= 20) return 7;
    if (quantity >= 10) return 3;
    return 0;
}
```

A call `{"sku": "LH-LAMP-01", "quantity": 12}` makes the model read
`Price Quote for 12 x LH-LAMP-01: unit EUR 34.90, subtotal EUR 418.80, volume discount 3% (EUR 12.56), VAT 20% EUR 81.25, total EUR 487.49.`
It also leaves `dictionary.lastQuote` in the **caller's** dictionary, readable by the caller's next nodes. This
example would be simpler as a script tool; it is a flow so that steps can be added later.

## Example 2 — Summarise Document: a sub-agent

`Start → Seed summariser → Condition ${dictionary.summarise.ok} == true → (true) LLM doc-summariser → Return summary → End`.
The Condition's `false` goes straight to End: the seed Script has already replied "input invalid", and the
sub-agent must not run without a seed. Seed / Return `error` and the LLM's Fallback → Reply failure → End.

The sub-agent `doc-summariser`: its own ID, Claude Haiku, **Interact with DB off** and **Use tools off** (a
stateless helper with no tools), its own system prompt. It answers the seeded JSON on the tool flow's session.

The calling prompt's lines:

```
3. Summarise Document
Description: a short summary of a long text the customer pasted (a contract, a manual page, an e-mail).
Usage: !*context is JSON {"text": "<the full text>", "focus": "<optional: what the customer cares about>"}.
```

Registry entry: `{ "name": "Summarise Document", "type": "flow", "entry": "SummariseDocument-Start" }`.

```json
{
  "nodes": [
    { "id": "startNode_hJIpMEDE5PcB", "type": "startNode", "position": {"x": 304, "y": 96},
      "data": { "label": "Start", "description": "Entry of the Summarise Document tool", "labelNode": "Start Flow", "descriptionNode": "Flow entry point", "open": false,
        "settings": {"label": "Start", "value": "Start"} },
      "dragHandle": ".drag-handle__custom" },
    { "id": "scriptNode_SSj3YrPgJeAi", "type": "scriptNode", "position": {"x": 304, "y": 528},
      "data": { "label": "Seed summariser", "description": "Checks the input and gives the summariser its user message", "labelNode": "Script", "descriptionNode": "Execute custom JS script", "open": false,
        "settings": {"value": "flowTools/summarise/seedSummariser.js", "label": "Seed summariser", "keyValuePairs": []} },
      "dragHandle": ".drag-handle__custom" },
    { "id": "conditionNode_Eip3RQEUl4Hj", "type": "conditionNode", "position": {"x": 304, "y": 960},
      "data": { "label": "${dictionary.summarise.ok} == true", "description": "Was the input usable?", "labelNode": "Condition", "descriptionNode": "Set condition flow direction", "open": false,
        "settings": {"value": "${dictionary.summarise.ok} == true"} },
      "dragHandle": ".drag-handle__custom" },
    { "id": "agentNode_TgeIRj3bpvWt", "type": "agentNode", "position": {"x": 304, "y": 1392},
      "data": { "label": "", "description": "The sub-agent: no history, no tools", "labelNode": "LLM", "descriptionNode": "Use LLM processor", "open": false, "openLLM": false, "openPrompt": false,
        "settings": {
          "agentId": "doc-summariser",
          "agentName": "Document Summariser",
          "sessionId": "",
          "requestId": "",
          "llm": {
            "company": "anthropic",
            "model": "claude-haiku-4-5-20251001",
            "modelId": 4939,
            "parameters": {
              "temperature": 0.2,
              "maxTokens": 2048
            }
          },
          "prompts": [
            {
              "id": "6b97fe45-249f-4b34-9a56-95ad73846e66",
              "role": "system",
              "content": "You summarise documents for a shop assistant. The user message is a JSON object {\"text\": \"...\", \"focus\": \"...\"}.\nWrite at most 6 bullet points in plain English, most important first. If \"focus\" is not empty, start with what the text says about it.\nQuote numbers, dates and deadlines exactly. Say nothing that is not in the text. No greeting, no closing line."
            }
          ],
          "specialRules": [
            {
              "type": "skip-internal-database-interactions"
            },
            {
              "type": "skip-internal-tooling"
            }
          ]
        } },
      "dragHandle": ".drag-handle__custom" },
    { "id": "scriptNode_cFo4o91HP2c5", "type": "scriptNode", "position": {"x": 304, "y": 1824},
      "data": { "label": "Return summary", "description": "Files the summariser's answer for the calling agent", "labelNode": "Script", "descriptionNode": "Execute custom JS script", "open": false,
        "settings": {"value": "flowTools/summarise/returnSummary.js", "label": "Return summary", "keyValuePairs": []} },
      "dragHandle": ".drag-handle__custom" },
    { "id": "scriptNode_iJf0vACKtvIP", "type": "scriptNode", "position": {"x": 800, "y": 1824},
      "data": { "label": "Reply failure", "description": "Tells the calling agent the tool failed", "labelNode": "Script", "descriptionNode": "Execute custom JS script", "open": false,
        "settings": {"value": "flowTools/shared/replyFailure.js", "label": "Reply failure", "keyValuePairs": [{"key": "tool", "value": "Summarise Document"}]} },
      "dragHandle": ".drag-handle__custom" },
    { "id": "endNode_KC8dPX2fEjRb", "type": "endNode", "position": {"x": 304, "y": 2256},
      "data": { "label": "End", "description": "", "labelNode": "End Flow", "descriptionNode": "Flow terminal", "open": false,
        "settings": {"value": "End", "label": "End", "terminateDictionary": false} },
      "dragHandle": ".drag-handle__custom" }
  ],
  "edges": [
    {"id": "xy-edge__startNode_hJIpMEDE5PcBnext-scriptNode_SSj3YrPgJeAiin", "type": "step", "source": "startNode_hJIpMEDE5PcB", "sourceHandle": "next", "target": "scriptNode_SSj3YrPgJeAi", "targetHandle": "in"},
    {"id": "xy-edge__scriptNode_SSj3YrPgJeAinext_1-conditionNode_Eip3RQEUl4Hjin", "type": "step", "source": "scriptNode_SSj3YrPgJeAi", "sourceHandle": "next_1", "target": "conditionNode_Eip3RQEUl4Hj", "targetHandle": "in"},
    {"id": "xy-edge__scriptNode_SSj3YrPgJeAierror-scriptNode_iJf0vACKtvIPin", "type": "step", "source": "scriptNode_SSj3YrPgJeAi", "sourceHandle": "error", "target": "scriptNode_iJf0vACKtvIP", "targetHandle": "in"},
    {"id": "xy-edge__conditionNode_Eip3RQEUl4Hjtrue-agentNode_TgeIRj3bpvWtin", "type": "step", "source": "conditionNode_Eip3RQEUl4Hj", "sourceHandle": "true", "target": "agentNode_TgeIRj3bpvWt", "targetHandle": "in"},
    {"id": "xy-edge__conditionNode_Eip3RQEUl4Hjfalse-endNode_KC8dPX2fEjRbin", "type": "step", "source": "conditionNode_Eip3RQEUl4Hj", "sourceHandle": "false", "target": "endNode_KC8dPX2fEjRb", "targetHandle": "in"},
    {"id": "xy-edge__agentNode_TgeIRj3bpvWtnext_1-scriptNode_cFo4o91HP2c5in", "type": "step", "source": "agentNode_TgeIRj3bpvWt", "sourceHandle": "next_1", "target": "scriptNode_cFo4o91HP2c5", "targetHandle": "in"},
    {"id": "xy-edge__agentNode_TgeIRj3bpvWterror-scriptNode_iJf0vACKtvIPin", "type": "step", "source": "agentNode_TgeIRj3bpvWt", "sourceHandle": "error", "target": "scriptNode_iJf0vACKtvIP", "targetHandle": "in"},
    {"id": "xy-edge__scriptNode_cFo4o91HP2c5next_1-endNode_KC8dPX2fEjRbin", "type": "step", "source": "scriptNode_cFo4o91HP2c5", "sourceHandle": "next_1", "target": "endNode_KC8dPX2fEjRb", "targetHandle": "in"},
    {"id": "xy-edge__scriptNode_cFo4o91HP2c5error-scriptNode_iJf0vACKtvIPin", "type": "step", "source": "scriptNode_cFo4o91HP2c5", "sourceHandle": "error", "target": "scriptNode_iJf0vACKtvIP", "targetHandle": "in"},
    {"id": "xy-edge__scriptNode_iJf0vACKtvIPnext_1-endNode_KC8dPX2fEjRbin", "type": "step", "source": "scriptNode_iJf0vACKtvIP", "sourceHandle": "next_1", "target": "endNode_KC8dPX2fEjRb", "targetHandle": "in"},
    {"id": "xy-edge__scriptNode_iJf0vACKtvIPerror-endNode_KC8dPX2fEjRbin", "type": "step", "source": "scriptNode_iJf0vACKtvIP", "sourceHandle": "error", "target": "endNode_KC8dPX2fEjRb", "targetHandle": "in"}
  ]
}
```

```js
// src/scripts/flowTools/summarise/seedSummariser.js
import Agent from 'system/agent';
import Tools from 'system/tools';
import { readContext, replyToCaller } from '../shared/toolCall.js';

const MAX_CHARS = 60000;

export async function exec() {
    const { raw, value } = readContext();
    const text = typeof value?.text === 'string' ? value.text.trim() : '';
    const focus = typeof value?.focus === 'string' ? value.focus.trim() : '';

    if (!text || text.length > MAX_CHARS) {
        dictionary.summarise = { ok: false };                         // the Condition sends this to End
        replyToCaller(text
            ? `Summarise Document: the text has ${text.length} characters; the limit is ${MAX_CHARS}. Send a shorter part.`
            : 'Summarise Document input invalid. Send !*context as JSON {"text": "<the full text>", "focus": "<optional>"}. You sent: ' + (raw.slice(0, 200) || '(empty)'));
        return { ok: false };
    }

    // The sub-agent's user message: on THIS flow's session, which is the sub-agent's session.
    Agent.setRootAgentPrompt('doc-summariser', {
        prompt: JSON.stringify({ text, focus }),
        sessionID: flowContext.sessionId,
        requestID: Tools.generateUUID()
    });
    dictionary.summarise = { ok: true };
    return { ok: true };
}
```

```js
// src/scripts/flowTools/summarise/returnSummary.js
import Agent from 'system/agent';
import { replyToCaller } from '../shared/toolCall.js';

export async function exec() {
    // The sub-agent answered on this flow's session.
    const answer = (Agent.getAgentLastResponseBySessionId('doc-summariser', flowContext.sessionId)?.response ?? '').trim();
    delete dictionary.summarise;                                      // leave the caller's dictionary as it was
    replyToCaller(answer
        ? `Summary of the document:\n${answer}`
        : 'Summarise Document produced no summary. Tell the customer you could not summarise the text.');
    return { ok: Boolean(answer) };
}
```

## Example 3 — Shipping Check: a Condition branches

`Start → Read request → Condition ${dictionary.shippingCheck.valid} == true → (true) Quote shipping / (false) Reply invalid → End`.
A Condition cannot read the JSON text of `!*context`, so the first Script turns it into a boolean under one
namespaced key; the Script that ends each branch deletes the key, so the caller's dictionary is left as it was.

The calling prompt's lines:

```
2. Shipping Check
Description: whether we ship to a postcode and what delivery costs for a parcel weight.
Usage: !*context is JSON {"postcode": "<4 digits>", "weightKg": <number>}.
```

Registry entry: `{ "name": "Shipping Check", "type": "flow", "entry": "ShippingCheck-Start" }`.

```json
{
  "nodes": [
    { "id": "startNode_8n6qFsPwPwH5", "type": "startNode", "position": {"x": 304, "y": 96},
      "data": { "label": "Start", "description": "Entry of the Shipping Check tool", "labelNode": "Start Flow", "descriptionNode": "Flow entry point", "open": false,
        "settings": {"label": "Start", "value": "Start"} },
      "dragHandle": ".drag-handle__custom" },
    { "id": "scriptNode_uj7cKX5EtHZU", "type": "scriptNode", "position": {"x": 304, "y": 528},
      "data": { "label": "Read request", "description": "Parses the input into dictionary.shippingCheck", "labelNode": "Script", "descriptionNode": "Execute custom JS script", "open": false,
        "settings": {"value": "flowTools/shippingCheck/readRequest.js", "label": "Read request", "keyValuePairs": []} },
      "dragHandle": ".drag-handle__custom" },
    { "id": "conditionNode_VkYMcRhF0xmD", "type": "conditionNode", "position": {"x": 304, "y": 960},
      "data": { "label": "${dictionary.shippingCheck.valid} == true", "description": "Usable postcode and weight?", "labelNode": "Condition", "descriptionNode": "Set condition flow direction", "open": false,
        "settings": {"value": "${dictionary.shippingCheck.valid} == true"} },
      "dragHandle": ".drag-handle__custom" },
    { "id": "scriptNode_EUABvXvTtL7Q", "type": "scriptNode", "position": {"x": 304, "y": 1392},
      "data": { "label": "Quote shipping", "description": "Computes the zone price and replies", "labelNode": "Script", "descriptionNode": "Execute custom JS script", "open": false,
        "settings": {"value": "flowTools/shippingCheck/quoteShipping.js", "label": "Quote shipping", "keyValuePairs": []} },
      "dragHandle": ".drag-handle__custom" },
    { "id": "scriptNode_xGr0GuqkPRNd", "type": "scriptNode", "position": {"x": 800, "y": 1392},
      "data": { "label": "Reply invalid", "description": "Tells the agent what to fix", "labelNode": "Script", "descriptionNode": "Execute custom JS script", "open": false,
        "settings": {"value": "flowTools/shippingCheck/replyInvalid.js", "label": "Reply invalid", "keyValuePairs": []} },
      "dragHandle": ".drag-handle__custom" },
    { "id": "scriptNode_vQ14wrIY1pgT", "type": "scriptNode", "position": {"x": 1296, "y": 1392},
      "data": { "label": "Reply failure", "description": "Tells the calling agent the tool failed", "labelNode": "Script", "descriptionNode": "Execute custom JS script", "open": false,
        "settings": {"value": "flowTools/shared/replyFailure.js", "label": "Reply failure", "keyValuePairs": [{"key": "tool", "value": "Shipping Check"}]} },
      "dragHandle": ".drag-handle__custom" },
    { "id": "endNode_ALECgmXo46AK", "type": "endNode", "position": {"x": 304, "y": 1824},
      "data": { "label": "End", "description": "", "labelNode": "End Flow", "descriptionNode": "Flow terminal", "open": false,
        "settings": {"value": "End", "label": "End", "terminateDictionary": false} },
      "dragHandle": ".drag-handle__custom" }
  ],
  "edges": [
    {"id": "xy-edge__startNode_8n6qFsPwPwH5next-scriptNode_uj7cKX5EtHZUin", "type": "step", "source": "startNode_8n6qFsPwPwH5", "sourceHandle": "next", "target": "scriptNode_uj7cKX5EtHZU", "targetHandle": "in"},
    {"id": "xy-edge__scriptNode_uj7cKX5EtHZUnext_1-conditionNode_VkYMcRhF0xmDin", "type": "step", "source": "scriptNode_uj7cKX5EtHZU", "sourceHandle": "next_1", "target": "conditionNode_VkYMcRhF0xmD", "targetHandle": "in"},
    {"id": "xy-edge__scriptNode_uj7cKX5EtHZUerror-scriptNode_vQ14wrIY1pgTin", "type": "step", "source": "scriptNode_uj7cKX5EtHZU", "sourceHandle": "error", "target": "scriptNode_vQ14wrIY1pgT", "targetHandle": "in"},
    {"id": "xy-edge__conditionNode_VkYMcRhF0xmDtrue-scriptNode_EUABvXvTtL7Qin", "type": "step", "source": "conditionNode_VkYMcRhF0xmD", "sourceHandle": "true", "target": "scriptNode_EUABvXvTtL7Q", "targetHandle": "in"},
    {"id": "xy-edge__conditionNode_VkYMcRhF0xmDfalse-scriptNode_xGr0GuqkPRNdin", "type": "step", "source": "conditionNode_VkYMcRhF0xmD", "sourceHandle": "false", "target": "scriptNode_xGr0GuqkPRNd", "targetHandle": "in"},
    {"id": "xy-edge__scriptNode_EUABvXvTtL7Qnext_1-endNode_ALECgmXo46AKin", "type": "step", "source": "scriptNode_EUABvXvTtL7Q", "sourceHandle": "next_1", "target": "endNode_ALECgmXo46AK", "targetHandle": "in"},
    {"id": "xy-edge__scriptNode_EUABvXvTtL7Qerror-scriptNode_vQ14wrIY1pgTin", "type": "step", "source": "scriptNode_EUABvXvTtL7Q", "sourceHandle": "error", "target": "scriptNode_vQ14wrIY1pgT", "targetHandle": "in"},
    {"id": "xy-edge__scriptNode_xGr0GuqkPRNdnext_1-endNode_ALECgmXo46AKin", "type": "step", "source": "scriptNode_xGr0GuqkPRNd", "sourceHandle": "next_1", "target": "endNode_ALECgmXo46AK", "targetHandle": "in"},
    {"id": "xy-edge__scriptNode_xGr0GuqkPRNderror-scriptNode_vQ14wrIY1pgTin", "type": "step", "source": "scriptNode_xGr0GuqkPRNd", "sourceHandle": "error", "target": "scriptNode_vQ14wrIY1pgT", "targetHandle": "in"},
    {"id": "xy-edge__scriptNode_vQ14wrIY1pgTnext_1-endNode_ALECgmXo46AKin", "type": "step", "source": "scriptNode_vQ14wrIY1pgT", "sourceHandle": "next_1", "target": "endNode_ALECgmXo46AK", "targetHandle": "in"},
    {"id": "xy-edge__scriptNode_vQ14wrIY1pgTerror-endNode_ALECgmXo46AKin", "type": "step", "source": "scriptNode_vQ14wrIY1pgT", "sourceHandle": "error", "target": "endNode_ALECgmXo46AK", "targetHandle": "in"}
  ]
}
```

```js
// src/scripts/flowTools/shippingCheck/readRequest.js
import { readContext } from '../shared/toolCall.js';

export async function exec() {
    const { raw, value } = readContext();
    const postcode = String(value?.postcode ?? '').trim();
    const weightKg = Number(value?.weightKg);
    let reason = '';
    if (!/^[0-9]{4}$/.test(postcode)) reason = 'postcode must be exactly 4 digits';
    else if (!(weightKg > 0 && weightKg <= 30)) reason = 'weightKg must be a number above 0 and at most 30';

    // A Condition cannot parse JSON: put a boolean where it can test it.
    dictionary.shippingCheck = { valid: reason === '', postcode, weightKg, reason, sent: raw.slice(0, 200) };
    return { valid: reason === '' };
}
```

```js
// src/scripts/flowTools/shippingCheck/quoteShipping.js
import { replyToCaller } from '../shared/toolCall.js';

// Fictional zones by the postcode's first digit; prices in euro.
const ZONES = {
    city: { base: 4.9, perKg: 0.2, days: '1-2' },
    mainland: { base: 6.9, perKg: 0.35, days: '2-3' },
    islands: { base: 12.5, perKg: 0.8, days: '4-6' }
};
const zoneOf = postcode => ({ 1: 'city', 2: 'mainland', 3: 'mainland', 4: 'mainland', 5: 'mainland', 6: 'mainland', 7: 'islands', 8: 'islands' })[postcode[0]];

export async function exec() {
    const { postcode, weightKg } = dictionary.shippingCheck;
    delete dictionary.shippingCheck;
    const zone = zoneOf(postcode);
    if (!zone) {
        replyToCaller(`Shipping Check: we do not deliver to postcode ${postcode}.`);
        return { ok: true };
    }
    const z = ZONES[zone];
    const price = Math.ceil(weightKg) * z.perKg + z.base;
    replyToCaller(`Shipping Check: postcode ${postcode} is zone "${zone}"; a ${weightKg} kg parcel costs EUR ${price.toFixed(2)} and arrives in ${z.days} working days.`);
    return { ok: true };
}
```

```js
// src/scripts/flowTools/shippingCheck/replyInvalid.js
import { replyToCaller } from '../shared/toolCall.js';

export async function exec() {
    const { reason, sent } = dictionary.shippingCheck;
    delete dictionary.shippingCheck;
    replyToCaller(`Shipping Check input invalid: ${reason}. Send !*context as JSON {"postcode": "<4 digits>", "weightKg": <number>}. You sent: ${sent || '(empty)'}`);
    return { ok: false };
}
```

## Example 4 — Research Manuals: a sub-agent with its own tools (pattern c)

The outer agent calls **Research Manuals**. Its flow seeds the sub-agent `manual-researcher`, whose own system
prompt describes two **script tools**, `DocStore Search` and `DocStore Chunk`. The researcher calls them as often
as it needs (each reply goes to the researcher, not to the outer agent), answers, and the return Script hands that
answer to the outer agent.

```
shop-assistant ──<SYSTEM CALL> Research Manuals──▶ ResearchTool.flow
   (waits)                                           Seed researcher ─▶ Condition ─▶ LLM manual-researcher
                                                                                      │  ▲ <SYSTEM CALL> DocStore Search / Chunk
                                                                                      ▼  │ reply to manual-researcher
                                                                                    tools/docStore…Tool.js
                                                     Return findings ◀── next_1 (its final text)
   ◀── reply on shop-assistant's session ────────────┘
```

- The researcher keeps **Interact with DB on**: on each recall it rebuilds its context from chat history (its
  question, its calls, the replies). Its question is also in its system prompt, from
  `${dictionary.research.question}`, resolved on every round.
- Its prompt does **not** list Research Manuals (no recursion) and caps its calls at 6.
- Inside the two script tools, `toolOptions.toolContext.agentId` is `manual-researcher` and
  `toolOptions.agentNode.flowContext.sessionId` is the researcher's session — the same reply code as any script
  tool answers the researcher. `Return findings` still has the outer call's `toolOptions` and answers
  `shop-assistant`.
- The agent needs the Secret `DOCSTORE_KEY` and the Json Settings `{"doc_store_available": true}` (read only in the
  tools, handed to `DocStoreService.connect`). The two tools import only the service's `service.js`.

The calling prompt's lines:

```
4. Research Manuals
Description: researches a technical question in Lumen Home's product manuals and answers with the sources. Slower than the other tools; use it only for technical questions about a product.
Usage: !*context is JSON {"question": "<the customer's question, complete>"}.
```

Registry entries: `Research Manuals` → `ResearchTool-Start` (flow), `DocStore Search` →
`tools/docStoreSearchTool.js` and `DocStore Chunk` → `tools/docStoreChunkTool.js` (script).

```json
{
  "nodes": [
    { "id": "startNode_DdFQdjJikE7a", "type": "startNode", "position": {"x": 304, "y": 96},
      "data": { "label": "Start", "description": "Entry of the Research Manuals tool", "labelNode": "Start Flow", "descriptionNode": "Flow entry point", "open": false,
        "settings": {"label": "Start", "value": "Start"} },
      "dragHandle": ".drag-handle__custom" },
    { "id": "scriptNode_D4vk3WEaaPRC", "type": "scriptNode", "position": {"x": 304, "y": 528},
      "data": { "label": "Seed researcher", "description": "Checks the question and gives the researcher its user message", "labelNode": "Script", "descriptionNode": "Execute custom JS script", "open": false,
        "settings": {"value": "flowTools/research/seedResearcher.js", "label": "Seed researcher", "keyValuePairs": []} },
      "dragHandle": ".drag-handle__custom" },
    { "id": "conditionNode_YURfFHTHIgCU", "type": "conditionNode", "position": {"x": 304, "y": 960},
      "data": { "label": "${dictionary.research.ok} == true", "description": "Was there a question?", "labelNode": "Condition", "descriptionNode": "Set condition flow direction", "open": false,
        "settings": {"value": "${dictionary.research.ok} == true"} },
      "dragHandle": ".drag-handle__custom" },
    { "id": "agentNode_biuPWxxZGp6b", "type": "agentNode", "position": {"x": 304, "y": 1392},
      "data": { "label": "", "description": "The sub-agent: calls DocStore Search / DocStore Chunk, then answers", "labelNode": "LLM", "descriptionNode": "Use LLM processor", "open": false, "openLLM": false, "openPrompt": false,
        "settings": {
          "agentId": "manual-researcher",
          "agentName": "Manual Researcher",
          "sessionId": "",
          "requestId": "",
          "llm": {
            "company": "anthropic",
            "model": "claude-sonnet-4-6",
            "modelId": 4938,
            "parameters": {
              "temperature": 0.2,
              "maxTokens": 4096
            }
          },
          "prompts": [
            {
              "id": "af82465b-1e34-4295-bd50-02b42d36ddf1",
              "role": "system",
              "content": "You research technical questions in Lumen Home's product manuals for a shop assistant.\nThe question: ${dictionary.research.question}\n\nWhen you need a tool, write exactly one block, with each marker at the start of a line:\n\n<SYSTEM CALL>\n!*action\nuse tool\n!*tool\n<the tool's name>\n!*context\n<the input the tool needs>\n</SYSTEM CALL>\n\nWrite nothing else inside the block, then wait for the tool's reply; it arrives as the next user message.\n\nTools:\n1. DocStore Search\nDescription: finds manual passages for a query; returns up to 5 hits, each with documentId, index, title, page and a snippet.\nUsage: !*context is JSON {\"query\": \"<search words>\"}.\n2. DocStore Chunk\nDescription: returns the full text of one passage.\nUsage: !*context is JSON {\"documentId\": \"<from a hit>\", \"index\": <the hit's index>}.\n\nWork like this: search once or twice, read at most 3 passages, then answer. Use at most 6 tool calls in all.\nYour final answer: 2-6 sentences that answer the question, then a line \"Sources:\" with title and page of each passage you used.\nIf the manuals do not answer it, say exactly that. Never answer from memory."
            }
          ],
          "specialRules": []
        } },
      "dragHandle": ".drag-handle__custom" },
    { "id": "scriptNode_Ijdv4OosRKT5", "type": "scriptNode", "position": {"x": 304, "y": 1824},
      "data": { "label": "Return findings", "description": "Files the researcher's answer for the calling agent", "labelNode": "Script", "descriptionNode": "Execute custom JS script", "open": false,
        "settings": {"value": "flowTools/research/returnFindings.js", "label": "Return findings", "keyValuePairs": []} },
      "dragHandle": ".drag-handle__custom" },
    { "id": "scriptNode_4QxRouAyONlm", "type": "scriptNode", "position": {"x": 800, "y": 1824},
      "data": { "label": "Reply failure", "description": "Tells the calling agent the tool failed", "labelNode": "Script", "descriptionNode": "Execute custom JS script", "open": false,
        "settings": {"value": "flowTools/shared/replyFailure.js", "label": "Reply failure", "keyValuePairs": [{"key": "tool", "value": "Research Manuals"}]} },
      "dragHandle": ".drag-handle__custom" },
    { "id": "endNode_QRFlI2nOT0m8", "type": "endNode", "position": {"x": 304, "y": 2256},
      "data": { "label": "End", "description": "", "labelNode": "End Flow", "descriptionNode": "Flow terminal", "open": false,
        "settings": {"value": "End", "label": "End", "terminateDictionary": false} },
      "dragHandle": ".drag-handle__custom" }
  ],
  "edges": [
    {"id": "xy-edge__startNode_DdFQdjJikE7anext-scriptNode_D4vk3WEaaPRCin", "type": "step", "source": "startNode_DdFQdjJikE7a", "sourceHandle": "next", "target": "scriptNode_D4vk3WEaaPRC", "targetHandle": "in"},
    {"id": "xy-edge__scriptNode_D4vk3WEaaPRCnext_1-conditionNode_YURfFHTHIgCUin", "type": "step", "source": "scriptNode_D4vk3WEaaPRC", "sourceHandle": "next_1", "target": "conditionNode_YURfFHTHIgCU", "targetHandle": "in"},
    {"id": "xy-edge__scriptNode_D4vk3WEaaPRCerror-scriptNode_4QxRouAyONlmin", "type": "step", "source": "scriptNode_D4vk3WEaaPRC", "sourceHandle": "error", "target": "scriptNode_4QxRouAyONlm", "targetHandle": "in"},
    {"id": "xy-edge__conditionNode_YURfFHTHIgCUtrue-agentNode_biuPWxxZGp6bin", "type": "step", "source": "conditionNode_YURfFHTHIgCU", "sourceHandle": "true", "target": "agentNode_biuPWxxZGp6b", "targetHandle": "in"},
    {"id": "xy-edge__conditionNode_YURfFHTHIgCUfalse-endNode_QRFlI2nOT0m8in", "type": "step", "source": "conditionNode_YURfFHTHIgCU", "sourceHandle": "false", "target": "endNode_QRFlI2nOT0m8", "targetHandle": "in"},
    {"id": "xy-edge__agentNode_biuPWxxZGp6bnext_1-scriptNode_Ijdv4OosRKT5in", "type": "step", "source": "agentNode_biuPWxxZGp6b", "sourceHandle": "next_1", "target": "scriptNode_Ijdv4OosRKT5", "targetHandle": "in"},
    {"id": "xy-edge__agentNode_biuPWxxZGp6berror-scriptNode_4QxRouAyONlmin", "type": "step", "source": "agentNode_biuPWxxZGp6b", "sourceHandle": "error", "target": "scriptNode_4QxRouAyONlm", "targetHandle": "in"},
    {"id": "xy-edge__scriptNode_Ijdv4OosRKT5next_1-endNode_QRFlI2nOT0m8in", "type": "step", "source": "scriptNode_Ijdv4OosRKT5", "sourceHandle": "next_1", "target": "endNode_QRFlI2nOT0m8", "targetHandle": "in"},
    {"id": "xy-edge__scriptNode_Ijdv4OosRKT5error-scriptNode_4QxRouAyONlmin", "type": "step", "source": "scriptNode_Ijdv4OosRKT5", "sourceHandle": "error", "target": "scriptNode_4QxRouAyONlm", "targetHandle": "in"},
    {"id": "xy-edge__scriptNode_4QxRouAyONlmnext_1-endNode_QRFlI2nOT0m8in", "type": "step", "source": "scriptNode_4QxRouAyONlm", "sourceHandle": "next_1", "target": "endNode_QRFlI2nOT0m8", "targetHandle": "in"},
    {"id": "xy-edge__scriptNode_4QxRouAyONlmerror-endNode_QRFlI2nOT0m8in", "type": "step", "source": "scriptNode_4QxRouAyONlm", "sourceHandle": "error", "target": "endNode_QRFlI2nOT0m8", "targetHandle": "in"}
  ]
}
```

```js
// src/scripts/flowTools/research/seedResearcher.js
import Agent from 'system/agent';
import Tools from 'system/tools';
import { readContext, replyToCaller } from '../shared/toolCall.js';

export async function exec() {
    const { raw, value } = readContext();
    const question = typeof value?.question === 'string' ? value.question.trim() : '';
    if (!question || question.length > 1000) {
        dictionary.research = { ok: false };
        replyToCaller('Research Manuals input invalid. Send !*context as JSON {"question": "<the question, at most 1000 characters>"}. You sent: ' + (raw.slice(0, 200) || '(empty)'));
        return { ok: false };
    }
    // Read by the researcher's system prompt (${dictionary.research.question}) on every round.
    dictionary.research = { ok: true, question };
    // The researcher's user message, on this flow's session (= the researcher's session).
    Agent.setRootAgentPrompt('manual-researcher', {
        prompt: question,
        sessionID: flowContext.sessionId,
        requestID: Tools.generateUUID()
    });
    return { ok: true };
}
```

```js
// src/scripts/flowTools/research/returnFindings.js
import Agent from 'system/agent';
import { replyToCaller } from '../shared/toolCall.js';

export async function exec() {
    // The researcher's newest answer on this session is its final text (its tool loop is over).
    const answer = (Agent.getAgentLastResponseBySessionId('manual-researcher', flowContext.sessionId)?.response ?? '').trim();
    delete dictionary.research;
    replyToCaller(answer
        ? `Research Manuals result:\n${answer}`
        : 'Research Manuals found nothing. Tell the customer the manuals do not cover it.');
    return { ok: Boolean(answer) };
}
```

The researcher's two tools, thin entry points over the service (the house standard,
[name-tool.md](../../../../ProjectStructure/src/scripts/tools/name-tool.md), `../../../../Services/SKILL.md`). They
reply in plain text, because the reader is the researcher's model:

```js
// src/scripts/tools/docStoreSearchTool.js
import Agent from 'system/agent';
import Secrets from 'system/secrets';
import Settings from 'system/settings';
import Tools from 'system/tools';
import * as DocStoreService from '../services/docStore/service.js';

export async function exec() {
    const call = toolOptions.toolContext;                      // the caller here is the RESEARCHER
    const reply = text => Agent.setRootAgentPrompt(call.agentId, {
        prompt: text,
        sessionID: toolOptions.agentNode.flowContext.sessionId,
        requestID: Tools.generateUUID()
    });

    const [available, baseUrl] = Settings.getMany('doc_store_available', 'doc_store_api_url');
    if (available !== true) {
        reply('DocStore Search is not available on this agent. Answer that the manuals cannot be searched now.');
        return { ok: false };
    }
    const raw = (call.options.context ?? '').trim();
    let input;
    try { input = JSON.parse(raw); } catch { input = null; }
    if (!input || typeof input.query !== 'string' || input.query.trim() === '') {
        reply('DocStore Search input invalid. Send !*context as JSON {"query": "<search words>"}. You sent: ' + (raw.slice(0, 200) || '(empty)'));
        return { ok: false };
    }
    const apiKey = Secrets.get('DOCSTORE_KEY');
    if (apiKey === undefined) {
        reply('DocStore Search is not set up: the agent has no DOCSTORE_KEY secret.');
        return { ok: false };
    }
    try {
        const docStore = DocStoreService.connect({ apiKey }, { baseUrl });
        const { hits } = await docStore.search({ query: input.query });
        reply(hits.length === 0
            ? `DocStore Search: no passages for "${input.query.trim()}".`
            : hits.map((h, i) => `${i + 1}. ${h.title} (page ${h.page ?? '?'}) — documentId ${h.documentId}, index ${h.index}: ${h.text}`).join('\n'));
        return { ok: true };
    } catch (err) {
        reply(`DocStore Search failed: ${err.message}`);
        return { ok: false };
    }
}
```

```js
// src/scripts/tools/docStoreChunkTool.js
import Agent from 'system/agent';
import Secrets from 'system/secrets';
import Settings from 'system/settings';
import Tools from 'system/tools';
import * as DocStoreService from '../services/docStore/service.js';

export async function exec() {
    const call = toolOptions.toolContext;
    const reply = text => Agent.setRootAgentPrompt(call.agentId, {
        prompt: text,
        sessionID: toolOptions.agentNode.flowContext.sessionId,
        requestID: Tools.generateUUID()
    });

    const [available, baseUrl] = Settings.getMany('doc_store_available', 'doc_store_api_url');
    if (available !== true) {
        reply('DocStore Chunk is not available on this agent. Answer that the manuals cannot be read now.');
        return { ok: false };
    }
    const raw = (call.options.context ?? '').trim();
    let input;
    try { input = JSON.parse(raw); } catch { input = null; }
    if (!input || typeof input.documentId !== 'string' || !Number.isInteger(input.index) || input.index < 0) {
        reply('DocStore Chunk input invalid. Send !*context as JSON {"documentId": "<id>", "index": <number>}. You sent: ' + (raw.slice(0, 200) || '(empty)'));
        return { ok: false };
    }
    const apiKey = Secrets.get('DOCSTORE_KEY');
    if (apiKey === undefined) {
        reply('DocStore Chunk is not set up: the agent has no DOCSTORE_KEY secret.');
        return { ok: false };
    }
    try {
        const docStore = DocStoreService.connect({ apiKey }, { baseUrl });
        const chunk = await docStore.getChunk({ documentId: input.documentId, index: input.index });
        reply(`${chunk.title} — documentId ${chunk.documentId}, index ${chunk.index}:\n${chunk.text}`);
        return { ok: true };
    } catch (err) {
        reply(`DocStore Chunk failed: ${err.message}`);
        return { ok: false };
    }
}
```

The service `src/scripts/services/docStore/` is the house standard's four files — `service.js` (`connect` + the
instruments `search` and `getChunk`), `connector.js` (`createConnection`), `utils.js`, `settings.js` — the same files as
in [../../ScriptTool/references/examples.md](../../ScriptTool/references/examples.md) §2; this project was
validated with them. Its skill: `.claude/skills/doc-store-service/SKILL.md`.
