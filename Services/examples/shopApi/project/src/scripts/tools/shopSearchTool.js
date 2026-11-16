// Shop Search — the thin entry point: switch, input, Secret, connect through service.js, one instrument, one reply.
import Agent from 'system/agent';
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

    // 2. The input: !*context is JSON text from the model — parse and check it before anything else.
    let input;
    try {
        input = JSON.parse(call.options.context ?? '');
    } catch {
        input = null;
    }
    if (!input || typeof input.query !== 'string' || input.query.trim() === '') {
        reply({ ok: false, retryable: true, error: 'Shop Search input is invalid. Send !*context as JSON {"query": "<a few words>", "limit": 5}.' });
        return { ok: false };
    }

    // 3. The app's key: read here, in the tool, on every run.
    const apiKey = Secrets.get('SHOP_API_KEY');
    if (apiKey === undefined) {
        reply({ ok: false, retryable: false, error: `${shopName} is not set up on this agent (no SHOP_API_KEY). Tell the person.` });
        return { ok: false };
    }

    // 4. Connect through the service, call one instrument, reply. Every failure becomes a reply in words.
    try {
        const shop = ShopApiService.connect({ apiKey }, { baseUrl });
        const result = await shop.search({ query: input.query, limit: input.limit });
        Log.info(`Shop Search: ${result.products.length} of ${result.total} products`);
        reply({ ok: true, shop: shopName, ...result });
        return { ok: true };
    } catch (err) {
        Log.warning(`Shop Search failed: ${err.message}`);
        reply({ ok: false, retryable: err.retryable === true, error: err.message });
        return { ok: false };
    }
};
