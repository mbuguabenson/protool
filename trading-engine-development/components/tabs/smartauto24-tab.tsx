'use client';

import { useState, useRef, useEffect } from 'react';
import { useDerivAPI } from '@/lib/deriv-api-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Play, Pause, Zap, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { DerivRealTrader } from '@/lib/deriv-real-trader';
import { EvenOddStrategy } from '@/lib/even-odd-strategy';
import { TradingJournal } from '@/lib/trading-journal';
import { TradeResultModal } from '@/components/modals/trade-result-modal';
import { AnalysisEngine, type Signal, type AnalysisResult } from '@/lib/analysis-engine';
import { TradingStatsPanel } from '@/components/trading-stats-panel';
import { TransactionHistory } from '@/components/transaction-history';
import { TradingJournalPanel } from '@/components/trading-journal-panel';
import { TradeLog } from '@/components/trade-log';
import { SmartAuto24Engine } from '@/lib/smartauto24-engine-integration';
import { useSmartAuto24 } from '@/hooks/use-smartauto24';
import type { BotSignal } from '@/lib/bot-engines';

interface AnalysisLogEntry {
    timestamp: Date;
    message: string;
    type: 'info' | 'success' | 'warning';
}

interface BotStats {
    totalWins: number;
    totalLosses: number;
    totalProfit: number;
    winRate: number;
    totalStake: number;
    totalPayout: number;
    numberOfRuns: number;
    contractsLost: number;
    contractsWon: number;
}

interface SmartAuto24TabProps {
    theme: 'light' | 'dark';
    symbol: string;
    onSymbolChange: (symbol: string) => void;
    availableSymbols?: any[];
    currentPrice?: number | null;
    currentDigit?: number | null;
    tickCount?: number;
    maxTicks?: number;
    onMaxTicksChange?: (ticks: number) => void;
}

