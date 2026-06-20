'use client';

import React from 'react';
import { ExternalLink, Lock } from 'lucide-react';

interface PlatformLauncherProps {
    title: string;
    description: string;
    platformUrl: string;
    isAuthenticated: boolean;
    icon: React.ReactNode;
    features: string[];
    theme?: 'light' | 'dark';
}

export function PlatformLauncher({
    title,
    description,
    platformUrl,
    isAuthenticated,
    icon,
    features,
    theme = 'dark',
}: PlatformLauncherProps) {
    const isDark = theme === 'dark';

    return (
        <div
            className={`rounded-2xl border p-8 flex flex-col gap-6 ${
                isDark ? 'bg-white/[0.03] border-white/10 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
            }`}
        >
            {/* Header */}
            <div className='flex items-center gap-4'>
                <div className={`p-4 rounded-2xl ${isDark ? 'bg-white/10 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                    {icon}
                </div>
                <div>
                    <h2 className={`text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {title}
                    </h2>
                    <p className={`text-sm mt-0.5 ${isDark ? 'text-white/50' : 'text-gray-500'}`}>{description}</p>
                </div>
            </div>

            {/* Features */}
            <ul className='space-y-2'>
                {features.map((f, i) => (
                    <li
                        key={i}
                        className={`flex items-start gap-2 text-sm ${isDark ? 'text-white/60' : 'text-gray-600'}`}
                    >
                        <span className='mt-0.5 text-emerald-400'>✓</span>
                        {f}
                    </li>
                ))}
            </ul>

            {/* Launch button */}
            {isAuthenticated ? (
                <a
                    href={platformUrl}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-sm shadow-lg hover:opacity-90 active:scale-95 transition-all w-fit'
                >
                    <ExternalLink className='h-4 w-4' />
                    Launch {title}
                </a>
            ) : (
                <div className={`flex items-center gap-2 text-sm ${isDark ? 'text-white/30' : 'text-gray-400'}`}>
                    <Lock className='h-4 w-4' />
                    Connect your Deriv account to launch {title}
                </div>
            )}
        </div>
    );
}
