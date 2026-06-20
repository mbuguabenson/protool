'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useDerivAPI } from '@/lib/deriv-api-context';
import { SmartIntelligenceEngine, type MarketScore } from '@/lib/trading/smart-intelligence-engine';
import { SmartPatternEngine, type PatternMatch } from '@/lib/trading/smart-pattern-engine';
import { AdaptiveStrategyManager, type StrategySignal } from '@/lib/trading/adaptive-strategy-manager';
import { TradingManager } from '@/lib/trading/trading-manager';
import { DerivWebSocketManager } from '@/lib/deriv-websocket-manager';
import { AnalysisEngine } from '@/lib/analysis-engine';

export function useSmartAdaptiveTrading() {
    const { apiClient, isConnected, isAuthorized, balance } = useDerivAPI();

    const [marketScores, setMarketScores] = useState<MarketScore[]>([]);
    const [selectedMarket, setSelectedMarket] = useState('');
    const [selectedStrategies, setSelectedStrategies] = useState<string[]>(['OverUnder', 'SuperSignals']);
    const [selectedStrategy, setSelectedStrategy] = useState('All');
    const [patterns, setPatterns] = useState<PatternMatch[]>([]);
    const [signals, setSignals] = useState<StrategySignal[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [tradingStatus, setTradingStatus] = useState<any>(null);
    const [tickDuration, setTickDuration] = useState(3);
    const [logs, setLogs] = useState<{ message: string; type: string; timestamp: number }[]>([]);

    const intelligenceRef = useRef<SmartIntelligenceEngine | null>(null);
    const patternRef = useRef<SmartPatternEngine>(new SmartPatternEngine());
    const strategyRef = useRef<AdaptiveStrategyManager>(new AdaptiveStrategyManager());
    const analysisRef = useRef<AnalysisEngine>(new AnalysisEngine());
    const tradingRef = useRef<TradingManager | null>(null);
    const isScanningRef = useRef(false);

    useEffect(() => {
        if (!apiClient || !isConnected || !isAuthorized) {
            isScanningRef.current = false;
            return;
        }

        if (!intelligenceRef.current) {
            intelligenceRef.current = SmartIntelligenceEngine.getInstance();
        }

        // Always sync the trading manager with the current apiClient
        tradingRef.current = new TradingManager(apiClient);

        addLog('System synchronized. Multi-market intelligence active.', 'system');

        if (!isScanningRef.current) {
            intelligenceRef.current.startScanning();
            isScanningRef.current = true;
        }

        const unsub = intelligenceRef.current.onUpdate(scores => {
            setMarketScores(scores);
        });

        addLog('Neural connection established. Pulse sync active.', 'system');

        return () => {
            if (unsub) unsub();
            if (intelligenceRef.current) {
                intelligenceRef.current.stopScanning();
            }
        };
    }, [apiClient, isConnected, isAuthorized]);

    // Process patterns for selected market
    useEffect(() => {
        if (!apiClient || !isConnected || !isAuthorized || !selectedMarket) return;

        if (intelligenceRef.current) {
            intelligenceRef.current.setFocusMarket(selectedMarket);
        }

        let currentSubId: string | null = null;
        let isCancelled = false;
        const digits: number[] = [];

        addLog(`Focusing analysis on ${selectedMarket.replace('_', ' ')}`, 'system');

        const tickHandler = (tick: any) => {
            if (isCancelled) return;

            const pipSize = apiClient.getPipSize(selectedMarket);
            const lastDigit = DerivWebSocketManager.getInstance().extractLastDigit(tick.quote, pipSize);
            digits.push(lastDigit);
            if (digits.length > 100) digits.shift();

            patternRef.current.updateWindow(digits);
            patternRef.current.setTickDuration(tickDuration);

            const currentPatterns = patternRef.current.analyze();
            setPatterns(currentPatterns);

            const allVariants = strategyRef.current.getSignalsWithVariants(currentPatterns);

            // Integrate Super Signals from AnalysisEngine
            const proSignals = analysisRef.current.generateProSignals();
            const mappedProSignals: StrategySignal[] = proSignals.map(s => ({
                strategy: 'SuperSignals',
                type: s.type,
                barrier: s.targetDigit?.toString() || '0',
                confidence: s.probability,
                description: s.recommendation,
                entryStatus: s.status === 'TRADE NOW' ? 'Confirmed' : 'Waiting',
            }));

            const currentSignals = [
                ...allVariants.filter(s => selectedStrategies.includes(s.strategy)),
                ...mappedProSignals.filter(s => selectedStrategies.includes('SuperSignals')),
            ];

            setSignals(currentSignals);

            if (tradingRef.current) {
                setStats(tradingRef.current.getStats());
                setTradingStatus(tradingRef.current.getStatus());
            }
        };

        // Note: moved inside to avoid closure/scope issues if needed, but tradingRef.current is stable
        const handleCycleEnd = (sessionStats: any) => {
            const config = tradingRef.current?.getConfig();
            if (!config) return;

            if (sessionStats.profit >= (tradingRef.current?.getStats().profit || 0)) {
                if (sessionStats.profit >= config.targetProfit) {
                    addLog(`Target Profit Hit! Resetting session and re-analyzing...`, 'scanner');
                    tradingRef.current?.resetSession();
                }
            }

            if (intelligenceRef.current) {
                const scores = intelligenceRef.current.getScores();
                const best = [...scores].sort((a, b) => b.score - a.score)[0];
                if (best && best.symbol !== selectedMarket && best.score > 70) {
                    addLog(
                        `Switching to higher potential market: ${best.symbol.replace('_', ' ')} (${best.score}%)`,
                        'scanner'
                    );
                    setSelectedMarket(best.symbol);
                }
            }
        };

        const startLocalSub = async () => {
            try {
                const id = await apiClient.subscribeTicks(selectedMarket, tickHandler);

                if (isCancelled) {
                    if (id) apiClient.forget(id, tickHandler);
                } else {
                    currentSubId = id;
                }
            } catch (err) {
                console.error('Failed to subscribe to focus market:', err);
                addLog(`Failed to sync with ${selectedMarket}`, 'error');
            }
        };

        startLocalSub();

        return () => {
            isCancelled = true;
            if (currentSubId) apiClient.forget(currentSubId, tickHandler);
        };
    }, [apiClient, isConnected, isAuthorized, selectedMarket, tickDuration]);

    // Filter signals based on selected strategies
    const filteredSignals = useMemo(() => {
        return signals;
    }, [signals]);

    const tradeOnce = useCallback(
        async (signal: StrategySignal) => {
            if (!tradingRef.current) return;
            addLog(`Manual execution: ${signal.strategy} - ${signal.type}`, 'trade');

            try {
                // For manual trades, bypass session limits
                return await tradingRef.current.tradeOnce(signal, selectedMarket, true);
            } catch (err: any) {
                if (err?.message?.startsWith('SESSION_LIMIT')) {
                    addLog(`Session limit reached but executing manual trade anyway`, 'warning');
                    // Try again with bypass
                    return await tradingRef.current.tradeOnce(signal, selectedMarket, true);
                }
                addLog(`Trade execution failed: ${err?.message || 'Unknown error'}`, 'error');
                throw err;
            }
        },
        [selectedMarket]
    );

    const startAutoTrade = useCallback(() => {
        if (!tradingRef.current) return;
        addLog(`AutoPilot ENGAGED: Multi-strategy mode`, 'system');

        tradingRef.current.startAutoTrade(selectedMarket, () => {
            const currentPatterns = patternRef.current.analyze();
            const allVariants = strategyRef.current.getSignalsWithVariants(currentPatterns);

            // Integrate Super Signals
            const proSignals = analysisRef.current.generateProSignals();
            const mappedProSignals: StrategySignal[] = proSignals.map(s => ({
                strategy: 'SuperSignals' as const,
                type: s.type,
                barrier: s.targetDigit?.toString() || '0',
                confidence: s.probability,
                description: s.recommendation,
                entryStatus: s.status === 'TRADE NOW' ? ('Confirmed' as const) : ('Waiting' as const),
            }));

            const possibleSignals = [...allVariants, ...mappedProSignals].filter(
                s => selectedStrategies.includes(s.strategy) && s.entryStatus === 'Confirmed'
            );

            return possibleSignals.length > 0 ? possibleSignals[0] : null;
        });
    }, [selectedMarket, selectedStrategies]);

    const addLog = (message: string, type = 'info') => {
        setLogs(prev => [{ message, type, timestamp: Date.now() }, ...prev].slice(0, 50));
    };

    const stopAutoTrade = useCallback(() => {
        if (!tradingRef.current) return;
        tradingRef.current.stopAutoTrade();
    }, []);

    const setConfig = useCallback(
        (config: any) => {
            if (!tradingRef.current) return;
            tradingRef.current.setConfig({ ...config, duration: tickDuration });
        },
        [tickDuration]
    );

    const resetSession = useCallback(() => {
        if (!tradingRef.current) return;
        tradingRef.current.resetSession();
        addLog('Session statistics reset', 'system');
    }, []);

    return {
        marketScores,
        selectedMarket,
        setSelectedMarket,
        selectedStrategy,
        setSelectedStrategy,
        selectedStrategies,
        setSelectedStrategies,
        patterns,
        signals: filteredSignals,
        stats,
        tradingStatus,
        tickDuration,
        setTickDuration,
        tradeOnce,
        startAutoTrade,
        stopAutoTrade,
        setConfig,
        resetSession,
        isConnected,
        isAuthorized,
        balance,
        logs,
    };
}
