// A script tool of the warranty desk: an order by its number.
// It APPENDS its finding to dictionary.warranty.notes, which the worker's system prompt shows on its next run.
import { readContextJson, replyToCaller, noteAndReply, MAX_WORKER_TOOL_CALLS } from '../workers/shared/workerCall.js';
import * as WorkshopService from '../services/workshop/service.js';

export async function exec() {
    try {
        const { raw, value } = readContextJson();
        const orderNumber = typeof value?.orderNumber === 'string' ? value.orderNumber.trim().toUpperCase() : '';
        if (!orderNumber) {
            replyToCaller('Order Lookup input invalid. Send !*context as JSON {"orderNumber": "BW-50017"}. You sent: ' + (raw || '(empty)'));
            return { ok: false };
        }
        const found = WorkshopService.connect().order(orderNumber);
        noteAndReply('warranty', found
            ? `Order ${orderNumber}: ${found.items}, purchased ${found.purchased} (${found.monthsSincePurchase} months ago).`
            : `Order ${orderNumber} does not exist.`, MAX_WORKER_TOOL_CALLS);
        return { ok: true };
    } catch (err) {
        replyToCaller(`Order Lookup failed: ${err.message}`);
        return { ok: false };
    }
}
