// Quantum Edge AI - Advanced Trading Engine for Deriv
// Multi-window analysis, statistical signal generation, and AI-powered market scanning

export interface TickData {
    digit: number;
    timestamp: number;
    price: number;
}

export interface MarketAnalysis {
    marketName: string;
    bullishPercent: number;
    bearishPercent: number;
    powerScore: number;
    confidenceScore: number;
    signalStrength: 'NONE' | 'WEAK' | 'STRONG' | 'ELITE';
    temperature: 'COLD' | 'WARM' | 'HOT' | 'EXTREME';
    safetyLevel: 'SAFE' | 'CAUTION' | 'RISKY';
    dominance: number;
    recommendation: string;
}

export interface DigitDistribution {
    [digit: number]: {
        frequency: number;
        powerPercent: number;
        heatScore: number;
        color: string;
    };
}

export interface Signal {
    type: 'OVER' | 'UNDER' | 'EVEN' | 'ODD' | 'RISE' | 'FALL' | 'MATCHES' | 'DIFFERS' | 'NONE';
    strength: 'WEAK' | 'STRONG' | 'ELITE';
    confidence: number;
    dominance: number;
    entryDigit?: number;
    skipTicks: number;
    reason: string;
    timestamp: number;
}

export interface MultiWindowConsensus {
    window60: Signal;
    window120: Signal;
    window250: Signal;
    window500: Signal;
    window1000: Signal;
    consensus: Signal;
    agreementScore: number;
}

export class QuantumEdgeEngine {
    // Analyze last N ticks and generate market power analysis
    static analyzeMarketPower(ticks: TickData[], windowSize: number = 60): MarketAnalysis {
        if (ticks.length === 0) {
            return this.defaultAnalysis();
        }

        const recentTicks = ticks.slice(-windowSize);
        const UNDER_RANGE = [0, 1, 2, 3, 4];
        const OVER_RANGE = [5, 6, 7, 8, 9];

        const underCount = recentTicks.filter(t => UNDER_RANGE.includes(t.digit)).length;
        const overCount = recentTicks.filter(t => OVER_RANGE.includes(t.digit)).length;
        const total = underCount + overCount || 1;

        const bullishPercent = (overCount / total) * 100;
        const bearishPercent = (underCount / total) * 100;
        const dominance = Math.max(bullishPercent, bearishPercent);

        // Volatility calculation
        const volatility = Math.abs(bullishPercent - bearishPercent);

        // Power score: combines dominance and consistency
        const powerScore = dominance * (1 - Math.abs(bullishPercent - bearishPercent) / 100);

        // Signal determination
        let signalStrength: Signal['strength'] = 'WEAK';
        if (dominance >= 70) signalStrength = 'ELITE';
        else if (dominance >= 60) signalStrength = 'STRONG';

        // Temperature based on volatility
        let temperature: MarketAnalysis['temperature'] = 'WARM';
        if (volatility > 40) temperature = 'EXTREME';
        else if (volatility > 25) temperature = 'HOT';
        else if (volatility < 10) temperature = 'COLD';

        // Safety assessment
        let safetyLevel: MarketAnalysis['safetyLevel'] = 'CAUTION';
        if (dominance >= 65 && volatility < 15) safetyLevel = 'SAFE';
        else if (dominance < 55 || volatility > 35) safetyLevel = 'RISKY';

        // Confidence score
        const confidenceScore = Math.min(powerScore + (dominance / 100) * 50, 100);

        return {
            marketName: 'Vol Market',
            bullishPercent,
            bearishPercent,
            powerScore,
            confidenceScore,
            signalStrength: dominance >= 55 ? signalStrength : 'NONE',
            temperature,
            safetyLevel,
            dominance,
            recommendation: this.getRecommendation(bullishPercent, bearishPercent, dominance),
        };
    }

