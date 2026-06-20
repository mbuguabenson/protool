/**
 * NeuralPatternEngine handles deep digit pattern recognition and market behavior analysis.
 */

export interface PatternMatch {
    sequence: number[];
    count: number;
    probability: number;
    lastSeen: number;
}

export interface MarketStabilityData {
    index: number; // 0-100 (100 is perfectly stable/predictable)
    volatility: number;
    trend: 'stable' | 'volatile' | 'erratic';
    favoredContract: string;
    unstableContract: string;
    reasoning: string;
}

export class NeuralPatternEngine {
    private static MAX_SEQUENCE_LENGTH = 3;
    private static MIN_SEQUENCE_RECURRENCE = 2;

    /**
     * Identifies recurring digit sequences in the provided history.
     */
    public static detectPatterns(digits: number[]): PatternMatch[] {
        if (digits.length < 10) return [];

        const patterns: Map<string, number> = new Map();
        const lastSeen: Map<string, number> = new Map();

        // Slide window for sequences of length 2 and 3
        for (let len = 2; len <= this.MAX_SEQUENCE_LENGTH; len++) {
            for (let i = 0; i <= digits.length - len; i++) {
                const sequence = digits.slice(i, i + len);
                const key = sequence.join(',');

                patterns.set(key, (patterns.get(key) || 0) + 1);
                lastSeen.set(key, i + len);
            }
        }

        return Array.from(patterns.entries())
            .filter(([_, count]) => count >= this.MIN_SEQUENCE_RECURRENCE)
            .map(([key, count]) => {
                const sequence = key.split(',').map(Number);
                return {
                    sequence,
                    count,
                    probability: (count / (digits.length / sequence.length)) * 100,
                    lastSeen: lastSeen.get(key) || 0,
                };
            })
            .sort((a, b) => b.count - a.count)
            .slice(0, 5); // Top 5 patterns
    }

    /**
     * Analyzes market behavior based on digits and entropy.
     */
    public static analyzeStability(
        digits: number[],
        entropy: number,
        digitFrequencies: { digit: number; percentage: number }[]
    ): MarketStabilityData {
        if (digits.length < 20) {
            return {
                index: 50,
                volatility: 0,
                trend: 'stable',
                favoredContract: 'Analyzing...',
                unstableContract: 'Analyzing...',
                reasoning: 'Waiting for more market data (20+ ticks required)',
            };
        }

        // Stability calculation: High entropy = Low stability
        // Predictability based on variance in digit frequencies
        const percentages = digitFrequencies.map(d => d.percentage);
        const variance = this.calculateVariance(percentages);

        // Normalize stability index (Higher variance + Lower Entropy = More Stable/Predictable)
        // Random walk entropy is ~3.32 (log2 of 10)
        const entropyFactor = Math.max(0, (3.32 - entropy) / 3.32) * 50;
        const varianceFactor = Math.min(50, (variance / 5) * 50);

        const stabilityIndex = Math.min(100, Math.max(0, entropyFactor + varianceFactor));

        let trend: 'stable' | 'volatile' | 'erratic' = 'erratic';
        if (stabilityIndex > 70) trend = 'stable';
        else if (stabilityIndex > 40) trend = 'volatile';

        // Favored Contract Logic
        let favored = 'Even/Odd';
        let unstable = 'Matches';
        let reasoning = 'Market shows high randomness. Avoid high-payout/low-probability contracts.';

        if (stabilityIndex > 75) {
            favored = 'Matches / Over-Under';
            unstable = 'Differs';
            reasoning = 'Strong predictable patterns detected. High probability of repetition.';
        } else if (stabilityIndex > 50) {
            favored = 'Over / Under';
            unstable = 'Even / Odd';
            reasoning = 'Market trending slowly. Over/Under strategies have higher statistical edge.';
        } else if (stabilityIndex < 30) {
            favored = 'Differs';
            unstable = 'Matches';
            reasoning = 'High volatility and entropy. Use Differs to avoid unpredictable spikes.';
        }

        return {
            index: Math.round(stabilityIndex),
            volatility: Math.round((1 - entropyFactor / 50) * 100),
            trend,
            favoredContract: favored,
            unstableContract: unstable,
            reasoning,
        };
    }

    private static calculateVariance(values: number[]): number {
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        return values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    }
}
