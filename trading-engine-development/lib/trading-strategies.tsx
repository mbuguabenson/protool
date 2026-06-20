export interface StrategyAnalysis {
    name: string;
    signal: 'BUY' | 'SELL' | 'WAIT' | null;
    power: number;
    confidence: number;
    description: string;
    status: 'WAIT' | 'TRADE' | 'NEUTRAL';
}

export class TradingStrategies {
    // Strategy 1: Even/Odd Advanced
    analyzeEvenOdd(digits: number[]): StrategyAnalysis {
        if (digits.length < 50) {
            return {
                name: 'Even/Odd',
                signal: null,
                power: 0,
                confidence: 0,
                description: 'Insufficient data (need 50 ticks)',
                status: 'NEUTRAL',
            };
        }

        const last10 = digits.slice(-10);
        const last50 = digits.slice(-50);

        const evenLast10 = last10.filter(d => d % 2 === 0).length;
        const oddLast10 = 10 - evenLast10;

        const evenLast50 = last50.filter(d => d % 2 === 0).length;
        const evenPercentLast50 = (evenLast50 / 50) * 100;

        const evenPercent = (evenLast10 / 10) * 100;
        const oddPercent = (oddLast10 / 10) * 100;

        const isEvenBias = evenPercent > oddPercent;
        const currentPower = Math.max(evenPercent, oddPercent);

        // Trend detection
        const isTrendIncreasing = isEvenBias ? evenPercent > evenPercentLast50 : oddPercent > 100 - evenPercentLast50;

        let status: 'WAIT' | 'TRADE' | 'NEUTRAL' = 'NEUTRAL';
        let description = `Even: ${evenPercent}% | Odd: ${oddPercent}%`;

        if (currentPower >= 60 && isTrendIncreasing) {
            status = 'TRADE';
            description += ' - Strong Trend Confirmed';
        } else if (currentPower >= 56 && isTrendIncreasing) {
            status = 'WAIT'; // Wait for 60% or specific setup
            description += ' - Weak Trend (Waiting for >60%)';
        } else if (currentPower >= 53) {
            status = 'WAIT';
            description += ' - Potential Setup Forming';
        }

        return {
            name: 'Even/Odd',
            signal: status !== 'NEUTRAL' ? (isEvenBias ? 'BUY' : 'SELL') : null,
            power: currentPower,
            confidence: currentPower, // Direct mapping for now
            description,
            status,
        };
    }

    // Strategy 2: Over 3 / Under 6
    analyzeOver3Under6(digits: number[]): StrategyAnalysis {
        return this.analyzeOverUnderGeneric(digits, 4, 5, 'Over 3/Under 6');
    }

    // Strategy 3: Over 2 / Under 7
    analyzeOver2Under7(digits: number[]): StrategyAnalysis {
        return this.analyzeOverUnderGeneric(digits, 3, 6, 'Over 2/Under 7');
    }

    private analyzeOverUnderGeneric(
        digits: number[],
        overThreshold: number,
        underThreshold: number,
        name: string
    ): StrategyAnalysis {
        if (digits.length < 25) {
            return {
                name,
                signal: null,
                power: 0,
                confidence: 0,
                description: 'Insufficient data',
                status: 'NEUTRAL',
            };
        }

        const last25 = digits.slice(-25);

        const overCount = last25.filter(d => d >= overThreshold).length;
        const underCount = last25.filter(d => d <= underThreshold).length;

        const overPercent = (overCount / 25) * 100;
        const underPercent = (underCount / 25) * 100;

        const maxPower = Math.max(overPercent, underPercent);
        const isOverBias = overPercent > underPercent;

        let status: 'WAIT' | 'TRADE' | 'NEUTRAL' = 'NEUTRAL';
        let description = `Over ${overThreshold - 1}: ${overPercent.toFixed(0)}% | Under ${underThreshold + 1}: ${underPercent.toFixed(0)}%`;

        // Multi-level thresholds
        if (maxPower >= 60) {
            status = 'TRADE';
            description += ' - Strong Signal';
        } else if (maxPower >= 56) {
            status = 'WAIT';
            description += ' - High Volatility (Waiting for 60%)';
        } else if (maxPower >= 52) {
            status = 'WAIT';
            description += ' - Monitoring Trend';
        }

        return {
            name,
            signal: status !== 'NEUTRAL' ? (isOverBias ? 'BUY' : 'SELL') : null,
            power: maxPower,
            confidence: maxPower,
            description,
            status,
        };
    }

    analyzeAllStrategies(digits: number[]): StrategyAnalysis[] {
        return [this.analyzeEvenOdd(digits), this.analyzeOver3Under6(digits), this.analyzeOver2Under7(digits)];
    }
}
