// The fictional Brightway workshop service: the ONLY service file a tool imports.
// WorkshopService.connect(credentials, options) assembles the connection with connector.js and returns
// the instruments bound to it — one function per action the workers may take.
import { createConnection } from './connector.js';
import { monthsSince } from './utils.js';

/** What a display fault code means, or null. */
function faultCode(connection, code) {
    return connection.get('faultCodes', code);
}

/** { healthPercent, cycles, purchased } of a battery, or null. */
function battery(connection, serial) {
    return connection.get('batteries', serial);
}

/** { items, purchased, monthsSincePurchase } of an order, or null. */
function order(connection, orderNumber) {
    const found = connection.get('orders', orderNumber);
    return found ? { ...found, monthsSincePurchase: monthsSince(found.purchased) } : null;
}

/** Assemble the connection with connector.js and return the instruments bound to it. */
export function connect(credentials = {}, options = {}) {
    const connection = createConnection(credentials, options);
    return {
        faultCode: code => faultCode(connection, code),
        battery: serial => battery(connection, serial),
        order: orderNumber => order(connection, orderNumber)
    };
}
