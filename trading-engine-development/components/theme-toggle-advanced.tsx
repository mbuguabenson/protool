'use client';

import React from 'react';
import { useTheme } from '@/lib/theme-provider-advanced';

export const ThemeToggleAdvanced: React.FC = () => {
    const { currentTheme, toggleTheme } = useTheme();

    return (
        <button
            onClick={toggleTheme}
            className='relative w-14 h-14 rounded-full glass-card hover:bg-blue-500/20 transition-all duration-300 flex items-center justify-center group'
            title={`Switch to ${currentTheme === 'dark' ? 'light' : 'dark'} mode`}
        >
            {/* Glow effect background */}
            <div className='absolute inset-0 rounded-full bg-blue-500/0 group-hover:bg-blue-500/10 transition-all duration-300' />

            {/* Sun Icon (Light Mode) */}
            <svg
                className={`absolute w-6 h-6 transition-all duration-500 ${
                    currentTheme === 'light' ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-125 rotate-180'
                }`}
                fill='currentColor'
                viewBox='0 0 24 24'
            >
                <circle cx='12' cy='12' r='5' className='text-amber-400' />
                <path
                    className='text-amber-400'
                    d='M12 1v6m0 6v6M4.22 4.22l4.24 4.24m5.08 5.08l4.24 4.24M1 12h6m6 0h6M4.22 19.78l4.24-4.24m5.08-5.08l4.24-4.24'
                    stroke='currentColor'
                    strokeWidth='2'
                    strokeLinecap='round'
                />
            </svg>

            {/* Moon Icon (Dark Mode) */}
            <svg
                className={`absolute w-6 h-6 transition-all duration-500 ${
                    currentTheme === 'dark' ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-125 -rotate-180'
                }`}
                fill='currentColor'
                viewBox='0 0 24 24'
            >
                <path className='text-blue-400' d='M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z' />
            </svg>

            {/* Glow pulse effect */}
            <div className='absolute inset-0 rounded-full border-2 border-blue-500/30 group-hover:border-blue-500/60 group-hover:animate-pulse transition-all duration-300' />
        </button>
    );
};
