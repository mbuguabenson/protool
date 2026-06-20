// Advanced Analytics Engine for Deriv Trading
// Implements power calculations, trend analysis, and signal generation
import { extractLastDigit } from './digit-utils';

export interface TickData {
    epoch: number;
    quote: number;
    symbol: string;
    pipSize?: number;
}

export interface DigitPower {
    digit: number;
    count: number;
    power: number; // percentage 0-100
    trend: number; // change from previous
    color: 'green' | 'amber' | 'red' | 'purple';
}

export interface BotSignal {
    botType: 'even_odd' | 'over_under' | 'differs' | 'matches';
    action: 'trade' | 'wait' | 'skip';
    prediction: number | number[]; // digit(s) to trade
    confidence: number; // 0-100
    reason: string;
    powerThreshold: boolean;
    trendCondition: boolean;
}

export interface AnalysisSnapshot {
    timestamp: number;
    symbol: string; // Added for tracking
    totalTicks: number;
    currentDigit: number;
    lastDigits: number[];
    digitPowers: DigitPower[];

    // Even/Odd analysis
    even: { count: number; power: number; trend: number };
    odd: { count: number; power: number; trend: number };

    // Over/Under analysis (0-4 vs 5-9)
    under: { count: number; power: number; trend: number }; // 0-4
    over: { count: number; power: number; trend: number }; // 5-9

    // Dominant patterns
    strongest: { digit: number; power: number };
    weakest: { digit: number; power: number };
    secondStrongest: { digit: number; power: number };

    // Quality metrics
    entropy: number; // randomness score 0-1
    powerGap: number; // difference between strongest and weakest
    isBalanced: boolean; // power gap < 15%
}

export interface PowerTrend {
    digit: number;
    direction: 'increasing' | 'decreasing' | 'stable';
    changePercent: number;
}

export class CoreAnalyticsEngine {
    private maxTicks: number;
    private digits: number[] = [];
    private previousSnapshot: AnalysisSnapshot | null = null;
    private digitHistory: Map<number, number[]> = new Map(); // digit -> power history
    private symbol: string = 'Unknown';
    private pipSize: number = 2;

    constructor(maxTicks: number = 100) {
        this.maxTicks = maxTicks;
        // Initialize digit history
        for (let i = 0; i <= 9; i++) {
            this.digitHistory.set(i, []);
        }
    }

    setPipSize(pipSize: number): void {
        this.pipSize = pipSize;
    }

    addTick(price: number, symbol?: string): number {
        if (symbol) this.symbol = symbol;
        const digit = this.extractDigit(price);
        this.digits.push(digit);

        // Maintain rolling window
        if (this.digits.length > this.maxTicks) {
            this.digits.shift();
        }

        return digit;
    }

    private extractDigit(price: number): number {
        return extractLastDigit(price, this.pipSize);
    }

    private calculateDecimalCount(pip: number): number {
        const s = String(pip);
        if (s.includes('.')) return s.split('.')[1].length;
        if (s.includes('e-')) return Number.parseInt(s.split('e-')[1], 10);
        return 0;
    }

