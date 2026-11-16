// The authenticated connection to the fictional ShopApi. Every call goes through here; the credentials stay in the closure.
import Http from 'system/http';
import { API_MESSAGE_MAX_CHARS, BASE_URL } from './settings.js';
import { cleanText, describeStatus, normaliseBaseUrl, parseJson, serviceError } from './utils.js';

/**
 * Build the authenticated ShopApi client. Only service.js calls it (inside its connect); the tool never imports this file.
 * credentials.apiKey        — the app's key (the agent's Secret SHOP_API_KEY), required for every call.
 * credentials.customerToken — the person's own shop sign-in (the site's cookie), required only for the cart.
 * options.baseUrl           — the Json Setting "shop_api_url"; the default is BASE_URL.
 */
export function createConnection(credentials, options = {}) {
    const apiKey = credentials?.apiKey;
    if (typeof apiKey !== 'string' || apiKey.trim() === '') throw serviceError('The shop is not set up on this agent (no API key).', false);
    const customerToken = typeof credentials.customerToken === 'string' && credentials.customerToken !== '' ? credentials.customerToken : null;

    const baseUrl = normaliseBaseUrl(options.baseUrl ?? BASE_URL);
    if (baseUrl === null) throw serviceError('The shop address on this agent is not a valid https:// URL (Json Setting shop_api_url).', false);

    const send = async (method, path, body, asCustomer) => {
        const headers = { 'x-api-key': apiKey, accept: 'application/json' };
        if (asCustomer) {
            if (customerToken === null) throw serviceError('The person is not signed in to the shop on this site. Ask them to sign in to the shop, then ask again.', false);
            headers.authorization = `Bearer ${customerToken}`;
        }
        const req = { url: baseUrl + path, method, headers };
        if (body !== undefined) {
            headers['content-type'] = 'application/json';
            req.body = JSON.stringify(body);
        }

        let res;
        try {
            res = await Http.request(req);
        } catch (err) {
            // timeout, DNS, refused address, network, too many redirects — the message never holds a header
            throw serviceError(`The shop could not be reached (${cleanText(err.message, API_MESSAGE_MAX_CHARS)}).`, true);
        }
        const parsed = parseJson(res.body);
        if (!res.ok) {
            const apiMessage = parsed && typeof parsed.message === 'string' ? cleanText(parsed.message, API_MESSAGE_MAX_CHARS) : '';
            throw serviceError(describeStatus(res.status, asCustomer, apiMessage), res.status === 429 || res.status >= 500);
        }
        if (parsed === null || typeof parsed !== 'object') throw serviceError('The shop sent an answer that is not JSON.', true);
        return parsed;
    };

    return Object.freeze({
        baseUrl,
        hasCustomer: customerToken !== null,
        get: path => send('GET', path, undefined, false),
        getAsCustomer: path => send('GET', path, undefined, true),
        putAsCustomer: (path, body) => send('PUT', path, body, true)
    });
}
