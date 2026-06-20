// Unified Trading Engine - Integrates all systems
// Market Data -> Analytics -> Bot Engines -> Trade Execution -> Risk Management

import { CoreAnalyticsEngine, type AnalysisSnapshot } from './core-analytics-engine';
import { EvenOddBot, OverUnderBot, DiffersBot, MatchesBot, type BotSignal, type BotState } from './bot-engines';
import {
    TradeExecutionEngine,
    RiskManager,
    type TradeConfig,
    type Trade,
    type RiskMetrics,
} from './trade-execution-engine';

export interface UnifiedEngineConfig {
    maxTicks: number;
    tradeConfig: TradeConfig;
    maxDailyLoss: number;
    maxDrawdown: number;
}

export interface EngineState {
    isConnected: boolean;
    isAnalyzing: boolean;
    currentAnalysis: AnalysisSnapshot | null;
    botSignals: Record<string, BotSignal>;
    riskMetrics: RiskMetrics | null;
    recentTrades: Trade[];
}

export class UnifiedTradingEngine {
    private analytics: CoreAnalyticsEngine;
    private evenOddBot: EvenOddBot;
    private overUnderBot: OverUnderBot;
    private differsBot: DiffersBot;
    private matchesBot: MatchesBot;
    private tradeExecution: TradeExecutionEngine;
    private riskManager: RiskManager;

    private state: EngineState = {
        isConnected: false,
        isAnalyzing: false,
        currentAnalysis: null,
        botSignals: {},
        riskMetrics: null,
        recentTrades: [],
    };

    private listeners: Map<string, Set<Function>> = new Map();
    private config: UnifiedEngineConfig;

    constructor(config: UnifiedEngineConfig) {
        this.config = config;

        // Initialize all engines
        this.analytics = new CoreAnalyticsEngine(config.maxTicks);
        this.evenOddBot = new EvenOddBot();
        this.overUnderBot = new OverUnderBot();
        this.differsBot = new DiffersBot();
        this.matchesBot = new MatchesBot();
        this.tradeExecution = new TradeExecutionEngine(config.tradeConfig);
        this.riskManager = new RiskManager(config.maxDailyLoss, config.maxDrawdown);
    }

    // Process incoming tick
    processTick(price: number, symbol?: string): void {
        try {
            // 1. Add tick to analytics
            const digit = this.analytics.addTick(price, symbol);

            // 2. Analyze market
            const analysis = this.analytics.analyze();
            this.state.currentAnalysis = analysis;

            // 3. Generate bot signals
            const evenOddSignal = this.evenOddBot.analyze(analysis);
            const overUnderSignal = this.overUnderBot.analyze(analysis);
            const differsSignal = this.differsBot.analyze(analysis);
            const matchesSignal = this.matchesBot.analyze(analysis);

            this.state.botSignals = {
                even_odd: evenOddSignal,
                over_under: overUnderSignal,
                differs: differsSignal,
                matches: matchesSignal,
            };

            // 4. Check risk and execute trades if conditions met
            this.state.riskMetrics = this.tradeExecution.getRiskMetrics();

            // 5. Emit events
            this.emit('tick', { price, digit, analysis });
            this.emit('signals', this.state.botSignals);
            this.emit('stateChange', this.state);
        } catch (error) {
            console.error('[v0] Error processing tick:', error);
            this.emit('error', error);
        }
    }

    // Execute a trade from bot signal
    executeBotTrade(botType: string, signal: BotSignal): Trade | null {
        const riskMetrics = this.tradeExecution.getRiskMetrics();

        // Check if we should trade based on risk
        if (riskMetrics.shouldStop) {
            console.log('[v0] Trading stopped due to risk limits');
            return null;
        }

        if (signal.action !== 'trade') {
            return null;
        }

        // Execute trade
        const prediction = Array.isArray(signal.prediction) ? signal.prediction[0] : signal.prediction;
        const currentAnalysis = this.state.currentAnalysis;
        if (!currentAnalysis) return null;

        const trade = this.tradeExecution.executeTrade(
            botType,
            signal.prediction,
            currentAnalysis.symbol, // Use symbol from analysis
            currentAnalysis.currentDigit,
            1 // 1 tick duration
        );

        this.state.recentTrades.push(trade);
        if (this.state.recentTrades.length > 50) {
            this.state.recentTrades.shift();
        }

        this.emit('tradeExecuted', trade);
        return trade;
    }

