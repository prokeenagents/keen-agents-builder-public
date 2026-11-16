// Shop Add To Cart — sets how many of one product are in the person's cart. Safe to run twice; one write, last.
import Agent from 'system/agent';
import Cookies from 'system/cookies';
import Log from 'system/log';
import Secrets from 'system/secrets';
import Settings from 'system/settings';
import Tools from 'system/tools';
import * as ShopApiService from '../services/shopApi/service.js';

export const exec = async () => {
    const call = toolOptions.toolContext;
    const reply = data =>
        Agent.setRootAgentPrompt(call.agentId, {
            prompt: JSON.stringify(data),
            sessionID: toolOptions.agentNode.flowContext.sessionId,
            requestID: Tools.generateUUID()
        });

    // 1. The switch first: the agent's Json Settings say whether the shop is on, its name and (optionally) its address.
    const [available, title, baseUrl] = Settings.getMany('shop_available', 'shop_title', 'shop_api_url');
    const shopName = typeof title === 'string' && title.trim() !== '' ? title.trim() : ShopApiService.DEFAULT_TITLE;
    if (available !== true) {
        reply({ ok: false, retryable: false, error: `${shopName} is not available on this agent. Tell the person it cannot be used right now.` });
        return { ok: false };
    }

    // 2. The input: {"sku", "quantity"} from the model; the service checks the values again.
    let input;
    try {
        input = JSON.parse(call.options.context ?? '');
    } catch {
        input = null;
    }
    if (!input || typeof input.sku !== 'string' || input.quantity === undefined) {
        reply({ ok: false, retryable: true, error: 'Shop Add To Cart input is invalid. Send !*context as JSON {"sku": "<sku from Shop Search>", "quantity": <1-20>}.' });
        return { ok: false };
    }

    // 3. The app's key: read here, in the tool, on every run.
    const apiKey = Secrets.get('SHOP_API_KEY');
    if (apiKey === undefined) {
        reply({ ok: false, retryable: false, error: `${shopName} is not set up on this agent (no SHOP_API_KEY). Tell the person.` });
        return { ok: false };
    }

    // The person's own shop sign-in from the site's cookie. NOT masked like a Secret: use it only in the request.
    const customerToken = Cookies.get(ShopApiService.CUSTOMER_COOKIE);
    if (!customerToken) {
        reply({ ok: false, retryable: false, error: `The person is not signed in to ${shopName} on this site. Ask them to sign in to the shop, then ask again.` });
        return { ok: false };
    }

    // 4. One write — the whole change in one request, the last step. The shop decides from the person's sign-in what they may change.
    try {
        const shop = ShopApiService.connect({ apiKey, customerToken }, { baseUrl });
        const cart = await shop.setCartItem({ sku: input.sku, quantity: input.quantity });
        Log.info(`Shop Add To Cart: the cart now has ${cart.lines.length} lines`);
        reply({ ok: true, shop: shopName, ...cart });
        return { ok: true };
    } catch (err) {
        Log.warning(`Shop Add To Cart failed: ${err.message}`);
        reply({ ok: false, retryable: err.retryable === true, error: err.message });
        return { ok: false };
    }
};
