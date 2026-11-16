// The connection to the fictional Brightway workshop system. The workshop is fictional, so the
// connection reads the constants in settings.js and needs no credentials; a real connector builds an
// authenticated system/http client here from the credentials the tool passes in.
import { FAULT_CODES, BATTERIES, ORDERS } from './settings.js';

const TABLES = { faultCodes: FAULT_CODES, batteries: BATTERIES, orders: ORDERS };

/** Returns the connection: get(table, id) → the record, or null when there is none. */
export function createConnection(credentials = {}, options = {}) {
    return {
        get(table, id) {
            const rows = TABLES[table];
            if (!rows) throw new Error(`The workshop has no table "${table}".`);
            return rows[id] ?? null;
        }
    };
}
