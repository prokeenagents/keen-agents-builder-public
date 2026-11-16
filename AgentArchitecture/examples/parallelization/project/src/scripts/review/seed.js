import Agent from 'system/agent';
import Session from 'system/session';

const MAX_CHARS = 6000;

// The listing the seller sent. Into the SESSION for the Parallel Flows branches (each branch starts
// with an empty dictionary), and into the DICTIONARY for the vote list (an LLM inside a Parallel
// Context run reads ${session.…} as empty, so the listing travels inside each element).
export const exec = () => {
    const listing = String(Agent.getRootAgentPrompt('listing-reviewer')?.prompt ?? '').trim().slice(0, MAX_CHARS);
    Session.setSessionValue('listing', listing);
    dictionary.listing = listing;
    dictionary.reviews = '';
    dictionary.report = '';
    return { ok: true };
};
