/**
 * Signal Generator - Entry Point & Stop Loss Calculator
 */

export interface TradeSignal {
    type: 'ENTRY' | 'STOP_LOSS' | 'NEUTRAL';
    recommendation: string;
    strength: number; // 0-100
    entryTick?: number;
    stopTick?: number;
    reason: string;
    suggestedAction?: string;
}

export class SignalGenerator {
    /**
     * Determine entry signal based on market power and trend
     */
    static calculateEntryPoint(
        dominantDigit: number,
        marketPower: number,
        trendingUp: boolean,
        lastTicks: number[]
    ): TradeSignal {
        if (marketPower < 55) {
            return {
                type: 'NEUTRAL',
                recommendation: 'WAIT',
                strength: 0,
                reason: 'Market power below 55% threshold',
            };
        }

        if (marketPower >= 60 && trendingUp) {
            return {
                type: 'ENTRY',
                recommendation: `ENTER on digit ${dominantDigit}`,
                strength: Math.min(100, marketPower + 10),
                entryTick: dominantDigit,
                reason: `Strong signal: ${marketPower.toFixed(1)}% power with positive trend`,
                suggestedAction: `Wait for digit ${dominantDigit} to appear, then execute trade`,
            };
        }

        if (marketPower >= 55 && trendingUp) {
            return {
                type: 'ENTRY',
                recommendation: `CONDITIONAL ENTRY on digit ${dominantDigit}`,
                strength: Math.min(100, marketPower),
                entryTick: dominantDigit,
                reason: `Moderate signal: ${marketPower.toFixed(1)}% power with trend confirmation`,
                suggestedAction: `Enter only if digit ${dominantDigit} appears 2+ times consecutively`,
            };
        }

        return {
            type: 'NEUTRAL',
            recommendation: 'WAIT',
            strength: marketPower,
            reason: 'Insufficient confirmation for entry',
        };
    }

    /**
     * Calculate stop loss based on pattern analysis
     */
    static calculateStopLoss(
        entryDigit: number,
        marketPower: number,
        lastTicks: number[],
        patternWindow: number = 10
    ): { digit: number; reason: string; priority: 'HIGH' | 'MEDIUM' | 'LOW' } {
        // Analyze last X ticks for pattern breaks
        const recentWindow = lastTicks.slice(-patternWindow);

        // Find most common opposite digit
        const digitFrequency: Record<number, number> = {};
        for (const tick of recentWindow) {
            const digit = tick % 10;
            if (digit !== entryDigit) {
                digitFrequency[digit] = (digitFrequency[digit] || 0) + 1;
            }
        }

        const sortedOpposites = Object.entries(digitFrequency)
            .sort(([, a], [, b]) => b - a)
            .map(([d]) => Number(d));

        let stopLossDigit = sortedOpposites[0] || (entryDigit === 9 ? 0 : entryDigit + 1);
        let priority: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';

        // High priority if market power is < 60%
        if (marketPower < 60) {
            priority = 'HIGH';
        }

        // Medium-low if power is strong
        if (marketPower >= 70) {
            priority = 'LOW';
        }

        return {
            digit: stopLossDigit,
            reason: `If digit ${stopLossDigit} appears, exit trade`,
            priority,
        };
    }

    /**
     * Generate tick skip recommendation
     * Helps avoid false entries by skipping certain ticks
     */
    static recommendTickSkip(
        entryDigit: number,
        lastTicks: number[],
        maxRecommendedSkips: number = 5
    ): { skip: number; reason: string } {
        if (lastTicks.length < 10) {
            return { skip: 0, reason: 'Insufficient data for skip recommendation' };
        }

        // Count how many ticks it takes for entry digit to appear
        const recent = lastTicks.slice(-10);
        let ticksUntilEntry = 0;

        for (let i = recent.length - 1; i >= 0; i--) {
            if (recent[i] % 10 === entryDigit) {
                ticksUntilEntry = i + 1;
                break;
            }
        }

        // If entry digit appears within first 2 ticks, suggest waiting
        if (ticksUntilEntry <= 2 && recent[recent.length - 1] % 10 !== entryDigit) {
            return {
                skip: 1,
                reason: 'Entry digit appeared recently, wait 1-2 ticks for pattern refresh',
            };
        }

        return { skip: 0, reason: 'No skip recommended, entry digit ready' };
    }

