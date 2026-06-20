export type PatternType =
    | 'Clustering'
    | 'ClusterRejection'
    | 'AlternatingCycle'
    | 'EvenOddImbalance'
    | 'ExtremeCompression'
    | 'MicroRepetition';

export interface PatternMatch {
    type: PatternType;
    strength: number; // 0-100
    confidence: number; // 0-100
    description: string;
    suggestion: string;
    metadata?: any;
}

export class SmartPatternEngine {
    private tickWindow: number[] = [];
    private maxTicks = 100;
    private tickDuration = 3;

    constructor(maxTicks = 100) {
        this.maxTicks = maxTicks;
    }

    public updateWindow(digits: number[]) {
        this.tickWindow = digits.slice(-this.maxTicks);
    }

    public setTickDuration(duration: number) {
        this.tickDuration = duration;
    }

    public analyze(): PatternMatch[] {
        const patterns: PatternMatch[] = [];

        if (this.tickWindow.length < 10) return [];

        // 1. Detect Cluster Rejection
        const rejection = this.detectClusterRejection();
        if (rejection) patterns.push(rejection);

        // 2. Detect Alternating Cycles
        const cycles = this.detectAlternatingCycles();
        if (cycles) patterns.push(cycles);

        // 3. Detect Even/Odd Imbalance
        const imbalance = this.detectEvenOddImbalance();
        if (imbalance) patterns.push(imbalance);

        // 4. Detect Extreme Compression
        const compression = this.detectExtremeCompression();
        if (compression) patterns.push(compression);

        return patterns.sort((a, b) => b.confidence - a.confidence);
    }

    private detectClusterRejection(): PatternMatch | null {
        const lastDigit = this.tickWindow[this.tickWindow.length - 1];
        const recent = this.tickWindow.slice(-20);
        const appearances = recent.filter(d => d === lastDigit).length;

        // If it appeared a lot but just changed
        if (appearances >= 4 && lastDigit !== this.tickWindow[this.tickWindow.length - 2]) {
            return {
                type: 'ClusterRejection',
                strength: (appearances / 10) * 100,
                confidence: 70,
                description: `Frequent digit ${this.tickWindow[this.tickWindow.length - 2]} rejected by ${lastDigit}`,
                suggestion: "Consider 'Differs' strategy to fade the previous cluster.",
                metadata: { rejectedDigit: this.tickWindow[this.tickWindow.length - 2] },
            };
        }
        return null;
    }

    private detectAlternatingCycles(): PatternMatch | null {
        const last4 = this.tickWindow.slice(-4);
        if (last4.length < 4) return null;

        // Pattern: A B A B
        if (last4[0] === last4[2] && last4[1] === last4[3] && last4[0] !== last4[1]) {
            return {
                type: 'AlternatingCycle',
                strength: 85,
                confidence: 80,
                description: `Alternating cycle detected: ${last4[0]} ↔ ${last4[1]}`,
                suggestion: 'Wait for cycle break before entry.',
                metadata: { cycle: [last4[0], last4[1]] },
            };
        }
        return null;
    }

    private detectEvenOddImbalance(): PatternMatch | null {
        const recent = this.tickWindow.slice(-30);
        const evenCount = recent.filter(d => d % 2 === 0).length;
        const imbalance = Math.abs(evenCount - recent.length / 2) / (recent.length / 2);

        if (imbalance >= 0.4) {
            // 70%+ imbalance
            const side = evenCount > recent.length / 2 ? 'EVEN' : 'ODD';
            return {
                type: 'EvenOddImbalance',
                strength: imbalance * 100,
                confidence: 75,
                description: `Extreme ${side} imbalance (${Math.round((evenCount / recent.length) * 100)}%)`,
                suggestion: 'Mean-reversion strategy likely.',
                metadata: { side, ratio: evenCount / recent.length },
            };
        }
        return null;
    }

    private detectExtremeCompression(): PatternMatch | null {
        const recent = this.tickWindow.slice(-10);
        const lowCount = recent.filter(d => d <= 1).length;
        const highCount = recent.filter(d => d >= 8).length;

        if (lowCount >= 3) {
            return {
                type: 'ExtremeCompression',
                strength: (lowCount / 5) * 100,
                confidence: 80,
                description: 'Extreme compression on digits 0-1',
                suggestion: 'Under 2 ↔ Over 2 Reversion strategy.',
                metadata: { zone: 'low', count: lowCount },
            };
        }

        if (highCount >= 3) {
            return {
                type: 'ExtremeCompression',
                strength: (highCount / 5) * 100,
                confidence: 80,
                description: 'Extreme compression on digits 8-9',
                suggestion: 'Over 7 ↔ Under 7 Reversion strategy.',
                metadata: { zone: 'high', count: highCount },
            };
        }
        return null;
    }
}
