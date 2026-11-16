export const exec = () => {
    delete dictionary.userMessage;
    delete dictionary.routeRaw;
    delete dictionary.route;
    return { ok: true };
};
