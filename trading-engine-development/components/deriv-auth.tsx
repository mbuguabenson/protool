'use client';

import { useDerivAPI } from '@/lib/deriv-api-context';
import { OAUTH_CLIENT_ID, DERIV_REDIRECT_URL } from '@/lib/deriv-config';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LogIn, LogOut, UserPlus, ChevronDown, PlusCircle, ExternalLink, Globe, Sparkles } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

interface DerivAuthProps {
    theme?: 'light' | 'dark';
}

export function DerivAuth({ theme = 'dark' }: DerivAuthProps) {
    const {
        isLoggedIn,
        requestLogin,
        logout,
        balance,
        accountType,
        accountCode,
        accounts,
        switchAccount,
        activeLoginId,
    } = useDerivAPI();

    const [activeTab, setActiveTab] = useState<'Real' | 'Demo'>('Real');
    const [profileImage, setProfileImage] = useState<string>('');
    const [customUsername, setCustomUsername] = useState<string>('');
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [apiToken, setApiToken] = useState('');

    useEffect(() => {
        if (accountType) setActiveTab(accountType);
    }, [accountType]);

    useEffect(() => {
        if (activeLoginId) {
            const savedUsername = localStorage.getItem(`dtool_username_${activeLoginId}`);
            const savedImage = localStorage.getItem(`dtool_avatar_${activeLoginId}`);
            setCustomUsername(savedUsername || '');
            setProfileImage(savedImage || '');
        }
    }, [activeLoginId]);

    const createDerivAccount = () => {
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: OAUTH_CLIENT_ID,
            redirect_uri: DERIV_REDIRECT_URL,
            scope: 'trade account_manage',
        });

        const signUpUrl = `https://auth.deriv.com/oauth2/auth?${params.toString()}`;
        window.open(signUpUrl, '_blank', 'noopener,noreferrer');
    };

    const getCurrencyName = (currency: string) => {
        switch (currency.toUpperCase()) {
            case 'USD':
                return 'US Dollar';
            case 'USDT':
            case 'UST':
                return 'Tether TRC20';
            case 'BTC':
                return 'Bitcoin';
            case 'ETH':
                return 'Ethereum';
            case 'LTC':
                return 'Litecoin';
            case 'EUR':
                return 'Euro';
            case 'GBP':
                return 'British Pound';
            default:
                return currency;
        }
    };

    const getAccountIcon = (accId: string, accCurrency?: string, accType?: string, size: 'sm' | 'md' = 'sm') => {
        const s = size === 'sm' ? 'w-6 h-6' : 'w-10 h-10';
        const isDemo = accType === 'Demo' || accId.startsWith('VRTC');

        if (accId === activeLoginId && profileImage && size === 'sm') {
            return (
                <Avatar className={`${s} shrink-0 ring-1 ring-blue-500/30 shadow-lg`}>
                    <AvatarImage src={profileImage} className='object-cover' />
                    <AvatarFallback className='bg-slate-900 text-blue-400 text-[10px] font-black'>
                        {accCurrency?.charAt(0) || 'U'}
                    </AvatarFallback>
                </Avatar>
            );
        }

        if (isDemo) {
            return (
                <div
                    className={`${s} rounded-[0.8rem] bg-gradient-to-br from-amber-500/20 to-orange-600/10 text-amber-500 shadow-[inset_0_1px_rgba(255,255,255,0.2)] ring-1 ring-white/10 flex items-center justify-center text-[11px] font-black shrink-0 relative overflow-hidden backdrop-blur-xl group-hover/item:scale-110 transition-transform duration-500`}
                >
                    <div className='absolute inset-0 bg-white opacity-0 group-hover/item:opacity-20 mix-blend-overlay transition-opacity duration-500'></div>
                    <span className='relative z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]'>D</span>
                </div>
            );
        }

        const cur = accCurrency?.toUpperCase();
        if (cur === 'USD') {
            return (
                <div
                    className={`${s} rounded-[0.8rem] overflow-hidden flex items-center justify-center shrink-0 border border-white/10 shadow-[0_8px_16px_-6px_rgba(16,185,129,0.3)] bg-gradient-to-br from-[#1A1A1A] to-[#0A0A0A] group-hover/item:scale-110 transition-transform duration-500`}
                >
                    {/* Simple Flag Representation or USD icon */}
                    <Globe className='w-4 h-4 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]' />
                </div>
            );
        }

        if (cur === 'USDT' || cur === 'UST') {
            return (
                <div
                    className={`${s} rounded-[0.8rem] flex items-center justify-center bg-gradient-to-br from-[#26A17B]/90 to-[#1b7257] text-white shrink-0 shadow-[0_8px_16px_-6px_rgba(38,161,123,0.4)] ring-1 ring-white/10 group-hover/item:scale-110 transition-transform duration-500`}
                >
                    <span className='font-bold text-[13px] drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]'>₮</span>
                </div>
            );
        }

        if (cur === 'BTC') {
            return (
                <div
                    className={`${s} rounded-[0.8rem] flex items-center justify-center bg-gradient-to-br from-[#F7931A]/90 to-[#c87614] text-white shrink-0 shadow-[0_8px_16px_-6px_rgba(247,147,26,0.4)] ring-1 ring-white/10 group-hover/item:scale-110 transition-transform duration-500`}
                >
                    <span className='font-bold text-[13px] drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]'>₿</span>
                </div>
            );
        }

        return (
            <div
                className={`${s} rounded-[0.8rem] bg-gradient-to-br from-indigo-500/20 to-blue-600/10 text-indigo-400 shadow-[inset_0_1px_rgba(255,255,255,0.2)] ring-1 ring-white/10 flex items-center justify-center text-[10px] font-black shrink-0 group-hover/item:scale-110 transition-transform duration-500`}
            >
                {cur?.charAt(0) || 'R'}
            </div>
        );
    };

    const filteredAccounts = useMemo(() => {
        return accounts.filter(acc => {
            const isDemo = acc.type === 'Demo' || acc.id.startsWith('VRTC');
            return activeTab === 'Demo' ? isDemo : !isDemo;
        });
    }, [accounts, activeTab]);

    // Custom Animated Border Style
    const iridescentBorder =
        "before:absolute before:inset-0 before:-m-px before:rounded-[inherit] before:bg-gradient-to-br before:from-indigo-500/50 before:via-purple-500/20 before:to-emerald-500/50 before:p-px before:[mask-image:linear-gradient(#fff,#fff),linear-gradient(#fff,#fff)] before:[mask-composite:exclude] hover:before:opacity-100 before:opacity-50 before:transition-opacity content-['']";

    return (
        <>
            {!isLoggedIn && (
                <div className='flex items-center gap-3'>
                    <Button
                        onClick={createDerivAccount}
                        size='sm'
                        className='text-[10px] sm:text-xs h-9 px-4 rounded-xl font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all active:scale-95'
                    >
                        <UserPlus className='h-4 w-4 mr-2' /> Sign Up
                    </Button>
                    <Button
                        onClick={() => setShowLoginModal(true)}
                        size='sm'
                        className='text-[10px] sm:text-xs h-9 px-4 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_20px_rgba(79,70,229,0.3)] transition-all active:scale-95 border border-indigo-400/30'
                    >
                        <LogIn className='h-4 w-4 mr-2' /> Login
                    </Button>
                </div>
            )}

            {isLoggedIn && (
                <div className='flex items-center space-x-3'>
                    {accounts.length > 0 ? (
                        <Select value={activeLoginId || ''} onValueChange={switchAccount}>
                            <SelectTrigger
                                className={`relative flex items-center h-12 px-4 rounded-2xl border-0 bg-transparent min-w-[200px] shadow-2xl group transition-all overflow-visible ${iridescentBorder}`}
                            >
                                <div className='absolute inset-0 bg-black/40 backdrop-blur-md rounded-2xl -z-10 group-hover:bg-black/60 transition-colors'></div>
                                <div className='flex items-center gap-3 w-full'>
                                    <div className='relative'>
                                        {getAccountIcon(
                                            activeLoginId || '',
                                            balance?.currency,
                                            accountType || undefined
                                        )}
                                        <div className='absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#0a0f1e] shadow-[0_0_12px_rgba(16,185,129,0.8)] animate-pulse' />
                                    </div>
                                    <div className='flex flex-col items-start leading-[1.1] min-w-[90px] flex-1'>
                                        <span className='text-[8.5px] font-black text-white/50 uppercase tracking-[0.25em] mb-0.5 flex items-center gap-1'>
                                            {customUsername ||
                                                (activeLoginId?.startsWith('VR') ? 'DEMO HUB' : 'NEXUS VAULT')}
                                            {activeTab === 'Real' && <Sparkles className='h-2 w-2 text-indigo-400' />}
                                        </span>
                                        <div className='flex items-baseline gap-1.5 w-full'>
                                            <span className='text-[15px] font-black text-white tracking-tighter tabular-nums drop-shadow-md'>
                                                {(balance?.amount ?? 0).toLocaleString(undefined, {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                })}
                                            </span>
                                            <span className='text-[9px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-1 py-0.5 rounded leading-none'>
                                                {balance?.currency || 'USD'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className='w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors shrink-0'>
                                        <ChevronDown className='h-3.5 w-3.5 text-white/40 group-hover:text-white transition-colors' />
                                    </div>
                                </div>
                            </SelectTrigger>

                            <SelectContent
                                position='popper'
                                sideOffset={12}
                                className='w-[360px] p-0 rounded-[2rem] shadow-[0_40px_100px_rgba(0,0,0,0.8),0_0_40px_rgba(79,70,229,0.15)] border-0 overflow-hidden relative'
                            >
                                {/* Holographic Mesh Background Layer */}
                                <div className='absolute inset-0 bg-[#0A0A0A]/95 backdrop-blur-3xl -z-20'></div>
                                <div className='absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px] -z-10 mix-blend-screen pointer-events-none'></div>
                                <div className='absolute bottom-[-100px] left-[-50px] w-80 h-80 bg-rose-500/5 rounded-full blur-[100px] -z-10 mix-blend-screen pointer-events-none'></div>

                                {/* Iridescent Border Line at top */}
                                <div className='absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent'></div>

                                {/* Hub Header: Real/Demo Toggles */}
                                <div className='p-5 pb-3'>
                                    <Tabs
                                        value={activeTab}
                                        onValueChange={v => setActiveTab(v as any)}
                                        className='w-full'
                                    >
                                        <TabsList className='grid grid-cols-2 w-full bg-[#111111]/80 rounded-2xl h-12 p-1.5 ring-1 ring-white/5 shadow-inner'>
                                            <TabsTrigger
                                                value='Real'
                                                className='rounded-xl text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-[0_4px_20px_rgba(79,70,229,0.4)] text-white/40 transition-all duration-300'
                                            >
                                                Real Assets
                                            </TabsTrigger>
                                            <TabsTrigger
                                                value='Demo'
                                                className='rounded-xl text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white data-[state=active]:shadow-[0_4px_20px_rgba(245,158,11,0.4)] text-white/40 transition-all duration-300'
                                            >
                                                Demo Engine
                                            </TabsTrigger>
                                        </TabsList>
                                    </Tabs>
                                </div>

                                <div className='px-6 py-2 flex items-center justify-between'>
                                    <span className='text-[9px] font-black text-white/30 uppercase tracking-[0.2em] flex items-center gap-2'>
                                        <div className='w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse'></div>
                                        {activeTab} Networks
                                    </span>
                                </div>

                                {/* Account List */}
                                <div className='max-h-[320px] overflow-y-auto px-4 pb-4 styled-scrollbar'>
                                    {filteredAccounts.map(acc => (
                                        <SelectItem
                                            key={acc.id}
                                            value={acc.id}
                                            className='cursor-pointer mb-2 last:mb-0 rounded-2xl py-3.5 px-4 transition-all duration-300 border border-transparent focus:bg-white/[0.04] focus:border-white/10 group/item hover:bg-white/[0.04] hover:border-white/10 hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)]'
                                        >
                                            <div className='flex items-center justify-between w-full min-w-[280px]'>
                                                <div className='flex items-center gap-4'>
                                                    <div className='relative'>
                                                        {getAccountIcon(acc.id, acc.currency, acc.type, 'md')}
                                                        {acc.id === activeLoginId && (
                                                            <div className='absolute -inset-1 rounded-[1rem] ring-2 ring-indigo-500/50 opacity-0 group-hover/item:opacity-100 transition-opacity'></div>
                                                        )}
                                                    </div>
                                                    <div className='flex flex-col text-left leading-tight'>
                                                        <span
                                                            className={`text-sm font-black leading-none mb-1.5 tracking-tight transition-colors duration-300 ${acc.id === activeLoginId ? 'text-indigo-400' : 'text-white group-hover/item:text-white/90'}`}
                                                        >
                                                            {getCurrencyName(acc.currency)}
                                                        </span>
                                                        <div className='flex items-center gap-2'>
                                                            <span
                                                                className={`text-[8px] font-black tracking-widest uppercase px-1.5 py-0.5 rounded-[0.25rem] ${
                                                                    acc.type === 'Demo' || acc.id.startsWith('VRTC')
                                                                        ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                                                        : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                                                }`}
                                                            >
                                                                {acc.type === 'Demo' || acc.id.startsWith('VRTC')
                                                                    ? 'DEMO'
                                                                    : 'REAL'}
                                                            </span>
                                                            <span className='text-[10px] font-bold text-white/30 font-mono tracking-tighter uppercase'>
                                                                {acc.id}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className='flex flex-col items-end leading-tight ml-4'>
                                                    <span
                                                        className={`text-sm font-black tracking-tighter tabular-nums drop-shadow-md ${acc.id === activeLoginId ? 'text-white' : 'text-white/70'}`}
                                                    >
                                                        {acc.balance.toLocaleString(undefined, {
                                                            minimumFractionDigits: acc.currency === 'BTC' ? 8 : 2,
                                                            maximumFractionDigits: acc.currency === 'BTC' ? 8 : 2,
                                                        })}
                                                    </span>
                                                    <span className='text-[9px] font-black uppercase tracking-widest text-white/30 mt-1'>
                                                        {acc.currency}
                                                    </span>
                                                </div>
                                            </div>
                                        </SelectItem>
                                    ))}

                                    {filteredAccounts.length === 0 && (
                                        <div className='px-6 py-12 text-center flex flex-col items-center gap-4 bg-white/[0.01] rounded-2xl border border-dashed border-white/10 mt-2'>
                                            <div className='w-12 h-12 rounded-full border border-white/5 bg-white/[0.02] flex items-center justify-center'>
                                                <PlusCircle className='h-5 w-5 text-white/20' />
                                            </div>
                                            <div>
                                                <p className='text-[11px] font-black text-white/40 uppercase tracking-widest'>
                                                    No {activeTab} Vaults Found
                                                </p>
                                                <p className='text-[9px] font-bold text-white/20 mt-1'>
                                                    Open a new account to trade
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Hub Footer */}
                                <div className='relative bg-[#111111] p-5 pt-4 before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent z-10'>
                                    <div className='flex flex-col gap-5'>
                                        <div className='flex items-center justify-between group/link cursor-pointer pl-1'>
                                            <span className='text-[10px] font-bold text-white/40 leading-[1.4] transition-colors group-hover/link:text-white/60'>
                                                Looking for CFD accounts? <br />
                                                <span className='text-indigo-400 font-black flex items-center gap-1 mt-0.5'>
                                                    Enter Trader's Hub{' '}
                                                    <ExternalLink className='h-2.5 w-2.5 opacity-0 group-hover/link:opacity-100 transition-opacity -translate-x-2 group-hover/link:translate-x-0' />
                                                </span>
                                            </span>
                                        </div>

                                        <Button className='w-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 hover:border-white/10 rounded-xl py-5 text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-[inset_0_1px_rgba(255,255,255,0.05)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.5)]'>
                                            Manage Vaults
                                        </Button>
                                    </div>
                                </div>
                            </SelectContent>
                        </Select>
                    ) : (
                        <div
                            className={`relative flex items-center h-12 px-5 min-w-[200px] rounded-2xl border-0 overflow-hidden ${iridescentBorder}`}
                        >
                            <div className='absolute inset-0 bg-black/40 backdrop-blur-md rounded-2xl -z-10'></div>
                            <span className='text-[11px] font-black text-white/40 uppercase tracking-widest animate-pulse w-full text-center'>
                                Syncing Matrix...
                            </span>
                        </div>
                    )}

                    <Button
                        onClick={logout}
                        variant='ghost'
                        size='icon'
                        className={`relative h-12 w-12 rounded-2xl border-0 group transition-all duration-300 overflow-hidden ${iridescentBorder}`}
                        title='Secure Logout'
                    >
                        <div className='absolute inset-0 bg-black/40 backdrop-blur-md rounded-2xl -z-10 group-hover:bg-rose-500/10 transition-colors'></div>
                        <LogOut className='h-5 w-5 text-white/40 group-hover:text-rose-400 transition-colors drop-shadow-md' />
                    </Button>
                </div>
            )}

            {/* Login Modal */}
            <Dialog open={showLoginModal} onOpenChange={setShowLoginModal}>
                <DialogContent
                    className={`${theme === 'dark' ? 'bg-slate-950 border-slate-800' : 'bg-white'} max-w-md`}
                >
                    <DialogHeader>
                        <DialogTitle className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                            Connect to Deriv
                        </DialogTitle>
                        <DialogDescription className={theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}>
                            Choose how you want to login to your Deriv account
                        </DialogDescription>
                    </DialogHeader>

                    <div className='space-y-4 py-6'>
                        {/* OAuth 2.0 Login */}
                        <Button
                            onClick={() => {
                                requestLogin();
                                setShowLoginModal(false);
                            }}
                            className='w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold py-6 rounded-lg transition-all'
                        >
                            <Globe className='w-4 h-4 mr-2' />
                            Login with OAuth 2.0
                        </Button>

                        <div
                            className={`relative flex items-center gap-3 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'}`}
                        >
                            <div className={`flex-1 h-px ${theme === 'dark' ? 'bg-slate-700' : 'bg-gray-300'}`}></div>
                            <span className='text-xs font-semibold'>OR</span>
                            <div className={`flex-1 h-px ${theme === 'dark' ? 'bg-slate-700' : 'bg-gray-300'}`}></div>
                        </div>

                        {/* API Token Login */}
                        <div className='space-y-3'>
                            <Input
                                type='password'
                                placeholder='Enter your API Token'
                                value={apiToken}
                                onChange={e => setApiToken(e.target.value)}
                                className={`${
                                    theme === 'dark'
                                        ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500'
                                        : 'bg-gray-100 border-gray-300 text-gray-900'
                                } rounded-lg font-mono text-sm`}
                            />
                            <Button
                                onClick={() => {
                                    if (apiToken.trim()) {
                                        // Call API token login function
                                        console.log('[v0] API Token Login:', apiToken);
                                        setApiToken('');
                                        setShowLoginModal(false);
                                    }
                                }}
                                disabled={!apiToken.trim()}
                                className={`w-full py-6 rounded-lg font-bold transition-all ${
                                    apiToken.trim()
                                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                        : theme === 'dark'
                                          ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                }`}
                            >
                                <Sparkles className='w-4 h-4 mr-2' />
                                Login with API Token
                            </Button>
                            <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                                Get your API token from{' '}
                                <a
                                    href='https://app.deriv.com/settings/api-token'
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    className='text-blue-500 hover:text-blue-400 font-semibold'
                                >
                                    Deriv Settings
                                </a>
                            </p>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant='outline' onClick={() => setShowLoginModal(false)} className='w-full'>
                            Cancel
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
