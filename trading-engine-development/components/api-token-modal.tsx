'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Key, ExternalLink, LogIn, Clock, ShieldCheck, Eye, EyeOff, Sparkles } from 'lucide-react';

interface ApiTokenModalProps {
    open: boolean;
    onSubmit: (token: string) => void;
    onOAuthLogin?: () => void;
    theme?: 'light' | 'dark';
}

export function ApiTokenModal({
    open,
    onSubmit,
    onOAuthLogin,
    theme = 'dark',
}: ApiTokenModalProps) {
    const [tokenInput, setTokenInput] = useState('');
    const [showToken, setShowToken] = useState(false);

    const handleSubmit = () => {
        if (tokenInput.trim().length < 10) {
            alert('Please enter a valid API token (at least 10 characters)');
            return;
        }
        onSubmit(tokenInput.trim());
    };

    const handleOAuthClick = () => {
        console.log('[v0] OAuth login button clicked');
        if (typeof window !== 'undefined' && window.location.hostname.includes('vusercontent.net')) {
            alert(
                "OAuth login is not available in v0's preview environment due to Content Security Policy restrictions.\n\nTo use OAuth:\n1. Deploy this app to your own server\n2. Or use the API Token method below with a token from Deriv\n\nFor development, please enter your Deriv API token manually."
            );
            return;
        }

        if (onOAuthLogin) {
            try {
                onOAuthLogin();
            } catch (error) {
                console.error('[v0] OAuth login error:', error);
                alert(`OAuth login failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        } else {
            console.warn('[v0] onOAuthLogin callback not provided');
        }
    };

    // Legacy OAuth option removed — modern OAuth enforced via `onOAuthLogin`

    const isDark = theme === 'dark';

    return (
        <Dialog open={open} onOpenChange={() => {}}>
            <DialogContent
                className={`sm:max-w-md border rounded-[2rem] overflow-hidden shadow-2xl backdrop-blur-3xl transition-all duration-300 ${
                    isDark
                        ? 'bg-slate-950/80 border-white/10 text-white shadow-[0_0_50px_rgba(99,102,241,0.15)]'
                        : 'bg-white/95 border-slate-200 text-slate-900 shadow-xl'
                }`}
                onPointerDownOutside={e => e.preventDefault()}
                onEscapeKeyDown={e => e.preventDefault()}
            >
                {/* Glow overlay for dark theme */}
                {isDark && (
                    <div className='absolute -top-32 -left-32 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px] pointer-events-none -z-10' />
                )}

                <DialogHeader className='relative z-10'>
                    <DialogTitle
                        className={`text-xl font-black flex items-center gap-2 tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}
                    >
                        <div
                            className={`p-2 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}
                        >
                            <LogIn className='w-5 h-5' />
                        </div>
                        Connect to Deriv
                    </DialogTitle>
                    <DialogDescription
                        className={`text-xs mt-1 font-medium leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
                    >
                        Access automated signals, advanced digit frequency maps, and pro bot configurations.
                    </DialogDescription>
                </DialogHeader>

                <div className='space-y-4 py-2 relative z-10'>
                    {/* Primary Recommended Option: Modern OAuth */}
                    <div
                        className={`p-5 rounded-2xl border transition-all duration-300 hover:shadow-lg ${
                            isDark
                                ? 'bg-emerald-500/[0.03] border-emerald-500/20 hover:border-emerald-500/35'
                                : 'bg-emerald-50/50 border-emerald-100 hover:border-emerald-200'
                        }`}
                    >
                        <div className='flex items-center justify-between mb-2'>
                            <span
                                className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}
                            >
                                <ShieldCheck className='w-3.5 h-3.5' /> Recommended
                            </span>
                            <span
                                className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                    isDark ? 'bg-emerald-500/25 text-emerald-300' : 'bg-emerald-100 text-emerald-800'
                                }`}
                            >
                                Auto
                            </span>
                        </div>
                        <h3 className={`font-bold text-sm tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            Secure Deriv Login
                        </h3>
                        <p
                            className={`text-xs mt-1 mb-4 leading-normal ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
                        >
                            Fast, secure single-sign-on directly through the official Deriv OAuth portal. No token
                            handling needed.
                        </p>
                        <Button
                            onClick={handleOAuthClick}
                            className={`w-full h-11 rounded-xl font-bold uppercase tracking-wider text-xs transition-all active:scale-98 shadow-md flex items-center justify-center gap-2 ${
                                isDark
                                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-900/20'
                                    : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white'
                            }`}
                        >
                            <LogIn className='w-4 h-4' />
                            Sign in with Deriv
                        </Button>
                    </div>

                    {/* Legacy OAuth option removed — modern OAuth enforced */}

                    {/* Divider */}
                    <div className='flex items-center gap-3 py-1'>
                        <div className={`flex-1 h-[1px] ${isDark ? 'bg-white/5' : 'bg-slate-200'}`} />
                        <span
                            className={`text-[10px] font-black tracking-widest ${isDark ? 'text-slate-600' : 'text-slate-400'}`}
                        >
                            OR
                        </span>
                        <div className={`flex-1 h-[1px] ${isDark ? 'bg-white/5' : 'bg-slate-200'}`} />
                    </div>

                    {/* Option 3: Manual API Token Entry */}
                    <div className='space-y-4'>
                        <div className='space-y-2'>
                            <Label
                                htmlFor='api-token'
                                className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
                            >
                                <Key className='w-3.5 h-3.5 text-indigo-400' /> Deriv API Token (Manual)
                            </Label>
                            <div className='relative'>
                                <Input
                                    id='api-token'
                                    type={showToken ? 'text' : 'password'}
                                    placeholder='Enter your Deriv API token...'
                                    value={tokenInput}
                                    onChange={e => setTokenInput(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && tokenInput.trim().length >= 10) handleSubmit();
                                    }}
                                    className={`h-11 rounded-xl pl-4 pr-10 border transition-all text-xs font-mono tracking-wide ${
                                        isDark
                                            ? 'bg-slate-900/60 border-white/5 text-white placeholder:text-slate-600 focus:border-indigo-500/50 focus:ring-0 focus:ring-offset-0'
                                            : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-0 focus:ring-offset-0'
                                    }`}
                                />
                                <button
                                    type='button'
                                    onClick={() => setShowToken(!showToken)}
                                    className='absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors'
                                >
                                    {showToken ? <EyeOff className='w-4 h-4' /> : <Eye className='w-4 h-4' />}
                                </button>
                            </div>
                        </div>

                        {/* Micro Instruction Card */}
                        <div
                            className={`p-4 rounded-2xl border ${
                                isDark ? 'bg-amber-500/[0.02] border-amber-500/10' : 'bg-amber-50/30 border-amber-100'
                            }`}
                        >
                            <span
                                className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1 mb-1.5 ${isDark ? 'text-amber-400/80' : 'text-amber-700'}`}
                            >
                                <Sparkles className='w-3.5 h-3.5' /> Token Generation
                            </span>
                            <ol
                                className={`list-decimal list-inside space-y-1 text-[11px] leading-normal font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
                            >
                                <li>Log in to the official Deriv portal</li>
                                <li>Navigate to Account Settings → API Tokens</li>
                                <li>
                                    Generate a token with{' '}
                                    <span className={isDark ? 'text-white' : 'text-slate-800'}>"Trade"</span>{' '}
                                    permissions
                                </li>
                            </ol>
                            <a
                                href='https://app.deriv.com/account/api-token'
                                target='_blank'
                                rel='noopener noreferrer'
                                className={`inline-flex items-center gap-1 mt-2.5 text-[11px] font-black uppercase tracking-wider transition-colors ${
                                    isDark
                                        ? 'text-amber-400 hover:text-amber-300'
                                        : 'text-amber-600 hover:text-amber-700'
                                }`}
                            >
                                Go to Deriv Settings <ExternalLink className='w-3 h-3' />
                            </a>
                        </div>
                    </div>
                </div>

                <div className='flex justify-end gap-2 relative z-10 pt-2 border-t border-white/5'>
                    <Button
                        onClick={handleSubmit}
                        className={`h-11 px-6 rounded-xl font-bold uppercase tracking-wider text-xs transition-all active:scale-98 shadow-lg ${
                            tokenInput.trim().length >= 10
                                ? isDark
                                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-900/20'
                                    : 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-indigo-500/10'
                                : 'bg-white/5 text-white/30 border border-white/5 cursor-not-allowed'
                        }`}
                        disabled={tokenInput.trim().length < 10}
                    >
                        Connect Vault
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
