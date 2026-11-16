import Agent from 'system/agent';
import { REVIEW_CHANNEL, REVIEWERS } from './settings.js';

// After Parallel Flows every branch has finished. Read AND delete the reviewers' answers on the
// channel, then delete the channel's trigger prompts too. A prompt cannot read a list: build ONE text.
export const exec = () => {
    const answers = Agent.consumeChannelResponses(REVIEW_CHANNEL);   // newest first
    Agent.deleteChannel(REVIEW_CHANNEL);
    dictionary.reviews = Object.entries(REVIEWERS)
        .map(([agentId, heading]) => {
            const answer = answers.find(a => a.agentID === agentId);
            return `${heading}:\n${String(answer?.response ?? '').trim() || '(no answer)'}`;
        })
        .join('\n\n');
    return { ok: true };
};
