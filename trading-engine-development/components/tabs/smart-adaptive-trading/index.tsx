'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Zap,
    Target,
    Activity,
    ShieldCheck,
    AlertTriangle,
    TrendingUp,
    Brain,
    BarChart3,
    History,
    Lock,
    Unlock,
    Play,
    Square,
    ChevronRight,
    Search,
    Cpu,
    Radio,
    Terminal,
    Globe,
    RefreshCw,
} from 'lucide-react';
import { useSmartAdaptiveTrading } from '@/hooks/use-smart-adaptive-trading';
import { TransactionHistory } from '@/components/transaction-history';
import type { Signal, AnalysisResult } from '@/lib/analysis-engine';

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.08 },
    },
};

const itemVariants = {
    hidden: { y: 15, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 100 } },
};

export default function SmartAdaptiveTradingTab({
    signals: engineSignals = [],
    analysis: engineAnalysis,
    symbol = '',
    availableSymbols,
    onSymbolChange,
    theme = 'dark',
    currentPrice,
    currentDigit,
    tickCount,
}: {
    signals?: Signal[];
    analysis?: AnalysisResult;
    symbol?: string;
    availableSymbols?: any[];
    onSymbolChange?: (symbol: string) => void;
    theme?: 'light' | 'dark';
    currentPrice?: number | null;
    currentDigit?: number | null;
    tickCount?: number;
}) {
    const {
        marketScores,
        selectedMarket,
        setSelectedMarket,
        selectedStrategy,
        setSelectedStrategy,
        selectedStrategies,
        setSelectedStrategies,
        patterns,
        signals,
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
    } = useSmartAdaptiveTrading();

    // Sync with global symbol selection
    useEffect(() => {
        if (symbol && symbol !== selectedMarket) {
            setSelectedMarket(symbol);
        }
    }, [symbol, setSelectedMarket]);

    const [stake, setStake] = useState(0.35);
    const [tp, setTp] = useState(5);
    const [sl, setSl] = useState(10);

    useEffect(() => {
        setConfig({ stake, targetProfit: tp, maxLoss: sl, duration: tickDuration });
    }, [stake, tp, sl, tickDuration, setConfig]);

    const topSignal = useMemo(() => (signals.length > 0 ? signals[0] : null), [signals]);
    const currentMarketInfo = useMemo(
        () => marketScores.find(m => m.symbol === selectedMarket),
        [marketScores, selectedMarket]
    );

    // Smart check: If not connected or not authorized, show friendly prompt instead of spin loop
    if (!isConnected) {
        return (
            <div className='flex flex-col items-center justify-center min-h-[500px] gap-6 text-slate-400'>
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
                    <Cpu className='w-16 h-16 text-indigo-500 opacity-40' />
                </motion.div>
                <div className='text-center space-y-2'>
                    <h3 className='text-xl font-black text-white uppercase tracking-[0.2em] italic'>
                        CONNECTING TO GATEWAY
                    </h3>
                    <p className='text-sm text-slate-500 max-w-sm'>
                        Initializing secure WebSocket link channels with Deriv...
                    </p>
                </div>
            </div>
        );
    }

    if (!isAuthorized) {
        return (
            <div className='flex flex-col items-center justify-center min-h-[500px] gap-6 text-slate-400 p-8'>
                <div className='w-20 h-20 bg-indigo-500/10 border border-indigo-500/20 rounded-[2.5rem] flex items-center justify-center mb-4 shadow-xl'>
                    <Lock className='w-10 h-10 text-indigo-400' />
                </div>
                <div className='text-center space-y-3 max-w-md'>
                    <h3 className='text-2xl font-black text-white uppercase tracking-tighter italic'>
                        AUTHENTICATION REQUIRED
                    </h3>
                    <p className='text-sm text-slate-500 leading-relaxed'>
                        Authorized handshake is required to establish multi-market smart trading algorithms. Please log
                        in using the **Deriv Login** button in the header.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <motion.div
            variants={containerVariants}
            initial='hidden'
            animate='visible'
            className='grid grid-cols-12 gap-4 p-2 sm:p-6 bg-[#03060f] min-h-screen text-slate-200 font-sans select-none'
        >
            {/* --- TOP STATUS HUD --- */}
            <motion.div variants={itemVariants} className='col-span-12 flex flex-col lg:flex-row items-stretch gap-4'>
                {/* Market Focus Indicator */}
                <div className='flex-1 flex items-center gap-6 p-6 rounded-3xl bg-white/[0.02] border border-white/5 backdrop-blur-3xl shadow-2xl relative overflow-hidden group'>
                    <div className='absolute inset-0 bg-gradient-to-r from-sky-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700' />

                    <div className='relative'>
                        <div
                            className={`w-20 h-20 rounded-3xl flex flex-col items-center justify-center border transition-all duration-700 ${
                                currentMarketInfo?.state === 'Structured'
                                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.15)]'
                                    : currentMarketInfo?.state === 'Transitional'
                                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.15)]'
                                      : 'bg-rose-500/10 border-rose-500/40 text-rose-400 shadow-[0_0_30px_rgba(244,63,94,0.15)]'
                            }`}
                        >
                            <span className='text-3xl font-black tracking-tight mb-0.5'>
                                {currentMarketInfo?.lastDigit ?? '-'}
                            </span>
                            <span className='text-[8px] uppercase font-black tracking-[0.1em] opacity-60'>DIGIT</span>
                        </div>
                        <div className='absolute -top-1.5 -right-1.5 w-4 h-4 bg-emerald-500 rounded-full border-2 border-[#03060f] shadow-lg animate-pulse' />
                    </div>

                    <div className='flex-1'>
                        <div className='flex flex-wrap items-center gap-3 mb-2'>
                            <h2 className='text-2xl font-black tracking-tighter text-white uppercase italic'>
                                {selectedMarket.replace('_', ' ')}
                                <span className='text-sky-500 ml-0.5'>.IDX</span>
                            </h2>
                            <Badge
                                className={`px-3 py-0.5 rounded-full text-[9px] font-black border-none uppercase ${
                                    currentMarketInfo?.state === 'Structured'
                                        ? 'bg-emerald-500 text-white'
                                        : currentMarketInfo?.state === 'Transitional'
                                          ? 'bg-amber-500 text-black'
                                          : 'bg-rose-500 text-white'
                                }`}
                            >
                                {currentMarketInfo?.state ?? 'ANALYZING'}
                            </Badge>
                        </div>
                        <div className='flex items-center gap-6'>
                            <div className='flex items-center gap-2'>
                                <Activity className='w-4 h-4 text-sky-400' />
                                <span className='text-[10px] text-slate-500 font-black uppercase tracking-wider'>
                                    Confidence Score:
                                </span>
                                <span className='text-base font-mono font-black text-white'>
                                    {currentMarketInfo?.score ?? 0}%
                                </span>
                            </div>
                            <div className='h-5 w-[1px] bg-white/10' />
                            <div className='flex items-center gap-2'>
                                <Radio className='w-4 h-4 text-emerald-400 animate-pulse' />
                                <span className='text-[10px] text-slate-500 font-black uppercase tracking-wider'>
                                    API Sync:
                                </span>
                                <span className='text-[10px] font-black text-emerald-400 tracking-widest'>
                                    REALTIME
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quant Account Balance HUD */}
                <div className='lg:w-80 p-6 rounded-3xl bg-white/[0.02] border border-white/5 backdrop-blur-3xl flex flex-col justify-center shadow-2xl relative overflow-hidden group'>
                    <div className='absolute inset-0 bg-[radial-gradient(circle_at_70%_70%,rgba(14,165,233,0.05)_0%,transparent_50%)]' />
                    <p className='text-[9px] uppercase tracking-[0.25em] text-slate-500 font-black mb-2'>
                        Adaptive Portfolio Value
                    </p>
                    <div className='flex items-baseline gap-2'>
                        <span className='text-3xl font-mono font-black text-white tracking-tighter'>
                            {balance
                                ? (balance.amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })
                                : '---.--'}
                        </span>
                        <span className='text-sky-500 font-black italic text-sm'>{balance?.currency || 'USD'}</span>
                    </div>
                    <div className='mt-4 flex items-center gap-3'>
                        <div className='flex-1 h-1 bg-white/5 rounded-full overflow-hidden'>
                            <div className='h-full w-4/5 bg-gradient-to-r from-sky-500 to-indigo-500 shadow-[0_0_10px_rgba(14,165,233,0.5)]' />
                        </div>
                        <span className='text-[8px] font-black text-slate-500 tracking-wider'>80% SYNC</span>
                    </div>
                </div>
            </motion.div>

            {/* --- ADAPTIVE GRID --- */}

            {/* 1. Market Selection Panel */}
            <div className='col-span-12 lg:col-span-3'>
                <Card className='bg-white/[0.02] border-white/5 p-6 rounded-3xl backdrop-blur-3xl h-full shadow-2xl overflow-hidden flex flex-col'>
                    <div className='flex items-center justify-between mb-6 border-b border-white/5 pb-4'>
                        <h3 className='text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 flex items-center gap-2'>
                            <Search className='w-4 h-4 text-sky-400' /> Market Intelligence
                        </h3>
                        <Badge
                            variant='outline'
                            className='text-[8px] font-bold border-white/10 uppercase tracking-widest'
                        >
                            {marketScores.length} indices
                        </Badge>
                    </div>
                    <div className='space-y-2 overflow-y-auto max-h-[450px] pr-1 scrollbar-thin'>
                        <AnimatePresence mode='popLayout'>
                            {marketScores.map((market, idx) => (
                                <motion.div
                                    key={market.symbol}
                                    initial={{ x: -10, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    transition={{ delay: idx * 0.04 }}
                                    onClick={() => setSelectedMarket(market.symbol)}
                                    className={`group flex items-center justify-between p-3.5 rounded-2xl cursor-pointer transition-all duration-300 border ${
                                        selectedMarket === market.symbol
                                            ? 'bg-sky-500/10 border-sky-500/40 shadow-[0_0_20px_rgba(14,165,233,0.1)]'
                                            : 'bg-black/20 hover:bg-white/[0.02] border-transparent'
                                    }`}
                                >
                                    <div className='flex items-center gap-3'>
                                        <div
                                            className={`w-1 h-6 rounded-full transition-colors ${
                                                market.state === 'Structured'
                                                    ? 'bg-emerald-500'
                                                    : market.state === 'Transitional'
                                                      ? 'bg-amber-500'
                                                      : 'bg-slate-700'
                                            }`}
                                        />
                                        <div>
                                            <div className='text-xs font-black text-white italic tracking-tight uppercase'>
                                                {market.symbol.replace('_', ' ')}
                                            </div>
                                            <div className='text-[8px] text-slate-500 uppercase font-black tracking-widest mt-0.5'>
                                                {market.state}
                                            </div>
                                        </div>
                                    </div>
                                    <div className='text-right'>
                                        <div className='text-xs font-mono font-black text-sky-400'>{market.score}%</div>
                                        <ChevronRight
                                            className={`w-3.5 h-3.5 text-sky-500/40 mt-0.5 transition-transform ${selectedMarket === market.symbol ? 'translate-x-0' : '-translate-x-2 opacity-0'}`}
                                        />
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                </Card>
            </div>

            {/* 2. Middle Adaptive Node Core & Autopilot */}
            <div className='col-span-12 lg:col-span-6 space-y-4'>
                {/* Core Manual Strikes */}
                <Card
                    className={`relative p-6 sm:p-8 rounded-3xl border transition-all duration-700 overflow-hidden ${
                        topSignal?.entryStatus === 'Confirmed'
                            ? 'bg-emerald-500/[0.04] border-emerald-500/40 shadow-[0_0_40px_rgba(16,185,129,0.1)]'
                            : 'bg-white/[0.02] border-white/5 shadow-2xl'
                    }`}
                >
                    <div className='absolute top-0 right-0 p-8 opacity-5 pointer-events-none'>
                        <Zap className='w-48 h-48 text-white' />
                    </div>

                    <div className='flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 border-b border-white/5 pb-4 relative z-10'>
                        <div className='flex items-center gap-3'>
                            <div className='w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center border border-sky-500/20 shadow-inner'>
                                <Radio className={`w-4 h-4 text-sky-400 ${topSignal ? 'animate-pulse' : ''}`} />
                            </div>
                            <h3 className='text-xs font-black tracking-[0.3em] text-slate-400 uppercase italic'>
                                Adaptive Core Nodes
                            </h3>
                        </div>

                        <div className='flex flex-wrap gap-1.5'>
                            {['OverUnder', 'EvenOdd', 'Differs'].map(strat => (
                                <Badge
                                    key={strat}
                                    onClick={() => {
                                        const exists = selectedStrategies.includes(strat);
                                        if (exists) {
                                            if (selectedStrategies.length > 1)
                                                setSelectedStrategies(prev => prev.filter(s => s !== strat));
                                        } else {
                                            setSelectedStrategies(prev => [...prev, strat]);
                                        }
                                    }}
                                    className={`px-3 py-1 rounded-lg cursor-pointer transition-all duration-300 font-black text-[8px] uppercase tracking-widest border border-none ${
                                        selectedStrategies.includes(strat)
                                            ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/20'
                                            : 'bg-white/5 text-slate-400 hover:bg-white/10'
                                    }`}
                                >
                                    {strat}
                                </Badge>
                            ))}
                        </div>
                    </div>

                    <div className='flex flex-col gap-3 relative z-10'>
                        {signals.length > 0 ? (
                            <AnimatePresence mode='popLayout'>
                                {signals.map((signal, idx) => (
                                    <motion.div
                                        key={idx}
                                        initial={{ y: 10, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        transition={{ delay: idx * 0.08 }}
                                        className={`p-5 rounded-2xl border transition-all duration-300 ${
                                            signal.entryStatus === 'Confirmed'
                                                ? 'bg-emerald-500/10 border-emerald-500/30'
                                                : 'bg-black/25 border-white/5'
                                        }`}
                                    >
                                        <div className='flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4'>
                                            <div className='flex-1'>
                                                <div className='flex items-center gap-2.5 mb-1.5'>
                                                    <Badge
                                                        className={`px-2.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider ${
                                                            signal.entryStatus === 'Confirmed'
                                                                ? 'bg-emerald-500'
                                                                : 'bg-slate-800 text-slate-400'
                                                        }`}
                                                    >
                                                        {signal.strategy}
                                                    </Badge>
                                                    <span className='text-[10px] font-black text-sky-500/70 tracking-widest uppercase'>
                                                        {signal.type}
                                                    </span>
                                                </div>
                                                <div className='text-lg font-black text-white italic tracking-tighter uppercase'>
                                                    Target digit:{' '}
                                                    <span className='text-sky-500 not-italic ml-1'>
                                                        {signal.barrier}
                                                    </span>
                                                </div>
                                                <p className='text-[11px] text-slate-400 mt-1 font-medium leading-relaxed'>
                                                    {signal.description}
                                                </p>
                                            </div>

                                            <div className='flex items-center justify-between md:justify-end gap-6 border-t md:border-none border-white/5 pt-3 md:pt-0'>
                                                <div className='flex flex-col md:items-end'>
                                                    <span className='text-[8px] font-black text-slate-500 uppercase tracking-widest'>
                                                        Strength
                                                    </span>
                                                    <span className='text-lg font-mono font-black text-white'>
                                                        {signal.confidence}%
                                                    </span>
                                                </div>
                                                <Button
                                                    onClick={() => tradeOnce(signal)}
                                                    disabled={signal.entryStatus !== 'Confirmed'}
                                                    className={`h-12 px-6 rounded-xl font-black text-[10px] tracking-widest uppercase transition-all border-none ${
                                                        signal.entryStatus === 'Confirmed'
                                                            ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                                                            : 'bg-white/5 text-slate-500 cursor-not-allowed'
                                                    }`}
                                                >
                                                    {signal.entryStatus === 'Confirmed' ? (
                                                        <>
                                                            <Zap className='w-3.5 h-3.5 mr-2' /> MANUAL STRIKE
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Lock className='w-3.5 h-3.5 mr-2' /> WAITING
                                                        </>
                                                    )}
                                                </Button>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        ) : (
                            <div className='flex flex-col items-center justify-center py-10 gap-4'>
                                <div className='p-3.5 rounded-full border border-dashed border-white/5 animate-pulse'>
                                    <Search className='w-10 h-10 text-slate-700' />
                                </div>
                                <p className='text-slate-500 font-black italic tracking-widest uppercase text-xs'>
                                    Scanning structural pattern feeds...
                                </p>
                            </div>
                        )}
                    </div>
                </Card>

                {/* Global Strategy Matrix */}
                <Card className='bg-white/[0.02] border-white/5 p-6 rounded-3xl backdrop-blur-3xl shadow-2xl'>
                    <h3 className='text-[10px] font-black uppercase tracking-[0.25em] text-sky-400 mb-4 flex items-center gap-2'>
                        <Globe className='w-4 h-4 text-sky-400' /> Multi-Strategy Signal Hub
                    </h3>
                    <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
                        {engineSignals.filter(s => s.status !== 'NEUTRAL').length > 0 ? (
                            engineSignals
                                .filter(s => s.status !== 'NEUTRAL')
                                .slice(0, 4)
                                .map((s, idx) => (
                                    <div
                                        key={idx}
                                        className={`p-4 rounded-2xl border ${
                                            s.status === 'TRADE NOW'
                                                ? 'bg-emerald-500/10 border-emerald-500/30'
                                                : 'bg-black/20 border-white/5'
                                        } flex items-center justify-between`}
                                    >
                                        <div>
                                            <div className='flex items-center gap-2 mb-1'>
                                                <Badge
                                                    className={`text-[8px] font-black uppercase ${s.status === 'TRADE NOW' ? 'bg-emerald-500' : 'bg-indigo-600'}`}
                                                >
                                                    {s.status}
                                                </Badge>
                                                <span className='text-[9px] font-black text-white/50 uppercase tracking-widest'>
                                                    {s.type}
                                                </span>
                                            </div>
                                            <div className='text-[10px] text-slate-400 font-bold max-w-[160px] truncate'>
                                                {s.recommendation}
                                            </div>
                                        </div>
                                        <div className='text-right'>
                                            <div className='text-sm font-mono font-black text-white'>
                                                {s.probability.toFixed(1)}%
                                            </div>
                                            <div className='text-[8px] text-slate-500 uppercase font-black'>
                                                Accuracy
                                            </div>
                                        </div>
                                    </div>
                                ))
                        ) : (
                            <div className='col-span-2 py-8 text-center text-slate-700 italic font-black uppercase tracking-widest text-[10px]'>
                                Awaiting multi-strategy calculations...
                            </div>
                        )}
                    </div>
                </Card>
            </div>

            {/* 3. AutoPilot configuration panel */}
            <div className='col-span-12 lg:col-span-3'>
                <Card className='bg-white/[0.02] border-white/5 p-6 rounded-3xl backdrop-blur-3xl h-full shadow-2xl flex flex-col justify-between'>
                    <div className='space-y-6'>
                        <div className='flex items-center justify-between border-b border-white/5 pb-4'>
                            <span className='text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] flex items-center gap-2 italic'>
                                <Brain className='w-4 h-4 text-indigo-400' /> Autopilot Config
                            </span>
                            <div
                                className={`w-2.5 h-2.5 rounded-full ${tradingStatus?.isAutoTrading ? 'bg-emerald-500 animate-pulse' : 'bg-slate-700'}`}
                            />
                        </div>

                        <div className='space-y-5'>
                            <div>
                                <span className='text-[9px] text-slate-500 uppercase font-black px-1 mb-2 block tracking-widest'>
                                    Stake Magnitude ($)
                                </span>
                                <div className='relative'>
                                    <Input
                                        type='number'
                                        value={stake}
                                        onChange={e => setStake(parseFloat(e.target.value) || 0)}
                                        className='bg-black/30 border-white/5 h-12 rounded-xl font-mono font-black text-base focus:ring-sky-500 border-none pl-10 text-white'
                                    />
                                    <Zap className='absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-sky-500/50' />
                                </div>
                            </div>

                            <div className='grid grid-cols-2 gap-3'>
                                <div>
                                    <span className='text-[9px] text-slate-500 uppercase font-black px-1 mb-2 block tracking-widest'>
                                        Target TP ($)
                                    </span>
                                    <Input
                                        type='number'
                                        value={tp}
                                        onChange={e => setTp(parseFloat(e.target.value) || 0)}
                                        className='bg-black/30 border-white/5 h-11 rounded-xl font-mono font-bold text-center border-none text-emerald-400'
                                    />
                                </div>
                                <div>
                                    <span className='text-[9px] text-slate-500 uppercase font-black px-1 mb-2 block tracking-widest'>
                                        Max SL ($)
                                    </span>
                                    <Input
                                        type='number'
                                        value={sl}
                                        onChange={e => setSl(parseFloat(e.target.value) || 0)}
                                        className='bg-black/30 border-white/5 h-11 rounded-xl font-mono font-bold text-center border-none text-rose-400'
                                    />
                                </div>
                            </div>

                            <div>
                                <span className='text-[9px] text-slate-500 uppercase font-black px-1 mb-2 block tracking-widest'>
                                    Tick Duration
                                </span>
                                <select
                                    value={tickDuration}
                                    onChange={e => setTickDuration(Number(e.target.value))}
                                    className='w-full bg-black/30 border-white/5 h-11 rounded-xl px-4 text-xs font-black text-slate-300 focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer appearance-none border'
                                >
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(t => (
                                        <option key={t} value={t} className='bg-slate-950 text-white'>
                                            {t} Ticks
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className='mt-8 pt-4 border-t border-white/5'>
                        <Button
                            onClick={tradingStatus?.isAutoTrading ? stopAutoTrade : startAutoTrade}
                            className={`w-full h-16 rounded-2xl font-black text-[10px] tracking-[0.2em] uppercase transition-all duration-700 relative overflow-hidden border-none ${
                                tradingStatus?.isAutoTrading
                                    ? 'bg-rose-500 hover:bg-rose-600 shadow-[0_0_20px_rgba(244,63,94,0.25)] text-white'
                                    : 'bg-emerald-500 hover:bg-emerald-600 shadow-[0_0_20px_rgba(16,185,129,0.25)] text-white'
                            }`}
                        >
                            {tradingStatus?.isAutoTrading ? (
                                <div className='flex flex-col items-center'>
                                    <Square className='w-4 h-4 mb-0.5' />
                                    <span>STOP AUTO TRADER</span>
                                </div>
                            ) : (
                                <div className='flex flex-col items-center'>
                                    <Play className='w-4 h-4 mb-0.5' />
                                    <span>START AUTO PILOT</span>
                                </div>
                            )}
                        </Button>
                        <p className='text-[8px] text-slate-500 font-black uppercase tracking-[0.3em] text-center mt-2.5 italic'>
                            {tradingStatus?.isAutoTrading
                                ? 'System Engaged in autopilot loop'
                                : 'Awaiting Pilot Initialization'}
                        </p>
                    </div>
                </Card>
            </div>

            {/* --- BOTTOM HUD & LOGS & HISTORY --- */}
            <motion.div variants={itemVariants} className='col-span-12 flex flex-col gap-4 mt-2'>
                {/* 1. NEURAL SYSTEM STREAM (LOGS) */}
                <Card className='bg-white/[0.02] border-white/5 p-6 rounded-3xl backdrop-blur-3xl shadow-2xl flex flex-col overflow-hidden'>
                    <div className='flex items-center justify-between mb-4 border-b border-white/5 pb-3'>
                        <h3 className='text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 flex items-center gap-2'>
                            <Terminal className='w-4 h-4 text-sky-400' /> System Activity Log
                        </h3>
                        <div className='flex gap-2'>
                            <div className='w-2 h-2 rounded-full bg-rose-500/40' />
                            <div className='w-2 h-2 rounded-full bg-amber-500/40' />
                            <div className='w-2 h-2 rounded-full bg-emerald-500/40' />
                        </div>
                    </div>
                    <div className='bg-black/40 rounded-2xl border border-white/5 p-4 font-mono text-[10px] overflow-y-auto min-h-[220px] max-h-[300px] scrollbar-thin'>
                        <div className='flex flex-col gap-2'>
                            {logs.map((log, i) => (
                                <div key={i} className='flex items-start gap-3'>
                                    <span className='text-slate-600 font-bold'>
                                        [
                                        {new Date(log.timestamp).toLocaleTimeString([], {
                                            hour12: false,
                                            hour: '2-digit',
                                            minute: '2-digit',
                                            second: '2-digit',
                                        })}
                                        ]
                                    </span>
                                    <div
                                        className={`flex-1 ${
                                            log.type === 'system'
                                                ? 'text-slate-400'
                                                : log.type === 'scanner'
                                                  ? 'text-emerald-400/80'
                                                  : log.type === 'trade'
                                                    ? 'text-sky-400 font-black'
                                                    : log.type === 'error'
                                                      ? 'text-rose-500 font-black'
                                                      : 'text-purple-400'
                                        }`}
                                    >
                                        <span className='mr-2 px-1 py-0.5 rounded bg-slate-900 border border-white/5 text-[8px] uppercase font-black tracking-wider'>
                                            {log.type}
                                        </span>
                                        {log.message}
                                    </div>
                                </div>
                            ))}
                            {logs.length === 0 && (
                                <div className='text-slate-800 italic uppercase font-black tracking-widest text-center py-12'>
                                    Synchronizing with multi-market network streams...
                                </div>
                            )}
                        </div>
                    </div>
                </Card>

                {/* 2. SESSION VAULT (STATS) */}
                <Card className='bg-white/[0.02] border-white/5 p-6 rounded-3xl backdrop-blur-3xl shadow-2xl relative overflow-hidden group'>
                    <div className='absolute inset-0 bg-gradient-to-br from-emerald-500/[0.02] to-transparent pointer-events-none' />

                    <div className='flex items-center justify-between mb-4 border-b border-white/5 pb-3'>
                        <h3 className='text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 flex items-center gap-2'>
                            <ShieldCheck className='w-4 h-4 text-emerald-400' /> Active Session Vault
                        </h3>
                        <Button
                            onClick={resetSession}
                            variant='outline'
                            size='sm'
                            className='h-7 px-3 text-[9px] font-black uppercase tracking-wider border-white/10 hover:border-rose-500/50 hover:text-rose-400 hover:bg-rose-500/5 transition-all rounded-lg'
                        >
                            Reset Session
                        </Button>
                    </div>

                    <div className='grid grid-cols-1 sm:grid-cols-3 gap-4 relative z-10'>
                        <div className='p-4 rounded-2xl bg-black/30 border border-white/5 flex flex-col items-center justify-center'>
                            <div className='text-[8px] text-slate-500 uppercase font-black tracking-widest mb-1'>
                                Session Profit / Loss
                            </div>
                            <div
                                className={`text-2xl font-black tabular-nums italic ${stats?.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
                            >
                                {stats?.profit >= 0 ? '+' : ''}${Math.abs(stats?.profit ?? 0).toFixed(2)}
                            </div>
                        </div>

                        <div className='p-4 rounded-2xl bg-black/30 border border-white/5 flex flex-col items-center justify-center'>
                            <div className='text-[8px] text-slate-500 uppercase font-black tracking-widest mb-1'>
                                Session Win Rate
                            </div>
                            <div className='text-2xl font-black text-white italic tabular-nums'>
                                {stats && stats.trades > 0 ? Math.round((stats.wins / stats.trades) * 100) : 0}%
                            </div>
                            <span className='text-[8px] text-slate-500 uppercase mt-0.5 font-bold'>
                                ({stats?.wins ?? 0} wins out of {stats?.trades ?? 0})
                            </span>
                        </div>

                        <div className='p-4 rounded-2xl bg-black/30 border border-white/5 flex items-center justify-between'>
                            <div className='flex flex-col'>
                                <div className='text-[8px] text-slate-500 uppercase font-black tracking-widest mb-0.5'>
                                    Execution Index
                                </div>
                                <div className='text-xl font-black text-sky-400 italic tabular-nums'>
                                    {stats?.trades ?? 0}{' '}
                                    <span className='text-[8px] text-slate-600 not-italic uppercase tracking-widest ml-1'>
                                        Trades
                                    </span>
                                </div>
                            </div>
                            <div className='flex -space-x-1'>
                                {[...Array(3)].map((_, i) => (
                                    <div
                                        key={i}
                                        className='w-6 h-6 rounded-full border-2 border-[#03060f] bg-slate-900 flex items-center justify-center shadow-lg'
                                    >
                                        <div className='w-1.5 h-1.5 rounded-full bg-sky-500/40 animate-pulse' />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </Card>
            </motion.div>
        </motion.div>
    );
}
