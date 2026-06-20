'use client';

interface DigitDistributionProps {
    frequencies: Record<number, { count: number; percentage: number }>;
    currentDigit: number | null;
    theme: 'light' | 'dark';
    watchedDigits?: number[];
}

export function DigitDistribution({ frequencies, currentDigit, theme, watchedDigits = [] }: DigitDistributionProps) {
    // Split digits into two rows: 0-4 and 5-9
    const row1Digits = [0, 1, 2, 3, 4];
    const row2Digits = [5, 6, 7, 8, 9];

    // Calculate frequency rankings for color coding
    const sortedByFrequency = Object.entries(frequencies)
        .map(([digit, data]) => ({ digit: Number(digit), ...data }))
        .sort((a, b) => b.percentage - a.percentage);

    const getFrequencyColor = (digit: number) => {
        const rank = sortedByFrequency.findIndex(item => item.digit === digit);
        if (rank === 0) return '#22c55e'; // Green - most appearing
        if (rank === 1) return '#eab308'; // Yellow - 2nd most
        if (rank === sortedByFrequency.length - 1) return '#ef4444'; // Red - least appearing
        return '#3b82f6'; // Blue - others
    };

    const renderDigitCircle = (digit: number) => {
        const freq = frequencies[digit] || { count: 0, percentage: 0 };
        const isCurrentDigit = currentDigit === digit;

        // SVG Parameters for the circular progress
        const size = 64;
        const strokeWidth = 5; // Increased stroke width
        const center = size / 2;
        const radius = (size - strokeWidth) / 2;
        const circumference = 2 * Math.PI * radius;

        // Calculate arc length for bottom-centered display (180 degrees max)
        const maxArcLength = circumference / 2; // Half circle
        const arcLength = (freq.percentage / 100) * maxArcLength;

        const ringColor = getFrequencyColor(digit);

        return (
            <div key={digit} className='relative flex flex-col items-center gap-2 group'>
                <div
                    className={`relative flex items-center justify-center transition-all duration-500 ${
                        isCurrentDigit ? 'scale-110' : 'scale-100'
                    }`}
                >
                    {/* Circular Progress Ring */}
                    <svg width={size} height={size} className='transform rotate-0'>
                        {/* Background Track - Full Circle */}
                        <circle
                            cx={center}
                            cy={center}
                            r={radius}
                            fill='none'
                            stroke={theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}
                            strokeWidth={strokeWidth}
                        />
                        {/* Progress Stroke - Bottom Arc Only */}
                        <circle
                            cx={center}
                            cy={center}
                            r={radius}
                            fill='none'
                            stroke={isCurrentDigit ? '#f97316' : ringColor}
                            strokeWidth={strokeWidth}
                            strokeDasharray={`${arcLength} ${circumference}`}
                            strokeDashoffset={-circumference * 0.25}
                            strokeLinecap='round'
                            className='transition-all duration-1000 ease-out'
                            style={{
                                filter: isCurrentDigit ? 'drop-shadow(0 0 6px rgba(249,115,22,0.6))' : 'none',
                            }}
                        />
                    </svg>

                    {/* Centered Content - Digit and Percentage */}
                    <div className='absolute inset-0 flex flex-col items-center justify-center gap-0.5'>
                        <span
                            className={`text-xl font-black transition-all duration-300 leading-none ${
                                isCurrentDigit
                                    ? theme === 'dark'
                                        ? 'text-orange-400 scale-110'
                                        : 'text-orange-600 scale-110'
                                    : theme === 'dark'
                                      ? 'text-slate-300'
                                      : 'text-slate-700'
                            }`}
                        >
                            {digit}
                        </span>
                        <span
                            className={`text-[10px] font-bold transition-all duration-300 ${
                                isCurrentDigit
                                    ? theme === 'dark'
                                        ? 'text-orange-400'
                                        : 'text-orange-600'
                                    : theme === 'dark'
                                      ? 'text-slate-400'
                                      : 'text-slate-500'
                            }`}
                        >
                            {freq.percentage.toFixed(1)}%
                        </span>
                    </div>

                    {/* Live Animation Pulsed Ring */}
                    {isCurrentDigit && (
                        <div className='absolute inset-0 border-2 border-orange-500 rounded-full animate-ping opacity-20' />
                    )}

                    {/* Watched Digit Highlight */}
                    {watchedDigits.includes(digit) && (
                        <div className='absolute inset-0 border-2 border-amber-400 rounded-full shadow-[0_0_10px_rgba(251,191,36,0.5)]' />
                    )}
                </div>

                {/* Count Label Below */}
                <div className='text-center'>
                    <div
                        className={`text-[8px] font-mono opacity-40 ${
                            isCurrentDigit ? 'text-orange-400' : theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
                        }`}
                    >
                        n={freq.count}
                    </div>
                </div>

                {/* Floating Indicator */}
                {isCurrentDigit && (
                    <div className='absolute -top-3 left-1/2 -translate-x-1/2 pointer-events-none'>
                        <span className='text-[7px] font-black bg-orange-500 text-black px-1 rounded-sm uppercase tracking-tighter animate-bounce block'>
                            Now
                        </span>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className='w-full max-w-4xl mx-auto py-2'>
            <div className='grid grid-cols-5 md:grid-cols-10 gap-2 sm:gap-3 justify-items-center'>
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(renderDigitCircle)}
            </div>
        </div>
    );
}
