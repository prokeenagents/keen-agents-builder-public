// Small pure helpers of the workshop service.
import { MONTH_MS } from './settings.js';

/** Whole months between an ISO date and now. */
export function monthsSince(isoDate) {
    return Math.floor((Date.now() - Date.parse(isoDate)) / MONTH_MS);
}