    // Analyze digit distribution
    static analyzeDigitDistribution(ticks: TickData[], windowSize: number = 60): DigitDistribution {
        const recentTicks = ticks.slice(-windowSize);
        const distribution: DigitDistribution = {};

        // Initialize all digits
        for (let i = 0; i < 10; i++) {
            distribution[i] = {
                frequency: 0,
                powerPercent: 0,
                heatScore: 0,
                color: this.getDigitColor(i),
            };
        }

        // Count frequencies
        recentTicks.forEach(tick => {
            distribution[tick.digit].frequency++;
        });

        // Calculate percentages and heat scores
        const total = recentTicks.length || 1;
        const maxFrequency = Math.max(...Object.values(distribution).map(d => d.frequency));

        for (let i = 0; i < 10; i++) {
            const freq = distribution[i].frequency;
            distribution[i].powerPercent = (freq / total) * 100;
            distribution[i].heatScore = (freq / maxFrequency) * 100;
        }

        return distribution;
    }

    // Over/Under engine
    static analyzeOverUnder(ticks: TickData[], windowSize: number = 60): Signal {
        const recentTicks = ticks.slice(-windowSize);
        const UNDER_RANGE = [0, 1, 2, 3, 4];
        const OVER_RANGE = [5, 6, 7, 8, 9];

        const underCount = recentTicks.filter(t => UNDER_RANGE.includes(t.digit)).length;
        const overCount = recentTicks.filter(t => OVER_RANGE.includes(t.digit)).length;
        const total = underCount + overCount || 1;

        const underPercent = (underCount / total) * 100;
        const overPercent = (overCount / total) * 100;
        const dominance = Math.max(underPercent, overPercent);

        const isDominantOver = overPercent > underPercent;
        const dominantDigit = isDominantOver
            ? recentTicks.filter(t => OVER_RANGE.includes(t.digit)).pop()?.digit
            : recentTicks.filter(t => UNDER_RANGE.includes(t.digit)).pop()?.digit;

        let strength: Signal['strength'] = 'WEAK';
        if (dominance >= 70) strength = 'ELITE';
        else if (dominance >= 60) strength = 'STRONG';

        return {
            type: isDominantOver ? 'OVER' : 'UNDER',
            strength: dominance >= 55 ? strength : 'WEAK',
            confidence: Math.min(dominance, 99),
            dominance,
            entryDigit: dominantDigit,
            skipTicks: this.calculateSkipTicks(dominance),
            reason: `${isDominantOver ? 'Over' : 'Under'} dominance detected at ${dominance.toFixed(1)}%`,
            timestamp: Date.now(),
        };
    }

    // Even/Odd engine
    static analyzeEvenOdd(ticks: TickData[], windowSize: number = 60): Signal {
        const recentTicks = ticks.slice(-windowSize);
        const evenCount = recentTicks.filter(t => t.digit % 2 === 0).length;
        const oddCount = recentTicks.filter(t => t.digit % 2 === 1).length;
        const total = evenCount + oddCount || 1;

        const evenPercent = (evenCount / total) * 100;
        const oddPercent = (oddCount / total) * 100;
        const deviation = Math.abs(evenPercent - oddPercent);

        const isDominantEven = evenPercent > oddPercent;

        return {
            type: isDominantEven ? 'EVEN' : 'ODD',
            strength: deviation >= 15 ? 'ELITE' : deviation >= 10 ? 'STRONG' : 'WEAK',
            confidence: Math.min(deviation, 99),
            dominance: deviation,
            skipTicks: this.calculateSkipTicks(deviation),
            reason: `${isDominantEven ? 'Even' : 'Odd'} deviation: ${deviation.toFixed(1)}%`,
            timestamp: Date.now(),
        };
    }

