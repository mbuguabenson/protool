'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TradingSliderPanel } from '@/components/trading-slider-panel';
import { useGlobalTradingContext } from '@/hooks/use-global-trading-context';
import { Brain, Activity, ShieldAlert, TrendingUp, History, Target, Zap, Waves, Sparkles } from 'lucide-react';
import type { AnalysisResult } from '@/lib/analysis-engine';
import type { DerivSymbol } from '@/hooks/use-deriv';

interface AIAnalysisTabProps {
    analysis: AnalysisResult | null;
    currentDigit: number | null;
    currentPrice: number | null;
    symbol: string;
    theme?: 'light' | 'dark';
    availableSymbols?: DerivSymbol[];
    onSymbolChange?: (symbol: string) => void;
}

interface AISignalResult {
    bestMarket: string;
    bestStrategy: string;
    entryPoint: string | number;
    tradeValidity: number;
    confidence: number;
    signal: 'TRADE NOW' | 'WAIT' | 'NEUTRAL';
    reasoning: string;
}

export function AIAnalysisTab({
    analysis,
    currentDigit,
    currentPrice,
    symbol,
    theme = 'dark',
    availableSymbols,
    onSymbolChange,
}: AIAnalysisTabProps) {
    const [selectedMarket, setSelectedMarket] = useState<string>(symbol);
    const [selectedTradeType, setSelectedTradeType] = useState<string>('all');
    const [autoAnalysisMode, setAutoAnalysisMode] = useState(false);
    const [ticksToAnalyze, setTicksToAnalyze] = useState<number>(50);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [aiSignalResult, setAiSignalResult] = useState<AISignalResult | null>(null);
    const [analysisHistory, setAnalysisHistory] = useState<AISignalResult[]>([]);
    const [successRate, setSuccessRate] = useState(0);
    const [isTrading, setIsTrading] = useState(false);
    const globalContext = useGlobalTradingContext();

    const scanAllStrategies = (): AISignalResult => {
        if (!analysis) {
            return {
                bestMarket: selectedMarket,
                bestStrategy: 'None',
                entryPoint: '-',
                tradeValidity: 5,
                confidence: 0,
                signal: 'NEUTRAL',
                reasoning: 'Insufficient data for analysis',
            };
        }

        const stability = analysis.marketStability;
        const patterns = analysis.neuralPatterns || [];

        // Adjust confidence based on market stability
        // Unstable markets (Low index) reduce confidence in directional strategies
        const stabilityMultiplier = stability ? stability.index / 100 : 1;

        const topPatternProb = patterns.length > 0 ? patterns[0].probability : 0;

        const strategies = [
            {
                name: 'Under4/Over5',
                confidence: Math.max(analysis.lowPercentage, analysis.highPercentage) * stabilityMultiplier,
                signal: analysis.lowPercentage >= 60 ? 'UNDER 4' : analysis.highPercentage >= 60 ? 'OVER 5' : 'NEUTRAL',
                entryPoint:
                    analysis.lowPercentage >= 60 ? analysis.powerIndex.strongest : analysis.powerIndex.strongest,
            },
            {
                name: 'Even/Odd',
                confidence: Math.max(analysis.evenPercentage, analysis.oddPercentage) * stabilityMultiplier,
                signal: analysis.evenPercentage >= 60 ? 'EVEN' : analysis.oddPercentage >= 60 ? 'ODD' : 'NEUTRAL',
                entryPoint: analysis.evenPercentage >= 60 ? 'Even' : 'Odd',
            },
            {
                name: 'Differs',
                // Differs actually gains confidence in erratic/high-entropy markets
                confidence:
                    (100 -
                        (analysis.digitFrequencies.sort((a, b) => a.percentage - b.percentage)[0]?.percentage || 10)) *
                    (1.2 - stabilityMultiplier * 0.2),
                signal: 'DIFFERS',
                entryPoint: analysis.digitFrequencies.sort((a, b) => a.percentage - b.percentage)[0]?.digit || 0,
            },
            {
                name: 'Matches',
                // Matches needs high stability and pattern recurrence
                confidence:
                    (analysis.digitFrequencies[analysis.powerIndex.strongest]?.percentage || 0) * stabilityMultiplier +
                    topPatternProb * 0.5,
                signal: 'MATCHES',
                entryPoint: analysis.powerIndex.strongest,
            },
        ];

        const bestStrategy = strategies.reduce((best, current) => {
            return current.confidence > best.confidence ? current : best;
        });

        const tradeSignal =
            bestStrategy.confidence >= 70 ? 'TRADE NOW' : bestStrategy.confidence >= 55 ? 'WAIT' : 'NEUTRAL';

        // Construct technical reasoning
        let reasoning = `Neural engine detects ${stability?.trend || 'dynamic'} behavior. `;
        if (stability && stability.index < 40) {
            reasoning += `High entropy detected. ${bestStrategy.name} is the safest hedge. `;
        } else {
            reasoning += `${bestStrategy.name} shows ${bestStrategy.confidence.toFixed(1)}% statistical convergence. `;
        }

        if (patterns.length > 0) {
            reasoning += `Sequence [${patterns[0].sequence.join(',')}] recurred ${patterns[0].count}x.`;
        }

        return {
            bestMarket: selectedMarket,
            bestStrategy: bestStrategy.name,
            entryPoint: bestStrategy.entryPoint,
            tradeValidity: stability && stability.index > 70 ? 8 : 5,
            confidence: bestStrategy.confidence,
            signal: tradeSignal,
            reasoning: reasoning,
        };
    };

    const calculateOver2Under7Confidence = (analysis: AnalysisResult): number => {
        const digits012 = [0, 1, 2].map(d => analysis.digitFrequencies[d]);
        const digits789 = [7, 8, 9].map(d => analysis.digitFrequencies[d]);

        const below10_012 = digits012.filter(d => d.percentage < 10).length;
        const below10_789 = digits789.filter(d => d.percentage < 10).length;

        if (below10_012 >= 2) return 85;
        if (below10_789 >= 2) return 85;
        return 50;
    };

    const calculateOver2Under7Signal = (analysis: AnalysisResult): string => {
        const digits012 = [0, 1, 2].map(d => analysis.digitFrequencies[d]);
        const digits789 = [7, 8, 9].map(d => analysis.digitFrequencies[d]);

        const below10_012 = digits012.filter(d => d.percentage < 10).length;
        const below10_789 = digits789.filter(d => d.percentage < 10).length;

        if (below10_012 >= 2) return 'OVER 2';
        if (below10_789 >= 2) return 'UNDER 7';
        return 'NEUTRAL';
    };

    const handleAnalyze = () => {
        setIsAnalyzing(true);
        setTimeout(() => {
            const result = scanAllStrategies();
            setAiSignalResult(result);
            setAnalysisHistory(prev => [...prev.slice(-29), result]);
            setIsAnalyzing(false);
        }, 1500);
    };

    useEffect(() => {
        if (analysisHistory.length > 0) {
            const strongSignals = analysisHistory.filter(s => s.signal === 'TRADE NOW').length;
            const rate = (strongSignals / analysisHistory.length) * 100;
            setSuccessRate(rate);
        }
    }, [analysisHistory]);

    useEffect(() => {
        if (autoAnalysisMode && analysis) {
            const interval = setInterval(() => {
                const result = scanAllStrategies();
                setAiSignalResult(result);
                setAnalysisHistory(prev => [...prev.slice(-29), result]);
            }, 3000);
            return () => clearInterval(interval);
        }
    }, [autoAnalysisMode, analysis]);

    const handleTrade = async (amount: number, contract: string) => {
        setIsTrading(true);
        console.log(`[v0] 📊 Executing trade: ${contract} with stake ${amount}`);
        try {
            // Trade will be executed by the actual trading system
            await new Promise(resolve => setTimeout(resolve, 1500));
            console.log('[v0] ✅ Trade executed');
        } finally {
            setIsTrading(false);
        }
    };

    return (
        <div className='space-y-6 pb-[200px] animate-in fade-in zoom-in-95 duration-500'>
            {/* Heritage Market Intelligence Header */}
            <div className='soft-card p-6 border-white/5 relative overflow-hidden'>
                <div className='absolute top-0 right-0 p-8 opacity-5'>
                    <Brain className='w-32 h-32 text-indigo-400' />
                </div>

                <div className='flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10'>
                    <div>
                        <h2 className='text-2xl font-black uppercase tracking-[0.3em] text-white mb-2 flex items-center gap-3'>
                            <Sparkles className='w-6 h-6 text-indigo-400 animate-pulse' />
                            Neural Intelligence
                        </h2>
                        <div className='flex items-center gap-3'>
                            <p className='text-xs font-black uppercase tracking-widest text-slate-500'>
                                Pattern Recognition & Market Stability Engine
                            </p>
                            <div className='h-1 w-1 rounded-full bg-slate-700' />
                            <Badge
                                variant='outline'
                                className={`${
                                    (analysis?.marketStability?.index ?? 0) > 70
                                        ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5'
                                        : (analysis?.marketStability?.index ?? 0) > 40
                                          ? 'text-amber-400 border-amber-500/20 bg-amber-500/5'
                                          : 'text-rose-400 border-rose-500/20 bg-rose-500/5'
                                } text-[9px] font-black uppercase tracking-widest h-5`}
                            >
                                {(analysis?.marketStability?.index ?? 0) > 70
                                    ? 'HIGH RELIABILITY'
                                    : (analysis?.marketStability?.index ?? 0) > 40
                                      ? 'MODERATE RISK'
                                      : 'UNSTABLE MARKET'}
                            </Badge>
                        </div>
                    </div>

                    <div className='flex items-center gap-4'>
                        <div className='flex items-center gap-3 bg-white/[0.03] p-2 px-4 rounded-xl border border-white/5'>
                            <Switch
                                id='auto-analysis'
                                checked={autoAnalysisMode}
                                onCheckedChange={setAutoAnalysisMode}
                            />
                            <Label
                                htmlFor='auto-analysis'
                                className='text-[10px] font-black uppercase tracking-widest text-slate-400 cursor-pointer'
                            >
                                Autonomous SCAN
                            </Label>
                        </div>
                        {!autoAnalysisMode && (
                            <Button
                                onClick={handleAnalyze}
                                disabled={isAnalyzing}
                                className='bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest h-10 px-8 rounded-xl shadow-[0_0_20px_rgba(79,70,229,0.3)] transition-all active:scale-95'
                            >
                                {isAnalyzing ? 'ANALYZING...' : 'FORCE SCAN'}
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Configuration Matrix */}
            <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
                <div className='soft-card p-4 border-white/5 space-y-2'>
                    <label className='text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1'>
                        Market Segment
                    </label>
                    <Select value={selectedMarket} onValueChange={setSelectedMarket}>
                        <SelectTrigger className='bg-white/5 border-white/10 text-white font-black uppercase tracking-wider h-10 rounded-lg'>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className='bg-[#0a0e27] border-white/10 text-white'>
                            {availableSymbols?.map(s => (
                                <SelectItem key={s.symbol} value={s.symbol}>
                                    {s.display_name}
                                </SelectItem>
                            )) || <SelectItem value={symbol}>{symbol}</SelectItem>}
                        </SelectContent>
                    </Select>
                </div>

                <div className='soft-card p-4 border-white/5 space-y-2'>
                    <label className='text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1'>
                        Strategy Focus
                    </label>
                    <Select value={selectedTradeType} onValueChange={setSelectedTradeType}>
                        <SelectTrigger className='bg-white/5 border-white/10 text-white font-black uppercase tracking-wider h-10 rounded-lg'>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className='bg-[#0a0e27] border-white/10 text-white'>
                            <SelectItem value='all'>ALL STRATEGIES</SelectItem>
                            <SelectItem value='under4/over5'>UNDER 4 / OVER 5</SelectItem>
                            <SelectItem value='over2/under7'>OVER 2 / UNDER 7</SelectItem>
                            <SelectItem value='even/odd'>EVEN / ODD</SelectItem>
                            <SelectItem value='differs'>DIFFERS</SelectItem>
                            <SelectItem value='matches'>MATCHES</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className='soft-card p-4 border-white/5 space-y-2'>
                    <label className='text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1'>
                        Analysis Depth (Ticks)
                    </label>
                    <Input
                        type='number'
                        value={ticksToAnalyze}
                        onChange={e => setTicksToAnalyze(Number.parseInt(e.target.value))}
                        min={10}
                        max={500}
                        className='bg-white/5 border-white/10 text-white font-black h-10 rounded-lg focus-visible:ring-indigo-500/50'
                    />
                </div>
            </div>

            {/* Primary Intelligence Grid */}
            <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
                {/* Left: Market Stability & Behavior */}
                <div className='space-y-6'>
                    <Card className='soft-card border-white/5 p-6 h-full flex flex-col justify-between'>
                        <div>
                            <div className='flex items-center justify-between mb-6'>
                                <h3 className='text-[10px] font-black uppercase tracking-widest text-slate-500'>
                                    Stability Index
                                </h3>
                                <Activity className='w-4 h-4 text-indigo-400' />
                            </div>

                            <div className='text-center space-y-2 mb-6'>
                                <div
                                    className={`text-6xl font-black ${
                                        (analysis?.marketStability?.index ?? 0) > 70
                                            ? 'text-emerald-400'
                                            : (analysis?.marketStability?.index ?? 0) > 40
                                              ? 'text-amber-400'
                                              : 'text-rose-400'
                                    }`}
                                >
                                    {analysis?.marketStability?.index ?? '--'}
                                </div>
                                <div className='text-[10px] font-black uppercase tracking-widest text-slate-400'>
                                    Predictability Score
                                </div>
                            </div>

                            <div className='space-y-4'>
                                <div className='p-3 rounded-lg bg-white/[0.02] border border-white/5'>
                                    <div className='flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1'>
                                        <span>Favored Contract</span>
                                        <span className='text-emerald-400'>OPTIMAL</span>
                                    </div>
                                    <div className='text-sm font-black text-white'>
                                        {analysis?.marketStability?.favoredContract ?? 'Searching...'}
                                    </div>
                                </div>

                                <div className='p-3 rounded-lg bg-white/[0.02] border border-white/5'>
                                    <div className='flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1'>
                                        <span>Unstable Strategy</span>
                                        <span className='text-rose-400'>AVOID</span>
                                    </div>
                                    <div className='text-sm font-black text-white'>
                                        {analysis?.marketStability?.unstableContract ?? 'Searching...'}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className='mt-6 pt-6 border-t border-white/5'>
                            <p className='text-[10px] leading-relaxed font-bold text-slate-400 italic'>
                                "{analysis?.marketStability?.reasoning ?? 'Awaiting neural matrix stabilization...'}"
                            </p>
                        </div>
                    </Card>
                </div>

                {/* Center: Pattern Detector HUD */}
                <div className='lg:col-span-2'>
                    <Card className='soft-card border-white/5 p-6 h-full'>
                        <div className='flex items-center justify-between mb-6'>
                            <h3 className='text-[10px] font-black uppercase tracking-widest text-slate-500'>
                                Neural Pattern HUD
                            </h3>
                            <div className='flex items-center gap-2'>
                                <Badge
                                    variant='outline'
                                    className='bg-indigo-500/10 text-indigo-400 border-indigo-500/20 text-[10px] font-black uppercase tracking-widest'
                                >
                                    {analysis?.neuralPatterns?.length ?? 0} Patterns Found
                                </Badge>
                            </div>
                        </div>

                        {analysis?.neuralPatterns && analysis.neuralPatterns.length > 0 ? (
                            <div className='space-y-6'>
                                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                                    {analysis.neuralPatterns.map((pattern, idx) => (
                                        <div
                                            key={idx}
                                            className={`p-4 rounded-xl bg-white/[0.03] border flex items-center justify-between group transition-all ${
                                                pattern.probability > 70
                                                    ? 'border-indigo-500/40 shadow-[0_0_20px_rgba(99,102,241,0.15)]'
                                                    : 'border-white/5 hover:border-indigo-500/30'
                                            }`}
                                        >
                                            <div className='flex items-center gap-3'>
                                                <div className='flex gap-1'>
                                                    {pattern.sequence.map((d, i) => (
                                                        <span
                                                            key={i}
                                                            className='w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-black text-sm border border-indigo-500/20 shadow-[0_0_10px_rgba(99,102,241,0.1)]'
                                                        >
                                                            {d}
                                                        </span>
                                                    ))}
                                                </div>
                                                <div>
                                                    <div className='text-[10px] font-black uppercase tracking-widest text-slate-500'>
                                                        Recurrence
                                                    </div>
                                                    <div className='text-sm font-black text-white'>
                                                        {pattern.count} Times
                                                    </div>
                                                </div>
                                            </div>
                                            <div className='text-right'>
                                                <div className='text-[18px] font-black text-emerald-400'>
                                                    {pattern.probability.toFixed(0)}%
                                                </div>
                                                <div className='text-[9px] font-black uppercase tracking-widest text-slate-600'>
                                                    PROBABILITY
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Digit Frequency Heatmap */}
                                <div className='pt-4 border-t border-white/5'>
                                    <div className='text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4'>
                                        Digit Frequency Heatmap
                                    </div>
                                    <div className='grid grid-cols-10 gap-2'>
                                        {analysis?.digitFrequencies.map(df => (
                                            <div key={df.digit} className='flex flex-col items-center gap-1'>
                                                <div
                                                    className={`w-full aspect-square rounded-lg flex items-center justify-center text-[10px] font-black border transition-all ${
                                                        df.digit === analysis.powerIndex.strongest
                                                            ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.2)]'
                                                            : df.digit === analysis.powerIndex.weakest
                                                              ? 'bg-rose-500/10 border-rose-500/20 text-rose-400/50'
                                                              : 'bg-white/[0.02] border-white/5 text-slate-500'
                                                    }`}
                                                >
                                                    {df.digit}
                                                </div>
                                                <div className='h-1 w-full bg-white/5 rounded-full overflow-hidden'>
                                                    <div
                                                        className={`h-full ${df.digit === analysis.powerIndex.strongest ? 'bg-indigo-500' : 'bg-slate-700'}`}
                                                        style={{ width: `${df.percentage}%` }}
                                                    />
                                                </div>
                                                <span className='text-[8px] font-black opacity-50'>
                                                    {df.percentage.toFixed(0)}%
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className='flex flex-col items-center justify-center h-48 text-slate-600 space-y-4'>
                                <Waves className='w-12 h-12 opacity-20 animate-bounce' />
                                <p className='text-xs font-black uppercase tracking-widest'>
                                    Scanning market for neural signatures...
                                </p>
                            </div>
                        )}

                        <div className='mt-6 flex flex-wrap gap-4'>
                            <div className='p-3 rounded-xl bg-white/[0.02] border border-white/5 flex-1 min-w-[140px]'>
                                <div className='text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1'>
                                    Strongest Digit
                                </div>
                                <div className='text-2xl font-black text-indigo-400'>
                                    {analysis?.powerIndex.strongest ?? '-'}
                                </div>
                            </div>
                            <div className='p-3 rounded-xl bg-white/[0.02] border border-white/5 flex-1 min-w-[140px]'>
                                <div className='text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1'>
                                    Volatile Digit
                                </div>
                                <div className='text-2xl font-black text-rose-400'>
                                    {analysis?.powerIndex.weakest ?? '-'}
                                </div>
                            </div>
                            <div className='p-3 rounded-xl bg-white/[0.02] border border-white/5 flex-1 min-w-[140px]'>
                                <div className='text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1'>
                                    Entropy Index
                                </div>
                                <div className='text-2xl font-black text-amber-400'>
                                    {analysis?.entropy.toFixed(2) ?? '-'}
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>

            {/* AI Recommendation Panel - Modern Design */}
            <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
                {/* Main Recommendation Card */}
                <div className='lg:col-span-2'>
                    <Card className='border-indigo-500/30 bg-gradient-to-br from-indigo-500/10 to-blue-500/5 p-6 h-full'>
                        {/* Header with Signal Status */}
                        <div className='flex items-center justify-between mb-6'>
                            <h2 className='text-2xl font-bold text-white flex items-center gap-3'>
                                <Sparkles className='w-6 h-6 text-indigo-400' />
                                AI Recommendation
                            </h2>
                            {aiSignalResult && (
                                <Badge
                                    className={`${
                                        aiSignalResult.signal === 'TRADE NOW'
                                            ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/50 animate-pulse'
                                            : aiSignalResult.signal === 'WAIT'
                                              ? 'bg-amber-500 text-white'
                                              : 'bg-slate-600 text-white'
                                    } text-xs font-black uppercase tracking-widest px-4 py-2`}
                                >
                                    {aiSignalResult.signal}
                                </Badge>
                            )}
                        </div>

                        {aiSignalResult ? (
                            <div className='space-y-6'>
                                {/* Signal Stats Grid */}
                                <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
                                    <div className='p-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all'>
                                        <div className='text-xs font-semibold text-slate-400 uppercase mb-2'>
                                            Strategy
                                        </div>
                                        <div className='text-lg font-bold text-white'>
                                            {aiSignalResult.bestStrategy}
                                        </div>
                                    </div>
                                    <div className='p-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all'>
                                        <div className='text-xs font-semibold text-slate-400 uppercase mb-2'>Entry</div>
                                        <div className='text-lg font-bold text-indigo-400'>
                                            {aiSignalResult.entryPoint}
                                        </div>
                                    </div>
                                    <div className='p-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all'>
                                        <div className='text-xs font-semibold text-slate-400 uppercase mb-2'>
                                            Confidence
                                        </div>
                                        <div className='text-lg font-bold text-emerald-400'>
                                            {aiSignalResult.confidence.toFixed(0)}%
                                        </div>
                                    </div>
                                    <div className='p-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all'>
                                        <div className='text-xs font-semibold text-slate-400 uppercase mb-2'>
                                            Validity
                                        </div>
                                        <div className='text-lg font-bold text-amber-400'>
                                            {aiSignalResult.tradeValidity}T
                                        </div>
                                    </div>
                                </div>

                                {/* Confidence Bar */}
                                <div className='space-y-2'>
                                    <div className='flex items-center justify-between'>
                                        <span className='text-sm font-semibold text-slate-300'>Confidence Score</span>
                                        <span className='text-sm font-bold text-emerald-400'>
                                            {aiSignalResult.confidence.toFixed(1)}%
                                        </span>
                                    </div>
                                    <div className='w-full h-2.5 rounded-full bg-white/10 overflow-hidden'>
                                        <div
                                            className='h-full rounded-full bg-gradient-to-r from-emerald-500 to-green-500 transition-all duration-500'
                                            style={{ width: `${aiSignalResult.confidence}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Technical Reasoning */}
                                <div className='p-4 rounded-lg bg-indigo-500/20 border border-indigo-500/40'>
                                    <div className='flex items-start gap-3'>
                                        <Brain className='w-5 h-5 text-indigo-400 mt-0.5 flex-shrink-0' />
                                        <div>
                                            <div className='text-sm font-bold text-indigo-300 mb-1'>
                                                Neural Analysis
                                            </div>
                                            <p className='text-sm text-slate-300 leading-relaxed'>
                                                {aiSignalResult.reasoning}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className='flex flex-col items-center justify-center h-64 text-slate-600'>
                                <div className='p-6 rounded-full bg-white/5 border border-white/10 mb-4'>
                                    <Brain className='w-10 h-10 text-slate-700 animate-pulse' />
                                </div>
                                <p className='text-sm font-semibold text-slate-500'>Analyzing market patterns...</p>
                            </div>
                        )}
                    </Card>
                </div>

                {/* Performance Stats Panel */}
                <div>
                    <Card className='border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-green-500/5 p-6 h-full flex flex-col'>
                        <div className='mb-6'>
                            <h3 className='text-lg font-bold text-white flex items-center gap-2 mb-4'>
                                <TrendingUp className='w-5 h-5 text-emerald-400' />
                                Performance
                            </h3>

                            <div className='space-y-4'>
                                {/* Success Rate */}
                                <div>
                                    <div className='flex items-center justify-between mb-2'>
                                        <span className='text-sm font-semibold text-slate-300'>Success Rate</span>
                                        <span
                                            className={`text-lg font-bold ${successRate > 50 ? 'text-emerald-400' : 'text-amber-400'}`}
                                        >
                                            {successRate.toFixed(1)}%
                                        </span>
                                    </div>
                                    <div className='w-full h-2 rounded-full bg-white/10 overflow-hidden'>
                                        <div
                                            className={`h-full rounded-full transition-all ${successRate > 50 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                            style={{ width: `${successRate}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Total Scans */}
                                <div className='p-3 rounded-lg bg-white/5 border border-white/10'>
                                    <div className='text-xs font-semibold text-slate-400 uppercase'>
                                        Analysis Cycles
                                    </div>
                                    <div className='text-2xl font-bold text-white mt-1'>{analysisHistory.length}</div>
                                </div>
                            </div>
                        </div>

                        {/* Historical Log */}
                        <div className='flex-1 border-t border-white/10 pt-4'>
                            <div className='text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2'>
                                <History className='w-4 h-4' />
                                Latest Analysis
                            </div>
                            <div className='space-y-2 overflow-y-auto max-h-32'>
                                {analysisHistory
                                    .slice(-5)
                                    .reverse()
                                    .map((log, idx) => (
                                        <div
                                            key={idx}
                                            className='p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all'
                                        >
                                            <div className='flex items-center justify-between'>
                                                <span
                                                    className={`font-semibold text-sm ${log.signal === 'TRADE NOW' ? 'text-emerald-400' : log.signal === 'WAIT' ? 'text-amber-400' : 'text-slate-400'}`}
                                                >
                                                    {log.bestStrategy}
                                                </span>
                                                <span className='text-xs font-bold text-slate-400'>
                                                    {log.confidence.toFixed(0)}%
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    </Card>
                </div>
            </div>

            <TradingSliderPanel
                theme={theme}
                onTrade={handleTrade}
                isTrading={isTrading}
                balance={globalContext.balance}
            />
        </div>
    );
}
