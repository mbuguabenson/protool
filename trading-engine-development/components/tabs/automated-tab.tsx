'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Play, Square, TrendingUp, TrendingDown, AlertCircle, Loader, AlertTriangle } from 'lucide-react';
import { useDerivAPI } from '@/lib/deriv-api-context';
import { AutoBot, type BotStrategy, type AutoBotState, type AutoBotConfig } from '@/lib/autobots';
import { DerivWebSocketManager } from '@/lib/deriv-websocket-manager';
import { MarketSelector } from '@/components/market-selector';
import type { DerivSymbol } from '@/hooks/use-deriv';

interface AutoBotTabProps {
    theme?: 'light' | 'dark';
    symbol: string;
    onSymbolChange?: (symbol: string) => void;
    availableSymbols?: DerivSymbol[];
    currentPrice?: number;
    currentDigit?: number;
    tickCount?: number;
}

const BOT_STRATEGIES: { id: BotStrategy; name: string; description: string }[] = [
    {
        id: 'EVEN_ODD',
        name: 'EVEN/ODD Bot',
        description:
            'Analyzes Even/Odd digit bias. Shows WAIT at 55%+, TRADE NOW at 60%+. Requires increasing power trend.',
    },
    {
        id: 'OVER3_UNDER6',
        name: 'OVER3/UNDER6 Bot',
        description:
            'Analyzes Over 3 (digits 4-9) and Under 6 (digits 0-5). WAIT at 55%+, TRADE NOW at 60%+. Cross-verifies power distribution.',
    },
    {
        id: 'OVER2_UNDER7',
        name: 'OVER2_UNDER7 Bot',
        description:
            'Analyzes Over 2 (digits 3-9) and Under 7 (digits 0-6). Entry when range bias reaches 60%+. Mean-reversion pattern detection.',
    },
    {
        id: 'OVER1_UNDER8',
        name: 'OVER1/UNDER8 Bot',
        description:
            'Advanced bot for Over 1 (digits 2-9) and Under 8 (digits 0-7). Uses neural power dynamics. 60%+ threshold.',
    },
    {
        id: 'UNDER6',
        name: 'UNDER6 Bot',
        description:
            'Specialized for digits 0-6. When 0-4 appears most (60%+), gives Under 6 signal. Requires predictable resonance.',
    },
    {
        id: 'DIFFERS',
        name: 'DIFFERS Bot',
        description:
            'Selects digits 2-7 with <10% power. Waits 3 ticks without digit appearance. High-precision DIFFERS execution.',
    },
    {
        id: 'EVEN_ODD_ADVANCED',
        name: 'EVEN/ODD Advanced',
        description:
            'Pro volatility detection. 55%+=WAIT (Blue), 60%+=TRADE NOW (Green). Multi-level signal analysis with Pro Neural logic.',
    },
    {
        id: 'OVER_UNDER_ADVANCED',
        name: 'OVER/UNDER Advanced',
        description: 'Pro Neural: 55%=WAIT, 60%+=TRADE NOW. Uses last 50 ticks for deep predictability analysis.',
    },
];

