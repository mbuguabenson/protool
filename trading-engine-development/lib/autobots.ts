import type { DerivAPIClient } from './deriv-api';
import { extractLastDigit } from './digit-utils';
import { AnalysisEngine, type Signal } from './analysis-engine';

export interface AutoBotConfig {
    symbol: string;
    historyCount: number;
    duration: number;
    durationUnit: string;
    tpPercent: number; // Take profit as % of balance
    slPercent: number; // Stop loss as % of balance
    useMartingale: boolean;
    martingaleMultiplier: number;
    cooldownMs: number;
    maxTradesPerMinute: number;
    initialStake: number;
    balance: number;
}

export interface AutoBotState {
    isRunning: boolean;
    totalRuns: number;
    wins: number;
    losses: number;
    profitLoss: number;
    profitLossPercent: number;
    currentStake: number;
    consecutiveLosses: number;
    trades: TradeLog[];
    isAnalyzing?: boolean;
    isTrading?: boolean;
    lastTrade?: TradeLog | null;
    currentAnalysis?: any;
    proposalMetrics?: {
        probabilities: number[];
        winRates: number[];
        payouts: number[];
    };
}

export interface TradeLog {
    id: string;
    timestamp: number;
    contractType: string;
    prediction: string;
    result: 'WIN' | 'LOSS';
    profitLoss: number;
    stake: number;
    entrySpot?: string;
    exitSpot?: string;
    isWin: boolean;
    profit: number;
}

export type BotStrategy =
    | 'EVEN_ODD'
    | 'EVEN_ODD_ADVANCED'
    | 'OVER1_UNDER8'
    | 'OVER2_UNDER7'
    | 'OVER3_UNDER6'
    | 'UNDER6'
    | 'DIFFERS'
    | 'SUPER_DIFFERS'
    | 'OVER_UNDER_ADVANCED';

export class AutoBot {
    private api: DerivAPIClient;
    private config: AutoBotConfig;
    private state: AutoBotState;
    private strategy: BotStrategy;
    private tickHistory: number[] = [];
    private analysisEngine: AnalysisEngine;
    private onStateUpdate: ((state: AutoBotState) => void) | null = null;
    private tradesThisMinute = 0;
    private minuteResetTimer: NodeJS.Timeout | null = null;
    private subscriptionId: string | null = null;
    private activeProposals: Map<string, { proposalData: any; timestamp: number }> = new Map();
    private activeContracts: Map<number, { contractData: any; entryTime: number }> = new Map();
    private currentAnalysis: any = null;
    private proposalMetrics: {
        probabilities: number[];
        winRates: number[];
        payouts: number[];
    } = { probabilities: [], winRates: [], payouts: [] };

    constructor(api: DerivAPIClient, strategy: BotStrategy, config: AutoBotConfig) {
        this.api = api;
        this.strategy = strategy;
        this.config = config;
        this.analysisEngine = new AnalysisEngine(config.historyCount);
        this.state = {
            isRunning: false,
            totalRuns: 0,
            wins: 0,
            losses: 0,
            profitLoss: 0,
            profitLossPercent: 0,
            currentStake: config.initialStake,
            consecutiveLosses: 0,
            trades: [],
            isAnalyzing: false,
            isTrading: false,
            lastTrade: null,
            currentAnalysis: null, // Initialize new state properties
            proposalMetrics: { probabilities: [], winRates: [], payouts: [] }, // Initialize new state properties
        };
    }

    // Start the bot
    async start(onStateUpdate: (state: AutoBotState) => void) {
        if (this.state.isRunning) return;

        this.onStateUpdate = onStateUpdate;
        this.state.isRunning = true;
        this.state.currentStake = Math.round(this.config.initialStake * 100) / 100;

        console.log(`[v0] 🤖 Starting ${this.strategy} bot`);

        // Reset trades per minute counter
        this.minuteResetTimer = setInterval(() => {
            this.tradesThisMinute = 0;
        }, 60000);

        try {
            // Fetch initial tick history to warm up the engine
            await this.fetchTickHistory();

            // Subscribe to live ticks
            this.subscriptionId = await this.api.subscribeTicks(this.config.symbol, tick => {
                this.analysisEngine.addTick({
                    epoch: tick.epoch,
                    quote: tick.quote,
                    symbol: this.config.symbol,
                });
            });

            // Start continuous trading loop
            this.runTradingLoop();
        } catch (error: any) {
            console.error(`[v0] Failed to start bot:`, error.message);
            this.state.isRunning = false;
            if (this.minuteResetTimer) {
                clearInterval(this.minuteResetTimer);
                this.minuteResetTimer = null;
            }
            throw error;
        }
    }

