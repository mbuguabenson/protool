/**
 * AI Floating Scanner - Real-time Trading Strategy Analysis Engine
 * Analyzes multiple strategies simultaneously and provides unified signal consensus
 */

export interface TickData {
    digit: number;
    timestamp: number;
}

export interface StrategySignal {
    strategy: 'OVER_UNDER' | 'EVEN_ODD' | 'RISE_FALL' | 'DIFFERS' | 'MATCHES' | 'HIGH_LOW';
    signal: 'BUY' | 'SELL' | 'NEUTRAL';
    confidence: number; // 0-100
    dominance: number; // Market power 0-100
    entryPoint?: string;
    reasoning: string;
    skipTicks: number;
    strength: 'WEAK' | 'STRONG' | 'ELITE';
}

export interface ConsensuSignal {
    overallSignal: 'BUY' | 'SELL' | 'NEUTRAL';
    confidence: number;
    supportingStrategies: number; // How many strategies agree
    dominantStrategy: string;
    allStrategies: StrategySignal[];
    marketHeat: 'COLD' | 'WARM' | 'HOT' | 'EXTREME';
}

export class AIFloatingScannerEngine {
    private static readonly OVER_RANGE = [5, 6, 7, 8, 9];
    private static readonly UNDER_RANGE = [0, 1, 2, 3, 4];
    private static readonly EVEN_RANGE = [0, 2, 4, 6, 8];
    private static readonly ODD_RANGE = [1, 3, 5, 7, 9];

    /**
     * Over/Under Strategy - Analyzes distribution of 0-4 vs 5-9
     */
    static analyzeOverUnderStrategy(ticks: TickData[], windowSize: number = 60): StrategySignal {
        const recentTicks = ticks.slice(-windowSize);
        const overCount = recentTicks.filter(t => this.OVER_RANGE.includes(t.digit)).length;
        const underCount = recentTicks.filter(t => this.UNDER_RANGE.includes(t.digit)).length;
        const total = overCount + underCount || 1;

        const overPercent = (overCount / total) * 100;
        const underPercent = (underCount / total) * 100;
        const dominance = Math.abs(overPercent - underPercent);

        let signal: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
        let strength: 'WEAK' | 'STRONG' | 'ELITE' = 'WEAK';
        let confidence = Math.min(dominance, 99);
        let skipTicks = 0;

        if (dominance >= 55) {
            signal = overPercent > underPercent ? 'BUY' : 'SELL';
            strength = dominance >= 70 ? 'ELITE' : dominance >= 60 ? 'STRONG' : 'WEAK';
            skipTicks = this.calculateSmartSkip(dominance);
        }

        const hottest =
            overPercent > underPercent
                ? this.OVER_RANGE.reduce((prev, curr) =>
                      recentTicks.filter(t => t.digit === curr).length >
                      recentTicks.filter(t => t.digit === prev).length
                          ? curr
                          : prev
                  )
                : this.UNDER_RANGE.reduce((prev, curr) =>
                      recentTicks.filter(t => t.digit === curr).length >
                      recentTicks.filter(t => t.digit === prev).length
                          ? curr
                          : prev
                  );

        return {
            strategy: 'OVER_UNDER',
            signal,
            confidence,
            dominance,
            entryPoint: signal !== 'NEUTRAL' ? `Target digit ${hottest}` : undefined,
            reasoning: `Over: ${overPercent.toFixed(1)}% | Under: ${underPercent.toFixed(1)}% | Dominance: ${dominance.toFixed(1)}%`,
            skipTicks,
            strength,
        };
    }

    /**
     * Even/Odd Strategy - Analyzes distribution of even vs odd digits
     */
    static analyzeEvenOddStrategy(ticks: TickData[], windowSize: number = 60): StrategySignal {
        const recentTicks = ticks.slice(-windowSize);
        const evenCount = recentTicks.filter(t => this.EVEN_RANGE.includes(t.digit)).length;
        const oddCount = recentTicks.filter(t => this.ODD_RANGE.includes(t.digit)).length;
        const total = evenCount + oddCount || 1;

        const evenPercent = (evenCount / total) * 100;
        const oddPercent = (oddCount / total) * 100;
        const dominance = Math.abs(evenPercent - oddPercent);

        let signal: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
        let strength: 'WEAK' | 'STRONG' | 'ELITE' = 'WEAK';
        let confidence = Math.min(dominance, 99);

        if (dominance >= 7) {
            signal = evenPercent > oddPercent ? 'BUY' : 'SELL';
            strength = dominance >= 15 ? 'ELITE' : dominance >= 10 ? 'STRONG' : 'WEAK';
        }

        return {
            strategy: 'EVEN_ODD',
            signal,
            confidence,
            dominance,
            entryPoint: signal !== 'NEUTRAL' ? `${signal === 'BUY' ? 'Even' : 'Odd'} digits dominant` : undefined,
            reasoning: `Even: ${evenPercent.toFixed(1)}% | Odd: ${oddPercent.toFixed(1)}% | Deviation: ${dominance.toFixed(1)}%`,
            skipTicks: signal !== 'NEUTRAL' ? 2 : 0,
            strength,
        };
    }

