// A script tool of the technician: a battery's health by its serial number.
// It APPENDS its finding to dictionary.technician.notes, which the worker's system prompt shows on its next run.
import { readContextJson, replyToCaller, noteAndReply, MAX_WORKER_TOOL_CALLS } from '../workers/shared/workerCall.js';
import * as WorkshopService from '../services/workshop/service.js';

export async function exec() {
    try {
        const { raw, value } = readContextJson();
        const serial = typeof value?.serial === 'string' ? value.serial.trim().toUpperCase() : '';
        if (!serial) {
            replyToCaller('Battery Health input invalid. Send !*context as JSON {"serial": "BV-1001"}. You sent: ' + (raw || '(empty)'));
            return { ok: false };
        }
        const found = WorkshopService.connect().battery(serial);
        noteAndReply('technician', found
            ? `Battery ${serial}: health ${found.healthPercent} % after ${found.cycles} charge cycles, purchased ${found.purchased}.`
            : `Battery ${serial} is not in the workshop records.`, MAX_WORKER_TOOL_CALLS);
        return { ok: true };
    } catch (err) {
        replyToCaller(`Battery Health failed: ${err.message}`);
        return { ok: false };
    }
}
