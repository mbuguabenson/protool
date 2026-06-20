'use client';

import React, { useState, useEffect } from 'react';
import { Play, Square, TrendingUp, TrendingDown, Users, Search, Target, Zap, ShieldCheck } from 'lucide-react';

export function AdminTradingConsole() {
    const [users, setUsers] = useState<any[]>([]);
    const [selectedUser, setSelectedUser] = useState<string>('');
    const [market, setMarket] = useState('');
    const [tradeType, setTradeType] = useState('CALL');
    const [stake, setStake] = useState(10);
    const [status, setStatus] = useState<'idle' | 'trading' | 'success' | 'error'>('idle');
    const [log, setLog] = useState<string[]>([]);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const res = await fetch('/api/admin/users');
                const data = await res.json();
                setUsers(data.users || []);
            } catch (err) {
                console.error('Failed to fetch users for trading console:', err);
            }
        };
        fetchUsers();
    }, []);

    const handleExecuteTrade = async () => {
        if (!selectedUser) {
            alert('Please select a user first');
            return;
        }

        setStatus('trading');
        setLog(prev => [`[${new Date().toLocaleTimeString()}] Initiating trade for ${selectedUser}...`, ...prev]);

        try {
            const res = await fetch('/api/admin/execute-trade', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    loginId: selectedUser,
                    market,
                    tradeType,
                    stake,
                }),
            });
            const data = await res.json();
            if (data.success) {
                setStatus('success');
                setLog(prev => [`[${new Date().toLocaleTimeString()}] Trade SUCCESS: ${data.msg}`, ...prev]);
            } else {
                setStatus('error');
                setLog(prev => [`[${new Date().toLocaleTimeString()}] Trade FAILED: ${data.error}`, ...prev]);
            }
        } catch (err) {
            setStatus('error');
            setLog(prev => [`[${new Date().toLocaleTimeString()}] Execution error occurred`, ...prev]);
        } finally {
            setTimeout(() => setStatus('idle'), 3000);
        }
    };

    return (
        <div className='bg-[#0a0a0a] rounded-3xl border border-white/5 p-8 relative overflow-hidden'>
            <div className='absolute top-0 right-0 w-[300px] h-[300px] bg-blue-500/5 blur-[80px] rounded-full pointer-events-none -z-10'></div>

            <div className='flex items-center justify-between mb-8'>
                <div>
                    <h2 className='text-xl font-black text-white flex items-center gap-2'>
                        <Zap className='h-5 w-5 text-blue-500' />
                        Admin Trading Console
                    </h2>
                    <p className='text-[10px] text-gray-500 uppercase tracking-widest mt-1'>
                        Execute direct trades via platform engine
                    </p>
                </div>
                <div className='flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[9px] font-black text-emerald-500 uppercase tracking-tighter'>
                    <ShieldCheck className='h-3 w-3' />
                    Authorized Access
                </div>
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 gap-8'>
                <div className='space-y-6'>
                    {/* User Selection */}
                    <div className='space-y-2'>
                        <label className='text-[10px] font-bold text-gray-500 uppercase tracking-widest'>
                            Select Target User
                        </label>
                        <div className='relative'>
                            <Users className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500' />
                            <select
                                value={selectedUser}
                                onChange={e => setSelectedUser(e.target.value)}
                                className='w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-blue-500 transition-all appearance-none'
                            >
                                <option value='' className='bg-[#0a0a0a]'>
                                    Select a user...
                                </option>
                                {users.map(u => (
                                    <option key={u.loginId} value={u.loginId} className='bg-[#0a0a0a]'>
                                        {u.name} ({u.loginId}) - ${u.balance.toFixed(2)}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className='grid grid-cols-2 gap-4'>
                        {/* Market */}
                        <div className='space-y-2'>
                            <label className='text-[10px] font-bold text-gray-500 uppercase tracking-widest'>
                                Market
                            </label>
                            <select
                                value={market}
                                onChange={e => setMarket(e.target.value)}
                                className='w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-blue-500 transition-all appearance-none'
                            >
                                <option value='' className='bg-[#0a0a0a]'>
                                    Select market...
                                </option>
                            </select>
                        </div>

                        {/* Trade Type */}
                        <div className='space-y-2'>
                            <label className='text-[10px] font-bold text-gray-500 uppercase tracking-widest'>
                                Direction
                            </label>
                            <div className='flex gap-2'>
                                <button
                                    onClick={() => setTradeType('CALL')}
                                    className={`flex-1 py-3 rounded-xl border font-black text-xs transition-all flex items-center justify-center gap-1 ${tradeType === 'CALL' ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-white/5 border-white/10 text-gray-500 hover:border-emerald-500/30'}`}
                                >
                                    <TrendingUp className='h-3 w-3' />
                                    RISE
                                </button>
                                <button
                                    onClick={() => setTradeType('PUT')}
                                    className={`flex-1 py-3 rounded-xl border font-black text-xs transition-all flex items-center justify-center gap-1 ${tradeType === 'PUT' ? 'bg-rose-500 border-rose-500 text-white shadow-lg shadow-rose-500/20' : 'bg-white/5 border-white/10 text-gray-500 hover:border-rose-500/30'}`}
                                >
                                    <TrendingDown className='h-3 w-3' />
                                    FALL
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Stake */}
                    <div className='space-y-2'>
                        <label className='text-[10px] font-bold text-gray-500 uppercase tracking-widest'>
                            Stake Amount (USD)
                        </label>
                        <div className='flex items-center gap-4'>
                            <input
                                type='range'
                                min='0.35'
                                max='1000'
                                step='10'
                                value={stake}
                                onChange={e => setStake(parseFloat(e.target.value))}
                                className='flex-1 accent-blue-500 h-1.5 bg-white/5 rounded-full'
                            />
                            <div className='w-20 bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-center text-sm font-black text-white'>
                                ${stake}
                            </div>
                        </div>
                    </div>

                    {/* Execute Button */}
                    <button
                        onClick={handleExecuteTrade}
                        disabled={status === 'trading' || !selectedUser}
                        className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-3 ${status === 'trading' ? 'bg-gray-700 cursor-wait' : status === 'success' ? 'bg-emerald-600' : status === 'error' ? 'bg-rose-600' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-2xl hover:shadow-blue-500/30 hover:scale-[1.02] active:scale-95 disabled:opacity-50'}`}
                    >
                        {status === 'trading' ? (
                            <div className='h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin'></div>
                        ) : (
                            <Play className='h-4 w-4 fill-current' />
                        )}
                        {status === 'trading' ? 'Processing...' : 'Execute Contract'}
                    </button>
                </div>

                <div className='bg-black/50 border border-white/5 rounded-2xl p-4 flex flex-col font-mono'>
                    <div className='flex items-center justify-between mb-4 pb-2 border-b border-white/5'>
                        <span className='text-[10px] text-gray-500 uppercase font-sans font-bold'>Execution Logs</span>
                        <div className='flex gap-1'>
                            <div className='w-2 h-2 rounded-full bg-rose-500 opacity-50'></div>
                            <div className='w-2 h-2 rounded-full bg-amber-500 opacity-50'></div>
                            <div className='w-2 h-2 rounded-full bg-emerald-500 opacity-50'></div>
                        </div>
                    </div>
                    <div className='flex-1 text-[10px] text-gray-400 space-y-1 overflow-y-auto max-h-[250px] custom-scrollbar'>
                        {log.length === 0 ? (
                            <p className='opacity-30 italic'>No activity logs yet...</p>
                        ) : (
                            log.map((l, i) => (
                                <p
                                    key={i}
                                    className={
                                        l.includes('SUCCESS')
                                            ? 'text-emerald-400'
                                            : l.includes('FAILED')
                                              ? 'text-rose-400'
                                              : ''
                                    }
                                >
                                    {l}
                                </p>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
