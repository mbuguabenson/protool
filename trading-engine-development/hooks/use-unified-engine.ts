'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { getOrCreateEngine, type UnifiedTradingEngine, type EngineState } from '@/lib/unified-trading-engine';
import type { AnalysisSnapshot, PowerTrend, BotSignal } from '@/lib/core-analytics-engine';
import type { Trade, RiskMetrics } from '@/lib/trade-execution-engine';

export interface UseUnifiedEngineReturn {
    engine: UnifiedTradingEngine | null;
    state: EngineState;
    analysis: AnalysisSnapshot | null;
    signals: Record<string, BotSignal>;
    riskMetrics: RiskMetrics | null;
    trades: Trade[];
    stats: any;
    processTick: (price: number) => void;
    executeTrade: (botType: string, signal: BotSignal) => Trade | null;
    recordResult: (tradeId: string, result: 'win' | 'loss', profit: number) => void;
    reset: () => void;
}

export const useUnifiedEngine = (): UseUnifiedEngineReturn => {
    const engineRef = useRef<UnifiedTradingEngine | null>(null);
    const [state, setState] = useState<EngineState>({
        isConnected: false,
        isAnalyzing: false,
        currentAnalysis: null,
        botSignals: {},
        riskMetrics: null,
        recentTrades: [],
    });

    const [analysis, setAnalysis] = useState<AnalysisSnapshot | null>(null);
    const [signals, setSignals] = useState<Record<string, BotSignal>>({});
    const [riskMetrics, setRiskMetrics] = useState<RiskMetrics | null>(null);
    const [trades, setTrades] = useState<Trade[]>([]);
    const [stats, setStats] = useState<any>(null);

    // Initialize engine
    useEffect(() => {
        try {
            engineRef.current = getOrCreateEngine();
            console.log('[v0] Unified trading engine initialized');

            // Subscribe to engine events
            const unsubscribeTick = engineRef.current.on('data_updated', (data: any) => {
                console.log('[v0] Tick processed:', data);
            });

            const unsubscribeSignals = engineRef.current.on('signals_updated', (sigs: any) => {
                setSignals(sigs);
                console.log('[v0] Bot signals updated:', sigs);
            });

            const unsubscribeState = engineRef.current.on('state_updated', (newState: any) => {
                setState(newState);
                setAnalysis(newState.currentAnalysis);
                setRiskMetrics(newState.riskMetrics);
                setTrades(newState.recentTrades);
                setStats(engineRef.current?.getStats());
            });

            const unsubscribeTrade = engineRef.current.on('trade_placed', (trade: any) => {
                console.log('[v0] Trade executed:', trade);
            });

            const unsubscribeResult = engineRef.current.on('trade_completed', (result: any) => {
                console.log('[v0] Trade result recorded:', result);
            });

            return () => {
                unsubscribeTick();
                unsubscribeSignals();
                unsubscribeState();
                unsubscribeTrade();
                unsubscribeResult();
            };
        } catch (error) {
            console.error('[v0] Error initializing engine:', error);
        }
    }, []);

    // Process tick
    const processTick = useCallback((price: number, symbol?: string) => {
        if (!engineRef.current) return;
        console.log('[v0] Processing tick:', price, symbol);
        engineRef.current.processTick(price, symbol);
    }, []);

    // Execute trade
    const executeTrade = useCallback((botType: string, signal: BotSignal): Trade | null => {
        if (!engineRef.current) return null;
        console.log('[v0] Executing trade from bot:', botType, signal);
        return engineRef.current.executeBotTrade(botType, signal);
    }, []);

    // Record trade result
    const recordResult = useCallback((tradeId: string, result: 'win' | 'loss', profit: number) => {
        if (!engineRef.current) return;
        console.log('[v0] Recording trade result:', { tradeId, result, profit });
        engineRef.current.recordTradeResult(tradeId, result, profit);
    }, []);

    // Reset engine
    const reset = useCallback(() => {
        if (!engineRef.current) return;
        console.log('[v0] Resetting trading engine');
        engineRef.current.reset();
    }, []);

    return {
        engine: engineRef.current,
        state,
        analysis,
        signals,
        riskMetrics,
        trades,
        stats,
        processTick,
        executeTrade,
        recordResult,
        reset,
    };
};
