// Trade Execution & Risk Management Engine

export interface TradeConfig {
    baseStake: number;
    martingaleMultiplier: number;
    maxLossLimit: number;
    maxConsecutiveLosses: number;
    autoSwitchOnMaxLoss: boolean;
    tpSlEnabled: boolean;
    takeProfit: number;
    stopLoss: number;
}

export interface Trade {
    id: string;
    timestamp: number;
    botType: string;
    prediction: number | number[];
    market: string; // Added for tracking
    stake: number;
    digit: number;
    result: 'win' | 'loss' | 'pending';
    profit: number;
    multiplier: number;
    duration: number;
}

export interface RiskMetrics {
    currentStake: number;
    totalProfit: number;
    totalLoss: number;
    winRate: number;
    consecutiveWins: number;
    consecutiveLosses: number;
    shouldSwitch: boolean;
    shouldStop: boolean;
}

export class TradeExecutionEngine {
    private config: TradeConfig;
    private trades: Trade[] = [];
    private currentStake: number;
    private totalProfit: number = 0;
    private totalLoss: number = 0;
    private consecutiveWins: number = 0;
    private consecutiveLosses: number = 0;
    private tradeId: number = 0;

    constructor(config: TradeConfig) {
        this.config = config;
        this.currentStake = config.baseStake;
    }

    // Execute a trade
    executeTrade(
        botType: string,
        prediction: number | number[],
        market: string,
        digit: number,
        duration: number = 1
    ): Trade {
        const trade: Trade = {
            id: `trade_${++this.tradeId}_${Date.now()}`,
            timestamp: Date.now(),
            botType,
            prediction,
            market,
            stake: this.currentStake,
            digit,
            result: 'pending',
            profit: 0,
            multiplier: 1,
            duration,
        };

        this.trades.push(trade);
        return trade;
    }

    // Record trade result
    recordTradeResult(tradeId: string, result: 'win' | 'loss', profit: number): void {
        const trade = this.trades.find(t => t.id === tradeId);
        if (!trade) return;

        trade.result = result;
        trade.profit = profit;

        if (result === 'win') {
            this.handleWin(profit);
        } else {
            this.handleLoss(profit);
        }
    }

    private handleWin(profit: number): void {
        this.totalProfit += profit;
        this.consecutiveWins++;
        this.consecutiveLosses = 0;

        // Reset stake on win
        this.currentStake = this.config.baseStake;
    }

    private handleLoss(loss: number): void {
        this.totalLoss += loss;
        this.consecutiveLosses++;
        this.consecutiveWins = 0;

        // Apply Martingale
        this.currentStake = Math.round(this.currentStake * this.config.martingaleMultiplier * 100) / 100;
    }

    // Get risk metrics
    getRiskMetrics(): RiskMetrics {
        const totalTrades = this.trades.filter(t => t.result !== 'pending').length;
        const wins = this.trades.filter(t => t.result === 'win').length;
        const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;

        const totalLossAmount = Math.abs(this.totalLoss);
        const shouldSwitch = this.config.autoSwitchOnMaxLoss && totalLossAmount >= this.config.maxLossLimit;

        const shouldStop = this.consecutiveLosses >= this.config.maxConsecutiveLosses || shouldSwitch;

        return {
            currentStake: this.currentStake,
            totalProfit: this.totalProfit,
            totalLoss: this.totalLoss,
            winRate: Math.round(winRate * 100) / 100,
            consecutiveWins: this.consecutiveWins,
            consecutiveLosses: this.consecutiveLosses,
            shouldSwitch,
            shouldStop,
        };
    }

    // Get trade history
    getTradeHistory(limit: number = 50): Trade[] {
        return this.trades.slice(-limit);
    }

    // Reset engine
    reset(): void {
        this.trades = [];
        this.currentStake = this.config.baseStake;
        this.totalProfit = 0;
        this.totalLoss = 0;
        this.consecutiveWins = 0;
        this.consecutiveLosses = 0;
        this.tradeId = 0;
    }

    // Update config
    updateConfig(config: Partial<TradeConfig>): void {
        this.config = { ...this.config, ...config };
        if (config.baseStake) {
            this.currentStake = config.baseStake;
        }
    }

    // Get stats
    getStats() {
        const totalTrades = this.trades.filter(t => t.result !== 'pending').length;
        const wins = this.trades.filter(t => t.result === 'win').length;
        const losses = totalTrades - wins;

        return {
            totalTrades,
            wins,
            losses,
            totalProfit: this.totalProfit,
            totalLoss: this.totalLoss,
            netProfit: this.totalProfit + this.totalLoss,
            winRate: totalTrades > 0 ? (wins / totalTrades) * 100 : 0,
            averageStake:
                totalTrades > 0
                    ? this.trades.filter(t => t.result !== 'pending').reduce((sum, t) => sum + t.stake, 0) / totalTrades
                    : 0,
        };
    }
}

// Risk Manager
export class RiskManager {
    private maxDailyLoss: number;
    private maxDrawdown: number;
    private peakProfit: number = 0;
    private dailyLoss: number = 0;
    private lastResetDay: number;

    constructor(maxDailyLoss: number = 1000, maxDrawdown: number = 20) {
        this.maxDailyLoss = maxDailyLoss;
        this.maxDrawdown = maxDrawdown;
        this.lastResetDay = new Date().getDate();
    }

    // Check if trading should continue
    canTrade(currentProfit: number): boolean {
        // Check daily loss
        if (this.shouldResetDaily()) {
            this.dailyLoss = 0;
        }

        if (this.dailyLoss >= this.maxDailyLoss) {
            return false;
        }

        // Check drawdown
        if (currentProfit > this.peakProfit) {
            this.peakProfit = currentProfit;
        }

        const drawdown = ((this.peakProfit - currentProfit) / (this.peakProfit || 1)) * 100;
        if (drawdown > this.maxDrawdown) {
            return false;
        }

        return true;
    }

    recordLoss(amount: number): void {
        this.dailyLoss += amount;
    }

    private shouldResetDaily(): boolean {
        const today = new Date().getDate();
        if (today !== this.lastResetDay) {
            this.lastResetDay = today;
            return true;
        }
        return false;
    }

    getRiskStatus() {
        return {
            dailyLoss: this.dailyLoss,
            maxDailyLoss: this.maxDailyLoss,
            drawdown: ((this.peakProfit - this.peakProfit) / (this.peakProfit || 1)) * 100,
            maxDrawdown: this.maxDrawdown,
            canTrade: this.canTrade(this.peakProfit - this.dailyLoss),
        };
    }
}
