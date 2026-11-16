export const exec = () => {
    const lines = String(dictionary.changes ?? '')
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.startsWith('- ') && line.length > 2)
        .slice(0, 30);
    dictionary.changes = lines.join('\n');
    dictionary.changeCount = lines.length;
    dictionary.changesOk = lines.length > 0;
    return { ok: true };
};
