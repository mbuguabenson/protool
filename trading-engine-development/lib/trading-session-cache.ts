import { PricePoint, CandleData } from '@/components/pattern-chart';
import { derivWebSocket } from './deriv-websocket-manager';

class TradingSessionCache {
    private static instance: TradingSessionCache;
    private tickCache: Map<string, PricePoint[]> = new Map();
    private candleCache: Map<string, CandleData[]> = new Map();
    private backgroundSubs: Map<string, string> = new Map();
    private maxBackgroundSubs = 5;
    private recentSymbols: string[] = [];

    private constructor() {}

    static getInstance(): TradingSessionCache {
        if (!TradingSessionCache.instance) {
            TradingSessionCache.instance = new TradingSessionCache();
        }
        return TradingSessionCache.instance;
    }

    async pinSymbol(symbol: string) {
        if (this.backgroundSubs.has(symbol)) {
            this.recentSymbols = [...this.recentSymbols.filter(s => s !== symbol), symbol];
            return;
        }

        const subId = await derivWebSocket.subscribeTicks(symbol, tick => {
            const point: PricePoint = {
                price: tick.quote,
                timestamp: tick.epoch,
                digit: tick.lastDigit,
            };
            this.updateTickInCache(symbol, point);
        });

        if (subId) {
            this.backgroundSubs.set(symbol, subId);
            this.recentSymbols.push(symbol);
            if (this.recentSymbols.length > this.maxBackgroundSubs) {
                const oldest = this.recentSymbols.shift();
                if (oldest && oldest !== symbol) {
                    const id = this.backgroundSubs.get(oldest);
                    if (id) {
                        derivWebSocket.unsubscribe(id);
                        this.backgroundSubs.delete(oldest);
                    }
                }
            }
        }
    }

    setTicks(symbol: string, ticks: PricePoint[]) {
        this.tickCache.set(symbol, ticks);
    }

    getTicks(symbol: string): PricePoint[] | undefined {
        return this.tickCache.get(symbol);
    }

    setCandles(symbol: string, timeframe: string, candles: CandleData[]) {
        this.candleCache.set(`${symbol}_${timeframe}`, candles);
    }

    getCandles(symbol: string, timeframe: string): CandleData[] | undefined {
        return this.candleCache.get(`${symbol}_${timeframe}`);
    }

    updateTickInCache(symbol: string, point: PricePoint) {
        const current = this.tickCache.get(symbol) || [];
        // Check if last tick is same timestamp to avoid duplicates from multiple listeners
        if (current.length > 0 && current[current.length - 1].timestamp === point.timestamp) return current;
        const updated = [...current, point].slice(-100);
        this.tickCache.set(symbol, updated);
        return updated;
    }

    clear(symbol?: string) {
        if (symbol) {
            this.tickCache.delete(symbol);
        } else {
            this.tickCache.clear();
            this.candleCache.clear();
        }
    }
}

export const tradingSessionCache = TradingSessionCache.getInstance();
