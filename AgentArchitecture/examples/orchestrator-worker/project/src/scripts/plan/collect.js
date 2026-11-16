// After Parallel Context every element carries its worker's `result` (the merge).
// A prompt cannot read a list: join the results into ONE text, then drop the list.
export const exec = () => {
    const items = Array.isArray(dictionary.tasks) ? dictionary.tasks : [];
    dictionary.findings = items
        .map((t, i) => `${i + 1}. [${t.kind}] ${t.task}\n${String(t.result ?? '').trim() || '(no answer)'}`)
        .join('\n\n');
    delete dictionary.tasks;
    return { ok: true };
};
