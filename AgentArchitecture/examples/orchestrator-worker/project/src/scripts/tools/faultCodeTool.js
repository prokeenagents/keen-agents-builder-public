// A script tool of the technician: what a display fault code means.
// It APPENDS its finding to dictionary.technician.notes, which the worker's system prompt shows on its next run.
import { readContextJson, replyToCaller, noteAndReply, MAX_WORKER_TOOL_CALLS } from '../workers/shared/workerCall.js';
import * as WorkshopService from '../services/workshop/service.js';

export async function exec() {
    try {
        const { raw, value } = readContextJson();
        const code = typeof value?.code === 'string' ? value.code.trim().toUpperCase() : '';
        if (!code) {
            replyToCaller('Fault Code Lookup input invalid. Send !*context as JSON {"code": "E07"}. You sent: ' + (raw || '(empty)'));
            return { ok: false };
        }
        const found = WorkshopService.connect().faultCode(code);
        noteAndReply('technician', found
            ? `Fault code ${code}: ${found}.`
            : `Fault code ${code} is not a Brightway code.`, MAX_WORKER_TOOL_CALLS);
        return { ok: true };
    } catch (err) {
        replyToCaller(`Fault Code Lookup failed: ${err.message}`);
        return { ok: false };
    }
}
