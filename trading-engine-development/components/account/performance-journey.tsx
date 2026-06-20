'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDerivAPI } from '@/lib/deriv-api-context';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import {
    TrendingUp,
    TrendingDown,
    Wallet,
    ArrowDownCircle,
    ArrowUpCircle,
    Activity,
    RefreshCcw,
    Trophy,
    Target,
    Zap,
    BarChart3,
    BookOpen,
    CheckCircle2,
    XCircle,
    Rocket,
    Gauge,
} from 'lucide-react';

interface JourneyEvent {
    type: 'deposit' | 'withdrawal' | 'trade_win' | 'trade_loss' | 'other';
    amount: number;
    time: number;
    balance: number;
    description: string;
}

interface PerformanceJourneyProps {
    theme?: 'light' | 'dark';
}

const EVENT_COLORS = {
    deposit: '#10b981',
    withdrawal: '#f43f5e',
    trade_win: '#3b82f6',
    trade_loss: '#f43f5e',
    other: '#6b7280',
};

const RADIAN = Math.PI / 180;
function CustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) {
    if (percent < 0.05) return null;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
        <text x={x} y={y} fill='white' textAnchor='middle' dominantBaseline='central' fontSize={11} fontWeight='bold'>
            {`${(percent * 100).toFixed(0)}%`}
        </text>
    );
}

