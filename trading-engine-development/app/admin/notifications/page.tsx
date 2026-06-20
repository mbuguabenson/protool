'use client';

import React from 'react';
import { Bell, ShieldAlert, Zap, UserPlus, Info, CheckCircle2, MoreVertical, Search, Filter } from 'lucide-react';

export default function AdminNotificationsPage() {
    const alerts = [
        {
            id: 1,
            type: 'security',
            title: 'Suspicious Login Attempt',
            desc: 'Detected multiple failed attempts from IP 192.168.1.104',
            time: '2m ago',
            priority: 'critical',
        },
        {
            id: 2,
            type: 'system',
            title: 'API Latency Warning',
            desc: 'Deriv WebSocket responding slower than usual (240ms)',
            time: '15m ago',
            priority: 'warn',
        },
        {
            id: 3,
            type: 'user',
            title: 'New Trader Verified',
            desc: 'Sarah Jones (CR200843) has completed Tier 2 KYC.',
            time: '45m ago',
            priority: 'low',
        },
        {
            id: 4,
            type: 'finance',
            title: 'Large Withdrawal Request',
            desc: 'David Wang requested $5,000.00 USD withdrawal.',
            time: '1h ago',
            priority: 'warn',
        },
        {
            id: 5,
            type: 'trading',
            title: 'Profit Peak Reached',
            desc: 'Platform total daily profit exceeded the $10,000 threshold.',
            time: '3h ago',
            priority: 'low',
        },
    ];

    const getIcon = (type: string) => {
        switch (type) {
            case 'security':
                return <ShieldAlert className='h-5 w-5' />;
            case 'system':
                return <Zap className='h-5 w-5' />;
            case 'user':
                return <UserPlus className='h-5 w-5' />;
            case 'finance':
                return <Info className='h-5 w-5' />;
            default:
                return <Bell className='h-5 w-5' />;
        }
    };

    const getColor = (priority: string) => {
        switch (priority) {
            case 'critical':
                return 'text-rose-500 bg-rose-500/10 border-rose-500/20 shadow-[0_0_15px_rgba(244,63,94,0.3)]';
            case 'warn':
                return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
            default:
                return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
        }
    };

    return (
        <div className='space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20'>
            <div className='flex justify-between items-center'>
                <div>
                    <h2 className='text-3xl font-black text-white tracking-tight'>System Alerts</h2>
                    <p className='text-sm text-gray-500 mt-1'>Global notifications and critical platform events.</p>
                </div>
                <button className='text-xs font-black text-blue-400 uppercase flex items-center gap-2 hover:bg-blue-600/10 px-4 py-2 rounded-xl transition-all border border-transparent hover:border-blue-500/20'>
                    <CheckCircle2 className='h-4 w-4' />
                    Mark all as Read
                </button>
            </div>

            <div className='flex gap-4'>
                <div className='relative flex-1 group'>
                    <Search className='absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600 group-focus-within:text-blue-500 transition-colors' />
                    <input
                        type='text'
                        placeholder='Search notifications...'
                        className='w-full bg-[#0a0a0a] border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-xs focus:outline-none focus:border-blue-500/30 font-medium'
                    />
                </div>
                <button className='px-6 py-3 bg-[#0a0a0a] border border-white/5 rounded-2xl text-gray-500 hover:text-white transition-all'>
                    <Filter className='h-4 w-4' />
                </button>
            </div>

            <div className='space-y-4'>
                {alerts.map(alert => (
                    <div
                        key={alert.id}
                        className='bg-[#0a0a0a] border border-white/5 rounded-3xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-6 group hover:border-white/10 hover:bg-white/[0.01] transition-all relative overflow-hidden'
                    >
                        {alert.priority === 'critical' && (
                            <div className='absolute left-0 top-0 bottom-0 w-1 bg-rose-600 shadow-[0_0_10px_rgba(225,29,72,0.6)]' />
                        )}

                        <div
                            className={`p-3 rounded-2xl shrink-0 transition-transform group-hover:scale-110 ${getColor(alert.priority)}`}
                        >
                            {getIcon(alert.type)}
                        </div>

                        <div className='flex-1 space-y-1'>
                            <div className='flex items-center gap-3'>
                                <h3 className='text-sm font-black text-white group-hover:text-blue-400 transition-colors uppercase tracking-tight'>
                                    {alert.title}
                                </h3>
                                <span className='text-[10px] text-gray-600 font-medium uppercase tracking-widest'>
                                    • {alert.time}
                                </span>
                            </div>
                            <p className='text-xs text-gray-500 leading-relaxed max-w-2xl'>{alert.desc}</p>
                        </div>

                        <div className='flex items-center gap-2 self-end sm:self-center'>
                            <button className='px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black text-gray-400 hover:text-white hover:bg-white/10 transition-all uppercase tracking-widest'>
                                Resolve
                            </button>
                            <button className='p-2 text-gray-600 hover:text-white transition-colors'>
                                <MoreVertical className='h-4 w-4' />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <div className='p-8 rounded-3xl bg-blue-600/5 border border-blue-500/10 flex items-center gap-6 justify-center text-center flex-col'>
                <div className='w-16 h-16 rounded-full bg-blue-600/10 flex items-center justify-center text-blue-500 mx-auto'>
                    <Bell className='h-8 w-8' />
                </div>
                <div>
                    <h3 className='text-white font-bold text-lg mb-2'>Notification Archive</h3>
                    <p className='text-xs text-gray-500 max-w-sm mx-auto'>
                        Historical system alerts are moved to the vault every 30 days to maintain dashboard performance.
                    </p>
                </div>
                <button className='px-6 py-2 bg-blue-600/10 text-blue-400 border border-blue-500/20 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-blue-600/20 transition-all'>
                    View Archive Vault
                </button>
            </div>
        </div>
    );
}