    /**
     * Rise/Fall Strategy - Analyzes uptrend vs downtrend
     */
    static analyzeRiseFallStrategy(ticks: TickData[], windowSize: number = 60): StrategySignal {
        const recentTicks = ticks.slice(-windowSize);
        if (recentTicks.length < 2) {
            return {
                strategy: 'RISE_FALL',
                signal: 'NEUTRAL',
                confidence: 0,
                dominance: 0,
                reasoning: 'Insufficient data',
                skipTicks: 0,
                strength: 'WEAK',
            };
        }

        let riseCount = 0;
        let fallCount = 0;
        for (let i = 1; i < recentTicks.length; i++) {
            if (recentTicks[i].digit > recentTicks[i - 1].digit) riseCount++;
            else fallCount++;
        }

        const totalMoves = riseCount + fallCount || 1;
        const risePercent = (riseCount / totalMoves) * 100;
        const fallPercent = (fallCount / totalMoves) * 100;
        const dominance = Math.abs(risePercent - fallPercent);

        let signal: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
        let strength: 'WEAK' | 'STRONG' | 'ELITE' = 'WEAK';

        if (dominance >= 8) {
            signal = risePercent > fallPercent ? 'BUY' : 'SELL';
            strength = dominance >= 18 ? 'ELITE' : dominance >= 12 ? 'STRONG' : 'WEAK';
        }

        return {
            strategy: 'RISE_FALL',
            signal,
            confidence: Math.min(dominance, 99),
            dominance,
            entryPoint: signal !== 'NEUTRAL' ? `${signal === 'BUY' ? 'Uptrend' : 'Downtrend'} detected` : undefined,
            reasoning: `Rise: ${risePercent.toFixed(1)}% | Fall: ${fallPercent.toFixed(1)}% | Trend strength: ${dominance.toFixed(1)}%`,
            skipTicks: signal !== 'NEUTRAL' ? 1 : 0,
            strength,
        };
    }

    /**
     * Matches Strategy - Finds and trades the hottest digit
     */
    static analyzeMatchesStrategy(ticks: TickData[], windowSize: number = 60): StrategySignal {
        const recentTicks = ticks.slice(-windowSize);
        const distribution: Record<number, number> = {};

        for (let i = 0; i < 10; i++) {
            distribution[i] = recentTicks.filter(t => t.digit === i).length;
        }

        const sorted = Object.entries(distribution)
            .map(([digit, count]) => ({ digit: parseInt(digit), count }))
            .sort((a, b) => b.count - a.count);

        const hottestDigit = sorted[0];
        const hottestPercent = (hottestDigit.count / recentTicks.length) * 100;

        const signal: 'BUY' | 'SELL' | 'NEUTRAL' = hottestPercent >= 15 ? 'BUY' : 'NEUTRAL';
        const strength: 'WEAK' | 'STRONG' | 'ELITE' =
            hottestPercent >= 25 ? 'ELITE' : hottestPercent >= 20 ? 'STRONG' : 'WEAK';

        return {
            strategy: 'MATCHES',
            signal,
            confidence: hottestPercent,
            dominance: hottestPercent,
            entryPoint: signal === 'BUY' ? `Digit ${hottestDigit.digit} (${hottestPercent.toFixed(0)}%)` : undefined,
            reasoning: `Hottest digit: ${hottestDigit.digit} appears ${hottestDigit.count} times (${hottestPercent.toFixed(1)}%)`,
            skipTicks: signal === 'BUY' ? 2 : 0,
            strength,
        };
    }

