import Agent from 'system/agent';

export const exec = () => {
    dictionary.userMessage = Agent.getRootAgentPrompt('blurb-agent')?.prompt ?? '';
    dictionary.attempts = 0;
    dictionary.passed = false;
    dictionary.draft = '';
    dictionary.verdictRaw = '';
    dictionary.feedback = 'none yet (first draft)';
    dictionary.bestDraft = '';
    dictionary.bestScore = 0;
    return { ok: true };
};
