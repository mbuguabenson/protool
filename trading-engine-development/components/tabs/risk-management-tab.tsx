'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Download, Calculator, TrendingUp, ShieldAlert, BookOpen } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

export function RiskManagementTab() {
    const [capital, setCapital] = useState(1000);
    const [stakePercent, setStakePercent] = useState(2);
    const [days, setDays] = useState(30);
    const [sessionsPerDay, setSessionsPerDay] = useState(2);
    const [martingale, setMartingale] = useState(2.1);
    const [targetBalance, setTargetBalance] = useState(2000);

    // Calculations
    const stakeAmount = useMemo(() => (capital * stakePercent) / 100, [capital, stakePercent]);
    const totalSessions = useMemo(() => days * sessionsPerDay, [days, sessionsPerDay]);
    const maxStopLoss = useMemo(() => capital * 0.5, [capital]);

    // Calculate max consecutive losses before hitting 50% stop loss
    const maxConsecutiveLosses = useMemo(() => {
        let currentStake = stakeAmount;
        let totalLoss = 0;
        let count = 0;
        while (totalLoss + currentStake <= maxStopLoss) {
            totalLoss += currentStake;
            currentStake *= martingale;
            count++;
            if (count > 20) break; // Safety
        }
        return count;
    }, [stakeAmount, martingale, maxStopLoss]);

    const requiredProfitPerSession = useMemo(() => {
        return (targetBalance - capital) / totalSessions;
    }, [targetBalance, capital, totalSessions]);

    const growthData = useMemo(() => {
        const data = [];
        let current = capital;
        const dailyProfit = requiredProfitPerSession * sessionsPerDay;

        for (let i = 0; i <= days; i += Math.ceil(days / 10)) {
            data.push({
                day: `Day ${i}`,
                balance: Math.round(current + dailyProfit * i),
            });
        }
        return data;
    }, [capital, days, sessionsPerDay, requiredProfitPerSession]);

    const exportJournalTemplate = () => {
        const headers = [
            'Date',
            'Session',
            'Stake',
            'Target TP',
            'Stop Loss',
            'Result (W/L)',
            'Profit/Loss',
            'Balance',
        ];
        const rows = [headers];

        // Generate one week of dummy rows as a template
        let runningBalance = capital;
        for (let i = 1; i <= 7; i++) {
            rows.push([
                new Date().toLocaleDateString(),
                i.toString(),
                stakeAmount.toFixed(2),
                requiredProfitPerSession.toFixed(2),
                (stakeAmount * 5).toFixed(2), // Generic SL
                '',
                '',
                '',
            ]);
        }

        const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', 'trading_journal_plan.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className='space-y-6 max-w-6xl mx-auto p-2 lg:p-6'>
            <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
                {/* Input Panel */}
                <Card className='lg:col-span-1 soft-card border-white/5 bg-gradient-to-br from-[#0f1629]/80 to-[#1a2235]/80'>
                    <CardContent className='pt-6 space-y-4'>
                        <div className='flex items-center gap-2 mb-4 text-blue-400'>
                            <Calculator className='w-5 h-5' />
                            <h3 className='font-bold text-lg'>Planning Parameters</h3>
                        </div>

                        <div className='space-y-2'>
                            <Label className='text-xs text-gray-400'>Total Capital ($)</Label>
                            <Input
                                type='number'
                                value={capital}
                                onChange={e => setCapital(Number(e.target.value))}
                                className='bg-white/5 border-white/10'
                            />
                        </div>

                        <div className='space-y-2'>
                            <Label className='text-xs text-gray-400'>Stake Percentage (%)</Label>
                            <Select value={stakePercent.toString()} onValueChange={v => setStakePercent(Number(v))}>
                                <SelectTrigger className='bg-white/5 border-white/10'>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value='1'>1% (Safe)</SelectItem>
                                    <SelectItem value='2'>2% (Standard)</SelectItem>
                                    <SelectItem value='5'>5% (Aggressive)</SelectItem>
                                    <SelectItem value='10'>10% (High Risk)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className='grid grid-cols-2 gap-4'>
                            <div className='space-y-2'>
                                <Label className='text-xs text-gray-400'>Trading Days</Label>
                                <Input
                                    type='number'
                                    value={days}
                                    onChange={e => setDays(Number(e.target.value))}
                                    className='bg-white/5 border-white/10'
                                />
                            </div>
                            <div className='space-y-2'>
                                <Label className='text-xs text-gray-400'>Sessions/Day</Label>
                                <Input
                                    type='number'
                                    value={sessionsPerDay}
                                    onChange={e => setSessionsPerDay(Number(e.target.value))}
                                    className='bg-white/5 border-white/10'
                                />
                            </div>
                        </div>

                        <div className='space-y-2'>
                            <Label className='text-xs text-gray-400'>Martingale Multiplier</Label>
                            <Input
                                type='number'
                                step='0.1'
                                value={martingale}
                                onChange={e => setMartingale(Number(e.target.value))}
                                className='bg-white/5 border-white/10'
                            />
                        </div>

                        <div className='space-y-2'>
                            <Label className='text-xs text-gray-400'>Target Balance ($)</Label>
                            <Input
                                type='number'
                                value={targetBalance}
                                onChange={e => setTargetBalance(Number(e.target.value))}
                                className='bg-white/5 border-white/10'
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Results Overview */}
                <div className='lg:col-span-2 space-y-6'>
                    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                        <StatCard
                            label='Stake per Trade'
                            value={`$${stakeAmount.toFixed(2)}`}
                            icon={<ShieldAlert className='text-blue-400' />}
                            subtitle={`${stakePercent}% of capital`}
                        />
                        <StatCard
                            label='TP per Session'
                            value={`$${requiredProfitPerSession.toFixed(2)}`}
                            icon={<TrendingUp className='text-green-400' />}
                            subtitle='Required to hit target'
                        />
                        <StatCard
                            label='Safety Margin'
                            value={`${maxConsecutiveLosses} Losses`}
                            icon={
                                <ShieldAlert className={maxConsecutiveLosses < 4 ? 'text-red-500' : 'text-amber-400'} />
                            }
                            subtitle={`Before $${maxStopLoss} SL`}
                            alert={maxConsecutiveLosses < 4}
                        />
                    </div>

                    <Card className='bg-black/40 border-white/5 backdrop-blur-xl p-6'>
                        <div className='flex items-center justify-between mb-6'>
                            <h3 className='font-bold text-gray-300'>Projected Capital Growth</h3>
                            <div className='flex gap-2'>
                                <Button
                                    variant='outline'
                                    size='sm'
                                    onClick={exportJournalTemplate}
                                    className='text-xs gap-2 border-white/10 hover:bg-white/5'
                                >
                                    <Download className='w-3 h-3' />
                                    Journal Template
                                </Button>
                            </div>
                        </div>

                        <div className='h-[250px] w-full'>
                            <ResponsiveContainer width='100%' height='100%'>
                                <AreaChart data={growthData}>
                                    <defs>
                                        <linearGradient id='colorBalance' x1='0' y1='0' x2='0' y2='1'>
                                            <stop offset='5%' stopColor='#3b82f6' stopOpacity={0.3} />
                                            <stop offset='95%' stopColor='#3b82f6' stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray='3 3' vertical={false} stroke='#ffffff05' />
                                    <XAxis
                                        dataKey='day'
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 10, fill: '#666' }}
                                    />
                                    <YAxis hide />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#000',
                                            border: '1px solid #ffffff10',
                                            borderRadius: '8px',
                                            fontSize: '10px',
                                        }}
                                        itemStyle={{ color: '#3b82f6' }}
                                    />
                                    <Area
                                        type='monotone'
                                        dataKey='balance'
                                        stroke='#3b82f6'
                                        strokeWidth={2}
                                        fillOpacity={1}
                                        fill='url(#colorBalance)'
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>

                    <Card className='bg-blue-500/5 border-blue-500/20 p-4'>
                        <div className='flex gap-3'>
                            <div className='p-2 bg-blue-500/20 rounded-lg h-fit'>
                                <BookOpen className='w-5 h-5 text-blue-400' />
                            </div>
                            <div>
                                <h4 className='font-bold text-blue-300 text-sm'>Strategy Insight</h4>
                                <p className='text-xs text-blue-400/70 mt-1 leading-relaxed'>
                                    Based on your parameters, you should target a 1:2 Risk-Reward ratio. With a
                                    Martingale of {martingale}, ensure your win rate stays above
                                    {Math.round((1 / martingale) * 100)}% to maintain edge.
                                </p>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}

function StatCard({
    label,
    value,
    icon,
    subtitle,
    alert = false,
}: {
    label: string;
    value: string;
    icon: React.ReactNode;
    subtitle: string;
    alert?: boolean;
}) {
    return (
        <Card
            className={`bg-black/40 border-white/5 backdrop-blur-xl transition-all duration-300 ${alert ? 'ring-1 ring-red-500/30 bg-red-500/5' : ''}`}
        >
            <CardContent className='p-4'>
                <div className='flex justify-between items-start mb-2'>
                    <span className='text-[10px] font-bold text-gray-400 uppercase tracking-widest'>{label}</span>
                    <div className='p-1.5 bg-white/5 rounded-lg'>{icon}</div>
                </div>
                <div className='text-2xl font-black mb-1'>{value}</div>
                <div className='text-[10px] text-gray-500 font-medium'>{subtitle}</div>
            </CardContent>
        </Card>
    );
}
