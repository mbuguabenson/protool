'use client';

import React, { useState, useEffect } from 'react';
import {
    Users,
    Search,
    Zap,
    TrendingUp,
    Target,
    Settings,
    ShieldCheck,
    ArrowRightLeft,
    ChevronRight,
    ChevronDown,
    Check,
    DollarSign,
} from 'lucide-react';

export default function AdminTradingPage() {
    const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchUsers() {
            try {
                const res = await fetch('/api/admin/users');
                const data = await res.json();
                setUsers(data.users || []);
            } catch (err) {
                console.error('Failed to fetch users for trading:', err);
            } finally {
                setLoading(false);
            }
        }
        fetchUsers();
    }, []);

    const filteredUsers = users.filter(
        u =>
            (u.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            u.loginId.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className='space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20'>
            <div>
                <h2 className='text-3xl font-black text-white tracking-tight'>Authorized Trading</h2>
                <p className='text-sm text-gray-500 mt-1'>
                    Execute strategic trades on behalf of platform participants.
                </p>
            </div>

            <div className='grid grid-cols-1 lg:grid-cols-12 gap-8'>
                {/* Left Col: Account Selection */}
                <div className='lg:col-span-4 space-y-6'>
                    <div className='bg-[#0a0a0a] border border-white/5 rounded-3xl p-6 relative overflow-hidden h-full min-h-[500px]'>
                        <div className='flex items-center justify-between mb-6'>
                            <h3 className='text-sm font-bold text-white uppercase tracking-widest'>Select Account</h3>
                            <span className='text-[10px] text-gray-500 font-bold uppercase'>
                                {filteredUsers.length} Found
                            </span>
                        </div>

                        <div className='relative mb-6'>
                            <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500' />
                            <input
                                type='text'
                                placeholder='Search ID or Name'
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className='w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-xs focus:outline-none focus:border-blue-500/50'
                            />
                        </div>

                        <div className='space-y-3 overflow-y-auto max-h-[400px] custom-scrollbar pr-2'>
                            {filteredUsers.map(user => (
                                <button
                                    key={user.id}
                                    onClick={() => setSelectedAccount(user.id)}
                                    className={`w-full text-left p-4 rounded-2xl border transition-all duration-300 group ${
                                        selectedAccount === user.id
                                            ? 'bg-blue-600 border-blue-500 text-white shadow-xl shadow-blue-600/20'
                                            : 'bg-white/[0.02] border-white/5 text-gray-400 hover:bg-white/[0.05] hover:border-white/10'
                                    }`}
                                >
                                    <div className='flex justify-between items-start mb-2'>
                                        <p
                                            className={`text-xs font-black uppercase tracking-widest ${selectedAccount === user.loginId ? 'text-blue-100' : 'text-gray-500'}`}
                                        >
                                            {user.loginId}
                                        </p>
                                        <span
                                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                                user.type === 'Real'
                                                    ? selectedAccount === user.loginId
                                                        ? 'bg-white/20 text-white font-black'
                                                        : 'bg-emerald-500/10 text-emerald-500'
                                                    : selectedAccount === user.loginId
                                                      ? 'bg-white/20 text-white font-black'
                                                      : 'bg-amber-500/10 text-amber-500'
                                            }`}
                                        >
                                            {user.type}
                                        </span>
                                    </div>
                                    <p
                                        className={`font-bold transition-colors ${selectedAccount === user.loginId ? 'text-white' : 'group-hover:text-blue-400'}`}
                                    >
                                        {user.name || 'Trader'}
                                    </p>
                                    <p
                                        className={`text-sm mt-1 font-mono font-bold ${selectedAccount === user.loginId ? 'text-blue-100' : 'text-gray-300'}`}
                                    >
                                        {user.balance?.toLocaleString()} {user.currency || 'USD'}
                                    </p>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Col: Trading Interface */}
                <div className='lg:col-span-8 space-y-8'>
                    {selectedAccount ? (
                        <div className='animate-in fade-in zoom-in-95 duration-500 space-y-8'>
                            {/* Current Execution State */}
                            <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                                <div className='bg-[#101322] border border-blue-500/20 rounded-3xl p-8 relative overflow-hidden group'>
                                    <div className='absolute -right-4 -bottom-4 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl' />
                                    <div className='flex justify-between items-center mb-6 relative z-10'>
                                        <h4 className='text-sm font-bold text-gray-400 uppercase tracking-widest'>
                                            Selected Market
                                        </h4>
                                        <button className='text-[10px] font-black text-blue-400 uppercase flex items-center gap-1 hover:text-blue-300 transition-colors'>
                                            Change <ChevronRight className='h-3 w-3' />
                                        </button>
                                    </div>
                                    <div className='flex items-center gap-6 relative z-10'>
                                        <div className='w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center font-black text-2xl shadow-[0_0_25px_rgba(37,99,235,0.4)] transition-transform group-hover:scale-110'>
                                            100
                                        </div>
                                        <div>
                                            <h3 className='text-2xl font-black text-white tracking-tight'>
                                                Select Market
                                            </h3>
                                            <div className='flex items-center gap-2 mt-1'>
                                                <span className='w-2 h-2 rounded-full bg-emerald-500 animate-pulse' />
                                                <span className='text-xs font-bold text-emerald-400 uppercase tracking-widest'>
                                                    $982,541.20
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className='bg-[#0a0a0a] border border-white/5 rounded-3xl p-8 flex flex-col justify-center'>
                                    <h4 className='text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4'>
                                        Risk Management
                                    </h4>
                                    <div className='flex items-center justify-between gap-4'>
                                        <div className='flex-1'>
                                            <p className='text-xs text-gray-400 mb-1'>Max Daily Risk</p>
                                            <div className='h-2 w-full bg-white/5 rounded-full overflow-hidden'>
                                                <div className='h-full bg-gradient-to-r from-blue-500 to-purple-600 w-2/3' />
                                            </div>
                                        </div>
                                        <span className='text-sm font-black text-white'>$500.00</span>
                                    </div>
                                </div>
                            </div>

                            {/* Control Panel */}
                            <div className='bg-[#0a0a0a] border border-white/5 rounded-3xl p-8 space-y-10'>
                                <div className='grid grid-cols-1 md:grid-cols-3 gap-8'>
                                    <div className='space-y-4'>
                                        <label className='text-[10px] font-bold text-gray-500 uppercase tracking-widest'>
                                            Stake Amount
                                        </label>
                                        <div className='relative group'>
                                            <DollarSign className='absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 group-focus-within:text-blue-400' />
                                            <input
                                                type='number'
                                                defaultValue='10'
                                                className='w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-xl font-black text-white focus:outline-none focus:border-blue-500/50 transition-all shadow-inner'
                                            />
                                        </div>
                                    </div>

                                    <div className='space-y-4'>
                                        <label className='text-[10px] font-bold text-gray-500 uppercase tracking-widest'>
                                            Strategy Type
                                        </label>
                                        <div className='relative cursor-pointer group bg-white/[0.03] border border-white/10 rounded-2xl py-4 px-6 flex items-center justify-between hover:border-white/20 transition-all'>
                                            <div className='flex items-center gap-3'>
                                                <Zap className='h-5 w-5 text-blue-500' />
                                                <span className='text-lg font-black text-white'>Matches/Differs</span>
                                            </div>
                                            <ChevronDown className='h-5 w-5 text-gray-500' />
                                        </div>
                                    </div>

                                    <div className='space-y-4'>
                                        <label className='text-[10px] font-bold text-gray-500 uppercase tracking-widest'>
                                            Contract Tick
                                        </label>
                                        <div className='flex gap-2'>
                                            {[1, 5, 10].map(tick => (
                                                <button
                                                    key={tick}
                                                    className={`flex-1 py-4 rounded-2xl font-black text-xl border transition-all ${tick === 1 ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-white/[0.03] border-white/10 text-gray-500 hover:text-white'}`}
                                                >
                                                    {tick}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className='flex flex-col sm:flex-row gap-6'>
                                    <button className='flex-1 bg-gradient-to-br from-blue-500 to-blue-700 py-6 rounded-3xl font-black text-2xl text-white shadow-[0_10px_30px_rgba(37,99,235,0.4)] hover:shadow-blue-500/60 transition-all active:scale-95 flex items-center justify-center gap-4 group'>
                                        <TrendingUp className='h-8 w-8 group-hover:rotate-12 transition-transform' />
                                        PLACE TRADE
                                    </button>
                                    <button className='sm:w-24 bg-white/[0.03] border border-white/10 rounded-3xl flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/[0.08] transition-all group'>
                                        <Settings className='h-8 w-8 group-hover:rotate-45 transition-transform' />
                                    </button>
                                </div>
                            </div>

                            <div className='flex items-center gap-3 p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl'>
                                <ShieldCheck className='h-5 w-5 text-emerald-500' />
                                <p className='text-xs font-medium text-emerald-400'>
                                    Admin Authorized Mode: You are executing this trade under secure root permission for{' '}
                                    <span className='font-black underline'>
                                        {users.find(u => u.id === selectedAccount)?.name}
                                    </span>
                                    .
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className='h-full min-h-[500px] flex flex-col items-center justify-center bg-[#0a0a0a] border border-white/5 border-dashed rounded-3xl text-center p-12'>
                            <div className='w-20 h-20 bg-white/[0.02] rounded-full flex items-center justify-center mb-6'>
                                <ArrowRightLeft className='h-10 w-10 text-gray-700' />
                            </div>
                            <h3 className='text-xl font-bold text-gray-400'>No Account Selected</h3>
                            <p className='text-sm text-gray-600 mt-2 max-w-xs mx-auto'>
                                Please select a user account from the left panel to begin authorized trading execution.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
