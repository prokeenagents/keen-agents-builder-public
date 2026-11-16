import Agent from 'system/agent';

// The customer's message is filed only under the console agent's ID: copy it for the helpers.
export const exec = () => {
    dictionary.userMessage = String(Agent.getRootAgentPrompt('bike-support')?.prompt ?? '').trim().slice(0, 4000);
    dictionary.planRaw = '';
    dictionary.findings = '';
    return { ok: true };
};
