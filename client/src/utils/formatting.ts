/**
 * Shared number formatting utilities used across the dashboard.
 */

/** Format a number as a dollar amount, e.g. 1234.5 → "$1234.50" */
export const fmtDollar = (v: number): string => `$${v.toFixed(2)}`;

/**
 * Format a number as a percentage.
 * @param v        The value (e.g. 12.5 for 12.5%)
 * @param signed   If true, prepend "+" for non-negative values (default false)
 */
export const fmtPct = (v: number, signed = false): string =>
    `${signed && v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

/** Format a plain decimal, e.g. 0.42 → "0.42" */
export const fmt = (v: number): string => v.toFixed(2);
