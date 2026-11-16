import Agent from 'system/agent';
import Session from 'system/session';
import Tools from 'system/tools';
import { REVIEW_CHANNEL } from './settings.js';

// First node of every review branch. Key/Value Pair: reviewer (the agentId of the branch's LLM).
// The prompt is filed on the review channel, so the reviewer's answer lands on the SAME channel,
// where the Script after Parallel Flows collects all three.
export const exec = (props) => {
    const listing = String(Session.getSessionValue('listing') ?? '');
    if (!listing) throw new Error('no listing in the session');
    Agent.setRootAgentPrompt(String(props.reviewer), {
        prompt: listing,
        sessionID: flowContext.sessionId,                      // the branch's session = its LLM node's session
        requestID: Tools.generateUUID(),
        channel: REVIEW_CHANNEL
    });
    return { ok: true };
};
