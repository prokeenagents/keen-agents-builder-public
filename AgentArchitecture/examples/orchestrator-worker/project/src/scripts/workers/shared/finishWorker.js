// Last node of a worker flow tool: hands the worker's final answer to the orchestrator and
// deletes the worker's working memory. Key/Value Pairs: key, worker, tool.
import Agent from 'system/agent';
import { replyToCaller } from './workerCall.js';

export async function exec(props) {
    const answer = (Agent.getAgentLastResponseBySessionId(String(props.worker), flowContext.sessionId)?.response ?? '').trim();
    delete dictionary[String(props.key)];
    replyToCaller(answer
        ? `${props.tool} result:\n${answer}`
        : `${props.tool} found nothing. Tell the customer a colleague will follow up.`);
    return { ok: Boolean(answer) };
}
