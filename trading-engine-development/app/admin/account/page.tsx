'use client';

import React from 'react';
import { User, Shield, Key, Mail, Phone, MapPin, Camera, BadgeCheck, LogOut } from 'lucide-react';

export default function AdminAccountPage() {
    return (
        <div className='p-8 max-w-4xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20'>
            <div className='flex flex-col items-center text-center space-y-4'>
                <div className='relative group cursor-pointer'>
                    <div className='w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-500 to-purple-600 p-0.5 shadow-2xl shadow-blue-500/20 group-hover:scale-105 transition-transform'>
                        <div className='w-full h-full rounded-[20px] bg-[#050505] flex items-center justify-center overflow-hidden border border-white/10 relative'>
                            <User className='h-10 w-10 text-white opacity-20' />
                            <div className='absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity'>
                                <Camera className='h-6 w-6 text-white' />
                            </div>
                        </div>
                    </div>
                    <div className='absolute -bottom-2 -right-2 w-8 h-8 bg-blue-600 rounded-xl border-4 border-[#050505] flex items-center justify-center shadow-lg'>
                        <BadgeCheck className='h-4 w-4 text-white' />
                    </div>
                </div>

                <div>
                    <h2 className='text-2xl font-black text-white tracking-tight'>Master RootAdmin</h2>
                    <p className='text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] mt-1'>
                        Superuser • Tier 1 Access
                    </p>
                </div>
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                <div className='bg-[#0a0a0a] border border-white/5 rounded-3xl p-6 space-y-6'>
                    <h3 className='text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2'>
                        <User className='h-4 w-4 text-blue-500' />
                        Profile Information
                    </h3>
                    <div className='space-y-4'>
                        {[
                            { label: 'Full Name', value: 'Root Admin', icon: User },
                            { label: 'Email Address', value: 'admin@analysistoolpro.com', icon: Mail },
                            { label: 'Phone Number', value: '+1 234 567 890', icon: Phone },
                            { label: 'Location', value: 'Global Operations', icon: MapPin },
                        ].map((item, i) => (
                            <div
                                key={i}
                                className='flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] border border-white/5'
                            >
                                <div className='flex items-center gap-3'>
                                    <item.icon className='h-4 w-4 text-gray-600' />
                                    <span className='text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-none'>
                                        {item.label}
                                    </span>
                                </div>
                                <span className='text-xs font-bold text-white'>{item.value}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className='bg-[#0a0a0a] border border-white/5 rounded-3xl p-6 space-y-6'>
                    <h3 className='text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2'>
                        <Shield className='h-4 w-4 text-purple-500' />
                        Security Privileges
                    </h3>
                    <div className='space-y-4'>
                        {[
                            { label: 'Authorized Trading', value: 'Enabled', status: 'emerald' },
                            { label: 'User Management', value: 'Full Access', status: 'emerald' },
                            { label: 'Financial Audit', value: 'Enabled', status: 'emerald' },
                            { label: 'System Control', value: 'Restricted', status: 'amber' },
                        ].map((item, i) => (
                            <div
                                key={i}
                                className='flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] border border-white/5'
                            >
                                <span className='text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-none pl-1'>
                                    {item.label}
                                </span>
                                <div className='flex items-center gap-2'>
                                    <span
                                        className={`w-1.5 h-1.5 rounded-full bg-${item.status}-500 shadow-[0_0_6px_rgba(0,0,0,0.5)]`}
                                    />
                                    <span className={`text-[10px] font-black uppercase text-${item.status}-500`}>
                                        {item.value}
                                    </span>
                                </div>
                            </div>
                        ))}
                        <button className='w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-blue-600/10 text-blue-400 border border-blue-500/20 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-blue-600/20 transition-all mt-4'>
                            <Key className='h-4 w-4' />
                            Change Password
                        </button>
                    </div>
                </div>
            </div>

            <button className='w-full py-4 rounded-[2rem] bg-rose-500/10 border border-rose-500/20 text-rose-500 font-black uppercase tracking-[0.3em] text-sm flex items-center justify-center gap-3 hover:bg-rose-500 hover:text-white transition-all group scale-95 hover:scale-100 shadow-xl hover:shadow-rose-500/20'>
                <LogOut className='h-5 w-5 group-hover:rotate-12 transition-transform' />
                Terminate Root Session
            </button>
        </div>
    );
}
