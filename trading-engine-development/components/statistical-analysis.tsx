'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import {
    ArrowUpDown,
    Hash,
    CheckSquare,
    XCircle,
    Cpu,
    TrendingUp,
    TrendingDown,
    Star,
    ShieldAlert,
    Zap,
} from 'lucide-react';

interface AnalysisResult {
    digitFrequencies?: Record<number, { count: number; percentage: number }>;
    powerIndex?: { strongest: number; weakest: number };
}

interface StatisticalAnalysisProps {
    analysis: AnalysisResult;
    recentDigits: number[];
    theme?: 'light' | 'dark';
}

// Animated number counter
function LiveNumber({ value, decimals = 1 }: { value: number; decimals?: number }) {
    const [display, setDisplay] = useState(value);
    const prev = useRef(value);

    useEffect(() => {
        if (value === prev.current) return;
        const start = prev.current;
        const diff = value - start;
        const startTime = Date.now();
        const dur = 500;

        const tick = () => {
            const elapsed = Math.min((Date.now() - startTime) / dur, 1);
            const eased = 1 - Math.pow(1 - elapsed, 3);
            setDisplay(start + diff * eased);
            if (elapsed < 1) requestAnimationFrame(tick);
            else {
                prev.current = value;
                setDisplay(value);
            }
        };
        requestAnimationFrame(tick);
    }, [value]);

    return <>{display.toFixed(decimals)}</>;
}

