'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TradingEngine, StrategySignal } from '@/lib/trading-engine';
import { SignalGenerator } from '@/lib/signal-generator';
import { AlertCircle, TrendingUp, Target, Zap, Eye, EyeOff } from 'lucide-react';

interface AdvancedSignalsGeneratorProps {
    ticks: number[];
    theme?: 'light' | 'dark';
    onSignalGenerated?: (signals: StrategySignal[]) => void;
}

export function AdvancedSignalsGenerator({ ticks, theme = 'dark', onSignalGenerated }: AdvancedSignalsGeneratorProps) {
    const [signals, setSignals] = useState<StrategySignal[]>([]);
    const [marketAssessment, setMarketAssessment] = useState<any>(null);
    const [selectedSignal, setSelectedSignal] = useState<StrategySignal | null>(null);
    const [showDetails, setShowDetails] = useState(false);

    useEffect(() => {
        if (ticks.length < 20) return;

        // Generate signals
        const last15 = ticks.slice(-15);
        const last500 = ticks.slice(-500);

        const generatedSignals = TradingEngine.generateSignals(ticks, last15, last500);
        const assessment = SignalGenerator.assessMarket(ticks, last15, last500);

        setSignals(generatedSignals);
        setMarketAssessment(assessment);
        onSignalGenerated?.(generatedSignals);
    }, [ticks, onSignalGenerated]);

    const strongSignals = signals.filter(s => s.signal !== 'NEUTRAL');
    const buySignals = strongSignals.filter(s => s.signal === 'BUY');

    const getSignalColor = (signal: StrategySignal) => {
        if (signal.name.toLowerCase().includes('even') || signal.name.toLowerCase().includes('odd')) {
            return 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400';
        }
        if (signal.name.toLowerCase().includes('under')) {
            return 'bg-blue-500/20 border-blue-500/40 text-blue-400';
        }
        if (signal.name.toLowerCase().includes('over')) {
            return 'bg-green-500/20 border-green-500/40 text-green-400';
        }
        return 'bg-purple-500/20 border-purple-500/40 text-purple-400';
    };

    const getAssessmentColor = (assessment: string) => {
        switch (assessment) {
            case 'BULLISH':
                return 'text-green-400';
            case 'BEARISH':
                return 'text-red-400';
            case 'VOLATILE':
                return 'text-yellow-400';
            default:
                return 'text-gray-400';
        }
    };

    return (
        <div className='space-y-4'>
            {/* Market Assessment */}
            {marketAssessment && (
                <div
                    className={`rounded-xl p-4 border ${theme === 'dark' ? 'bg-slate-900/50 border-slate-700/50' : 'bg-slate-50 border-slate-200'}`}
                >
                    <div className='flex items-center justify-between mb-3'>
                        <h3
                            className={`text-sm font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                        >
                            Market Assessment
                        </h3>
                        <span className={`text-2xl font-black ${getAssessmentColor(marketAssessment.assessment)}`}>
                            {marketAssessment.assessment}
                        </span>
                    </div>
                    <p className={`text-xs ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                        {marketAssessment.recommendation}
                    </p>
                    <div className='mt-2 h-1 bg-slate-700 rounded-full overflow-hidden'>
                        <div
                            className={`h-full transition-all ${
                                marketAssessment.score > 60
                                    ? 'bg-green-500'
                                    : marketAssessment.score > 45
                                      ? 'bg-yellow-500'
                                      : 'bg-red-500'
                            }`}
                            style={{ width: `${marketAssessment.score}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Signals Grid */}
            <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
                {signals.map((signal, idx) => (
                    <div
                        key={idx}
                        onClick={() => {
                            setSelectedSignal(signal);
                            setShowDetails(!showDetails && signal === selectedSignal);
                        }}
                        className={`rounded-lg p-4 border transition-all cursor-pointer hover:shadow-lg ${
                            signal.signal === 'BUY'
                                ? `${getSignalColor(signal)} border-opacity-60`
                                : `${theme === 'dark' ? 'bg-slate-800/30 border-slate-700/30 text-slate-400' : 'bg-slate-100 border-slate-300 text-slate-600'}`
                        }`}
                    >
                        <div className='flex items-start justify-between mb-2'>
                            <div>
                                <h4 className='font-bold text-sm'>{signal.name}</h4>
                                <p className='text-[11px] mt-0.5 opacity-80'>{signal.description}</p>
                            </div>
                            {signal.signal === 'BUY' && <Zap className='w-4 h-4 animate-pulse' />}
                        </div>

                        <div className='flex items-center gap-2 mt-3'>
                            <div className='flex-1'>
                                <div className='flex justify-between items-center mb-1'>
                                    <span className='text-[10px] font-semibold uppercase'>Power</span>
                                    <span className='text-xs font-bold'>{signal.power.toFixed(1)}%</span>
                                </div>
                                <div className='h-1.5 bg-slate-700/30 rounded-full overflow-hidden'>
                                    <div
                                        className={`h-full transition-all ${signal.power >= 55 ? 'bg-green-500' : 'bg-yellow-500'}`}
                                        style={{ width: `${signal.power}%` }}
                                    />
                                </div>
                            </div>
                        </div>

                        {signal.signal === 'BUY' && (
                            <div className='mt-3 pt-3 border-t border-current/20'>
                                <div className='flex items-center justify-between'>
                                    <span className='text-[10px] font-semibold'>Confidence</span>
                                    <Badge className='text-[10px] bg-current/30 text-current border-0'>
                                        {signal.confidence.toFixed(0)}%
                                    </Badge>
                                </div>
                                {signal.entryPoint && (
                                    <div className='mt-2 text-[10px] font-mono'>
                                        <span className='opacity-70'>Entry: </span>
                                        <span className='font-bold text-white'>{signal.entryPoint}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Selected Signal Details */}
            {selectedSignal && showDetails && (
                <div
                    className={`rounded-xl p-4 border ${theme === 'dark' ? 'bg-slate-900/50 border-slate-700/50' : 'bg-slate-50 border-slate-200'}`}
                >
                    <div className='flex items-center justify-between mb-4'>
                        <h4 className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                            {selectedSignal.name} - Detailed Analysis
                        </h4>
                        <Button size='sm' variant='ghost' onClick={() => setShowDetails(false)} className='h-auto p-1'>
                            <EyeOff className='w-4 h-4' />
                        </Button>
                    </div>

                    <div className='space-y-3'>
                        <div className='grid grid-cols-2 gap-3'>
                            <div>
                                <p
                                    className={`text-[10px] font-semibold uppercase opacity-70 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}
                                >
                                    Signal
                                </p>
                                <p
                                    className={`text-lg font-bold ${selectedSignal.signal === 'BUY' ? 'text-green-400' : 'text-gray-400'}`}
                                >
                                    {selectedSignal.signal}
                                </p>
                            </div>
                            <div>
                                <p
                                    className={`text-[10px] font-semibold uppercase opacity-70 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}
                                >
                                    Power
                                </p>
                                <p className='text-lg font-bold text-blue-400'>{selectedSignal.power.toFixed(1)}%</p>
                            </div>
                        </div>

                        {selectedSignal.entryPoint && (
                            <div className='p-3 bg-green-500/10 border border-green-500/30 rounded-lg'>
                                <p className='text-[10px] font-semibold text-green-400 uppercase mb-1'>Entry Point</p>
                                <p className='text-sm font-mono font-bold text-green-300'>
                                    Digit {selectedSignal.entryPoint}
                                </p>
                            </div>
                        )}

                        {selectedSignal.stopLoss && (
                            <div className='p-3 bg-red-500/10 border border-red-500/30 rounded-lg'>
                                <p className='text-[10px] font-semibold text-red-400 uppercase mb-1'>Stop Loss</p>
                                <p className='text-sm font-mono font-bold text-red-300'>
                                    If {selectedSignal.stopLoss} appears
                                </p>
                            </div>
                        )}

                        <p
                            className={`text-sm leading-relaxed ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}
                        >
                            {selectedSignal.description}
                        </p>
                    </div>
                </div>
            )}

            {/* Summary */}
            <div
                className={`rounded-xl p-3 border flex items-center justify-between ${theme === 'dark' ? 'bg-slate-900/30 border-slate-700/30' : 'bg-slate-100 border-slate-300'}`}
            >
                <div className='flex items-center gap-2'>
                    {buySignals.length > 0 ? (
                        <>
                            <TrendingUp
                                className={`w-4 h-4 ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}
                            />
                            <span
                                className={`text-xs font-bold ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}
                            >
                                {buySignals.length} Strong Signal{buySignals.length > 1 ? 's' : ''}
                            </span>
                        </>
                    ) : (
                        <>
                            <AlertCircle
                                className={`w-4 h-4 ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'}`}
                            />
                            <span
                                className={`text-xs font-bold ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'}`}
                            >
                                No Strong Signals Yet
                            </span>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
