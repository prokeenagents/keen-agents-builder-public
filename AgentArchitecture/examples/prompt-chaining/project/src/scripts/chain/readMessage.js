import Agent from 'system/agent';

export const exec = () => {
    dictionary.userMessage = Agent.getRootAgentPrompt('release-notes-agent')?.prompt ?? '';
    dictionary.changes = '';
    dictionary.outline = '';
    return { ok: true };
};
