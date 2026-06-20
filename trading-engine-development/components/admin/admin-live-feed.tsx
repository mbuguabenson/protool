'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, TrendingUp, Wallet, ShieldCheck, Clock } from 'lucide-react';

interface FeedItem {
    id: string;
    type: 'trade' | 'deposit' | 'withdrawal' | 'login';
    user: string;
    amount?: number;
    currency?: string;
    status: string;
    timestamp: Date;
}

export function AdminLiveFeed() {
    const [items, setItems] = useState<FeedItem[]>([]);

    useEffect(() => {
        async function fetchTrades() {
            try {
                const res = await fetch('/api/admin/trades');
                const data = await res.json();
                const formatted = (data.trades || []).map((t: any) => ({
                    id: t.id.toString(),
                    type: 'trade',
                    user: t.loginId,
                    amount: t.stake,
                    currency: 'USD',
                    status: t.status,
                    timestamp: new Date(t.createdAt * 1000),
                }));
                setItems(formatted);
            } catch (err) {
                console.error('Failed to fetch live feed:', err);
            }
        }

        fetchTrades();
        const interval = setInterval(fetchTrades, 10000); // Refresh every 10s
        return () => clearInterval(interval);
    }, []);

    const getIcon = (type: FeedItem['type']) => {
        switch (type) {
            case 'trade':
                return <TrendingUp className='h-3.5 w-3.5' />;
            case 'deposit':
                return <Wallet className='h-3.5 w-3.5' />;
            case 'withdrawal':
                return <Wallet className='h-3.5 w-3.5' />;
            case 'login':
                return <User className='h-3.5 w-3.5' />;
        }
    };

    const getColor = (type: FeedItem['type']) => {
        switch (type) {
            case 'trade':
                return 'text-blue-400 bg-blue-500/10';
            case 'deposit':
                return 'text-emerald-400 bg-emerald-500/10';
            case 'withdrawal':
                return 'text-orange-400 bg-orange-500/10';
            case 'login':
                return 'text-purple-400 bg-purple-500/10';
        }
    };

    return (
        <div className='bg-[#0f1115]/80 border border-white/5 rounded-2xl p-6 backdrop-blur-xl relative overflow-hidden h-full'>
            <div className='flex items-center justify-between mb-6'>
                <h3 className='text-lg font-bold text-white flex items-center gap-2'>
                    <Clock className='h-4 w-4 text-blue-500' />
                    Live Platform Activity
                </h3>
                <span className='flex items-center gap-2'>
                    <span className='w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse' />
                    <span className='text-[10px] font-bold text-gray-500 uppercase tracking-widest'>Live Stream</span>
                </span>
            </div>

            <div className='space-y-4'>
                <AnimatePresence initial={false}>
                    {items.map(item => (
                        <motion.div
                            key={item.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className='group flex items-center gap-4 p-3 rounded-xl hover:bg-white/[0.03] transition-all border border-transparent hover:border-white/5'
                        >
                            <div className={`p-2.5 rounded-lg shrink-0 ${getColor(item.type)}`}>
                                {getIcon(item.type)}
                            </div>

                            <div className='flex-1 min-w-0'>
                                <div className='flex justify-between items-start'>
                                    <p className='text-sm font-bold text-white truncate group-hover:text-blue-400 transition-colors'>
                                        {item.user}
                                    </p>
                                    <span className='text-[10px] text-gray-500 font-medium font-mono'>
                                        {item.timestamp.toLocaleTimeString([], {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                            second: '2-digit',
                                        })}
                                    </span>
                                </div>
                                <div className='flex items-center gap-2 text-[11px] text-gray-400 mt-0.5'>
                                    <span className='capitalize'>{item.type}</span>
                                    {item.amount && <span className='text-gray-600'>•</span>}
                                    {item.amount && (
                                        <span className='font-bold text-gray-300'>
                                            {item.amount.toFixed(2)} {item.currency}
                                        </span>
                                    )}
                                    <span className='text-gray-600'>•</span>
                                    <span className='flex items-center gap-1 text-[9px] uppercase tracking-wider text-emerald-500/80'>
                                        <ShieldCheck className='h-2.5 w-2.5' />
                                        Verified
                                    </span>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
}
