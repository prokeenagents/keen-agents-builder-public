import Agent from 'system/agent';
import { REVIEW_CHANNEL } from './settings.js';

// The Fallback of a reviewer. Key/Value Pair: reviewer. A failed call still stores the provider's
// error text as the reviewer's answer, on the trigger's channel: delete it, so the collector shows
// "(no answer)" instead of an error message.
export const exec = (props) => {
    Agent.deleteAgentResponse(String(props.reviewer), { channel: REVIEW_CHANNEL, sessionID: flowContext.sessionId });
    return { ok: true };
};
