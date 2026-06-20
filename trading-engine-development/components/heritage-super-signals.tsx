import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SignalAnalyzer } from '@/components/signal-analyzer';
import { Badge } from '@/components/ui/badge';
import { Zap, TrendingUp, Target, AlertTriangle, Eye, ShieldCheck, Activity } from 'lucide-react';
import { type AnalysisResult } from '@/lib/analysis-engine';

interface SuperSignal {
    timestamp: number;
    value: number;
    strength: 'strong' | 'medium' | 'weak';
    type: 'bullish' | 'bearish' | 'neutral';
    confidence: number;
}

interface HeritageSuperSignalsProps {
    theme: 'light' | 'dark';
    symbol: string;
    availableSymbols: any[];
    maxTicks: number;
    analysis: AnalysisResult;
    recentDigits: number[];
    tickCount: number;
}

export function HeritageSuperSignals({
    theme,
    symbol,
    availableSymbols,
    maxTicks,
    analysis,
    recentDigits,
    tickCount,
}: HeritageSuperSignalsProps) {
    const [selectedSignal, setSelectedSignal] = useState<SuperSignal | null>(null);

    // Last 15 digits statistics
    const last15 = recentDigits.slice(-15);
    const evenCount = last15.filter(d => d % 2 === 0).length;
    const oddCount = last15.length - evenCount;
    const evenPercent = Math.round((evenCount / (last15.length || 1)) * 100);
    const oddPercent = 100 - evenPercent;

    const underCount = last15.filter(d => d <= 4).length;
    const overCount = last15.length - underCount;
    const underPercent = Math.round((underCount / (last15.length || 1)) * 100);
    const overPercent = 100 - underPercent;

    // Matches (M) - Highest appearing digit in last 15
    const digitMap = new Map<number, number>();
    last15.forEach(d => digitMap.set(d, (digitMap.get(d) || 0) + 1));
    let maxCount = 0;
    let matchDigit = last15[last15.length - 1] ?? 0;
    digitMap.forEach((count, digit) => {
        if (count > maxCount) {
            maxCount = count;
            matchDigit = digit;
        }
    });

    // Derive a "live" signal from the last 15
    const currentSignalValue = recentDigits[recentDigits.length - 1] ?? 0;
    const currentConfidence = Math.max(evenPercent, oddPercent, underPercent, overPercent) / 100;

    const getStrengthColor = (strength: string) => {
        switch (strength) {
            case 'strong':
                return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
            case 'medium':
                return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
            default:
                return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
        }
    };

    return (
        <div className='space-y-4'>
            <Tabs defaultValue='live' className='w-full'>
                <TabsList className='grid w-full grid-cols-3 mb-6 bg-white/[0.03] border border-white/5 rounded-xl p-1'>
                    <TabsTrigger
                        value='live'
                        className='rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all'
                    >
                        <Zap className='w-4 h-4 mr-2' />
                        Live Monitor
                    </TabsTrigger>
                    <TabsTrigger
                        value='analysis'
                        className='rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all'
                    >
                        <Target className='w-4 h-4 mr-2' />
                        Super Stats
                    </TabsTrigger>
                    <TabsTrigger
                        value='risk'
                        className='rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all'
                    >
                        <ShieldCheck className='w-4 h-4 mr-2' />
                        Risk Index
                    </TabsTrigger>
                </TabsList>

                <TabsContent value='live' className='space-y-4 focus:outline-none'>
                    <div className='grid grid-cols-1 lg:grid-cols-3 gap-4'>
                        {/* 15-Tick Summary Panel */}
                        <Card className='lg:col-span-2 soft-card border-white/5 overflow-hidden relative'>
                            <div className='absolute top-0 right-0 p-4 opacity-10'>
                                <Activity className='w-24 h-24 text-blue-500' />
                            </div>
                            <CardHeader className='pb-2'>
                                <div className='flex items-center justify-between'>
                                    <CardTitle className='text-xs font-black uppercase tracking-[0.2em] text-slate-500'>
                                        Proprietary Super Signals (15 Tick)
                                    </CardTitle>
                                    <Badge
                                        variant='outline'
                                        className='font-mono text-[10px] sm:text-xs bg-blue-500/10 text-blue-400 border-blue-500/20'
                                    >
                                        {symbol} LIVE
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className='grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-2'>
                                    <div
                                        className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-white/[0.02] border-white/5 shadow-inner' : 'bg-gray-50 border-gray-100 shadow-sm'}`}
                                    >
                                        <p className='text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1'>
                                            Even / Odd
                                        </p>
                                        <div className='flex items-end gap-2'>
                                            <span
                                                className={`text-xl font-black ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}
                                            >
                                                E:{evenPercent}%
                                            </span>
                                            <span className='text-slate-500 font-bold mb-0.5 opacity-50'>/</span>
                                            <span
                                                className={`text-xl font-black ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'}`}
                                            >
                                                O:{oddPercent}%
                                            </span>
                                        </div>
                                    </div>

                                    <div
                                        className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-white/[0.02] border-white/5 shadow-inner' : 'bg-gray-50 border-gray-100 shadow-sm'}`}
                                    >
                                        <p className='text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1'>
                                            Under / Over
                                        </p>
                                        <div className='flex items-end gap-2'>
                                            <span
                                                className={`text-xl font-black ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}
                                            >
                                                U:{underPercent}%
                                            </span>
                                            <span className='text-slate-500 font-bold mb-0.5 opacity-50'>/</span>
                                            <span
                                                className={`text-xl font-black ${theme === 'dark' ? 'text-orange-400' : 'text-orange-600'}`}
                                            >
                                                O:{overPercent}%
                                            </span>
                                        </div>
                                    </div>

                                    <div
                                        className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-white/[0.02] border-white/5 shadow-inner' : 'bg-gray-50 border-gray-100 shadow-sm'}`}
                                    >
                                        <p className='text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1'>
                                            Match (M)
                                        </p>
                                        <div className='flex items-center gap-2'>
                                            <div className='w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-[0_0_15px_rgba(37,99,235,0.4)]'>
                                                <span className='text-lg font-black text-white'>{matchDigit}</span>
                                            </div>
                                            <span className='text-[10px] font-bold text-slate-400 leading-tight'>
                                                Highest occurring digit
                                            </span>
                                        </div>
                                    </div>

                                    <div
                                        className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-white/[0.02] border-white/5 shadow-inner' : 'bg-gray-50 border-gray-100 shadow-sm'}`}
                                    >
                                        <p className='text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1'>
                                            Tick Count
                                        </p>
                                        <p
                                            className={`text-2xl font-black ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}
                                        >
                                            {tickCount.toLocaleString()}
                                        </p>
                                    </div>
                                </div>

                                {/* Technical Progress Bars - Premium Redesign */}
                                <div className='mt-6 space-y-6'>
                                    <div className='space-y-2'>
                                        <div className='flex justify-between items-center px-1'>
                                            <div className='flex items-center gap-2'>
                                                <Zap className='w-3.5 h-3.5 text-blue-500' />
                                                <span className='text-[11px] font-black uppercase tracking-widest text-slate-400'>
                                                    Signal Confidence
                                                </span>
                                            </div>
                                            <span
                                                className={`text-sm font-black italic ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}
                                            >
                                                {(currentConfidence * 100).toFixed(0)}%
                                            </span>
                                        </div>
                                        {/* REDESIGNED PROGRESS BAR */}
                                        <div
                                            className={`h-3 w-full rounded-full border p-[1px] relative overflow-hidden ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-100 border-gray-200 shadow-inner'}`}
                                        >
                                            <div
                                                className='h-full rounded-full bg-linear-to-r from-blue-600 via-cyan-400 to-blue-400 shadow-[0_0_15px_rgba(37,99,235,0.6)] transition-all duration-1000 ease-out relative group'
                                                style={{ width: `${currentConfidence * 100}%` }}
                                            >
                                                {/* Shimmer Effect */}
                                                <div className='absolute inset-0 bg-linear-to-r from-transparent via-white/30 to-transparent translate-x-[-100%] group-hover:animate-shimmer' />
                                                {/* Glow Point */}
                                                <div className='absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full blur-md opacity-50' />
                                            </div>
                                        </div>
                                    </div>

                                    <div className='space-y-2'>
                                        <div className='flex justify-between items-center px-1'>
                                            <div className='flex items-center gap-2'>
                                                <AlertTriangle className='w-3.5 h-3.5 text-orange-500' />
                                                <span className='text-[11px] font-black uppercase tracking-widest text-slate-400'>
                                                    Market Risk Index
                                                </span>
                                            </div>
                                            <span
                                                className={`text-sm font-black italic ${theme === 'dark' ? 'text-orange-400' : 'text-orange-600'}`}
                                            >
                                                {evenPercent > 70 || oddPercent > 70 ? 'HIGH' : 'LOW'}
                                            </span>
                                        </div>
                                        {/* REDESIGNED RISK BAR */}
                                        <div
                                            className={`h-3 w-full rounded-full border p-[1px] relative overflow-hidden ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-100 border-gray-200 shadow-inner'}`}
                                        >
                                            <div
                                                className={`h-full rounded-full bg-linear-to-r transition-all duration-1000 ease-out ${
                                                    evenPercent > 70 || oddPercent > 70
                                                        ? 'from-orange-600 via-red-500 to-red-400 shadow-[0_0_15px_rgba(249,115,22,0.6)]'
                                                        : 'from-emerald-600 via-green-400 to-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.4)]'
                                                }`}
                                                style={{ width: `${Math.max(evenPercent, oddPercent)}%` }}
                                            >
                                                <div className='absolute inset-0 bg-linear-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] animate-shimmer' />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Quick Actions / Recent Activity */}
                        <div className='space-y-4'>
                            <Card
                                className={`border ${theme === 'dark' ? 'bg-[#050505]/60 border-white/5 shadow-2xl' : 'bg-white border-gray-100 shadow-xl'} backdrop-blur-2xl`}
                            >
                                <CardHeader className='pb-2'>
                                    <CardTitle
                                        className={`text-sm font-black uppercase tracking-widest ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}
                                    >
                                        Pattern Feed
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className='space-y-2'>
                                        {last15
                                            .slice(-5)
                                            .reverse()
                                            .map((d, i) => (
                                                <div
                                                    key={i}
                                                    className={`flex items-center justify-between p-2 rounded-lg border ${theme === 'dark' ? 'bg-white/[0.01] border-white/5' : 'bg-gray-50 border-gray-100'}`}
                                                >
                                                    <div className='flex items-center gap-2'>
                                                        <span
                                                            className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm ${d % 2 === 0 ? 'bg-blue-600 text-white' : 'bg-cyan-500 text-black'}`}
                                                        >
                                                            {d}
                                                        </span>
                                                        <span className='text-[10px] font-bold text-slate-500 uppercase'>
                                                            {d % 2 === 0 ? 'Even' : 'Odd'} • {d <= 4 ? 'Under' : 'Over'}
                                                        </span>
                                                    </div>
                                                    <span className='text-[9px] font-mono text-slate-600'>
                                                        t-{i + 1}
                                                    </span>
                                                </div>
                                            ))}
                                    </div>
                                </CardContent>
                            </Card>

                            <div
                                className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-blue-600/10 border-blue-600/20' : 'bg-blue-50 border-blue-200'} flex items-center gap-3`}
                            >
                                <div className='w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center shadow-lg'>
                                    <TrendingUp className='w-5 h-5 text-white' />
                                </div>
                                <div>
                                    <p
                                        className={`text-xs font-black uppercase tracking-widest ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}
                                    >
                                        Market Bias
                                    </p>
                                    <p
                                        className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}
                                    >
                                        {evenPercent > 60
                                            ? 'Heavy Even Presence'
                                            : oddPercent > 60
                                              ? 'Heavy Odd Presence'
                                              : 'Balanced Distribution'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value='analysis' className='focus:outline-none'>
                    <SignalAnalyzer currentNumber={currentSignalValue} showDetails={true} />
                </TabsContent>

                <TabsContent value='risk' className='focus:outline-none'>
                    <Card
                        className={`border ${theme === 'dark' ? 'bg-[#050505]/60 border-white/5 shadow-2xl' : 'bg-white border-gray-100 shadow-xl'} backdrop-blur-2xl`}
                    >
                        <CardHeader>
                            <CardTitle className='flex items-center gap-2'>
                                <ShieldCheck className='w-5 h-5 text-emerald-500' />
                                Safety Assessment
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                                <div className='space-y-1'>
                                    <p className='text-[10px] font-black uppercase text-slate-500'>Volatility</p>
                                    <p className='text-lg font-bold'>Stable</p>
                                </div>
                                <div className='space-y-1'>
                                    <p className='text-[10px] font-black uppercase text-slate-500'>Signal Power</p>
                                    <p
                                        className={`text-lg font-bold ${currentConfidence > 0.7 ? 'text-emerald-500' : 'text-amber-500'}`}
                                    >
                                        {currentConfidence > 0.7 ? 'Excellent' : 'Moderate'}
                                    </p>
                                </div>
                                <div className='space-y-1'>
                                    <p className='text-[10px] font-black uppercase text-slate-500'>Trade Status</p>
                                    <Badge className='bg-emerald-600 text-white border-none py-1 px-3'>PROTECTED</Badge>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
