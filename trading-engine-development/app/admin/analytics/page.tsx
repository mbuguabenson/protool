'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Clock, Zap, Target, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const PERIODS = ['hourly', 'daily', 'weekly', 'monthly', 'yearly'] as const;
type Period = (typeof PERIODS)[number];

interface Strategy {
    name: string;
    wins: number;
    losses: number;
    totalTrades: number;
    totalProfit: number;
    totalLoss: number;
    winRate: string;
    netPnl: string;
}

const STRATEGY_COLORS: Record<string, string> = {
    'Super Signals': '#3b82f6',
    SmartAuto24: '#8b5cf6',
    'Smart Adaptive': '#10b981',
    Autotrader: '#f59e0b',
    Unknown: '#6b7280',
};

function getColor(name: string) {
    return STRATEGY_COLORS[name] || '#6b7280';
}

export default function AdminAnalyticsPage() {
    const [period, setPeriod] = useState<Period>('daily');
    const [strategies, setStrategies] = useState<Strategy[]>([]);
    const [totalTrades, setTotalTrades] = useState(0);
    const [loading, setLoading] = useState(true);

    const fetchAnalytics = useCallback(
        async (silent = false) => {
            if (!silent) setLoading(true);
            try {
                const res = await fetch(`/api/trade/report?period=${period}`);
                const data = await res.json();
                setStrategies(data.strategies || []);
                setTotalTrades(data.totalTrades || 0);
            } catch (err) {
                console.error(err);
            }
            setLoading(false);
        },
        [period]
    );

    useEffect(() => {
        fetchAnalytics();
    }, [fetchAnalytics]);

    const chartData = strategies.map(s => ({
        name: s.name.length > 14 ? s.name.slice(0, 14) + '…' : s.name,
        fullName: s.name,
        profit: parseFloat(s.totalProfit.toFixed(2)),
        loss: -parseFloat(s.totalLoss.toFixed(2)),
        net: parseFloat(s.netPnl),
    }));

    return (
        <div className='space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20'>
            <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
                <div>
                    <h2 className='text-3xl font-black text-white tracking-tight'>Analytics</h2>
                    <p className='text-sm text-gray-500 mt-1'>Strategy performance across all platform users</p>
                </div>
                <div className='flex gap-2'>
                    {PERIODS.map(p => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${period === p ? 'bg-blue-600 text-white' : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'}`}
                        >
                            {p}
                        </button>
                    ))}
                </div>
            </div>

            {/* Summary Row */}
            <div className='grid grid-cols-2 sm:grid-cols-4 gap-4'>
                <div className='bg-[#0a0a0a] border border-white/5 rounded-2xl p-5'>
                    <p className='text-[10px] uppercase tracking-widest text-gray-500 font-bold'>Total Trades</p>
                    <p className='text-3xl font-black mt-1 text-white'>{totalTrades}</p>
                </div>
                <div className='bg-[#0a0a0a] border border-white/5 rounded-2xl p-5'>
                    <p className='text-[10px] uppercase tracking-widest text-gray-500 font-bold'>Strategies Active</p>
                    <p className='text-3xl font-black mt-1 text-blue-400'>{strategies.length}</p>
                </div>
                <div className='bg-[#0a0a0a] border border-white/5 rounded-2xl p-5'>
                    <p className='text-[10px] uppercase tracking-widest text-gray-500 font-bold'>Total Profit</p>
                    <p className='text-3xl font-black mt-1 text-emerald-400'>
                        ${strategies.reduce((s, st) => s + st.totalProfit, 0).toFixed(2)}
                    </p>
                </div>
                <div className='bg-[#0a0a0a] border border-white/5 rounded-2xl p-5'>
                    <p className='text-[10px] uppercase tracking-widest text-gray-500 font-bold'>Total Loss</p>
                    <p className='text-3xl font-black mt-1 text-rose-400'>
                        ${strategies.reduce((s, st) => s + st.totalLoss, 0).toFixed(2)}
                    </p>
                </div>
            </div>

            {/* Chart */}
            {strategies.length > 0 && (
                <div className='bg-[#0a0a0a] border border-white/5 rounded-3xl p-6'>
                    <p className='text-xs font-bold text-gray-400 uppercase tracking-widest mb-6'>
                        P&L by Strategy ({period})
                    </p>
                    <ResponsiveContainer width='100%' height={220}>
                        <BarChart data={chartData} barGap={4}>
                            <CartesianGrid strokeDasharray='3 3' stroke='rgba(255,255,255,0.03)' />
                            <XAxis
                                dataKey='name'
                                tick={{ fill: '#6b7280', fontSize: 11, fontWeight: 700 }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                tick={{ fill: '#6b7280', fontSize: 10 }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={v => `$${v}`}
                            />
                            <Tooltip
                                contentStyle={{
                                    background: '#0a0a0a',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: 12,
                                    color: '#fff',
                                    fontSize: 12,
                                }}
                                formatter={(v: number | undefined, n: string | undefined) =>
                                    [
                                        `$${(v ?? 0).toFixed(2)}`,
                                        n === 'profit' ? 'Profit' : n === 'loss' ? 'Loss' : 'Net',
                                    ] as [string, string]
                                }
                            />
                            <Bar dataKey='profit' radius={[6, 6, 0, 0]} fill='#10b981' maxBarSize={40} />
                            <Bar dataKey='loss' radius={[6, 6, 0, 0]} fill='#ef4444' maxBarSize={40} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Strategy Cards */}
            {loading ? (
                <div className='flex items-center justify-center h-40'>
                    <div className='w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin' />
                </div>
            ) : strategies.length === 0 ? (
                <div className='bg-[#0a0a0a] border border-white/5 border-dashed rounded-3xl p-12 flex flex-col items-center justify-center text-center'>
                    <BarChart3 className='h-12 w-12 text-gray-700 mb-4' />
                    <p className='font-bold text-gray-500'>No trade data for this period</p>
                    <p className='text-sm text-gray-600 mt-1 max-w-xs'>
                        Trade results will appear here once the trading bots report closed positions via the API.
                    </p>
                </div>
            ) : (
                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                    {strategies.map(s => {
                        const color = getColor(s.name);
                        const pnl = parseFloat(s.netPnl);
                        return (
                            <div key={s.name} className='bg-[#0a0a0a] border border-white/5 rounded-3xl p-6 space-y-4'>
                                <div className='flex items-center justify-between'>
                                    <div className='flex items-center gap-3'>
                                        <div className='w-3 h-3 rounded-full' style={{ background: color }} />
                                        <h4 className='text-sm font-black text-white'>{s.name}</h4>
                                    </div>
                                    <span
                                        className={`text-sm font-black ${pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
                                    >
                                        {pnl >= 0 ? '+' : ''}${s.netPnl}
                                    </span>
                                </div>
                                <div className='grid grid-cols-3 gap-3'>
                                    <div className='text-center p-2 bg-white/[0.02] rounded-xl'>
                                        <p className='text-[10px] text-gray-600 font-bold uppercase'>Trades</p>
                                        <p className='text-lg font-black text-white'>{s.totalTrades}</p>
                                    </div>
                                    <div className='text-center p-2 bg-emerald-500/5 rounded-xl'>
                                        <p className='text-[10px] text-gray-600 font-bold uppercase'>Wins</p>
                                        <p className='text-lg font-black text-emerald-400'>{s.wins}</p>
                                    </div>
                                    <div className='text-center p-2 bg-rose-500/5 rounded-xl'>
                                        <p className='text-[10px] text-gray-600 font-bold uppercase'>Losses</p>
                                        <p className='text-lg font-black text-rose-400'>{s.losses}</p>
                                    </div>
                                </div>
                                {/* Win rate bar */}
                                <div>
                                    <div className='flex justify-between text-[10px] text-gray-600 font-bold mb-1'>
                                        <span>Win Rate</span>
                                        <span className='text-white'>{s.winRate}%</span>
                                    </div>
                                    <div className='h-1.5 bg-white/5 rounded-full overflow-hidden'>
                                        <div
                                            className='h-full rounded-full transition-all'
                                            style={{ width: `${s.winRate}%`, background: color }}
                                        />
                                    </div>
                                </div>
                                <div className='flex justify-between text-xs font-bold'>
                                    <span className='text-emerald-400 flex items-center gap-1'>
                                        <TrendingUp className='h-3 w-3' /> +${s.totalProfit.toFixed(2)}
                                    </span>
                                    <span className='text-rose-400 flex items-center gap-1'>
                                        <TrendingDown className='h-3 w-3' /> -${s.totalLoss.toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