    // Stop the bot
    stop() {
        this.state.isRunning = false;
        if (this.minuteResetTimer) {
            clearInterval(this.minuteResetTimer);
            this.minuteResetTimer = null;
        }

        if (this.subscriptionId) {
            this.api.forget(this.subscriptionId).catch(console.error);
            this.subscriptionId = null;
        }

        console.log(`[v0] ⏹️ ${this.strategy} bot stopped`);
        this.updateUI();
    }

    // Main trading loop
    private async runTradingLoop() {
        while (this.state.isRunning) {
            // Check stop conditions
            if (this.shouldStop()) {
                this.stop();
                break;
            }

            // Check rate limit
            if (this.tradesThisMinute >= this.config.maxTradesPerMinute) {
                await this.delay(1000);
                continue;
            }

            try {
                // Analyze and get trade signal
                const signal = await this.analyzeAndGetSignal();

                if (!signal) {
                    await this.delay(this.config.cooldownMs);
                    continue;
                }

                console.log(`[v0] 📊 Signal generated: ${JSON.stringify(signal)}`);
                console.log(`[v0] 💰 Current stake: $${this.state.currentStake}, Balance: $${this.config.balance}`);

                // Fetch proposal with analysis data
                const { proposal, analysis, probability } = await this.fetchProposalWithAnalysis(
                    signal.contractType,
                    signal.prediction
                );

                console.log(`[v0] 📈 Analysis - Probability: ${probability.toFixed(1)}%, Payout: $${proposal.payout}`);

                // Execute trade
                this.state.isTrading = true;
                this.updateUI();

                const result = await this.executeTrade(signal.contractType, signal.prediction);
                this.state.isTrading = false;

                console.log(
                    `[v0] 🎲 Trade result: ${result.isWin ? 'WIN' : 'LOSS'}, Profit: $${result.profit.toFixed(2)}`
                );

                // Process result
                this.handleTradeResult(result);
                this.tradesThisMinute++;

                // Cooldown between trades
                await this.delay(this.config.cooldownMs);
            } catch (error: any) {
                console.error(`[v0] Error in trading loop:`, error.message);
                // Don't stop bot on single error, just continue after delay
                await this.delay(5000);
            }
        }
    }

    // Fetch tick history
    private async fetchTickHistory() {
        try {
            const response = await this.api.getTickHistory(this.config.symbol, this.config.historyCount);

            // Feed initial history to engine
            response.prices.forEach((price: number, index: number) => {
                this.analysisEngine.addTick({
                    epoch: response.times[index] || Date.now() / 1000,
                    quote: price,
                    symbol: this.config.symbol,
                });
            });

            this.tickHistory = response.prices.map((price: number) => {
                return extractLastDigit(price, response.pip_size || 2);
            });
            console.log(`[v0] 📈 Engine warmed up with ${response.prices.length} ticks for ${this.strategy}`);
        } catch (error: any) {
            console.error(`[v0] ❌ Failed to fetch tick history:`, error);
        }
    }