    // Record trade result
    recordTradeResult(tradeId: string, result: 'win' | 'loss', profit: number): void {
        this.tradeExecution.recordTradeResult(tradeId, result, profit);

        const trade = this.state.recentTrades.find(t => t.id === tradeId);
        if (trade) {
            trade.result = result;
            trade.profit = profit;

            // Report to global store for admin dashboard
            import('@/lib/trade-reporting').then(({ reportTrade }) => {
                reportTrade({
                    strategy: trade.botType || 'Unified',
                    market: trade.market || 'Unknown',
                    profit: profit,
                    stake: trade.stake || 0,
                });
            });
        }

        // Update bot states
        if (result === 'win') {
            this.evenOddBot.recordWin();
            this.overUnderBot.recordWin();
            this.differsBot.recordWin();
            this.matchesBot.recordWin();
        } else {
            this.evenOddBot.recordLoss();
            this.overUnderBot.recordLoss();
            this.differsBot.recordLoss();
            this.matchesBot.recordLoss();
        }

        this.emit('tradeResult', { tradeId, result, profit });
    }

    // Get analysis
    getAnalysis(): AnalysisSnapshot | null {
        return this.state.currentAnalysis;
    }

    // Get bot signals
    getSignals(): Record<string, BotSignal> {
        return this.state.botSignals;
    }

    // Get risk metrics
    getRiskMetrics(): RiskMetrics | null {
        return this.state.riskMetrics;
    }

    // Get trade history
    getTradeHistory(limit: number = 50): Trade[] {
        return this.tradeExecution.getTradeHistory(limit);
    }

    // Get stats
    getStats() {
        return this.tradeExecution.getStats();
    }

    // Get state
    getState(): EngineState {
        return { ...this.state };
    }

    // Reset engine
    reset(): void {
        this.analytics.reset();
        this.evenOddBot.reset();
        this.overUnderBot.reset();
        this.differsBot.reset();
        this.matchesBot.reset();
        this.tradeExecution.reset();

        this.state = {
            isConnected: false,
            isAnalyzing: false,
            currentAnalysis: null,
            botSignals: {},
            riskMetrics: null,
            recentTrades: [],
        };

        this.emit('reset', null);
    }

    // Connect/disconnect
    connect(): void {
        this.state.isConnected = true;
        this.emit('connected', null);
    }

    disconnect(): void {
        this.state.isConnected = false;
        this.emit('disconnected', null);
    }

    isConnected(): boolean {
        return this.state.isConnected;
    }

    // Event system
    on(event: string, listener: Function): () => void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }

        this.listeners.get(event)!.add(listener);

        // Return unsubscribe function
        return () => {
            this.listeners.get(event)?.delete(listener);
        };
    }

    private emit(event: string, data: unknown): void {
        this.listeners.get(event)?.forEach(listener => {
            try {
                listener(data);
            } catch (error) {
                console.error(`[v0] Error in event listener for ${event}:`, error);
            }
        });
    }

    // Update config
    updateTradeConfig(config: Partial<TradeConfig>): void {
        this.tradeExecution.updateConfig(config);
    }
}

// Global engine instance
let engineInstance: UnifiedTradingEngine | null = null;

export const getOrCreateEngine = (config?: UnifiedEngineConfig): UnifiedTradingEngine => {
    if (!engineInstance) {
        engineInstance = new UnifiedTradingEngine(
            config || {
                maxTicks: 100,
                tradeConfig: {
                    baseStake: 1,
                    martingaleMultiplier: 1.5,
                    maxLossLimit: 100,
                    maxConsecutiveLosses: 5,
                    autoSwitchOnMaxLoss: true,
                    tpSlEnabled: false,
                    takeProfit: 50,
                    stopLoss: 50,
                },
                maxDailyLoss: 1000,
                maxDrawdown: 20,
            }
        );
    }
    return engineInstance;
};
