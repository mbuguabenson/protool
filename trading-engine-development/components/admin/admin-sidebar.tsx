'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    Users,
    Wallet,
    TrendingUp,
    History,
    FileText,
    Settings,
    ChevronLeft,
    ChevronRight,
    ShieldAlert,
    BarChart3,
    MessageSquare,
    LogOut,
    Globe,
} from 'lucide-react';

interface AdminSidebarProps {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
}

export function AdminSidebar({ isOpen, setIsOpen }: AdminSidebarProps) {
    const pathname = usePathname();
    const [unreadMsgs, setUnreadMsgs] = useState(0);

    useEffect(() => {
        const fetchUnread = () =>
            fetch('/api/admin/messages')
                .then(r => r.json())
                .then(d => setUnreadMsgs(d.unread || 0))
                .catch(() => {});
        fetchUnread();
        const iv = setInterval(fetchUnread, 15000);
        return () => clearInterval(iv);
    }, []);

    const navItems = [
        { label: 'GENERAL', type: 'header' },
        { label: 'Dashboard', icon: LayoutDashboard, href: '/admin', active: pathname === '/admin' },
        { label: 'Users', icon: Users, href: '/admin/users', active: pathname === '/admin/users' },
        {
            label: 'Messages',
            icon: MessageSquare,
            href: '/admin/messages',
            active: pathname === '/admin/messages',
            badge: unreadMsgs,
        },
        { label: 'Portfolio', icon: BarChart3, href: '/admin/portfolio', active: pathname === '/admin/portfolio' },
        { label: 'Market Data', icon: TrendingUp, href: '/admin/market', active: pathname === '/admin/market' },
        { label: 'Trading', icon: TrendingUp, href: '/admin/trading', active: pathname === '/admin/trading' },
        { label: 'Analytics', icon: BarChart3, href: '/admin/analytics', active: pathname === '/admin/analytics' },
        {
            label: 'Transactions',
            icon: History,
            href: '/admin/transactions',
            active: pathname === '/admin/transactions',
        },
        { label: 'System Logs', icon: FileText, href: '/admin/logs', active: pathname === '/admin/logs' },

        { label: 'PREFERENCES', type: 'header', className: 'mt-6' },
        { label: 'Account', icon: Users, href: '/admin/account', active: pathname === '/admin/account' },
        {
            label: 'Notifications',
            icon: ShieldAlert,
            href: '/admin/notifications',
            active: pathname === '/admin/notifications',
        },
        { label: 'Settings', icon: Settings, href: '/admin/settings', active: pathname === '/admin/settings' },
        { label: 'SITE', type: 'header', className: 'mt-6' },
        { label: 'Live Site', icon: Globe, href: '/', active: pathname === '/' },
    ];

    return (
        <aside
            className={`relative h-full transition-all duration-500 border-r border-white/5 bg-[#0a0a0a] flex flex-col z-30 ${isOpen ? 'w-64' : 'w-20'}`}
        >
            {/* Brand Header */}
            <div className='h-16 flex items-center px-6 gap-3 mb-6'>
                <div className='w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-[0_0_15px_rgba(37,99,235,0.4)] shrink-0'>
                    <ShieldAlert className='h-5 w-5 text-white' />
                </div>
                {isOpen && (
                    <h1 className='text-xl font-bold tracking-tight text-white animate-in fade-in duration-500'>
                        RootAdmin
                    </h1>
                )}
            </div>

            {/* Nav Items */}
            <nav className='flex-1 px-3 space-y-1 overflow-y-auto custom-scrollbar'>
                {navItems.map((item, idx) => {
                    if (item.type === 'header') {
                        return isOpen ? (
                            <div
                                key={idx}
                                className={`px-4 py-2 text-[10px] font-bold tracking-widest text-gray-500 ${item.className || ''}`}
                            >
                                {item.label}
                            </div>
                        ) : null;
                    }

                    const Icon = item.icon!;
                    return (
                        <Link
                            key={idx}
                            href={item.href!}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative ${
                                item.active
                                    ? 'bg-white/5 text-white shadow-[0_4px_12px_rgba(0,0,0,0.1)]'
                                    : 'text-gray-400 hover:text-white hover:bg-white/[0.03]'
                            }`}
                        >
                            {item.active && (
                                <div className='absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-500 rounded-r-md shadow-[0_0_8px_rgba(59,130,246,0.6)]' />
                            )}
                            <Icon
                                className={`h-5 w-5 shrink-0 ${item.active ? 'text-blue-500' : 'group-hover:text-blue-400'}`}
                            />
                            {isOpen && (
                                <span className='text-sm font-medium animate-in slide-in-from-left-2 duration-300 flex-1'>
                                    {item.label}
                                </span>
                            )}
                            {isOpen && (item as any).badge > 0 && (
                                <span className='inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-blue-500 text-white text-[9px] font-black rounded-full'>
                                    {(item as any).badge}
                                </span>
                            )}
                        </Link>
                    );
                })}
            </nav>

            {/* Footer Actions */}
            <div className='p-3 mt-auto border-t border-white/5'>
                <button className='w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-all duration-200 group'>
                    <LogOut className='h-5 w-5 shrink-0' />
                    {isOpen && <span className='text-sm font-medium'>Logout</span>}
                </button>
            </div>

            {/* Collapse Toggle */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className='absolute -right-3 top-20 w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white border border-[#050505] shadow-lg hover:scale-110 transition-transform active:scale-95'
            >
                {isOpen ? <ChevronLeft className='h-4 w-4' /> : <ChevronRight className='h-4 w-4' />}
            </button>
        </aside>
    );
}
