export const exec = () => {
    for (const key of ['userMessage', 'attempts', 'passed', 'draft', 'verdictRaw', 'feedback', 'bestDraft', 'bestScore']) {
        delete dictionary[key];
    }
    return { ok: true };
};
