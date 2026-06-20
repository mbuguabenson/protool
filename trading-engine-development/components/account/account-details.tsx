'use client';

import { useState, useEffect, useRef } from 'react';
import { useDerivAPI } from '@/lib/deriv-api-context';
import {
    User,
    CreditCard,
    ShieldCheck,
    Camera,
    Edit2,
    Check,
    X,
    TrendingUp,
    Wallet,
    Copy,
    CheckCheck,
    Star,
    ArrowUpRight,
    Zap,
    BarChart3,
    RefreshCw,
    Eye,
    EyeOff,
    Key,
} from 'lucide-react';

interface AccountDetailsProps {
    activeLoginId: string | null;
    balance: { amount: number; currency: string } | null;
    accountType: string | null;
    accounts: any[];
}

function CopyBadge({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <button
            onClick={handleCopy}
            className='ml-1.5 p-1 text-white/30 hover:text-white/80 transition-all active:scale-90'
        >
            {copied ? <CheckCheck className='h-3.5 w-3.5 text-emerald-400' /> : <Copy className='h-3.5 w-3.5' />}
        </button>
    );
}

const ACCOUNT_GRADIENTS: Record<string, string> = {
    'Real-USD': 'from-[#059669] to-[#115e59]',
    'Real-EUR': 'from-[#2563eb] to-[#1e40af]',
    'Real-BTC': 'from-[#f59e0b] to-[#b45309]',
    'Real-ETH': 'from-[#7c3aed] to-[#5b21b6]',
    Demo: 'from-[#475569] to-[#1e293b]',
};

function getGradient(type: string, currency: string) {
    const key = `${type}-${currency}`;
    return ACCOUNT_GRADIENTS[key] || ACCOUNT_GRADIENTS[type] || 'from-gray-600 to-gray-800';
}

