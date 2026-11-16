// The orchestrator's JSON plan -> one list element per sub-task for Parallel Context.
// Each element becomes a Worker run's WHOLE dictionary, so it carries everything the worker's
// prompt reads (an LLM inside a Parallel Context run reads ${session.…} as empty).
const KINDS = ['technical', 'warranty', 'parts'];
const MAX_TASKS = 4;

export const exec = () => {
    const raw = String(dictionary.planRaw ?? '');
    dictionary.planRaw = '';                                     // a failed call next time must not reuse it
    let plan = {};
    try { plan = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)); } catch { plan = {}; }
    const items = Array.isArray(plan.tasks) ? plan.tasks : [];
    dictionary.tasks = items
        .map(t => ({ kind: String(t?.kind ?? '').trim().toLowerCase(), task: String(t?.task ?? '').trim().slice(0, 500) }))
        .filter(t => KINDS.includes(t.kind) && t.task)
        .slice(0, MAX_TASKS)
        .map(t => ({ ...t, question: dictionary.userMessage }));
    return { ok: true };                                         // an empty list: Parallel Context skips, the synthesizer answers alone
};
