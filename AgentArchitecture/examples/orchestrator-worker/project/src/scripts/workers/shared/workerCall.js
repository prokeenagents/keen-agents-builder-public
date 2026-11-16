// Helpers of the worker flow tools and of the workers' own script tools.
// `toolOptions` always describes the IMMEDIATE caller of the tool that is running.
import Agent from 'system/agent';
import Tools from 'system/tools';

/** The bound of a worker's tool calls (its prompt says the same number). */
export const MAX_WORKER_TOOL_CALLS = 4;

/** The !*context of the current tool call: the raw text and its JSON value (null when not JSON). */
export function readContextJson() {
    const raw = String(toolOptions.toolContext.options?.context ?? '').trim();
    try { return { raw, value: JSON.parse(raw) }; } catch { return { raw, value: null }; }
}

/** File the tool's reply for the agent that called it, on that agent's session. */
export function replyToCaller(text) {
    Agent.setRootAgentPrompt(toolOptions.toolContext.agentId, {
        prompt: String(text),
        sessionID: toolOptions.agentNode.flowContext.sessionId,
        requestID: Tools.generateUUID()
    });
}

/**
 * The worker's working memory lives in the dictionary under ONE key: { ok, task, notes, calls }.
 * Append a finding to its notes and count the call, then reply briefly. The notes stay a STRING:
 * a list or an object placed into prompt text resolves to empty text.
 */
export function noteAndReply(key, finding, maxCalls) {
    const memory = dictionary[key];
    if (!memory || typeof memory.notes !== 'string') {
        replyToCaller(finding);                                   // called outside its worker: plain reply
        return;
    }
    const used = Number(memory.calls ?? 0);
    if (used >= maxCalls) {                                       // the bound: no more work, only the reminder
        replyToCaller('You have no tool calls left. Answer now from your notes.');
        return;
    }
    dictionary[key] = { ...memory, calls: used + 1, notes: `${memory.notes}- ${finding}\n` };
    replyToCaller(used + 1 >= maxCalls
        ? `Added to your notes: ${finding} That was your last tool call: answer now from your notes.`
        : `Added to your notes: ${finding}`);
}