    /**
     * Differs Strategy - Trades the coldest digit (opposite of Matches)
     */
    static analyzeDiffersStrategy(ticks: TickData[], windowSize: number = 60): StrategySignal {
        const recentTicks = ticks.slice(-windowSize);
        const distribution: Record<number, number> = {};

        for (let i = 0; i < 10; i++) {
            distribution[i] = recentTicks.filter(t => t.digit === i).length;
        }

        const sorted = Object.entries(distribution)
            .map(([digit, count]) => ({ digit: parseInt(digit), count }))
            .sort((a, b) => a.count - b.count);

        const coldestDigit = sorted[0];
        const coldestPercent = (coldestDigit.count / recentTicks.length) * 100;

        const signal: 'BUY' | 'SELL' | 'NEUTRAL' = coldestPercent <= 5 ? 'BUY' : 'NEUTRAL';
        const strength: 'WEAK' | 'STRONG' | 'ELITE' =
            coldestPercent <= 2 ? 'ELITE' : coldestPercent <= 3 ? 'STRONG' : 'WEAK';

        return {
            strategy: 'DIFFERS',
            signal,
            confidence: 100 - coldestPercent,
            dominance: 100 - coldestPercent,
            entryPoint:
                signal === 'BUY' ? `Digit ${coldestDigit.digit} differs (${coldestPercent.toFixed(0)}%)` : undefined,
            reasoning: `Coldest digit: ${coldestDigit.digit} appears ${coldestDigit.count} times (${coldestPercent.toFixed(1)}%)`,
            skipTicks: signal === 'BUY' ? 2 : 0,
            strength,
        };
    }

    /**
     * High/Low Strategy - Analyzes high digits (7-9) vs low digits (0-2)
     */
    static analyzeHighLowStrategy(ticks: TickData[], windowSize: number = 60): StrategySignal {
        const recentTicks = ticks.slice(-windowSize);
        const highRange = [7, 8, 9];
        const lowRange = [0, 1, 2];

        const highCount = recentTicks.filter(t => highRange.includes(t.digit)).length;
        const lowCount = recentTicks.filter(t => lowRange.includes(t.digit)).length;
        const total = highCount + lowCount || 1;

        const highPercent = (highCount / total) * 100;
        const lowPercent = (lowCount / total) * 100;
        const dominance = Math.abs(highPercent - lowPercent);

        let signal: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
        let strength: 'WEAK' | 'STRONG' | 'ELITE' = 'WEAK';

        if (dominance >= 12) {
            signal = highPercent > lowPercent ? 'BUY' : 'SELL';
            strength = dominance >= 24 ? 'ELITE' : dominance >= 16 ? 'STRONG' : 'WEAK';
        }

        return {
            strategy: 'HIGH_LOW',
            signal,
            confidence: Math.min(dominance, 99),
            dominance,
            entryPoint: signal !== 'NEUTRAL' ? `${signal === 'BUY' ? 'High' : 'Low'} digits strong` : undefined,
            reasoning: `High (7-9): ${highPercent.toFixed(1)}% | Low (0-2): ${lowPercent.toFixed(1)}% | Skew: ${dominance.toFixed(1)}%`,
            skipTicks: signal !== 'NEUTRAL' ? 1 : 0,
            strength,
        };
    }

    /**
     * Generate unified consensus from all strategies
     */
    static generateConsensus(ticks: TickData[]): ConsensuSignal {
        const strategies = [
            this.analyzeOverUnderStrategy(ticks),
            this.analyzeEvenOddStrategy(ticks),
            this.analyzeRiseFallStrategy(ticks),
            this.analyzeMatchesStrategy(ticks),
            this.analyzeDiffersStrategy(ticks),
            this.analyzeHighLowStrategy(ticks),
        ];

        const buySignals = strategies.filter(s => s.signal === 'BUY');
        const sellSignals = strategies.filter(s => s.signal === 'SELL');
        const supportingCount = Math.max(buySignals.length, sellSignals.length);

        let overallSignal: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
        if (buySignals.length > sellSignals.length) overallSignal = 'BUY';
        else if (sellSignals.length > buySignals.length) overallSignal = 'SELL';

        const averageConfidence = strategies.reduce((sum, s) => sum + s.confidence, 0) / strategies.length;
        const dominantStrategy = [...strategies].sort((a, b) => b.confidence - a.confidence)[0];

        let marketHeat: 'COLD' | 'WARM' | 'HOT' | 'EXTREME' = 'COLD';
        if (averageConfidence >= 75) marketHeat = 'EXTREME';
        else if (averageConfidence >= 60) marketHeat = 'HOT';
        else if (averageConfidence >= 40) marketHeat = 'WARM';

        return {
            overallSignal,
            confidence: Math.min(averageConfidence, 99),
            supportingStrategies: supportingCount,
            dominantStrategy: dominantStrategy.strategy,
            allStrategies: strategies,
            marketHeat,
        };
    }

    /**
     * Calculate smart skip ticks based on dominance
     */
    private static calculateSmartSkip(dominance: number): number {
        if (dominance < 55) return 0;
        if (dominance < 60) return 1;
        if (dominance < 65) return 2;
        if (dominance < 70) return 3;
        return 4;
    }
}
