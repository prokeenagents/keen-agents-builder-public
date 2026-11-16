export const exec = () => {
    const raw = String(dictionary.verdictRaw ?? '');
    dictionary.verdictRaw = '';
    let verdict = {};
    try { verdict = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)); } catch { verdict = {}; }
    const score = Number.isFinite(Number(verdict.score)) ? Number(verdict.score) : 0;
    dictionary.attempts = Number(dictionary.attempts ?? 0) + 1;
    if (score > Number(dictionary.bestScore ?? 0) || !dictionary.bestDraft) {
        dictionary.bestScore = Math.max(score, Number(dictionary.bestScore ?? 0));
        dictionary.bestDraft = String(dictionary.draft ?? '');
    }
    dictionary.passed = score >= 8;
    dictionary.feedback = typeof verdict.feedback === 'string' && verdict.feedback.trim()
        ? verdict.feedback.trim()
        : 'Keep it under 60 words and use only the product facts.';
    return { ok: true };
};