export function AutoBotTab({
    theme = 'dark',
    symbol,
    onSymbolChange,
    availableSymbols = [],
    currentPrice,
    currentDigit,
    tickCount,
}: AutoBotTabProps) {
    const { apiClient, isConnected, isAuthorized, error: apiError, balance, isLoggedIn } = useDerivAPI();
    const [marketPrice, setMarketPrice] = useState<number>(0);
    const [selectedStrategy, setSelectedStrategy] = useState<BotStrategy>('EVEN_ODD');
    const [bot, setBot] = useState<AutoBot | null>(null);
    const [botState, setBotState] = useState<AutoBotState | null>(null);
    const [analysisData, setAnalysisData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);
    const [emergencyStop, setEmergencyStop] = useState(false);

    const [config, setConfig] = useState<AutoBotConfig>({
        symbol: symbol,
        historyCount: 1000,
        duration: 5,
        durationUnit: 't',
        tpPercent: 10,
        slPercent: 50,
        useMartingale: false,
        martingaleMultiplier: 2,
        cooldownMs: 300,
        maxTradesPerMinute: 120,
        initialStake: 0.35,
        balance: balance?.amount || 1000,
    });

    useEffect(() => {
        setConfig(prev => ({ ...prev, symbol: symbol }));

        const unsubscribe = DerivWebSocketManager.subscribe(symbol, data => {
            if (data.quote) {
                setMarketPrice(data.quote);
            }
        });

        return () => {
            unsubscribe();
        };
    }, [symbol]);

    useEffect(() => {
        if (balance?.amount) {
            setConfig(prev => ({ ...prev, balance: balance.amount }));
        }
    }, [balance]);

    useEffect(() => {
        if (emergencyStop && bot) {
            console.log('[v0] EMERGENCY STOP ACTIVATED');
            bot.stop();
            setBot(null);
            setBotState(null);
            setEmergencyStop(false);
        }
    }, [emergencyStop, bot]);

    const handleStart = async () => {
        setLocalError(null);
        setIsLoading(true);

        try {
            if (!apiClient) {
                setLocalError('API client not initialized. Please wait for connection...');
                setIsLoading(false);
                return;
            }

            if (!isConnected) {
                setLocalError('API not connected. Please check your connection and try again.');
                setIsLoading(false);
                return;
            }

            if (!isAuthorized) {
                setLocalError('API not authorized. Please authenticate first.');
                setIsLoading(false);
                return;
            }

            if (config.initialStake <= 0) {
                setLocalError('Initial stake must be greater than 0');
                setIsLoading(false);
                return;
            }

            if (config.initialStake > config.balance) {
                setLocalError('Initial stake cannot exceed account balance');
                setIsLoading(false);
                return;
            }

            const validatedStake = Math.round(config.initialStake * 100) / 100;
            const validatedConfig = { ...config, initialStake: validatedStake };

            console.log(`[v0] Starting AutoBot with config:`, validatedConfig);

            const newBot = new AutoBot(apiClient, selectedStrategy, validatedConfig);
            setBot(newBot);

            const updateInterval = setInterval(() => {
                const analysis = newBot.getCurrentAnalysis();
                setAnalysisData(analysis);
            }, 1000);

            try {
                await newBot.start(state => {
                    setBotState(state);
                });
            } catch (err: any) {
                console.error('[v0] Bot start error:', err);
                setLocalError(err.message || 'Failed to start bot');
                clearInterval(updateInterval);
                setBot(null);
                setBotState(null);
                setIsLoading(false);
                return;
            }

            return () => clearInterval(updateInterval);
        } catch (err: any) {
            console.error('[v0] Error starting bot:', err);
            setLocalError(err.message || 'Failed to start bot. Please try again.');
            setBot(null);
            setBotState(null);
        } finally {
            setIsLoading(false);
        }
    };

    const handleStop = () => {
        if (bot) {
            console.log('[v0] Stopping bot...');
            bot.stop();
            setBot(null);
            setBotState(null);
            setLocalError(null);
        }
    };

    const tpAmount = (config.balance * config.tpPercent) / 100;
    const slAmount = (config.balance * config.slPercent) / 100;
    const tpProgress = botState ? Math.min((botState.profitLoss / tpAmount) * 100, 100) : 0;
    const slProgress = botState ? Math.min((Math.abs(botState.profitLoss) / slAmount) * 100, 100) : 0;

    const isRunning = botState?.isRunning || false;
    const canStart = !isRunning && isConnected && isAuthorized && !!apiClient && !isLoading;

    return (
        <div
            className={`space-y-3 sm:space-y-6 backdrop-blur-lg p-4 rounded-2xl ${
                theme === 'dark'
                    ? 'bg-gradient-to-br from-[#0f1629]/30 via-[#1a2235]/20 to-[#0f1629]/30'
                    : 'bg-gradient-to-br from-blue-50/30 via-white/30 to-purple-50/30'
            }`}
        >
            {/* Connection Status Alert - only show if no data and really disconnected */}
            {(apiError || localError || (!isConnected && marketPrice === 0)) && (
                <Card
                    className={`backdrop-blur-xl border-2 animate-in fade-in slide-in-from-top-2 duration-500 transition-all ${
                        theme === 'dark'
                            ? 'bg-rose-500/15 border-rose-400/40 shadow-lg shadow-rose-500/20'
                            : 'bg-rose-50/50 border-rose-300/50'
                    }`}
                >
                    <CardContent className='p-4 flex items-start gap-3'>
                        <div className='p-2 rounded-full bg-rose-500/10 border border-rose-500/20'>
                            <AlertCircle className='w-4 h-4 text-rose-500 shrink-0' />
                        </div>
                        <div>
                            <p className='text-xs font-black uppercase tracking-widest text-rose-400'>
                                Uplink Interruption
                            </p>
                            <p className='text-[10px] sm:text-xs mt-1 text-rose-400/80 font-medium'>
                                {localError || apiError || 'Negotiating WebSocket connection...'}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Authorization pending alert - show when connected but not yet authorized */}
            {isConnected && !isAuthorized && isLoggedIn && !localError && (
                <Card
                    className={`backdrop-blur-xl border-2 transition-all ${
                        theme === 'dark'
                            ? 'bg-amber-500/15 border-amber-400/40 shadow-lg shadow-amber-500/20'
                            : 'bg-amber-50/50 border-amber-300/50'
                    }`}
                >
                    <CardContent className='p-3 flex items-center gap-3'>
                        <div className='p-2 rounded-full bg-amber-500/10 border border-amber-500/20'>
                            <AlertCircle className='w-4 h-4 text-amber-400 shrink-0' />
                        </div>
                        <p className='text-[10px] sm:text-xs text-amber-400/80 font-medium'>
                            Authorizing session... Trading will be available shortly.
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Emergency Stop Alert */}
            {isRunning && (
                <Card className='bg-amber-500/5 border-amber-500/20 backdrop-blur-xl animate-pulse'>
                    <CardContent className='p-4 flex items-center justify-between'>
                        <div className='flex items-start gap-3'>
                            <div className='p-2 rounded-full bg-amber-500/10 border border-amber-500/20'>
                                <AlertTriangle className='w-4 h-4 text-amber-500 shrink-0' />
                            </div>
                            <div>
                                <p className='text-xs font-black uppercase tracking-widest text-amber-400'>
                                    Autonomous Cycle Active
                                </p>
                                <p className='text-[10px] sm:text-xs mt-1 text-amber-400/80 font-medium'>
                                    Click terminate to halt all operations immediately
                                </p>
                            </div>
                        </div>
                        <Button
                            onClick={() => setEmergencyStop(true)}
                            className='bg-rose-600 hover:bg-rose-700 text-white font-black uppercase tracking-widest text-[10px] h-9 px-6 shadow-[0_0_15px_rgba(225,29,72,0.4)]'
                        >
                            Terminate
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Market Display */}
            <Card className='soft-card border-white/5'>
                <CardHeader className='p-4 pb-2'>
                    <CardTitle className='text-xs font-black uppercase tracking-[0.2em] text-slate-500'>
                        Live Market Feed
                    </CardTitle>
                    <CardDescription className='text-[10px] text-slate-600 uppercase font-medium'>
                        Real-time instrumentation
                    </CardDescription>
                </CardHeader>
                <CardContent className='p-4 pt-0'>
                    <div className='flex items-baseline gap-2'>
                        <p className='text-2xl font-black text-white tracking-tighter'>
                            {(marketPrice || 0).toFixed(5)}
                        </p>
                        <div className='flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20'>
                            <TrendingUp className='w-3 h-3' /> USD
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Bot Selection */}
            <Card className='soft-card border-white/5'>
                <CardHeader className='p-4 pb-2'>
                    <CardTitle className='text-xs font-black uppercase tracking-[0.2em] text-slate-500'>
                        Autonomous Strategies
                    </CardTitle>
                </CardHeader>
                <CardContent className='p-4 pt-0'>
                    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3'>
                        {BOT_STRATEGIES.map(strategy => (
                            <div
                                key={strategy.id}
                                onClick={() => !isRunning && setSelectedStrategy(strategy.id)}
                                className={`p-4 rounded-xl border transition-all duration-300 group ${
                                    selectedStrategy === strategy.id
                                        ? 'bg-primary/20 border-primary shadow-[0_0_20px_rgba(99,102,241,0.2)]'
                                        : 'bg-white/5 border-white/5 hover:bg-white/[0.08] hover:border-white/10'
                                } ${isRunning ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                                <h3
                                    className={`text-xs font-black uppercase tracking-wider mb-2 ${selectedStrategy === strategy.id ? 'text-white' : 'text-slate-300'}`}
                                >
                                    {strategy.name}
                                </h3>
                                <p className='text-[10px] text-slate-500 leading-relaxed font-medium'>
                                    {strategy.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Bot Configuration */}
            <Card className='soft-card border-white/5'>
                <CardHeader className='p-4 pb-2'>
                    <CardTitle className='text-xs font-black uppercase tracking-[0.2em] text-slate-500'>
                        Operation Parameters
                    </CardTitle>
                </CardHeader>
                <CardContent className='p-4 pt-0 space-y-4'>
                    <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3'>
                        {[
                            { label: 'Stake Value', key: 'initialStake', type: 'number' },
                            { label: 'Tick Depth', key: 'duration', type: 'number' },
                            { label: 'Target Profit %', key: 'tpPercent', type: 'number' },
                            { label: 'Loss Limit %', key: 'slPercent', type: 'number' },
                            { label: 'Inertia Delay', key: 'cooldownMs', type: 'number' },
                            {
                                label: 'M. Variable',
                                key: 'martingaleMultiplier',
                                type: 'number',
                                disabled: !config.useMartingale,
                            },
                        ].map(field => (
                            <div key={field.key} className='space-y-1.5'>
                                <Label className='text-[9px] font-black uppercase text-slate-500 tracking-widest ml-1'>
                                    {field.label}
                                </Label>
                                <Input
                                    type={field.type}
                                    value={(config as any)[field.key]}
                                    onChange={e =>
                                        setConfig({ ...config, [field.key]: Number.parseFloat(e.target.value) })
                                    }
                                    disabled={isRunning || field.disabled}
                                    className='h-9 text-xs font-bold bg-white/5 border-white/10 text-white rounded-lg focus:ring-primary/20'
                                />
                            </div>
                        ))}
                    </div>

                    <div className='flex items-center justify-between pt-2 border-t border-white/5'>
                        <div className='flex items-center gap-3'>
                            <Switch
                                checked={config.useMartingale}
                                onCheckedChange={checked => setConfig({ ...config, useMartingale: checked })}
                                disabled={isRunning}
                                className='data-[state=checked]:bg-primary'
                            />
                            <Label className='text-[10px] font-black uppercase text-slate-400 tracking-widest'>
                                Neural Martingale Override
                            </Label>
                        </div>

                        {isRunning ? (
                            <Button
                                onClick={handleStop}
                                variant='destructive'
                                className='h-10 px-8 font-black uppercase tracking-[0.1em] text-xs gap-2'
                                disabled={isLoading}
                            >
                                <Square className='w-4 h-4' />
                                Stop Execution
                            </Button>
                        ) : (
                            <Button
                                onClick={handleStart}
                                className='h-10 px-8 bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase tracking-[0.1em] text-xs gap-2 shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                                disabled={!canStart}
                            >
                                {isLoading ? (
                                    <>
                                        <Loader className='w-4 h-4 animate-spin' />
                                        Initializing...
                                    </>
                                ) : (
                                    <>
                                        <Play className='w-4 h-4' />
                                        Engage Strategy
                                    </>
                                )}
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Continuous Trading Analysis */}
            {isRunning && analysisData && (
                <Card
                    className={
                        theme === 'dark'
                            ? 'bg-linear-to-br from-[#0f1629]/80 to-[#1a2235]/80 border-blue-500/20'
                            : 'bg-white border-gray-200'
                    }
                >
                    <CardHeader>
                        <CardTitle className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                            Continuous Trading Analysis
                        </CardTitle>
                        <CardDescription className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                            Real-time proposal and market data
                        </CardDescription>
                    </CardHeader>
                    <CardContent className='space-y-4'>
                        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
                            {/* Current Market Data */}
                            {analysisData.analysis && (
                                <>
                                    <div
                                        className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-blue-50 border border-blue-200'}`}
                                    >
                                        <p
                                            className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                                        >
                                            Current Price
                                        </p>
                                        <p
                                            className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                                        >
                                            ${analysisData.analysis.currentPrice?.toFixed(5)}
                                        </p>
                                        <p
                                            className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}
                                        >
                                            Last Digit: {analysisData.analysis.lastDigit}
                                        </p>
                                    </div>

                                    <div
                                        className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-purple-500/10 border border-purple-500/30' : 'bg-purple-50 border border-purple-200'}`}
                                    >
                                        <p
                                            className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                                        >
                                            Contract Type
                                        </p>
                                        <p
                                            className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                                        >
                                            {analysisData.analysis.contractType}
                                        </p>
                                        {analysisData.analysis.prediction && (
                                            <p
                                                className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}
                                            >
                                                Prediction: {analysisData.analysis.prediction}
                                            </p>
                                        )}
                                    </div>

                                    <div
                                        className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-green-500/10 border border-green-500/30' : 'bg-green-50 border border-green-200'}`}
                                    >
                                        <p
                                            className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                                        >
                                            Ask Price
                                        </p>
                                        <p
                                            className={`text-lg font-bold ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}
                                        >
                                            ${analysisData.analysis.proposal?.askPrice?.toFixed(2)}
                                        </p>
                                        <p
                                            className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}
                                        >
                                            Payout: ${analysisData.analysis.proposal?.payout?.toFixed(2)}
                                        </p>
                                    </div>

                                    <div
                                        className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-orange-500/10 border border-orange-500/30' : 'bg-orange-50 border border-orange-200'}`}
                                    >
                                        <p
                                            className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                                        >
                                            Avg Probability
                                        </p>
                                        <p
                                            className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                                        >
                                            {analysisData.proposalMetrics?.avgProbability?.toFixed(1)}%
                                        </p>
                                        <p
                                            className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                                        >
                                            Active Contracts: {analysisData.proposalMetrics?.totalProposals}
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Proposal Longcode */}
                        {analysisData.analysis?.proposal?.longcode && (
                            <div
                                className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-gray-50 border border-gray-200'}`}
                            >
                                <p
                                    className={`text-xs font-semibold ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                                >
                                    Contract Details
                                </p>
                                <p className={`text-sm mt-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {analysisData.analysis.proposal.longcode}
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Bot Dashboard */}
            {botState && (
                <>
                    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
                        <Card
                            className={
                                theme === 'dark'
                                    ? 'bg-linear-to-br from-blue-500/10 to-blue-500/5 border-blue-500/30'
                                    : 'bg-blue-50 border-blue-200'
                            }
                        >
                            <CardHeader className='p-3 pb-1'>
                                <CardTitle
                                    className={`text-[10px] sm:text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                                >
                                    Total Runs
                                </CardTitle>
                            </CardHeader>
                            <CardContent className='px-3 pb-3'>
                                <div
                                    className={`text-xl sm:text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                                >
                                    {botState.totalRuns}
                                </div>
                                <div
                                    className={`text-[10px] sm:text-sm mt-0.5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                                >
                                    {botState.wins}W / {botState.losses}L
                                </div>
                            </CardContent>
                        </Card>

                        <Card
                            className={
                                botState.profitLoss >= 0
                                    ? theme === 'dark'
                                        ? 'bg-linear-to-br from-green-500/10 to-green-500/5 border-green-500/30'
                                        : 'bg-green-50 border-green-200'
                                    : theme === 'dark'
                                      ? 'bg-linear-to-br from-red-500/10 to-red-500/5 border-red-500/30'
                                      : 'bg-red-50 border-red-200'
                            }
                        >
                            <CardHeader className='p-3 pb-1'>
                                <CardTitle
                                    className={`text-[10px] sm:text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                                >
                                    Net Profit/Loss
                                </CardTitle>
                            </CardHeader>
                            <CardContent className='px-3 pb-3'>
                                <div
                                    className={`text-xl sm:text-3xl font-bold ${
                                        botState.profitLoss >= 0
                                            ? theme === 'dark'
                                                ? 'text-green-400'
                                                : 'text-green-600'
                                            : theme === 'dark'
                                              ? 'text-red-400'
                                              : 'text-red-600'
                                    }`}
                                >
                                    ${(botState.profitLoss || 0).toFixed(2)}
                                </div>
                                <div
                                    className={`text-[10px] sm:text-sm mt-0.5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                                >
                                    Target: ${(((config.balance || 0) * (config.tpPercent || 0)) / 100).toFixed(2)}
                                </div>
                            </CardContent>
                        </Card>

                        <Card
                            className={
                                theme === 'dark'
                                    ? 'bg-linear-to-br from-purple-500/10 to-purple-500/5 border-purple-500/30'
                                    : 'bg-purple-50 border-purple-200'
                            }
                        >
                            <CardHeader className='pb-2'>
                                <CardTitle
                                    className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                                >
                                    Win Rate
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div
                                    className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                                >
                                    {botState.totalRuns > 0
                                        ? ((botState.wins / botState.totalRuns) * 100).toFixed(1)
                                        : '0'}
                                    %
                                </div>
                                <div className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {botState.wins} wins
                                </div>
                            </CardContent>
                        </Card>

                        <Card
                            className={
                                theme === 'dark'
                                    ? 'bg-linear-to-br from-orange-500/10 to-orange-500/5 border-orange-500/30'
                                    : 'bg-orange-50 border-orange-200'
                            }
                        >
                            <CardHeader className='pb-2'>
                                <CardTitle
                                    className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                                >
                                    Current Stake
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div
                                    className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                                >
                                    ${(botState.currentStake || 0).toFixed(2)}
                                </div>
                                <div className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {botState.consecutiveLosses} consecutive losses
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* TP/SL Progress */}
                    <Card
                        className={
                            theme === 'dark'
                                ? 'bg-linear-to-br from-[#0f1629]/80 to-[#1a2235]/80 border-blue-500/20'
                                : 'bg-white border-gray-200'
                        }
                    >
                        <CardHeader>
                            <CardTitle className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                                TP/SL Tracker
                            </CardTitle>
                        </CardHeader>
                        <CardContent className='space-y-4'>
                            <div>
                                <div className='flex justify-between mb-2'>
                                    <span className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                                        Take Profit Target: ${(tpAmount || 0).toFixed(2)}
                                    </span>
                                    <span
                                        className={`text-sm font-bold ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}
                                    >
                                        {tpProgress.toFixed(1)}%
                                    </span>
                                </div>
                                <Progress value={tpProgress} className='h-2 bg-gray-700'>
                                    <div
                                        className='h-full bg-green-500 transition-all'
                                        style={{ width: `${tpProgress}%` }}
                                    />
                                </Progress>
                            </div>

                            <div>
                                <div className='flex justify-between mb-2'>
                                    <span className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                                        Stop Loss Limit: ${(slAmount || 0).toFixed(2)}
                                    </span>
                                    <span
                                        className={`text-sm font-bold ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}
                                    >
                                        {slProgress.toFixed(1)}%
                                    </span>
                                </div>
                                <Progress value={slProgress} className='h-2 bg-gray-700'>
                                    <div
                                        className='h-full bg-red-500 transition-all'
                                        style={{ width: `${slProgress}%` }}
                                    />
                                </Progress>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Trade Log */}
                    <Card
                        className={
                            theme === 'dark'
                                ? 'bg-linear-to-br from-[#0f1629]/80 to-[#1a2235]/80 border-blue-500/20'
                                : 'bg-white border-gray-200'
                        }
                    >
                        <CardHeader>
                            <CardTitle className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                                Trade Log
                            </CardTitle>
                            <CardDescription className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                                Recent trades (last 50)
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className='overflow-x-auto'>
                                <table className='w-full'>
                                    <thead>
                                        <tr
                                            className={`border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}
                                        >
                                            <th
                                                className={`text-left p-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                                            >
                                                Time
                                            </th>
                                            <th
                                                className={`text-left p-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                                            >
                                                Contract
                                            </th>
                                            <th
                                                className={`text-left p-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                                            >
                                                Result
                                            </th>
                                            <th
                                                className={`text-right p-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                                            >
                                                Stake
                                            </th>
                                            <th
                                                className={`text-right p-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                                            >
                                                P/L
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {botState.trades.map(trade => (
                                            <tr
                                                key={trade.id}
                                                className={`border-b ${theme === 'dark' ? 'border-gray-800' : 'border-gray-100'}`}
                                            >
                                                <td
                                                    className={`p-2 text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                                                >
                                                    {new Date(trade.timestamp).toLocaleTimeString()}
                                                </td>
                                                <td
                                                    className={`p-2 text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                                                >
                                                    {trade.contractType}
                                                </td>
                                                <td className='p-2'>
                                                    <Badge
                                                        variant={trade.result === 'WIN' ? 'default' : 'destructive'}
                                                        className={
                                                            trade.result === 'WIN'
                                                                ? 'bg-green-500 hover:bg-green-600'
                                                                : 'bg-red-500 hover:bg-red-600'
                                                        }
                                                    >
                                                        {trade.result}
                                                    </Badge>
                                                </td>
                                                <td
                                                    className={`p-2 text-sm text-right ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                                                >
                                                    ${trade.stake.toFixed(2)}
                                                </td>
                                                <td
                                                    className={`p-2 text-sm text-right font-bold ${
                                                        trade.profitLoss >= 0
                                                            ? theme === 'dark'
                                                                ? 'text-green-400'
                                                                : 'text-green-600'
                                                            : theme === 'dark'
                                                              ? 'text-red-400'
                                                              : 'text-red-600'
                                                    }`}
                                                >
                                                    {trade.profitLoss >= 0 ? '+' : ''}${trade.profitLoss.toFixed(2)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}

export { AutoBotTab as AutomatedTab };