// Animated progress bar
function LiveBar({ pct, colorClass, glowColor }: { pct: number; colorClass: string; glowColor: string }) {
    return (
        <div className='h-3.5 w-full rounded-full bg-gradient-to-r from-white/5 to-white/[0.02] dark:from-white/10 dark:to-white/5 border border-white/10 dark:border-white/20 overflow-hidden p-px backdrop-blur-sm'>
            <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${colorClass} shadow-lg`}
                style={{
                    width: `${Math.min(100, pct)}%`,
                    boxShadow: `0 0 15px ${glowColor}, inset 0 0 8px ${glowColor}40`,
                }}
            />
        </div>
    );
}

// Segmented comparison bar
function SegmentedBar({
    pct1,
    label1,
    color1,
    pct2,
    label2,
    color2,
    isDark,
}: {
    pct1: number;
    label1: string;
    color1: string;
    pct2: number;
    label2: string;
    color2: string;
    isDark: boolean;
}) {
    return (
        <div className='space-y-4'>
            <div
                className={`h-12 w-full rounded-2xl border-2 backdrop-blur-lg overflow-hidden flex transition-all ${isDark ? 'bg-black/30 border-white/10' : 'bg-white/30 border-white/40'}`}
            >
                {/* First segment */}
                <div
                    className={`flex items-center justify-center font-black text-white text-sm transition-all duration-700 ${color1}`}
                    style={{ width: `${pct1}%`, minWidth: pct1 > 15 ? 'auto' : '0px' }}
                >
                    {pct1 > 15 && (
                        <>
                            <LiveNumber value={pct1} decimals={1} />%
                        </>
                    )}
                </div>
                {/* Second segment */}
                <div
                    className={`flex items-center justify-center font-black text-white text-sm transition-all duration-700 ${color2}`}
                    style={{ width: `${pct2}%`, minWidth: pct2 > 15 ? 'auto' : '0px' }}
                >
                    {pct2 > 15 && (
                        <>
                            <LiveNumber value={pct2} decimals={1} />%
                        </>
                    )}
                </div>
            </div>
            <div className='flex justify-between text-xs font-bold uppercase tracking-widest'>
                <div className='flex items-center gap-2'>
                    <div className={`w-3 h-3 rounded-full ${color1}`} />
                    <span>{label1}</span>
                </div>
                <div className='flex items-center gap-2'>
                    <div className={`w-3 h-3 rounded-full ${color2}`} />
                    <span>{label2}</span>
                </div>
            </div>
        </div>
    );
}

const STRATEGIES = [
    {
        id: 'over-under',
        label: 'Over/Under',
        shortLabel: 'O/U',
        icon: ArrowUpDown,
        activeClass: 'bg-[#0066FF] text-white shadow-lg shadow-[#0066FF]/25',
    },
    {
        id: 'even-odd',
        label: 'Even/Odd',
        shortLabel: 'E/O',
        icon: Hash,
        activeClass: 'bg-[#9F7AEA] text-white shadow-lg shadow-[#9F7AEA]/25',
    },
    {
        id: 'differs',
        label: 'Differs',
        shortLabel: 'DIF',
        icon: XCircle,
        activeClass: 'bg-[#FF6B35] text-white shadow-lg shadow-[#FF6B35]/25',
    },
    {
        id: 'matches',
        label: 'Matches',
        shortLabel: 'MTH',
        icon: CheckSquare,
        activeClass: 'bg-[#00D4AA] text-white shadow-lg shadow-[#00D4AA]/25',
    },
    {
        id: 'rise-fall',
        label: 'Rise/Fall',
        shortLabel: 'R/F',
        icon: TrendingUp,
        activeClass: 'bg-[#F59E0B] text-white shadow-lg shadow-[#F59E0B]/25',
    },
];

export function StatisticalAnalysis({ analysis, recentDigits, theme = 'dark' }: StatisticalAnalysisProps) {
    const [activeStrategy, setActiveStrategy] = useState('over-under');
    const [tick, setTick] = useState(0);

    // Live pulse every 1.5 s to simulate "live" feel
    useEffect(() => {
        const t = setInterval(() => setTick(n => n + 1), 1500);
        return () => clearInterval(t);
    }, []);

    /* ── Per-digit frequencies ── */
    const digitFrequencies = useMemo(() => {
        const counts = Array.from({ length: 10 }, () => 0);
        recentDigits.forEach(d => {
            if (d >= 0 && d <= 9) counts[d]++;
        });
        const total = recentDigits.length || 1;
        return counts.map((count, digit) => ({ digit, count, percentage: (count / total) * 100 }));
    }, [recentDigits]);

    /* ── Over/Under ── */
    const overUnderStats = useMemo(() => {
        const under = digitFrequencies.filter(f => f.digit <= 4);
        const over = digitFrequencies.filter(f => f.digit >= 5);
        const totalUnder = under.reduce((s, f) => s + f.percentage, 0);
        const totalOver = over.reduce((s, f) => s + f.percentage, 0);
        const highUnder = [...under].sort((a, b) => b.count - a.count)[0];
        const highOver = [...over].sort((a, b) => b.count - a.count)[0];
        return {
            underPct: totalUnder,
            overPct: totalOver,
            bestUnderDigit: highUnder?.digit ?? 0,
            bestUnderPct: highUnder?.percentage ?? 0,
            bestOverDigit: highOver?.digit ?? 5,
            bestOverPct: highOver?.percentage ?? 0,
            underDigits: under,
            overDigits: over,
        };
    }, [digitFrequencies]);

    /* ── Even/Odd ── */
    const evenOddStats = useMemo(() => {
        const even = digitFrequencies.filter(f => f.digit % 2 === 0);
        const odd = digitFrequencies.filter(f => f.digit % 2 !== 0);
        const totalEven = even.reduce((s, f) => s + f.percentage, 0);
        const totalOdd = odd.reduce((s, f) => s + f.percentage, 0);
        const highEven = [...even].sort((a, b) => b.count - a.count)[0];
        const highOdd = [...odd].sort((a, b) => b.count - a.count)[0];
        return {
            evenPct: totalEven,
            oddPct: totalOdd,
            bestEvenDigit: highEven?.digit ?? 0,
            bestEvenPct: highEven?.percentage ?? 0,
            bestOddDigit: highOdd?.digit ?? 1,
            bestOddPct: highOdd?.percentage ?? 0,
        };
    }, [digitFrequencies]);

    /* ── Matches ── */
    const matchesStats = useMemo(() => {
        const sorted = [...digitFrequencies].sort((a, b) => b.count - a.count);
        return { bestDigit: sorted[0]?.digit ?? 0, bestPct: sorted[0]?.percentage ?? 0, sorted };
    }, [digitFrequencies]);

    /* ── Differs ── */
    const differsStats = useMemo(() => {
        const sorted = [...digitFrequencies].sort((a, b) => a.count - b.count);
        return { safestDigit: sorted[0]?.digit ?? 0, safetyPct: 100 - (sorted[0]?.percentage ?? 0), sorted };
    }, [digitFrequencies]);

    /* ── Rise/Fall (Tick Direction) ── */
    const riseFailStats = useMemo(() => {
        if (recentDigits.length < 2) return { risePct: 50, fallPct: 50, riseCount: 0, fallCount: 0 };
        let rises = 0,
            falls = 0;
        for (let i = 1; i < recentDigits.length; i++) {
            const prev = recentDigits[i - 1];
            const curr = recentDigits[i];
            if (curr > prev) rises++;
            else if (curr < prev) falls++;
        }
        const total = rises + falls || 1;
        return { risePct: (rises / total) * 100, fallPct: (falls / total) * 100, riseCount: rises, fallCount: falls };
    }, [recentDigits]);

    const activeDef = STRATEGIES.find(s => s.id === activeStrategy)!;

    // Color theme variables
    const isDark = theme === 'dark';
    const textTitleClass = isDark ? 'text-white' : 'text-[#1A1A1A]';
    const textSubClass = isDark ? 'text-gray-400' : 'text-gray-600';
    const bgCardClass = isDark ? 'bg-[#1A1A1A]/80 border-gray-800' : 'bg-[#F5F5F5] border-gray-200';

    return (
        <div className='space-y-6'>
            {/* ── Header ── */}
            <div
                className={`relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl backdrop-blur-xl border transition-all duration-300 ${
                    isDark
                        ? 'bg-gradient-to-r from-blue-600/10 via-purple-600/5 to-blue-600/10 border-blue-400/30 shadow-lg shadow-blue-500/10'
                        : 'bg-gradient-to-r from-blue-50/50 via-white to-purple-50/50 border-blue-200/50 shadow-sm'
                }`}
            >
                <div className='flex items-center gap-4'>
                    <div
                        className={`p-3 rounded-xl backdrop-blur-md transition-all duration-300 ${
                            isDark
                                ? 'bg-gradient-to-br from-blue-500/30 to-purple-500/20 border border-blue-400/50 shadow-lg shadow-blue-500/20'
                                : 'bg-gradient-to-br from-blue-100/50 to-purple-100/50 border border-blue-200/50'
                        }`}
                    >
                        <Cpu className={`h-6 w-6 ${isDark ? 'text-blue-300' : 'text-blue-600'}`} />
                    </div>
                    <div className='flex-1'>
                        <h3
                            className={`text-lg font-black uppercase tracking-tight flex items-center gap-2 ${textTitleClass}`}
                        >
                            Quantum Statistics
                            <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${
                                    isDark
                                        ? 'bg-gradient-to-r from-emerald-500/30 to-emerald-500/20 border border-emerald-400/50 text-emerald-300 shadow-lg shadow-emerald-500/20'
                                        : 'bg-gradient-to-r from-emerald-100/50 to-emerald-100/30 border border-emerald-300/50 text-emerald-700'
                                }`}
                            >
                                <span className='w-2 h-2 rounded-full bg-emerald-400 animate-pulse' />
                                LIVE
                            </span>
                        </h3>
                        <p className={`text-[11px] font-semibold mt-1 ${textSubClass}`}>
                            Real-time distribution ·{' '}
                            <span className='text-blue-400 font-bold'>{recentDigits.length}</span> digits analyzed
                        </p>
                    </div>
                </div>

                {/* Strategy selector */}
                <div
                    className={`flex gap-1.5 p-1.5 rounded-xl border backdrop-blur-md transition-all ${
                        isDark
                            ? 'bg-black/30 border-white/10 shadow-lg shadow-black/20'
                            : 'bg-white/40 border-white/60 shadow-sm'
                    }`}
                >
                    {STRATEGIES.map(s => {
                        const Icon = s.icon;
                        const isActive = activeStrategy === s.id;
                        return (
                            <button
                                key={s.id}
                                onClick={() => setActiveStrategy(s.id)}
                                className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-wide flex items-center gap-1.5 transition-all duration-300 backdrop-blur-sm ${
                                    isActive
                                        ? `${s.activeClass} scale-105 shadow-xl`
                                        : isDark
                                          ? 'text-white/50 hover:text-white/80 hover:bg-white/10'
                                          : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                                }`}
                            >
                                <Icon className='h-3.5 w-3.5 shrink-0' />
                                <span className='hidden sm:inline'>{s.label}</span>
                                <span className='sm:hidden'>{s.shortLabel}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── Content panels ── */}
            <div className='min-h-[300px] animate-in fade-in slide-in-from-bottom-2 duration-300'>
                {/* OVER / UNDER */}
                {activeStrategy === 'over-under' && (
                    <div className='space-y-5'>
                        <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                            {/* Under card */}
                            <div
                                className={`relative overflow-hidden group p-6 rounded-2xl border backdrop-blur-xl transition-all duration-300 ${
                                    isDark
                                        ? 'bg-gradient-to-br from-emerald-600/15 via-black/40 to-black/30 border-emerald-400/30 shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 hover:border-emerald-400/50'
                                        : 'bg-gradient-to-br from-emerald-50/60 via-white/40 to-white/30 border-emerald-200/50 shadow-sm hover:shadow-md'
                                }`}
                            >
                                <div className='absolute top-0 right-0 p-4 opacity-[0.05] group-hover:opacity-15 transition-opacity'>
                                    <TrendingDown className='h-24 w-24 text-[#00D4AA] -rotate-12' />
                                </div>
                                <div className='relative space-y-4'>
                                    <div className='flex items-center justify-between'>
                                        <div className='text-lg font-bold text-[#00D4AA]'>Under (0-4)</div>
                                        <span className='text-4xl font-black tabular-nums font-mono text-[#00D4AA]'>
                                            <LiveNumber value={overUnderStats.underPct} />%
                                        </span>
                                    </div>
                                    <LiveBar
                                        pct={overUnderStats.underPct}
                                        colorClass='bg-[#00D4AA]'
                                        glowColor='rgba(0,212,170,0.4)'
                                    />
                                    <div
                                        className={`flex items-center justify-between pt-2 border-t ${isDark ? 'border-white/5' : 'border-gray-200'}`}
                                    >
                                        <span className='text-[9px] font-black text-gray-500 uppercase tracking-widest'>
                                            Hottest digit
                                        </span>
                                        <div className='flex items-center gap-1.5'>
                                            <span className={`text-lg font-black ${textTitleClass}`}>
                                                {overUnderStats.bestUnderDigit}
                                            </span>
                                            <span className='text-[9px] font-mono font-bold text-[#00D4AA]'>
                                                {overUnderStats.bestUnderPct.toFixed(1)}%
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Over card */}
                            <div
                                className={`relative overflow-hidden group p-6 rounded-2xl border backdrop-blur-xl transition-all duration-300 ${
                                    isDark
                                        ? 'bg-gradient-to-br from-blue-600/15 via-black/40 to-black/30 border-blue-400/30 shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 hover:border-blue-400/50'
                                        : 'bg-gradient-to-br from-blue-50/60 via-white/40 to-white/30 border-blue-200/50 shadow-sm hover:shadow-md'
                                }`}
                            >
                                <div className='absolute top-0 right-0 p-4 opacity-[0.05] group-hover:opacity-15 transition-opacity'>
                                    <TrendingUp className='h-24 w-24 text-[#0066FF] rotate-12' />
                                </div>
                                <div className='relative space-y-4'>
                                    <div className='flex items-center justify-between'>
                                        <div className='text-lg font-bold text-[#0066FF]'>Over (5-9)</div>
                                        <span className='text-4xl font-black tabular-nums font-mono text-[#0066FF]'>
                                            <LiveNumber value={overUnderStats.overPct} />%
                                        </span>
                                    </div>
                                    <LiveBar
                                        pct={overUnderStats.overPct}
                                        colorClass='bg-[#0066FF]'
                                        glowColor='rgba(0,102,255,0.4)'
                                    />
                                    <div
                                        className={`flex items-center justify-between pt-2 border-t ${isDark ? 'border-white/5' : 'border-gray-200'}`}
                                    >
                                        <span className='text-[9px] font-black text-gray-500 uppercase tracking-widest'>
                                            Hottest digit
                                        </span>
                                        <div className='flex items-center gap-1.5'>
                                            <span className={`text-lg font-black ${textTitleClass}`}>
                                                {overUnderStats.bestOverDigit}
                                            </span>
                                            <span className='text-[9px] font-mono font-bold text-[#0066FF]'>
                                                {overUnderStats.bestOverPct.toFixed(1)}%
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Bias Signal */}
                        <div
                            className={`flex items-center justify-between px-6 py-4 rounded-2xl border backdrop-blur-xl transition-all ${
                                isDark
                                    ? 'bg-gradient-to-r from-yellow-600/15 via-black/40 to-black/30 border-yellow-400/30 shadow-lg shadow-yellow-500/10'
                                    : 'bg-gradient-to-r from-yellow-50/60 via-white/40 to-white/30 border-yellow-200/50 shadow-sm'
                            }`}
                        >
                            <div className='flex items-center gap-2'>
                                <Zap
                                    className={`h-4 w-4 ${overUnderStats.underPct > overUnderStats.overPct ? 'text-[#00D4AA]' : 'text-[#0066FF]'}`}
                                />
                                <span className={`text-xs font-black uppercase tracking-widest ${textTitleClass}`}>
                                    AI Bias Signal
                                </span>
                            </div>
                            <span
                                className={`text-sm font-black uppercase tracking-widest ${
                                    overUnderStats.underPct > overUnderStats.overPct
                                        ? 'text-[#00D4AA]'
                                        : 'text-[#0066FF]'
                                }`}
                            >
                                {overUnderStats.underPct > overUnderStats.overPct ? 'UNDER BIAS' : 'OVER BIAS'}
                                <span className={`ml-2 text-[10px] font-mono opacity-60 ${textSubClass}`}>
                                    +{Math.abs(overUnderStats.underPct - overUnderStats.overPct).toFixed(1)}%
                                </span>
                            </span>
                        </div>

                        {/* Trading Recommendations - Entry/Exit Points */}
                        <div className='mt-6 space-y-3'>
                            <h3 className={`text-xs font-black uppercase tracking-widest px-2 ${textSubClass}`}>
                                Safe Entry & Exit Strategy (Last 15 Digits)
                            </h3>
                            <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                                {/* Under Entry/Exit */}
                                <div
                                    className={`p-4 rounded-xl border backdrop-blur-sm transition-all ${
                                        isDark
                                            ? 'bg-emerald-500/10 border-emerald-400/40 shadow-lg shadow-emerald-500/10'
                                            : 'bg-emerald-50/50 border-emerald-300/50'
                                    }`}
                                >
                                    <div
                                        className={`text-[11px] font-black uppercase tracking-widest ${isDark ? 'text-emerald-300' : 'text-emerald-700'} mb-2`}
                                    >
                                        Under Entry
                                    </div>
                                    <div className='space-y-1'>
                                        <div className='flex justify-between items-center'>
                                            <span className='text-[10px] text-gray-500'>Entry Point:</span>
                                            <span
                                                className={`font-black text-xs ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}
                                            >
                                                {overUnderStats.bestUnderDigit} - {overUnderStats.bestUnderDigit + 1}
                                            </span>
                                        </div>
                                        <div className='flex justify-between items-center'>
                                            <span className='text-[10px] text-gray-500'>Exit Point:</span>
                                            <span
                                                className={`font-black text-xs ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}
                                            >
                                                {Math.max(0, overUnderStats.bestUnderDigit - 1)} -{' '}
                                                {overUnderStats.bestUnderDigit}
                                            </span>
                                        </div>
                                        <div className='flex justify-between items-center pt-1 border-t border-emerald-400/20'>
                                            <span className='text-[10px] text-gray-500'>Market Power:</span>
                                            <span
                                                className={`font-mono font-bold text-xs ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}
                                            >
                                                {overUnderStats.underPct.toFixed(1)}%
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Over Entry/Exit */}
                                <div
                                    className={`p-4 rounded-xl border backdrop-blur-sm transition-all ${
                                        isDark
                                            ? 'bg-blue-500/10 border-blue-400/40 shadow-lg shadow-blue-500/10'
                                            : 'bg-blue-50/50 border-blue-300/50'
                                    }`}
                                >
                                    <div
                                        className={`text-[11px] font-black uppercase tracking-widest ${isDark ? 'text-blue-300' : 'text-blue-700'} mb-2`}
                                    >
                                        Over Entry
                                    </div>
                                    <div className='space-y-1'>
                                        <div className='flex justify-between items-center'>
                                            <span className='text-[10px] text-gray-500'>Entry Point:</span>
                                            <span
                                                className={`font-black text-xs ${isDark ? 'text-blue-400' : 'text-blue-600'}`}
                                            >
                                                {overUnderStats.bestOverDigit} - {overUnderStats.bestOverDigit + 1}
                                            </span>
                                        </div>
                                        <div className='flex justify-between items-center'>
                                            <span className='text-[10px] text-gray-500'>Exit Point:</span>
                                            <span
                                                className={`font-black text-xs ${isDark ? 'text-blue-400' : 'text-blue-600'}`}
                                            >
                                                {Math.max(5, overUnderStats.bestOverDigit - 1)} -{' '}
                                                {overUnderStats.bestOverDigit}
                                            </span>
                                        </div>
                                        <div className='flex justify-between items-center pt-1 border-t border-blue-400/20'>
                                            <span className='text-[10px] text-gray-500'>Market Power:</span>
                                            <span
                                                className={`font-mono font-bold text-xs ${isDark ? 'text-blue-300' : 'text-blue-700'}`}
                                            >
                                                {overUnderStats.overPct.toFixed(1)}%
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Best Strategy Recommendation */}
                            <div
                                className={`p-4 rounded-xl border-2 backdrop-blur-sm transition-all ${
                                    isDark
                                        ? `bg-gradient-to-r ${
                                              overUnderStats.underPct > overUnderStats.overPct
                                                  ? 'from-emerald-600/20 to-emerald-600/10 border-emerald-400/50'
                                                  : 'from-blue-600/20 to-blue-600/10 border-blue-400/50'
                                          }`
                                        : `bg-gradient-to-r ${
                                              overUnderStats.underPct > overUnderStats.overPct
                                                  ? 'from-emerald-100/50 to-emerald-50/50 border-emerald-400'
                                                  : 'from-blue-100/50 to-blue-50/50 border-blue-400'
                                          }`
                                }`}
                            >
                                <div
                                    className={`text-[10px] font-black uppercase tracking-widest mb-2 ${
                                        isDark
                                            ? overUnderStats.underPct > overUnderStats.overPct
                                                ? 'text-emerald-300'
                                                : 'text-blue-300'
                                            : overUnderStats.underPct > overUnderStats.overPct
                                              ? 'text-emerald-700'
                                              : 'text-blue-700'
                                    }`}
                                >
                                    Recommended Safe Trade
                                </div>
                                <div
                                    className={`text-sm font-black ${
                                        isDark
                                            ? overUnderStats.underPct > overUnderStats.overPct
                                                ? 'text-emerald-300'
                                                : 'text-blue-300'
                                            : overUnderStats.underPct > overUnderStats.overPct
                                              ? 'text-emerald-700'
                                              : 'text-blue-700'
                                    }`}
                                >
                                    {overUnderStats.underPct > overUnderStats.overPct
                                        ? `UNDER (0-4): Digit ${overUnderStats.bestUnderDigit}`
                                        : `OVER (5-9): Digit ${overUnderStats.bestOverDigit}`}
                                </div>
                                <div className={`text-[9px] mt-1 ${textSubClass}`}>
                                    Confidence: {Math.abs(overUnderStats.underPct - overUnderStats.overPct).toFixed(1)}%
                                    | Based on last 15 digits analysis
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* EVEN / ODD */}
                {activeStrategy === 'even-odd' && (
                    <div className='space-y-5'>
                        <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                            {/* Even card */}
                            <div
                                className={`p-6 rounded-2xl border backdrop-blur-xl relative overflow-hidden group space-y-4 transition-all ${
                                    isDark
                                        ? 'bg-gradient-to-br from-blue-600/15 via-black/40 to-black/30 border-blue-400/30 shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 hover:border-blue-400/50'
                                        : 'bg-gradient-to-br from-blue-50/60 via-white/40 to-white/30 border-blue-200/50 shadow-sm hover:shadow-md'
                                }`}
                            >
                                <div className='flex items-center justify-between'>
                                    <div className='text-lg font-bold text-[#0066FF]'>Even</div>
                                    <span className='text-4xl font-black tabular-nums font-mono text-[#0066FF]'>
                                        <LiveNumber value={evenOddStats.evenPct} />%
                                    </span>
                                </div>
                                <LiveBar
                                    pct={evenOddStats.evenPct}
                                    colorClass='bg-[#0066FF]'
                                    glowColor='rgba(0,102,255,0.4)'
                                />
                                <div
                                    className={`flex items-center justify-between pt-2 border-t ${isDark ? 'border-white/5' : 'border-gray-200'}`}
                                >
                                    <span className='text-[9px] font-black text-gray-500 uppercase tracking-widest'>
                                        Top digit
                                    </span>
                                    <div className='flex items-center gap-1.5'>
                                        <span className={`text-lg font-black ${textTitleClass}`}>
                                            {evenOddStats.bestEvenDigit}
                                        </span>
                                        <span className='text-[9px] font-mono font-bold text-[#0066FF]'>
                                            {evenOddStats.bestEvenPct.toFixed(1)}%
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Odd card */}
                            <div
                                className={`p-6 rounded-2xl border backdrop-blur-xl relative overflow-hidden group space-y-4 transition-all ${
                                    isDark
                                        ? 'bg-gradient-to-br from-orange-600/15 via-black/40 to-black/30 border-orange-400/30 shadow-lg shadow-orange-500/10 hover:shadow-orange-500/20 hover:border-orange-400/50'
                                        : 'bg-gradient-to-br from-orange-50/60 via-white/40 to-white/30 border-orange-200/50 shadow-sm hover:shadow-md'
                                }`}
                            >
                                <div className='flex items-center justify-between'>
                                    <div className='text-lg font-bold text-[#FF6B35]'>Odd</div>
                                    <span className='text-4xl font-black tabular-nums font-mono text-[#FF6B35]'>
                                        <LiveNumber value={evenOddStats.oddPct} />%
                                    </span>
                                </div>
                                <LiveBar
                                    pct={evenOddStats.oddPct}
                                    colorClass='bg-[#FF6B35]'
                                    glowColor='rgba(255,107,53,0.4)'
                                />
                                <div
                                    className={`flex items-center justify-between pt-2 border-t ${isDark ? 'border-white/5' : 'border-gray-200'}`}
                                >
                                    <span className='text-[9px] font-black text-gray-500 uppercase tracking-widest'>
                                        Top digit
                                    </span>
                                    <div className='flex items-center gap-1.5'>
                                        <span className={`text-lg font-black ${textTitleClass}`}>
                                            {evenOddStats.bestOddDigit}
                                        </span>
                                        <span className='text-[9px] font-mono font-bold text-[#FF6B35]'>
                                            {evenOddStats.bestOddPct.toFixed(1)}%
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Bias Signal */}
                        <div
                            className={`flex items-center justify-between px-6 py-4 rounded-2xl border backdrop-blur-xl transition-all ${
                                isDark
                                    ? 'bg-gradient-to-r from-purple-600/15 via-black/40 to-black/30 border-purple-400/30 shadow-lg shadow-purple-500/10'
                                    : 'bg-gradient-to-r from-purple-50/60 via-white/40 to-white/30 border-purple-200/50 shadow-sm'
                            }`}
                        >
                            <div className='flex items-center gap-2'>
                                <Zap
                                    className={`h-4 w-4 ${evenOddStats.evenPct > evenOddStats.oddPct ? 'text-blue-400' : 'text-orange-400'}`}
                                />
                                <span className={`text-xs font-black uppercase tracking-widest ${textTitleClass}`}>
                                    AI Bias Signal
                                </span>
                            </div>
                            <span
                                className={`text-sm font-black uppercase tracking-widest ${evenOddStats.evenPct > evenOddStats.oddPct ? 'text-blue-400' : 'text-orange-400'}`}
                            >
                                {evenOddStats.evenPct > evenOddStats.oddPct ? 'EVEN BIAS' : 'ODD BIAS'}
                                <span className={`ml-2 text-[10px] font-mono opacity-60 ${textSubClass}`}>
                                    +{Math.abs(evenOddStats.evenPct - evenOddStats.oddPct).toFixed(1)}%
                                </span>
                            </span>
                        </div>
                    </div>
                )}

                {/* RISE / FALL */}
                {activeStrategy === 'rise-fall' && (
                    <div className='space-y-5'>
                        <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                            {/* Rise card */}
                            <div
                                className={`relative overflow-hidden group p-6 rounded-2xl border backdrop-blur-xl transition-all duration-300 ${
                                    isDark
                                        ? 'bg-gradient-to-br from-amber-600/15 via-black/40 to-black/30 border-amber-400/30 shadow-lg shadow-amber-500/10 hover:shadow-amber-500/20 hover:border-amber-400/50'
                                        : 'bg-gradient-to-br from-amber-50/60 via-white/40 to-white/30 border-amber-200/50 shadow-sm hover:shadow-md'
                                }`}
                            >
                                <div className='absolute top-0 right-0 p-4 opacity-[0.05] group-hover:opacity-15 transition-opacity'>
                                    <TrendingUp className='h-24 w-24 text-amber-500 rotate-12' />
                                </div>
                                <div className='relative space-y-4'>
                                    <div className='flex items-center justify-between'>
                                        <div className='text-lg font-bold text-amber-500'>Rise</div>
                                        <span className='text-4xl font-black tabular-nums font-mono text-amber-500'>
                                            <LiveNumber value={riseFailStats.risePct} />%
                                        </span>
                                    </div>
                                    <LiveBar
                                        pct={riseFailStats.risePct}
                                        colorClass='bg-amber-500'
                                        glowColor='rgba(245,158,11,0.4)'
                                    />
                                    <div
                                        className={`flex items-center justify-between pt-2 border-t ${isDark ? 'border-white/5' : 'border-gray-200'}`}
                                    >
                                        <span className='text-[9px] font-black text-gray-500 uppercase tracking-widest'>
                                            Tick Count
                                        </span>
                                        <span className='text-sm font-mono font-bold text-amber-500'>
                                            {riseFailStats.riseCount} ticks
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Fall card */}
                            <div
                                className={`relative overflow-hidden group p-6 rounded-2xl border backdrop-blur-xl transition-all duration-300 ${
                                    isDark
                                        ? 'bg-gradient-to-br from-red-600/15 via-black/40 to-black/30 border-red-400/30 shadow-lg shadow-red-500/10 hover:shadow-red-500/20 hover:border-red-400/50'
                                        : 'bg-gradient-to-br from-red-50/60 via-white/40 to-white/30 border-red-200/50 shadow-sm hover:shadow-md'
                                }`}
                            >
                                <div className='absolute top-0 right-0 p-4 opacity-[0.05] group-hover:opacity-15 transition-opacity'>
                                    <TrendingDown className='h-24 w-24 text-red-500 -rotate-12' />
                                </div>
                                <div className='relative space-y-4'>
                                    <div className='flex items-center justify-between'>
                                        <div className='text-lg font-bold text-red-500'>Fall</div>
                                        <span className='text-4xl font-black tabular-nums font-mono text-red-500'>
                                            <LiveNumber value={riseFailStats.fallPct} />%
                                        </span>
                                    </div>
                                    <LiveBar
                                        pct={riseFailStats.fallPct}
                                        colorClass='bg-red-500'
                                        glowColor='rgba(239,68,68,0.4)'
                                    />
                                    <div
                                        className={`flex items-center justify-between pt-2 border-t ${isDark ? 'border-white/5' : 'border-gray-200'}`}
                                    >
                                        <span className='text-[9px] font-black text-gray-500 uppercase tracking-widest'>
                                            Tick Count
                                        </span>
                                        <span className='text-sm font-mono font-bold text-red-500'>
                                            {riseFailStats.fallCount} ticks
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Trend Signal */}
                        <div
                            className={`flex items-center justify-between px-6 py-4 rounded-2xl border backdrop-blur-xl transition-all ${
                                isDark
                                    ? 'bg-gradient-to-r from-amber-600/15 via-black/40 to-black/30 border-amber-400/30 shadow-lg shadow-amber-500/10'
                                    : 'bg-gradient-to-r from-amber-50/60 via-white/40 to-white/30 border-amber-200/50 shadow-sm'
                            }`}
                        >
                            <div className='flex items-center gap-2'>
                                <TrendingUp
                                    className={`h-4 w-4 ${riseFailStats.risePct > riseFailStats.fallPct ? 'text-amber-500' : 'text-red-500'}`}
                                />
                                <span className={`text-xs font-black uppercase tracking-widest ${textTitleClass}`}>
                                    Trend Prediction
                                </span>
                            </div>
                            <span
                                className={`text-sm font-black uppercase tracking-widest ${riseFailStats.risePct > riseFailStats.fallPct ? 'text-amber-500' : 'text-red-500'}`}
                            >
                                {riseFailStats.risePct > riseFailStats.fallPct ? 'RISE TREND' : 'FALL TREND'}
                                <span className={`ml-2 text-[10px] font-mono opacity-60 ${textSubClass}`}>
                                    +{Math.abs(riseFailStats.risePct - riseFailStats.fallPct).toFixed(1)}%
                                </span>
                            </span>
                        </div>
                    </div>
                )}

                {/* MATCHES */}
                {activeStrategy === 'matches' && (
                    <div className='space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300'>
                        {/* Digit frequency grid */}
                        <div className='grid grid-cols-5 sm:grid-cols-10 gap-2'>
                            {matchesStats.sorted.map((f, rank) => {
                                const isBest = f.digit === matchesStats.bestDigit;
                                const barH = Math.max(
                                    8,
                                    (f.percentage / Math.max(...matchesStats.sorted.map(d => d.percentage))) * 60
                                );
                                return (
                                    <div
                                        key={f.digit}
                                        className={`flex flex-col items-center gap-1 p-2 rounded-xl border backdrop-blur-sm transition-all ${
                                            isBest
                                                ? isDark
                                                    ? 'bg-emerald-500/20 border-emerald-400/60 shadow-lg shadow-emerald-500/30 scale-105'
                                                    : 'bg-emerald-100/50 border-emerald-400/50 shadow-md'
                                                : isDark
                                                  ? 'bg-white/[0.04] border-white/10 hover:bg-white/[0.08]'
                                                  : 'bg-white/50 border-gray-300/50 hover:bg-white/70'
                                        }`}
                                    >
                                        {/* Bar */}
                                        <div
                                            className='w-full flex items-end justify-center'
                                            style={{ height: '56px' }}
                                        >
                                            <div
                                                className={`w-3/4 rounded-sm transition-all duration-700 ${isBest ? 'bg-[#00D4AA]' : isDark ? 'bg-white/20' : 'bg-black/10'}`}
                                                style={{
                                                    height: `${barH}px`,
                                                    boxShadow: isBest ? '0 0 8px rgba(0,212,170,0.6)' : 'none',
                                                }}
                                            />
                                        </div>
                                        <span
                                            className={`text-sm font-black tabular-nums ${isBest ? 'text-[#00D4AA]' : textTitleClass}`}
                                        >
                                            {f.digit}
                                        </span>
                                        <span className={`text-[8px] font-mono font-bold ${textSubClass}`}>
                                            {f.percentage.toFixed(0)}%
                                        </span>
                                        {isBest && (
                                            <span className='text-[7px] font-black text-[#00D4AA] uppercase tracking-wider'>
                                                HOT
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        {/* Recommendation */}
                        <div
                            className={`flex items-center gap-5 p-6 rounded-2xl border backdrop-blur-xl transition-all ${
                                isDark
                                    ? 'bg-gradient-to-r from-emerald-600/15 via-black/40 to-black/30 border-emerald-400/30 shadow-lg shadow-emerald-500/15'
                                    : 'bg-gradient-to-r from-emerald-50/60 via-white/40 to-white/30 border-emerald-200/50 shadow-sm'
                            }`}
                        >
                            <div
                                className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 backdrop-blur-sm transition-all ${
                                    isDark
                                        ? 'bg-emerald-500/20 border-emerald-400/50 shadow-lg shadow-emerald-500/20'
                                        : 'bg-emerald-100/50 border-emerald-300/50'
                                }`}
                            >
                                <Star className='h-6 w-6 text-emerald-400' />
                            </div>
                            <div className='flex-1'>
                                <p className='text-[9px] font-black text-[#00D4AA] uppercase tracking-widest mb-0.5'>
                                    Best Match Target
                                </p>
                                <p className={`text-xl font-black ${textTitleClass}`}>
                                    Digit <span className='text-[#00D4AA]'>{matchesStats.bestDigit}</span>
                                </p>
                                <p className={`text-[10px] mt-0.5 ${textSubClass}`}>
                                    Highest frequency — {matchesStats.bestPct.toFixed(1)}% occurrence in last{' '}
                                    {recentDigits.length} digits
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* DIFFERS */}
                {activeStrategy === 'differs' && (
                    <div className='space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300'>
                        {/* Safety grid */}
                        <div className='grid grid-cols-5 sm:grid-cols-10 gap-2'>
                            {differsStats.sorted.map(f => {
                                const safety = 100 - f.percentage;
                                const isSafest = f.digit === differsStats.safestDigit;
                                const barH = Math.max(8, (safety / 100) * 60);
                                return (
                                    <div
                                        key={f.digit}
                                        className={`flex flex-col items-center gap-1 p-2 rounded-xl border backdrop-blur-sm transition-all ${
                                            isSafest
                                                ? isDark
                                                    ? 'bg-orange-500/20 border-orange-400/60 shadow-lg shadow-orange-500/30 scale-105'
                                                    : 'bg-orange-100/50 border-orange-400/50 shadow-md'
                                                : isDark
                                                  ? 'bg-white/[0.04] border-white/10 hover:bg-white/[0.08]'
                                                  : 'bg-white/50 border-gray-300/50 hover:bg-white/70'
                                        }`}
                                    >
                                        <div
                                            className='w-full flex items-end justify-center'
                                            style={{ height: '56px' }}
                                        >
                                            <div
                                                className={`w-3/4 rounded-sm transition-all duration-700 ${isSafest ? 'bg-[#FF6B35]' : isDark ? 'bg-white/20' : 'bg-black/10'}`}
                                                style={{
                                                    height: `${barH}px`,
                                                    boxShadow: isSafest ? '0 0 8px rgba(255,107,53,0.6)' : 'none',
                                                }}
                                            />
                                        </div>
                                        <span
                                            className={`text-sm font-black tabular-nums ${isSafest ? 'text-[#FF6B35]' : textTitleClass}`}
                                        >
                                            {f.digit}
                                        </span>
                                        <span className={`text-[8px] font-mono font-bold ${textSubClass}`}>
                                            {safety.toFixed(0)}%
                                        </span>
                                        {isSafest && (
                                            <span className='text-[7px] font-black text-[#FF6B35] uppercase tracking-wider'>
                                                SAFE
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        {/* Recommendation */}
                        <div
                            className={`flex items-center gap-5 p-6 rounded-2xl border backdrop-blur-xl transition-all ${
                                isDark
                                    ? 'bg-gradient-to-r from-orange-600/15 via-black/40 to-black/30 border-orange-400/30 shadow-lg shadow-orange-500/15'
                                    : 'bg-gradient-to-r from-orange-50/60 via-white/40 to-white/30 border-orange-200/50 shadow-sm'
                            }`}
                        >
                            <div
                                className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 backdrop-blur-sm transition-all ${
                                    isDark
                                        ? 'bg-orange-500/20 border-orange-400/50 shadow-lg shadow-orange-500/20'
                                        : 'bg-orange-100/50 border-orange-300/50'
                                }`}
                            >
                                <ShieldAlert className='h-6 w-6 text-orange-400' />
                            </div>
                            <div className='flex-1'>
                                <p className='text-[9px] font-black text-[#FF6B35] uppercase tracking-widest mb-0.5'>
                                    Safest Differs Target
                                </p>
                                <p className={`text-xl font-black ${textTitleClass}`}>
                                    Digit <span className='text-[#FF6B35]'>{differsStats.safestDigit}</span>
                                </p>
                                <p className={`text-[10px] mt-0.5 ${textSubClass}`}>
                                    Lowest frequency — {differsStats.safetyPct.toFixed(1)}% safety threshold in last{' '}
                                    {recentDigits.length} digits
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