    // Analyze market and get trade signal
    private async analyzeAndGetSignal(): Promise<{ contractType: string; prediction?: string } | null> {
        // We no longer poll getTickHistory here as the engine is updated via subscription

        const signals = this.analysisEngine.generateSignals();
        const proSignals = this.analysisEngine.generateProSignals();
        const allSignals = [...signals, ...proSignals];

        // Map BotStrategy to AnalysisEngine signals
        switch (this.strategy) {
            case 'EVEN_ODD': {
                const signal = signals.find(s => s.type === 'even_odd');
                if (signal?.status === 'TRADE NOW') {
                    return {
                        contractType: signal.recommendation.toLowerCase().includes('even') ? 'DIGITEVEN' : 'DIGITODD',
                    };
                }
                break;
            }
            case 'EVEN_ODD_ADVANCED': {
                const signal =
                    proSignals.find(s => s.type === 'pro_even_odd') || signals.find(s => s.type === 'even_odd');
                if (signal?.status === 'TRADE NOW') {
                    return {
                        contractType: signal.recommendation.toLowerCase().includes('even') ? 'DIGITEVEN' : 'DIGITODD',
                    };
                }
                break;
            }
            case 'OVER1_UNDER8': {
                const signal = proSignals.find(
                    s =>
                        s.type === 'pro_over_under' &&
                        (s.recommendation.includes('OVER 1') || s.recommendation.includes('UNDER 8'))
                );
                if (signal?.status === 'TRADE NOW') {
                    const isOver = signal.recommendation.includes('OVER 1');
                    return { contractType: isOver ? 'DIGITOVER' : 'DIGITUNDER', prediction: isOver ? '1' : '8' };
                }
                // Fallback to standard
                const std = signals.find(s => s.type === 'over_under');
                if (std?.status === 'TRADE NOW') {
                    const isOver = std.recommendation.toLowerCase().includes('over');
                    return { contractType: isOver ? 'DIGITOVER' : 'DIGITUNDER', prediction: isOver ? '1' : '8' };
                }
                break;
            }
            case 'OVER2_UNDER7': {
                const std = signals.find(s => s.type === 'over_under');
                if (std?.status === 'TRADE NOW') {
                    const isOver = std.recommendation.toLowerCase().includes('over');
                    return { contractType: isOver ? 'DIGITOVER' : 'DIGITUNDER', prediction: isOver ? '2' : '7' };
                }
                break;
            }
            case 'OVER3_UNDER6': {
                const std = signals.find(s => s.type === 'over_under');
                if (std?.status === 'TRADE NOW') {
                    const isOver = std.recommendation.toLowerCase().includes('over');
                    return { contractType: isOver ? 'DIGITOVER' : 'DIGITUNDER', prediction: isOver ? '3' : '6' };
                }
                break;
            }
            case 'UNDER6': {
                const std = signals.find(s => s.type === 'over_under');
                if (std?.status === 'TRADE NOW' && std.recommendation.toLowerCase().includes('under')) {
                    return { contractType: 'DIGITUNDER', prediction: '6' };
                }
                break;
            }
            case 'DIFFERS':
            case 'SUPER_DIFFERS': {
                const signal =
                    proSignals.find(s => s.type === 'pro_differs') || signals.find(s => s.type === 'differs');
                if (signal?.status === 'TRADE NOW' && signal.targetDigit !== undefined && signal.targetDigit !== null) {
                    return { contractType: 'DIGITDIFF', prediction: String(signal.targetDigit) };
                }
                break;
            }
            case 'OVER_UNDER_ADVANCED': {
                const signal =
                    proSignals.find(s => s.type === 'pro_over_under') || signals.find(s => s.type === 'over_under');
                if (signal?.status === 'TRADE NOW') {
                    const isOver = signal.recommendation.toLowerCase().includes('over');
                    return { contractType: isOver ? 'DIGITOVER' : 'DIGITUNDER', prediction: isOver ? '1' : '8' };
                }
                break;
            }
        }

        return null;
    }

