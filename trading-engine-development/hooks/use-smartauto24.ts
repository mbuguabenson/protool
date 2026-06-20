'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { SmartAuto24Engine } from '@/lib/smartauto24-engine-integration';
import type { AnalysisSnapshot, BotSignal } from '@/lib/core-analytics-engine';
import { SmartIntelligenceEngine, type MarketScore } from '@/lib/trading/smart-intelligence-engine';
import { SmartPatternEngine, type PatternMatch } from '@/lib/trading/smart-pattern-engine';
import { AdaptiveStrategyManager, type StrategySignal } from '@/lib/trading/adaptive-strategy-manager';
import { AnalysisEngine } from '@/lib/analysis-engine';

export function useSmartAuto24(market: string, isConnected: boolean, maxTicks: number = 100) {
    const engineRef = useRef<SmartAuto24Engine>(new SmartAuto24Engine(maxTicks));

    useEffect(() => {
        if (engineRef.current) {
            // Re-initialize or update engine with new maxTicks
            // Assuming we want a fresh engine for new depth
            engineRef.current = new SmartAuto24Engine(maxTicks);
        }
    }, [maxTicks]);
    const intelligenceRef = useRef<SmartIntelligenceEngine | null>(null);
    const patternRef = useRef<SmartPatternEngine>(new SmartPatternEngine());
    const strategyRef = useRef<AdaptiveStrategyManager>(new AdaptiveStrategyManager());
    const analysisRef = useRef<AnalysisEngine>(new AnalysisEngine());

    const [currentDigit, setCurrentDigit] = useState<number | null>(null);
    const [snapshot, setSnapshot] = useState<AnalysisSnapshot | null>(null);
    const [signals, setSignals] = useState<BotSignal[]>([]);
    const [unifiedSignals, setUnifiedSignals] = useState<StrategySignal[]>([]);
    const [patterns, setPatterns] = useState<PatternMatch[]>([]);
    const [tickCount, setTickCount] = useState(0);
    const [activeBots, setActiveBots] = useState<string[]>(['even_odd']);
    const [marketScores, setMarketScores] = useState<MarketScore[]>([]);

    useEffect(() => {
        if (!isConnected) {
            if (intelligenceRef.current) {
                intelligenceRef.current.stopScanning();
            }
            return;
        }

        if (!intelligenceRef.current) {
            intelligenceRef.current = SmartIntelligenceEngine.getInstance();
        }

        intelligenceRef.current.setFocusMarket(market);
        intelligenceRef.current.startScanning();

        // After authorization completes, retry the auth-required 1HZ markets
        const { DerivWebSocketManager } = require('@/lib/deriv-websocket-manager');
        const wsManager = DerivWebSocketManager.getInstance();
        const onAuthorize = () => {
            intelligenceRef.current?.retryAuthMarkets();
        };
        wsManager.on('authorize', onAuthorize);

        const unsub = intelligenceRef.current.onUpdate(scores => {
            setMarketScores(scores);
        });

        return () => {
            if (unsub) unsub();
            wsManager.off('authorize', onAuthorize);
            // We don't stop scanning globally on unmount in case other components need it,
            // as it's a singleton, but we could if we wanted stricter resource management.
        };
    }, [isConnected, market]);

    // Set active bots
    const setBotsActive = useCallback((bots: string[]) => {
        setActiveBots(bots);
        engineRef.current.setActiveBots(bots);
    }, []);

    // Set pip size
    const setPipSize = useCallback((pipSize: number) => {
        engineRef.current.setPipSize(pipSize);
    }, []);

    // Process tick
    const processTick = useCallback((price: number) => {
        if (!engineRef.current) return;

        const result = engineRef.current.processTick(price);
        setCurrentDigit(result.digit);
        setSnapshot(result.snapshot);
        setSignals(result.signals);
        setTickCount(prev => prev + 1);

        // Update Pattern Engine
        const digits = result.snapshot.lastDigits;
        patternRef.current.updateWindow(digits);
        const currentPatterns = patternRef.current.analyze();
        setPatterns(currentPatterns);

        // Generate Unified Signals
        const allVariants = strategyRef.current.getSignalsWithVariants(currentPatterns);
        const proSignals = analysisRef.current.generateProSignals();
        const mappedProSignals: StrategySignal[] = proSignals.map(s => ({
            strategy: 'SuperSignals',
            type: s.type,
            barrier: s.targetDigit?.toString() || '0',
            confidence: s.probability,
            description: s.recommendation,
            entryStatus: s.status === 'TRADE NOW' ? 'Confirmed' : 'Waiting',
        }));

        setUnifiedSignals([...allVariants, ...mappedProSignals]);

        return result;
    }, []);

    // Record trade result
    const recordTradeResult = useCallback((botType: string, won: boolean) => {
        engineRef.current.recordTradeResult(botType, won);
    }, []);

    // Get bot state
    const getBotState = useCallback((botType: string) => {
        return engineRef.current.getBotState(botType);
    }, []);

    // Reset engine
    const reset = useCallback(() => {
        engineRef.current.reset();
        setCurrentDigit(null);
        setSnapshot(null);
        setSignals([]);
        setUnifiedSignals([]);
        setPatterns([]);
        setTickCount(0);
    }, []);

    return {
        engineRef,
        currentDigit,
        snapshot,
        signals,
        tickCount,
        activeBots,
        setBotsActive,
        setPipSize,
        processTick,
        recordTradeResult,
        getBotState,
        reset,
        marketScores,
        unifiedSignals,
        patterns,
    };
}
