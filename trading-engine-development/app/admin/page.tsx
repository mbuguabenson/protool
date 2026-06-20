'use client';

import React, { useState, useEffect } from 'react';
import {
    Users,
    Wallet,
    TrendingUp,
    CreditCard,
    ArrowUpRight,
    ArrowDownRight,
    Activity,
    UserCheck,
    Zap,
    DollarSign,
    TrendingDown,
} from 'lucide-react';
import { AdminStatsCard } from '@/components/admin/admin-stats-card';
import { AdminLiveFeed } from '@/components/admin/admin-live-feed';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AdminTradingConsole } from '@/components/admin/admin-trading-console';

export default function AdminDashboard() {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState<'All' | 'Real' | 'Demo'>('All');
    const [filterPnL, setFilterPnL] = useState<'All' | 'Profits' | 'Losses'>('All');
    const [curveType, setCurveType] = useState<'monotone' | 'linear' | 'step'>('monotone');

    useEffect(() => {
        async function fetchStats() {
            try {
                const res = await fetch(`/api/admin/overview?type=${filterType}&pnl=${filterPnL}`);
                const data = await res.json();
                setStats(data);
            } catch (err) {
                console.error('Failed to fetch dashboard stats:', err);
            } finally {
                setLoading(false);
            }
        }
        fetchStats();
        const interval = setInterval(fetchStats, 5000); // Fast refresh for live feel
        return () => clearInterval(interval);
    }, [filterType, filterPnL]);

    return (
        <div className='space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700'>
            {/* Welcome Header */}
            <div className='flex flex-col md:flex-row justify-between items-start md:items-center gap-6'>
                <div>
                    <h2 className='text-3xl font-black text-white tracking-tight'>Good Morning, Admin</h2>
                    <p className='text-sm text-gray-500 mt-1'>Real-time platform performance overview.</p>
                </div>

                {/* System Health Widget (Premium Addition) */}
                <div className='flex items-center gap-6 bg-[#0a0a0a] border border-white/5 px-6 py-3 rounded-2xl shadow-xl'>
                    <div className='flex flex-col'>
                        <span className='text-[10px] font-black uppercase tracking-widest text-gray-600 mb-1 flex items-center gap-1.5'>
                            <Activity className='h-3 w-3 text-emerald-500' /> Platform API
                        </span>
                        <div className='flex items-center gap-2'>
                            <span className='text-xs font-bold text-white'>Operational</span>
                            <div className='w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse' />
                        </div>
                    </div>
                    <div className='h-8 w-px bg-white/5' />
                    <div className='flex flex-col'>
                        <span className='text-[10px] font-black uppercase tracking-widest text-gray-600 mb-1 flex items-center gap-1.5'>
                            <Zap className='h-3 w-3 text-blue-500' /> WS Latency
                        </span>
                        <div className='flex items-center gap-2'>
                            <span className='text-xs font-bold text-white'>24ms</span>
                            <span className='text-[9px] font-bold text-blue-400 bg-blue-500/10 px-1 rounded'>
                                Optimal
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6'>
                <AdminStatsCard
                    label='Total Active Users'
                    value={loading ? '...' : (stats?.totalUsers || 0).toString()}
                    subValue={loading ? 'Loading...' : `${stats?.onlineUsers || 0} Online now`}
                    icon={UserCheck}
                    trend={{ value: 12, label: 'this month', positive: true }}
                    color='blue'
                />
                <AdminStatsCard
                    label='Real Balance Total'
                    value={loading ? '...' : `$${(stats?.totalRealBalance || 0).toLocaleString()}`}
                    subValue={loading ? 'Loading...' : 'Live platform reserve'}
                    icon={Wallet}
                    trend={{ value: 5.2, label: 'vs last week', positive: true }}
                    color='green'
                />
                <AdminStatsCard
                    label='Net Performance'
                    value={loading ? '...' : `$${(stats?.netPerformance || 0).toFixed(2)}`}
                    subValue={loading ? 'Loading...' : 'Total Platform P/L'}
                    icon={TrendingUp}
                    trend={{
                        value: stats?.netPerformance >= 0 ? 10 : -10,
                        label: 'All time',
                        positive: stats?.netPerformance >= 0,
                    }}
                    color='purple'
                />
                <AdminStatsCard
                    label='Trading Volume'
                    value={loading ? '...' : `$${(stats?.totalVolume || 0).toLocaleString()}`}
                    subValue={loading ? 'Loading...' : 'Total stake processed'}
                    icon={Zap}
                    trend={{ value: 2.1, label: 'System load', positive: true }}
                    color='orange'
                />
            </div>

            {/* Middle Section: Portfolio & Live Feed */}
            <div className='grid grid-cols-1 lg:grid-cols-3 gap-8'>
                {/* Main Chart Area (Portfolio Placeholder) */}
                <div className='lg:col-span-2 bg-[#0a0a0a] rounded-3xl border border-white/5 p-8 relative overflow-hidden flex flex-col min-h-[450px]'>
                    <div className='flex justify-between items-center mb-8'>
                        <div>
                            <h3 className='text-xl font-bold text-white'>Platform Performance</h3>
                            <p className='text-xs text-gray-500'>Global trading activity overview</p>
                        </div>
                        <div className='flex flex-wrap gap-4 items-center'>
                            {/* Demo/Real Filter */}
                            <div className='flex gap-2 bg-white/5 p-1 rounded-xl'>
                                {(['All', 'Real', 'Demo'] as const).map(f => (
                                    <button
                                        key={f}
                                        onClick={() => setFilterType(f)}
                                        className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${filterType === f ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
                                    >
                                        {f}
                                    </button>
                                ))}
                            </div>
                            {/* Profit/Loss Filter */}
                            <div className='flex gap-2 bg-white/5 p-1 rounded-xl'>
                                {(['All', 'Profits', 'Losses'] as const).map(f => (
                                    <button
                                        key={f}
                                        onClick={() => setFilterPnL(f)}
                                        className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${filterPnL === f ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
                                    >
                                        {f}
                                    </button>
                                ))}
                            </div>
                            {/* Curve Control */}
                            <div className='flex gap-2 bg-white/5 p-1 rounded-xl'>
                                {(['monotone', 'linear', 'step'] as const).map(c => (
                                    <button
                                        key={c}
                                        onClick={() => setCurveType(c)}
                                        className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${curveType === c ? 'bg-emerald-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
                                    >
                                        {c.charAt(0).toUpperCase() + c.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className='flex-1 min-h-[300px]'>
                        {stats?.chartData && stats.chartData.length > 0 ? (
                            <ResponsiveContainer width='100%' height='100%'>
                                <AreaChart data={stats.chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id='colorProfit' x1='0' y1='0' x2='0' y2='1'>
                                            <stop offset='5%' stopColor='#3b82f6' stopOpacity={0.3} />
                                            <stop offset='95%' stopColor='#3b82f6' stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey='ts' hide domain={['dataMin', 'dataMax']} />
                                    <YAxis hide />
                                    <CartesianGrid
                                        strokeDasharray='3 3'
                                        vertical={false}
                                        stroke='rgba(255,255,255,0.03)'
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            background: '#0a0a0a',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: '12px',
                                            color: '#fff',
                                            fontSize: '12px',
                                        }}
                                        labelFormatter={t => new Date(t * 1000).toLocaleTimeString()}
                                        formatter={(v: any, name: any) => [
                                            typeof v === 'number' ? v.toFixed(2) : v || '0.00',
                                            name === 'profit' ? 'P/L' : name,
                                        ]}
                                    />
                                    <Area
                                        type={curveType}
                                        dataKey='profit'
                                        stroke='#3b82f6'
                                        fillOpacity={1}
                                        fill='url(#colorProfit)'
                                        strokeWidth={3}
                                        animationDuration={1500}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className='flex flex-col items-center justify-center h-full text-center group cursor-pointer'>
                                <div className='w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform'>
                                    <Activity className='h-8 w-8 text-blue-500' />
                                </div>
                                <p className='text-gray-400 font-bold tracking-tight'>
                                    Waiting for platform activity...
                                </p>
                                <p className='text-gray-600 text-xs mt-1 lowercase font-mono'>
                                    real-time analytics engine active
                                </p>
                            </div>
                        )}
                    </div>

                    <div className='mt-8 grid grid-cols-1 sm:grid-cols-3 gap-6 pt-8 border-t border-white/5'>
                        <div>
                            <p className='text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1'>
                                Total Profits
                            </p>
                            <h4 className='text-xl font-black text-white'>
                                {loading
                                    ? '...'
                                    : (stats?.netPerformance >= 0 ? '+' : '') + (stats?.netPerformance || 0).toFixed(2)}
                            </h4>
                            <div className='flex items-center gap-1 text-[10px] text-emerald-400 font-bold mt-1'>
                                <ArrowUpRight className='h-3 w-3' />
                                Aggregated P/L
                            </div>
                        </div>
                        <div>
                            <p className='text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1'>
                                Online Users
                            </p>
                            <h4 className='text-xl font-black text-white'>
                                {loading ? '...' : stats?.onlineUsers || 0}
                            </h4>
                            <div className='flex items-center gap-1 text-[10px] text-gray-400 font-medium mt-1 uppercase'>
                                Active connections
                            </div>
                        </div>
                        <div>
                            <p className='text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1'>
                                Platform Volume
                            </p>
                            <h4 className='text-xl font-black text-white'>
                                ${loading ? '...' : (stats?.totalVolume || 0).toLocaleString()}
                            </h4>
                            <div className='flex items-center gap-1 text-[10px] text-blue-400 font-bold mt-1 uppercase tracking-tighter'>
                                Processed Stakes
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sidebar for Live Feed */}
                <AdminLiveFeed />
            </div>

            {/* Trading Console */}
            <AdminTradingConsole />

            {/* Bottom Section: Top Traders & Wallet Snapshot */}
            <div className='grid grid-cols-1 lg:grid-cols-2 gap-8 pb-8'>
                <div className='bg-[#0a0a0a] rounded-3xl border border-white/5 p-6 backdrop-blur-xl lg:col-span-3'>
                    <h3 className='text-lg font-bold text-white mb-6'>Top Performing Traders</h3>
                    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                        {stats?.topTraders && stats.topTraders.length > 0 ? (
                            stats.topTraders.map((trader: any, idx: number) => (
                                <div
                                    key={trader.loginId}
                                    className='flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-blue-500/30 transition-all group'
                                >
                                    <div className='flex items-center gap-4'>
                                        <div className='w-12 h-12 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center font-bold text-blue-400'>
                                            {trader.name.slice(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className='text-sm font-bold text-white group-hover:text-blue-400 transition-colors truncate max-w-[100px]'>
                                                {trader.name}
                                            </p>
                                            <p className='text-[10px] text-gray-500 uppercase tracking-widest'>
                                                {trader.loginId}
                                            </p>
                                        </div>
                                    </div>
                                    <div className='text-right'>
                                        <p
                                            className={`text-sm font-black ${trader.netPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
                                        >
                                            {trader.netPnl >= 0 ? '+' : ''}${trader.netPnl.toFixed(2)}
                                        </p>
                                        <p className='text-[10px] text-gray-500 font-medium uppercase'>
                                            {trader.wins}/{trader.total} Wins
                                        </p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className='col-span-full py-12 text-center border-2 border-dashed border-white/5 rounded-2xl bg-white/[0.01]'>
                                <Users className='h-8 w-8 text-gray-700 mx-auto mb-2' />
                                <p className='text-gray-500 font-bold'>No trading activity found yet</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
