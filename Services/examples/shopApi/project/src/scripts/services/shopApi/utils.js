// Pure helpers of the ShopApi service: no system/* import, no state.

/** The one way this service fails: a message the model can act on, and whether a corrected or later call may help. */
export function serviceError(message, retryable) {
    const err = new Error(message);
    err.retryable = retryable === true;
    return err;
}

/** An HTTP status from the shop, in words. `asCustomer` = the call carried the person's own sign-in. */
export function describeStatus(status, asCustomer, apiMessage) {
    const detail = apiMessage ? ` The shop said: ${apiMessage}` : '';
    if (status === 401 && asCustomer) return 'The person is not signed in to the shop any more (401). Ask them to sign in to the shop on this site, then ask again.';
    if (status === 401 || status === 403) return `The shop refused the agent's API key (${status}). Tell the person the shop is not set up correctly (SHOP_API_KEY).`;
    if (status === 404) return `The shop does not know this product (404).${detail}`;
    if (status === 409 || status === 422) return `The shop refused the change (${status}).${detail}`;
    if (status === 429) return 'The shop is busy (429). Tell the person to try again in a minute.';
    if (status >= 500) return `The shop is unavailable (${status}). Tell the person to try again later.`;
    return `The shop answered ${status}.${detail}`;
}

/** An https:// address without a trailing slash, or null. */
export function normaliseBaseUrl(value) {
    if (typeof value !== 'string') return null;
    const url = value.trim().replace(/\/+$/, '');
    return /^https:\/\/[^\s/]+(\/\S*)?$/.test(url) ? url : null;
}

/** A whole number between min and max, or the fallback when the value is not a number. */
export function clampInt(value, min, max, fallback) {
    const n = Number(value);
    if (value === null || value === undefined || value === '' || !Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, Math.trunc(n)));
}

/** Text on one line, trimmed, at most maxChars characters. */
export function cleanText(value, maxChars) {
    return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, maxChars);
}

/** A SKU as the shop writes it (letters, digits, dashes, at most 40), or '' when the value is not one. */
export function toSku(value) {
    const sku = cleanText(value, 41);
    return /^[A-Za-z0-9-]{1,40}$/.test(sku) ? sku : '';
}

/** A JSON text parsed, or null when it is empty or not JSON. */
export function parseJson(text) {
    if (typeof text !== 'string' || text.trim() === '') return null;
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

/** A price object { amount, currency } from the shop, as plain fields; null when absent. */
export function toPrice(price) {
    if (price === null || typeof price !== 'object') return null;
    const amount = Number(price.amount);
    if (!Number.isFinite(amount)) return null;
    return { amount, currency: cleanText(price.currency, 3).toUpperCase() };
}
