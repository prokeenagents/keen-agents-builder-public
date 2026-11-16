# Tool calling — the `<SYSTEM CALL>` protocol

An LLM node calls a tool by writing a `<SYSTEM CALL>` block in its answer. The engine runs the named tool (a flow or
a script). The tool sends its result back as a new **user message** to the calling agent, and the same LLM node runs
again. The loop continues until the model answers with plain text, which leaves the node like any answer.
The engine adds no tool list and no instructions: you write both into the system prompt.

## 1. What you must provide

1. **`src/keen-tools.json`** (next to `src/flows/` and `src/scripts/`, not at the project root):
   `{ "tools": [ { "name": "…", "type": "script" | "flow", "entry": "…" } ] }`. A `keen-tools.json` at the project root
   is not deployed, and keen-validate takes it for another project layout: it warns once and stops checking the flows.
   The deploy refuses a file whose top level is not `{ "tools": [ {…}, … ] }` (`keen-tools.json: "tools" must be a list
   of tool objects`). keen-validate checks the following:
   - names are unique and `type` is `script` or `flow`;
   - a **script** `entry` starts with `tools/`, has no `..`, and exists under `src/scripts/` (e.g. `tools/lookup.js`;
     sub-folders are fine);
   - a **flow** `entry` is a `File-Label` that resolves to a flow's Start (e.g. `Lookup-Start`).

   At run time the engine reads the registry from the deployed project, so re-deploy after every change.
2. **The system prompt**: the call format plus one entry per tool. The model must write `!*tool` exactly as the
   tool's `name`.
3. **Use tools on**: no `skip-internal-tooling` in `specialRules`.
4. **A tool that replies**: see §4. A tool that runs but sends nothing makes the agent read `No tool response`.

## 2. The block the model writes

```
<SYSTEM CALL>
!*action
use tool
!*tool
Order Lookup
!*context
{"orderId": "A-1042"}
</SYSTEM CALL>
```

- Both markers are required, written exactly like this (upper case, one space), with the closer after the opener. A
  block with no closer (e.g. cut at Max Tokens) is plain text and nothing runs.
- A field is `!*<word>` followed by **whitespace** (a newline or a space). Its value is the trimmed text up to the next
  field or the closer. `!*tool:` is not a field.
- A value cannot contain `!*<word>` followed by whitespace: that starts a new field. Keep the markers out of
  `!*context` (JSON is fine).
- Only `!*tool` routes: it is looked up by `name` in the registry, and the registry `type` decides flow or script.
  `!*action` is informational. `!*context` and any other `!*key` are passed to the tool as they are.
- Text before and after the block is allowed. If the answer holds several blocks, **only the first** (with at least
  one field) runs.
- The block's text streams to the chat client like any answer text, and the turn is saved as a tool turn. Only the
  later text answer becomes the chat's displayed answer.

A system-prompt section that works:

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

Write nothing else inside the block. Then wait for the tool's reply; it arrives as the next user message.

Tools:
1. Order Lookup
Description: returns an order's status and items.
Usage: !*context is JSON {"orderId": "<id>"}.
```

The prompt's `content` takes `${dictionary.*}` / `${session.*}`, so parts of the tool list can come from the dictionary.

## 3. The loop, step by step

1. The answer holds a complete block and Use tools is on, so it is a tool call. The turn is recorded, and the first
   block is parsed.
2. If something is wrong, **no tool runs**. The engine files a corrective **user** message for the agent and calls the
   same LLM node again. This never takes Fallback:
   - no `!*key` field could be parsed → `Could not parse the SYSTEM CALL block.`
   - `!*tool` names no registered tool → `The requested tool does not exist.`
   - a script tool whose `entry` is not under `tools/` (or has `..`), or a flow tool whose `entry` matches no
     Start → `No tool response`
3. Otherwise the tool runs as a sub-run on **the calling agent's dictionary**. A script tool runs that one script; a
   flow tool runs from its Start. The calling LLM node waits until the tool has finished.
4. The LLM node runs again. If a **new** user message was filed for the agent since the call, that message is the
   tool's result and becomes the newest user turn. If not, the engine files `No tool response`, and the model answers
   that instead.
5. The model answers again: another block goes back to step 1, plain text leaves the node. The engine sets no limit
   on the number of rounds, so tell the model in the prompt when to stop calling.

During the loop the model sees every tool turn of the current exchange. Tool turns of earlier exchanges are left
out of its history.

## 4. Writing a tool that replies

A tool's `return` value never reaches the model. The tool must **file a user message** for the calling agent,
**on the calling agent's session**:

```js
import Agent from 'system/agent';
import Tools from 'system/tools';

export const exec = async () => {
    const call = toolOptions.toolContext;                       // the parsed block
    const input = (call.options.context ?? '').trim();          // the !*context text
    const reply = text => Agent.setRootAgentPrompt(call.agentId, {
        prompt: text,                                           // must be a non-empty string
        sessionID: toolOptions.agentNode.flowContext.sessionId, // the CALLING agent's session — required
        requestID: Tools.generateUUID()
    });

    let order;
    try { order = JSON.parse(input); } catch { order = null; }
    if (!order || typeof order.orderId !== 'string') {
        reply('Tool input invalid. Send !*context as JSON {"orderId": "<id>"}. You sent: ' + (input || '(empty)'));
        return { ok: false };
    }
    // … look the order up, then:
    reply(`Order ${order.orderId}: shipped on 2026-11-10.`);
    return { ok: true };
};
```

- `toolOptions` is a global, present only inside a tool. `toolOptions.toolContext` has `agentId` (the agent to reply
  to), `options` (the parsed fields: `action`, `tool`, `context`, any extra key) and `prompt` (the model's full text).
  `toolOptions.agentNode.flowContext.sessionId` is the calling agent's session.
- The bare `flowContext.sessionId` inside a tool is the **tool's own** session. A reply filed on it is not the one the
  agent looks for first, so always use `toolOptions.agentNode.flowContext.sessionId`.
- A tool that checks its input and replies with what is wrong, as above, lets the model correct its call and try again.
- **A flow tool** works the same way: `toolOptions` is present in the Script nodes of the tool flow's own path (the
  engine copies it to the next steps; after an LLM node the client re-adds it), so the flow's last Script files the
  reply with the code above. It is **absent** inside a Run Flow child or a parallel sub-flow started from the tool flow —
  answer from the tool flow itself. Details: `../../../Tools/FlowTool/flow-tool-skill.md` §1.7. A flow tool that contains its own LLM node needs a user message
  filed for that inner agent's `agentId` first, or the inner agent has nothing to answer.
- Wire a Script's `error` in a tool flow to a handler that replies with a clear failure text. An unwired `error`
  stalls the tool, and the agent never gets its reply.
