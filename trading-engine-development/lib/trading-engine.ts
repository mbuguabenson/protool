/**
 * Advanced Trading Engine Core
 * Provides statistical analysis for multiple trading strategies
 */

export interface DigitAnalysis {
    digit: number;
    count: number;
    percentage: number;
    frequency: number;
}

export interface StrategySignal {
    name: string;
    signal: 'BUY' | 'NEUTRAL' | 'SELL';
    confidence: number; // 0-100
    power: number; // 55%+ is strong
    trendingUp: boolean;
    entryPoint?: number | string;
    stopLoss?: number | string;
    description: string;
}

export interface MarketAnalysis {
    overPercentage: number;
    underPercentage: number;
    overDigits: DigitAnalysis[];
    underDigits: DigitAnalysis[];
    overPower: number;
    underPower: number;
    trendingMarket: 'over' | 'under' | 'neutral';
    volatility: number;
    lastTickWasOver: boolean;
}

export interface EvenOddAnalysis {
    evenPercentage: number;
    oddPercentage: number;
    evenCount: number;
    oddCount: number;
    evenPower: number;
    oddPower: number;
    dominant: 'even' | 'odd' | 'neutral';
    deviation: number;
}

export interface RiseFallAnalysis {
    risePercentage: number;
    fallPercentage: number;
    riseCount: number;
    fallCount: number;
    risePower: number;
    fallPower: number;
    dominant: 'rise' | 'fall' | 'neutral';
    deviation: number;
}

export class TradingEngine {
    static analyzeOverUnder(ticks: number[]): MarketAnalysis {
        if (ticks.length === 0) {
            return {
                overPercentage: 50,
                underPercentage: 50,
                overDigits: [],
                underDigits: [],
                overPower: 0,
                underPower: 0,
                trendingMarket: 'neutral',
                volatility: 0,
                lastTickWasOver: false,
            };
        }

        const digitCounts: Record<number, number> = {};
        let overCount = 0;
        let underCount = 0;

        for (const tick of ticks) {
            const lastDigit = tick % 10;
            digitCounts[lastDigit] = (digitCounts[lastDigit] || 0) + 1;

            if (lastDigit >= 5) {
                overCount++;
            } else {
                underCount++;
            }
        }

        const total = ticks.length;
        const overPercentage = (overCount / total) * 100;
        const underPercentage = (underCount / total) * 100;

        // Analyze digit distribution for over (5-9) and under (0-4)
        const overDigits: DigitAnalysis[] = [];
        const underDigits: DigitAnalysis[] = [];

        for (let i = 0; i <= 9; i++) {
            const count = digitCounts[i] || 0;
            const percentage = (count / total) * 100;
            const analysis: DigitAnalysis = { digit: i, count, percentage, frequency: count / total };

            if (i >= 5) {
                overDigits.push(analysis);
            } else {
                underDigits.push(analysis);
            }
        }

        overDigits.sort((a, b) => b.count - a.count);
        underDigits.sort((a, b) => b.count - a.count);

        // Calculate power (momentum) - how dominant is the current leader
        const overPower = overDigits.length > 0 ? overDigits[0].percentage : 0;
        const underPower = underDigits.length > 0 ? underDigits[0].percentage : 0;

        // Check if trending up or down (compare last 15 vs first 15)
        const lastDigits = ticks.slice(-15);
        const firstDigits = ticks.slice(0, 15);

        const lastOverCount = lastDigits.filter(t => t % 10 >= 5).length;
        const firstOverCount = firstDigits.filter(t => t % 10 >= 5).length;

        const trendingMarket =
            lastOverCount > firstOverCount ? 'over' : lastOverCount < firstOverCount ? 'under' : 'neutral';

        // Volatility: standard deviation of last 20 ticks
        const recent = ticks.slice(-20);
        const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
        const variance = recent.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / recent.length;
        const volatility = Math.sqrt(variance);

        return {
            overPercentage,
            underPercentage,
            overDigits,
            underDigits,
            overPower,
            underPower,
            trendingMarket,
            volatility,
            lastTickWasOver: ticks[ticks.length - 1] % 10 >= 5,
        };
    }

