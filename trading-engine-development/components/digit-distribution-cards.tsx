'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface DigitDistributionCardsProps {
    ticks: number[];
    theme?: 'light' | 'dark';
}

const DIGIT_COLORS: Record<number, { bg: string; text: string; light: string }> = {
    0: { bg: 'bg-red-600', text: 'text-red-400', light: 'bg-red-500/10' },
    1: { bg: 'bg-orange-600', text: 'text-orange-400', light: 'bg-orange-500/10' },
    2: { bg: 'bg-yellow-600', text: 'text-yellow-400', light: 'bg-yellow-500/10' },
    3: { bg: 'bg-lime-600', text: 'text-lime-400', light: 'bg-lime-500/10' },
    4: { bg: 'bg-green-600', text: 'text-green-400', light: 'bg-green-500/10' },
    5: { bg: 'bg-cyan-600', text: 'text-cyan-400', light: 'bg-cyan-500/10' },
    6: { bg: 'bg-blue-600', text: 'text-blue-400', light: 'bg-blue-500/10' },
    7: { bg: 'bg-indigo-600', text: 'text-indigo-400', light: 'bg-indigo-500/10' },
    8: { bg: 'bg-purple-600', text: 'text-purple-400', light: 'bg-purple-500/10' },
    9: { bg: 'bg-pink-600', text: 'text-pink-400', light: 'bg-pink-500/10' },
};

export function DigitDistributionCards({ ticks, theme = 'dark' }: DigitDistributionCardsProps) {
    const [distribution, setDistribution] = useState<Record<number, number>>({});
    const [lastDigits, setLastDigits] = useState<number[]>([]);

    useEffect(() => {
        if (ticks.length === 0) return;

        // Calculate distribution for last 60 ticks
        const last60 = ticks.slice(-60);
        const dist: Record<number, number> = {};

        for (let i = 0; i <= 9; i++) {
            dist[i] = last60.filter(t => t % 10 === i).length;
        }

        setDistribution(dist);

        // Get last 7 digits
        const last7 = ticks.slice(-7).map(t => t % 10);
        setLastDigits(last7);
    }, [ticks]);

    const totalCount = Object.values(distribution).reduce((a, b) => a + b, 0);

    return (
        <div className='space-y-4'>
            {/* Last 7 Digits Cards */}
            <div>
                <p className={`text-sm font-bold mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    Last 7 Digits
                </p>
                <div className='flex gap-2 overflow-x-auto pb-2'>
                    {lastDigits.reverse().map((digit, idx) => {
                        const colors = DIGIT_COLORS[digit];
                        return (
                            <div
                                key={idx}
                                className={`shrink-0 flex flex-col items-center justify-center w-16 h-16 rounded-lg border-2 ${
                                    theme === 'dark'
                                        ? `${colors.light} border-current`
                                        : `bg-white border-${colors.text}`
                                }`}
                            >
                                <p className={`text-3xl font-black ${colors.text}`}>{digit}</p>
                                <p className={`text-[10px] font-semibold opacity-70 ${colors.text}`}>#{7 - idx}</p>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Distribution Grid */}
            <div>
                <p className={`text-sm font-bold mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    Last 60 Ticks Distribution
                </p>
                <div className='grid grid-cols-5 gap-2'>
                    {Array.from({ length: 10 }).map((_, i) => {
                        const count = distribution[i] || 0;
                        const percentage = totalCount > 0 ? (count / totalCount) * 100 : 0;
                        const colors = DIGIT_COLORS[i];

                        return (
                            <div
                                key={i}
                                className={`p-3 rounded-lg border transition-all ${
                                    theme === 'dark'
                                        ? `${colors.light} border-current/30`
                                        : `bg-gray-50 border-gray-200`
                                }`}
                            >
                                <div className='text-center space-y-1'>
                                    <p className={`text-2xl font-black ${colors.text}`}>{i}</p>

                                    {/* Mini Bar Chart */}
                                    <div className='h-1 bg-current/10 rounded-full overflow-hidden mt-2 mb-1'>
                                        <div
                                            className={`h-full ${colors.bg} transition-all`}
                                            style={{ width: `${percentage}%` }}
                                        />
                                    </div>

                                    <p className={`text-xs font-bold ${colors.text}`}>
                                        {count} ({percentage.toFixed(0)}%)
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Summary Statistics */}
            <div
                className={`p-4 rounded-lg border grid grid-cols-3 gap-3 ${
                    theme === 'dark' ? 'bg-slate-800/30 border-slate-700/30' : 'bg-slate-100 border-slate-300'
                }`}
            >
                <div className='text-center'>
                    <p
                        className={`text-[10px] font-semibold uppercase ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}
                    >
                        Total
                    </p>
                    <p className={`text-lg font-bold mt-1 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        {totalCount}
                    </p>
                </div>

                <div className='text-center'>
                    <p
                        className={`text-[10px] font-semibold uppercase ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}
                    >
                        Most
                    </p>
                    <p
                        className={`text-lg font-bold mt-1 ${DIGIT_COLORS[Object.entries(distribution).sort(([, a], [, b]) => b - a)[0]?.[0] || 0].text}`}
                    >
                        {Object.entries(distribution).sort(([, a], [, b]) => b - a)[0]?.[0] || 'N/A'}
                    </p>
                </div>

                <div className='text-center'>
                    <p
                        className={`text-[10px] font-semibold uppercase ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}
                    >
                        Least
                    </p>
                    <p
                        className={`text-lg font-bold mt-1 ${DIGIT_COLORS[Object.entries(distribution).sort(([, a], [, b]) => a - b)[0]?.[0] || 0].text}`}
                    >
                        {Object.entries(distribution).sort(([, a], [, b]) => a - b)[0]?.[0] || 'N/A'}
                    </p>
                </div>
            </div>
        </div>
    );
}
