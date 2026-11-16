// First node of a worker flow tool. Key/Value Pairs: key (the worker's dictionary key),
// worker (its agentId), tool (the tool's name). The dictionary is the CALLER's: keep everything
// under ONE namespaced key and delete it at the end.
import Agent from 'system/agent';
import Tools from 'system/tools';
import { readContextJson, replyToCaller } from './workerCall.js';

export async function exec(props) {
    const key = String(props.key);
    const { raw, value } = readContextJson();
    const task = typeof value?.task === 'string' ? value.task.trim() : '';
    if (!task || task.length > 1000) {
        dictionary[key] = { ok: false };                         // the Condition sends this to "Drop memory"
        replyToCaller(`${props.tool} input invalid. Send !*context as JSON {"task": "<one clear task, at most 1000 characters>"}. You sent: ${raw.slice(0, 200) || '(empty)'}`);
        return { ok: false };
    }
    // The working memory the worker's system prompt reads on EVERY run (every return from a tool too).
    dictionary[key] = { ok: true, task, notes: '', calls: 0 };
    // The worker's first user message, on THIS flow's session (= the worker's session).
    Agent.setRootAgentPrompt(String(props.worker), {
        prompt: task,
        sessionID: flowContext.sessionId,
        requestID: Tools.generateUUID()
    });
    return { ok: true };
}
