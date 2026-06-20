'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Play, Square, AlertCircle, AlertTriangle, Activity, DollarSign } from 'lucide-react';
import { useDerivAPI } from '@/lib/deriv-api-context';
import { AutoBot, type BotStrategy, type AutoBotState, type AutoBotConfig } from '@/lib/autobots';
import { AnalysisEngine, type Signal } from '@/lib/analysis-engine';
import { TickHistoryManager } from '@/lib/tick-history-manager';
import { derivWebSocket } from '@/lib/deriv-websocket-manager';
import { MarketSelector } from '@/components/market-selector';
import type { DerivSymbol } from '@/hooks/use-deriv';

interface AutoBotTabProps {
    theme?: 'light' | 'dark';
    currentDigit?: number;
    currentPrice?: number;
    tickCount?: number;
    maxTicks?: number;
    symbol?: string;
    availableSymbols?: any[];
    onSymbolChange?: (symbol: string) => void;
}

interface BotConfig {
    initialStake: number;
    tpPercent: number;
    slPercent: number;
    useMartingale: boolean;
    martingaleMultiplier: number;
    duration: number;
}

interface TradeLogEntry {
    id: string;
    time: Date;
    strategy: string;
    contract: string;
    predicted: string;
    entry: string;
    exit: string;
    stake: number;
    result: 'win' | 'loss';
    profitLoss: number;
}

const BOT_STRATEGIES: {
    id: BotStrategy;
    name: string;
    description: string;
    condition: string;
}[] = [
    {
        id: 'EVEN_ODD',
        name: 'EVEN/ODD Bot',
        description: 'Analyzes Even/Odd digit bias over last 100 ticks',
        condition: 'Entry: When even/odd reaches 60%+ and increasing. Wait at 55-59%. Exit after 1 tick.',
    },
    {
        id: 'OVER3_UNDER6',
        name: 'OVER3/UNDER6 Bot',
        description: 'Trades Over 3 (4-9) vs Under 6 (0-5)',
        condition: 'Entry: 60%+ = TRADE NOW. 55-59% = WAIT. Analyzes market power distribution.',
    },
    {
        id: 'OVER2_UNDER7',
        name: 'OVER2_UNDER7 Bot',
        description: 'Trades Over 2 (3-9) vs Under 7 (0-6)',
        condition: 'Entry: When 0-6 dominates 60%+, trade Under 7. Match-reversion logic.',
    },
    {
        id: 'OVER1_UNDER8',
        name: 'OVER1/UNDER8 Bot',
        description: 'Advanced Over 1 (2-9) vs Under 8 (0-7)',
        condition: 'Entry: Analyzes last 50 ticks. 60%+ threshold with power trend confirmation.',
    },
    {
        id: 'UNDER6',
        name: 'UNDER6 Bot',
        description: 'Specialized for digits 0-6',
        condition: 'Entry: When 0-4 appears 50%+, trade Under 6. Requires increasing power.',
    },
    {
        id: 'DIFFERS',
        name: 'DIFFERS Bot',
        description: 'Selects digits 2-7 with <10% frequency',
        condition: 'Entry: Decreasing power + no appearance in 3 ticks. High precision DIFFERS.',
    },
    {
        id: 'SUPER_DIFFERS',
        name: 'SUPER DIFFERS Bot',
        description: 'High-precision entry using Pro neural logic (digits 2-7)',
        condition: 'Entry: <10% digit, wait 3 ticks without appearance. Uses advanced probability.',
    },
];

const USD_TO_KES_RATE = 129.5;

const calculateSuggestedMartingale = (strategy: BotStrategy, stake: number): number => {
    // Typical payout multipliers for each strategy
    const payoutMultipliers: Record<BotStrategy, number> = {
        EVEN_ODD: 1.95,
        EVEN_ODD_ADVANCED: 1.95,
        OVER3_UNDER6: 1.9,
        OVER2_UNDER7: 1.85,
        OVER1_UNDER8: 1.8,
        UNDER6: 1.85,
        DIFFERS: 9.0, // DIFFERS has much higher payout
        SUPER_DIFFERS: 9.0,
        OVER_UNDER_ADVANCED: 1.85,
    };

    const payout = payoutMultipliers[strategy] || 1.95;

    // Formula: next_stake = (previous_loss + target_profit) / (payout_multiplier - 1)
    // Where target_profit = initial_stake (to recover loss AND make profit of initial stake)
    // Rearranging: martingale_multiplier = (loss + profit) / initial_stake
    //            = (stake + stake) / stake = 2 * stake / stake
    //            But we need to account for payout
    // Better formula: martingale = (stake + stake) / ((payout - 1) * stake)
    //                            = 2 / (payout - 1)

    const suggestedMultiplier = 2 / (payout - 1);

    // Round to 2 decimal places and ensure it's at least 1.1
    return Math.max(1.1, Math.round(suggestedMultiplier * 100) / 100);
};