export function SmartAuto24Tab({
    theme,
    symbol,
    onSymbolChange,
    availableSymbols,
    currentPrice,
    currentDigit,
    tickCount,
    maxTicks = 100,
    onMaxTicksChange,
}: SmartAuto24TabProps) {
    const { apiClient, isConnected, isAuthorized, balance, isLoggedIn, submitApiToken, token } = useDerivAPI();

    const [allMarkets, setAllMarkets] = useState<Array<{ symbol: string; display_name: string }>>([]);
    const [loadingMarkets, setLoadingMarkets] = useState(true);

    // Configuration state
    const [stake, setStake] = useState('0.35');
    const [targetProfit, setTargetProfit] = useState('1');
    const [analysisTimeMinutes, setAnalysisTimeMinutes] = useState('30');
    const [ticksForEntry, setTicksForEntry] = useState('36000');
    const [strategies] = useState<string[]>(['Even/Odd', 'Over/Under', 'Differs', 'Matches']);
    const [selectedStrategy, setSelectedStrategy] = useState('Even/Odd');
    const strategiesRef = useRef<AnalysisEngine>(new AnalysisEngine());

    const [martingaleRatios, setMartingaleRatios] = useState<Record<string, number>>({
        'Even/Odd': 2.0,
        'Over/Under': 2.6,
        Differs: 2.3,
        Matches: 1.8,
    });

    const [ticksPerTrade, setTicksPerTrade] = useState<number>(1);

    // Trading state
    const [isRunning, setIsRunning] = useState(false);
    const [status, setStatus] = useState<'idle' | 'trading' | 'completed'>('idle');
    const [sessionProfit, setSessionProfit] = useState(0);
    const [sessionTrades, setSessionTrades] = useState(0);
    const [analysisLog, setAnalysisLog] = useState<AnalysisLogEntry[]>([]);

    const [marketPrice, setMarketPrice] = useState<number | null>(null);
    const [lastDigit, setLastDigit] = useState<number | null>(null);

    // Analysis data
    const [digitFrequencies, setDigitFrequencies] = useState<number[]>(Array(10).fill(0));
    const [overUnderAnalysis, setOverUnderAnalysis] = useState({ over: 0, under: 0, total: 0 });
    const [ticksCollected, setTicksCollected] = useState(0);
    const [analysisData, setAnalysisData] = useState<any>(null);
    const [showAnalysisResults, setShowAnalysisResults] = useState(false);
    const [recentDigits, setRecentDigits] = useState<number[]>([]);

    const [differsWaitTicks, setDiffersWaitTicks] = useState(0);
    const [differsSelectedDigit, setDiffersSelectedDigit] = useState<number | null>(null);
    const [differsWaitingForEntry, setDiffersWaitingForEntry] = useState(false);
    const [differsTicksSinceAppearance, setDiffersTicksSinceAppearance] = useState(0);

    const [stats, setStats] = useState<BotStats>({
        totalWins: 0,
        totalLosses: 0,
        totalProfit: 0,
        winRate: 0,
        totalStake: 0,
        totalPayout: 0,
        numberOfRuns: 0,
        contractsLost: 0,
        contractsWon: 0,
    });

    const [tradeHistory, setTradeHistory] = useState<any[]>([]);
    const [journalLog, setJournalLog] = useState<any[]>([]);

    // Refs
    const traderRef = useRef<DerivRealTrader | null>(null);
    const strategyRef = useRef<EvenOddStrategy>(new EvenOddStrategy());
    const journalRef = useRef<TradingJournal>(new TradingJournal('smartauto24'));
    const analysisIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const lastDigitWasEvenRef = useRef<boolean | null>(null);
    const differsWaitingForEntryRef = useRef(false);
    const differsSelectedDigitRef = useRef<number | null>(null);

    // SmartAuto24 Engine
    const {
        engineRef,
        currentDigit: engineDigit,
        snapshot: engineSnapshot,
        signals: engineSignals,
        setPipSize,
        processTick: engineProcessTick,
        reset: resetEngine,
        marketScores,
    } = useSmartAuto24(symbol, isConnected, maxTicks);

    // Modal state
    const [showResultModal, setShowResultModal] = useState(false);
    const [resultType, setResultType] = useState<'tp' | 'sl'>('tp');
    const [resultAmount, setResultAmount] = useState(0);

    // New state for stop loss and take profit popups
    const [showTPPopup, setShowTPPopup] = useState(false);
    const [tpAmount, setTpAmount] = useState(0);
    const [showSLPopup, setShowSLPopup] = useState(false);
    const [slAmount, setSlAmount] = useState(0);

    // New state for consecutive digit tracking
    const [consecutiveEvenCount, setConsecutiveEvenCount] = useState(0);
    const [consecutiveOddCount, setConsecutiveOddCount] = useState(0);
    const [lastDigitWasEven, setLastDigitWasEven] = useState<boolean | null>(null);
    const [marketSuggestions, setMarketSuggestions] = useState<Signal[]>([]);

    // Refs for real-time trading logic
    const isRunningRef = useRef(false);
    const statusRef = useRef<'idle' | 'trading' | 'completed'>('idle');
    const entryPointMetRef = useRef(false);
    const selectedStrategyRef = useRef('Even/Odd');
    const analysisRef = useRef<any>(null);
    const consecutiveEvenCountRef = useRef(0);
    const consecutiveOddCountRef = useRef(0);
    const lastDigitRef = useRef<number | null>(null);
    const marketPriceRef = useRef<number | null>(null);
    const isExecutingTradeRef = useRef(false);
    const contractsLostRef = useRef(0);

    // New state for stop loss percentage
    const [stopLossPercent, setStopLossPercent] = useState('50');

    // New state for 24h AutoPilot
    const [isAutoPilotEnabled, setIsAutoPilotEnabled] = useState(false);
    const [isAutoMarketSwitchEnabled, setIsAutoMarketSwitchEnabled] = useState(false);
    const isAutoPilotEnabledRef = useRef(false);
    const isAutoMarketSwitchEnabledRef = useRef(false);
    const marketScoresRef = useRef(marketScores);

    // Sync refs with state for use in stable tick callback
    useEffect(() => {
        isRunningRef.current = isRunning;
    }, [isRunning]);
    useEffect(() => {
        statusRef.current = status;
    }, [status]);
    useEffect(() => {
        selectedStrategyRef.current = selectedStrategy;
    }, [selectedStrategy]);
    useEffect(() => {
        lastDigitRef.current = lastDigit;
    }, [lastDigit]);
    useEffect(() => {
        marketPriceRef.current = marketPrice;
    }, [marketPrice]);
    useEffect(() => {
        consecutiveEvenCountRef.current = consecutiveEvenCount;
    }, [consecutiveEvenCount]);
    useEffect(() => {
        consecutiveOddCountRef.current = consecutiveOddCount;
    }, [consecutiveOddCount]);
    useEffect(() => {
        contractsLostRef.current = stats.contractsLost;
    }, [stats.contractsLost]);
    useEffect(() => {
        lastDigitWasEvenRef.current = lastDigitWasEven;
    }, [lastDigitWasEven]);
    useEffect(() => {
        differsWaitingForEntryRef.current = differsWaitingForEntry;
    }, [differsWaitingForEntry]);
    useEffect(() => {
        differsSelectedDigitRef.current = differsSelectedDigit;
    }, [differsSelectedDigit]);
    useEffect(() => {
        isAutoPilotEnabledRef.current = isAutoPilotEnabled;
    }, [isAutoPilotEnabled]);
    useEffect(() => {
        isAutoMarketSwitchEnabledRef.current = isAutoMarketSwitchEnabled;
    }, [isAutoMarketSwitchEnabled]);
    useEffect(() => {
        marketScoresRef.current = marketScores;
    }, [marketScores]);

    useEffect(() => {
        if (!apiClient || !isConnected || !isAuthorized) return;

        const loadMarkets = async () => {
            try {
                setLoadingMarkets(true);
                const symbols = await apiClient.getActiveSymbols();
                setAllMarkets(symbols);
                console.log('[v0] Loaded all markets:', symbols.length);
            } catch (error) {
                console.error('[v0] Failed to load markets:', error);
            } finally {
                setLoadingMarkets(false);
            }
        };

        loadMarkets();
    }, [apiClient, isConnected, isAuthorized]);

    useEffect(() => {
        if (!apiClient || !isConnected || !symbol) return;

        let tickSubscriptionId: string | null = null;
        const tickHandler = (tick: any) => {
            setMarketPrice(tick.quote);

            // Feed the analysis engine
            if (strategiesRef.current) {
                strategiesRef.current.addTick({
                    epoch: tick.epoch,
                    quote: tick.quote,
                    symbol: symbol,
                    pipSize: apiClient?.getPipSize(symbol) || 2,
                });
            }

            // Extract last digit properly using unified engine logic
            const pipSize = apiClient?.getPipSize(symbol) || 2;
            const lastDigitValue = strategiesRef.current.extractLastDigit(tick.quote, pipSize);
            setLastDigit(lastDigitValue);

            // Process through SmartAuto24 engine
            if (isRunning) {
                setPipSize(pipSize);
                engineProcessTick(tick.quote);
            }

            const isEven = lastDigitValue % 2 === 0;
            const currentLastDigitWasEven = lastDigitWasEvenRef.current;
            if (currentLastDigitWasEven === null) {
                setLastDigitWasEven(isEven);
            } else if (currentLastDigitWasEven === isEven) {
                // Same parity continues
                if (isEven) {
                    setConsecutiveEvenCount(prev => prev + 1);
                    setConsecutiveOddCount(0);
                } else {
                    setConsecutiveOddCount(prev => prev + 1);
                    setConsecutiveEvenCount(0);
                }
            } else {
                // Parity changed
                if (isEven) {
                    setConsecutiveEvenCount(1);
                } else {
                    setConsecutiveOddCount(1);
                }
            }
            setLastDigitWasEven(isEven);

            // Update digit frequencies
            setDigitFrequencies(prev => {
                const newFreq = [...prev];
                newFreq[lastDigitValue]++;
                return newFreq;
            });

            // Update recent digits history
            setRecentDigits(prev => {
                const updated = [...prev, lastDigitValue];
                return updated.slice(-15);
            });

            // Update over/under
            setOverUnderAnalysis(prev => {
                const isOver = lastDigitValue >= 5;
                return {
                    over: prev.over + (isOver ? 1 : 0),
                    under: prev.under + (isOver ? 0 : 1),
                    total: prev.total + 1,
                };
            });

            setTicksCollected(prev => prev + 1);

            if (differsWaitingForEntryRef.current && differsSelectedDigitRef.current !== null) {
                if (lastDigitValue === differsSelectedDigitRef.current) {
                    // Reset if selected digit appears
                    setDiffersTicksSinceAppearance(0);
                } else {
                    // Increment ticks since appearance
                    setDiffersTicksSinceAppearance(prev => prev + 1);
                }

                if (differsTicksSinceAppearance >= 3) {
                    differsWaitingForEntryRef.current = false;
                    setDiffersWaitingForEntry(false);
                    addAnalysisLog(
                        `Target digit ${differsSelectedDigitRef.current} hasn't appeared for 3 ticks. Taking entry!`,
                        'success'
                    );
                    startDiffersTrades(analysisRef.current);
                }
            }

            // REAL-TIME ENTRY DETECTION
            if (
                isRunningRef.current &&
                statusRef.current === 'trading' &&
                !entryPointMetRef.current &&
                !isExecutingTradeRef.current
            ) {
                // If analysis is already set (e.g. Differs waiting room), use it
                if (analysisRef.current) {
                    const currentAnalysis = analysisRef.current;
                    if (currentAnalysis.strategy !== 'Differs') {
                        // Ensure we execute right away if not Differs
                        entryPointMetRef.current = true;
                        performTrade(currentAnalysis);
                    }
                } else {
                    // Otherwise constantly hunt for new signals
                    checkInstantSignals();
                }
            }
        };

        const subscribeTicks = async () => {
            try {
                tickSubscriptionId = await apiClient.subscribeTicks(symbol, tickHandler);
            } catch (error) {
                console.error('[v0] Failed to subscribe to ticks:', error);
            }
        };

        subscribeTicks();

        return () => {
            if (tickSubscriptionId) {
                apiClient.forget(tickSubscriptionId, tickHandler).catch(err => console.log('[v0] Forget error:', err));
            }
        };
    }, [apiClient, isConnected, symbol]);

    const addAnalysisLog = (message: string, type: 'info' | 'success' | 'warning' = 'info') => {
        setAnalysisLog(prev => [
            {
                timestamp: new Date(),
                message,
                type,
            },
            ...prev.slice(0, 99),
        ]);
    };

    const handleStartTrading = async () => {
        if (!isLoggedIn || !apiClient || !isConnected) {
            addAnalysisLog('Not logged in or API not ready', 'warning');
            return;
        }

        setIsRunning(true);
        setStatus('trading');
        setDigitFrequencies(Array(10).fill(0));
        setOverUnderAnalysis({ over: 0, under: 0, total: 0 });
        setTicksCollected(0);
        setAnalysisLog([]);
        entryPointMetRef.current = false;
        isExecutingTradeRef.current = false;

        // Reset Differs strategy state
        setDiffersSelectedDigit(null);
        setDiffersWaitingForEntry(false);
        setDiffersTicksSinceAppearance(0);

        addAnalysisLog(`Automated scanning started on ${symbol}. Waiting for High-Probability Signal...`, 'info');

        // Initialize trader
        if (!traderRef.current) {
            traderRef.current = new DerivRealTrader(apiClient);
        }

        // Check for immediate signals
        checkInstantSignals();
    };

    const checkInstantSignals = () => {
        // Don't process new signals if we are already executing a trade or not running
        if (isExecutingTradeRef.current || !isRunningRef.current || statusRef.current !== 'trading') return;

        // Don't trade blindly: require at least 15 ticks of analysis
        if (ticksCollected < 15) {
            if (ticksCollected === 1)
                addAnalysisLog('Gathering pattern data (15 ticks minimum). Please wait...', 'info');
            return;
        }

        // Generate all strategy signals from the collected ticks
        const signals = strategiesRef.current.generateSignals();
        let validSignals = signals.filter(s => s.status === 'TRADE NOW' && s.probability >= 58);

        // If AutoPilot is OFF, respect the user's strategy choice
        if (!isAutoPilotEnabledRef.current) {
            const strategyMap: Record<string, string> = {
                'Even/Odd': 'even_odd',
                'Over/Under': 'over_under',
                Differs: 'differs',
                Matches: 'matches',
            };
            const allowedType = strategyMap[selectedStrategyRef.current];
            validSignals = validSignals.filter(s => s.type === allowedType);
        }

        if (validSignals.length > 0) {
            // Select the strongest signal
            const bestSignal = [...validSignals].sort((a, b) => b.probability - a.probability)[0];

            if (!entryPointMetRef.current) {
                entryPointMetRef.current = true;

                // Map to strategy name
                const typeToStrat: Record<string, string> = {
                    even_odd: 'Even/Odd',
                    over_under: 'Over/Under',
                    differs: 'Differs',
                    matches: 'Matches',
                };
                const strategyName = typeToStrat[bestSignal.type] || 'Even/Odd';

                addAnalysisLog(
                    `High Probability Signal Detected: ${strategyName} (${bestSignal.probability.toFixed(1)}%)`,
                    'success'
                );

                // Determine exact signal code (EVEN, ODD, OVER, UNDER, etc.)
                let analysisCode = 'DIGIT';
                if (bestSignal.recommendation?.includes('EVEN')) analysisCode = 'EVEN';
                if (bestSignal.recommendation?.includes('ODD')) analysisCode = 'ODD';
                if (bestSignal.recommendation?.includes('OVER')) analysisCode = 'OVER';
                if (bestSignal.recommendation?.includes('UNDER')) analysisCode = 'UNDER';
                if (bestSignal.recommendation?.includes('DIFFER')) analysisCode = 'DIFFERS';
                if (bestSignal.recommendation?.includes('MATCH')) analysisCode = 'MATCH';

                handleSelectInstantSuggestion({
                    strategy: strategyName,
                    confidence: bestSignal.probability,
                    type: analysisCode,
                    barrier: bestSignal.targetDigit,
                    description: bestSignal.recommendation,
                });
            }
        }
    };

    const handleSelectInstantSuggestion = (signal: any) => {
        const strategyName = signal.strategy;
        setSelectedStrategy(strategyName);
        addAnalysisLog(
            `Executing ${strategyName} on ${symbol}... Prediction Details: ${signal.type} ${signal.barrier !== undefined ? signal.barrier : ''}`,
            'info'
        );

        let analysisSignalCode = signal.type;

        if (strategyName === 'Differs') {
            setDiffersSelectedDigit(Number(signal.barrier));
            setDiffersWaitingForEntry(true);
            setDiffersTicksSinceAppearance(0);
            addAnalysisLog(`Waiting for digit ${signal.barrier} to disappear for 3 consecutive ticks...`, 'warning');
        }

        const executionAnalysis = {
            strategy: strategyName,
            power: signal.confidence,
            signal: analysisSignalCode,
            confidence: signal.confidence,
            description: signal.description,
            status: 'TRADE NOW',
            targetDigit: signal.barrier !== undefined ? Number(signal.barrier) : undefined,
        };

        setAnalysisData({
            ...executionAnalysis,
            digitFrequencies,
            ticksCollected,
        });

        analysisRef.current = executionAnalysis;

        // For Differs, we wait for 3 ticks without the digit.
        // For others, execute right away.
        if (strategyName !== 'Differs') {
            executeTrades(executionAnalysis);
            performTrade(executionAnalysis);
        }
    };

    const handleSelectSuggestion = (signal: Signal) => {
        // Map signal type to strategy name
        const strategyMap: Record<string, string> = {
            even_odd: 'Even/Odd',
            over_under: 'Over/Under',
            differs: 'Differs',
            matches: 'Matches',
        };

        const strategyName = strategyMap[signal.type];
        if (strategyName) {
            setSelectedStrategy(strategyName);
            addAnalysisLog(`Selected suggestion: ${strategyName}. Configuring bot parameters...`, 'info');

            // Special setup for specific strategies
            if (signal.type === 'differs' && signal.targetDigit !== undefined) {
                setDiffersSelectedDigit(signal.targetDigit);
                setDiffersWaitingForEntry(true);
                setDiffersTicksSinceAppearance(0);
            }

            // Convert signal to internal analysis format for executeTrades
            const executionAnalysis = {
                strategy: strategyName,
                power: signal.probability,
                signal:
                    signal.type === 'even_odd'
                        ? strategiesRef.current.getAnalysis().evenPercentage >
                          strategiesRef.current.getAnalysis().oddPercentage
                            ? 'EVEN'
                            : 'ODD'
                        : signal.type === 'over_under'
                          ? strategiesRef.current.getAnalysis().highPercentage >
                            strategiesRef.current.getAnalysis().lowPercentage
                              ? 'OVER'
                              : 'UNDER'
                          : signal.type.toUpperCase(),
                confidence: signal.probability,
                description: signal.recommendation,
                status: signal.status,
                targetDigit: signal.targetDigit,
            };

            setAnalysisData({
                ...executionAnalysis,
                digitFrequencies,
                ticksCollected,
            });
            analysisRef.current = executionAnalysis;
            entryPointMetRef.current = false;

            setIsRunning(true);
            setStatus('trading');
            addAnalysisLog(`Starting ${strategyName} bot...`, 'success');

            // executeTrades now just initializes the trader if needed and sets the running state
            executeTrades(executionAnalysis);
        }
    };

    const startDiffersTrades = (analysis: any) => {
        executeTrades(analysis);
        performTrade(analysis);
    };

    const executeTrades = (analysis: any) => {
        // This function now just ensures the trader is ready and clears any previous intervals
        if (analysisIntervalRef.current) clearInterval(analysisIntervalRef.current);

        // We don't need the interval for entry point anymore!
        // But we might want an interval for status checks or heartbeats if necessary.
        // For now, let's keep it simple.
    };

    const performTrade = async (analysis: any) => {
        if (isExecutingTradeRef.current || !traderRef.current) return;
        isExecutingTradeRef.current = true;
        analysisRef.current = null; // Clear the signal so we don't trade repeatedly on the same signal

        try {
            let contractType: string;
            let barrier: string | undefined = undefined;

            const strat = selectedStrategyRef.current;

            if (strat === 'Differs' && differsSelectedDigitRef.current !== null) {
                contractType = 'DIGITDIFF';
                barrier = differsSelectedDigitRef.current.toString();
            } else if (strat === 'Even/Odd') {
                contractType = analysis.signal === 'EVEN' ? 'DIGITEVEN' : 'DIGITODD';
            } else if (strat === 'Over/Under') {
                const isOver = analysis.signal === 'OVER' || analysis.signal.includes('OVER');
                contractType = isOver ? 'DIGITOVER' : 'DIGITUNDER';
                if (isOver) {
                    barrier = analysis.description.includes('Over 3')
                        ? '3'
                        : analysis.description.includes('Over 2')
                          ? '2'
                          : '1';
                } else {
                    barrier = analysis.description.includes('Under 6')
                        ? '6'
                        : analysis.description.includes('Under 7')
                          ? '7'
                          : '8';
                }
            } else {
                contractType = 'DIGITMATCH';
                barrier = analysis.targetDigit?.toString();
            }

            const currentLosses = contractsLostRef.current;

            const martingaleMultiplier = martingaleRatios[strat] || 2.0;
            const baseStake = Number.parseFloat(stake);
            const currentCalculatedStake =
                currentLosses > 0 ? baseStake * Math.pow(martingaleMultiplier, currentLosses) : baseStake;

            const adjustedStake = Math.min(
                Math.round(currentCalculatedStake * 100) / 100,
                balance?.amount ? balance.amount * 0.5 : 1000
            );

            addAnalysisLog(
                `EXECUTING REAL-TIME TRADE: ${contractType} ${barrier || ''} at $${adjustedStake}...`,
                'info'
            );

            const tradeConfig: any = {
                symbol: symbol,
                contractType: contractType,
                stake: adjustedStake.toFixed(2),
                duration: ticksPerTrade,
                durationUnit: 't',
            };

            if (barrier !== undefined) {
                tradeConfig.barrier = barrier;
            }

            const result = await traderRef.current.executeTrade(tradeConfig);

            if (result) {
                setSessionTrades(prev => prev + 1);
                setSessionProfit(traderRef.current!.getTotalProfit());

                setStats(prev => {
                    const newStats = { ...prev };
                    newStats.numberOfRuns++;
                    newStats.totalStake += adjustedStake;

                    if (result.isWin) {
                        newStats.totalWins++;
                        newStats.contractsWon++;
                        newStats.totalProfit += result.profit || 0;
                        newStats.totalPayout += result.payout || 0;
                        newStats.contractsLost = 0;
                    } else {
                        newStats.totalLosses++;
                        newStats.contractsLost++;
                        newStats.totalProfit -= adjustedStake;
                    }
                    newStats.winRate = (newStats.totalWins / newStats.numberOfRuns) * 100;
                    return newStats;
                });

                setTradeHistory(prev => [
                    {
                        id: result.contractId?.toString() || `trade-${Date.now()}`,
                        contractType: strat === 'Differs' ? `DIFFERS ${differsSelectedDigitRef.current}` : contractType,
                        market: symbol,
                        entrySpot: result.entrySpot?.toString() || 'N/A',
                        exitSpot: result.exitSpot?.toString() || 'N/A',
                        buyPrice: adjustedStake,
                        profitLoss: result.profit || 0,
                        timestamp: Date.now(),
                        status: result.isWin ? 'win' : 'loss',
                        marketPrice: marketPriceRef.current || 0,
                    },
                    ...prev,
                ]);

                addAnalysisLog(
                    `Trade result: ${result.isWin ? 'WIN' : 'LOSS'} - P/L: $${(result.profit || 0).toFixed(2)}`,
                    result.isWin ? 'success' : 'warning'
                );

                // Reset for next entry
                entryPointMetRef.current = false;

                // Handle TP/SL
                if (traderRef.current.getTotalProfit() >= Number.parseFloat(targetProfit)) {
                    if (isAutoPilotEnabledRef.current) {
                        addAnalysisLog(
                            `Target Profit of $${targetProfit} reached! AutoPilot resting session...`,
                            'success'
                        );

                        // Auto Market Switch
                        if (isAutoMarketSwitchEnabledRef.current && marketScoresRef.current.length > 0) {
                            const best = [...marketScoresRef.current].sort((a, b) => b.score - a.score)[0];
                            if (best && best.symbol !== symbol && best.score > 70) {
                                addAnalysisLog(
                                    `AutoPilot: Switching market to ${best.symbol.replace('_', ' ')} based on Intelligence score ${best.score}%.`,
                                    'info'
                                );
                                onSymbolChange(best.symbol);
                            }
                        }

                        // Reset Trader and Stats for the new cycle
                        if (apiClient) {
                            traderRef.current = new DerivRealTrader(apiClient);
                        }
                        setSessionProfit(0);
                        setSessionTrades(0);
                        contractsLostRef.current = 0;

                        // Restart trading automatically
                        setTimeout(() => {
                            handleStartTrading();
                        }, 5000);
                    } else {
                        setTpAmount(traderRef.current.getTotalProfit());
                        setShowTPPopup(true);
                        setStatus('completed');
                        setIsRunning(false);
                    }
                }
            }
        } catch (error: any) {
            addAnalysisLog(`Trade error: ${error.message}`, 'warning');
        } finally {
            // Cooldown to avoid double entries on the same tick
            setTimeout(() => {
                isExecutingTradeRef.current = false;
            }, 5000);
        }
    };

    const handleStopTrading = () => {
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        if (analysisIntervalRef.current) clearInterval(analysisIntervalRef.current);
        setIsRunning(false);
        setStatus('idle');
        addAnalysisLog('Trading stopped', 'info');
    };

    return (
        <div
            className={`space-y-4 backdrop-blur-lg p-4 rounded-2xl ${
                theme === 'dark'
                    ? 'bg-gradient-to-br from-[#0f1629]/30 via-[#1a2235]/20 to-[#0f1629]/30'
                    : 'bg-gradient-to-br from-blue-50/30 via-white/30 to-purple-50/30'
            }`}
        >
            {!isAuthorized ? (
                <Card
                    className={`border-2 backdrop-blur-lg transition-all ${theme === 'dark' ? 'bg-amber-500/15 border-amber-400/40 shadow-lg shadow-amber-500/20' : 'bg-amber-50/50 border-amber-300/50'}`}
                >
                    <CardContent className='p-4 flex items-center gap-3'>
                        <div
                            className={`p-2 rounded-full shrink-0 backdrop-blur-sm ${theme === 'dark' ? 'bg-amber-500/20 border border-amber-400/50' : 'bg-amber-100'}`}
                        >
                            <AlertCircle
                                className={`w-4 h-4 ${theme === 'dark' ? 'text-amber-400' : 'text-amber-600'}`}
                            />
                        </div>
                        <div>
                            <p
                                className={`text-xs font-bold ${theme === 'dark' ? 'text-amber-400' : 'text-amber-700'}`}
                            >
                                Authentication Required
                            </p>
                            <p
                                className={`text-[10px] mt-0.5 ${theme === 'dark' ? 'text-amber-400/70' : 'text-amber-600'}`}
                            >
                                Please log in using the <strong>Login</strong> button in the header to use SmartAuto24.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <>
                    <Card
                        className={`p-6 border-2 backdrop-blur-xl rounded-2xl transition-all ${
                            theme === 'dark'
                                ? 'bg-gradient-to-r from-emerald-600/20 via-emerald-500/15 to-teal-600/15 border-emerald-400/40 shadow-lg shadow-emerald-500/20'
                                : 'bg-gradient-to-r from-emerald-100/50 via-white/50 to-teal-50/50 border-emerald-400/50 shadow-md'
                        }`}
                    >
                        <div className='flex items-center justify-between'>
                            <div>
                                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                                    Account Balance
                                </p>
                                <h3
                                    className={`text-3xl font-bold ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}
                                >
                                    ${(balance?.amount || 0).toFixed(2)}
                                </h3>
                                <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                                    {balance?.currency || 'USD'}
                                </p>
                            </div>
                            <Badge
                                className={`text-lg px-4 py-2 ${
                                    theme === 'dark'
                                        ? 'bg-green-500/20 text-green-400 border-green-500/30'
                                        : 'bg-green-100 text-green-700'
                                }`}
                            >
                                Connected
                            </Badge>
                        </div>
                    </Card>

                    {/* Redundant Price Card Removed - Using global price from Ticker */}

                    {showAnalysisResults && analysisData && (
                        <Card
                            className={`p-6 border ${
                                theme === 'dark'
                                    ? 'bg-linear-to-br from-purple-500/20 to-pink-500/20 border-purple-500/30'
                                    : 'bg-purple-50 border-purple-200'
                            }`}
                        >
                            <h3
                                className={`text-lg font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                            >
                                Analysis Results - {analysisData.strategy}
                            </h3>

                            <div className='grid grid-cols-2 md:grid-cols-4 gap-2 mb-3'>
                                <div
                                    className={`p-2 rounded-lg border ${theme === 'dark' ? 'bg-blue-500/5 border-blue-500/20' : 'bg-blue-50 border-blue-100'}`}
                                >
                                    <div className='text-[8px] uppercase text-gray-400 font-bold'>Signal</div>
                                    <div
                                        className={`text-base font-black ${analysisData.status === 'WAIT' ? 'text-yellow-500' : 'text-green-500'}`}
                                    >
                                        {analysisData.status === 'WAIT' ? 'WAIT' : analysisData.signal}
                                    </div>
                                </div>

                                <div
                                    className={`p-2 rounded-lg border ${theme === 'dark' ? 'bg-purple-500/5 border-purple-500/20' : 'bg-purple-50 border-purple-100'}`}
                                >
                                    <div className='text-[8px] uppercase text-gray-400 font-bold'>Power</div>
                                    <div
                                        className={`text-base font-black ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`}
                                    >
                                        {analysisData.power.toFixed(0)}%
                                    </div>
                                </div>

                                <div
                                    className={`p-2 rounded-lg border ${theme === 'dark' ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-50 border-amber-100'}`}
                                >
                                    <div className='text-[8px] uppercase text-gray-400 font-bold'>Conf.</div>
                                    <div
                                        className={`text-base font-black ${theme === 'dark' ? 'text-amber-400' : 'text-amber-600'}`}
                                    >
                                        {analysisData.confidence.toFixed(0)}%
                                    </div>
                                </div>

                                <div
                                    className={`p-2 rounded-lg border ${theme === 'dark' ? 'bg-cyan-500/5 border-cyan-500/20' : 'bg-cyan-50 border-cyan-100'}`}
                                >
                                    <div className='text-[8px] uppercase text-gray-400 font-bold'>Ticks</div>
                                    <div
                                        className={`text-base font-black ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'}`}
                                    >
                                        {analysisData.ticksCollected}
                                    </div>
                                </div>
                            </div>

                            <div
                                className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-black/40 border border-white/5' : 'bg-gray-50 border border-gray-200'}`}
                            >
                                <p
                                    className={`text-[11px] leading-relaxed italic ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                                >
                                    <span className='font-bold text-yellow-500 mr-1'>Recommendation:</span>
                                    {analysisData.description}
                                </p>
                            </div>
                        </Card>
                    )}

                    {/* Configuration Panel */}
                    <Card
                        className={`p-6 border ${
                            theme === 'dark'
                                ? 'bg-linear-to-br from-[#0f1629]/80 to-[#1a2235]/80 border-yellow-500/20'
                                : 'bg-white border-gray-200'
                        }`}
                    >
                        <div className='flex flex-col sm:flex-row items-center justify-between mb-4 gap-4'>
                            <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                Configuration
                            </h3>

                            {/* Live Data Bar */}
                            <div
                                className={`flex items-center gap-3 p-2 rounded-lg border ${theme === 'dark' ? 'bg-black/40 border-yellow-500/20' : 'bg-gray-50 border-gray-200'}`}
                            >
                                <div className='flex flex-col items-start px-2 border-r border-gray-500/20'>
                                    <span className='text-[8px] uppercase tracking-tighter text-gray-500 font-black'>
                                        Market Price
                                    </span>
                                    <span
                                        className={`text-xs font-mono font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                                    >
                                        {(marketPrice || 0).toFixed(5)}
                                    </span>
                                </div>

                                <div className='flex items-center gap-1 px-1'>
                                    {recentDigits.slice(-15).map((d, i) => (
                                        <div
                                            key={i}
                                            className={`text-[9px] w-4 h-4 flex items-center justify-center rounded-sm font-bold shadow-sm transition-all duration-300 ${
                                                d % 2 === 0
                                                    ? 'bg-blue-600/30 text-blue-400 border border-blue-500/20'
                                                    : 'bg-orange-600/30 text-orange-400 border border-orange-500/20'
                                            } ${i === recentDigits.length - 1 ? 'ring-1 ring-white/30 scale-110' : ''}`}
                                        >
                                            {d}
                                        </div>
                                    ))}
                                    {recentDigits.length === 0 && (
                                        <span className='text-[9px] text-gray-500 italic px-2'>
                                            Waiting for ticks...
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className='grid grid-cols-2 gap-4 mb-6'>
                            <div>
                                <label
                                    className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
                                >
                                    Market
                                </label>
                                <Select value={symbol} onValueChange={onSymbolChange} disabled={loadingMarkets}>
                                    <SelectTrigger
                                        className={`${
                                            theme === 'dark'
                                                ? 'bg-[#0a0e27]/50 border-yellow-500/30 text-white'
                                                : 'bg-white border-gray-300 text-gray-900'
                                        }`}
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent
                                        className={theme === 'dark' ? 'bg-[#0a0e27] border-yellow-500/30' : 'bg-white'}
                                    >
                                        {allMarkets.map(m => (
                                            <SelectItem key={m.symbol} value={m.symbol}>
                                                {m.display_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <label
                                    className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
                                >
                                    Stake ($)
                                </label>
                                <Input
                                    type='number'
                                    value={stake}
                                    onChange={e => setStake(e.target.value)}
                                    className={`${
                                        theme === 'dark'
                                            ? 'bg-[#0a0e27]/50 border-yellow-500/30 text-white'
                                            : 'bg-white border-gray-300 text-gray-900'
                                    }`}
                                    step='0.01'
                                    min='0.01'
                                />
                            </div>

                            <div>
                                <label
                                    className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
                                >
                                    Target Profit ($)
                                </label>
                                <Input
                                    type='number'
                                    value={targetProfit}
                                    onChange={e => setTargetProfit(e.target.value)}
                                    className={`${
                                        theme === 'dark'
                                            ? 'bg-[#0a0e27]/50 border-yellow-500/30 text-white'
                                            : 'bg-white border-gray-300 text-gray-900'
                                    }`}
                                    step='0.1'
                                    min='0.1'
                                />
                            </div>

                            <div>
                                <label
                                    className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
                                >
                                    Strategy
                                </label>
                                <Select value={selectedStrategy} onValueChange={setSelectedStrategy}>
                                    <SelectTrigger
                                        className={`${
                                            theme === 'dark'
                                                ? 'bg-[#0a0e27]/50 border-yellow-500/30 text-white'
                                                : 'bg-white border-gray-300 text-gray-900'
                                        }`}
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent
                                        className={theme === 'dark' ? 'bg-[#0a0e27] border-yellow-500/30' : 'bg-white'}
                                    >
                                        {strategies.map(s => (
                                            <SelectItem key={s} value={s}>
                                                {s}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <label
                                    className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
                                >
                                    Martingale Multiplier
                                </label>
                                <Input
                                    type='number'
                                    value={martingaleRatios[selectedStrategy] || 2.0}
                                    onChange={e => {
                                        const newRatio = Number.parseFloat(e.target.value) || 2.0;
                                        setMartingaleRatios(prev => ({ ...prev, [selectedStrategy]: newRatio }));
                                    }}
                                    className={`${
                                        theme === 'dark'
                                            ? 'bg-[#0a0e27]/50 border-yellow-500/30 text-white'
                                            : 'bg-white border-gray-300 text-gray-900'
                                    }`}
                                    step='0.1'
                                    min='1.5'
                                    max='5'
                                />
                            </div>

                            <div>
                                <label
                                    className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
                                >
                                    Ticks Per Trade
                                </label>
                                <Input
                                    type='number'
                                    value={ticksPerTrade}
                                    onChange={e => setTicksPerTrade(Number.parseInt(e.target.value))}
                                    className={`${
                                        theme === 'dark'
                                            ? 'bg-[#0a0e27]/50 border-yellow-500/30 text-white'
                                            : 'bg-white border-gray-300 text-gray-900'
                                    }`}
                                    min='1'
                                    max='100'
                                />
                            </div>

                            <div>
                                <label
                                    className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
                                >
                                    Stop Loss (%)
                                </label>
                                <Input
                                    type='number'
                                    value={stopLossPercent}
                                    onChange={e => setStopLossPercent(e.target.value)}
                                    className={`${
                                        theme === 'dark'
                                            ? 'bg-[#0a0e27]/50 border-yellow-500/30 text-white'
                                            : 'bg-white border-gray-300 text-gray-900'
                                    }`}
                                    step='5'
                                    min='10'
                                    max='90'
                                />
                            </div>

                            <div className='flex flex-col justify-end space-y-3 pb-2 mt-4 sm:mt-0 col-span-2 sm:col-span-1 border-t sm:border-t-0 sm:border-l border-gray-200/20 pt-4 sm:pt-0 sm:pl-4'>
                                <div className='flex items-center justify-between'>
                                    <Label
                                        className={`text-xs ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'} font-bold cursor-pointer`}
                                        htmlFor='autopilot-toggle'
                                    >
                                        24h AutoPilot
                                    </Label>
                                    <Switch
                                        id='autopilot-toggle'
                                        checked={isAutoPilotEnabled}
                                        onCheckedChange={setIsAutoPilotEnabled}
                                        disabled={isRunning}
                                    />
                                </div>
                                <div className='flex items-center justify-between'>
                                    <Label
                                        className={`text-xs ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'} font-bold cursor-pointer`}
                                        htmlFor='market-switch-toggle'
                                    >
                                        Auto Market Switch
                                    </Label>
                                    <Switch
                                        id='market-switch-toggle'
                                        checked={isAutoMarketSwitchEnabled}
                                        onCheckedChange={setIsAutoMarketSwitchEnabled}
                                        disabled={isRunning || !isAutoPilotEnabled}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className='flex gap-3'>
                            <Button
                                onClick={status === 'trading' ? handleStopTrading : handleStartTrading}
                                disabled={!isLoggedIn || loadingMarkets}
                                className={`flex-1 font-bold shadow-lg transition-all duration-300 ${
                                    theme === 'dark'
                                        ? 'bg-linear-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-black'
                                        : 'bg-yellow-500 hover:bg-yellow-600 text-white'
                                }`}
                            >
                                {status === 'trading' ? (
                                    <>
                                        <Pause className='w-4 h-4 mr-2' /> Stop Trading
                                    </>
                                ) : (
                                    <>
                                        <Play className='w-4 h-4 mr-2' /> Start Trading
                                    </>
                                )}
                            </Button>

                            <Button
                                onClick={handleStopTrading}
                                disabled={status !== 'trading'}
                                variant='destructive'
                                className={`flex-1 ${theme === 'dark' ? 'border-red-500/30 text-red-400 hover:bg-red-500/10' : 'border-red-300 text-red-600'}`}
                            >
                                <Pause className='w-4 h-4 mr-2' />
                                Stop
                            </Button>
                        </div>
                    </Card>

                    {/* Real-time Session Status */}
                    {status === 'trading' && (
                        <Card
                            className={`p-6 border ${
                                theme === 'dark'
                                    ? 'bg-linear-to-br from-[#0f1629]/80 to-[#1a2235]/80 border-cyan-500/20 shadow-[0_0_20px_rgba(34,211,238,0.1)]'
                                    : 'bg-white border-blue-200'
                            }`}
                        >
                            <h3
                                className={`text-lg font-bold mb-6 ${theme === 'dark' ? 'text-cyan-400' : 'text-blue-600'}`}
                            >
                                AutoPilot Monitor
                            </h3>

                            {/* Analysis Log */}
                            <div
                                className={`p-4 rounded-lg mt-6 ${
                                    theme === 'dark'
                                        ? 'bg-gray-900/50 border border-gray-700'
                                        : 'bg-gray-50 border border-gray-200'
                                }`}
                            >
                                <h4
                                    className={`text-sm font-bold mb-3 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
                                >
                                    System Journal
                                </h4>
                                <div
                                    className={`space-y-1 max-h-48 overflow-y-auto font-mono text-xs ${theme === 'dark' ? '' : 'bg-white p-2 rounded'}`}
                                >
                                    {analysisLog.length === 0 ? (
                                        <div className='text-gray-500'>Waiting for AutoPilot events...</div>
                                    ) : (
                                        analysisLog.map((log, idx) => (
                                            <div
                                                key={idx}
                                                className={`${
                                                    log.type === 'success'
                                                        ? 'text-green-500'
                                                        : log.type === 'warning'
                                                          ? 'text-yellow-500'
                                                          : theme === 'dark'
                                                            ? 'text-gray-300'
                                                            : 'text-gray-700'
                                                }`}
                                            >
                                                <span className='text-gray-400'>
                                                    [{log.timestamp.toLocaleTimeString()}]
                                                </span>{' '}
                                                {log.message}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </Card>
                    )}

                    {/* Market Suggestions - Omitted as AutoPilot selects it */}
                    {status === 'completed' && (
                        <Card
                            className={`p-6 border ${
                                theme === 'dark'
                                    ? 'bg-linear-to-br from-[#0f1629]/80 to-[#1a2235]/80 border-cyan-500/20 shadow-[0_0_20px_rgba(34,211,238,0.1)]'
                                    : 'bg-white border-blue-200'
                            }`}
                        >
                            <div className='flex items-center justify-between mb-6'>
                                <h3
                                    className={`text-lg font-bold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                                >
                                    <Zap className='w-5 h-5 text-yellow-400' />
                                    Best Market Conditions Detected
                                </h3>
                                <Badge variant='outline' className='border-cyan-500/30 text-cyan-400'>
                                    {marketSuggestions.length} Opportunities
                                </Badge>
                            </div>

                            {marketSuggestions.length > 0 ? (
                                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                                    {marketSuggestions.map((suggestion, idx) => (
                                        <Card
                                            key={idx}
                                            className={`p-4 border transition-all duration-300 hover:scale-[1.02] cursor-pointer ${
                                                theme === 'dark'
                                                    ? 'bg-slate-900/50 border-cyan-500/20 hover:border-cyan-400/50 shadow-inner'
                                                    : 'bg-slate-50 border-gray-200 hover:border-blue-300'
                                            }`}
                                            onClick={() => handleSelectSuggestion(suggestion)}
                                        >
                                            <div className='flex justify-between items-start mb-2'>
                                                <span
                                                    className={`text-sm font-bold uppercase tracking-tight ${theme === 'dark' ? 'text-cyan-400' : 'text-blue-600'}`}
                                                >
                                                    {suggestion.type.toUpperCase().replace('_', ' ')}
                                                </span>
                                                <Badge
                                                    className={`${suggestion.status === 'TRADE NOW' ? 'bg-green-500 text-white' : 'bg-yellow-500 text-black'} font-black`}
                                                >
                                                    {suggestion.status}
                                                </Badge>
                                            </div>

                                            <div className='flex items-center gap-2 mb-3'>
                                                <div
                                                    className={`h-1.5 flex-1 rounded-full ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}
                                                >
                                                    <div
                                                        className={`h-full rounded-full ${suggestion.probability >= 60 ? 'bg-green-500' : 'bg-yellow-500'}`}
                                                        style={{ width: `${suggestion.probability}%` }}
                                                    />
                                                </div>
                                                <span
                                                    className={`text-xs font-black ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}
                                                >
                                                    {(suggestion.probability || 0).toFixed(0)}%
                                                </span>
                                            </div>

                                            <p
                                                className={`text-[10px] mb-4 leading-relaxed line-clamp-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                                            >
                                                {suggestion.recommendation}
                                            </p>

                                            <Button
                                                size='sm'
                                                className='w-full h-8 bg-linear-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-bold text-[10px] uppercase tracking-wider'
                                            >
                                                Trade with this Strategy
                                            </Button>
                                        </Card>
                                    ))}
                                </div>
                            ) : (
                                <div className='flex flex-col items-center justify-center py-10 text-center space-y-4'>
                                    <div className='w-16 h-16 rounded-full bg-gray-500/10 flex items-center justify-center'>
                                        <AlertCircle className='w-8 h-8 text-gray-500' />
                                    </div>
                                    <div className='space-y-1'>
                                        <p
                                            className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}
                                        >
                                            No Strong Signals Found
                                        </p>
                                        <p className='text-xs text-gray-500 max-w-[250px]'>
                                            The market currently shows neutral patterns. You can try a different
                                            timeframe or asset.
                                        </p>
                                    </div>
                                    <Button
                                        variant='outline'
                                        onClick={() => setStatus('idle')}
                                        className='mt-4 border-yellow-500/50 text-yellow-500'
                                    >
                                        Reset and Try Again
                                    </Button>
                                </div>
                            )}
                        </Card>
                    )}

                    {/* Statistical Progress Analysis */}
                    {status === 'trading' && analysisData && (
                        <Card
                            className={`p-6 border ${
                                theme === 'dark'
                                    ? 'bg-linear-to-br from-[#0f1629]/80 to-[#1a2235]/80 border-purple-500/20'
                                    : 'bg-white border-gray-200'
                            }`}
                        >
                            <h3
                                className={`text-lg font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                            >
                                Statistical Progress Analysis
                            </h3>

                            <div className='space-y-4'>
                                {/* Win Rate Progress */}
                                <div>
                                    <div className='flex justify-between items-center mb-2'>
                                        <span
                                            className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
                                        >
                                            Win Rate
                                        </span>
                                        <span
                                            className={`text-sm font-bold ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}
                                        >
                                            {(stats.winRate || 0).toFixed(1)}%
                                        </span>
                                    </div>
                                    <div
                                        className={`w-full h-3 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}
                                    >
                                        <div
                                            className='h-full bg-linear-to-r from-green-500 to-emerald-500 transition-all duration-300'
                                            style={{ width: `${Math.min(100, stats.winRate)}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Strategy Power Progress */}
                                <div>
                                    <div className='flex justify-between items-center mb-2'>
                                        <span
                                            className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
                                        >
                                            Strategy Power
                                        </span>
                                        <span
                                            className={`text-sm font-bold ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}
                                        >
                                            {analysisData.power.toFixed(1)}%
                                        </span>
                                    </div>
                                    <div
                                        className={`w-full h-3 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}
                                    >
                                        <div
                                            className='h-full bg-linear-to-r from-blue-500 to-cyan-500 transition-all duration-300'
                                            style={{ width: `${Math.min(100, analysisData.power)}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Profit Progress */}
                                <div>
                                    <div className='flex justify-between items-center mb-2'>
                                        <span
                                            className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
                                        >
                                            Profit Progress
                                        </span>
                                        <span
                                            className={`text-sm font-bold ${sessionProfit >= 0 ? (theme === 'dark' ? 'text-green-400' : 'text-green-600') : theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}
                                        >
                                            {sessionProfit >= 0 ? '+' : ''}${sessionProfit.toFixed(2)} / ${targetProfit}
                                        </span>
                                    </div>
                                    <div
                                        className={`w-full h-3 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}
                                    >
                                        <div
                                            className={`h-full transition-all duration-300 ${sessionProfit >= 0 ? 'bg-linear-to-r from-green-500 to-emerald-500' : 'bg-linear-to-r from-red-500 to-orange-500'}`}
                                            style={{
                                                width: `${Math.min(100, Math.abs((sessionProfit / Number.parseFloat(targetProfit)) * 100))}%`,
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </Card>
                    )}

                    {/* Stats Panel */}
                    <TradingStatsPanel
                        stats={stats}
                        theme={theme}
                        onReset={() => {
                            setStats({
                                totalWins: 0,
                                totalLosses: 0,
                                totalProfit: 0,
                                winRate: 0,
                                totalStake: 0,
                                totalPayout: 0,
                                numberOfRuns: 0,
                                contractsLost: 0,
                                contractsWon: 0,
                            });
                            setTradeHistory([]);
                            setJournalLog([]);
                        }}
                    />

                    {/* Transaction History */}
                    {tradeHistory.length > 0 && <TransactionHistory transactions={tradeHistory} theme={theme} />}

                    {/* Trade Log */}
                    {tradeHistory.length > 0 && (
                        <TradeLog
                            trades={tradeHistory.map(trade => ({
                                id: trade.id,
                                timestamp: trade.timestamp,
                                volume: '1',
                                tradeType: selectedStrategy,
                                contractType: trade.contractType,
                                predicted: analysisData?.signal || 'N/A',
                                result: trade.status,
                                entry: trade.entrySpot,
                                exit: trade.exitSpot,
                                stake: trade.buyPrice,
                                profitLoss: trade.profitLoss,
                            }))}
                            theme={theme}
                        />
                    )}

                    {/* Journal */}
                    {journalLog.length > 0 && <TradingJournalPanel entries={journalLog} theme={theme} />}

                    {/* Session Stats */}
                    <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                        <Card
                            className={`p-6 border ${
                                theme === 'dark'
                                    ? 'bg-linear-to-br from-green-500/10 to-green-500/10 border-green-500/30'
                                    : 'bg-green-50 border-green-200'
                            }`}
                        >
                            <div className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                                Session Profit
                            </div>
                            <div
                                className={`text-3xl font-bold ${sessionProfit >= 0 ? (theme === 'dark' ? 'text-green-400' : 'text-green-600') : theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}
                            >
                                {sessionProfit >= 0 ? '+' : ''} ${(sessionProfit || 0).toFixed(2)}
                            </div>
                        </Card>

                        <Card
                            className={`p-6 border ${
                                theme === 'dark'
                                    ? 'bg-linear-to-br from-blue-500/10 to-blue-500/10 border-blue-500/30'
                                    : 'bg-blue-50 border-blue-200'
                            }`}
                        >
                            <div className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                                Trades Executed
                            </div>
                            <div
                                className={`text-3xl font-bold ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}
                            >
                                {sessionTrades}
                            </div>
                        </Card>

                        <Card
                            className={`p-6 border ${
                                theme === 'dark'
                                    ? 'bg-linear-to-br from-yellow-500/10 to-yellow-500/10 border-yellow-500/30'
                                    : 'bg-yellow-50 border-yellow-200'
                            }`}
                        >
                            <div className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                                Status
                            </div>
                            <div
                                className={`text-lg font-bold ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'}`}
                            >
                                {status.toUpperCase()}
                            </div>
                        </Card>
                    </div>
                </>
            )}

            {/* Stop Loss Popup */}
            {showSLPopup && (
                <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm'>
                    <div className='max-w-md w-full bg-linear-to-br from-red-900/95 to-red-800/95 rounded-2xl border-2 border-red-500 shadow-[0_0_50px_rgba(239,68,68,0.5)] p-8'>
                        <div className='text-center space-y-4'>
                            <div className='text-6xl'>😢</div>
                            <h2 className='text-3xl font-bold text-white'>Oops!</h2>
                            <p className='text-red-300 text-lg'>Stop loss hit. Please try again later.</p>

                            <div className='bg-white/10 rounded-lg p-6 space-y-3'>
                                <div className='flex items-center justify-center gap-2'>
                                    <span className='text-4xl font-bold text-red-400'>
                                        -${(slAmount || 0).toFixed(2)}
                                    </span>
                                </div>
                                <div className='text-sm text-gray-300'>Total Loss (USD)</div>

                                <div className='border-t border-white/20 pt-3'>
                                    <div className='text-2xl font-bold text-red-400'>
                                        -KES {((slAmount || 0) * 129.5).toFixed(2)}
                                    </div>
                                    <div className='text-xs text-gray-400 mt-1'>
                                        (Conversion rate: 1 USD = 129.5 KES)
                                    </div>
                                </div>

                                {marketPrice && (
                                    <div className='border-t border-white/20 pt-3'>
                                        <div className='text-xs text-gray-400'>Market Price at Loss</div>
                                        <div className='text-lg font-bold text-white'>
                                            {(marketPrice || 0).toFixed(5)}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <Button
                                onClick={() => setShowSLPopup(false)}
                                className='w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3'
                            >
                                Close
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Take Profit Popup */}
            {showTPPopup && (
                <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm'>
                    <div className='max-w-md w-full bg-linear-to-br from-green-900/95 to-green-800/95 rounded-2xl border-2 border-green-500 shadow-[0_0_50px_rgba(34,197,94,0.5)] p-8'>
                        <div className='text-center space-y-4'>
                            <div className='text-6xl'>🎉</div>
                            <h2 className='text-3xl font-bold text-white'>Congratulations!</h2>
                            <p className='text-green-300 text-lg'>Take profit hit. Well done!</p>

                            <div className='bg-white/10 rounded-lg p-6 space-y-3'>
                                <div className='flex items-center justify-center gap-2'>
                                    <span className='text-4xl font-bold text-green-400'>
                                        +${(tpAmount || 0).toFixed(2)}
                                    </span>
                                </div>
                                <div className='text-sm text-gray-300'>Total Profit (USD)</div>

                                <div className='border-t border-white/20 pt-3'>
                                    <div className='text-2xl font-bold text-green-400'>
                                        +KES {((tpAmount || 0) * 129.5).toFixed(2)}
                                    </div>
                                    <div className='text-xs text-gray-400 mt-1'>
                                        (Conversion rate: 1 USD = 129.5 KES)
                                    </div>
                                </div>

                                {marketPrice && (
                                    <div className='border-t border-white/20 pt-3'>
                                        <div className='text-xs text-gray-400'>Market Price at Profit</div>
                                        <div className='text-lg font-bold text-white'>
                                            {(marketPrice || 0).toFixed(5)}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <Button
                                onClick={() => setShowTPPopup(false)}
                                className='w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3'
                            >
                                Close
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <TradeResultModal
                isOpen={showResultModal}
                type={resultType}
                amount={resultAmount}
                theme={theme}
                onClose={() => setShowResultModal(false)}
            />
        </div>
    );
}
