import { extractLastDigit } from '../digit-utils';
import { DerivWebSocketManager } from '../deriv-websocket-manager';

export type MarketState = 'Random' | 'Transitional' | 'Structured';

export interface MarketScore {
    symbol: string;
    score: number; // 0-100
    state: MarketState;
    stability: number;
    patternStrength: number;
    noiseRatio: number;
    lastDigit: number;
    timestamp: number;
}

export class SmartIntelligenceEngine {
    private static instance: SmartIntelligenceEngine;
    private wsManager: DerivWebSocketManager;
    private isScanning: boolean = false;
    private subscriptionIds: Map<string, string> = new Map();

    // Standard Volatility Indices — available on public (unauthenticated) connections
    private readonly PUBLIC_MARKETS: string[] = [
        'R_10',
        'R_25',
        'R_50',
        'R_75',
        'R_100',
        '1HZ10V',
        '1HZ25V',
        '1HZ50V',
        '1HZ75V',
        '1HZ100V',
    ];

    // 1S indices that require an authenticated (OTP/legacy token) connection
    private readonly AUTH_MARKETS: string[] = ['1HZ15V', '1HZ30V', '1HZ90V', '1HZ200V', '1HZ300V'];

    private get markets(): string[] {
        return [...this.PUBLIC_MARKETS, ...this.AUTH_MARKETS];
    }

    private focusMarket: string | null = null;
    private scanResults: Map<string, MarketScore> = new Map();
    private tickWindows: Map<string, number[]> = new Map();
    private readonly WINDOW_SIZE = 100;
    private listeners: Set<(scores: MarketScore[]) => void> = new Set();

    private constructor() {
        this.wsManager = DerivWebSocketManager.getInstance();
        this.initializeWindows();
    }

    public static getInstance(): SmartIntelligenceEngine {
        if (!SmartIntelligenceEngine.instance) {
            SmartIntelligenceEngine.instance = new SmartIntelligenceEngine();
        }
        return SmartIntelligenceEngine.instance;
    }

    private initializeWindows() {
        this.markets.forEach(symbol => {
            this.tickWindows.set(symbol, []);
        });
    }

    /**
     * Subscribe to a single market, silently skipping if unavailable.
     */
    private async subscribeMarket(symbol: string): Promise<void> {
        if (this.subscriptionIds.has(symbol)) return;
        try {
            const subId = await this.wsManager.subscribeTicks(symbol, tick => {
                this.processTick(symbol, tick);
            });
            if (subId) {
                this.subscriptionIds.set(symbol, subId);
                console.log(`[v0] Intelligence: subscribed to ${symbol}`);
            } else {
                // Symbol unavailable on current connection (e.g. not authorized yet)
                console.info(`[v0] Intelligence: ${symbol} unavailable on current connection — will retry after auth`);
            }
        } catch (e) {
            console.info(`[v0] Intelligence: skipping ${symbol} — ${e}`);
        }
    }

    public async startScanning() {
        if (this.isScanning) return;
        console.log('[v0] Starting Smart Intelligence multi-market scan...');
        this.isScanning = true;

        // Phase 1: Subscribe to public markets immediately
        for (const symbol of this.PUBLIC_MARKETS) {
            await this.subscribeMarket(symbol);
        }

        // Phase 2: Subscribe to auth-required markets after a short delay
        // (gives the auth flow time to complete before we attempt these)
        setTimeout(async () => {
            for (const symbol of this.AUTH_MARKETS) {
                await this.subscribeMarket(symbol);
            }
        }, 8000); // 8s delay — OTP auth typically completes in 2-5s
    }

    public async stopScanning() {
        console.log('[v0] Stopping Smart Intelligence scan...');
        for (const [symbol, subId] of this.subscriptionIds.entries()) {
            await this.wsManager.unsubscribe(subId);
        }
        this.subscriptionIds.clear();
        this.isScanning = false;
    }

    /**
     * Called after login/authorization completes to attempt subscribing
     * the auth-required 1HZ markets that may have failed during initial scan.
     */
    public async retryAuthMarkets() {
        if (!this.isScanning) return;
        console.log('[v0] Intelligence: retrying auth-required markets after authorization...');
        for (const symbol of this.AUTH_MARKETS) {
            await this.subscribeMarket(symbol);
        }
    }

