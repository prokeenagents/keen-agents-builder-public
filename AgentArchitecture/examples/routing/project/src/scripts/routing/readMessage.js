import Agent from 'system/agent';

export const exec = () => {
    dictionary.userMessage = Agent.getRootAgentPrompt('help-desk-agent')?.prompt ?? '';
    dictionary.routeRaw = '';
    dictionary.route = '';
    return { ok: true };
};
