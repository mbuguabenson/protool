'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AIFloatingScannerEngine, type TickData, type ConsensuSignal } from '@/lib/ai-floating-scanner';
import { TrendingUp, TrendingDown, Minimize2, Maximize2, X, Radar } from 'lucide-react';

interface AIFloatingScannerProps {
    recentDigits: number[];
    theme?: 'light' | 'dark';
    onMinimize?: () => void;
    isMinimized?: boolean;
}

export function AIFloatingScanner({
    recentDigits,
    theme = 'dark',
    onMinimize,
    isMinimized = false,
}: AIFloatingScannerProps) {
    const [consensus, setConsensus] = useState<ConsensuSignal | null>(null);
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        if (recentDigits.length >= 60) {
            const tickData: TickData[] = recentDigits.map((digit, idx) => ({
                digit,
                timestamp: idx,
            }));
            const newConsensus = AIFloatingScannerEngine.generateConsensus(tickData);
            setConsensus(newConsensus);
        }
    }, [recentDigits]);

    if (!isVisible || !consensus) {
        return null;
    }

    if (isMinimized) {
        return (
            <div
                className={`fixed bottom-6 right-6 p-4 rounded-full shadow-lg backdrop-blur-md cursor-pointer hover:scale-110 transition-transform ${
                    theme === 'dark'
                        ? 'bg-gradient-to-br from-purple-600/80 to-blue-600/80 border border-purple-500/50'
                        : 'bg-gradient-to-br from-purple-400 to-blue-400 border border-purple-300'
                }`}
                onClick={onMinimize}
            >
                <Radar className='w-6 h-6 text-white animate-pulse' />
            </div>
        );
    }

    const getSignalColor = () => {
        switch (consensus.overallSignal) {
            case 'BUY':
                return 'text-green-400 bg-green-500/10';
            case 'SELL':
                return 'text-red-400 bg-red-500/10';
            default:
                return 'text-yellow-400 bg-yellow-500/10';
        }
    };

    const getMarketHeatColor = () => {
        switch (consensus.marketHeat) {
            case 'EXTREME':
                return 'text-red-500';
            case 'HOT':
                return 'text-orange-500';
            case 'WARM':
                return 'text-yellow-500';
            default:
                return 'text-blue-500';
        }
    };

    const getStrategyColor = (strategy: string) => {
        const colors: Record<string, string> = {
            OVER_UNDER: 'bg-blue-500/20 text-blue-300',
            EVEN_ODD: 'bg-yellow-500/20 text-yellow-300',
            RISE_FALL: 'bg-purple-500/20 text-purple-300',
            DIFFERS: 'bg-red-500/20 text-red-300',
            MATCHES: 'bg-green-500/20 text-green-300',
            HIGH_LOW: 'bg-cyan-500/20 text-cyan-300',
        };
        return colors[strategy] || 'bg-gray-500/20 text-gray-300';
    };

    return (
        <div
            className={`fixed bottom-6 right-6 w-96 rounded-2xl shadow-2xl backdrop-blur-md border ${
                theme === 'dark'
                    ? 'bg-gradient-to-br from-slate-900/95 to-slate-950/95 border-purple-500/30'
                    : 'bg-white/95 border-gray-300'
            }`}
        >
            {/* Header */}
            <div
                className={`px-6 py-4 border-b ${theme === 'dark' ? 'border-slate-700/50' : 'border-gray-200'} flex items-center justify-between`}
            >
                <div className='flex items-center gap-2'>
                    <Radar className='w-5 h-5 text-purple-400 animate-spin' />
                    <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        AI Scanner
                    </h3>
                </div>
                <div className='flex gap-2'>
                    <button onClick={onMinimize} className={`p-1.5 rounded hover:bg-white/10 transition-colors`}>
                        <Minimize2 className='w-4 h-4 text-gray-400' />
                    </button>
                    <button
                        onClick={() => setIsVisible(false)}
                        className={`p-1.5 rounded hover:bg-white/10 transition-colors`}
                    >
                        <X className='w-4 h-4 text-gray-400' />
                    </button>
                </div>
            </div>

            {/* Main Signal */}
            <div className={`px-6 py-4 border-b ${theme === 'dark' ? 'border-slate-700/50' : 'border-gray-200'}`}>
                <div className={`p-4 rounded-lg ${getSignalColor()} border border-current/30`}>
                    <div className='flex items-center justify-between mb-2'>
                        <span className='text-sm font-semibold uppercase tracking-wide'>Overall Signal</span>
                        <span
                            className={`text-2xl font-bold ${consensus.overallSignal === 'BUY' ? 'text-green-400' : consensus.overallSignal === 'SELL' ? 'text-red-400' : 'text-yellow-400'}`}
                        >
                            {consensus.overallSignal}
                        </span>
                    </div>
                    <div className='grid grid-cols-3 gap-2 text-xs'>
                        <div>
                            <p className={`font-semibold ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                                Confidence
                            </p>
                            <p className='text-base font-bold'>{consensus.confidence.toFixed(0)}%</p>
                        </div>
                        <div>
                            <p className={`font-semibold ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                                Support
                            </p>
                            <p className='text-base font-bold'>{consensus.supportingStrategies}/6</p>
                        </div>
                        <div>
                            <p className={`font-semibold ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                                Heat
                            </p>
                            <p className={`text-base font-bold ${getMarketHeatColor()}`}>{consensus.marketHeat}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Strategy Details */}
            <div className={`px-6 py-4 border-b ${theme === 'dark' ? 'border-slate-700/50' : 'border-gray-200'}`}>
                <p
                    className={`text-xs font-semibold mb-3 uppercase ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                >
                    Strategy Analysis
                </p>
                <div className='space-y-2'>
                    {consensus.allStrategies.map(strategy => (
                        <div
                            key={strategy.strategy}
                            className={`px-3 py-2 rounded-lg ${getStrategyColor(strategy.strategy)} text-xs flex items-center justify-between`}
                        >
                            <span className='font-semibold'>{strategy.strategy.replace(/_/g, '/')}</span>
                            <span className='font-bold'>
                                {strategy.signal} ({strategy.confidence.toFixed(0)}%)
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Dominant Strategy */}
            <div
                className={`px-6 py-4 ${theme === 'dark' ? 'bg-gradient-to-r from-purple-900/30 to-blue-900/30' : 'bg-gradient-to-r from-purple-100 to-blue-100'}`}
            >
                <p className={`text-xs font-semibold mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    Strongest Signal
                </p>
                <div
                    className={`flex items-center gap-2 ${consensus.allStrategies[0].signal === 'BUY' ? 'text-green-400' : 'text-red-400'}`}
                >
                    {consensus.allStrategies[0].signal === 'BUY' ? (
                        <TrendingUp className='w-5 h-5' />
                    ) : (
                        <TrendingDown className='w-5 h-5' />
                    )}
                    <span className='font-bold'>{consensus.dominantStrategy}</span>
                    <span className='ml-auto font-bold'>{consensus.allStrategies[0].confidence.toFixed(0)}%</span>
                </div>
            </div>
        </div>
    );
}
