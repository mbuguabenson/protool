import type { PatternMatch } from './smart-pattern-engine';

export type TradeStrategy = 'OverUnder' | 'EvenOdd' | 'Differs' | 'SuperSignals';

export interface StrategySignal {
    strategy: TradeStrategy;
    type: string; // e.g. "DIGITOVER", "DIGITUNDER"
    barrier: string;
    confidence: number;
    description: string;
    entryStatus: 'Blocked' | 'Waiting' | 'Confirmed';
}

export class AdaptiveStrategyManager {
    private minConfidence = 70;

    public getSignals(patterns: PatternMatch[]): StrategySignal[] {
        const signals: StrategySignal[] = [];

        for (const pattern of patterns) {
            const signal = this.mapPatternToSignal(pattern);
            if (signal) {
                signals.push(signal);
            }
        }

        return signals;
    }

    private mapPatternToSignal(pattern: PatternMatch): StrategySignal | null {
        switch (pattern.type) {
            case 'ExtremeCompression':
                // Original extreme logic
                return {
                    strategy: 'OverUnder',
                    type: pattern.metadata.zone === 'low' ? 'DIGITOVER' : 'DIGITUNDER',
                    barrier: pattern.metadata.zone === 'low' ? '3' : '6', // Defaulting to Over 3 / Under 6
                    confidence: pattern.confidence,
                    description: `Extreme compression detected. Reverting from ${pattern.metadata.zone} zone.`,
                    entryStatus: pattern.confidence >= 75 ? 'Confirmed' : 'Waiting',
                };

            case 'EvenOddImbalance':
                return {
                    strategy: 'EvenOdd',
                    type: pattern.metadata.side === 'EVEN' ? 'DIGITODD' : 'DIGITEVEN', // Reversion logic
                    barrier: '0',
                    confidence: pattern.confidence,
                    description: `Mean-reversion following ${pattern.metadata.side} imbalance.`,
                    entryStatus: pattern.confidence >= 70 ? 'Confirmed' : 'Waiting',
                };

            case 'ClusterRejection':
                return {
                    strategy: 'Differs',
                    type: 'DIGITDIFF',
                    barrier: String(pattern.metadata.rejectedDigit ?? ''),
                    confidence: pattern.confidence,
                    description: `Fading rejected cluster of ${pattern.metadata.rejectedDigit}.`,
                    entryStatus: pattern.confidence >= 65 ? 'Confirmed' : 'Waiting',
                };

            default:
                return null;
        }
    }

    // Helper to generate multiple variants for UI selection
    public getSignalsWithVariants(patterns: PatternMatch[]): StrategySignal[] {
        const signals: StrategySignal[] = [];
        for (const pattern of patterns) {
            const baseSignal = this.mapPatternToSignal(pattern);
            if (!baseSignal) continue;

            if (baseSignal.strategy === 'OverUnder') {
                // Generate the 3 requested variants
                const barriers = [
                    { over: '1', under: '8' },
                    { over: '2', under: '7' },
                    { over: '3', under: '6' },
                ];
                barriers.forEach(b => {
                    signals.push({
                        ...baseSignal,
                        type: baseSignal.type, // Still OVER or UNDER
                        barrier: baseSignal.type === 'DIGITOVER' ? b.over : b.under,
                        description: `${baseSignal.description} (Barrier: ${baseSignal.type === 'DIGITOVER' ? b.over : b.under})`,
                    });
                });
            } else {
                signals.push(baseSignal);
            }
        }
        return signals;
    }
}