    /**
     * Calculate confidence score for a trade
     */
    static calculateConfidence(
        marketPower: number,
        deviation: number,
        trendAlignment: boolean,
        historicalAccuracy: number = 55 // Base accuracy from 500-tick analysis
    ): number {
        let confidence = historicalAccuracy;

        // Add power component
        if (marketPower >= 60) {
            confidence += 15;
        } else if (marketPower >= 55) {
            confidence += 8;
        }

        // Add deviation component
        if (deviation >= 10) {
            confidence += 10;
        } else if (deviation >= 7) {
            confidence += 5;
        }

        // Add trend component
        if (trendAlignment) {
            confidence += 5;
        }

        return Math.min(100, confidence);
    }

    /**
     * Determine if market is in a "safe" zone (high probability)
     */
    static detectSafeZone(
        overPower: number,
        underPower: number,
        volatility: number,
        trending: boolean
    ): { safe: boolean; zone: string; reason: string } {
        const maxPower = Math.max(overPower, underPower);
        const minPower = Math.min(overPower, underPower);
        const powerDiff = maxPower - minPower;

        if (maxPower >= 65 && powerDiff >= 20 && volatility < 5 && trending) {
            return {
                safe: true,
                zone: 'VERY_SAFE',
                reason: `Dominant market (${maxPower.toFixed(1)}%), clear direction, low volatility`,
            };
        }

        if (maxPower >= 58 && powerDiff >= 10 && volatility < 8 && trending) {
            return {
                safe: true,
                zone: 'SAFE',
                reason: `Strong market (${maxPower.toFixed(1)}%), clear trend, moderate volatility`,
            };
        }

        if (maxPower >= 55 && powerDiff >= 5 && !trending) {
            return {
                safe: false,
                zone: 'CAUTION',
                reason: `Weak signal (${maxPower.toFixed(1)}%), no clear trend - wait for confirmation`,
            };
        }

        return {
            safe: false,
            zone: 'BAD',
            reason: `Market too volatile or balanced - avoid trading`,
        };
    }

    /**
     * Generate overall market assessment
     */
    static assessMarket(
        ticks: number[],
        last15Ticks: number[],
        last500Ticks: number[]
    ): {
        assessment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'VOLATILE';
        score: number;
        recommendation: string;
    } {
        if (ticks.length < 20) {
            return { assessment: 'NEUTRAL', score: 50, recommendation: 'Insufficient data' };
        }

        // Compare recent vs historical
        const recentOvers = last15Ticks.filter(t => t % 10 >= 5).length;
        const historicalOvers = last500Ticks.filter(t => t % 10 >= 5).length;

        const recentRatio = recentOvers / last15Ticks.length;
        const historicalRatio = historicalOvers / last500Ticks.length;

        const shift = recentRatio - historicalRatio;

        let assessment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'VOLATILE';
        let score = 50;

        if (shift > 0.15) {
            assessment = 'BULLISH';
            score = 70 + shift * 100; // Scale shift to 0-30
        } else if (shift < -0.15) {
            assessment = 'BEARISH';
            score = 30 - Math.abs(shift) * 100;
        } else if (Math.abs(shift) < 0.05) {
            assessment = 'NEUTRAL';
            score = 50;
        } else {
            assessment = 'VOLATILE';
            score = 45;
        }

        const rec =
            assessment === 'BULLISH'
                ? 'Markets favor OVER - Good entry conditions'
                : assessment === 'BEARISH'
                  ? 'Markets favor UNDER - Good entry conditions'
                  : assessment === 'NEUTRAL'
                    ? 'No clear direction - Use other indicators'
                    : 'High volatility - Use smaller stakes';

        return { assessment, score: Math.min(100, Math.max(0, score)), recommendation: rec };
    }
}
