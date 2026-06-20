'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import {
    Bell,
    Search,
    User,
    LogOut,
    LayoutDashboard,
    Users,
    BarChart3,
    Receipt,
    Settings,
    Terminal,
    Zap,
} from 'lucide-react';
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
    CommandShortcut,
} from '@/components/ui/command';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const [open, setOpen] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen(open => !open);
            }
        };
        document.addEventListener('keydown', down);
        return () => document.removeEventListener('keydown', down);
    }, []);

    if (pathname === '/admin/login') {
        return <>{children}</>;
    }

    return (
        <div className='flex h-screen bg-[#050505] text-white overflow-hidden font-sans'>
            {/* Sidebar */}
            <AdminSidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

            {/* Main Content */}
            <div className='flex-1 flex flex-col min-w-0 overflow-hidden relative'>
                {/* Top Header */}
                <header className='h-16 flex items-center justify-between px-6 border-b border-white/5 bg-[#050505]/50 backdrop-blur-xl z-20'>
                    <div className='flex items-center gap-4'>
                        <div className='flex items-center gap-2 text-sm text-gray-400'>
                            <span>Main Menu</span>
                            <span>/</span>
                            <span className='text-white font-medium capitalize'>Dashboard</span>
                        </div>
                    </div>

                    <div className='flex items-center gap-6'>
                        <div className='relative group hidden md:block'>
                            <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 group-focus-within:text-blue-500 transition-colors' />
                            <button
                                onClick={() => setOpen(true)}
                                className='bg-white/5 border border-white/10 rounded-lg py-1.5 pl-10 pr-4 text-sm w-64 text-left text-gray-400 hover:border-blue-500/50 hover:bg-white/10 transition-all flex items-center justify-between'
                            >
                                <span>Quick Search...</span>
                                <kbd className='pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-white/10 px-1.5 font-mono text-[10px] font-medium text-gray-500 opacity-100'>
                                    <span className='text-xs'>Ctrl</span>K
                                </kbd>
                            </button>
                        </div>

                        <button className='relative group p-2 hover:bg-white/5 rounded-lg transition-colors'>
                            <Bell className='h-5 w-5 text-gray-400 group-hover:text-white' />
                            <span className='absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full border-2 border-[#050505]'></span>
                        </button>

                        <div className='flex items-center gap-3 pl-2 group'>
                            <div className='flex flex-col items-end mr-2'>
                                <p className='text-xs font-bold leading-none'>Admin Panel</p>
                                <p className='text-[10px] text-gray-400 leading-tight'>Master Root</p>
                            </div>
                            <button
                                onClick={() => {
                                    document.cookie = 'admin_session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
                                    router.push('/admin/login');
                                }}
                                className='w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center border border-white/10 hover:shadow-lg hover:shadow-blue-500/20 transition-all active:scale-95'
                            >
                                <LogOut className='h-4 w-4 text-white' />
                            </button>
                        </div>
                    </div>
                </header>

                {/* Scrollable Area */}
                <main className='flex-1 overflow-y-auto overflow-x-hidden p-6 custom-scrollbar relative'>
                    {/* Background Glows */}
                    <div className='absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/5 blur-[120px] rounded-full pointer-events-none -z-10'></div>
                    <div className='absolute bottom-0 left-0 w-[300px] h-[300px] bg-purple-500/5 blur-[120px] rounded-full pointer-events-none -z-10'></div>

                    {children}
                </main>
            </div>

            {/* Global Command Menu */}
            <CommandDialog open={open} onOpenChange={setOpen}>
                <div className='bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden shadow-2xl'>
                    <CommandInput
                        placeholder='Type a command or search...'
                        className='border-none focus:ring-0 text-white'
                    />
                    <CommandList className='max-h-[300px] overflow-y-auto custom-scrollbar'>
                        <CommandEmpty className='py-6 text-center text-sm text-gray-500'>
                            No results found.
                        </CommandEmpty>
                        <CommandGroup heading='Navigation' className='text-gray-500 px-2 py-3'>
                            <CommandItem
                                onSelect={() => {
                                    router.push('/admin');
                                    setOpen(false);
                                }}
                                className='flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 cursor-pointer group'
                            >
                                <LayoutDashboard className='h-4 w-4 text-blue-500' />
                                <span className='text-white font-bold'>Dashboard</span>
                                <CommandShortcut className='text-gray-600 font-mono'>G D</CommandShortcut>
                            </CommandItem>
                            <CommandItem
                                onSelect={() => {
                                    router.push('/admin/users');
                                    setOpen(false);
                                }}
                                className='flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 cursor-pointer group'
                            >
                                <Users className='h-4 w-4 text-emerald-500' />
                                <span className='text-white font-bold'>Manage Users</span>
                                <CommandShortcut className='text-gray-600 font-mono'>G U</CommandShortcut>
                            </CommandItem>
                            <CommandItem
                                onSelect={() => {
                                    router.push('/admin/analytics');
                                    setOpen(false);
                                }}
                                className='flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 cursor-pointer group'
                            >
                                <BarChart3 className='h-4 w-4 text-purple-500' />
                                <span className='text-white font-bold'>Platform Analytics</span>
                                <CommandShortcut className='text-gray-600 font-mono'>G A</CommandShortcut>
                            </CommandItem>
                            <CommandItem
                                onSelect={() => {
                                    router.push('/admin/transactions');
                                    setOpen(false);
                                }}
                                className='flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 cursor-pointer group'
                            >
                                <Receipt className='h-4 w-4 text-orange-500' />
                                <span className='text-white font-bold'>Financial History</span>
                                <CommandShortcut className='text-gray-600 font-mono'>G T</CommandShortcut>
                            </CommandItem>
                            <CommandItem
                                onSelect={() => {
                                    router.push('/admin#trading-console');
                                    setOpen(false);
                                }}
                                className='flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 cursor-pointer group'
                            >
                                <Zap className='h-4 w-4 text-yellow-500' />
                                <span className='text-white font-bold'>Admin Trading Console</span>
                                <CommandShortcut className='text-gray-600 font-mono'>G X</CommandShortcut>
                            </CommandItem>
                        </CommandGroup>
                        <CommandSeparator className='bg-white/5' />
                        <CommandGroup heading='Settings' className='text-gray-500 px-2 py-3'>
                            <CommandItem
                                onSelect={() => {
                                    router.push('/admin/settings');
                                    setOpen(false);
                                }}
                                className='flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 cursor-pointer group'
                            >
                                <Settings className='h-4 w-4 text-gray-400' />
                                <span className='text-white font-bold'>Open Settings</span>
                                <CommandShortcut className='text-gray-600 font-mono'>G S</CommandShortcut>
                            </CommandItem>
                            <CommandItem
                                onSelect={async () => {
                                    // Toggle Maintenance via API
                                    try {
                                        const res = await fetch('/api/admin/site-config');
                                        const config = await res.json();
                                        await fetch('/api/admin/site-config', {
                                            method: 'PATCH',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ maintenanceMode: !config.maintenanceMode }),
                                        });
                                        router.refresh();
                                        setOpen(false);
                                    } catch (e) {
                                        console.error('Command toggle failed', e);
                                    }
                                }}
                                className='flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 cursor-pointer group'
                            >
                                <Terminal className='h-4 w-4 text-amber-500' />
                                <span className='text-white font-bold'>Toggle Maintenance Mode</span>
                            </CommandItem>
                        </CommandGroup>
                        <CommandSeparator className='bg-white/5' />
                        <CommandGroup heading='System' className='text-gray-500 px-2 py-3'>
                            <CommandItem
                                onSelect={() => {
                                    document.cookie = 'admin_session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
                                    router.push('/admin/login');
                                    setOpen(false);
                                }}
                                className='flex items-center gap-3 p-3 rounded-xl hover:bg-rose-500/10 cursor-pointer group'
                            >
                                <LogOut className='h-4 w-4 text-rose-500' />
                                <span className='text-rose-500 font-bold'>Logout Session</span>
                            </CommandItem>
                        </CommandGroup>
                    </CommandList>
                </div>
            </CommandDialog>
        </div>
    );
}
