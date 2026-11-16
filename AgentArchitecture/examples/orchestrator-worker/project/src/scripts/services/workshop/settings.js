// Constants of the fictional Brightway workshop service. Never a secret.
export const MONTH_MS = 30.44 * 24 * 60 * 60 * 1000;

export const FAULT_CODES = {
    E01: 'the motor sensor is not connected; check the plug at the rear hub',
    E07: 'the battery cells are out of balance; check Battery Health and replace the battery below 60 % health',
    E12: 'the display lost contact; hold the power and minus buttons for 10 seconds to reset it'
};

export const BATTERIES = {
    'BV-1001': { healthPercent: 54, cycles: 610, purchased: '2025-03-14' },
    'BV-2002': { healthPercent: 91, cycles: 120, purchased: '2026-01-20' }
};

export const ORDERS = {
    'BW-50017': { items: 'Brightway Volt e-bike with Volt battery BV-1001', purchased: '2025-03-14' },
    'BW-50342': { items: 'Volt battery BV-2002', purchased: '2026-01-20' }
};
