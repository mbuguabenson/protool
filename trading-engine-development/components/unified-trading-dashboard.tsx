'use client';

import React, { useEffect } from 'react';
import { useUnifiedEngine } from '@/hooks/use-unified-engine';
import { useTheme } from '@/lib/theme-provider-advanced';
import { ThemeToggleAdvanced } from './theme-toggle-advanced';
import {
    GlassCard,
    GlassPanel,
    NeomorphButton,
    StatPill,
    PowerBar,
    StatGrid,
    TradeCard,
    GlowBadge,
} from './premium-ui-components';

export const UnifiedTradingDashboard: React.FC = () => {
    const { engine, state, analysis, signals, riskMetrics, trades, stats, processTick, executeTrade, reset } =
        useUnifiedEngine();
    const { currentTheme } = useTheme();

    // Connect engine when component mounts
    useEffect(() => {
        if (engine) {
            engine.connect();
            return () => {
                engine.disconnect();
            };
        }
    }, [engine]);

    // Simulate receiving market data (replace with real WebSocket)
    useEffect(() => {
        const interval = setInterval(() => {
            const randomPrice = 50000 + Math.random() * 10000;
            processTick(randomPrice);
        }, 500);

        return () => clearInterval(interval);
    }, [processTick]);

    return (
        <div className='min-h-screen bg-gradient-to-br from-bg-primary via-bg-secondary to-bg-primary p-6'>
            {/* Header */}
            <div className='flex justify-between items-center mb-8'>
                <div className='flex items-center gap-3'>
                    <div className='w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center'>
                        <span className='text-2xl font-bold text-white'>P</span>
                    </div>
                    <div>
                        <h1 className='text-3xl font-bold glow-text-blue'>analysistoolpro</h1>
                        <p className='text-sm text-text-tertiary'>Advanced Trading Engine</p>
                    </div>
                </div>

                <div className='flex items-center gap-4'>
                    <GlowBadge color='green'>{state.isConnected ? 'Connected' : 'Disconnected'}</GlowBadge>
                    <ThemeToggleAdvanced />
                </div>
            </div>

            {/* Main Grid */}
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8'>
                {/* Current Digit */}
                <GlassCard>
                    <div className='flex flex-col items-center justify-center py-6'>
                        <p className='text-sm text-text-tertiary mb-2'>Current Digit</p>
                        <div className='w-20 h-20 rounded-full bg-gradient-to-br from-blue-500/30 to-purple-600/30 flex items-center justify-center border-2 border-blue-500/50'>
                            <span className='text-5xl font-bold glow-text-blue'>{analysis?.currentDigit ?? '-'}</span>
                        </div>
                    </div>
                </GlassCard>

                {/* Total Ticks */}
                <StatPill label='Total Ticks' value={analysis?.totalTicks ?? 0} variant='default' />

                {/* Win Rate */}
                <StatPill
                    label='Win Rate'
                    value={`${stats?.winRate?.toFixed(1) ?? 0}%`}
                    variant={stats?.winRate >= 50 ? 'positive' : 'negative'}
                />

                {/* Net Profit */}
                <StatPill
                    label='Net Profit'
                    value={`$${stats?.netProfit?.toFixed(2) ?? 0}`}
                    variant={stats?.netProfit >= 0 ? 'positive' : 'negative'}
                />
            </div>

            {/* Analytics Section */}
            <div className='grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8'>
                {/* Digit Distribution */}
                <GlassPanel title='Digit Power Distribution' className='lg:col-span-2'>
                    <div className='space-y-3'>
                        {analysis?.digitPowers.map(dp => (
                            <PowerBar
                                key={dp.digit}
                                label={`Digit ${dp.digit}`}
                                value={dp.power}
                                color={dp.color}
                                showLabel={true}
                                animated={true}
                            />
                        ))}
                    </div>
                </GlassPanel>

                {/* Stats Overview */}
                <GlassPanel title='Statistics'>
                    <StatGrid
                        items={[
                            {
                                label: 'Even',
                                value: `${analysis?.even.power.toFixed(1) ?? 0}%`,
                                variant: 'default',
                            },
                            {
                                label: 'Odd',
                                value: `${analysis?.odd.power.toFixed(1) ?? 0}%`,
                                variant: 'default',
                            },
                            {
                                label: 'Over (5-9)',
                                value: `${analysis?.over.power.toFixed(1) ?? 0}%`,
                                variant: 'positive',
                            },
                            {
                                label: 'Under (0-4)',
                                value: `${analysis?.under.power.toFixed(1) ?? 0}%`,
                                variant: 'negative',
                            },
                        ]}
                        columns={2}
                    />
                </GlassPanel>
            </div>

            {/* Bot Signals */}
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8'>
                {Object.entries(signals).map(([botType, signal]) => (
                    <GlassCard key={botType} className='p-4'>
                        <div className='mb-3'>
                            <h4 className='text-sm font-bold glow-text-blue uppercase'>{botType.replace(/_/g, ' ')}</h4>
                            <GlowBadge color={signal.action === 'trade' ? 'green' : 'amber'} size='sm'>
                                {signal.action.toUpperCase()}
                            </GlowBadge>
                        </div>

                        <div className='space-y-2 text-sm'>
                            <div className='flex justify-between'>
                                <span className='text-text-tertiary'>Prediction:</span>
                                <span className='font-bold'>
                                    {Array.isArray(signal.prediction)
                                        ? signal.prediction.join(', ')
                                        : signal.prediction}
                                </span>
                            </div>
                            <div className='flex justify-between'>
                                <span className='text-text-tertiary'>Confidence:</span>
                                <span className='font-bold text-green-400'>{signal.confidence}%</span>
                            </div>
                        </div>

                        {signal.action === 'trade' && (
                            <NeomorphButton
                                variant='primary'
                                size='sm'
                                className='w-full mt-4'
                                onClick={() => executeTrade(botType, signal)}
                            >
                                Execute
                            </NeomorphButton>
                        )}
                    </GlassCard>
                ))}
            </div>

            {/* Risk Management */}
            {riskMetrics && (
                <GlassPanel title='Risk Management' className='mb-8'>
                    <StatGrid
                        items={[
                            {
                                label: 'Current Stake',
                                value: `$${riskMetrics.currentStake.toFixed(2)}`,
                                variant: 'default',
                            },
                            {
                                label: 'Total Profit',
                                value: `$${riskMetrics.totalProfit.toFixed(2)}`,
                                variant: riskMetrics.totalProfit >= 0 ? 'positive' : 'negative',
                            },
                            {
                                label: 'Consecutive Wins',
                                value: riskMetrics.consecutiveWins,
                                variant: riskMetrics.consecutiveWins > 0 ? 'positive' : 'default',
                            },
                            {
                                label: 'Consecutive Losses',
                                value: riskMetrics.consecutiveLosses,
                                variant: riskMetrics.consecutiveLosses > 0 ? 'negative' : 'default',
                            },
                        ]}
                        columns={2}
                    />

                    {riskMetrics.shouldSwitch && (
                        <div className='mt-4 p-3 bg-amber-500/20 border border-amber-500/50 rounded-lg'>
                            <p className='text-sm text-amber-200 font-semibold'>
                                Max loss limit reached. Consider switching strategy.
                            </p>
                        </div>
                    )}

                    {riskMetrics.shouldStop && (
                        <div className='mt-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg'>
                            <p className='text-sm text-red-200 font-semibold'>Trading halted due to risk limits.</p>
                        </div>
                    )}
                </GlassPanel>
            )}

            {/* Trade History */}
            <GlassPanel title='Recent Trades' className='mb-8'>
                <div className='space-y-2 max-h-96 overflow-y-auto'>
                    {trades.length === 0 ? (
                        <p className='text-center text-text-tertiary py-8'>No trades yet</p>
                    ) : (
                        trades
                            .slice(-10)
                            .reverse()
                            .map(trade => (
                                <TradeCard
                                    key={trade.id}
                                    digit={trade.digit}
                                    amount={trade.profit}
                                    result={trade.result}
                                    time={new Date(trade.timestamp).toLocaleTimeString()}
                                    bot={trade.botType}
                                />
                            ))
                    )}
                </div>
            </GlassPanel>

            {/* Controls */}
            <div className='flex gap-4'>
                <NeomorphButton variant='primary' onClick={reset}>
                    Reset Engine
                </NeomorphButton>
                <NeomorphButton variant='danger'>Stop Trading</NeomorphButton>
            </div>
        </div>
    );
};
