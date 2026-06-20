import { extractLastDigit } from '../digit-utils';

// Signal generation from tick data
export interface TickData {
    quote: number;
    epoch: number;
    pipSize?: number;
}

export class TickBuffer {
    private ticks: TickData[] = [];
    private maxSize: number;
    private pipSize: number = 2;

    constructor(maxSize = 12) {
        this.maxSize = maxSize;
    }

    setPipSize(size: number): void {
        this.pipSize = size;
    }

    addTick(quote: number, epoch: number, pipSize?: number): void {
        const currentPipSize = pipSize !== undefined ? pipSize : this.pipSize;
        this.ticks.push({ quote, epoch, pipSize: currentPipSize });
        if (this.ticks.length > this.maxSize) {
            this.ticks.shift();
        }
    }

    getLastDigit(): number {
        if (this.ticks.length === 0) return -1;
        const lastTick = this.ticks[this.ticks.length - 1];
        return extractLastDigit(lastTick.quote, lastTick.pipSize || this.pipSize);
    }

    getMostFrequentDigit(): { digit: number; frequency: number } {
        const digitCounts = new Map<number, number>();

        for (const tick of this.ticks) {
            const digit = extractLastDigit(tick.quote, tick.pipSize || this.pipSize);
            digitCounts.set(digit, (digitCounts.get(digit) || 0) + 1);
        }

        let maxDigit = 0;
        let maxCount = 0;

        for (const [digit, count] of digitCounts) {
            if (count > maxCount) {
                maxCount = count;
                maxDigit = digit;
            }
        }

        return { digit: maxDigit, frequency: this.ticks.length > 0 ? maxCount / this.ticks.length : 0 };
    }

    getLeastFrequentDigit(): { digit: number; frequency: number } {
        const digitCounts = new Map<number, number>();

        for (let i = 0; i < 10; i++) {
            digitCounts.set(i, 0);
        }

        for (const tick of this.ticks) {
            const digit = extractLastDigit(tick.quote, tick.pipSize || this.pipSize);
            digitCounts.set(digit, (digitCounts.get(digit) || 0) + 1);
        }

        let minDigit = 0;
        let minCount = this.ticks.length + 1;

        for (const [digit, count] of digitCounts) {
            if (count < minCount) {
                minCount = count;
                minDigit = digit;
            }
        }

        return { digit: minDigit, frequency: this.ticks.length > 0 ? minCount / this.ticks.length : 0 };
    }

    getDigitDistribution(): Record<number, number> {
        const distribution: Record<number, number> = {};
        for (let i = 0; i < 10; i++) {
            distribution[i] = 0;
        }

        for (const tick of this.ticks) {
            const digit = extractLastDigit(tick.quote, tick.pipSize || this.pipSize);
            distribution[digit]++;
        }

        // Convert to percentages
        const total = this.ticks.length;
        for (let i = 0; i < 10; i++) {
            distribution[i] = total > 0 ? (distribution[i] / total) * 100 : 0;
        }

        return distribution;
    }

    clear(): void {
        this.ticks = [];
    }

    size(): number {
        return this.ticks.length;
    }
}