export default function AccountDetails({ activeLoginId, balance, accountType, accounts }: AccountDetailsProps) {
    const { isAuthorized } = useDerivAPI();
    const [username, setUsername] = useState('');
    const [isEditingUsername, setIsEditingUsername] = useState(false);
    const [tempUsername, setTempUsername] = useState('');
    const [profileImage, setProfileImage] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    // Per-account balances fetched from Deriv, keyed by loginId
    const [accountBalances, setAccountBalances] = useState<Record<string, number>>({});
    const [refreshing, setRefreshing] = useState(false);
    const [showBalance, setShowBalance] = useState(true);

    useEffect(() => {
        const savedUsername = localStorage.getItem(`dtool_username_${activeLoginId}`);
        if (savedUsername) setUsername(savedUsername);

        const savedImage = localStorage.getItem(`dtool_avatar_${activeLoginId}`);
        if (savedImage) setProfileImage(savedImage);
    }, [activeLoginId]);

    const saveUsername = () => {
        if (!tempUsername.trim()) return;
        localStorage.setItem(`dtool_username_${activeLoginId}`, tempUsername);
        setUsername(tempUsername);
        setIsEditingUsername(false);
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result as string;
            localStorage.setItem(`dtool_avatar_${activeLoginId}`, base64String);
            setProfileImage(base64String);
        };
        reader.readAsDataURL(file);
    };

    const fetchAllBalances = async () => {
        if (!isAuthorized || refreshing) return;
        setRefreshing(true);
        try {
            const results: Record<string, number> = {};
            // In a real scenario, we'd use 'account_list' or multiple balance calls
            // For now, we update the cache with what we know
            accounts.forEach(acc => {
                if (acc.id === activeLoginId && balance) {
                    results[acc.id] = balance.amount;
                }
            });
            setAccountBalances(prev => ({ ...prev, ...results }));
        } catch (err) {
            console.error('Failed to refresh balances', err);
        } finally {
            setTimeout(() => setRefreshing(false), 1000);
        }
    };

    const totalBalance = accounts.reduce((sum, acc) => {
        const bal =
            accountBalances[acc.id] ??
            (acc.id === activeLoginId ? (balance?.amount ?? acc.balance ?? 0) : (acc.balance ?? 0));
        const parsed = Number(bal);
        return sum + (isNaN(parsed) ? 0 : parsed);
    }, 0);

    const realAccounts = accounts.filter(a => a.type === 'Real');
    const demoAccounts = accounts.filter(a => a.type === 'Demo');
    const initials = (username || activeLoginId || 'U').slice(0, 2).toUpperCase();
    const currentGradient = getGradient(accountType || 'Demo', balance?.currency || 'USD');

    const formatCurrency = (amount: number | undefined | null, currency: string) => {
        if (!showBalance) return '••••••';
        const safeAmount = amount == null || isNaN(Number(amount)) ? 0 : Number(amount);
        return safeAmount.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    };

    return (
        <div className='space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000'>
            <input ref={fileRef} type='file' accept='image/*' className='hidden' onChange={handleImageUpload} />

            {/* ─── Hero Profile Card ─── */}
            <div
                className={`relative overflow-hidden rounded-[3rem] bg-gradient-to-br ${currentGradient} p-10 shadow-[0_30px_70px_rgba(0,0,0,0.4)] border border-white/10 ring-1 ring-white/10`}
            >
                {/* Premium Mesh Gradient Overlays */}
                <div className='absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.08)_0%,transparent_50%)] animate-pulse duration-[10s]' />
                <div className='absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(0,0,0,0.1)_0%,transparent_50%)]' />
                <div className='absolute top-0 right-0 w-96 h-96 bg-white/5 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/3' />

                <div className='relative flex flex-col lg:flex-row lg:items-center justify-between gap-10'>
                    <div className='flex items-center gap-8'>
                        {/* Avatar with Premium Border */}
                        <div
                            className='relative group cursor-pointer shrink-0'
                            onClick={() => fileRef.current?.click()}
                        >
                            <div className='w-28 h-28 rounded-[2.5rem] p-1 bg-gradient-to-tr from-white/30 to-transparent shadow-2xl'>
                                <div className='w-full h-full rounded-[2.2rem] overflow-hidden bg-black/20 flex items-center justify-center transition-all duration-700 group-hover:scale-95 group-hover:bg-black/10'>
                                    {profileImage ? (
                                        <img src={profileImage} alt='avatar' className='w-full h-full object-cover' />
                                    ) : (
                                        <span className='text-5xl font-black text-white drop-shadow-lg'>
                                            {initials}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className='absolute inset-2 rounded-[2.2rem] bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-500 flex items-center justify-center backdrop-blur-sm'>
                                <Camera className='h-7 w-7 text-white' />
                            </div>
                        </div>

                        {/* Info with Modern Type */}
                        <div className='flex-1 min-w-0'>
                            <div className='flex items-center gap-3 mb-2'>
                                {isEditingUsername ? (
                                    <div className='flex items-center gap-2'>
                                        <input
                                            value={tempUsername}
                                            onChange={e => setTempUsername(e.target.value)}
                                            autoFocus
                                            placeholder='Display Name'
                                            className='bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-5 py-3 text-lg font-black text-white placeholder:text-white/30 focus:outline-none focus:ring-4 focus:ring-white/10 w-64 transition-all'
                                            onKeyDown={e => e.key === 'Enter' && saveUsername()}
                                        />
                                        <button
                                            onClick={saveUsername}
                                            className='p-3 bg-white/20 rounded-2xl hover:bg-white/40 transition-all active:scale-90'
                                        >
                                            <Check className='h-6 w-6 text-white' />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => {
                                            setTempUsername(username);
                                            setIsEditingUsername(true);
                                        }}
                                        className='group/edit flex items-center gap-4 text-left'
                                    >
                                        <h2 className='text-4xl font-black text-white tracking-tighter leading-none hover:text-white/90 transition-colors uppercase'>
                                            {username || 'Nexus Trader'}
                                        </h2>
                                        <div className='p-2 rounded-xl bg-white/5 opacity-0 group-hover/edit:opacity-100 transition-all hover:bg-white/10'>
                                            <Edit2 className='h-4 w-4 text-white/50' />
                                        </div>
                                    </button>
                                )}
                            </div>
                            <div className='flex items-center gap-2'>
                                <div className='flex items-center gap-1.5 px-3 py-1 bg-black/10 backdrop-blur-lg rounded-lg border border-white/5 text-white/50 text-xs font-black tracking-widest uppercase'>
                                    ID: <span className='text-white/80'>{activeLoginId || '—'}</span>
                                    {activeLoginId && <CopyBadge text={activeLoginId} />}
                                </div>
                                <span className='flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 backdrop-blur-lg rounded-lg border border-emerald-500/20 text-emerald-400 text-[10px] font-black tracking-widest uppercase'>
                                    <ShieldCheck className='h-3.5 w-3.5' /> SECURE
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Dynamic Balance Component */}
                    <div className='lg:text-right bg-white/5 backdrop-blur-2xl rounded-[2.5rem] p-8 pb-9 border border-white/10 shadow-2xl min-w-[320px]'>
                        <div className='flex items-center justify-between lg:justify-end gap-3 mb-4'>
                            <p className='text-[10px] font-black uppercase tracking-[0.3em] text-white/40'>
                                Portfolio Value
                            </p>
                            <button
                                onClick={() => setShowBalance(!showBalance)}
                                className='p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/30 hover:text-white/80 transition-all'
                            >
                                {showBalance ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
                            </button>
                        </div>
                        <div className='flex flex-col lg:items-end'>
                            <div className='text-6xl font-black text-white tracking-tighter leading-none mb-2 tabular-nums'>
                                {balance
                                    ? formatCurrency(Number(balance.amount || 0), balance.currency || 'USD')
                                    : '0.00'}
                            </div>
                            <div className='px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/5 inline-flex items-center gap-2'>
                                <div
                                    className={`w-2 h-2 rounded-full ${accountType === 'Real' ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-amber-400 shadow-[0_0_8px_#fbbf24]'} animate-pulse`}
                                />
                                <span className='text-xs font-black text-white/80 uppercase tracking-widest'>
                                    {accountType || 'DEMO'} / {balance?.currency || 'USD'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── Premium Grid Cards ─── */}
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5'>
                {[
                    {
                        icon: <Wallet className='h-6 w-6' />,
                        label: 'TOTAL ACCOUNTS',
                        value: accounts.length,
                        color: 'text-blue-400',
                        gradient: 'from-blue-600/20 to-indigo-600/10',
                        glow: 'group-hover:shadow-blue-500/20',
                    },
                    {
                        icon: <TrendingUp className='h-6 w-6' />,
                        label: 'REAL CAPITAL',
                        value: realAccounts.length,
                        color: 'text-emerald-400',
                        gradient: 'from-emerald-600/20 to-teal-600/10',
                        glow: 'group-hover:shadow-emerald-500/20',
                    },
                    {
                        icon: <Zap className='h-6 w-6' />,
                        label: 'DEMO ENVIRONMENTS',
                        value: demoAccounts.length,
                        color: 'text-amber-400',
                        gradient: 'from-amber-600/20 to-orange-600/10',
                        glow: 'group-hover:shadow-amber-500/20',
                    },
                    {
                        icon: <BarChart3 className='h-6 w-6' />,
                        label: 'API BOT STATUS',
                        value: isAuthorized ? 'ACTIVE' : 'STANDBY',
                        color: isAuthorized ? 'text-purple-400' : 'text-gray-500',
                        gradient: 'from-purple-600/20 to-pink-600/10',
                        glow: 'group-hover:shadow-purple-500/20',
                    },
                ].map((s, i) => (
                    <div
                        key={i}
                        className={`relative overflow-hidden rounded-[2rem] border border-white/[0.08] bg-white/[0.03] backdrop-blur-3xl p-6 group transition-all duration-500 hover:-translate-y-2 hover:bg-white/[0.05] ${s.glow} hover:shadow-2xl`}
                    >
                        <div
                            className={`absolute inset-0 bg-gradient-to-br ${s.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-1000`}
                        />
                        <div className='relative z-10'>
                            <div className={`${s.color} mb-6 p-3 bg-white/5 rounded-2xl inline-block shadow-inner`}>
                                {s.icon}
                            </div>
                            <p className='text-[10px] font-black uppercase tracking-[0.25em] text-white/30 mb-2'>
                                {s.label}
                            </p>
                            <p className={`text-3xl font-black ${s.color} tracking-tighter`}>{s.value}</p>
                        </div>
                        <div className='absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-20 transition-opacity'>
                            {s.icon}
                        </div>
                    </div>
                ))}
            </div>

            {/* ─── Premium Linked Accounts Container ─── */}
            <div className='bg-white/[0.02] backdrop-blur-3xl border border-white/[0.08] rounded-[2.5rem] overflow-hidden shadow-2xl'>
                <div className='px-8 py-7 border-b border-white/[0.05] flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
                    <div>
                        <h3 className='text-xl font-black text-white uppercase tracking-tighter'>Asset Portfolio</h3>
                        <p className='text-[11px] text-white/30 font-bold uppercase tracking-widest mt-1'>
                            Cross-Asset Management Interface
                        </p>
                    </div>
                    <div className='flex items-center gap-3'>
                        <div className='flex items-center gap-2 bg-white/5 px-4 py-2 rounded-2xl border border-white/5'>
                            <span className='text-[10px] font-black text-white/40 tracking-widest'>ECOSYSTEM</span>
                            <span className='text-xs font-black text-white'>{accounts.length} ACCTS</span>
                        </div>
                        <button
                            onClick={fetchAllBalances}
                            disabled={refreshing}
                            className='h-10 px-4 flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-blue-400 hover:bg-blue-500/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-40 font-black text-[10px] tracking-widest'
                        >
                            <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
                            {refreshing ? 'SYNCING...' : 'REFRESH HUB'}
                        </button>
                    </div>
                </div>
                <div className='p-4 grid grid-cols-1 xl:grid-cols-2 gap-4'>
                    {accounts.length === 0 ? (
                        <div className='col-span-full py-20 flex flex-col items-center justify-center text-center'>
                            <div className='w-20 h-20 bg-white/5 rounded-[2rem] flex items-center justify-center mb-6'>
                                <CreditCard className='h-10 w-10 text-white/10' />
                            </div>
                            <h4 className='text-xl font-black text-white uppercase tracking-tight'>
                                Vault Entry Required
                            </h4>
                            <p className='text-gray-500 text-sm mt-2 max-w-sm font-medium'>
                                Authorize your Deriv endpoint to synchronize your global asset performance metadata.
                            </p>
                        </div>
                    ) : (
                        accounts.map(acc => {
                            const grad = getGradient(acc.type ?? 'Demo', acc.currency ?? 'USD');
                            const isActive = acc.id === activeLoginId;
                            return (
                                <div
                                    key={acc.id}
                                    className={`group relative flex items-center justify-between p-6 rounded-[2rem] border transition-all duration-500 ${
                                        isActive
                                            ? 'bg-white/[0.07] border-white/20 shadow-xl'
                                            : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/10'
                                    }`}
                                >
                                    <div className='flex items-center gap-5'>
                                        {/* Card Icon with Glow */}
                                        <div
                                            className={`relative w-14 h-14 rounded-2xl bg-gradient-to-br ${grad} flex items-center justify-center shadow-2xl transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6`}
                                        >
                                            <span className='text-xs font-black text-white drop-shadow-md'>
                                                {acc.currency?.slice(0, 3) || (acc.type === 'Demo' ? 'D' : 'R')}
                                            </span>
                                            {isActive && (
                                                <div className='absolute -inset-1 rounded-2xl bg-inherit blur-md opacity-40 animate-pulse' />
                                            )}
                                        </div>
                                        <div>
                                            <div className='flex items-center gap-2.5'>
                                                <span className='text-lg font-black text-white tracking-widest font-mono'>
                                                    {isActive ? acc.id : acc.id.substring(0, 4) + '****'}
                                                </span>
                                                <CopyBadge text={acc.id} />
                                            </div>
                                            <div className='flex items-center gap-2 mt-1'>
                                                <div
                                                    className={`px-2 py-0.5 rounded-lg text-[9px] font-black tracking-widest ${
                                                        acc.type === 'Demo'
                                                            ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                                            : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                                    }`}
                                                >
                                                    {isActive && (
                                                        <span className='inline-block w-1 h-1 rounded-full bg-current mr-1 animate-pulse' />
                                                    )}
                                                    {(acc.type || 'DEMO').toUpperCase()}
                                                </div>
                                                <span className='text-[10px] font-black text-white/30 tracking-widest'>
                                                    {acc.currency}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className='text-right'>
                                        {refreshing ? (
                                            <div className='w-24 h-6 bg-white/10 rounded-xl animate-pulse ml-auto' />
                                        ) : (
                                            <h4
                                                className={`text-2xl font-black tabular-nums transition-all ${isActive ? 'text-white scale-110' : 'text-white/80'}`}
                                            >
                                                {(() => {
                                                    const fetched = accountBalances[acc.id];
                                                    const rawBal =
                                                        fetched !== undefined
                                                            ? fetched
                                                            : acc.id === activeLoginId
                                                              ? (balance?.amount ?? acc.balance ?? 0)
                                                              : (acc.balance ?? 0);
                                                    const bal =
                                                        rawBal == null || isNaN(Number(rawBal)) ? 0 : Number(rawBal);
                                                    return formatCurrency(bal, acc.currency || 'USD');
                                                })()}
                                            </h4>
                                        )}
                                        <p className='text-[10px] font-black text-white/20 tracking-widest uppercase mt-0.5'>
                                            VAULT BALANCE
                                        </p>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Premium Integrated Footer */}
                {accounts.length > 0 && (
                    <div className='px-10 py-10 bg-white/5 border-t border-white/[0.05] flex flex-col md:flex-row justify-between items-center gap-6'>
                        <div className='flex items-center gap-4'>
                            <div className='p-4 bg-white/5 rounded-3xl border border-white/5'>
                                <BarChart3 className='h-6 w-6 text-blue-400' />
                            </div>
                            <div>
                                <span className='text-[10px] font-black text-white/30 uppercase tracking-[0.3em]'>
                                    Aggregate Liquidity
                                </span>
                                <h5 className='text-gray-400 text-[10px] font-bold uppercase tracking-widest mt-1'>
                                    Global ecosystem overview (Live)
                                </h5>
                            </div>
                        </div>
                        <div className='text-right group'>
                            <div className='flex items-baseline gap-4'>
                                <span className='text-3xl font-black text-white tracking-widest opacity-30'>$</span>
                                <span className='text-6xl font-black text-white tracking-tighter tabular-nums drop-shadow-[0_0_20px_rgba(255,255,255,0.1)] group-hover:drop-shadow-[0_0_30px_rgba(59,130,246,0.2)] transition-all'>
                                    {formatCurrency(totalBalance, 'USD')}
                                </span>
                            </div>
                            <div className='flex items-center justify-end gap-2 mt-2'>
                                <span className='px-3 py-1 bg-blue-500/20 rounded-lg text-blue-400 text-[9px] font-black tracking-[0.2em] border border-blue-500/20'>
                                    PORTFOLIO CUMULATIVE
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