    // Rise/Fall engine
    static analyzeRiseFall(prices: number[], windowSize: number = 60): Signal {
        const recentPrices = prices.slice(-windowSize);
        if (recentPrices.length < 2) {
            return this.noSignal();
        }

        let riseCount = 0;
        let fallCount = 0;

        for (let i = 1; i < recentPrices.length; i++) {
            if (recentPrices[i] > recentPrices[i - 1]) riseCount++;
            else fallCount++;
        }

        const totalMoves = riseCount + fallCount || 1;
        const risePercent = (riseCount / totalMoves) * 100;
        const fallPercent = (fallCount / totalMoves) * 100;
        const deviation = Math.abs(risePercent - fallPercent);

        const isRising = risePercent > fallPercent;

        return {
            type: isRising ? 'RISE' : 'FALL',
            strength: deviation >= 12 ? 'ELITE' : deviation >= 8 ? 'STRONG' : 'WEAK',
            confidence: Math.min(deviation, 99),
            dominance: deviation,
            skipTicks: this.calculateSkipTicks(deviation),
            reason: `Price trend ${isRising ? 'RISE' : 'FALL'}: ${deviation.toFixed(1)}%`,
            timestamp: Date.now(),
        };
    }

    // Matches engine - find hottest digit
    static analyzeMatches(ticks: TickData[], windowSize: number = 60): Signal {
        const distribution = this.analyzeDigitDistribution(ticks, windowSize);
        const hottest = Object.entries(distribution).reduce((prev, curr) =>
            curr[1].frequency > prev[1].frequency ? curr : prev
        );

        const hottestDigit = parseInt(hottest[0]);
        const hotPercent = distribution[hottestDigit].powerPercent;

        return {
            type: 'MATCHES',
            strength: hotPercent >= 20 ? 'ELITE' : hotPercent >= 15 ? 'STRONG' : 'WEAK',
            confidence: Math.min(hotPercent * 1.5, 99),
            dominance: hotPercent,
            entryDigit: hottestDigit,
            skipTicks: 0,
            reason: `Hottest digit: ${hottestDigit} (${hotPercent.toFixed(1)}%)`,
            timestamp: Date.now(),
        };
    }

    // Differs engine - find coldest digit
    static analyzeDigitDiffers(ticks: TickData[], windowSize: number = 60): Signal {
        const distribution = this.analyzeDigitDistribution(ticks, windowSize);
        const coldest = Object.entries(distribution).reduce((prev, curr) =>
            curr[1].frequency < prev[1].frequency ? curr : prev
        );

        const coldestDigit = parseInt(coldest[0]);
        const coldPercent = distribution[coldestDigit].powerPercent;
        const confidence = 100 - coldPercent;

        return {
            type: 'DIFFERS',
            strength: coldPercent < 5 ? 'ELITE' : coldPercent < 10 ? 'STRONG' : 'WEAK',
            confidence: Math.min(confidence, 99),
            dominance: 100 - coldPercent,
            entryDigit: coldestDigit,
            skipTicks: 0,
            reason: `Coldest digit: ${coldestDigit} (${coldPercent.toFixed(1)}%)`,
            timestamp: Date.now(),
        };
    }

    // Multi-window consensus analysis
    static generateMultiWindowConsensus(ticks: TickData[]): MultiWindowConsensus {
        const windows = [60, 120, 250, 500, 1000];
        const signals: Signal[] = [];

        windows.forEach(window => {
            if (ticks.length >= window) {
                const signal = this.analyzeOverUnder(ticks, window);
                signals.push(signal);
            }
        });

        // Find consensus: majority vote
        const overVotes = signals.filter(s => s.type === 'OVER').length;
        const underVotes = signals.filter(s => s.type === 'UNDER').length;

        const consensusType = overVotes > underVotes ? 'OVER' : 'UNDER';
        const consensus = signals.find(s => s.type === consensusType) || this.noSignal();

        const agreementScore = (Math.max(overVotes, underVotes) / signals.length) * 100;

        return {
            window60: ticks.length >= 60 ? this.analyzeOverUnder(ticks, 60) : this.noSignal(),
            window120: ticks.length >= 120 ? this.analyzeOverUnder(ticks, 120) : this.noSignal(),
            window250: ticks.length >= 250 ? this.analyzeOverUnder(ticks, 250) : this.noSignal(),
            window500: ticks.length >= 500 ? this.analyzeOverUnder(ticks, 500) : this.noSignal(),
            window1000: ticks.length >= 1000 ? this.analyzeOverUnder(ticks, 1000) : this.noSignal(),
            consensus,
            agreementScore,
        };
    }