    static analyzeEvenOdd(ticks: number[]): EvenOddAnalysis {
        if (ticks.length === 0) {
            return {
                evenPercentage: 50,
                oddPercentage: 50,
                evenCount: 0,
                oddCount: 0,
                evenPower: 0,
                oddPower: 0,
                dominant: 'neutral',
                deviation: 0,
            };
        }

        let evenCount = 0;
        let oddCount = 0;

        for (const tick of ticks) {
            const lastDigit = tick % 10;
            if (lastDigit % 2 === 0) {
                evenCount++;
            } else {
                oddCount++;
            }
        }

        const total = ticks.length;
        const evenPercentage = (evenCount / total) * 100;
        const oddPercentage = (oddCount / total) * 100;
        const deviation = Math.abs(evenPercentage - oddPercentage);

        // Power is the percentage of the dominant side
        const evenPower = evenPercentage;
        const oddPower = oddPercentage;

        let dominant: 'even' | 'odd' | 'neutral' = 'neutral';
        if (deviation >= 7) {
            dominant = evenPercentage > oddPercentage ? 'even' : 'odd';
        }

        return {
            evenPercentage,
            oddPercentage,
            evenCount,
            oddCount,
            evenPower,
            oddPower,
            dominant,
            deviation,
        };
    }

    static analyzeRiseFall(ticks: number[]): RiseFallAnalysis {
        if (ticks.length < 2) {
            return {
                risePercentage: 50,
                fallPercentage: 50,
                riseCount: 0,
                fallCount: 0,
                risePower: 0,
                fallPower: 0,
                dominant: 'neutral',
                deviation: 0,
            };
        }

        let riseCount = 0;
        let fallCount = 0;

        for (let i = 1; i < ticks.length; i++) {
            if (ticks[i] > ticks[i - 1]) {
                riseCount++;
            } else if (ticks[i] < ticks[i - 1]) {
                fallCount++;
            }
        }

        const total = riseCount + fallCount;
        if (total === 0) {
            return {
                risePercentage: 50,
                fallPercentage: 50,
                riseCount: 0,
                fallCount: 0,
                risePower: 0,
                fallPower: 0,
                dominant: 'neutral',
                deviation: 0,
            };
        }

        const risePercentage = (riseCount / total) * 100;
        const fallPercentage = (fallCount / total) * 100;
        const deviation = Math.abs(risePercentage - fallPercentage);

        const risePower = risePercentage;
        const fallPower = fallPercentage;

        let dominant: 'rise' | 'fall' | 'neutral' = 'neutral';
        if (deviation >= 8) {
            dominant = risePercentage > fallPercentage ? 'rise' : 'fall';
        }

        return {
            risePercentage,
            fallPercentage,
            riseCount,
            fallCount,
            risePower,
            fallPower,
            dominant,
            deviation,
        };
    }

    static analyzeMatches(ticks: number[]): DigitAnalysis[] {
        if (ticks.length === 0) return [];

        const digitCounts: Record<number, number> = {};

        for (const tick of ticks) {
            const lastDigit = tick % 10;
            digitCounts[lastDigit] = (digitCounts[lastDigit] || 0) + 1;
        }

        const total = ticks.length;
        const results: DigitAnalysis[] = [];

        for (let i = 0; i <= 9; i++) {
            const count = digitCounts[i] || 0;
            results.push({
                digit: i,
                count,
                percentage: (count / total) * 100,
                frequency: count / total,
            });
        }

        return results.sort((a, b) => b.count - a.count);
    }

    static analyzeDiffers(ticks: number[]): DigitAnalysis[] {
        // Returns least frequent (coldest) digits first
        return this.analyzeMatches(ticks).reverse();
    }

