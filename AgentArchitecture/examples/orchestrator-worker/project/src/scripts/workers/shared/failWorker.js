// Every error / Fallback path of a worker flow tool ends here, so the orchestrator always gets a reply.
// Key/Value Pairs: key, tool.
import { replyToCaller } from './workerCall.js';

export async function exec(props) {
    delete dictionary[String(props.key)];
    replyToCaller(`${props.tool} failed and has no result. Do not ask it again for this message; answer with what you have.`);
    return { ok: false };
}