    // Helper: calculate recommended skip ticks based on pattern analysis
    private static calculateSkipTicks(dominance: number): number {
        if (dominance < 55) return 0;
        if (dominance < 60) return 1;
        if (dominance < 65) return 2;
        if (dominance < 70) return 3;
        if (dominance < 75) return 4;
        return 5; // Maximum skip for extreme signals
    }

    // Recovery engine - analyze after consecutive losses
    static analyzeRecoveryEntry(ticks: TickData[], consecutiveLosses: number, windowSize: number = 60): Signal {
        const recentTicks = ticks.slice(-windowSize);
        const OVER_RANGE = [5, 6, 7, 8, 9];
        const UNDER_RANGE = [0, 1, 2, 3, 4];

        const overCount = recentTicks.filter(t => OVER_RANGE.includes(t.digit)).length;
        const underCount = recentTicks.filter(t => UNDER_RANGE.includes(t.digit)).length;
        const total = overCount + underCount || 1;

        const overPercent = (overCount / total) * 100;
        const underPercent = (underCount / total) * 100;

        // Recovery priority: safest entry points (Over 0, Even, Under 9)
        let recoverySignal: Signal['type'] = 'OVER';
        if (underPercent > overPercent) {
            recoverySignal = 'UNDER';
        }

        return {
            type: recoverySignal,
            strength: 'STRONG',
            confidence: Math.max(overPercent, underPercent),
            dominance: Math.abs(overPercent - underPercent),
            skipTicks: 2, // Always skip 2 ticks in recovery mode
            reason: `Recovery mode after ${consecutiveLosses} losses - Safe entry priority`,
            timestamp: Date.now(),
        };
    }

    // Calculate optimal entry ticks to skip (detect pattern changes)
    static calculateSmartSkipTicks(ticks: TickData[], entryDigit: number, maxSkip: number = 5): number {
        if (ticks.length < 3) return 0;

        const lastThreeTicks = ticks.slice(-3);
        let skipCount = 0;

        // Analyze if entry digit continues or pattern changes
        for (let i = lastThreeTicks.length - 1; i >= 0 && skipCount < maxSkip; i--) {
            if (lastThreeTicks[i].digit !== entryDigit) {
                skipCount++; // Skip ticks where digit doesn't match entry
            } else {
                break; // Stop if we find the entry digit
            }
        }

        return Math.min(skipCount, maxSkip);
    }

    // Helper: get recommendation text
    private static getRecommendation(bullish: number, bearish: number, dominance: number): string {
        if (dominance < 55) return 'Await stronger signal';
        const direction = bullish > bearish ? 'OVER' : 'UNDER';
        if (dominance >= 70) return `ELITE ${direction} signal - High confidence`;
        if (dominance >= 60) return `STRONG ${direction} signal - Recommended`;
        return `Weak ${direction} signal - Use caution`;
    }

    // Helper: get digit color
    private static getDigitColor(digit: number): string {
        const colors = [
            'bg-blue-500',
            'bg-cyan-500',
            'bg-indigo-500',
            'bg-violet-500',
            'bg-purple-500',
            'bg-emerald-500',
            'bg-green-500',
            'bg-teal-500',
            'bg-orange-500',
            'bg-red-500',
        ];
        return colors[digit] || 'bg-gray-500';
    }

    // Helper: default analysis
    private static defaultAnalysis(): MarketAnalysis {
        return {
            marketName: 'Vol Market',
            bullishPercent: 50,
            bearishPercent: 50,
            powerScore: 0,
            confidenceScore: 0,
            signalStrength: 'NONE',
            temperature: 'WARM',
            safetyLevel: 'CAUTION',
            dominance: 50,
            recommendation: 'Insufficient data',
        };
    }

    // Helper: no signal
    private static noSignal(): Signal {
        return {
            type: 'NONE',
            strength: 'WEAK',
            confidence: 0,
            dominance: 0,
            skipTicks: 0,
            reason: 'No dominant signal detected',
            timestamp: Date.now(),
        };
    }
}
