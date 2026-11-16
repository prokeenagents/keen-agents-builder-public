export const exec = () => {
    const word = String(dictionary.routeRaw ?? '').trim().toLowerCase().replace(/[^a-z]/g, '');
    dictionary.route = ['billing', 'technical'].includes(word) ? word : 'general';
    return { ok: true };
};