    public async setFocusMarket(symbol: string) {
        if (this.focusMarket === symbol) return;

        // Unsubscribe old focus if not in fixed list
        if (this.focusMarket && !this.markets.includes(this.focusMarket)) {
            const oldSubId = this.subscriptionIds.get(this.focusMarket);
            if (oldSubId) {
                await this.wsManager.unsubscribe(oldSubId);
                this.subscriptionIds.delete(this.focusMarket);
                this.scanResults.delete(this.focusMarket);
            }
        }

        this.focusMarket = symbol;

        // If not already in list and scanning, start subscription
        if (!this.markets.includes(symbol) && this.isScanning) {
            console.log(`[v0] Adding custom focus market to Intelligence scan: ${symbol}`);
            if (!this.tickWindows.has(symbol)) {
                this.tickWindows.set(symbol, []);
            }
            const subId = await this.wsManager.subscribeTicks(symbol, tick => {
                this.processTick(symbol, tick);
            });
            if (subId) {
                this.subscriptionIds.set(symbol, subId);
            }
        }
        this.notifyListeners();
    }

    public getIsScanning() {
        return this.isScanning;
    }

    private processTick(symbol: string, tick: any) {
        const pipSize = this.wsManager.getPipSize(symbol);
        const lastDigit = extractLastDigit(tick.quote, pipSize);
        const window = this.tickWindows.get(symbol) || [];

        window.push(lastDigit);
        if (window.length > this.WINDOW_SIZE) {
            window.shift();
        }

        this.tickWindows.set(symbol, window);
        this.calculateScore(symbol, lastDigit);
    }

    private calculateScore(symbol: string, lastDigit: number) {
        const window = this.tickWindows.get(symbol) || [];
        if (window.length < 20) return; // Wait for enough data

        // 1. Stability (Distribution Uniformity)
        const freq = this.getFrequencies(window);
        const idealFreq = window.length / 10;
        let variance = 0;
        freq.forEach(count => {
            variance += Math.pow(count - idealFreq, 2);
        });
        const stability = Math.max(0, 100 - (Math.sqrt(variance / 10) / idealFreq) * 100);

        // 2. Pattern Strength (Cluster Detection)
        let clusters = 0;
        for (let i = 1; i < window.length; i++) {
            if (window[i] === window[i - 1]) clusters++;
        }
        const patternStrength = Math.min(100, (clusters / (window.length / 5)) * 100);

        // 3. Noise Ratio (Entropy-based)
        const entropy = this.calculateEntropy(freq, window.length);
        const noiseRatio = (entropy / 3.32) * 100; // log2(10) is ~3.32

        // Final Scoring Logic
        let score = stability * 0.4 + patternStrength * 0.4 + (100 - noiseRatio) * 0.2;

        let state: MarketState = 'Random';
        if (score > 70) state = 'Structured';
        else if (score > 40) state = 'Transitional';

        const marketScore: MarketScore = {
            symbol,
            score: Math.round(score),
            state,
            stability: Math.round(stability),
            patternStrength: Math.round(patternStrength),
            noiseRatio: Math.round(noiseRatio),
            lastDigit,
            timestamp: Date.now(),
        };

        this.scanResults.set(symbol, marketScore);
        this.notifyListeners();
    }

    private getFrequencies(window: number[]): number[] {
        const freq = Array(10).fill(0);
        window.forEach(d => freq[d]++);
        return freq;
    }

    private calculateEntropy(freq: number[], total: number): number {
        let entropy = 0;
        freq.forEach(count => {
            if (count > 0) {
                const p = count / total;
                entropy -= p * Math.log2(p);
            }
        });
        return entropy;
    }

    public getScores(): MarketScore[] {
        return Array.from(this.scanResults.values()).sort((a, b) => b.score - a.score);
    }

    public onUpdate(callback: (scores: MarketScore[]) => void) {
        this.listeners.add(callback);
        return () => {
            this.listeners.delete(callback);
        };
    }

    private notifyListeners() {
        const scores = this.getScores();
        this.listeners.forEach(callback => callback(scores));
    }
}
