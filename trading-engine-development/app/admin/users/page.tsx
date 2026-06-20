'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Users,
    RefreshCw,
    Wifi,
    WifiOff,
    Search,
    MapPin,
    Globe,
    Monitor,
    Clock,
    ShieldCheck,
    ShieldX,
    ShieldAlert,
    ShieldOff,
    ChevronRight,
    X,
    Coins,
    TrendingUp,
    Eye,
    Sparkles,
    Activity,
    Copy,
    CheckCheck,
    Flag,
    UserCheck,
    UserX,
    AlertTriangle,
    BarChart3,
    Layers,
} from 'lucide-react';

interface UserRecord {
    loginId: string;
    name: string;
    type: 'Real' | 'Demo';
    currency: string;
    balance: number;
    balanceHistory: { ts: number; balance: number }[];
    status: 'online' | 'offline';
    flag: 'none' | 'whitelisted' | 'blacklisted' | 'blocked';
    lastSeen: number;
    firstSeen: number;
    ip: string;
    country: string;
    city: string;
    userAgent: string;
    isNew: boolean;
    pageViews: number;
}

function timeAgo(ts: number) {
    const diff = Math.floor(Date.now() / 1000) - ts;
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

function parseDevice(ua: string): string {
    if (!ua) return 'Unknown';
    if (/Mobile|Android|iPhone/i.test(ua)) return 'Mobile';
    if (/iPad|Tablet/i.test(ua)) return 'Tablet';
    return 'Desktop';
}

function parseBrowser(ua: string): string {
    if (!ua) return 'Unknown';
    if (/Chrome/i.test(ua) && !/Edge|Edg/i.test(ua)) return 'Chrome';
    if (/Firefox/i.test(ua)) return 'Firefox';
    if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) return 'Safari';
    if (/Edge|Edg/i.test(ua)) return 'Edge';
    return 'Other';
}

const FLAG_CONFIG = {
    none: {
        label: 'None',
        color: 'text-gray-500 bg-white/5 border-white/10',
        icon: <ShieldOff className='h-3.5 w-3.5' />,
    },
    whitelisted: {
        label: 'Whitelisted',
        color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
        icon: <ShieldCheck className='h-3.5 w-3.5' />,
    },
    blacklisted: {
        label: 'Blacklisted',
        color: 'text-amber-400 bg-amber-500/10 border-amber-500/25',
        icon: <ShieldAlert className='h-3.5 w-3.5' />,
    },
    blocked: {
        label: 'Blocked',
        color: 'text-rose-400 bg-rose-500/10 border-rose-500/25',
        icon: <ShieldX className='h-3.5 w-3.5' />,
    },
};

function CopyText({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <button
            onClick={() => {
                navigator.clipboard.writeText(text);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }}
            className='ml-1.5 text-gray-600 hover:text-blue-400 transition-colors'
        >
            {copied ? <CheckCheck className='h-3 w-3 text-blue-400' /> : <Copy className='h-3 w-3' />}
        </button>
    );
}

