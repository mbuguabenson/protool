'use client';

/**
 * High-Performance Power Analytics Engine
 * Optimized for tick-level latency.
 * Processes digits and calculates statistical dominance (power).
 */

export interface PowerSnapshot {
    timestamp: number;
    lastDigit: number;

    // Power percentages for different windows
    evenPower: number;
    oddPower: number;
    underPower: number; // 0-4
    overPower: number; // 5-9

    // Individual digit stats
    digitFrequencies: number[]; // 0-9
    digitPowers: number[]; // 0-9

    // Strongest/Weakest
    strongestDigit: number;
    weakestDigit: number;

    // Trend
    isEvenIncreasing: boolean;
    isOddIncreasing: boolean;
    isUnderIncreasing: boolean;
    isOverIncreasing: boolean;
    isStrongestDigitIncreasing: boolean;
}

export class PowerAnalyticsEngine {
    private static instance: PowerAnalyticsEngine | null = null;

    private buffer15: number[] = [];
    private buffer25: number[] = [];
    private buffer50: number[] = [];
    private buffer100: number[] = [];

    private lastSnapshot: PowerSnapshot | null = null;

    private constructor() {}

    public static getInstance(): PowerAnalyticsEngine {
        if (!PowerAnalyticsEngine.instance) {
            PowerAnalyticsEngine.instance = new PowerAnalyticsEngine();
        }
        return PowerAnalyticsEngine.instance;
    }

    /**
     * Add a new digit to the engine and calculate power metrics immediately.
     */
    public addDigit(digit: number): PowerSnapshot {
        // Update buffers
        this.updateBuffer(this.buffer15, digit, 15);
        this.updateBuffer(this.buffer25, digit, 25);
        this.updateBuffer(this.buffer50, digit, 50);
        this.updateBuffer(this.buffer100, digit, 100);

        // Calculate current power (using 25-tick window as primary)
        const snapshot = this.calculateSnapshot(digit);
        this.lastSnapshot = snapshot;
        return snapshot;
    }

    private updateBuffer(buffer: number[], digit: number, max: number) {
        buffer.push(digit);
        if (buffer.length > max) buffer.shift();
    }

    private calculateSnapshot(lastDigit: number): PowerSnapshot {
        const window = this.buffer25;
        const len = window.length;

        // Counts
        let evenCount = 0;
        let underCount = 0;
        const digitCounts = new Array(10).fill(0);

        for (const d of window) {
            if (d % 2 === 0) evenCount++;
            if (d <= 4) underCount++;
            digitCounts[d]++;
        }

        const evenPower = (evenCount / len) * 100;
        const underPower = (underCount / len) * 100;
        const digitPowers = digitCounts.map(c => (c / len) * 100);

        // Trends (comparing 15-tick power vs 50-tick moving average)
        const isEvenIncreasing = this.calculateTrend(this.buffer15, this.buffer50, d => d % 2 === 0);
        const isUnderIncreasing = this.calculateTrend(this.buffer15, this.buffer50, d => d <= 4);

        // Find strongest/weakest
        let strongest = 0;
        let weakest = 0;
        for (let i = 1; i <= 9; i++) {
            if (digitPowers[i] > digitPowers[strongest]) strongest = i;
            if (digitPowers[i] < digitPowers[weakest]) weakest = i;
        }

        return {
            timestamp: Date.now(),
            lastDigit,
            evenPower: Math.round(evenPower),
            oddPower: Math.round(100 - evenPower),
            underPower: Math.round(underPower),
            overPower: Math.round(100 - underPower),
            digitFrequencies: digitCounts,
            digitPowers: digitPowers.map(p => Math.round(p)),
            strongestDigit: strongest,
            weakestDigit: weakest,
            isEvenIncreasing,
            isOddIncreasing: !isEvenIncreasing,
            isUnderIncreasing,
            isOverIncreasing: !isUnderIncreasing,
            isStrongestDigitIncreasing: this.calculateTrend(this.buffer15, this.buffer50, d => d === strongest),
        };
    }

    private calculateTrend(shortWindow: number[], longWindow: number[], predicate: (d: number) => boolean): boolean {
        if (shortWindow.length === 0 || longWindow.length === 0) return false;

        const shortPower = shortWindow.filter(predicate).length / shortWindow.length;
        const longPower = longWindow.filter(predicate).length / longWindow.length;

        return shortPower > longPower;
    }

    public getSnapshot(): PowerSnapshot | null {
        return this.lastSnapshot;
    }

    public reset() {
        this.buffer15 = [];
        this.buffer25 = [];
        this.buffer50 = [];
        this.buffer100 = [];
        this.lastSnapshot = null;
    }
}

export const powerEngine = PowerAnalyticsEngine.getInstance();