    analyze(): AnalysisSnapshot {
        const totalTicks = this.digits.length;

        if (totalTicks === 0) {
            return this.getEmptySnapshot();
        }

        // Calculate digit powers
        const digitCounts = new Map<number, number>();
        for (let i = 0; i <= 9; i++) {
            digitCounts.set(i, 0);
        }

        this.digits.forEach(d => {
            digitCounts.set(d, (digitCounts.get(d) || 0) + 1);
        });

        // Convert to power objects
        const digitPowers: DigitPower[] = Array.from(digitCounts.entries())
            .map(([digit, count]) => {
                const power = (count / totalTicks) * 100;
                const previousPower = this.getPreviousPower(digit);
                const trend = power - previousPower;

                return {
                    digit,
                    count,
                    power: Math.round(power * 100) / 100,
                    trend: Math.round(trend * 100) / 100,
                    color: this.getPowerColor(power, digit),
                };
            })
            .sort((a, b) => b.power - a.power);

        // Store power history for trend calculation
        digitPowers.forEach(dp => {
            const history = this.digitHistory.get(dp.digit) || [];
            history.push(dp.power);
            if (history.length > 10) history.shift();
            this.digitHistory.set(dp.digit, history);
        });

        // Even/Odd analysis
        const evenDigits = this.digits.filter(d => d % 2 === 0);
        const oddDigits = this.digits.filter(d => d % 2 !== 0);

        const evenCount = evenDigits.length;
        const oddCount = oddDigits.length;
        const evenPower = (evenCount / totalTicks) * 100;
        const oddPower = (oddCount / totalTicks) * 100;

        const previousEvenPower = this.previousSnapshot?.even.power || 50;
        const previousOddPower = this.previousSnapshot?.odd.power || 50;

        // Over/Under analysis (0-4 vs 5-9)
        const underDigits = this.digits.filter(d => d <= 4);
        const overDigits = this.digits.filter(d => d >= 5);

        const underCount = underDigits.length;
        const overCount = overDigits.length;
        const underPower = (underCount / totalTicks) * 100;
        const overPower = (overCount / totalTicks) * 100;

        const previousUnderPower = this.previousSnapshot?.under.power || 50;
        const previousOverPower = this.previousSnapshot?.over.power || 50;

        // Get top performers
        const strongest = digitPowers[0];
        const secondStrongest = digitPowers[1] || digitPowers[0];
        const weakest = digitPowers[9] || digitPowers[0];

        // Calculate entropy (randomness)
        const entropy = this.calculateEntropy(digitPowers);

        // Power gap
        const powerGap = strongest.power - weakest.power;

        const currentDigit = this.digits[this.digits.length - 1];

        const snapshot: AnalysisSnapshot = {
            timestamp: Date.now(),
            symbol: this.symbol,
            totalTicks,
            currentDigit,
            lastDigits: [...this.digits.slice(-15)],
            digitPowers,

            even: {
                count: evenCount,
                power: Math.round(evenPower * 100) / 100,
                trend: Math.round((evenPower - previousEvenPower) * 100) / 100,
            },
            odd: {
                count: oddCount,
                power: Math.round(oddPower * 100) / 100,
                trend: Math.round((oddPower - previousOddPower) * 100) / 100,
            },

            under: {
                count: underCount,
                power: Math.round(underPower * 100) / 100,
                trend: Math.round((underPower - previousUnderPower) * 100) / 100,
            },
            over: {
                count: overCount,
                power: Math.round(overPower * 100) / 100,
                trend: Math.round((overPower - previousOverPower) * 100) / 100,
            },

            strongest: {
                digit: strongest.digit,
                power: strongest.power,
            },
            secondStrongest: {
                digit: secondStrongest.digit,
                power: secondStrongest.power,
            },
            weakest: {
                digit: weakest.digit,
                power: weakest.power,
            },

            entropy,
            powerGap: Math.round(powerGap * 100) / 100,
            isBalanced: powerGap < 15,
        };

        this.previousSnapshot = snapshot;
        return snapshot;
    }

    private getEmptySnapshot(): AnalysisSnapshot {
        return {
            timestamp: Date.now(),
            symbol: this.symbol,
            totalTicks: 0,
            currentDigit: 0,
            lastDigits: [],
            digitPowers: Array.from({ length: 10 }, (_, i) => ({
                digit: i,
                count: 0,
                power: 0,
                trend: 0,
                color: 'red' as const,
            })),

            even: { count: 0, power: 0, trend: 0 },
            odd: { count: 0, power: 0, trend: 0 },
            under: { count: 0, power: 0, trend: 0 },
            over: { count: 0, power: 0, trend: 0 },

            strongest: { digit: 0, power: 0 },
            secondStrongest: { digit: 0, power: 0 },
            weakest: { digit: 0, power: 0 },

            entropy: 0,
            powerGap: 0,
            isBalanced: true,
        };
    }

    private getPowerColor(power: number, digit: number): 'green' | 'amber' | 'red' | 'purple' {
        const snapshot = this.previousSnapshot;
        if (!snapshot) return 'red';

        const strongest = snapshot.strongest.power;
        const secondStrongest = snapshot.secondStrongest.power;

        if (power === strongest) return 'green';
        if (power === secondStrongest) return 'amber';
        if (power < 5) return 'red';
        return 'purple';
    }

    private getPreviousPower(digit: number): number {
        if (!this.previousSnapshot) return 10; // 1/10 = 10%
        const dp = this.previousSnapshot.digitPowers.find(d => d.digit === digit);
        return dp?.power || 10;
    }

    private calculateEntropy(digitPowers: DigitPower[]): number {
        const totalTicks = this.digits.length;
        if (totalTicks === 0) return 0;

        let entropy = 0;
        digitPowers.forEach(dp => {
            const probability = dp.count / totalTicks;
            if (probability > 0) {
                entropy -= probability * Math.log2(probability);
            }
        });

        // Normalize to 0-1 (max entropy for 10 digits is log2(10) = 3.32)
        return Math.min(entropy / Math.log2(10), 1);
    }

    getLastDigits(count: number = 15): number[] {
        return this.digits.slice(-count);
    }

    getTrendForDigit(digit: number): PowerTrend {
        const history = this.digitHistory.get(digit) || [];
        if (history.length < 2) {
            return {
                digit,
                direction: 'stable',
                changePercent: 0,
            };
        }

        const current = history[history.length - 1];
        const previous = history[history.length - 2];
        const change = current - previous;

        let direction: 'increasing' | 'decreasing' | 'stable';
        if (Math.abs(change) < 1) {
            direction = 'stable';
        } else if (change > 0) {
            direction = 'increasing';
        } else {
            direction = 'decreasing';
        }

        return {
            digit,
            direction,
            changePercent: Math.round(change * 100) / 100,
        };
    }

    reset(): void {
        this.digits = [];
        this.previousSnapshot = null;
        for (let i = 0; i <= 9; i++) {
            this.digitHistory.set(i, []);
        }
    }
}
