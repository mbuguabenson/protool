'use client';

import React, { useState, useEffect } from 'react';
import { Search, Wifi, WifiOff, Globe, TrendingUp, Layers } from 'lucide-react';
import { DerivWebSocketManager } from '@/lib/deriv-websocket-manager';

interface Symbol {
    symbol: string;
    display_name: string;
    market: string;
    market_display_name: string;
    submarket: string;
    submarket_display_name: string;
    is_trading_suspended: number;
    pip: string;
    exchange_is_open: number;
}

const MARKET_COLORS: Record<string, string> = {
    synthetic_index: '#3b82f6',
    forex: '#8b5cf6',
    indices: '#10b981',
    commodities: '#f59e0b',
    cryptocurrency: '#ec4899',
    stocks: '#6366f1',
};

export default function AdminMarketPage() {
    const [symbols, setSymbols] = useState<Symbol[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [marketFilter, setMarketFilter] = useState('all');
    const [markets, setMarkets] = useState<string[]>([]);

    useEffect(() => {
        const manager = DerivWebSocketManager.getInstance();
        let isCancelled = false;

        const init = async () => {
            try {
                await manager.connect();
                if (isCancelled) return;

                const reqId = manager.getNextReqId();
                const handleActiveSymbols = (data: any) => {
                    if (data.req_id === reqId && data.active_symbols) {
                        const syms: Symbol[] = data.active_symbols;
                        setSymbols(syms);
                        const mNames = [...new Set(syms.map((s: Symbol) => s.market))] as string[];
                        setMarkets(mNames);
                        setLoading(false);
                        manager.off('active_symbols', handleActiveSymbols);
                    }
                };

                manager.on('active_symbols', handleActiveSymbols);
                manager.send({ active_symbols: 'brief', product_type: 'basic', req_id: reqId });
            } catch (err) {
                console.error('Failed to load symbols:', err);
                setLoading(false);
            }
        };

        init();
        return () => {
            isCancelled = true;
        };
    }, []);

    const filtered = symbols.filter(s => {
        const matchSearch =
            s.display_name.toLowerCase().includes(search.toLowerCase()) ||
            s.symbol.toLowerCase().includes(search.toLowerCase());
        const matchMarket = marketFilter === 'all' || s.market === marketFilter;
        return matchSearch && matchMarket;
    });

    const grouped = filtered.reduce<Record<string, typeof filtered>>((acc, s) => {
        const key = s.submarket_display_name || s.market_display_name;
        if (!acc[key]) acc[key] = [];
        acc[key].push(s);
        return acc;
    }, {});

    return (
        <div className='space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20'>
            <div>
                <h2 className='text-3xl font-black text-white tracking-tight'>Market Data</h2>
                <p className='text-sm text-gray-500 mt-1'>
                    All active Deriv trading symbols, pulled live from the Deriv API.
                </p>
            </div>

            {/* Stats */}
            <div className='grid grid-cols-2 sm:grid-cols-4 gap-4'>
                <div className='bg-[#0a0a0a] border border-white/5 rounded-2xl p-5'>
                    <p className='text-[10px] uppercase tracking-widest text-gray-500 font-bold'>Total Symbols</p>
                    <p className='text-3xl font-black mt-1 text-white'>{symbols.length}</p>
                </div>
                <div className='bg-[#0a0a0a] border border-white/5 rounded-2xl p-5'>
                    <p className='text-[10px] uppercase tracking-widest text-gray-500 font-bold'>Markets</p>
                    <p className='text-3xl font-black mt-1 text-blue-400'>{markets.length}</p>
                </div>
                <div className='bg-[#0a0a0a] border border-white/5 rounded-2xl p-5'>
                    <p className='text-[10px] uppercase tracking-widest text-gray-500 font-bold'>Open Now</p>
                    <p className='text-3xl font-black mt-1 text-emerald-400'>
                        {symbols.filter(s => s.exchange_is_open).length}
                    </p>
                </div>
                <div className='bg-[#0a0a0a] border border-white/5 rounded-2xl p-5'>
                    <p className='text-[10px] uppercase tracking-widest text-gray-500 font-bold'>Closed</p>
                    <p className='text-3xl font-black mt-1 text-gray-500'>
                        {symbols.filter(s => !s.exchange_is_open).length}
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div className='flex flex-col sm:flex-row gap-4'>
                <div className='relative flex-1'>
                    <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500' />
                    <input
                        type='text'
                        placeholder='Search symbols...'
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className='w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50'
                    />
                </div>
                <div className='flex gap-2 flex-wrap'>
                    <button
                        onClick={() => setMarketFilter('all')}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${marketFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-white/5 border border-white/10 text-gray-400'}`}
                    >
                        All
                    </button>
                    {markets.map(m => (
                        <button
                            key={m}
                            onClick={() => setMarketFilter(m)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${marketFilter === m ? 'text-white shadow-lg' : 'bg-white/5 border border-white/10 text-gray-400'}`}
                            style={marketFilter === m ? { background: MARKET_COLORS[m] || '#3b82f6' } : {}}
                        >
                            {m.replace('_', ' ')}
                        </button>
                    ))}
                </div>
            </div>

            {/* Symbols */}
            {loading ? (
                <div className='flex flex-col items-center justify-center h-40 gap-4'>
                    <div className='w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin' />
                    <p className='text-sm text-gray-500'>Connecting to Deriv API...</p>
                </div>
            ) : (
                Object.entries(grouped).map(([submarket, syms]) => (
                    <div key={submarket} className='bg-[#0a0a0a] border border-white/5 rounded-3xl overflow-hidden'>
                        <div className='px-6 py-4 border-b border-white/5 flex items-center gap-3'>
                            <Layers
                                className='h-4 w-4'
                                style={{ color: MARKET_COLORS[syms[0]?.market] || '#6b7280' }}
                            />
                            <span className='text-xs font-bold text-white uppercase tracking-widest'>{submarket}</span>
                            <span className='ml-auto text-[10px] text-gray-500'>{syms.length} symbols</span>
                        </div>
                        <div className='overflow-x-auto'>
                            <table className='w-full text-left text-sm'>
                                <thead>
                                    <tr className='border-b border-white/5 text-[10px] text-gray-500 uppercase tracking-widest font-bold'>
                                        <th className='px-6 py-3'>Symbol</th>
                                        <th className='px-6 py-3'>Display Name</th>
                                        <th className='px-6 py-3'>Pip</th>
                                        <th className='px-6 py-3'>Market</th>
                                        <th className='px-6 py-3'>Status</th>
                                    </tr>
                                </thead>
                                <tbody className='divide-y divide-white/[0.03]'>
                                    {syms.map(s => (
                                        <tr key={s.symbol} className='hover:bg-white/[0.02] transition-colors'>
                                            <td className='px-6 py-3'>
                                                <span className='font-mono text-xs font-bold text-blue-400'>
                                                    {s.symbol}
                                                </span>
                                            </td>
                                            <td className='px-6 py-3'>
                                                <span className='text-sm text-white font-medium'>{s.display_name}</span>
                                            </td>
                                            <td className='px-6 py-3'>
                                                <span className='text-xs font-mono text-gray-400'>{s.pip}</span>
                                            </td>
                                            <td className='px-6 py-3'>
                                                <span
                                                    className='text-[10px] px-2 py-1 rounded-md font-bold uppercase'
                                                    style={{
                                                        background: `${MARKET_COLORS[s.market] || '#6b7280'}20`,
                                                        color: MARKET_COLORS[s.market] || '#6b7280',
                                                    }}
                                                >
                                                    {s.market_display_name}
                                                </span>
                                            </td>
                                            <td className='px-6 py-3'>
                                                {s.exchange_is_open ? (
                                                    <span className='flex items-center gap-1.5 text-emerald-400 text-[10px] font-bold'>
                                                        <Wifi className='h-3 w-3' /> Open
                                                    </span>
                                                ) : (
                                                    <span className='flex items-center gap-1.5 text-gray-600 text-[10px] font-bold'>
                                                        <WifiOff className='h-3 w-3' /> Closed
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}
