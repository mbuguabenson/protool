'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import type { DerivSymbol } from '@/hooks/use-deriv';


interface MoneyMakerTabProps {
    recentDigits: number[];
    currentDigit: number | null;
    currentPrice: number | null;
    theme?: 'light' | 'dark';
    symbol?: string;
    availableSymbols?: DerivSymbol[];
    onSymbolChange?: (symbol: string) => void;
    tickCount?: number;
}

export function MoneyMakerTab({
    recentDigits,
    currentDigit,
    currentPrice,
    theme = 'dark',
    symbol,
    availableSymbols = [],
    onSymbolChange,
    tickCount,
}: MoneyMakerTabProps) {
    const [strategy, setStrategy] = useState<
        'over-under' | 'even-odd' | 'rise-fall' | 'differs' | 'matches' | 'recovery'
    >('over-under');
    const [autoMarkets, setAutoMarkets] = useState(true);
    const [selectedMarket, setSelectedMarket] = useState<'over' | 'under' | 'manual'>('manual');
    const [stake, setStake] = useState(10);
    const [ticks, setTicks] = useState(5);
    const [entryPoint, setEntryPoint] = useState(4);
    const [useMartingale, setUseMartingale] = useState(false);
    const [autoTrading, setAutoTrading] = useState(false);
    const [transactionHistory, setTransactionHistory] = useState<any[]>([]);


    // Analyze last 500, 60, and 15 ticks
    const last500 = recentDigits.slice(-500);
    const last60 = recentDigits.slice(-60);
    const last15 = recentDigits.slice(-15);
    const last7 = recentDigits.slice(-7);

    // Over/Under Analysis (0-4 vs 5-9)
    const analyzeOverUnder = () => {
        const under500 = last500.filter(d => d <= 4).length;
        const over500 = last500.filter(d => d >= 5).length;
        const under60 = last60.filter(d => d <= 4).length;
        const over60 = last60.filter(d => d >= 5).length;
        const under15 = last15.filter(d => d <= 4).length;
        const over15 = last15.filter(d => d >= 5).length;

        const underPercent500 = (under500 / Math.max(1, last500.length)) * 100;
        const overPercent500 = (over500 / Math.max(1, last500.length)) * 100;
        const underPercent60 = (under60 / Math.max(1, last60.length)) * 100;
        const overPercent60 = (over60 / Math.max(1, last60.length)) * 100;
        const underPercent15 = (under15 / Math.max(1, last15.length)) * 100;
        const overPercent15 = (over15 / Math.max(1, last15.length)) * 100;

        // Find highest digits
        const getHighestDigit = (digits: number[], range: [number, number]) => {
            const filtered = digits.filter(d => d >= range[0] && d <= range[1]);
            if (filtered.length === 0) return null;
            const counts = new Map<number, number>();
            filtered.forEach(d => counts.set(d, (counts.get(d) || 0) + 1));
            return Array.from(counts.entries()).reduce((a, b) => (a[1] > b[1] ? a : b))[0];
        };

        const highestUnder = getHighestDigit(last60, [0, 4]);
        const highestOver = getHighestDigit(last60, [5, 9]);

        // Signal determination
        let signal = 'NEUTRAL';
        let signalColor = 'gray';
        let signalMessage = '';
        let description = '';
        let skipTicks = 0;

        const maxPower = Math.max(overPercent60, underPercent60);
        const dominant = overPercent60 > underPercent60 ? 'OVER' : 'UNDER';
        const dominantPercent = Math.max(overPercent60, underPercent60);

        if (
            dominantPercent >= 55 &&
            ((dominant === 'OVER' && overPercent15 > overPercent60) ||
                (dominant === 'UNDER' && underPercent15 > underPercent60))
        ) {
            if (dominantPercent >= 60) {
                signal = 'TRADE NOW';
                signalColor = 'green';
                signalMessage = `${dominant} at ${dominantPercent.toFixed(1)}% - STRONG SIGNAL`;
                description = `Market strongly favors ${dominant}. Entry point: ${dominant === 'OVER' ? highestOver : highestUnder}`;
            } else {
                signal = 'WAIT';
                signalColor = 'blue';
                signalMessage = `${dominant} at ${dominantPercent.toFixed(1)}% - BUILDING POWER`;
                description = `${dominant} power is building. Wait for confirmation at 60%+`;
            }
        } else {
            signal = 'NEUTRAL';
            signalColor = 'gray';
            signalMessage = 'Analyzing market patterns';
            description = 'Waiting for clear dominance with increasing power';
        }

        // Power warning
        let warning = '';
        if (dominant === 'OVER' && underPercent15 > underPercent60 && underPercent15 > 30) {
            warning = `⚠️ Under digits increasing (${underPercent15.toFixed(0)}%) - Consider skip 2-3 ticks`;
        } else if (dominant === 'UNDER' && overPercent15 > overPercent60 && overPercent15 > 30) {
            warning = `⚠️ Over digits increasing (${overPercent15.toFixed(0)}%) - Consider skip 2-3 ticks`;
        }

        return {
            signal,
            signalColor,
            signalMessage,
            description,
            warning,
            underPercent60,
            overPercent60,
            underPercent15,
            overPercent15,
            highestUnder,
            highestOver,
            skipTicks,
        };
    };

    // Even/Odd Analysis
    const analyzeEvenOdd = () => {
        const even60 = last60.filter(d => d % 2 === 0).length;
        const odd60 = last60.filter(d => d % 2 === 1).length;
        const evenPercent = (even60 / Math.max(1, last60.length)) * 100;
        const oddPercent = (odd60 / Math.max(1, last60.length)) * 100;
        const deviation = Math.abs(evenPercent - oddPercent);

        let signal = 'NEUTRAL';
        let signalColor = 'gray';
        let signalMessage = '';
        let description = '';

        if (deviation >= 7) {
            signal = 'TRADE NOW';
            signalColor = 'green';
            const type = evenPercent > oddPercent ? 'EVEN' : 'ODD';
            signalMessage = `${type} at ${Math.max(evenPercent, oddPercent).toFixed(1)}% - SIGNAL`;
            description = `${type} dominance detected with ${deviation.toFixed(1)}% deviation`;
        } else if (deviation >= 5) {
            signal = 'WAIT';
            signalColor = 'blue';
            signalMessage = 'Building deviation';
            description = `Deviation at ${deviation.toFixed(1)}%. Wait for 7%+ deviation`;
        }

        return { signal, signalColor, signalMessage, description, evenPercent, oddPercent, deviation };
    };

    // Rise/Fall Analysis
    const analyzeRiseFall = () => {
        let riseCount = 0,
            fallCount = 0;
        for (let i = 1; i < last60.length; i++) {
            if (last60[i] > last60[i - 1]) riseCount++;
            else if (last60[i] < last60[i - 1]) fallCount++;
        }
        const risePercent = (riseCount / Math.max(1, last60.length - 1)) * 100;
        const fallPercent = (fallCount / Math.max(1, last60.length - 1)) * 100;
        const deviation = Math.abs(risePercent - fallPercent);

        let signal = 'NEUTRAL';
        let signalColor = 'gray';
        let signalMessage = '';
        let description = '';

        if (deviation >= 8) {
            signal = 'TRADE NOW';
            signalColor = 'green';
            const trend = risePercent > fallPercent ? 'RISE' : 'FALL';
            signalMessage = `${trend} at ${Math.max(risePercent, fallPercent).toFixed(1)}% - SIGNAL`;
            description = `Strong ${trend} trend with ${deviation.toFixed(1)}% directional deviation`;
        } else if (deviation >= 6) {
            signal = 'WAIT';
            signalColor = 'blue';
            signalMessage = 'Trend building';
            description = `Directional bias emerging. Monitor for confirmation`;
        }

        return { signal, signalColor, signalMessage, description, risePercent, fallPercent, deviation };
    };

    // Digit Distribution
    const digitCounts: Record<number, number> = {};
    for (let i = 0; i < 10; i++) {
        digitCounts[i] = last60.filter(d => d === i).length;
    }

    // Get analysis based on strategy
    const getAnalysis = () => {
        switch (strategy) {
            case 'even-odd':
                return analyzeEvenOdd();
            case 'rise-fall':
                return analyzeRiseFall();
            default:
                return analyzeOverUnder();
        }
    };

    const analysis = getAnalysis();

    // Chart data
    const chartData = recentDigits.slice(-100).map((digit, idx) => ({
        tick: idx,
        digit,
    }));

    // Handle trade
    const handleTrade = () => {
        const newTrade = {
            id: Date.now(),
            strategy,
            market: selectedMarket,
            stake,
            ticks,
            result: Math.random() > 0.5 ? 'win' : 'loss',
            profit: Math.random() > 0.5 ? stake * 0.9 : -stake,
        };
        setTransactionHistory(prev => [newTrade, ...prev]);
    };

    const wins = transactionHistory.filter(t => t.result === 'win').length;
    const losses = transactionHistory.filter(t => t.result === 'loss').length;
    const totalProfit = transactionHistory.reduce((sum, t) => sum + t.profit, 0);

    return (
        <div className='space-y-6'>


            {/* Header */}
            <div className='soft-card p-4 border-white/5 flex items-center justify-between gap-4'>
                <div className='flex items-center gap-2'>
                    <span className={`text-xs font-semibold ${theme === 'dark' ? 'text-gray-400' : 'text-gray-700'}`}>
                        Current Digit:
                    </span>
                    {currentDigit !== null ? (
                        <span
                            className={`text-2xl font-bold animate-pulse ${
                                theme === 'dark'
                                    ? 'bg-gradient-to-r from-orange-400 via-red-400 to-pink-400 bg-clip-text text-transparent'
                                    : 'text-orange-600'
                            }`}
                        >
                            {currentDigit}
                        </span>
                    ) : (
                        <span className={`text-2xl font-bold ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`}>
                            -
                        </span>
                    )}
                </div>
                <div className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    Price: <span className='font-mono'>{currentPrice?.toFixed(5) || '---'}</span>
                </div>
            </div>

            {/* Strategy Selector */}
            <div className='soft-card p-6 border-white/5'>
                <h3 className='text-sm font-bold mb-4 uppercase tracking-widest text-gray-400'>Select Strategy</h3>
                <div className='grid grid-cols-2 md:grid-cols-3 gap-2 mb-6'>
                    {['over-under', 'even-odd', 'rise-fall', 'differs', 'matches', 'recovery'].map(s => (
                        <Button
                            key={s}
                            onClick={() => setStrategy(s as any)}
                            variant={strategy === s ? 'default' : 'outline'}
                            className={`text-xs uppercase font-bold ${
                                strategy === s
                                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600'
                                    : theme === 'dark'
                                      ? 'border-gray-600 text-gray-300 hover:bg-gray-800'
                                      : 'border-gray-300 text-gray-700'
                            }`}
                        >
                            {s.replace('-', '/')}
                        </Button>
                    ))}
                </div>

                {/* Auto Markets Toggle */}
                <div className='flex items-center gap-3 p-4 bg-white/5 rounded-lg border border-white/10'>
                    <Switch checked={autoMarkets} onCheckedChange={setAutoMarkets} />
                    <span className={`text-sm font-semibold ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                        Auto Markets Analysis
                    </span>
                </div>
            </div>

            {/* Signal Display */}
            <div className='soft-card p-8 border-white/5'>
                <div className='text-center mb-6'>
                    <h2 className='text-2xl font-black uppercase tracking-[0.2em] mb-4 text-white'>Trading Signal</h2>
                    <Badge
                        className={`text-lg px-4 py-2 ${
                            analysis.signal === 'TRADE NOW'
                                ? theme === 'dark'
                                    ? 'bg-green-500/20 text-green-400 border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.3)]'
                                    : 'bg-green-100 text-green-700'
                                : analysis.signal === 'WAIT'
                                  ? theme === 'dark'
                                      ? 'bg-blue-500/20 text-blue-300 border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.3)]'
                                      : 'bg-blue-100 text-blue-700'
                                  : theme === 'dark'
                                    ? 'bg-gray-500/20 text-gray-400'
                                    : 'bg-gray-100 text-gray-600'
                        }`}
                    >
                        {analysis.signal}
                    </Badge>
                </div>

                <div
                    className={`rounded-lg p-4 mb-6 ${
                        analysis.signal === 'TRADE NOW'
                            ? theme === 'dark'
                                ? 'bg-green-500/10 border border-green-500/30'
                                : 'bg-green-50 border border-green-200'
                            : analysis.signal === 'WAIT'
                              ? theme === 'dark'
                                  ? 'bg-blue-500/10 border border-blue-500/30'
                                  : 'bg-blue-50 border border-blue-200'
                              : theme === 'dark'
                                ? 'bg-gray-500/10 border border-gray-500/30'
                                : 'bg-gray-50 border border-gray-200'
                    }`}
                >
                    <h3 className='text-xs font-black uppercase tracking-widest mb-2 text-white/70'>Signal Analysis</h3>
                    <p className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-800'}`}>
                        {analysis.signalMessage}
                    </p>
                    <p className={`text-xs mt-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                        {analysis.description}
                    </p>
                    {analysis.warning && (
                        <p
                            className={`text-xs mt-2 font-semibold ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}
                        >
                            {analysis.warning}
                        </p>
                    )}
                </div>

                {/* Strategy Specific Analysis */}
                {strategy === 'over-under' && (
                    <div className='grid grid-cols-1 md:grid-cols-2 gap-6 mb-8'>
                        <div
                            className={`rounded-lg p-6 border ${
                                theme === 'dark'
                                    ? 'bg-blue-500/10 border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.2)]'
                                    : 'bg-blue-50 border-blue-200'
                            }`}
                        >
                            <div className='flex items-center justify-between mb-3'>
                                <div
                                    className={`text-4xl font-bold ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}
                                >
                                    {analysis.underPercent60?.toFixed(1)}%
                                </div>
                                <div
                                    className={`text-2xl ${analysis.underPercent15 > analysis.underPercent60 ? 'text-green-500' : 'text-red-500'}`}
                                >
                                    {analysis.underPercent15 > analysis.underPercent60 ? '📈' : '📉'}
                                </div>
                            </div>
                            <div
                                className={`text-sm mb-2 font-semibold ${theme === 'dark' ? 'text-gray-400' : 'text-gray-700'}`}
                            >
                                UNDER (0-4)
                            </div>
                            <div className={`text-xs mb-3 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>
                                Highest: {analysis.highestUnder ?? 'N/A'}
                            </div>
                            <div
                                className={`w-full rounded-full h-4 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}
                            >
                                <div
                                    className='h-4 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all'
                                    style={{ width: `${Math.min(analysis.underPercent60 || 0, 100)}%` }}
                                />
                            </div>
                        </div>

                        <div
                            className={`rounded-lg p-6 border ${
                                theme === 'dark'
                                    ? 'bg-orange-500/10 border-orange-500/30 shadow-[0_0_15px_rgba(234,88,12,0.2)]'
                                    : 'bg-orange-50 border-orange-200'
                            }`}
                        >
                            <div className='flex items-center justify-between mb-3'>
                                <div
                                    className={`text-4xl font-bold ${theme === 'dark' ? 'text-orange-400' : 'text-orange-600'}`}
                                >
                                    {analysis.overPercent60?.toFixed(1)}%
                                </div>
                                <div
                                    className={`text-2xl ${analysis.overPercent15 > analysis.overPercent60 ? 'text-green-500' : 'text-red-500'}`}
                                >
                                    {analysis.overPercent15 > analysis.overPercent60 ? '📈' : '📉'}
                                </div>
                            </div>
                            <div
                                className={`text-sm mb-2 font-semibold ${theme === 'dark' ? 'text-gray-400' : 'text-gray-700'}`}
                            >
                                OVER (5-9)
                            </div>
                            <div className={`text-xs mb-3 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>
                                Highest: {analysis.highestOver ?? 'N/A'}
                            </div>
                            <div
                                className={`w-full rounded-full h-4 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}
                            >
                                <div
                                    className='h-4 rounded-full bg-gradient-to-r from-orange-500 to-red-500 transition-all'
                                    style={{ width: `${Math.min(analysis.overPercent60 || 0, 100)}%` }}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {strategy === 'even-odd' && (
                    <div className='grid grid-cols-1 md:grid-cols-2 gap-6 mb-8'>
                        <div
                            className={`rounded-lg p-6 border ${
                                theme === 'dark'
                                    ? 'bg-green-500/10 border-green-500/30'
                                    : 'bg-green-50 border-green-200'
                            }`}
                        >
                            <div
                                className={`text-4xl font-bold mb-2 ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}
                            >
                                {analysis.evenPercent?.toFixed(1)}%
                            </div>
                            <div
                                className={`text-sm font-semibold mb-3 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-700'}`}
                            >
                                EVEN
                            </div>
                            <div
                                className={`w-full rounded-full h-4 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}
                            >
                                <div
                                    className='h-4 rounded-full bg-green-500 transition-all'
                                    style={{ width: `${Math.min(analysis.evenPercent || 0, 100)}%` }}
                                />
                            </div>
                        </div>

                        <div
                            className={`rounded-lg p-6 border ${
                                theme === 'dark' ? 'bg-pink-500/10 border-pink-500/30' : 'bg-pink-50 border-pink-200'
                            }`}
                        >
                            <div
                                className={`text-4xl font-bold mb-2 ${theme === 'dark' ? 'text-pink-400' : 'text-pink-600'}`}
                            >
                                {analysis.oddPercent?.toFixed(1)}%
                            </div>
                            <div
                                className={`text-sm font-semibold mb-3 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-700'}`}
                            >
                                ODD
                            </div>
                            <div
                                className={`w-full rounded-full h-4 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}
                            >
                                <div
                                    className='h-4 rounded-full bg-pink-500 transition-all'
                                    style={{ width: `${Math.min(analysis.oddPercent || 0, 100)}%` }}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {strategy === 'rise-fall' && (
                    <div className='grid grid-cols-1 md:grid-cols-2 gap-6 mb-8'>
                        <div
                            className={`rounded-lg p-6 border ${
                                theme === 'dark'
                                    ? 'bg-purple-500/10 border-purple-500/30'
                                    : 'bg-purple-50 border-purple-200'
                            }`}
                        >
                            <div
                                className={`text-4xl font-bold mb-2 ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`}
                            >
                                {analysis.risePercent?.toFixed(1)}%
                            </div>
                            <div
                                className={`text-sm font-semibold mb-3 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-700'}`}
                            >
                                RISE
                            </div>
                            <div
                                className={`w-full rounded-full h-4 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}
                            >
                                <div
                                    className='h-4 rounded-full bg-purple-500 transition-all'
                                    style={{ width: `${Math.min(analysis.risePercent || 0, 100)}%` }}
                                />
                            </div>
                        </div>

                        <div
                            className={`rounded-lg p-6 border ${
                                theme === 'dark' ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-200'
                            }`}
                        >
                            <div
                                className={`text-4xl font-bold mb-2 ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}
                            >
                                {analysis.fallPercent?.toFixed(1)}%
                            </div>
                            <div
                                className={`text-sm font-semibold mb-3 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-700'}`}
                            >
                                FALL
                            </div>
                            <div
                                className={`w-full rounded-full h-4 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}
                            >
                                <div
                                    className='h-4 rounded-full bg-red-500 transition-all'
                                    style={{ width: `${Math.min(analysis.fallPercent || 0, 100)}%` }}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Last 7 Digits */}
                <div className='mb-8'>
                    <h3 className='text-xs font-black uppercase tracking-widest mb-3 text-white/70'>Last 7 Digits</h3>
                    <div className='grid grid-cols-7 gap-2'>
                        {last7.map((digit, idx) => (
                            <div
                                key={idx}
                                className={`p-3 rounded-lg text-center font-bold text-lg ${
                                    digit <= 4
                                        ? theme === 'dark'
                                            ? 'bg-blue-500/30 border border-blue-500/50 text-blue-300'
                                            : 'bg-blue-100 text-blue-600'
                                        : theme === 'dark'
                                          ? 'bg-orange-500/30 border border-orange-500/50 text-orange-300'
                                          : 'bg-orange-100 text-orange-600'
                                }`}
                            >
                                {digit}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Digit Distribution */}
                <div className='mb-8'>
                    <h3 className='text-xs font-black uppercase tracking-widest mb-3 text-white/70'>
                        Digit Distribution (Last 60)
                    </h3>
                    <div className='grid grid-cols-5 gap-2'>
                        {Array.from({ length: 10 }).map((_, i) => (
                            <div
                                key={i}
                                className={`p-4 rounded-lg text-center ${
                                    i <= 4
                                        ? theme === 'dark'
                                            ? 'bg-blue-500/10 border border-blue-500/30'
                                            : 'bg-blue-50 border border-blue-200'
                                        : theme === 'dark'
                                          ? 'bg-orange-500/10 border border-orange-500/30'
                                          : 'bg-orange-50 border border-orange-200'
                                }`}
                            >
                                <div
                                    className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                                >
                                    {i}
                                </div>
                                <div
                                    className={`text-sm font-semibold ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                                >
                                    {digitCounts[i]}x
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Last 100 Digits Chart */}
                <div>
                    <h3 className='text-xs font-black uppercase tracking-widest mb-3 text-white/70'>
                        Last 100 Digits Trend
                    </h3>
                    <ResponsiveContainer width='100%' height={250}>
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray='3 3' stroke={theme === 'dark' ? '#404040' : '#e5e5e5'} />
                            <XAxis dataKey='tick' stroke={theme === 'dark' ? '#808080' : '#666'} />
                            <YAxis stroke={theme === 'dark' ? '#808080' : '#666'} domain={[0, 9]} />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: theme === 'dark' ? '#1a1a1a' : '#fff',
                                    border: `1px solid ${theme === 'dark' ? '#404040' : '#ddd'}`,
                                }}
                            />
                            <Line
                                type='monotone'
                                dataKey='digit'
                                stroke='#8b5cf6'
                                strokeWidth={2}
                                dot={false}
                                isAnimationActive={true}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Trading Console Tab */}
            <Tabs defaultValue='console' className='w-full'>
                <TabsContent value='console' className='space-y-6'>
                    <div className='soft-card p-6 border-white/5'>
                        <h2 className='text-xl font-bold mb-6 text-white'>Trading Console</h2>

                        <div className='grid grid-cols-1 md:grid-cols-2 gap-6 mb-6'>
                            <div>
                                <label className='text-xs font-bold uppercase text-gray-400 block mb-2'>
                                    Market Selection
                                </label>
                                <select
                                    value={selectedMarket}
                                    onChange={e => setSelectedMarket(e.target.value as any)}
                                    className={`w-full p-3 rounded-lg border ${
                                        theme === 'dark'
                                            ? 'bg-gray-900 border-gray-700 text-white'
                                            : 'bg-white border-gray-300 text-gray-900'
                                    }`}
                                >
                                    <option value='manual'>Manual</option>
                                    <option value='over'>Over (5-9)</option>
                                    <option value='under'>Under (0-4)</option>
                                </select>
                            </div>

                            <div>
                                <label className='text-xs font-bold uppercase text-gray-400 block mb-2'>Ticks</label>
                                <Input
                                    type='number'
                                    min='1'
                                    max='20'
                                    value={ticks}
                                    onChange={e => setTicks(parseInt(e.target.value))}
                                    className={theme === 'dark' ? 'bg-gray-900 border-gray-700 text-white' : ''}
                                />
                            </div>

                            <div>
                                <label className='text-xs font-bold uppercase text-gray-400 block mb-2'>
                                    Stake ($)
                                </label>
                                <Input
                                    type='number'
                                    min='1'
                                    value={stake}
                                    onChange={e => setStake(parseInt(e.target.value))}
                                    className={theme === 'dark' ? 'bg-gray-900 border-gray-700 text-white' : ''}
                                />
                            </div>

                            <div>
                                <label className='text-xs font-bold uppercase text-gray-400 block mb-2'>
                                    Entry Point
                                </label>
                                <Input
                                    type='number'
                                    min='0'
                                    max='9'
                                    value={entryPoint}
                                    onChange={e => setEntryPoint(parseInt(e.target.value))}
                                    className={theme === 'dark' ? 'bg-gray-900 border-gray-700 text-white' : ''}
                                />
                            </div>
                        </div>

                        <div className='flex items-center gap-4 mb-6 p-4 bg-white/5 rounded-lg border border-white/10'>
                            <div className='flex items-center gap-2'>
                                <Switch checked={useMartingale} onCheckedChange={setUseMartingale} />
                                <span className='text-sm font-semibold'>Martingale</span>
                            </div>
                            <div className='flex items-center gap-2'>
                                <Switch checked={autoTrading} onCheckedChange={setAutoTrading} />
                                <span className='text-sm font-semibold'>Auto Trading</span>
                            </div>
                        </div>

                        <Button
                            onClick={handleTrade}
                            className='w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-6 text-lg'
                        >
                            Execute Trade
                        </Button>
                    </div>

                    {/* Transaction History */}
                    <div className='soft-card p-6 border-white/5'>
                        <h3 className='text-lg font-bold mb-4 text-white'>Performance</h3>

                        <div className='grid grid-cols-2 md:grid-cols-4 gap-4 mb-6'>
                            <div
                                className={`p-4 rounded-lg text-center ${
                                    theme === 'dark'
                                        ? 'bg-purple-500/10 border border-purple-500/30'
                                        : 'bg-purple-50 border border-purple-200'
                                }`}
                            >
                                <div
                                    className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                                >
                                    {transactionHistory.length}
                                </div>
                                <div
                                    className={`text-xs font-semibold ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                                >
                                    Total Trades
                                </div>
                            </div>

                            <div
                                className={`p-4 rounded-lg text-center ${
                                    theme === 'dark'
                                        ? 'bg-green-500/10 border border-green-500/30'
                                        : 'bg-green-50 border border-green-200'
                                }`}
                            >
                                <div className={`text-2xl font-bold text-green-400`}>{wins}</div>
                                <div
                                    className={`text-xs font-semibold ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                                >
                                    Wins
                                </div>
                            </div>

                            <div
                                className={`p-4 rounded-lg text-center ${
                                    theme === 'dark'
                                        ? 'bg-red-500/10 border border-red-500/30'
                                        : 'bg-red-50 border border-red-200'
                                }`}
                            >
                                <div className={`text-2xl font-bold text-red-400`}>{losses}</div>
                                <div
                                    className={`text-xs font-semibold ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                                >
                                    Losses
                                </div>
                            </div>

                            <div
                                className={`p-4 rounded-lg text-center ${
                                    totalProfit >= 0
                                        ? theme === 'dark'
                                            ? 'bg-green-500/10 border border-green-500/30'
                                            : 'bg-green-50 border border-green-200'
                                        : theme === 'dark'
                                          ? 'bg-red-500/10 border border-red-500/30'
                                          : 'bg-red-50 border border-red-200'
                                }`}
                            >
                                <div
                                    className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}
                                >
                                    {totalProfit >= 0 ? '+' : ''}
                                    {totalProfit.toFixed(2)}
                                </div>
                                <div
                                    className={`text-xs font-semibold ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                                >
                                    Total Profit
                                </div>
                            </div>
                        </div>

                        {transactionHistory.length > 0 && (
                            <div
                                className={`rounded-lg overflow-hidden border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}
                            >
                                <div className='max-h-64 overflow-y-auto'>
                                    {transactionHistory.slice(0, 10).map(trade => (
                                        <div
                                            key={trade.id}
                                            className={`p-3 border-b flex items-center justify-between ${
                                                theme === 'dark'
                                                    ? 'border-gray-700 bg-white/2'
                                                    : 'border-gray-200 bg-gray-50'
                                            }`}
                                        >
                                            <div>
                                                <div
                                                    className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                                                >
                                                    {strategy.toUpperCase()} - ${trade.stake}
                                                </div>
                                                <div
                                                    className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                                                >
                                                    {trade.ticks} ticks - {trade.result}
                                                </div>
                                            </div>
                                            <div
                                                className={`text-sm font-bold ${trade.result === 'win' ? 'text-green-400' : 'text-red-400'}`}
                                            >
                                                {trade.result === 'win' ? '+' : ''}
                                                {trade.profit.toFixed(2)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
