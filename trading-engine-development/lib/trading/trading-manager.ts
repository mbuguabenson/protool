import type { DerivAPIClient } from '../deriv-api';
import { DerivRealTrader } from '../deriv-real-trader';
import type { StrategySignal } from './adaptive-strategy-manager';

export type TradeMode = 'Manual' | 'Auto';

export interface SessionStats {
    trades: number;
    wins: number;
    losses: number;
    profit: number;
    highestWin: number;
    worstLoss: number;
}

export class TradingManager {
    private trader: DerivRealTrader;
    private mode: TradeMode = 'Manual';
    private isAutoTrading = false;
    private stats: SessionStats = {
        trades: 0,
        wins: 0,
        losses: 0,
        profit: 0,
        highestWin: 0,
        worstLoss: 0,
    };

    private maxLoss = 10;
    private targetProfit = 5;
    private defaultStake = 0.35;
    private lastTradeTime = 0;
    private tickDuration = 3;
    private onCycleEnd?: (stats: SessionStats) => void;

    constructor(apiClient: DerivAPIClient) {
        this.trader = new DerivRealTrader(apiClient);
    }

    public setConfig(config: {
        maxLoss: number;
        targetProfit: number;
        stake: number;
        duration: number;
        onCycleEnd?: (stats: SessionStats) => void;
    }) {
        this.maxLoss = config.maxLoss;
        this.targetProfit = config.targetProfit;
        this.defaultStake = config.stake;
        this.tickDuration = config.duration;
        this.onCycleEnd = config.onCycleEnd;
    }

    public getConfig() {
        return {
            maxLoss: this.maxLoss,
            targetProfit: this.targetProfit,
            stake: this.defaultStake,
            duration: this.tickDuration,
        };
    }

    public async tradeOnce(signal: StrategySignal, symbol: string, bypassLimit = false) {
        if (!bypassLimit && (this.stats.profit <= -this.maxLoss || this.stats.profit >= this.targetProfit)) {
            const reason =
                this.stats.profit <= -this.maxLoss
                    ? `Max loss limit reached (${this.stats.profit.toFixed(2)})`
                    : `Target profit reached (${this.stats.profit.toFixed(2)})`;
            console.warn(`[v0] Session limits: ${reason}. Reset session to continue.`);
            throw new Error(`SESSION_LIMIT: ${reason}`);
        }

        if (signal.entryStatus !== 'Confirmed') {
            console.warn('[v0] Entry not confirmed.');
            return;
        }

        return this.execute(signal, symbol);
    }

    public resetSession() {
        console.log('[v0] Session stats reset');
        this.stats = {
            trades: 0,
            wins: 0,
            losses: 0,
            profit: 0,
            highestWin: 0,
            worstLoss: 0,
        };
    }

    public startAutoTrade(symbol: string, getSignal: () => StrategySignal | null) {
        if (this.isAutoTrading) return;
        this.isAutoTrading = true;
        this.mode = 'Auto';

        this.autoLoop(symbol, getSignal);
    }

    public stopAutoTrade() {
        this.isAutoTrading = false;
        this.mode = 'Manual';
    }

    private async autoLoop(symbol: string, getSignal: () => StrategySignal | null) {
        let cycleTrades = 0;
        const MAX_CYCLE_TRADES = 5;

        while (this.isAutoTrading) {
            if (this.stats.profit <= -this.maxLoss || this.stats.profit >= this.targetProfit) {
                if (this.onCycleEnd) this.onCycleEnd(this.stats);
                this.stopAutoTrade();
                break;
            }

            if (this.trader.getActiveContractCount() > 0) {
                await new Promise(r => setTimeout(r, 1000));
                continue;
            }

            // Cycle management: After 5 trades, re-evaluate
            if (cycleTrades >= MAX_CYCLE_TRADES) {
                cycleTrades = 0;
                if (this.onCycleEnd) {
                    this.onCycleEnd(this.stats);
                    // Wait for hook to potentially switch symbol
                    await new Promise(r => setTimeout(r, 2000));
                }
            }

            const signal = getSignal();
            if (signal && (signal.entryStatus === 'Confirmed' || signal.strategy === 'SuperSignals')) {
                // Double safety: check for API lag or tick freeze
                if (Date.now() - this.lastTradeTime < 2000) {
                    await new Promise(r => setTimeout(r, 1000));
                    continue;
                }

                const result = await this.execute(signal, symbol);
                if (result) cycleTrades++;
            }

            await new Promise(r => setTimeout(r, 1000));
        }
    }

    private async execute(signal: StrategySignal, symbol: string) {
        const result = await this.trader.executeTrade({
            symbol,
            contractType: signal.type,
            stake: this.defaultStake,
            duration: this.tickDuration,
            durationUnit: 't',
            barrier: signal.barrier,
        });

        if (result) {
            this.lastTradeTime = Date.now();
            this.updateStats(result);
        }

        return result;
    }

    private updateStats(result: any) {
        this.stats.trades++;
        const profit = result.isWin ? result.profit : -result.buyPrice;

        if (result.isWin) {
            this.stats.wins++;
            this.stats.profit += result.profit;
            if (result.profit > this.stats.highestWin) this.stats.highestWin = result.profit;
        } else {
            this.stats.losses++;
            this.stats.profit -= result.buyPrice;
            if (result.buyPrice > this.stats.worstLoss) this.stats.worstLoss = result.buyPrice;
        }

        // Report to global store for admin dashboard
        import('@/lib/trade-reporting').then(({ reportTrade }) => {
            reportTrade({
                strategy: result.strategy || 'Adaptive',
                market: result.symbol || 'Unknown',
                profit: profit,
                stake: result.buyPrice || 0,
            });
        });
    }

    public getStats() {
        return { ...this.stats };
    }

    public getStatus() {
        return {
            mode: this.mode,
            isAutoTrading: this.isAutoTrading,
            activeContracts: this.trader.getActiveContractCount(),
        };
    }
}