    // Execute trade
    private async executeTrade(
        contractType: string,
        prediction?: string
    ): Promise<{ isWin: boolean; profit: number; payout: number }> {
        let duration = this.config.duration;
        let durationUnit = this.config.durationUnit;

        if (contractType.includes('DIGIT')) {
            if (duration < 5) {
                console.log(`[v0] Adjusting duration from ${duration} to 5 ticks for ${contractType}`);
                duration = 5;
            }
            durationUnit = 't'; // Force ticks for digit contracts
        }

        const tradeParams: any = {
            symbol: this.config.symbol,
            contract_type: contractType,
            amount: this.state.currentStake,
            basis: 'stake',
            duration: duration,
            duration_unit: durationUnit,
            currency: 'USD',
        };

        if (prediction) {
            tradeParams.barrier = prediction;
        }

        try {
            // Get proposal
            const proposal = await this.api.getProposal(tradeParams);

            // Store proposal for tracking
            this.activeProposals.set(proposal.id, {
                proposalData: proposal,
                timestamp: Date.now(),
            });

            console.log(`[v0] Proposal created - ID: ${proposal.id}, Payout: $${proposal.payout}`);

            // Buy contract
            const contract = await this.api.buyContract(proposal.id, proposal.ask_price);

            // Store contract
            this.activeContracts.set(contract.contract_id, {
                contractData: contract,
                entryTime: Date.now(),
            });

            console.log(`[v0] Contract bought - ID: ${contract.contract_id}, Buy Price: $${contract.buy_price}`);

            // Monitor until completion
            const result = await this.monitorContract(contract.contract_id);

            // Clean up
            this.activeProposals.delete(proposal.id);
            this.activeContracts.delete(contract.contract_id);

            return {
                isWin: result.profit > 0,
                profit: result.profit,
                payout: result.payout,
            };
        } catch (error: any) {
            console.error(`[v0] Trade execution error:`, error);
            throw error;
        }
    }