export function PerformanceJourney({ theme = 'dark' }: PerformanceJourneyProps) {
    const { apiClient, isAuthorized, activeLoginId } = useDerivAPI();
    const [events, setEvents] = useState<JourneyEvent[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const formatCurrency = (val: number | undefined | null) => {
        const safeVal = val == null || isNaN(Number(val)) ? 0 : Number(val);
        return safeVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const fetchJourneyData = useCallback(async () => {
        if (!apiClient || !isAuthorized) return;
        setIsLoading(true);
        setError(null);
        try {
            const response = await apiClient.getStatement(200);
            if (response?.transactions) {
                const processEvents: JourneyEvent[] = [...response.transactions].reverse().map((tx: any) => {
                    const action = tx.action_type?.toLowerCase();
                    let type: JourneyEvent['type'] = 'other';
                    if (action === 'deposit') type = 'deposit';
                    else if (action === 'withdrawal') type = 'withdrawal';
                    else if (action === 'buy' || action === 'sell') {
                        type = tx.amount > 0 ? 'trade_win' : 'trade_loss';
                    }
                    return {
                        type,
                        amount: tx.amount,
                        time: tx.transaction_time,
                        balance: tx.balance_after,
                        description: tx.longcode || tx.display_name || action,
                    };
                });
                setEvents(processEvents);
            }
        } catch (err: any) {
            setError(err?.message || 'Failed to load journey data');
        } finally {
            setIsLoading(false);
        }
    }, [apiClient, isAuthorized]);

    useEffect(() => {
        fetchJourneyData();
    }, [fetchJourneyData, activeLoginId]);

    const metrics = useMemo(() => {
        const deposited = events.filter(e => e.type === 'deposit').reduce((s, e) => s + e.amount, 0);
        const withdrawn = events.filter(e => e.type === 'withdrawal').reduce((s, e) => s + Math.abs(e.amount), 0);
        const tradeTxs = events.filter(e => e.type === 'trade_win' || e.type === 'trade_loss');
        const wins = tradeTxs.filter(e => e.type === 'trade_win');
        const losses = tradeTxs.filter(e => e.type === 'trade_loss');
        const tradingPnL = tradeTxs.reduce((s, e) => s + e.amount, 0);
        const winRate = tradeTxs.length > 0 ? (wins.length / tradeTxs.length) * 100 : 0;
        const avgWin = wins.length > 0 ? wins.reduce((s, e) => s + e.amount, 0) / wins.length : 0;
        const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, e) => s + e.amount, 0)) / losses.length : 0;
        const currentBal = events.length > 0 ? events[events.length - 1].balance : 0;
        return {
            deposited,
            withdrawn,
            tradingPnL,
            wins: wins.length,
            losses: losses.length,
            total: tradeTxs.length,
            winRate,
            avgWin,
            avgLoss,
            currentBal,
        };
    }, [events]);

    const pieData = useMemo(
        () =>
            [
                { name: 'Trade Wins', value: metrics.wins, color: '#10b981' },
                { name: 'Trade Losses', value: metrics.losses, color: '#f43f5e' },
                { name: 'Deposits', value: events.filter(e => e.type === 'deposit').length, color: '#3b82f6' },
                { name: 'Withdrawals', value: events.filter(e => e.type === 'withdrawal').length, color: '#f59e0b' },
            ].filter(d => d.value > 0),
        [metrics, events]
    );

    const scorecards = [
        {
            label: 'Aggregate Deposit',
            value: `$${formatCurrency(metrics.deposited)}`,
            icon: <ArrowDownCircle className='h-5 w-5' />,
            color: 'text-emerald-400',
            bgColor: 'bg-emerald-500/5',
            borderColor: 'border-emerald-500/20',
        },
        {
            label: 'Aggregate Withdrawal',
            value: `$${formatCurrency(metrics.withdrawn)}`,
            icon: <ArrowUpCircle className='h-5 w-5' />,
            color: 'text-rose-400',
            bgColor: 'bg-rose-500/5',
            borderColor: 'border-rose-500/20',
        },
        {
            label: 'Net Trajectory',
            value: `${metrics.tradingPnL >= 0 ? '+' : ''}$${formatCurrency(metrics.tradingPnL)}`,
            icon: <Activity className='h-5 w-5' />,
            color: metrics.tradingPnL >= 0 ? 'text-blue-400' : 'text-rose-400',
            bgColor: metrics.tradingPnL >= 0 ? 'bg-blue-500/5' : 'bg-rose-500/5',
            borderColor: metrics.tradingPnL >= 0 ? 'border-blue-500/20' : 'border-rose-500/20',
        },
        {
            label: 'Realized Liquidity',
            value: `$${formatCurrency(metrics.currentBal)}`,
            icon: <Wallet className='h-5 w-5' />,
            color: 'text-purple-400',
            bgColor: 'bg-purple-500/5',
            borderColor: 'border-purple-500/20',
        },
    ];

    const performanceMetrics = [
        {
            label: 'Win Quotient',
            value: `${(metrics.winRate ?? 0).toFixed(1)}%`,
            icon: <Gauge className='h-4 w-4 text-emerald-400' />,
            color: metrics.winRate >= 50 ? 'text-emerald-400' : 'text-rose-400',
            tag: metrics.winRate >= 50 ? 'OPTIMIZED' : 'STABLE',
        },
        {
            label: 'Trade Volume',
            value: metrics.total,
            icon: <Activity className='h-4 w-4 text-blue-400' />,
            color: 'text-white',
            tag: 'VOLUME',
        },
        {
            label: 'Avg Win Node',
            value: `$${(metrics.avgWin ?? 0).toFixed(2)}`,
            icon: <TrendingUp className='h-4 w-4 text-emerald-400' />,
            color: 'text-emerald-400',
            tag: 'PEAK',
        },
        {
            label: 'Avg Loss Node',
            value: `$${(metrics.avgLoss ?? 0).toFixed(2)}`,
            icon: <TrendingDown className='h-4 w-4 text-rose-400' />,
            color: 'text-rose-400',
            tag: 'RISK',
        },
    ];

    return (
        <div className='space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700'>
            {/* Header */}
            <div className='flex items-center justify-between xl:px-2'>
                <div>
                    <h3 className='text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3'>
                        <Rocket className='h-6 w-6 text-indigo-500' /> Velocity Journey
                    </h3>
                    <p className='text-[10px] text-white/30 font-bold uppercase tracking-[0.2em] mt-1'>
                        {events.length} temporal events synchronized via core
                    </p>
                </div>
                <button
                    onClick={fetchJourneyData}
                    className='px-6 py-2.5 bg-white/5 border border-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white hover:bg-white/10 transition-all flex items-center gap-2'
                >
                    <RefreshCcw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh Engine
                </button>
            </div>

            {/* Scorecards */}
            <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
                {scorecards.map((s, i) => (
                    <div
                        key={i}
                        className={`group relative overflow-hidden rounded-[2rem] border transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl ${s.bgColor} ${s.borderColor}`}
                    >
                        <div className='absolute top-0 right-0 p-4 opacity-10 rotate-12 transition-transform group-hover:scale-125'>
                            {s.icon}
                        </div>
                        <div className='relative p-6'>
                            <div className={`${s.color} mb-4 drop-shadow-[0_0_8px_currentColor] opacity-70`}>
                                {s.icon}
                            </div>
                            <p className='text-[10px] font-black uppercase tracking-[0.2em] text-white/20 mb-1 leading-none'>
                                {s.label}
                            </p>
                            <p className={`text-2xl font-black tracking-tighter tabular-nums ${s.color}`}>{s.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {isLoading ? (
                <div className='h-[400px] flex items-center justify-center'>
                    <div className='relative w-16 h-16'>
                        <div className='w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin' />
                        <div className='absolute inset-2 border-4 border-purple-500/20 border-b-purple-500 rounded-full animate-spin [animation-direction:reverse] [animation-duration:800ms]' />
                    </div>
                </div>
            ) : events.length > 0 ? (
                <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                    {/* Activity Breakdown Visualizer */}
                    <div className='bg-[#0a0a0a] border border-white/5 rounded-[2.5rem] p-8 shadow-[0_30px_60px_rgba(0,0,0,0.4)]'>
                        <div className='mb-8'>
                            <p className='text-sm font-black uppercase tracking-widest text-white mb-1'>
                                Activity Spectrum
                            </p>
                            <p className='text-[10px] text-white/30 font-bold uppercase tracking-[0.2em]'>
                                Temporal distribution of account states
                            </p>
                        </div>
                        <div className='h-[280px]'>
                            <ResponsiveContainer width='100%' height='100%'>
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx='50%'
                                        cy='50%'
                                        outerRadius={110}
                                        innerRadius={60}
                                        paddingAngle={4}
                                        dataKey='value'
                                        labelLine={false}
                                        label={CustomLabel}
                                        strokeWidth={0}
                                    >
                                        {pieData.map((entry, idx) => (
                                            <Cell key={idx} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{
                                            background: '#0a0f1e',
                                            border: '1px solid rgba(255,255,255,0.08)',
                                            borderRadius: 16,
                                            fontSize: 12,
                                            padding: 12,
                                        }}
                                    />
                                    <Legend
                                        formatter={value => (
                                            <span className='text-[10px] font-black uppercase tracking-widest text-white/40 ml-2'>
                                                {value}
                                            </span>
                                        )}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Operational Scoreboard */}
                    <div className='bg-[#0a0a0a] border border-white/5 rounded-[2.5rem] p-8 shadow-[0_30px_60px_rgba(0,0,0,0.4)] flex flex-col'>
                        <div className='mb-8'>
                            <p className='text-sm font-black uppercase tracking-widest text-white mb-1'>
                                Operational Scoreboard
                            </p>
                            <p className='text-[10px] text-white/30 font-bold uppercase tracking-[0.2em]'>
                                High-precision performance metrics
                            </p>
                        </div>
                        <div className='grid grid-cols-2 gap-4 flex-1'>
                            {performanceMetrics.map((m, i) => (
                                <div
                                    key={i}
                                    className='group relative bg-white/[0.02] border border-white/5 rounded-[1.5rem] p-5 transition-all hover:bg-white/[0.05] hover:border-white/10'
                                >
                                    <div className='flex justify-between items-start mb-4'>
                                        <div className='p-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-white/40 group-hover:text-white transition-colors'>
                                            {m.icon}
                                        </div>
                                        <span className='text-[8px] font-black text-white/10 group-hover:text-blue-500/40 tracking-[0.2em] uppercase transition-colors'>
                                            {m.tag}
                                        </span>
                                    </div>
                                    <p className='text-[9px] font-black uppercase tracking-[0.2em] text-white/20 mb-1'>
                                        {m.label}
                                    </p>
                                    <p className={`text-xl font-black tracking-tighter tabular-nums ${m.color}`}>
                                        {m.value}
                                    </p>
                                </div>
                            ))}
                        </div>

                        {/* Dynamic Win-Rate Velocity Bar */}
                        <div className='mt-8 pt-6 border-t border-white/5'>
                            <div className='flex justify-between text-[10px] font-black uppercase tracking-widest text-white/40 mb-3'>
                                <span>Yield Momentum</span>
                                <span className={metrics.winRate >= 50 ? 'text-emerald-400' : 'text-rose-400'}>
                                    {metrics.winRate.toFixed(1)}%
                                </span>
                            </div>
                            <div className='w-full h-2.5 bg-white/5 rounded-full overflow-hidden border border-white/5'>
                                <div
                                    className={`h-full transition-all duration-1000 shadow-[0_0_15px_currentColor] ${metrics.winRate >= 50 ? 'bg-emerald-500 text-emerald-500' : 'bg-rose-500 text-rose-500'}`}
                                    style={{ width: `${Math.min(metrics.winRate, 100)}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}

            {/* Event Chronology - Modern Journal */}
            <div className='bg-[#0a0a0a] border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl'>
                <div className='px-8 py-7 border-b border-white/[0.05] flex items-center justify-between'>
                    <div className='flex items-center gap-3'>
                        <div className='p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400'>
                            <BookOpen className='h-5 w-5' />
                        </div>
                        <div>
                            <p className='text-xl font-black text-white uppercase tracking-tighter'>Event Chronology</p>
                            <p className='text-[10px] text-white/30 font-bold uppercase tracking-[0.2em] mt-0.5'>
                                Sequential audit of all account trajectories
                            </p>
                        </div>
                    </div>
                    <span className='bg-white/[0.03] text-white/20 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border border-white/5'>
                        RECENT {Math.min(events.length, 20)} NODES
                    </span>
                </div>
                <div className='divide-y divide-white/[0.03] max-h-[480px] overflow-y-auto custom-scrollbar'>
                    {[...events]
                        .reverse()
                        .slice(0, 20)
                        .map((event, idx) => (
                            <div
                                key={idx}
                                className='group flex items-start gap-6 px-8 py-6 transition-all hover:bg-white/[0.015]'
                            >
                                <div
                                    className={`w-12 h-12 rounded-[1.25rem] flex items-center justify-center shrink-0 border shadow-2xl transition-transform group-hover:scale-110 ${
                                        event.type === 'deposit'
                                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                            : event.type === 'withdrawal'
                                              ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                                              : event.type === 'trade_win'
                                                ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                                                : event.type === 'trade_loss'
                                                  ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                                                  : 'bg-white/5 border-white/10 text-white/40'
                                    }`}
                                >
                                    {event.type === 'deposit' || event.type === 'withdrawal' ? (
                                        event.type === 'deposit' ? (
                                            <ArrowDownCircle className='h-5 w-5' />
                                        ) : (
                                            <ArrowUpCircle className='h-5 w-5' />
                                        )
                                    ) : event.type === 'trade_win' || event.type === 'trade_loss' ? (
                                        event.type === 'trade_win' ? (
                                            <TrendingUp className='h-5 w-5' />
                                        ) : (
                                            <TrendingDown className='h-5 w-5' />
                                        )
                                    ) : (
                                        <Activity className='h-5 w-5' />
                                    )}
                                </div>
                                <div className='flex-1 min-w-0'>
                                    <div className='flex justify-between items-start gap-2 mb-1.5'>
                                        <div className='flex items-center gap-3'>
                                            <span
                                                className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border ${
                                                    event.type === 'deposit'
                                                        ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/10'
                                                        : event.type === 'withdrawal'
                                                          ? 'bg-rose-500/5 text-rose-400 border-rose-500/10'
                                                          : event.type === 'trade_win'
                                                            ? 'bg-blue-500/5 text-blue-400 border-blue-500/10'
                                                            : event.type === 'trade_loss'
                                                              ? 'bg-rose-500/5 text-rose-400 border-rose-500/10'
                                                              : 'bg-white/5 text-white/40 border-white/10'
                                                }`}
                                            >
                                                {event.type.replace('_', ' ')}
                                            </span>
                                            <span className='text-[10px] font-mono font-bold text-white/10 tracking-tighter'>
                                                #{Math.random().toString(36).substr(2, 6).toUpperCase()}
                                            </span>
                                        </div>
                                        <span className='text-[9px] font-black text-white/10 uppercase tracking-widest bg-white/[0.02] px-2 py-1 rounded-md'>
                                            {new Date(event.time * 1000).toLocaleDateString(undefined, {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric',
                                            })}
                                        </span>
                                    </div>
                                    <p className='text-sm font-bold text-white/40 leading-relaxed truncate group-hover:text-white/60 transition-colors uppercase tracking-tight'>
                                        {event.description}
                                    </p>
                                    <div className='flex items-center gap-6 mt-3'>
                                        <div className='flex flex-col'>
                                            <span className='text-[9px] font-black text-white/10 uppercase tracking-widest mb-0.5'>
                                                TRANS DELTA
                                            </span>
                                            <span
                                                className={`text-lg font-black tracking-tighter tabular-nums ${event.amount >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
                                            >
                                                {event.amount >= 0 ? '+' : ''}
                                                {formatCurrency(Math.abs(event.amount))}
                                            </span>
                                        </div>
                                        <div className='flex flex-col'>
                                            <span className='text-[9px] font-black text-white/10 uppercase tracking-widest mb-0.5'>
                                                POST-TRAJECTORY BAL
                                            </span>
                                            <span className='text-lg font-black text-white/60 tracking-tighter tabular-nums'>
                                                {formatCurrency(event.balance)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                </div>
            </div>
        </div>
    );
}
