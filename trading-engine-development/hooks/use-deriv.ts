'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { DerivWebSocketManager } from '@/lib/deriv-websocket-manager';
import { AnalysisEngine, type TickData, type AnalysisResult, type Signal } from '@/lib/analysis-engine';
import { AIPredictor, type PredictionResult } from '@/lib/ai-predictor';
import { marketDataDebugger } from '@/lib/market-data-debugger';

export interface DerivSymbol {
    symbol: string;
    display_name: string;
    market?: string;
    market_display_name?: string;
    pip_size: number;
}

export interface ConnectionLog {
    timestamp: number;
    message: string;
    type: 'info' | 'error' | 'warning';
}

export function useDeriv(initialSymbol = '', initialMaxTicks = 1000) {
    const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'reconnecting'>(
        'reconnecting'
    );
    const [currentPrice, setCurrentPrice] = useState<number | null>(null);
    const [currentDigit, setCurrentDigit] = useState<number | null>(null);
    const [tickCount, setTickCount] = useState(0);
    const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
    const [signals, setSignals] = useState<Signal[]>([]);
    const [aiPrediction, setAiPrediction] = useState<PredictionResult | null>(null);
    // Load persistent state from localStorage
    const getStoredValue = (key: string, defaultValue: any) => {
        if (typeof window === 'undefined') return defaultValue;
        const saved = localStorage.getItem(key);
        if (saved === null) return defaultValue;
        try {
            return JSON.parse(saved);
        } catch {
            return saved;
        }
    };

    const [symbol, setSymbol] = useState(() => getStoredValue('deriv_selected_symbol', initialSymbol));
    const [maxTicks, setMaxTicks] = useState(() => getStoredValue('deriv_max_ticks', initialMaxTicks));
    const [availableSymbols, setAvailableSymbols] = useState<DerivSymbol[]>([]);
    const [connectionLogs, setConnectionLogs] = useState<ConnectionLog[]>([]);
    const [proSignals, setProSignals] = useState<Signal[]>([]);

    const wsRef = useRef<DerivWebSocketManager | null>(null);
    const engineRef = useRef<AnalysisEngine | null>(null);
    const predictorRef = useRef<AIPredictor | null>(null);
    const subscriptionIdRef = useRef<string | null>(null);
    const tickCallbackRef = useRef<((tick: any) => void) | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        let isMounted = true;
        if (typeof window === 'undefined') return;

        wsRef.current = DerivWebSocketManager.getInstance();
        engineRef.current = new AnalysisEngine(maxTicks);
        predictorRef.current = new AIPredictor();

        const connectAndSubscribe = async () => {
            if (!isMounted) return;

            try {
                if (!wsRef.current) {
                    throw new Error('WebSocket manager not initialized');
                }

                // If already connected, just skip connection step
                if (!wsRef.current.isConnected()) {
                    setConnectionStatus('reconnecting');
                    await wsRef.current.connect();
                }

                setConnectionStatus('connected');
                addLog('Connected to Deriv WebSocket', 'info');

                // Get available symbols with fallback
                try {
                    const symbols = await wsRef.current.getActiveSymbols();
                    if (symbols && symbols.length > 0) {
                        const filteredSymbols = symbols
                            .filter(s => {
                                const market = (s.market || '').toUpperCase();
                                const marketName = (s.market_display_name || '').toUpperCase();
                                const sym = (s.symbol || '').toUpperCase();

                                return (
                                    market === 'SYNTHETIC_INDEX' ||
                                    marketName.includes('DERIVED') ||
                                    marketName.includes('SYNTHETIC') ||
                                    sym.includes('JUMP') ||
                                    sym.includes('BOOM') ||
                                    sym.includes('CRASH') ||
                                    sym.includes('R_') ||
                                    sym.includes('1HZ') ||
                                    sym.includes('STEP') ||
                                    sym.includes('RB')
                                );
                            })
                            .sort((a, b) => {
                                const symA = a.symbol.toUpperCase();
                                const symB = b.symbol.toUpperCase();
                                const isVolA = symA.startsWith('R_') || symA.includes('1HZ');
                                const isVolB = symB.startsWith('R_') || symB.includes('1HZ');
                                if (isVolA && !isVolB) return -1;
                                if (!isVolA && isVolB) return 1;
                                return a.display_name.localeCompare(b.display_name);
                            });

                        setAvailableSymbols(filteredSymbols as DerivSymbol[]);
                    }
                } catch (error) {
                    console.error('[v0] Failed to get active symbols, using defaults:', error);
                    // Don't crash or stay in reconnecting if symbols fail
                    if (availableSymbols.length === 0) {
                        setAvailableSymbols([
                            { symbol: 'R_100', display_name: 'Volatility 100 Index', pip_size: 2 },
                            { symbol: 'R_10', display_name: 'Volatility 10 Index', pip_size: 3 },
                        ] as DerivSymbol[]);
                    }
                }

                if (subscriptionIdRef.current) {
                    try {
                        await wsRef.current.unsubscribe(
                            subscriptionIdRef.current,
                            tickCallbackRef.current || undefined
                        );
                    } catch (e) {}
                }

                if (!symbol) return;

                // Populate engine with history
                try {
                    // Deriv API max is 5000 ticks per request
                    const history = await wsRef.current.getTicksHistory(symbol, 5000);
                    if (history && history.length > 0) {
                        engineRef.current?.addTicksBatch(history);
                        const lastTick = history[history.length - 1];
                        setCurrentPrice(lastTick.quote);
                        setCurrentDigit(lastTick.lastDigit);
                        setTickCount(engineRef.current?.getTicks().length || 0);

                        setAnalysis(engineRef.current?.getAnalysis() || null);
                        setSignals(engineRef.current?.generateSignals() || []);
                        setProSignals(engineRef.current?.generateProSignals() || []);
                    }
                } catch (e) {
                    console.error('[v0] History load failed:', e);
                }

                const tickHandler = (tick: any) => {
                    if (!tick || typeof tick.quote !== 'number') return;

                    const pipSize = wsRef.current?.getPipSize(symbol) || 2;
                    const tickData: any = {
                        epoch: tick.epoch,
                        quote: tick.quote,
                        symbol: tick.symbol || symbol,
                        pipSize: pipSize,
                    };

                    engineRef.current?.addTick(tickData);
                    setCurrentPrice(tick.quote);
                    setCurrentDigit(tick.lastDigit);
                    setTickCount(prev => prev + 1);

                    setAnalysis(engineRef.current?.getAnalysis() || null);
                    setSignals(engineRef.current?.generateSignals() || []);
                    setProSignals(engineRef.current?.generateProSignals() || []);

                    if (predictorRef.current && engineRef.current) {
                        const lastDigits = engineRef.current.getLastDigits();
                        const digitCounts = new Map<number, number>();
                        engineRef.current.getAnalysis()?.digitFrequencies.forEach(freq => {
                            digitCounts.set(freq.digit, freq.count);
                        });
                        setAiPrediction(predictorRef.current.predict(lastDigits, digitCounts));
                    }
                };

                tickCallbackRef.current = tickHandler;
                subscriptionIdRef.current = await wsRef.current.subscribeTicks(symbol, tickHandler);
                addLog(`Subscribed to ${symbol}`, 'info');
            } catch (error) {
                if (isMounted) {
                    console.error('[v0] Connection error loop:', error);
                    setConnectionStatus('disconnected');

                    reconnectTimeoutRef.current = setTimeout(() => {
                        if (isMounted) connectAndSubscribe();
                    }, 10000);
                }
            }
        };

        connectAndSubscribe();

        return () => {
            isMounted = false;
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            if (subscriptionIdRef.current && wsRef.current) {
                wsRef.current
                    .unsubscribe(subscriptionIdRef.current, tickCallbackRef.current || undefined)
                    .catch(error => {
                        console.error('[v0] Cleanup unsubscribe error:', error);
                    });
            }
        };
    }, [symbol, maxTicks]);

    const addLog = useCallback((message: string, type: 'info' | 'error' | 'warning') => {
        setConnectionLogs(prev => [...prev, { timestamp: Date.now(), message, type }].slice(-100));
    }, []);

    const changeSymbol = useCallback(async (newSymbol: string) => {
        console.log('[v0] Changing symbol to:', newSymbol);

        if (subscriptionIdRef.current && wsRef.current) {
            await wsRef.current.unsubscribe(subscriptionIdRef.current);
        }

        engineRef.current?.clear();
        setSymbol(newSymbol);
        if (typeof window !== 'undefined') {
            localStorage.setItem('deriv_selected_symbol', JSON.stringify(newSymbol));
        }
        setTickCount(0);
        setCurrentPrice(null);
        setCurrentDigit(null);
        setAnalysis(null);
        setSignals([]);
        setProSignals([]);
        setAiPrediction(null);
    }, []);

    const changeMaxTicks = useCallback((newMaxTicks: number) => {
        engineRef.current?.setMaxTicks(newMaxTicks);
        setMaxTicks(newMaxTicks);
        if (typeof window !== 'undefined') {
            localStorage.setItem('deriv_max_ticks', JSON.stringify(newMaxTicks));
        }
    }, []);

    const exportData = useCallback(
        (format: 'csv' | 'json') => {
            const ticks = engineRef.current?.getTicks() || [];
            const analysisData = engineRef.current?.getAnalysis();

            if (format === 'json') {
                return JSON.stringify({ ticks, analysis: analysisData, signals }, null, 2);
            } else {
                let csv = 'Epoch,Quote,Symbol,LastDigit\n';
                const lastDigits = engineRef.current?.getLastDigits() || [];
                ticks.forEach((tick, index) => {
                    csv += `${tick.epoch},${tick.quote},${tick.symbol},${lastDigits[index]}\n`;
                });
                return csv;
            }
        },
        [signals]
    );

    const getRecentDigits = useCallback((count = 20) => {
        return engineRef.current?.getRecentDigits(count) || [];
    }, []);

    return {
        connectionStatus,
        currentPrice,
        currentDigit,
        tickCount,
        analysis,
        signals: signals || [],
        proSignals: proSignals || [],
        aiPrediction,
        symbol,
        maxTicks,
        availableSymbols,
        connectionLogs,
        changeSymbol,
        changeMaxTicks,
        exportData,
        getRecentDigits,
    };
}
