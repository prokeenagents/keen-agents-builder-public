// After Parallel Context every element carries its run's `vote` (the merge). Count the votes,
// combine them with the reviews into ONE text for the answering node, drop the list.
export const exec = () => {
    const votes = (Array.isArray(dictionary.votes) ? dictionary.votes : []).map(v => String(v.vote ?? '').trim().toLowerCase());
    const publish = votes.filter(v => v.startsWith('publish')).length;
    const hold = votes.filter(v => v.startsWith('hold')).length;
    dictionary.verdict = publish > hold ? 'publish' : 'hold';     // a tie or no votes: hold
    dictionary.report = `${dictionary.reviews || '(the reviews did not run)'}\n\n` +
        `Vote: ${publish} publish, ${hold} hold, ${votes.length - publish - hold} without an answer. Verdict: ${dictionary.verdict}.`;
    delete dictionary.votes;
    return { ok: true };
};