export function AutoBotTab({
    theme = 'dark',
    symbol = 'R_100',
    onSymbolChange,
    availableSymbols = [],
    currentPrice,
    currentDigit,
    tickCount,
    maxTicks = 1000,
}: AutoBotTabProps) {
    const { apiClient, isConnected, isAuthorized, error: apiError, balance, isLoggedIn } = useDerivAPI();

    const [activeBots, setActiveBots] = useState<Map<BotStrategy, AutoBot>>(new Map());
    const [botStates, setBotStates] = useState<Map<BotStrategy, AutoBotState>>(new Map());
    const [botAnalysis, setBotAnalysis] = useState<Map<BotStrategy, any>>(new Map());
    const [botReadyStatus, setBotReadyStatus] = useState<Map<BotStrategy, boolean>>(new Map());
    const [botConfigs, setBotConfigs] = useState<Map<BotStrategy, BotConfig>>(new Map());
    const [botTickData, setBotTickData] = useState<Map<BotStrategy, number[]>>(new Map());
    const [tradeLogs, setTradeLogs] = useState<TradeLogEntry[]>([]);
    const [showMartingaleConfig, setShowMartingaleConfig] = useState<Map<BotStrategy, boolean>>(new Map());
    const [currentMarketPrice, setCurrentMarketPrice] = useState<number>(0);
    const [currentLastDigit, setCurrentLastDigit] = useState<number>(0);
    const [botStatus, setBotStatus] = useState<Map<BotStrategy, string>>(new Map());
    const [entryPointMet, setEntryPointMet] = useState<Map<BotStrategy, boolean>>(new Map());
    const [consecutiveDigits, setConsecutiveDigits] = useState<Map<BotStrategy, number[]>>(new Map());
    const [showTPPopup, setShowTPPopup] = useState(false);
    const [tpAmount, setTpAmount] = useState(0);

    const tickManagerRef = useRef<TickHistoryManager | null>(null);
    const tickSubscriptionRef = useRef<string | null>(null);
    const tickHandlerRef = useRef<((tickData: any) => void) | null>(null);
    const analysisEngineRef = useRef<AnalysisEngine>(new AnalysisEngine(1000));

    useEffect(() => {
        const defaultConfig: BotConfig = {
            initialStake: 0.35,
            tpPercent: 10,
            slPercent: 50,
            useMartingale: false,
            martingaleMultiplier: 2,
            duration: 1, // Default to 1 tick
        };

        const configs = new Map<BotStrategy, BotConfig>();
        BOT_STRATEGIES.forEach(strategy => {
            configs.set(strategy.id, { ...defaultConfig });
        });
        setBotConfigs(configs);
    }, []);

    useEffect(() => {
        // Early return if no symbol is selected yet
        if (!symbol) {
            console.log('[v0] AutoBotTab: Waiting for symbol selection...');
            return;
        }

        const initializeWebSocket = async () => {
            try {
                // We rely on DerivAPIProvider for the core connection now

                if (!tickManagerRef.current) {
                    tickManagerRef.current = new TickHistoryManager(apiClient);
                }

                const tickHandler = (tickData: any) => {
                    // Update market price and last digit from WebSocket
                    setCurrentMarketPrice(tickData.quote);
                    setCurrentLastDigit(tickData.lastDigit);

                    // Update analysis engine
                    analysisEngineRef.current.addTick({
                        epoch: Date.now() / 1000,
                        quote: tickData.quote,
                        symbol: symbol,
                    });
                };

                tickHandlerRef.current = tickHandler;

                // Pre-fetch history for the engine so analysis starts immediately
                try {
                    const history = await derivWebSocket.getTicksHistory(symbol, maxTicks);
                    if (history && history.length > 0) {
                        console.log(`[v0] AutoBot pre-loaded ${history.length} ticks for immediate analysis`);
                        analysisEngineRef.current.setMaxTicks(maxTicks);
                        analysisEngineRef.current.addTicksBatch(history);
                    }
                } catch (e) {
                    console.error('[v0] AutoBot failed to pre-load history:', e);
                }

                // Subscribe to ticks for the selected symbol
                if (!symbol) {
                    console.warn('[v0] AutoBotTab: Symbol was cleared during initialization');
                    return;
                }
                const subscriptionId = await derivWebSocket.subscribeTicks(symbol, tickHandler);

                tickSubscriptionRef.current = subscriptionId;
            } catch (error) {
                console.error('[v0] Failed to initialize WebSocket:', error);
            }
        };

        initializeWebSocket();

        const analyzeInterval = setInterval(async () => {
            const latestDigits = analysisEngineRef.current.getRecentDigits(maxTicks);

            if (latestDigits.length > 0) {
                const lastDigit = latestDigits[latestDigits.length - 1];
                // Ensure we explicitly handle 0 as a valid digit
                setCurrentLastDigit(typeof lastDigit === 'number' ? lastDigit : 0);

                const marketPrice = analysisEngineRef.current.getLatestPrice();
                if (marketPrice !== null) {
                    setCurrentMarketPrice(marketPrice);
                }

                console.log(`[v0] AutoBot received ${latestDigits.length} ticks for analysis`);
            }

            if (latestDigits.length < 25) {
                console.log('[v0] Waiting for more ticks...');
                return;
            }

            for (const strategy of BOT_STRATEGIES) {
                try {
                    setBotTickData(prev => new Map(prev).set(strategy.id, latestDigits));

                    const signals = analysisEngineRef.current.generateSignals();
                    const proSignals = analysisEngineRef.current.generateProSignals();
                    const allSignals = [...signals, ...proSignals];
                    const engineAnalysis = analysisEngineRef.current.getAnalysis();

                    // Map engine signals to UI analysis format
                    const analysis = mapEngineToUI(strategy.id, allSignals, engineAnalysis);
                    setBotAnalysis(prev => new Map(prev).set(strategy.id, analysis));

                    const isReady = analysis.signal === 'TRADE NOW';
                    setBotReadyStatus(prev => new Map(prev).set(strategy.id, isReady));

                    // Entry points are now handled within AnalysisEngine's status
                    setEntryPointMet(prev => new Map(prev).set(strategy.id, isReady));
                } catch (error) {
                    console.error(`[v0] Analysis error for ${strategy.id}:`, error);
                }
            }
        }, 2000);

        return () => {
            clearInterval(analyzeInterval);
            if (tickManagerRef.current) {
                tickManagerRef.current.cleanup();
            }
            if (tickSubscriptionRef.current) {
                derivWebSocket.unsubscribe(tickSubscriptionRef.current, tickHandlerRef.current || undefined);
            }
        };
    }, [apiClient, isConnected, symbol, maxTicks]);

    const mapEngineToUI = (strategy: BotStrategy, signals: Signal[], analysis: any) => {
        let relevant: Signal | undefined;

        switch (strategy) {
            case 'EVEN_ODD':
                relevant = signals.find(s => s.type === 'even_odd');
                break;
            case 'EVEN_ODD_ADVANCED':
                relevant = signals.find(s => s.type === 'pro_even_odd') || signals.find(s => s.type === 'even_odd');
                break;
            case 'OVER1_UNDER8':
                relevant = signals.find(
                    s =>
                        s.type === 'pro_over_under' &&
                        (s.recommendation.includes('OVER 1') || s.recommendation.includes('UNDER 8'))
                );
                break;
            case 'OVER2_UNDER7':
            case 'OVER3_UNDER6':
            case 'OVER_UNDER_ADVANCED':
            case 'UNDER6':
                relevant = signals.find(s => s.type === 'over_under');
                break;
            case 'DIFFERS':
            case 'SUPER_DIFFERS':
                relevant = signals.find(s => s.type === 'pro_differs') || signals.find(s => s.type === 'differs');
                break;
        }

        return {
            marketPower: relevant?.probability || 50,
            trend: relevant?.status === 'TRADE NOW' ? 'increasing' : 'neutral',
            signal: relevant?.status || 'NEUTRAL',
            entryPoint: relevant?.recommendation || 'Waiting for signal...',
            exitPoint: '5 Ticks',
            distribution: analysis.digitFrequencies || [],
            powerDistribution: (analysis.digitFrequencies || []).reduce((acc: any, curr: any) => {
                acc[curr.digit] = curr.count;
                return acc;
            }, {}),
        };
    };

    const handleStartBot = async (strategy: BotStrategy) => {
        const isAlreadyRunning = activeBots.has(strategy);
        if (isAlreadyRunning) {
            console.log(`[v0] ${strategy} bot is already running`);
            return;
        }

        try {
            if (!apiClient || !isConnected || !isAuthorized) {
                console.error('[v0] Cannot start bot - API not ready');
                return;
            }

            const botConfig = botConfigs.get(strategy);
            if (!botConfig) return;

            if (botConfig.initialStake <= 0) {
                console.error('[v0] Initial stake must be greater than 0');
                return;
            }

            setBotStatus(prev => new Map(prev).set(strategy, 'In Progress'));

            const validatedStake = Math.round(botConfig.initialStake * 100) / 100;
            const autoBotConfig: AutoBotConfig = {
                symbol: symbol,
                historyCount: 1000,
                duration: botConfig.duration,
                durationUnit: 't',
                tpPercent: botConfig.tpPercent,
                slPercent: botConfig.slPercent,
                useMartingale: botConfig.useMartingale,
                martingaleMultiplier: botConfig.martingaleMultiplier,
                cooldownMs: 300,
                maxTradesPerMinute: 120,
                initialStake: validatedStake,
                balance: balance?.amount || 1000,
            };

            console.log(`[v0] Starting ${strategy} bot with config:`, autoBotConfig);

            setBotStates(prev =>
                new Map(prev).set(strategy, {
                    isRunning: true,
                    totalRuns: 0,
                    wins: 0,
                    losses: 0,
                    profitLoss: 0,
                    profitLossPercent: 0,
                    currentStake: validatedStake,
                    consecutiveLosses: 0,
                    trades: [],
                    isAnalyzing: true,
                    isTrading: false,
                    lastTrade: null,
                })
            );

            const newBot = new AutoBot(apiClient, strategy, autoBotConfig);

            await newBot.start(state => {
                console.log(`[v0] ${strategy} bot state updated:`, state);
                setBotStates(prev => new Map(prev).set(strategy, state));

                if (state.isTrading) {
                    setBotStatus(prev => new Map(prev).set(strategy, 'Signal Found - Trading'));
                }

                if (state.lastTrade) {
                    const logEntry: TradeLogEntry = {
                        id: `${strategy}-${Date.now()}`,
                        time: new Date(),
                        strategy: BOT_STRATEGIES.find(s => s.id === strategy)?.name || strategy,
                        contract: state.lastTrade.contractType || 'N/A',
                        predicted: state.lastTrade.prediction || 'N/A',
                        entry: state.lastTrade.entrySpot || 'N/A',
                        exit: state.lastTrade.exitSpot || 'N/A',
                        stake: state.lastTrade.stake || 0,
                        result: state.lastTrade.isWin ? 'win' : 'loss',
                        profitLoss: state.lastTrade.profit || 0,
                    };
                    setTradeLogs(prev => [logEntry, ...prev.slice(0, 99)]);

                    if (
                        state.lastTrade.isWin &&
                        state.profitLoss >= (botConfig.tpPercent / 100) * botConfig.initialStake
                    ) {
                        setTpAmount(state.lastTrade.profit);
                        setShowTPPopup(true);
                    }
                }
            });

            setActiveBots(prev => new Map(prev).set(strategy, newBot));
        } catch (error: any) {
            console.error(`[v0] Error starting ${strategy} bot:`, error);
            setBotStatus(prev => new Map(prev).set(strategy, 'Error'));
        }
    };

    const handleStopBot = (strategy: BotStrategy) => {
        const bot = activeBots.get(strategy);
        if (bot) {
            console.log(`[v0] Stopping ${strategy} bot...`);
            bot.stop();
            setActiveBots(prev => {
                const newMap = new Map(prev);
                newMap.delete(strategy);
                return newMap;
            });
            setBotStates(prev => {
                const newMap = new Map(prev);
                newMap.delete(strategy);
                return newMap;
            });
        }
    };

    const handleEmergencyStopAll = () => {
        console.log('[v0] EMERGENCY STOP ACTIVATED for all bots');
        activeBots.forEach((bot, strategy) => {
            bot.stop();
            console.log(`[v0] Stopped ${strategy} bot during emergency stop.`);
        });
        setActiveBots(new Map());
        setBotStates(new Map());
    };

    const updateBotConfig = (strategy: BotStrategy, updates: Partial<BotConfig>) => {
        setBotConfigs(prev => {
            const newConfigs = new Map(prev);
            const currentConfig = newConfigs.get(strategy) || {
                initialStake: 0.35,
                tpPercent: 10,
                slPercent: 50,
                useMartingale: false,
                martingaleMultiplier: 2,
                duration: 1,
            };
            newConfigs.set(strategy, { ...currentConfig, ...updates });
            return newConfigs;
        });
    };

    return (
        <div
            className={`space-y-2 sm:space-y-6 backdrop-blur-xl ${theme === 'dark' ? 'bg-gradient-to-br from-[#0f1629]/30 via-[#1a2235]/20 to-[#0f1629]/30' : 'bg-gradient-to-br from-blue-50/30 via-white/30 to-purple-50/30'}`}
        >
            {(apiError || (!isConnected && !currentPrice)) && (
                <Card
                    className={`backdrop-blur-lg border-2 transition-all ${theme === 'dark' ? 'bg-red-500/15 border-red-400/40 shadow-lg shadow-red-500/20' : 'bg-red-50/50 border-red-300/50'}`}
                >
                    <CardContent className='p-3 sm:pt-6 flex items-start gap-2 sm:gap-3'>
                        <AlertCircle
                            className={`w-4 h-4 sm:w-5 sm:h-5 shrink-0 ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}
                        />
                        <div>
                            <p
                                className={`text-xs sm:text-base font-semibold ${theme === 'dark' ? 'text-red-400' : 'text-red-700'}`}
                            >
                                Connection issue
                            </p>
                            <p
                                className={`text-[10px] sm:text-sm mt-0.5 sm:mt-1 ${theme === 'dark' ? 'text-red-300' : 'text-red-600'}`}
                            >
                                {apiError || 'Negotiating connection...'}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {isConnected && !isAuthorized && isLoggedIn && (
                <Card
                    className={`backdrop-blur-lg border-2 transition-all ${theme === 'dark' ? 'bg-yellow-500/15 border-yellow-400/40 shadow-lg shadow-yellow-500/20' : 'bg-yellow-50/50 border-yellow-300/50'}`}
                >
                    <CardContent className='p-3 sm:pt-6 flex items-start gap-2 sm:gap-3'>
                        <AlertCircle
                            className={`w-4 h-4 sm:w-5 sm:h-5 shrink-0 ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'}`}
                        />
                        <div>
                            <p
                                className={`text-xs sm:text-base font-semibold ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-700'}`}
                            >
                                Authorization Required
                            </p>
                            <p
                                className={`text-[10px] sm:text-sm mt-0.5 sm:mt-1 ${theme === 'dark' ? 'text-yellow-300' : 'text-yellow-600'}`}
                            >
                                Your session is being authenticated. Trading will be available shortly.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Redundant Market Information and Trading Market cards removed as they are in the header */}

            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                {BOT_STRATEGIES.map(strategy => {
                    const analysis = botAnalysis.get(strategy.id);
                    const isReady = botReadyStatus.get(strategy.id) || false;
                    const botState = botStates.get(strategy.id);
                    const isRunning = activeBots.has(strategy.id);
                    const botConfig = botConfigs.get(strategy.id) || {
                        initialStake: 0.35,
                        tpPercent: 10,
                        slPercent: 50,
                        useMartingale: false,
                        martingaleMultiplier: 2,
                        duration: 1,
                    };
                    const tickData = botTickData.get(strategy.id) || [];
                    const status = botStatus.get(strategy.id) || '';
                    const entryMet = entryPointMet.get(strategy.id) || false;

                    const suggestedMartingale = calculateSuggestedMartingale(strategy.id, botConfig.initialStake);

                    return (
                        <Card
                            key={strategy.id}
                            className={`backdrop-blur-xl border-2 rounded-2xl transition-all duration-300 ${
                                isReady && !isRunning
                                    ? theme === 'dark'
                                        ? 'bg-gradient-to-br from-emerald-600/20 via-emerald-500/10 to-emerald-600/15 border-emerald-400/50 shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/40 scale-105'
                                        : 'bg-gradient-to-br from-emerald-100/50 via-white/50 to-emerald-50/50 border-emerald-400/50 shadow-lg hover:shadow-xl'
                                    : theme === 'dark'
                                      ? 'bg-gradient-to-br from-blue-600/15 via-[#0f1629]/40 to-blue-600/10 border-blue-400/30 shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 hover:border-blue-400/50'
                                      : 'bg-gradient-to-br from-white/50 via-blue-50/30 to-white/40 border-blue-300/50 shadow-sm hover:shadow-md'
                            }`}
                        >
                            <CardHeader className='pb-3'>
                                <div className='flex items-start justify-between'>
                                    <div>
                                        <CardTitle
                                            className={`text-base ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                                        >
                                            {strategy.name}
                                        </CardTitle>
                                        <CardDescription
                                            className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                                        >
                                            {strategy.description}
                                        </CardDescription>
                                        <div
                                            className={`text-[8px] sm:text-xs mt-0.5 sm:mt-1 ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'}`}
                                        >
                                            Ticks: {tickData.length}
                                        </div>
                                    </div>
                                    <div className='flex flex-col gap-1 sm:gap-2'>
                                        {status && (
                                            <Badge
                                                className={`text-[8px] sm:text-[10px] px-1.5 sm:px-2 py-0 sm:py-0.5 ${
                                                    status === 'In Progress'
                                                        ? 'bg-blue-500 text-white'
                                                        : status.includes('Signal Found')
                                                          ? 'bg-yellow-500 text-white animate-pulse'
                                                          : 'bg-gray-500 text-white'
                                                }`}
                                            >
                                                {status}
                                            </Badge>
                                        )}
                                        {isReady && !isRunning && entryMet && (
                                            <Badge className='bg-green-500 text-white animate-pulse'>ENTRY READY</Badge>
                                        )}
                                        {isRunning && (
                                            <Badge className='bg-blue-500 text-white'>
                                                <Activity className='w-3 h-3 mr-1 animate-spin' />
                                                TRADING
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            </CardHeader>

                            <CardContent className='p-3 sm:p-6 sm:pt-0 space-y-2 sm:space-y-4'>
                                {analysis && (
                                    <>
                                        <div
                                            className={`p-2 sm:p-3 rounded-lg ${theme === 'dark' ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-blue-50 border border-blue-200'}`}
                                        >
                                            <div className='flex justify-between items-center mb-1 sm:mb-2'>
                                                <span
                                                    className={`text-xs sm:text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                                                >
                                                    {(analysis.marketPower || 0).toFixed(1)}%
                                                </span>
                                            </div>
                                            <Progress
                                                value={analysis.marketPower}
                                                className={`h-1 sm:h-2 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}
                                            />
                                        </div>

                                        {analysis.powerDistribution && (
                                            <div
                                                className={`p-2 sm:p-3 rounded-lg ${theme === 'dark' ? 'bg-purple-500/10 border border-purple-500/30' : 'bg-purple-50 border border-purple-200'}`}
                                            >
                                                <div
                                                    className={`text-[10px] sm:text-xs font-semibold mb-1 sm:mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                                                >
                                                    Digit Distribution
                                                </div>
                                                <div className='grid grid-cols-5 gap-1'>
                                                    {Object.entries(analysis.powerDistribution).map(
                                                        ([digit, count]) => {
                                                            const d = Number(digit);
                                                            const c = count as number;
                                                            const sortedByCount = Object.entries(
                                                                analysis.powerDistribution
                                                            ).sort((a, b) => (b[1] as number) - (a[1] as number));
                                                            const mostAppearing = Number(sortedByCount[0]?.[0]);
                                                            const secondMost = Number(sortedByCount[1]?.[0]);
                                                            const leastAppearing = Number(
                                                                sortedByCount[sortedByCount.length - 1]?.[0]
                                                            );

                                                            let colorClass =
                                                                theme === 'dark' ? 'text-white' : 'text-gray-900';
                                                            let bgClass = '';
                                                            if (d === currentLastDigit) {
                                                                colorClass = 'text-yellow-500 font-extrabold';
                                                                bgClass = 'bg-yellow-500/20';
                                                            } else if (d === mostAppearing) {
                                                                colorClass = 'text-green-400 font-bold';
                                                                bgClass = 'bg-green-500/10';
                                                            } else if (d === secondMost) {
                                                                colorClass = 'text-blue-400 font-bold';
                                                                bgClass = 'bg-blue-500/10';
                                                            } else if (d === leastAppearing) {
                                                                colorClass = 'text-red-400 font-bold';
                                                                bgClass = 'bg-red-500/10';
                                                            }

                                                            return (
                                                                <div
                                                                    key={d}
                                                                    className={`text-center p-0.5 sm:p-1 rounded ${bgClass}`}
                                                                >
                                                                    <div
                                                                        className={`text-[8px] sm:text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}
                                                                    >
                                                                        {d}
                                                                    </div>
                                                                    <div
                                                                        className={`text-[8px] sm:text-xs ${colorClass}`}
                                                                    >
                                                                        {c}
                                                                    </div>
                                                                </div>
                                                            );
                                                        }
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        <div
                                            className={`p-2 sm:p-3 rounded-lg text-[10px] sm:text-xs ${theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-gray-50 border border-gray-200'}`}
                                        >
                                            <div
                                                className={`font-semibold mb-0.5 sm:mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                                            >
                                                Signal:{' '}
                                                <span
                                                    className={
                                                        analysis.signal === 'TRADE NOW'
                                                            ? 'text-green-400'
                                                            : analysis.signal === 'WAIT'
                                                              ? 'text-blue-400'
                                                              : 'text-gray-400'
                                                    }
                                                >
                                                    {analysis.signal}
                                                </span>
                                            </div>
                                            <div className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                                                Entry: {analysis.entryPoint || 'N/A'}
                                            </div>
                                            <div className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                                                Exit: {analysis.exitPoint || 'N/A'}
                                            </div>
                                        </div>
                                    </>
                                )}

                                {!isRunning && (
                                    <div className='space-y-1.5 sm:space-y-2 pt-1.5 sm:pt-2 border-t border-gray-700'>
                                        <div className='grid grid-cols-2 gap-2'>
                                            <div>
                                                <Label
                                                    className={`text-[10px] sm:text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                                                >
                                                    Stake ($)
                                                </Label>
                                                <Input
                                                    type='number'
                                                    value={botConfig.initialStake}
                                                    onChange={e => {
                                                        const val = Number.parseFloat(e.target.value);
                                                        if (!isNaN(val))
                                                            updateBotConfig(strategy.id, {
                                                                initialStake: Math.round(val * 100) / 100,
                                                            });
                                                    }}
                                                    className={`h-7 sm:h-8 text-[10px] sm:text-xs ${theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : ''}`}
                                                    step='0.01'
                                                    min='0.01'
                                                />
                                            </div>
                                            <div>
                                                <Label
                                                    className={`text-[10px] sm:text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                                                >
                                                    Ticks
                                                </Label>
                                                <Input
                                                    type='number'
                                                    value={botConfig.duration}
                                                    onChange={e =>
                                                        updateBotConfig(strategy.id, {
                                                            duration: Number.parseInt(e.target.value),
                                                        })
                                                    }
                                                    className={`h-7 sm:h-8 text-[10px] sm:text-xs ${theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : ''}`}
                                                    min='1'
                                                />
                                            </div>
                                        </div>
                                        <div className='flex items-center justify-between gap-2'>
                                            <div className='flex items-center gap-2'>
                                                <Switch
                                                    checked={botConfig.useMartingale}
                                                    onCheckedChange={checked => {
                                                        updateBotConfig(strategy.id, { useMartingale: checked });
                                                        setShowMartingaleConfig(prev =>
                                                            new Map(prev).set(strategy.id, checked)
                                                        );
                                                    }}
                                                    className='scale-75'
                                                />
                                                <Label
                                                    className={`text-[10px] sm:text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                                                >
                                                    M. Multiplier
                                                </Label>
                                            </div>
                                            <Input
                                                type='number'
                                                step='0.1'
                                                value={botConfig.martingaleMultiplier}
                                                onChange={e =>
                                                    updateBotConfig(strategy.id, {
                                                        martingaleMultiplier: Number.parseFloat(e.target.value),
                                                    })
                                                }
                                                disabled={!botConfig.useMartingale}
                                                className={`h-7 sm:h-8 text-[10px] sm:text-xs w-20 ${theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : ''}`}
                                                min='1.1'
                                            />
                                        </div>
                                    </div>
                                )}

                                {botState && (
                                    <div className='grid grid-cols-2 gap-2 mt-2'>
                                        <div
                                            className={`p-1.5 sm:p-2 rounded-lg text-center ${theme === 'dark' ? 'bg-green-500/10' : 'bg-green-50'}`}
                                        >
                                            <div
                                                className={`text-[8px] sm:text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                                            >
                                                Wins
                                            </div>
                                            <div
                                                className={`text-base sm:text-lg font-bold ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}
                                            >
                                                {botState.wins}
                                            </div>
                                        </div>
                                        <div
                                            className={`p-1.5 sm:p-2 rounded-lg text-center ${theme === 'dark' ? 'bg-red-500/10' : 'bg-red-50'}`}
                                        >
                                            <div
                                                className={`text-[8px] sm:text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                                            >
                                                Losses
                                            </div>
                                            <div
                                                className={`text-base sm:text-lg font-bold ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}
                                            >
                                                {botState.losses}
                                            </div>
                                        </div>
                                        <div
                                            className={`col-span-2 p-1.5 sm:p-2 rounded-lg text-center ${botState.profitLoss >= 0 ? (theme === 'dark' ? 'bg-green-500/10' : 'bg-green-50') : theme === 'dark' ? 'bg-red-500/10' : 'bg-red-50'}`}
                                        >
                                            <div
                                                className={`text-base sm:text-lg font-bold ${botState.profitLoss >= 0 ? (theme === 'dark' ? 'text-green-400' : 'text-green-600') : theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}
                                            >
                                                ${(botState.profitLoss || 0).toFixed(2)}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className='pt-2'>
                                    {isRunning ? (
                                        <Button
                                            onClick={() => handleStopBot(strategy.id)}
                                            variant='destructive'
                                            className='w-full gap-2 h-8 sm:h-10 text-[10px] sm:text-xs'
                                            size='sm'
                                        >
                                            <Square className='w-3 h-3 sm:w-4 sm:h-4' /> Stop
                                        </Button>
                                    ) : (
                                        <Button
                                            onClick={() => handleStartBot(strategy.id)}
                                            className={`w-full gap-2 h-8 sm:h-10 text-[10px] sm:text-xs ${isReady ? 'bg-green-500 hover:bg-green-600 animate-pulse' : 'bg-blue-500 hover:bg-blue-600'}`}
                                            disabled={!isConnected || !isAuthorized || tickData.length < 25}
                                            size='sm'
                                        >
                                            <Play className='w-3 h-3 sm:w-4 sm:h-4' />
                                            {tickData.length < 25
                                                ? `Loading... (${tickData.length}/25)`
                                                : isReady
                                                  ? 'Start Trading'
                                                  : 'Start'}
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {tradeLogs.length > 0 && (
                <Card
                    className={`border ${
                        theme === 'dark'
                            ? 'bg-linear-to-br from-[#0f1629]/80 to-[#1a2235]/80 border-purple-500/20'
                            : 'bg-white border-gray-200'
                    }`}
                >
                    <CardHeader>
                        <CardTitle className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>Trade Log</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className='overflow-x-auto'>
                            <table className='w-full'>
                                <thead>
                                    <tr
                                        className={`border-b ${theme === 'dark' ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-600'}`}
                                    >
                                        <th className='text-left py-3 px-2 text-xs font-medium'>Time</th>
                                        <th className='text-left py-3 px-2 text-xs font-medium'>Strategy</th>
                                        <th className='text-left py-3 px-2 text-xs font-medium'>Contract</th>
                                        <th className='text-left py-3 px-2 text-xs font-medium'>Predicted</th>
                                        <th className='text-left py-3 px-2 text-xs font-medium'>Entry</th>
                                        <th className='text-left py-3 px-2 text-xs font-medium'>Exit</th>
                                        <th className='text-left py-3 px-2 text-xs font-medium'>Stake</th>
                                        <th className='text-left py-3 px-2 text-xs font-medium'>Result</th>
                                        <th className='text-right py-3 px-2 text-xs font-medium'>P/L</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tradeLogs.map(trade => (
                                        <tr
                                            key={trade.id}
                                            className={`border-b ${theme === 'dark' ? 'border-gray-800 hover:bg-gray-800/30' : 'border-gray-100 hover:bg-gray-50'}`}
                                        >
                                            <td
                                                className={`py-3 px-2 text-xs ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
                                            >
                                                {trade.time.toLocaleTimeString()}
                                            </td>
                                            <td
                                                className={`py-3 px-2 text-xs ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
                                            >
                                                {trade.strategy}
                                            </td>
                                            <td
                                                className={`py-3 px-2 text-xs ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
                                            >
                                                {trade.contract}
                                            </td>
                                            <td
                                                className={`py-3 px-2 text-xs ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}
                                            >
                                                {trade.predicted}
                                            </td>
                                            <td
                                                className={`py-3 px-2 text-xs font-mono ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                                            >
                                                {trade.entry}
                                            </td>
                                            <td
                                                className={`py-3 px-2 text-xs font-mono ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                                            >
                                                {trade.exit}
                                            </td>
                                            <td
                                                className={`py-3 px-2 text-xs ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
                                            >
                                                ${(trade.stake || 0).toFixed(2)}
                                            </td>
                                            <td className='py-3 px-2'>
                                                <Badge
                                                    className={`text-xs ${
                                                        trade.result === 'win'
                                                            ? theme === 'dark'
                                                                ? 'bg-green-500/20 text-green-400 border-green-500/30'
                                                                : 'bg-green-100 text-green-700 border-green-200'
                                                            : theme === 'dark'
                                                              ? 'bg-red-500/20 text-red-400 border-red-500/30'
                                                              : 'bg-red-100 text-red-700 border-red-200'
                                                    }`}
                                                >
                                                    {trade.result.toUpperCase()}
                                                </Badge>
                                            </td>
                                            <td
                                                className={`py-3 px-2 text-xs font-bold text-right ${
                                                    trade.profitLoss >= 0
                                                        ? theme === 'dark'
                                                            ? 'text-green-400'
                                                            : 'text-green-600'
                                                        : theme === 'dark'
                                                          ? 'text-red-400'
                                                          : 'text-red-600'
                                                }`}
                                            >
                                                {trade.profitLoss >= 0 ? '+' : ''}${(trade.profitLoss || 0).toFixed(2)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {showTPPopup && (
                <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm'>
                    <div className='max-w-md w-full bg-linear-to-br from-green-900/95 to-emerald-900/95 rounded-2xl border-2 border-green-500 shadow-[0_0_50px_rgba(34,197,94,0.5)] p-8'>
                        <div className='text-center space-y-4'>
                            <div className='text-6xl animate-bounce'>🎉</div>
                            <h2 className='text-3xl font-bold text-white'>Congratulations!</h2>
                            <p className='text-green-300 text-lg'>Target Profit Achieved!</p>

                            <div className='bg-white/10 rounded-lg p-6 space-y-3'>
                                <div className='flex items-center justify-center gap-2'>
                                    <DollarSign className='h-6 w-6 text-green-400' />
                                    <span className='text-4xl font-bold text-white'>${(tpAmount || 0).toFixed(2)}</span>
                                </div>
                                <div className='text-sm text-gray-300'>USD</div>

                                <div className='border-t border-white/20 pt-3'>
                                    <div className='text-2xl font-bold text-green-400'>
                                        KES {((tpAmount || 0) * (USD_TO_KES_RATE || 129.5)).toFixed(2)}
                                    </div>
                                    <div className='text-xs text-gray-400 mt-1'>
                                        (Conversion rate: 1 USD = {USD_TO_KES_RATE} KES)
                                    </div>
                                </div>
                            </div>

                            <Button
                                onClick={() => setShowTPPopup(false)}
                                className='w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3'
                            >
                                Continue Trading
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
