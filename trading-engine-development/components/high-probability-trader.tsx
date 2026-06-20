'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsTrigger } from '@/components/ui/tabs';
import { Clock, Target, Zap, AlertCircle, TrendingUp, Settings } from 'lucide-react';
import { MartingaleCalculator } from '@/lib/martingale-calculator';
import { MarketZoneDetector } from '@/lib/market-zone-detector';
import { TradingEngine } from '@/lib/trading-engine';

interface HighProbabilityTraderProps {
    ticks: number[];
    accountBalance: number;
    theme?: 'light' | 'dark';
}

interface TradeStats {
    totalRuns: number;
    wins: number;
    losses: number;
    totalProfit: number;
    winRate: number;
    avgWinProfit: number;
    avgLossProfit: number;
}

export function HighProbabilityTrader({ ticks, accountBalance, theme = 'dark' }: HighProbabilityTraderProps) {
    const [activeTab, setActiveTab] = useState('settings');
    const [tradingHours, setTradingHours] = useState(24);
    const [targetPercentage, setTargetPercentage] = useState(2);
    const [riskPercentage, setRiskPercentage] = useState(2);
    const [useMartingale, setUseMartingale] = useState(true);
    const [consecutiveLossesStop, setConsecutiveLossesStop] = useState(5);
    const [autoTrading, setAutoTrading] = useState(false);

    const [tradeStats, setTradeStats] = useState<TradeStats>({
        totalRuns: 0,
        wins: 0,
        losses: 0,
        totalProfit: 0,
        winRate: 0,
        avgWinProfit: 0,
        avgLossProfit: 0,
    });

    const [martingaleLevels, setMartingaleLevels] = useState<any[]>([]);
    const [dailyTargets, setDailyTargets] = useState<any>(null);
    const [zoneAnalysis, setZoneAnalysis] = useState<any>(null);

    // Calculate recommendations
    useEffect(() => {
        if (ticks.length < 60) return;

        // Calculate daily targets
        const targets = MartingaleCalculator.calculateDailyTargets(accountBalance, tradingHours, targetPercentage);
        setDailyTargets(targets);

        // Calculate martingale levels for high-probability trades
        const levels = MartingaleCalculator.calculateHighProbabilityStakes(accountBalance, riskPercentage);
        setMartingaleLevels(levels);

        // Analyze market zones
        const analysis = TradingEngine.analyzeOverUnder(ticks.slice(-60));
        const zoneData = MarketZoneDetector.analyzeAllMarkets(
            analysis.overPower,
            analysis.underPower,
            analysis.volatility,
            analysis.trendingMarket !== 'neutral'
        );
        setZoneAnalysis(zoneData);
    }, [ticks, accountBalance, tradingHours, targetPercentage, riskPercentage]);

    const highProbabilityMarkets = [
        { name: 'Over 1', description: 'Single digit 1', martingale: '3.1x' },
        { name: 'Over 2', description: 'Single digit 2', martingale: '2.1x' },
        { name: 'Over 3', description: 'Single digit 3', martingale: '1.5x' },
        { name: 'Under 6', description: 'Single digit 6', martingale: '1.5x' },
        { name: 'Under 7', description: 'Single digit 7', martingale: '2.1x' },
        { name: 'Under 8', description: 'Single digit 8', martingale: '3.1x' },
    ];

    const safeZones = zoneAnalysis?.zones.filter((z: any) => z.type === 'SAFE') || [];

    return (
        <div className='space-y-6'>
            <div
                className={`rounded-xl p-6 border ${
                    theme === 'dark'
                        ? 'bg-gradient-to-br from-slate-900/50 to-slate-800/50 border-slate-700/50'
                        : 'bg-slate-50 border-slate-200'
                }`}
            >
                <div className='flex items-center justify-between mb-6'>
                    <h2
                        className={`text-2xl font-bold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                    >
                        <Zap className='w-6 h-6 text-yellow-400' />
                        High-Probability Trader (1,2,3 / 6,7,8)
                    </h2>
                    <Badge
                        className={`${autoTrading ? 'bg-green-500/20 text-green-400 border-green-500/40' : 'bg-slate-500/20 text-slate-400 border-slate-500/40'}`}
                    >
                        {autoTrading ? 'AUTO TRADING ON' : 'Manual Mode'}
                    </Badge>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className='w-full'>
                    <TabsList
                        className={`grid w-full grid-cols-4 ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-100'}`}
                    >
                        <TabsTrigger value='settings' className='text-xs'>
                            Settings
                        </TabsTrigger>
                        <TabsTrigger value='targets' className='text-xs'>
                            Targets
                        </TabsTrigger>
                        <TabsTrigger value='zones' className='text-xs'>
                            Zones
                        </TabsTrigger>
                        <TabsTrigger value='stats' className='text-xs'>
                            Stats
                        </TabsTrigger>
                    </TabsList>

                    {/* Settings Tab */}
                    <TabsContent value='settings' className='space-y-4 mt-4'>
                        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                            {/* Trading Hours */}
                            <div>
                                <label
                                    className={`text-sm font-semibold mb-2 block ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                                >
                                    <Clock className='w-4 h-4 inline mr-2' />
                                    Trading Hours
                                </label>
                                <Input
                                    type='number'
                                    min='1'
                                    max='24'
                                    value={tradingHours}
                                    onChange={e => setTradingHours(Number(e.target.value))}
                                    className={`${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'}`}
                                />
                            </div>

                            {/* Daily Target % */}
                            <div>
                                <label
                                    className={`text-sm font-semibold mb-2 block ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                                >
                                    <Target className='w-4 h-4 inline mr-2' />
                                    Daily Target %
                                </label>
                                <Input
                                    type='number'
                                    min='0.5'
                                    max='10'
                                    step='0.5'
                                    value={targetPercentage}
                                    onChange={e => setTargetPercentage(Number(e.target.value))}
                                    className={`${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'}`}
                                />
                            </div>

                            {/* Risk per Trade */}
                            <div>
                                <label
                                    className={`text-sm font-semibold mb-2 block ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                                >
                                    Risk per Trade %
                                </label>
                                <div className='flex gap-2'>
                                    {[1, 2, 3, 4, 5].map(pct => (
                                        <Button
                                            key={pct}
                                            size='sm'
                                            variant={riskPercentage === pct ? 'default' : 'outline'}
                                            onClick={() => setRiskPercentage(pct)}
                                            className='text-xs'
                                        >
                                            {pct}%
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            {/* Stop Loss */}
                            <div>
                                <label
                                    className={`text-sm font-semibold mb-2 block ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                                >
                                    Stop Loss (Consecutive Losses)
                                </label>
                                <Input
                                    type='number'
                                    min='2'
                                    max='20'
                                    value={consecutiveLossesStop}
                                    onChange={e => setConsecutiveLossesStop(Number(e.target.value))}
                                    className={`${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'}`}
                                />
                            </div>
                        </div>

                        {/* Martingale Toggle */}
                        <div
                            className={`p-4 rounded-lg border flex items-center justify-between ${
                                theme === 'dark'
                                    ? 'bg-slate-800/30 border-slate-700/30'
                                    : 'bg-slate-100 border-slate-300'
                            }`}
                        >
                            <div>
                                <p className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                    Use Martingale
                                </p>
                                <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                                    Automatically increase stake after losses
                                </p>
                            </div>
                            <Switch checked={useMartingale} onCheckedChange={setUseMartingale} />
                        </div>

                        {/* Auto Trading Toggle */}
                        <div
                            className={`p-4 rounded-lg border flex items-center justify-between ${
                                theme === 'dark'
                                    ? 'bg-slate-800/30 border-slate-700/30'
                                    : 'bg-slate-100 border-slate-300'
                            }`}
                        >
                            <div>
                                <p className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                    Enable Auto Trading
                                </p>
                                <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                                    Automatically execute trades based on signals
                                </p>
                            </div>
                            <Switch checked={autoTrading} onCheckedChange={setAutoTrading} />
                        </div>
                    </TabsContent>

                    {/* Targets Tab */}
                    <TabsContent value='targets' className='space-y-4 mt-4'>
                        {dailyTargets && (
                            <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
                                <div
                                    className={`p-4 rounded-lg border text-center ${
                                        theme === 'dark'
                                            ? 'bg-slate-800/30 border-slate-700/30'
                                            : 'bg-slate-100 border-slate-300'
                                    }`}
                                >
                                    <p
                                        className={`text-[10px] font-semibold uppercase ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}
                                    >
                                        Daily Target
                                    </p>
                                    <p
                                        className={`text-lg font-bold mt-2 ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}
                                    >
                                        ${dailyTargets.dailyTarget.toFixed(2)}
                                    </p>
                                </div>

                                <div
                                    className={`p-4 rounded-lg border text-center ${
                                        theme === 'dark'
                                            ? 'bg-slate-800/30 border-slate-700/30'
                                            : 'bg-slate-100 border-slate-300'
                                    }`}
                                >
                                    <p
                                        className={`text-[10px] font-semibold uppercase ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}
                                    >
                                        Hourly Target
                                    </p>
                                    <p
                                        className={`text-lg font-bold mt-2 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}
                                    >
                                        ${dailyTargets.hourlyTarget.toFixed(2)}
                                    </p>
                                </div>

                                <div
                                    className={`p-4 rounded-lg border text-center ${
                                        theme === 'dark'
                                            ? 'bg-slate-800/30 border-slate-700/30'
                                            : 'bg-slate-100 border-slate-300'
                                    }`}
                                >
                                    <p
                                        className={`text-[10px] font-semibold uppercase ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}
                                    >
                                        Per Trade
                                    </p>
                                    <p
                                        className={`text-lg font-bold mt-2 ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`}
                                    >
                                        ${dailyTargets.stakePerTrade.toFixed(2)}
                                    </p>
                                </div>

                                <div
                                    className={`p-4 rounded-lg border text-center ${
                                        theme === 'dark'
                                            ? 'bg-slate-800/30 border-slate-700/30'
                                            : 'bg-slate-100 border-slate-300'
                                    }`}
                                >
                                    <p
                                        className={`text-[10px] font-semibold uppercase ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}
                                    >
                                        Trades/Hour
                                    </p>
                                    <p
                                        className={`text-lg font-bold mt-2 ${theme === 'dark' ? 'text-orange-400' : 'text-orange-600'}`}
                                    >
                                        ~{dailyTargets.tradesPerHour}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* High-Probability Markets */}
                        <div>
                            <h3 className={`font-bold mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                Target Markets
                            </h3>
                            <div className='grid grid-cols-2 md:grid-cols-3 gap-3'>
                                {highProbabilityMarkets.map((market, idx) => (
                                    <div
                                        key={idx}
                                        className={`p-3 rounded-lg border text-center transition-all hover:shadow-lg ${
                                            theme === 'dark'
                                                ? 'bg-slate-800/30 border-slate-700/30 hover:border-slate-700/60'
                                                : 'bg-slate-100 border-slate-300 hover:border-slate-400'
                                        }`}
                                    >
                                        <p
                                            className={`font-bold text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                                        >
                                            {market.name}
                                        </p>
                                        <p
                                            className={`text-[10px] mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}
                                        >
                                            {market.description}
                                        </p>
                                        {useMartingale && (
                                            <Badge className='mt-2 bg-yellow-500/20 text-yellow-400 border-yellow-500/40 text-[9px]'>
                                                {market.martingale}
                                            </Badge>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </TabsContent>

                    {/* Zones Tab */}
                    <TabsContent value='zones' className='space-y-4 mt-4'>
                        {zoneAnalysis && (
                            <div className='space-y-3'>
                                {safeZones.length > 0 && (
                                    <div>
                                        <h3
                                            className={`font-bold mb-3 text-sm ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}
                                        >
                                            Safe Zones ({safeZones.length})
                                        </h3>
                                        <div className='space-y-2'>
                                            {safeZones.map((zone: any, idx: number) => (
                                                <div
                                                    key={idx}
                                                    className={`p-3 rounded-lg border ${
                                                        theme === 'dark'
                                                            ? 'bg-green-500/[0.08] border-green-500/30'
                                                            : 'bg-green-50 border-green-200'
                                                    }`}
                                                >
                                                    <div className='flex items-center justify-between'>
                                                        <p
                                                            className={`font-bold ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}
                                                        >
                                                            {zone.market}
                                                        </p>
                                                        <span
                                                            className={`text-sm font-bold ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}
                                                        >
                                                            {zone.power.toFixed(1)}%
                                                        </span>
                                                    </div>
                                                    <p
                                                        className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}
                                                    >
                                                        {zone.recommendation}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {safeZones.length === 0 && (
                                    <div
                                        className={`p-4 rounded-lg border flex items-start gap-2 ${
                                            theme === 'dark'
                                                ? 'bg-yellow-500/[0.08] border-yellow-500/30'
                                                : 'bg-yellow-50 border-yellow-200'
                                        }`}
                                    >
                                        <AlertCircle
                                            className={`w-4 h-4 mt-0.5 shrink-0 ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'}`}
                                        />
                                        <div>
                                            <p
                                                className={`font-semibold text-sm ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'}`}
                                            >
                                                No Safe Zones Detected
                                            </p>
                                            <p
                                                className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}
                                            >
                                                Wait for market to stabilize before trading
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </TabsContent>

                    {/* Stats Tab */}
                    <TabsContent value='stats' className='space-y-4 mt-4'>
                        <div className='grid grid-cols-2 md:grid-cols-3 gap-3'>
                            <div
                                className={`p-4 rounded-lg border text-center ${
                                    theme === 'dark'
                                        ? 'bg-slate-800/30 border-slate-700/30'
                                        : 'bg-slate-100 border-slate-300'
                                }`}
                            >
                                <p
                                    className={`text-[10px] font-semibold uppercase ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}
                                >
                                    Total Runs
                                </p>
                                <p
                                    className={`text-2xl font-bold mt-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                                >
                                    {tradeStats.totalRuns}
                                </p>
                            </div>

                            <div
                                className={`p-4 rounded-lg border text-center ${
                                    theme === 'dark'
                                        ? 'bg-green-500/[0.08] border-green-500/30'
                                        : 'bg-green-50 border-green-200'
                                }`}
                            >
                                <p
                                    className={`text-[10px] font-semibold uppercase ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}
                                >
                                    Wins
                                </p>
                                <p
                                    className={`text-2xl font-bold mt-2 ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}
                                >
                                    {tradeStats.wins}
                                </p>
                            </div>

                            <div
                                className={`p-4 rounded-lg border text-center ${
                                    theme === 'dark'
                                        ? 'bg-red-500/[0.08] border-red-500/30'
                                        : 'bg-red-50 border-red-200'
                                }`}
                            >
                                <p
                                    className={`text-[10px] font-semibold uppercase ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}
                                >
                                    Losses
                                </p>
                                <p
                                    className={`text-2xl font-bold mt-2 ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}
                                >
                                    {tradeStats.losses}
                                </p>
                            </div>

                            <div
                                className={`p-4 rounded-lg border text-center ${
                                    theme === 'dark'
                                        ? 'bg-blue-500/[0.08] border-blue-500/30'
                                        : 'bg-blue-50 border-blue-200'
                                }`}
                            >
                                <p
                                    className={`text-[10px] font-semibold uppercase ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}
                                >
                                    Win Rate
                                </p>
                                <p
                                    className={`text-2xl font-bold mt-2 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}
                                >
                                    {tradeStats.winRate.toFixed(1)}%
                                </p>
                            </div>

                            <div
                                className={`p-4 rounded-lg border text-center ${
                                    tradeStats.totalProfit >= 0
                                        ? theme === 'dark'
                                            ? 'bg-green-500/[0.08] border-green-500/30'
                                            : 'bg-green-50 border-green-200'
                                        : theme === 'dark'
                                          ? 'bg-red-500/[0.08] border-red-500/30'
                                          : 'bg-red-50 border-red-200'
                                }`}
                            >
                                <p
                                    className={`text-[10px] font-semibold uppercase ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}
                                >
                                    Total P/L
                                </p>
                                <p
                                    className={`text-2xl font-bold mt-2 ${
                                        tradeStats.totalProfit >= 0
                                            ? theme === 'dark'
                                                ? 'text-green-400'
                                                : 'text-green-600'
                                            : theme === 'dark'
                                              ? 'text-red-400'
                                              : 'text-red-600'
                                    }`}
                                >
                                    ${tradeStats.totalProfit.toFixed(2)}
                                </p>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
