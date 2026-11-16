// The ShopApi service: connect() assembles the connection (through connector.js) and returns the instruments —
// one method per action the model may take. The tools import ONLY this file.
import { createConnection } from './connector.js';
import { CART_ITEMS_PATH, CART_PATH, CUSTOMER_COOKIE as COOKIE_NAME, DEFAULT_LIMIT, DEFAULT_TITLE as TITLE, MAX_LIMIT, MAX_QUANTITY, NAME_MAX_CHARS, PRODUCTS_PATH, QUERY_MAX_CHARS } from './settings.js';
import { clampInt, cleanText, serviceError, toPrice, toSku } from './utils.js';

/** The cookie that carries the person's shop sign-in, and the name replies use when Json Settings give none. */
export const CUSTOMER_COOKIE = COOKIE_NAME;
export const DEFAULT_TITLE = TITLE;

/**
 * Connect and get the instruments.
 * credentials: { apiKey } (the Secret SHOP_API_KEY) — plus { customerToken } (the cookie) for the cart instruments.
 * options:     { baseUrl } (the Json Setting shop_api_url, optional).
 */
export function connect(credentials, options = {}) {
    const connection = createConnection(credentials, options);
    return Object.freeze({
        search: args => searchProducts(connection, args),
        getCart: () => getCart(connection),
        setCartItem: args => setCartItem(connection, args)
    });
}

/** Search the catalogue (the app's key only). Returns at most MAX_LIMIT short product lines. */
async function searchProducts(connection, { query, limit } = {}) {
    const text = cleanText(query, QUERY_MAX_CHARS);
    if (text === '') throw serviceError('The search text is empty. Send {"query": "<a few words>"}.', true);
    const n = clampInt(limit, 1, MAX_LIMIT, DEFAULT_LIMIT);

    const answer = await connection.get(`${PRODUCTS_PATH}?q=${encodeURIComponent(text)}&limit=${n}`);
    const items = Array.isArray(answer.items) ? answer.items.slice(0, n) : [];
    return {
        total: Number(answer.total) || items.length,
        products: items.map(item => ({
            sku: toSku(item.sku),
            name: cleanText(item.name, NAME_MAX_CHARS),
            price: toPrice(item.price),
            inStock: item.inStock === true
        }))
    };
}

/** The person's own cart (their sign-in decides whose cart it is). */
async function getCart(connection) {
    return toCartView(await connection.getAsCustomer(CART_PATH));
}

/**
 * Set how many of one product are in the person's cart. A "set", not an "add one": the same call twice leaves the
 * same cart, so a re-sent node changes nothing. One request, the last step of the tool.
 */
async function setCartItem(connection, { sku, quantity } = {}) {
    const id = toSku(sku);
    const n = clampInt(quantity, 1, MAX_QUANTITY, 0);
    if (id === '' || n === 0) throw serviceError(`Send {"sku": "<sku from Shop Search>", "quantity": <1-${MAX_QUANTITY}>}.`, true);

    return toCartView(await connection.putAsCustomer(`${CART_ITEMS_PATH}/${encodeURIComponent(id)}`, { quantity: n }));
}

/** The few cart fields the model needs. */
function toCartView(cart) {
    const lines = Array.isArray(cart.lines) ? cart.lines : [];
    return {
        lines: lines.map(line => ({
            sku: toSku(line.sku),
            name: cleanText(line.name, NAME_MAX_CHARS),
            quantity: clampInt(line.quantity, 0, 1000, 0),
            price: toPrice(line.price)
        })),
        total: toPrice(cart.total)
    };
}
