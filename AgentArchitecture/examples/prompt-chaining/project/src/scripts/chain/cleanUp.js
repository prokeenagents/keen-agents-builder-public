export const exec = () => {
    for (const key of ['userMessage', 'changes', 'changeCount', 'changesOk', 'outline']) {
        delete dictionary[key];
    }
    return { ok: true };
};
