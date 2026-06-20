'use client';

import React, { useState, useEffect } from 'react';
import {
    Wallet,
    ArrowUpRight,
    ArrowDownRight,
    Search,
    Filter,
    Download,
    CreditCard,
    Banknote,
    Clock,
    ExternalLink,
    CheckCircle2,
    XCircle,
    AlertCircle,
} from 'lucide-react';

export default function AdminTransactionsPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchTransactions() {
            try {
                const res = await fetch('/api/admin/transactions');
                const data = await res.json();
                const formatted = (data.transactions || []).map((t: any) => ({
                    id: t.id,
                    user: t.loginId,
                    type: t.type,
                    amount: t.amount,
                    currency: t.currency || 'USD',
                    method: t.method || t.market,
                    status: t.status,
                    strategy: t.strategy,
                    stake: t.stake,
                    date: new Date(t.timestamp * 1000).toLocaleString(),
                }));
                setTransactions(formatted);
            } catch (err) {
                console.error('Failed to fetch transactions:', err);
            } finally {
                setLoading(false);
            }
        }
        fetchTransactions();
    }, []);

    const totalDeposits = transactions
        .filter(tx => tx.type === 'Deposit' || tx.type === 'Trade Win')
        .reduce((s, tx) => s + tx.amount, 0);
    const totalWithdrawals = transactions
        .filter(tx => tx.type === 'Withdrawal' || tx.type === 'Trade Loss')
        .reduce((s, tx) => s + tx.amount, 0);

    const stats = [
        {
            label: 'Total Platform Volume',
            value: `$${transactions.reduce((s, tx) => s + tx.amount, 0).toLocaleString()}`,
            icon: Banknote,
            color: 'blue',
        },
        {
            label: 'Recent Movements',
            value: `$${totalWithdrawals.toLocaleString()}`,
            icon: CreditCard,
            color: 'orange',
        },
        {
            label: 'Net P/L',
            value: `$${(totalDeposits - totalWithdrawals).toLocaleString()}`,
            icon: Wallet,
            color: 'green',
        },
    ];

    return (
        <div className='space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700'>
            <div className='flex flex-col md:flex-row justify-between items-start md:items-center gap-4'>
                <div>
                    <h2 className='text-3xl font-black text-white tracking-tight'>Financial Transactions</h2>
                    <p className='text-sm text-gray-500 mt-1'>Audit and manage platform-wide money movement.</p>
                </div>
                <button className='flex items-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white px-5 py-2.5 rounded-xl font-bold transition-all active:scale-95'>
                    <Download className='h-4 w-4' />
                    Export Report
                </button>
            </div>

            {/* Financial Overview Cards */}
            <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
                {stats.map((stat, idx) => (
                    <div
                        key={idx}
                        className='bg-[#0a0a0a] border border-white/5 rounded-3xl p-6 relative overflow-hidden group'
                    >
                        <div className='absolute -right-4 -top-4 w-24 h-24 bg-white/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-colors' />
                        <div className='flex items-center gap-4 mb-4'>
                            <div
                                className={`p-3 rounded-2xl bg-${stat.color === 'blue' ? 'blue' : stat.color === 'orange' ? 'orange' : 'emerald'}-500/10 text-${stat.color === 'blue' ? 'blue' : stat.color === 'orange' ? 'orange' : 'emerald'}-500`}
                            >
                                <stat.icon className='h-6 w-6' />
                            </div>
                            <h4 className='text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-none'>
                                {stat.label}
                            </h4>
                        </div>
                        <p className='text-2xl font-black text-white tracking-tight leading-none'>{stat.value}</p>
                        <div className='mt-4 flex items-center gap-1.5'>
                            <div className='h-1 flex-1 bg-white/5 rounded-full overflow-hidden'>
                                <div
                                    className={`h-full bg-${stat.color === 'blue' ? 'blue' : stat.color === 'orange' ? 'orange' : 'emerald'}-500 w-3/4`}
                                />
                            </div>
                            <span className='text-[10px] text-gray-600 font-bold uppercase'>Target 92%</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Transaction Filter Area */}
            <div className='flex flex-col sm:flex-row gap-4'>
                <div className='relative flex-1 group'>
                    <Search className='absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500' />
                    <input
                        type='text'
                        placeholder='Search TX ID, Username...'
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className='w-full bg-[#0a0a0a] border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-blue-500/50'
                    />
                </div>
                <div className='flex gap-2'>
                    <button className='flex items-center justify-center gap-2 bg-[#0a0a0a] border border-white/5 px-6 py-3 rounded-2xl text-gray-400 hover:text-white transition-all'>
                        <Filter className='h-4 w-4' />
                        Filters
                    </button>
                    <button className='flex items-center justify-center gap-2 bg-[#0a0a0a] border border-white/5 px-6 py-3 rounded-2xl text-gray-400 hover:text-white transition-all'>
                        <Clock className='h-4 w-4' />
                        Date Range
                    </button>
                </div>
            </div>

            {/* Transactions Table */}
            <div className='bg-[#0a0a0a] border border-white/5 rounded-3xl overflow-hidden backdrop-blur-xl'>
                <div className='overflow-x-auto custom-scrollbar'>
                    <table className='w-full text-left border-collapse'>
                        <thead>
                            <tr className='border-b border-white/5 bg-white/[0.02]'>
                                <th className='px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest'>
                                    Transaction ID
                                </th>
                                <th className='px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest'>
                                    User
                                </th>
                                <th className='px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest'>
                                    Strategy
                                </th>
                                <th className='px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest'>
                                    Type
                                </th>
                                <th className='px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest'>
                                    Stake
                                </th>
                                <th className='px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest'>
                                    Profit/Loss
                                </th>
                                <th className='px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest'>
                                    Date
                                </th>
                                <th className='px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest'>
                                    Status
                                </th>
                                <th className='px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-center'>
                                    Action
                                </th>
                            </tr>
                        </thead>
                        <tbody className='divide-y divide-white/5'>
                            {transactions.map(tx => (
                                <tr key={tx.id} className='group hover:bg-white/[0.02] transition-colors'>
                                    <td className='px-6 py-5'>
                                        <span className='text-xs font-mono font-bold text-blue-400 group-hover:text-blue-300 transition-colors uppercase'>
                                            {tx.id}
                                        </span>
                                    </td>
                                    <td className='px-6 py-5'>
                                        <p className='text-sm font-bold text-white mb-0.5'>{tx.user}</p>
                                        <p className='text-[9px] text-gray-500 uppercase tracking-wider'>
                                            Verified User
                                        </p>
                                    </td>
                                    <td className='px-6 py-5'>
                                        <span className='text-xs font-medium text-gray-400'>{tx.strategy}</span>
                                    </td>
                                    <td className='px-6 py-5'>
                                        <div className='flex items-center gap-2'>
                                            {tx.type === 'Deposit' ? (
                                                <ArrowDownRight className='h-4 w-4 text-emerald-400' />
                                            ) : (
                                                <ArrowUpRight className='h-4 w-4 text-orange-400' />
                                            )}
                                            <span
                                                className={`text-xs font-bold ${tx.type === 'Deposit' ? 'text-emerald-400' : 'text-orange-400'}`}
                                            >
                                                {tx.type}
                                            </span>
                                        </div>
                                    </td>
                                    <td className='px-6 py-5'>
                                        <span className='text-sm font-black text-white'>
                                            ${(tx.stake || 0).toFixed(2)}
                                        </span>
                                    </td>
                                    <td className='px-6 py-5'>
                                        <div className='flex flex-col'>
                                            <span
                                                className={`text-sm font-black ${tx.type === 'Deposit' ? 'text-emerald-400' : 'text-rose-400'}`}
                                            >
                                                {tx.type === 'Deposit' ? '+' : '-'}${tx.amount.toFixed(2)}
                                            </span>
                                        </div>
                                    </td>
                                    <td className='px-6 py-5'>
                                        <span className='text-xs font-medium text-gray-400'>{tx.date}</span>
                                    </td>
                                    <td className='px-6 py-5'>
                                        <span
                                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                                tx.status === 'Completed' || tx.status === 'completed'
                                                    ? 'bg-emerald-500/10 text-emerald-500'
                                                    : tx.status === 'Pending'
                                                      ? 'bg-amber-500/10 text-amber-500'
                                                      : 'bg-rose-500/10 text-rose-500'
                                            }`}
                                        >
                                            {(tx.status === 'Completed' || tx.status === 'completed') && (
                                                <CheckCircle2 className='h-3 w-3' />
                                            )}
                                            {tx.status === 'Pending' && <Clock className='h-3 w-3 animate-pulse' />}
                                            {tx.status === 'Failed' && <XCircle className='h-3 w-3' />}
                                            {tx.status}
                                        </span>
                                    </td>
                                    <td className='px-6 py-5 text-center'>
                                        <button className='p-2 hover:bg-blue-500/10 text-gray-500 hover:text-blue-400 rounded-xl transition-all'>
                                            <ExternalLink className='h-4 w-4' />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className='p-8 rounded-3xl bg-[#0a0a0a] border border-white/5 flex flex-col md:flex-row items-center justify-between gap-6'>
                <div className='flex items-center gap-4'>
                    <div className='w-14 h-14 rounded-full bg-blue-600/10 flex items-center justify-center text-blue-500 shrink-0'>
                        <AlertCircle className='h-7 w-7' />
                    </div>
                    <div>
                        <h3 className='text-white font-bold tracking-tight text-lg'>Platform Liquidity Warning</h3>
                        <p className='text-sm text-gray-500 max-w-md'>
                            The total platform reserve is currently at 84%. Consider reviewing pending withdrawal
                            requests.
                        </p>
                    </div>
                </div>
                <button className='w-full md:w-auto px-8 py-3 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-500/20 hover:bg-blue-500 transition-all active:scale-95 uppercase tracking-wider text-sm'>
                    Review Reserve
                </button>
            </div>
        </div>
    );
}
