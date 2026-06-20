'use client';

import { useMemo } from 'react';
import { type PowerSnapshot } from '@/lib/high-speed/power-analytics-engine';

interface DigitPowerVisualizerProps {
    snapshot: PowerSnapshot | null;
    theme?: string;
}

export function DigitPowerVisualizer({ snapshot, theme = 'dark' }: DigitPowerVisualizerProps) {
    const isDark = theme === 'dark';

    const powerBars = useMemo(() => {
        if (!snapshot) return null;
        return [
            { label: 'EVEN', power: snapshot.evenPower, color: 'bg-blue-500', glow: 'shadow-blue-500/50' },
            { label: 'ODD', power: snapshot.oddPower, color: 'bg-purple-500', glow: 'shadow-purple-500/50' },
            { label: 'UNDER', power: snapshot.underPower, color: 'bg-cyan-500', glow: 'shadow-cyan-500/50' },
            { label: 'OVER', power: snapshot.overPower, color: 'bg-orange-500', glow: 'shadow-orange-500/50' },
        ];
    }, [snapshot]);

    if (!snapshot) {
        return (
            <div className='p-4 flex items-center justify-center h-48 animate-pulse text-gray-500'>
                Waiting for market data...
            </div>
        );
    }

    return (
        <div className='space-y-6'>
            {/* Primary Power Bars */}
            <div className='grid grid-cols-2 lg:grid-cols-4 gap-4'>
                {powerBars?.map(bar => (
                    <div
                        key={bar.label}
                        className='p-3 rounded-xl bg-white/[0.03] border border-white/5 relative overflow-hidden transition-all hover:border-primary/20'
                    >
                        <div className='flex justify-between items-center mb-2'>
                            <span className='text-[10px] font-black uppercase tracking-widest text-slate-500'>
                                {bar.label}
                            </span>
                            <span className='text-sm font-black text-white'>{bar.power}%</span>
                        </div>
                        <div className='h-2 w-full bg-white/5 rounded-full overflow-hidden'>
                            <div
                                className={`h-full ${bar.color} transition-all duration-300 shadow-[0_0_10px_rgba(99,102,241,0.3)] rounded-full`}
                                style={{ width: `${bar.power}%` }}
                            />
                        </div>
                    </div>
                ))}
            </div>

            {/* Individual Digit Power */}
            <div className='p-4 rounded-xl bg-white/[0.02] border border-white/5'>
                <h4 className='text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4'>
                    Neural Power Distribution
                </h4>
                <div className='grid grid-cols-5 lg:grid-cols-10 gap-2'>
                    {snapshot.digitPowers.map((power, digit) => {
                        const isStrongest = digit === snapshot.strongestDigit;
                        const isWeakest = digit === snapshot.weakestDigit;

                        return (
                            <div key={digit} className='flex flex-col items-center gap-1'>
                                <div
                                    className={`
                  w-full aspect-square rounded-lg flex items-center justify-center text-xs font-bold transition-all duration-300
                  ${isDark ? 'bg-gray-800/50' : 'bg-gray-100'}
                  ${isStrongest ? 'ring-2 ring-green-500 bg-green-500/10 text-green-400' : ''}
                  ${isWeakest ? 'ring-1 ring-red-500/50 bg-red-500/5 text-red-400/70' : ''}
                `}
                                >
                                    {digit}
                                </div>
                                <div className='h-1 w-full bg-gray-800 rounded-full overflow-hidden'>
                                    <div
                                        className={`h-full transition-all duration-500 ${isStrongest ? 'bg-green-500' : 'bg-gray-500'}`}
                                        style={{ width: `${power * 2}%` }} // Scale for visibility
                                    />
                                </div>
                                <span className='text-[9px] font-mono text-gray-500'>{power}%</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Last digits visualizer - now shows actual last digit from snapshot */}
            <div className='flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide'>
                <span className='text-[10px] font-bold text-gray-500 whitespace-nowrap mr-2'>FEED:</span>
                <div
                    className={`
                    min-w-[28px] h-7 rounded flex items-center justify-center text-xs font-mono font-bold
                    ${isDark ? 'bg-blue-500 border border-blue-500/50 text-white' : 'bg-blue-500 text-white'}
                `}
                >
                    {snapshot.lastDigit}
                </div>
            </div>
        </div>
    );
}
