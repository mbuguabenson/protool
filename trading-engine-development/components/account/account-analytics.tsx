'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDerivAPI } from '@/lib/deriv-api-context';
import {
    PieChart,
    Pie,
    Cell,
    Tooltip,
    ResponsiveContainer,
    Legend,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
} from 'recharts';
import { RefreshCw, TrendingUp, TrendingDown, Target, Zap, BarChart3, ArrowRightLeft, Trophy } from 'lucide-react';

interface ProfitTableTransaction {
    contract_type: string;
    shortcode: string;
    display_name: string;
    buy_price: number;
    sell_price: number;
    profit_loss: number;
    purchase_time: number;
    sell_time: number;
    contract_id: number;
}

interface AccountAnalyticsProps {
    theme?: 'light' | 'dark';
}

// Map Deriv contract types → human-readable strategy names
function parseContractStrategy(contractType: string, shortcode: string): string {
    const ct = (contractType || '').toUpperCase();
    const sc = (shortcode || '').toUpperCase();
    if (ct === 'DIGITEVEN') return 'Even/Odd — Even';
    if (ct === 'DIGITODD') return 'Even/Odd — Odd';
    if (ct.startsWith('DIGITOVER') || sc.includes('DIGITOVER')) return 'Over/Under — Over';
    if (ct.startsWith('DIGITUNDER') || sc.includes('DIGITUNDER')) return 'Over/Under — Under';
    if (ct === 'DIGITDIFF' || ct.startsWith('DIGITDIFF')) return 'Differs';
    if (ct === 'DIGITMATCH' || ct.startsWith('DIGITMATCH')) return 'Matches';
    if (ct === 'CALL' || ct === 'CALLE' || ct === 'CALLSPREAD') return 'Rise (Call)';
    if (ct === 'PUT' || ct === 'PUTE' || ct === 'PUTSPREAD') return 'Fall (Put)';
    if (ct.includes('TOUCH')) return 'Touch/No Touch';
    if (ct.includes('RANGE') || ct.includes('EXPIRYMISS') || ct.includes('EXPIRYRANGE')) return 'In/Out Range';
    if (ct.includes('RESET')) return 'Reset Call/Put';
    if (ct.includes('TICKHIGH') || ct.includes('TICKLOW')) return 'High Ticks / Low Ticks';
    if (ct.includes('ACCUMULATOR')) return 'Accumulators';
    if (ct.includes('VANILLA')) return 'Vanilla Options';
    if (ct.includes('TURBOS')) return 'Turbos';
    if (ct.includes('MULTIPLIER')) return 'Multipliers';
    return ct || 'Other';
}

const STRATEGY_COLORS = [
    '#6366f1',
    '#10b981',
    '#f59e0b',
    '#ef4444',
    '#8b5cf6',
    '#06b6d4',
    '#f97316',
    '#84cc16',
    '#ec4899',
    '#3b82f6',
];

const RADIAN = Math.PI / 180;
function PieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) {
    if (percent < 0.04) return null;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
        <text
            x={x}
            y={y}
            fill='white'
            textAnchor='middle'
            dominantBaseline='central'
            fontSize={10}
            fontWeight='bold'
        >{`${(percent * 100).toFixed(0)}%`}</text>
    );
}

