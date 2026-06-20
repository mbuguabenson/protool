'use client';

import { CoreAnalyticsEngine, type AnalysisSnapshot } from './core-analytics-engine';
import { EvenOddBot, OverUnderBot, DiffersBot, MatchesBot, type BotSignal } from './bot-engines';

export class SmartAuto24Engine {
    private analyticsEngine: CoreAnalyticsEngine;
    private evenOddBot: EvenOddBot;
    private overUnderBot: OverUnderBot;
    private differsBot: DiffersBot;
    private matchesBot: MatchesBot;

    private currentSnapshot: AnalysisSnapshot | null = null;
    private signals: BotSignal[] = [];
    private activeBots: Set<string> = new Set();

    constructor(maxTicks: number = 100) {
        this.analyticsEngine = new CoreAnalyticsEngine(maxTicks);
        this.evenOddBot = new EvenOddBot();
        this.overUnderBot = new OverUnderBot();
        this.differsBot = new DiffersBot();
        this.matchesBot = new MatchesBot();
    }

    setPipSize(pipSize: number): void {
        this.analyticsEngine.setPipSize(pipSize);
    }

    // Add a new tick and generate analysis
    processTick(price: number): { digit: number; snapshot: AnalysisSnapshot; signals: BotSignal[] } {
        const digit = this.analyticsEngine.addTick(price);
        this.currentSnapshot = this.analyticsEngine.analyze();

        // Generate signals from all active bots
        this.signals = [];

        if (this.activeBots.has('even_odd')) {
            const signal = this.evenOddBot.analyze(this.currentSnapshot);
            this.signals.push(signal);
        }

        if (this.activeBots.has('over_under')) {
            const signal = this.overUnderBot.analyze(this.currentSnapshot);
            this.signals.push(signal);
        }

        if (this.activeBots.has('differs')) {
            const signal = this.differsBot.analyze(this.currentSnapshot);
            this.signals.push(signal);
        }

        if (this.activeBots.has('matches')) {
            const signal = this.matchesBot.analyze(this.currentSnapshot);
            this.signals.push(signal);
        }

        return {
            digit,
            snapshot: this.currentSnapshot,
            signals: this.signals,
        };
    }

    // Get current analysis snapshot
    getCurrentSnapshot(): AnalysisSnapshot | null {
        return this.currentSnapshot;
    }

    // Get current signals
    getSignals(): BotSignal[] {
        return this.signals;
    }

    // Enable/disable specific bots
    setActiveBots(bots: string[]): void {
        this.activeBots.clear();
        bots.forEach(bot => this.activeBots.add(bot));
    }

    // Get bot state
    isBotActive(botType: string): boolean {
        return this.activeBots.has(botType);
    }

    // Reset engine
    reset(): void {
        this.analyticsEngine = new CoreAnalyticsEngine(this.analyticsEngine['maxTicks']);
        this.currentSnapshot = null;
        this.signals = [];
    }

    // Record trade result for bot learning
    recordTradeResult(botType: string, won: boolean, confidence: number = 0): void {
        switch (botType) {
            case 'even_odd':
                this.evenOddBot.recordResult(won, confidence);
                break;
            case 'over_under':
                this.overUnderBot.recordResult(won, confidence);
                break;
            case 'differs':
                this.differsBot.recordResult(won, confidence);
                break;
            case 'matches':
                this.matchesBot.recordResult(won, confidence);
                break;
        }
    }

    // Get bot state info
    getBotState(botType: string) {
        switch (botType) {
            case 'even_odd':
                return this.evenOddBot.getState();
            case 'over_under':
                return this.overUnderBot.getState();
            case 'differs':
                return this.differsBot.getState();
            case 'matches':
                return this.matchesBot.getState();
            default:
                return null;
        }
    }
}
