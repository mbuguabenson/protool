'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Lock, User, ArrowRight, Loader2 } from 'lucide-react';

export default function AdminLoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            const data = await res.json();

            if (res.ok) {
                router.push('/admin');
            } else {
                setError(data.error || 'Login failed');
            }
        } catch (err) {
            setError('Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className='min-h-screen bg-[#050505] flex items-center justify-center p-6 relative overflow-hidden'>
            {/* Background Glows */}
            <div className='absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] -z-10' />
            <div className='absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] -z-10' />

            <div className='w-full max-w-md animate-in fade-in zoom-in-95 duration-700'>
                <div className='bg-[#0a0a0a] border border-white/5 rounded-[2.5rem] p-10 backdrop-blur-3xl relative overflow-hidden'>
                    {/* Glass Pattern */}
                    <div className='absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none' />

                    <div className='text-center mb-10 relative z-10'>
                        <div className='w-20 h-20 bg-blue-600/20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-blue-500/20 rotate-3 group-hover:rotate-6 transition-transform'>
                            <Shield className='h-10 w-10 text-blue-500' />
                        </div>
                        <h1 className='text-3xl font-black text-white tracking-tight mb-2 uppercase'>
                            analysistoolpro
                        </h1>
                        <p className='text-xs text-slate-500 font-bold tracking-[0.2em] uppercase'>
                            Administrative Access
                        </p>
                    </div>

                    <form onSubmit={handleLogin} className='space-y-6 relative z-10'>
                        <div className='space-y-2'>
                            <label className='text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1'>
                                Username
                            </label>
                            <div className='relative group'>
                                <User className='absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600 group-focus-within:text-blue-500 transition-colors' />
                                <input
                                    type='text'
                                    value={username}
                                    onChange={e => setUsername(e.target.value)}
                                    placeholder='Enter username'
                                    className='w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-slate-700 focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.05] transition-all font-medium'
                                    required
                                />
                            </div>
                        </div>

                        <div className='space-y-2'>
                            <label className='text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1'>
                                Password
                            </label>
                            <div className='relative group'>
                                <Lock className='absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600 group-focus-within:text-blue-500 transition-colors' />
                                <input
                                    type='password'
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder='••••••••'
                                    className='w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-slate-700 focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.05] transition-all font-medium'
                                    required
                                />
                            </div>
                        </div>

                        {error && (
                            <div className='bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[11px] font-bold py-3 px-4 rounded-xl text-center animate-shake'>
                                {error}
                            </div>
                        )}

                        <button
                            type='submit'
                            disabled={loading}
                            className='w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white py-4 rounded-2xl font-black shadow-xl shadow-blue-500/20 hover:shadow-blue-500/40 transition-all flex items-center justify-center gap-2 group active:scale-[0.98] disabled:opacity-50'
                        >
                            {loading ? (
                                <Loader2 className='h-5 w-5 animate-spin' />
                            ) : (
                                <>
                                    LOGIN SYSTEM{' '}
                                    <ArrowRight className='h-4 w-4 group-hover:translate-x-1 transition-transform' />
                                </>
                            )}
                        </button>
                    </form>

                    <div className='mt-10 text-center'>
                        <p className='text-[10px] text-slate-600 font-medium'>
                            © 2026 ANALYSIS TOOL PRO SECURED ACCESS
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