export function AccountAnalytics({ theme = 'dark' }: AccountAnalyticsProps) {
    const { apiClient, isAuthorized, accountType, accounts, switchAccount, activeLoginId } = useDerivAPI();
    const [trades, setTrades] = useState<ProfitTableTransaction[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [viewType, setViewType] = useState<'Demo' | 'Real'>(accountType || 'Demo');

    const fetchData = useCallback(async () => {
        if (!apiClient || !isAuthorized || accountType !== viewType) return;
        setIsLoading(true);
        try {
            const response = await apiClient.getProfitTable(500);
            setTrades(response?.transactions ?? []);
        } catch (err) {
            console.error('[v0] Analytics fetch error:', err);
        } finally {
            setIsLoading(false);
        }
    }, [apiClient, isAuthorized, accountType, viewType]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSwitchAndLoad = (type: 'Demo' | 'Real') => {
        setViewType(type);
        const target = accounts.find(a => a.type === type);
        if (target && target.id !== activeLoginId) switchAccount(target.id);
    };

    // Group by strategy
    const strategyData = useMemo(() => {
        const map: Record<string, { wins: number; losses: number; pnl: number; trades: number }> = {};
        trades.forEach(tx => {
            const label = parseContractStrategy(tx.contract_type, tx.shortcode);
            if (!map[label]) map[label] = { wins: 0, losses: 0, pnl: 0, trades: 0 };
            map[label].trades++;
            map[label].pnl += tx.profit_loss || 0;
            if ((tx.profit_loss || 0) > 0) map[label].wins++;
            else map[label].losses++;
        });
        return Object.entries(map)
            .map(([name, d]) => ({
                name,
                trades: d.trades,
                wins: d.wins,
                losses: d.losses,
                pnl: Number(d.pnl.toFixed(2)),
                winRate: d.trades > 0 ? Math.round((d.wins / d.trades) * 100) : 0,
            }))
            .sort((a, b) => b.trades - a.trades);
    }, [trades]);

    const pieData = useMemo(
        () =>
            strategyData.map((s, i) => ({
                name: s.name,
                value: s.trades,
                color: STRATEGY_COLORS[i % STRATEGY_COLORS.length],
            })),
        [strategyData]
    );

    const totals = useMemo(
        () => ({
            trades: trades.length,
            wins: trades.filter(t => (t.profit_loss || 0) > 0).length,
            losses: trades.filter(t => (t.profit_loss || 0) <= 0).length,
            pnl: trades.reduce((s, t) => s + (t.profit_loss || 0), 0),
            strategies: strategyData.length,
        }),
        [trades, strategyData]
    );

    const isViewMatch = accountType === viewType;

    return (
        <div className='space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700'>
            {/* Controls */}
            <div className='flex items-center justify-between gap-4 flex-wrap'>
                <div className='flex p-1 gap-1 bg-white/[0.03] border border-white/5 rounded-2xl'>
                    {(['Real', 'Demo'] as const).map(type => (
                        <button
                            key={type}
                            onClick={() => handleSwitchAndLoad(type)}
                            className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                                viewType === type
                                    ? type === 'Real'
                                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                                        : 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
                                    : 'text-gray-500 hover:text-gray-300'
                            }`}
                        >
                            {type}
                        </button>
                    ))}
                </div>
                <button
                    onClick={fetchData}
                    className='flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/5 rounded-xl text-xs font-bold text-gray-400 hover:bg-white/10 transition-all'
                >
                    <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
                </button>
            </div>

            {!isViewMatch && (
                <div className='flex items-center gap-2 px-4 py-3 bg-blue-500/5 border border-blue-500/20 rounded-2xl text-xs font-bold text-blue-400'>
                    <ArrowRightLeft className='h-3.5 w-3.5 animate-pulse' />
                    Switching account to load {viewType} data…
                </div>
            )}

            {isLoading ? (
                <div className='h-60 flex items-center justify-center'>
                    <div className='relative w-12 h-12'>
                        <div className='w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin' />
                        <div className='absolute inset-2 border-4 border-purple-500/20 border-b-purple-500 rounded-full animate-spin [animation-direction:reverse] [animation-duration:600ms]' />
                    </div>
                </div>
            ) : trades.length > 0 ? (
                <>
                    {/* Summary */}
                    <div className='grid grid-cols-2 md:grid-cols-5 gap-4'>
                        {[
                            {
                                label: 'TRADES HUD',
                                value: totals.trades,
                                color: 'text-indigo-400',
                                bgColor: 'bg-indigo-500/5',
                                borderColor: 'border-indigo-500/20',
                                icon: <BarChart3 className='h-4 w-4' />,
                            },
                            {
                                label: 'WINS UNIT',
                                value: totals.wins,
                                color: 'text-emerald-400',
                                bgColor: 'bg-emerald-500/5',
                                borderColor: 'border-emerald-500/20',
                                icon: <TrendingUp className='h-4 w-4' />,
                            },
                            {
                                label: 'LOSSES UNIT',
                                value: totals.losses,
                                color: 'text-rose-400',
                                bgColor: 'bg-rose-500/5',
                                borderColor: 'border-rose-500/20',
                                icon: <TrendingDown className='h-4 w-4' />,
                            },
                            {
                                label: 'NET REVENUE',
                                value: `${totals.pnl >= 0 ? '+' : ''}$${totals.pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                                color: totals.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400',
                                bgColor: totals.pnl >= 0 ? 'bg-emerald-500/5' : 'bg-rose-500/5',
                                borderColor: totals.pnl >= 0 ? 'border-emerald-500/20' : 'border-rose-500/20',
                                icon: <Target className='h-4 w-4' />,
                            },
                            {
                                label: 'STRAT NODES',
                                value: totals.strategies,
                                color: 'text-purple-400',
                                bgColor: 'bg-purple-500/5',
                                borderColor: 'border-purple-500/20',
                                icon: <Zap className='h-4 w-4' />,
                            },
                        ].map((s, i) => (
                            <div
                                key={i}
                                className={`relative overflow-hidden rounded-[1.5rem] border ${s.bgColor} ${s.borderColor} p-5 transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl`}
                            >
                                <div className='absolute top-0 right-0 p-3 opacity-10 rotate-12'>{s.icon}</div>
                                <div className={`${s.color} mb-3 filter drop-shadow-[0_0_8px_currentColor] opacity-80`}>
                                    {s.icon}
                                </div>
                                <p className='text-[10px] font-black uppercase tracking-[0.2em] text-white/20 mb-1 leading-none'>
                                    {s.label}
                                </p>
                                <p className={`text-2xl font-black tracking-tighter tabular-nums ${s.color}`}>
                                    {s.value}
                                </p>
                            </div>
                        ))}
                    </div>

                    <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                        {/* Pie Chart */}
                        <div className='bg-[#0a0a0a] border border-white/5 rounded-3xl p-6'>
                            <div className='mb-4'>
                                <p className='text-xs font-black uppercase tracking-widest text-white mb-0.5'>
                                    Strategy Mix
                                </p>
                                <p className='text-[10px] text-gray-600'>Trade count by contract type</p>
                            </div>
                            <div className='h-[260px]'>
                                <ResponsiveContainer width='100%' height='100%'>
                                    <PieChart>
                                        <Pie
                                            data={pieData}
                                            cx='50%'
                                            cy='50%'
                                            outerRadius={90}
                                            innerRadius={45}
                                            paddingAngle={3}
                                            dataKey='value'
                                            labelLine={false}
                                            label={PieLabel}
                                            strokeWidth={0}
                                        >
                                            {pieData.map((e, i) => (
                                                <Cell key={i} fill={e.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{
                                                background: '#111',
                                                border: '1px solid rgba(255,255,255,0.08)',
                                                borderRadius: 12,
                                                fontSize: 12,
                                            }}
                                        />
                                        <Legend
                                            formatter={v => (
                                                <span className='text-[10px] font-bold text-gray-500'>{v}</span>
                                            )}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Bar chart — P&L per strategy */}
                        <div className='bg-[#0a0a0a] border border-white/5 rounded-3xl p-6'>
                            <div className='mb-4'>
                                <p className='text-xs font-black uppercase tracking-widest text-white mb-0.5'>
                                    P&amp;L by Strategy
                                </p>
                                <p className='text-[10px] text-gray-600'>Net profit/loss per contract type</p>
                            </div>
                            <div className='h-[260px]'>
                                <ResponsiveContainer width='100%' height='100%'>
                                    <BarChart data={strategyData.slice(0, 8)} margin={{ left: 0 }}>
                                        <CartesianGrid
                                            strokeDasharray='3 3'
                                            stroke='rgba(255,255,255,0.03)'
                                            vertical={false}
                                        />
                                        <XAxis
                                            dataKey='name'
                                            tick={{ fill: '#4b5563', fontSize: 9 }}
                                            tickLine={false}
                                            axisLine={false}
                                            tickFormatter={v => (v.length > 10 ? `${v.slice(0, 10)}…` : v)}
                                        />
                                        <YAxis
                                            tick={{ fill: '#4b5563', fontSize: 10 }}
                                            axisLine={false}
                                            tickLine={false}
                                            tickFormatter={v => `$${v}`}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                background: '#111',
                                                border: '1px solid rgba(255,255,255,0.08)',
                                                borderRadius: 12,
                                                fontSize: 11,
                                            }}
                                            formatter={(v: number | undefined) => [
                                                `$${(v ?? 0).toFixed(2)}`,
                                                'Net P&L',
                                            ]}
                                        />
                                        <Bar dataKey='pnl' radius={[6, 6, 0, 0]} maxBarSize={40}>
                                            {strategyData.slice(0, 8).map((entry, idx) => (
                                                <Cell key={idx} fill={entry.pnl >= 0 ? '#10b981' : '#ef4444'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Detailed strategy table */}
                    <div className='bg-[#0a0a0a] border border-white/5 rounded-3xl overflow-hidden'>
                        <div className='px-6 py-5 border-b border-white/5'>
                            <p className='text-xs font-black uppercase tracking-widest text-white'>
                                Strategy Breakdown
                            </p>
                            <p className='text-[10px] text-gray-600 mt-0.5'>
                                All {totals.strategies} contract types detected in your trading history
                            </p>
                        </div>
                        <div className='divide-y divide-white/[0.03]'>
                            {strategyData.map((s, i) => (
                                <div
                                    key={i}
                                    className='flex items-center gap-4 px-6 py-4 hover:bg-white/[0.015] transition-colors'
                                >
                                    <div
                                        className='w-3 h-3 rounded-full shrink-0'
                                        style={{ background: STRATEGY_COLORS[i % STRATEGY_COLORS.length] }}
                                    />
                                    <div className='flex-1 min-w-0'>
                                        <p className='text-sm font-bold text-white truncate'>{s.name}</p>
                                        <p className='text-[10px] text-gray-600'>{s.trades} trades</p>
                                    </div>
                                    {/* Win rate bar */}
                                    <div className='hidden md:flex flex-col items-end w-36'>
                                        <div className='flex justify-between w-full text-[9px] font-bold mb-1'>
                                            <span className='text-emerald-400'>{s.wins}W</span>
                                            <span className='text-gray-600'>{s.winRate}%</span>
                                            <span className='text-rose-400'>{s.losses}L</span>
                                        </div>
                                        <div className='w-full h-1.5 bg-rose-500/20 rounded-full overflow-hidden'>
                                            <div
                                                className='h-full bg-emerald-500 rounded-full transition-all'
                                                style={{ width: `${s.winRate}%` }}
                                            />
                                        </div>
                                    </div>
                                    <div
                                        className={`text-right w-20 font-black text-sm ${s.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
                                    >
                                        {s.pnl >= 0 ? '+' : ''}${s.pnl.toFixed(2)}
                                    </div>
                                    {/* Best/worst badge */}
                                    {i === 0 && (
                                        <span className='inline-flex items-center gap-1 text-[9px] font-black bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full whitespace-nowrap'>
                                            <Trophy className='h-2.5 w-2.5' /> Most Used
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            ) : (
                <div className='h-64 flex flex-col items-center justify-center bg-[#0a0a0a] border border-white/5 border-dashed rounded-3xl'>
                    <BarChart3 className='h-12 w-12 text-gray-700 mb-3' />
                    <p className='text-gray-500 font-bold text-sm'>No trading data available</p>
                    <p className='text-gray-700 text-xs mt-1'>
                        Switch account or start trading to see strategy analytics.
                    </p>
                </div>
            )}
        </div>
    );
}