function MiniSparkline({ history }: { history: { ts: number; balance: number }[] }) {
    if (history.length < 2) return null;
    const vals = history.slice(-20).map(h => h.balance);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max - min || 1;
    const w = 80,
        h = 24;
    const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * w},${h - ((v - min) / range) * h}`);
    const color = vals[vals.length - 1] >= vals[0] ? '#10b981' : '#ef4444';
    return (
        <svg width={w} height={h} className='opacity-70'>
            <polyline points={pts.join(' ')} fill='none' stroke={color} strokeWidth='1.5' strokeLinejoin='round' />
        </svg>
    );
}

export default function AdminUsersPage() {
    const [users, setUsers] = useState<UserRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<'all' | 'online' | 'new' | 'real' | 'demo' | 'blocked'>('all');
    const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
    const [flagLoading, setFlagLoading] = useState(false);
    const [sortBy, setSortBy] = useState<'lastSeen' | 'firstSeen' | 'balance'>('lastSeen');

    const fetchUsers = useCallback(
        async (silent = false) => {
            if (!silent) setLoading(true);
            else setRefreshing(true);
            try {
                const res = await fetch('/api/admin/users');
                const data = await res.json();
                const list: UserRecord[] = data.users || [];
                setUsers(list);
                // Keep selected user up to date
                if (selectedUser) {
                    const updated = list.find(u => u.loginId === selectedUser.loginId);
                    if (updated) setSelectedUser(updated);
                }
            } catch (err) {
                console.error('Failed to fetch users:', err);
            } finally {
                setLoading(false);
                setRefreshing(false);
            }
        },
        [selectedUser?.loginId]
    );

    useEffect(() => {
        fetchUsers();
        const interval = setInterval(() => fetchUsers(true), 15000);
        return () => clearInterval(interval);
    }, [fetchUsers]);

    const setFlag = async (loginId: string, flag: string) => {
        setFlagLoading(true);
        try {
            await fetch(`/api/admin/users/${loginId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: flag }),
            });
            await fetchUsers(true);
        } finally {
            setFlagLoading(false);
        }
    };

    const sorted = useMemo(() => {
        return [...users].sort((a, b) => {
            if (sortBy === 'balance') return b.balance - a.balance;
            if (sortBy === 'firstSeen') return a.firstSeen - b.firstSeen;
            return b.lastSeen - a.lastSeen;
        });
    }, [users, sortBy]);

    const filtered = useMemo(
        () =>
            sorted.filter(u => {
                const q = search.toLowerCase();
                const matchesSearch =
                    u.loginId.toLowerCase().includes(q) ||
                    (u.name || '').toLowerCase().includes(q) ||
                    (u.ip || '').includes(q) ||
                    (u.country || '').toLowerCase().includes(q) ||
                    (u.city || '').toLowerCase().includes(q);
                if (filter === 'online') return matchesSearch && u.status === 'online';
                if (filter === 'new') return matchesSearch && u.isNew;
                if (filter === 'real') return matchesSearch && u.type === 'Real';
                if (filter === 'demo') return matchesSearch && u.type === 'Demo';
                if (filter === 'blocked') return matchesSearch && u.flag === 'blocked';
                return matchesSearch;
            }),
        [sorted, search, filter]
    );

    const stats = useMemo(
        () => ({
            total: users.length,
            online: users.filter(u => u.status === 'online').length,
            newToday: users.filter(u => u.isNew).length,
            real: users.filter(u => u.type === 'Real').length,
            demo: users.filter(u => u.type === 'Demo').length,
            blocked: users.filter(u => u.flag === 'blocked').length,
        }),
        [users]
    );

    return (
        <div className='flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20'>
            {/* ── Header ── */}
            <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
                <div>
                    <h2 className='text-3xl font-black text-white tracking-tight'>User Management</h2>
                    <p className='text-sm text-gray-500 mt-1'>
                        All accounts that have authorized your app. Auto-refreshes every 15s.
                    </p>
                </div>
                <div className='flex items-center gap-3'>
                    <select
                        value={sortBy}
                        onChange={e => setSortBy(e.target.value as any)}
                        className='bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-gray-300 focus:outline-none focus:border-blue-500/50'
                    >
                        <option value='lastSeen'>Sort: Last Seen</option>
                        <option value='firstSeen'>Sort: First Joined</option>
                        <option value='balance'>Sort: Balance</option>
                    </select>
                    <button
                        onClick={() => fetchUsers(true)}
                        disabled={refreshing}
                        className='flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-gray-300 hover:bg-white/10 transition-all disabled:opacity-50'
                    >
                        <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
                    </button>
                </div>
            </div>

            {/* ── Stats ── */}
            <div className='grid grid-cols-3 sm:grid-cols-6 gap-3'>
                {[
                    { label: 'Total', value: stats.total, color: 'text-blue-400', filter: 'all' },
                    { label: 'Online', value: stats.online, color: 'text-emerald-400', filter: 'online' },
                    { label: 'New Today', value: stats.newToday, color: 'text-purple-400', filter: 'new' },
                    { label: 'Real', value: stats.real, color: 'text-green-400', filter: 'real' },
                    { label: 'Demo', value: stats.demo, color: 'text-amber-400', filter: 'demo' },
                    { label: 'Blocked', value: stats.blocked, color: 'text-rose-400', filter: 'blocked' },
                ].map(s => (
                    <button
                        key={s.label}
                        onClick={() => setFilter(s.filter as any)}
                        className={`bg-[#0a0a0a] border rounded-2xl p-4 text-left transition-all hover:border-white/10 ${filter === s.filter ? 'border-blue-500/30 bg-blue-500/5' : 'border-white/5'}`}
                    >
                        <p className='text-[10px] uppercase tracking-widest text-gray-600 font-bold'>{s.label}</p>
                        <p className={`text-2xl font-black mt-1 ${s.color}`}>{s.value}</p>
                    </button>
                ))}
            </div>

            {/* ── Search ── */}
            <div className='relative'>
                <Search className='absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600' />
                <input
                    type='text'
                    placeholder='Search by Account ID, name, IP, country or city…'
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className='w-full bg-white/[0.03] border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-sm text-white placeholder:text-gray-700 focus:outline-none focus:border-blue-500/40 transition-all'
                />
            </div>

            {/* ── Split View ── */}
            <div className='flex gap-4 min-h-[600px]'>
                {/* User List */}
                <div
                    className={`bg-[#0a0a0a] border border-white/5 rounded-3xl overflow-hidden flex flex-col flex-shrink-0 transition-all ${selectedUser ? 'w-[420px]' : 'flex-1'}`}
                >
                    <div className='px-5 py-4 border-b border-white/5 flex items-center gap-2'>
                        <Users className='h-4 w-4 text-blue-500' />
                        <span className='text-xs font-black text-white uppercase tracking-widest'>Users</span>
                        <span className='ml-auto text-[10px] text-gray-600 font-bold'>{filtered.length} accounts</span>
                    </div>
                    <div className='overflow-y-auto flex-1 divide-y divide-white/[0.03]'>
                        {loading ? (
                            <div className='flex items-center justify-center h-40'>
                                <div className='w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin' />
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className='flex flex-col items-center justify-center h-40 text-center px-4'>
                                <Users className='h-8 w-8 text-gray-700 mb-3' />
                                <p className='text-sm font-bold text-gray-500'>No users found</p>
                            </div>
                        ) : (
                            filtered.map(user => {
                                const fc = FLAG_CONFIG[user.flag];
                                const isSelected = selectedUser?.loginId === user.loginId;
                                return (
                                    <button
                                        key={user.loginId}
                                        onClick={() => setSelectedUser(isSelected ? null : user)}
                                        className={`w-full text-left px-5 py-4 hover:bg-white/[0.02] transition-all flex items-start gap-3 ${isSelected ? 'bg-blue-500/5 border-l-2 border-blue-500' : ''}`}
                                    >
                                        {/* Avatar */}
                                        <div
                                            className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black shrink-0 ${user.type === 'Real' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}
                                        >
                                            {user.loginId.slice(-2).toUpperCase()}
                                        </div>
                                        <div className='flex-1 min-w-0'>
                                            <div className='flex items-center gap-2'>
                                                <span className='text-sm font-bold text-white font-mono truncate'>
                                                    {user.loginId}
                                                </span>
                                                {user.isNew && (
                                                    <span className='inline-flex items-center gap-0.5 text-[9px] font-black bg-purple-500/15 text-purple-400 border border-purple-500/25 px-1.5 py-0.5 rounded-full whitespace-nowrap'>
                                                        <Sparkles className='h-2.5 w-2.5' /> NEW
                                                    </span>
                                                )}
                                                {user.flag !== 'none' && (
                                                    <span
                                                        className={`inline-flex items-center gap-0.5 text-[9px] font-black border px-1.5 py-0.5 rounded-full ${fc.color}`}
                                                    >
                                                        {fc.icon} {fc.label}
                                                    </span>
                                                )}
                                            </div>
                                            <div className='flex items-center gap-3 mt-0.5'>
                                                <span
                                                    className={`flex items-center gap-1 text-[10px] font-bold ${user.status === 'online' ? 'text-emerald-400' : 'text-gray-600'}`}
                                                >
                                                    <span
                                                        className={`w-1.5 h-1.5 rounded-full ${user.status === 'online' ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`}
                                                    />
                                                    {user.status}
                                                </span>
                                                <span className='text-[10px] text-gray-600'>
                                                    {user.type} · {user.currency}
                                                </span>
                                                {user.country && user.country !== 'Unknown' && (
                                                    <span className='text-[10px] text-gray-700'>
                                                        {user.city !== 'Unknown' ? user.city + ', ' : ''}
                                                        {user.country}
                                                    </span>
                                                )}
                                            </div>
                                            <div className='flex items-center justify-between mt-1'>
                                                <span className='text-xs font-black text-white tabular-nums'>
                                                    {Number(user.balance).toLocaleString(undefined, {
                                                        minimumFractionDigits: 2,
                                                        maximumFractionDigits: 2,
                                                    })}{' '}
                                                    {user.currency}
                                                </span>
                                                <span className='text-[10px] text-gray-700'>
                                                    {timeAgo(user.lastSeen)}
                                                </span>
                                            </div>
                                        </div>
                                        <ChevronRight
                                            className={`h-4 w-4 text-gray-700 shrink-0 mt-1 transition-transform ${isSelected ? 'rotate-90' : ''}`}
                                        />
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Profile Panel */}
                {selectedUser && (
                    <div className='flex-1 flex flex-col gap-4 min-w-0 animate-in fade-in slide-in-from-right-4 duration-300'>
                        {/* Header Card */}
                        <div
                            className={`relative overflow-hidden rounded-3xl p-6 ${selectedUser.type === 'Real' ? 'bg-gradient-to-br from-emerald-700 to-teal-900' : 'bg-gradient-to-br from-slate-700 to-slate-900'}`}
                        >
                            <div className='absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/5' />
                            <div className='absolute bottom-0 right-12 w-16 h-16 rounded-full bg-white/5' />
                            <button
                                onClick={() => setSelectedUser(null)}
                                className='absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-black/20 hover:bg-black/40 rounded-xl transition-all'
                            >
                                <X className='h-4 w-4 text-white' />
                            </button>
                            <div className='flex items-start gap-4 relative'>
                                <div className='w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-xl font-black text-white'>
                                    {selectedUser.loginId.slice(-2).toUpperCase()}
                                </div>
                                <div className='flex-1 min-w-0'>
                                    <div className='flex items-center gap-2 flex-wrap'>
                                        <h3 className='text-xl font-black text-white'>
                                            {selectedUser.name || 'Deriv User'}
                                        </h3>
                                        {selectedUser.isNew && (
                                            <span className='inline-flex items-center gap-1 text-[9px] font-black bg-white/20 text-white px-2 py-0.5 rounded-full'>
                                                <Sparkles className='h-2.5 w-2.5' /> NEW USER
                                            </span>
                                        )}
                                    </div>
                                    <div className='flex items-center gap-1 text-white/60 text-xs font-mono mt-0.5'>
                                        {selectedUser.loginId}
                                        <CopyText text={selectedUser.loginId} />
                                    </div>
                                    <div className='flex items-center gap-2 mt-2 flex-wrap'>
                                        <span
                                            className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full ${selectedUser.type === 'Real' ? 'bg-emerald-400/20 text-emerald-200' : 'bg-amber-400/20 text-amber-300'}`}
                                        >
                                            <Coins className='h-3 w-3' /> {selectedUser.type}
                                        </span>
                                        <span
                                            className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full ${selectedUser.status === 'online' ? 'bg-emerald-400/20 text-emerald-300' : 'bg-white/10 text-white/40'}`}
                                        >
                                            {selectedUser.status === 'online' ? (
                                                <Wifi className='h-3 w-3' />
                                            ) : (
                                                <WifiOff className='h-3 w-3' />
                                            )}
                                            {selectedUser.status}
                                        </span>
                                    </div>
                                </div>
                                <div className='text-right hidden sm:block'>
                                    <p className='text-[10px] font-bold text-white/50 uppercase tracking-widest mb-1'>
                                        Balance
                                    </p>
                                    <p className='text-2xl font-black text-white leading-none'>
                                        {Number(selectedUser.balance).toLocaleString(undefined, {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                        })}
                                    </p>
                                    <p className='text-xs text-white/50 mt-0.5'>{selectedUser.currency}</p>
                                    <div className='mt-2'>
                                        <MiniSparkline history={selectedUser.balanceHistory} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Info Grid */}
                        <div className='grid grid-cols-2 gap-4'>
                            {/* Location & Network */}
                            <div className='bg-[#0a0a0a] border border-white/5 rounded-3xl p-5 space-y-3'>
                                <p className='text-[10px] font-black uppercase tracking-widest text-gray-600 flex items-center gap-1.5'>
                                    <Globe className='h-3.5 w-3.5 text-blue-500' /> Network & Location
                                </p>
                                {[
                                    { label: 'IP Address', value: selectedUser.ip || '—', copy: true },
                                    { label: 'Country', value: selectedUser.country || 'Unknown' },
                                    { label: 'City', value: selectedUser.city || 'Unknown' },
                                    { label: 'Device', value: parseDevice(selectedUser.userAgent) },
                                    { label: 'Browser', value: parseBrowser(selectedUser.userAgent) },
                                ].map((f, i) => (
                                    <div
                                        key={i}
                                        className='flex items-center justify-between py-1 border-b border-white/[0.03] last:border-0'
                                    >
                                        <span className='text-[10px] text-gray-600 font-bold uppercase tracking-widest'>
                                            {f.label}
                                        </span>
                                        <span className='flex items-center text-xs font-bold text-white font-mono'>
                                            {f.value}
                                            {f.copy && f.value !== '—' && <CopyText text={f.value} />}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* Activity */}
                            <div className='bg-[#0a0a0a] border border-white/5 rounded-3xl p-5 space-y-3'>
                                <p className='text-[10px] font-black uppercase tracking-widest text-gray-600 flex items-center gap-1.5'>
                                    <Activity className='h-3.5 w-3.5 text-emerald-500' /> Activity
                                </p>
                                {[
                                    {
                                        label: 'First Seen',
                                        value: new Date(selectedUser.firstSeen * 1000).toLocaleString(),
                                    },
                                    { label: 'Last Seen', value: timeAgo(selectedUser.lastSeen) },
                                    { label: 'Page Views', value: `${selectedUser.pageViews || 0} heartbeats` },
                                    { label: 'Currency', value: selectedUser.currency },
                                    { label: 'Flag', value: FLAG_CONFIG[selectedUser.flag].label },
                                ].map((f, i) => (
                                    <div
                                        key={i}
                                        className='flex items-center justify-between py-1 border-b border-white/[0.03] last:border-0'
                                    >
                                        <span className='text-[10px] text-gray-600 font-bold uppercase tracking-widest'>
                                            {f.label}
                                        </span>
                                        <span className='text-xs font-bold text-white'>{f.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Balance Sparkline Card */}
                        {selectedUser.balanceHistory.length > 1 && (
                            <div className='bg-[#0a0a0a] border border-white/5 rounded-3xl p-5'>
                                <p className='text-[10px] font-black uppercase tracking-widest text-gray-600 flex items-center gap-1.5 mb-4'>
                                    <BarChart3 className='h-3.5 w-3.5 text-indigo-500' /> Balance History (last{' '}
                                    {Math.min(selectedUser.balanceHistory.length, 20)} readings)
                                </p>
                                <div className='flex items-end gap-1 h-16'>
                                    {selectedUser.balanceHistory.slice(-20).map((h, i, arr) => {
                                        const min = Math.min(...arr.map(x => x.balance));
                                        const max = Math.max(...arr.map(x => x.balance));
                                        const range = max - min || 1;
                                        const pct = ((h.balance - min) / range) * 100;
                                        const isLast = i === arr.length - 1;
                                        return (
                                            <div
                                                key={i}
                                                title={`${h.balance.toFixed(2)} @ ${new Date(h.ts * 1000).toLocaleTimeString()}`}
                                                className={`flex-1 rounded-t-sm transition-all ${isLast ? 'bg-blue-500' : 'bg-white/10'}`}
                                                style={{ height: `${Math.max(pct, 5)}%` }}
                                            />
                                        );
                                    })}
                                </div>
                                <div className='flex justify-between mt-2 text-[9px] font-mono text-gray-700'>
                                    <span>
                                        {new Date(
                                            selectedUser.balanceHistory.at(
                                                -Math.min(20, selectedUser.balanceHistory.length)
                                            )!.ts * 1000
                                        ).toLocaleTimeString()}
                                    </span>
                                    <span>
                                        {new Date(selectedUser.balanceHistory.at(-1)!.ts * 1000).toLocaleTimeString()}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Flag / Action Controls */}
                        <div className='bg-[#0a0a0a] border border-white/5 rounded-3xl p-5'>
                            <p className='text-[10px] font-black uppercase tracking-widest text-gray-600 flex items-center gap-1.5 mb-4'>
                                <Flag className='h-3.5 w-3.5 text-amber-500' /> Account Actions
                            </p>
                            <div className='grid grid-cols-2 gap-3'>
                                {[
                                    {
                                        flag: 'none',
                                        label: 'Clear Flag',
                                        icon: <ShieldOff className='h-4 w-4' />,
                                        color: 'text-gray-300 border-white/10 hover:bg-white/10',
                                    },
                                    {
                                        flag: 'whitelisted',
                                        label: 'Whitelist',
                                        icon: <UserCheck className='h-4 w-4' />,
                                        color: 'text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/10',
                                    },
                                    {
                                        flag: 'blacklisted',
                                        label: 'Blacklist',
                                        icon: <AlertTriangle className='h-4 w-4' />,
                                        color: 'text-amber-400 border-amber-500/25 hover:bg-amber-500/10',
                                    },
                                    {
                                        flag: 'blocked',
                                        label: 'Block User',
                                        icon: <UserX className='h-4 w-4' />,
                                        color: 'text-rose-400 border-rose-500/25 hover:bg-rose-500/10',
                                    },
                                ].map(a => (
                                    <button
                                        key={a.flag}
                                        onClick={() => setFlag(selectedUser.loginId, a.flag)}
                                        disabled={flagLoading || selectedUser.flag === a.flag}
                                        className={`flex items-center justify-center gap-2 py-2.5 rounded-2xl text-xs font-black border transition-all disabled:opacity-50 ${a.color} ${selectedUser.flag === a.flag ? 'ring-1 ring-current' : ''}`}
                                    >
                                        {a.icon} {a.label}
                                        {selectedUser.flag === a.flag && (
                                            <span className='text-[9px] opacity-60'>(current)</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