    static generateSignals(ticks: number[], last15Ticks: number[], last500Ticks: number[]): StrategySignal[] {
        if (ticks.length === 0) return [];

        const signals: StrategySignal[] = [];

        // Over/Under Signal
        const overUnder = this.analyzeOverUnder(ticks);
        const ou500 = this.analyzeOverUnder(last500Ticks);

        let ouSignal: 'BUY' | 'NEUTRAL' | 'SELL' = 'NEUTRAL';
        let ouConfidence = 0;
        let ouDescription = 'Market balanced';

        if (overUnder.overPower >= 55 && overUnder.trendingMarket === 'over') {
            ouSignal = 'BUY';
            ouConfidence = Math.min(100, overUnder.overPower + 10);
            ouDescription = `Over signal: ${overUnder.overPower.toFixed(1)}% with uptrend`;
        } else if (overUnder.underPower >= 55 && overUnder.trendingMarket === 'under') {
            ouSignal = 'BUY';
            ouConfidence = Math.min(100, overUnder.underPower + 10);
            ouDescription = `Under signal: ${overUnder.underPower.toFixed(1)}% with uptrend`;
        }

        signals.push({
            name: 'Over/Under',
            signal: ouSignal,
            confidence: ouConfidence,
            power: Math.max(overUnder.overPower, overUnder.underPower),
            trendingUp: overUnder.trendingMarket !== 'neutral',
            entryPoint:
                overUnder.overPower > overUnder.underPower
                    ? overUnder.overDigits[0]?.digit
                    : overUnder.underDigits[0]?.digit,
            description: ouDescription,
        });

        // Even/Odd Signal
        const evenOdd = this.analyzeEvenOdd(ticks);
        let eoSignal: 'BUY' | 'NEUTRAL' | 'SELL' = 'NEUTRAL';
        let eoConfidence = 0;

        if (evenOdd.dominant !== 'neutral' && evenOdd.deviation >= 7) {
            eoSignal = 'BUY';
            eoConfidence = Math.min(100, 55 + (evenOdd.deviation - 7));
        }

        signals.push({
            name: 'Even/Odd',
            signal: eoSignal,
            confidence: eoConfidence,
            power: Math.max(evenOdd.evenPower, evenOdd.oddPower),
            trendingUp: evenOdd.deviation >= 7,
            description: `${evenOdd.dominant === 'even' ? 'Even' : evenOdd.dominant === 'odd' ? 'Odd' : 'Balanced'} - ${evenOdd.deviation.toFixed(1)}% deviation`,
        });

        // Rise/Fall Signal
        const riseFall = this.analyzeRiseFall(ticks);
        let rfSignal: 'BUY' | 'NEUTRAL' | 'SELL' = 'NEUTRAL';
        let rfConfidence = 0;

        if (riseFall.dominant !== 'neutral' && riseFall.deviation >= 8) {
            rfSignal = 'BUY';
            rfConfidence = Math.min(100, 55 + (riseFall.deviation - 8));
        }

        signals.push({
            name: 'Rise/Fall',
            signal: rfSignal,
            confidence: rfConfidence,
            power: Math.max(riseFall.risePower, riseFall.fallPower),
            trendingUp: riseFall.deviation >= 8,
            description: `${riseFall.dominant === 'rise' ? 'Rise' : riseFall.dominant === 'fall' ? 'Fall' : 'Balanced'} - ${riseFall.deviation.toFixed(1)}% deviation`,
        });

        // Matches (Hot digit)
        const matches = this.analyzeMatches(ticks);
        if (matches.length > 0 && matches[0].percentage >= 15) {
            signals.push({
                name: 'Matches',
                signal: 'BUY',
                confidence: Math.min(100, matches[0].percentage * 1.2),
                power: matches[0].percentage,
                trendingUp: true,
                entryPoint: matches[0].digit,
                description: `Hot digit ${matches[0].digit} at ${matches[0].percentage.toFixed(1)}%`,
            });
        }

        // Differs (Cold digit)
        const differs = this.analyzeDiffers(ticks);
        if (differs.length > 0 && differs[0].percentage < 5) {
            signals.push({
                name: 'Differs',
                signal: 'BUY',
                confidence: Math.min(100, (10 - differs[0].percentage) * 5),
                power: 100 - differs[0].percentage,
                trendingUp: true,
                entryPoint: differs[0].digit,
                description: `Cold digit ${differs[0].digit} at ${differs[0].percentage.toFixed(1)}%`,
            });
        }

        return signals;
    }

    static calculateTickSkipPattern(ticks: number[], lastDigitTarget: number, maxSkips: number = 5): number {
        // Analyze tick pattern to recommend skip count
        if (ticks.length < 2) return 0;

        const recentTicks = ticks.slice(-20);
        let skipCount = 0;

        // Look forward from the entry point
        for (let i = 1; i <= maxSkips && i < recentTicks.length; i++) {
            const digit = recentTicks[recentTicks.length - i] % 10;
            if (digit !== lastDigitTarget) {
                skipCount++;
            } else {
                break;
            }
        }

        return skipCount;
    }
}