    // Monitor contract
    private async monitorContract(contractId: number): Promise<{ profit: number; payout: number }> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Contract monitoring timeout'));
            }, 120000); // 2 minutes timeout

            this.api
                .subscribeProposalOpenContract(contractId, contract => {
                    if (contract.is_sold) {
                        clearTimeout(timeout);
                        const profit = contract.profit || 0;
                        const payout = contract.payout || 0;
                        console.log(`[v0] Contract ${contractId} result: Profit=${profit}, Payout=${payout}`);
                        resolve({ profit, payout });
                    }
                })
                .catch(error => {
                    clearTimeout(timeout);
                    reject(error);
                });
        });
    }

    // Handle trade result
    private handleTradeResult(result: { isWin: boolean; profit: number; payout: number }) {
        this.state.totalRuns++;

        const tradeLog: TradeLog = {
            id: Date.now().toString(),
            timestamp: Date.now(),
            contractType: this.strategy,
            prediction: result.isWin ? 'WIN' : 'LOSS',
            result: result.isWin ? 'WIN' : 'LOSS',
            profitLoss: result.profit,
            stake: this.state.currentStake,
            isWin: result.isWin,
            profit: result.profit,
        };

        this.state.trades.unshift(tradeLog);
        this.state.lastTrade = tradeLog;
        if (this.state.trades.length > 50) {
            this.state.trades.pop();
        }

        if (result.isWin) {
            this.state.wins++;
            this.state.profitLoss += result.profit;
            this.state.currentStake = Math.round(this.config.initialStake * 100) / 100;
            this.state.consecutiveLosses = 0;
            console.log(
                `[v0] ✅ ${this.strategy} WIN! Profit: $${result.profit.toFixed(2)} (Payout: $${result.payout.toFixed(2)})`
            );
        } else {
            this.state.losses++;
            this.state.profitLoss += result.profit; // profit is negative for loss
            this.state.consecutiveLosses++;

            if (this.config.useMartingale && this.config.martingaleMultiplier > 1) {
                const newStake = Math.round(this.state.currentStake * this.config.martingaleMultiplier * 100) / 100;
                // Cap stake to not exceed 50% of balance for safety
                this.state.currentStake = Math.min(newStake, Math.round(this.config.balance * 0.5 * 100) / 100);
                console.log(
                    `[v0] 📈 Martingale applied: Stake increased to $${this.state.currentStake.toFixed(2)} (Multiplier: ${this.config.martingaleMultiplier}x)`
                );
            }

            console.log(`[v0] ❌ ${this.strategy} LOSS! Loss: $${Math.abs(result.profit).toFixed(2)}`);
        }

        // Report to global store for admin dashboard
        import('./trade-reporting')
            .then(({ reportTrade }) => {
                reportTrade({
                    strategy: this.strategy,
                    market: this.config.symbol,
                    profit: result.profit,
                    stake: this.state.currentStake,
                });
            })
            .catch(err => console.error('[v0] Trade reporting failed in AutoBot:', err));

        this.state.profitLossPercent = (this.state.profitLoss / this.config.balance) * 100;

        this.updateUI();
    }

    // Check if should stop
    private shouldStop(): boolean {
        const tpAmount = (this.config.balance * this.config.tpPercent) / 100;
        const slAmount = -(this.config.balance * this.config.slPercent) / 100;

        if (this.state.profitLoss >= tpAmount) {
            console.log(`[v0] 🎯 ${this.strategy}: Take Profit reached!`);
            return true;
        }

        if (this.state.profitLoss <= slAmount) {
            console.log(`[v0] 🛑 ${this.strategy}: Stop Loss hit!`);
            return true;
        }

        return false;
    }

    // Update UI
    private updateUI() {
        if (this.onStateUpdate) {
            this.onStateUpdate({ ...this.state });
        }
    }

    // Delay helper
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Get state
    getState(): AutoBotState {
        return { ...this.state };
    }

    private async fetchProposalWithAnalysis(
        contractType: string,
        prediction?: string
    ): Promise<{ proposal: any; analysis: any; probability: number }> {
        const tradeParams: any = {
            symbol: this.config.symbol,
            contract_type: contractType,
            amount: this.state.currentStake,
            basis: 'stake',
            duration: this.config.duration,
            duration_unit: this.config.durationUnit,
            currency: 'USD',
        };

        if (prediction) {
            tradeParams.barrier = prediction;
        }

        try {
            console.log(`[v0] Fetching proposal for ${contractType}...`, tradeParams);
            const proposal = await this.api.getProposal(tradeParams);
            const engineAnalysis = this.analysisEngine.getAnalysis();
            const lastDigit = this.analysisEngine.getCurrentDigit() || 0;

            // Calculate signals to get probability
            const signals = this.analysisEngine.generateSignals();
            const proSignals = this.analysisEngine.generateProSignals();
            const allSignals = [...signals, ...proSignals];

            const relevantSignal = allSignals.find(
                s =>
                    (s.type.includes('over_under') && contractType.includes('OVER')) ||
                    (s.type.includes('even_odd') && contractType.includes('EVEN')) ||
                    (s.type.includes('differs') && contractType.includes('DIFF'))
            );

            const probability = relevantSignal?.probability || 55;

            // Calculate analysis metrics for UI
            const analysis = {
                currentPrice: this.analysisEngine.getTicks().slice(-1)[0]?.quote || 0,
                lastDigit,
                contractType,
                prediction,
                market: this.config.symbol,
                engineAnalysis,
                proposal: {
                    id: proposal.id,
                    askPrice: proposal.ask_price,
                    payout: proposal.payout,
                    spot: proposal.spot,
                    spotTime: proposal.spot_time,
                    longcode: proposal.longcode,
                },
            };

            // Track proposal metrics
            this.proposalMetrics.probabilities.push(probability);
            this.proposalMetrics.payouts.push(proposal.payout);

            this.currentAnalysis = analysis;

            console.log(`[v0] Proposal fetched - Payout: $${proposal.payout}, Probability: ${probability.toFixed(1)}%`);

            return {
                proposal,
                analysis,
                probability,
            };
        } catch (error: any) {
            console.error(`[v0] Proposal fetch failed:`, error);
            throw error;
        }
    }

    getCurrentAnalysis(): any {
        return {
            analysis: this.currentAnalysis,
            engineAnalysis: this.analysisEngine.getAnalysis(),
            proposalMetrics: {
                avgProbability: this.proposalMetrics.probabilities.length
                    ? this.proposalMetrics.probabilities.reduce((a, b) => a + b, 0) /
                      this.proposalMetrics.probabilities.length
                    : 0,
                avgPayout:
                    this.proposalMetrics.payouts.length > 0
                        ? this.proposalMetrics.payouts.reduce((a, b) => a + b, 0) / this.proposalMetrics.payouts.length
                        : 0,
                totalProposals: this.activeProposals.size + this.activeContracts.size,
            },
        };
    }
}
