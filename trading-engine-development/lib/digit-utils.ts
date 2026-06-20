/**
 * Centralized utility for robust digit extraction and precision handling
 * across all Deriv trading markets.
 */

/**
 * Extracts the last digit of a price using truncation logic.
 * Truncation is essential for digit-based trading strategies to avoid rounding errors.
 *
 * @param price The market price/quote
 * @param pipSize The number of decimal places (e.g., 2 for Volatility 100, 3 for Volatility 10s)
 * @returns The last digit (0-9)
 */
export function extractLastDigit(price: number, pipSize: number): number {
    if (price === undefined || price === null || isNaN(price)) return 0;

    // Ensure pipSize is a valid integer count of decimals
    // If pipSize is a fractional pip (e.g., 0.01), convert it to decimal count
    const cleanPipSize = pipSize < 1 && pipSize > 0 ? calculateDecimalCount(pipSize) : Math.floor(pipSize);

    const multiplier = Math.pow(10, cleanPipSize);
    // Use a small epsilon to handle floating point precision issues during multiplication
    const truncated = Math.floor(price * multiplier + 0.00000001);
    return Math.abs(truncated % 10);
}

/**
 * Converts a pip value (e.g., 0.01, 1e-3) to a decimal digit count.
 *
 * @param pip The pip value from Deriv API (can be fractional like 0.01 or integer like 2)
 * @returns The number of decimal places
 */
export function calculateDecimalCount(pip: number): number {
    if (pip === undefined || pip === null || isNaN(pip)) return 2; // Default fallback

    // If it's already a small integer (0-10), it's likely already the count
    if (Number.isInteger(pip) && pip >= 0 && pip <= 10) return pip;

    const s = String(pip);
    if (s.includes('.')) return s.split('.')[1].length;
    if (s.includes('e-')) return Number.parseInt(s.split('e-')[1], 10);

    // If it's something like 0.001 but represented as a float
    if (pip > 0 && pip < 1) {
        return Math.abs(Math.floor(Math.log10(pip + 1e-10))); // Use epsilon
    }

    return 2; // Default fallback for safety
}

/**
 * Formats a price with correct decimal places for display.
 */
export function formatPrice(price: number, pipSize: number): string {
    const decimals = pipSize < 1 && pipSize > 0 ? calculateDecimalCount(pipSize) : Math.floor(pipSize);
    return price.toFixed(decimals);
}
