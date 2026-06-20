'use client';

import { useState } from 'react';

interface LastDigitsChartProps {
    digits: number[];
}

export function LastDigitsChart({ digits }: LastDigitsChartProps) {
    const [limit, setLimit] = useState<10 | 20 | 50>(50);

    const displayDigits = digits.slice(-limit);

    const digitColors: Record<number, string> = {
        0: 'bg-gradient-to-br from-pink-400 to-pink-500',
        1: 'bg-gradient-to-br from-indigo-500 to-indigo-600',
        2: 'bg-gradient-to-br from-cyan-400 to-cyan-500',
        3: 'bg-gradient-to-br from-fuchsia-400 to-fuchsia-500',
        4: 'bg-gradient-to-br from-teal-400 to-teal-500',
        5: 'bg-gradient-to-br from-blue-500 to-blue-600',
        6: 'bg-gradient-to-br from-rose-400 to-rose-500',
        7: 'bg-gradient-to-br from-violet-400 to-violet-500',
        8: 'bg-gradient-to-br from-yellow-400 to-amber-500',
        9: 'bg-gradient-to-br from-purple-500 to-purple-600',
    };

    return (
        <div className='w-full space-y-4'>
            {/* Premium Segmented Control Selector */}
            <div className='flex items-center justify-between pb-2 border-b border-white/[0.05]'>
                <span className='text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wider'>
                    Recent Digit Sequence
                </span>
                <div className='flex gap-1 p-0.5 bg-black/45 rounded-lg border border-white/[0.08]'>
                    {[10, 20, 50].map(val => (
                        <button
                            key={val}
                            onClick={() => setLimit(val as 10 | 20 | 50)}
                            className={`px-2.5 py-1 rounded-md text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all duration-200 ${
                                limit === val
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/35'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            {val} Ticks
                        </button>
                    ))}
                </div>
            </div>

            <div className='flex items-center justify-center gap-2 flex-wrap min-h-[90px]'>
                {displayDigits.map((digit, index) => (
                    <div
                        key={index}
                        className={`w-9 h-9 sm:w-11 sm:h-11 ${digitColors[digit]} rounded-lg flex items-center justify-center shadow-lg transition-all duration-300 hover:scale-115 hover:rotate-6 cursor-default border border-white/10`}
                    >
                        <span className='text-sm sm:text-base font-black text-white'>{digit}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
