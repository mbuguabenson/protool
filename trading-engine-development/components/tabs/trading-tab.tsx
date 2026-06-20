'use client';
import { useCallback, useState, useEffect } from 'react';
import { useDerivAPI } from '@/lib/deriv-api-context';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Settings, AlertCircle, TrendingUp } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { TradingJournal } from '@/lib/trading-journal';
import { RiskManagementTab } from './risk-management-tab';
import { DigitPowerVisualizer } from '../digit-power-visualizer';
import { powerEngine, type PowerSnapshot } from '@/lib/high-speed/power-analytics-engine';
import { StrategyRouter, type TradeStrategy } from '@/lib/high-speed/strategy-router';
import { LayoutDashboard, Zap, ShieldCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ManualTrader } from './manual-trader';
import { AutoRunBot } from './autorun-bot';
import { SpeedBot } from './speedbot';
import { derivWebSocket } from '@/lib/deriv-websocket-manager';

interface TradingTabProps {
    theme?: 'light' | 'dark';
    symbol: string;
    onSymbolChange: (symbol: string) => void;
}

export function TradingTab({ theme: propTheme, symbol, onSymbolChange }: TradingTabProps) {
    const {
        apiClient,
        isConnected,
        isAuthorized,
        error,
        connectionStatus,
        token: globalApiToken,
        isLoggedIn,
        balance: globalBalance,
        accountType: globalAccountType,
        accountCode: globalAccountCode,
    } = useDerivAPI();

    const currentThemeFromProps = propTheme || 'dark';

    const balance = globalBalance?.amount || 0;
    const currency = globalBalance?.currency || 'USD';
    const accountType = globalAccountType || 'DEMO';
    const loginId = globalAccountCode || '';

    const [activeSymbols, setActiveSymbols] = useState<any[]>([]);
    const [markets, setMarkets] = useState<string[]>([]);
    const [submarkets, setSubmarkets] = useState<Record<string, string[]>>({});
    const [instruments, setInstruments] = useState<Record<string, any[]>>({});
    const [contractsCache, setContractsCache] = useState<Record<string, any>>({});
    const [loadingMarkets, setLoadingMarkets] = useState(false);
    const [marketError, setMarketError] = useState<string | null>(null);

    const [currentTheme, setCurrentTheme] = useState(currentThemeFromProps);
    const [activeTab, setActiveTab] = useState('manual');

    const [currentTick, setCurrentTick] = useState<number | null>(null);
    const [tickTimestamp, setTickTimestamp] = useState<string>('');

    // High-Speed Engine State
    const [powerSnapshot, setPowerSnapshot] = useState<PowerSnapshot | null>(null);
    const [selectedStrategy, setSelectedStrategy] = useState<TradeStrategy>('EVEN_ODD');
    const [autoBotConfig, setAutoBotConfig] = useState({
        stake: 1,
        martingale: 2.1,
        duration: 1,
        durationUnit: 't',
        autoBotEnabled: false,
        marketSwitchOnLoss: false,
        maxLossEnabled: false,
        maxLossAmount: 10,
    });

    // Initialize Strategy Router
    const [strategyRouter] = useState(() => new StrategyRouter(autoBotConfig));

    useEffect(() => {
        strategyRouter.setConfig(autoBotConfig);
    }, [autoBotConfig, strategyRouter]);

    const logJournal = useCallback((message: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') => {
        console.log(`[${type.toUpperCase()}] ${message}`);
    }, []);

    // Redundant connection effects removed. Context values used directly.

    // Removing redundant local states to avoid sync issues

    useEffect(() => {
        if (apiClient && isConnected && isAuthorized) {
            loadMarketsAndSymbols();
        }
    }, [apiClient, isConnected, isAuthorized]);

    const loadMarketsAndSymbols = async () => {
        if (!apiClient) {
            setMarketError('API client not available');
            return;
        }

        try {
            setLoadingMarkets(true);
            setMarketError(null);
            const symbols = await apiClient.getActiveSymbols();

            if (!symbols || symbols.length === 0) {
                setMarketError('No markets available');
                logJournal('No markets available from API', 'warn');
                return;
            }

            const continuousIndices = symbols.filter((symbol: any) => {
                const market = symbol.market?.toLowerCase() || '';
                const submarket = symbol.submarket?.toLowerCase() || '';
                const display = symbol.display_name?.toLowerCase() || '';

                return (
                    market === 'synthetic_index' ||
                    submarket.includes('crash') ||
                    submarket.includes('boom') ||
                    submarket.includes('volatility') ||
                    submarket.includes('jump') ||
                    submarket.includes('step') ||
                    display.includes('volatility') ||
                    display.includes('crash') ||
                    display.includes('boom')
                );
            });

            const marketGroups: Record<string, Record<string, any[]>> = {};
            const uniqueMarkets = new Set<string>();

            continuousIndices.forEach((symbol: any) => {
                const market = symbol.market || 'synthetic_index';
                const submarket = symbol.submarket || 'other';

                uniqueMarkets.add(market);

                if (!marketGroups[market]) {
                    marketGroups[market] = {};
                }
                if (!marketGroups[market][submarket]) {
                    marketGroups[market][submarket] = [];
                }
                marketGroups[market][submarket].push(symbol);
            });

            setMarkets(Array.from(uniqueMarkets));
            setSubmarkets(
                Object.keys(marketGroups).reduce(
                    (acc, market) => {
                        acc[market] = Object.keys(marketGroups[market]);
                        return acc;
                    },
                    {} as Record<string, string[]>
                )
            );
            setInstruments(
                Object.keys(marketGroups).reduce(
                    (acc, market) => {
                        Object.keys(marketGroups[market]).forEach(submarket => {
                            const key = `${market}_${submarket}`;
                            acc[key] = marketGroups[market][submarket];
                        });
                        return acc;
                    },
                    {} as Record<string, any[]>
                )
            );
            setActiveSymbols(continuousIndices);

            // Sync with passed symbol
            loadContractsForMarket(symbol);

            logJournal(
                `Continuous Indices loaded: ${uniqueMarkets.size} markets with ${continuousIndices.length} instruments`,
                'success'
            );
        } catch (error: any) {
            console.error('[v0] Error loading markets:', error);
            setMarketError(error.message || 'Failed to load markets');
            logJournal('Error loading markets: ' + error.message, 'error');
        } finally {
            setLoadingMarkets(false);
        }
    };

    const loadContractsForMarket = async (symbol: string) => {
        if (!apiClient || !symbol) return;

        try {
            const contracts = await apiClient.getContractsFor(symbol);

            if (!contracts || contracts.length === 0) {
                return;
            }

            const grouped: Record<string, any[]> = {};
            contracts.forEach((contract: any) => {
                const category = contract.contract_category || 'Other';
                if (!grouped[category]) {
                    grouped[category] = [];
                }
                grouped[category].push(contract);
            });

            setContractsCache(prev => ({
                ...prev,
                [symbol]: grouped,
            }));

            logJournal(`Contracts loaded for ${symbol}`, 'success');
        } catch (error: any) {
            console.error('[v0] Failed to load contracts:', error);
            logJournal(`Failed to load contracts for ${symbol}: ${error.message}`, 'error');
        }
    };

    useEffect(() => {
        if (!apiClient || !symbol || !isConnected || !isAuthorized) return;

        let tickSubscriptionId: string | null = null;

        const subscribeTicks = async () => {
            try {
                tickSubscriptionId = await apiClient.subscribeTicks(symbol, (tick: any) => {
                    if (tick.quote) {
                        const pipSize = apiClient.getPipSize(symbol);
                        setCurrentTick(tick.quote);
                        setTickTimestamp(new Date(tick.epoch * 1000).toLocaleTimeString());

                        // Trigger Power Engine
                        const price = tick.quote;
                        const lastDigit = derivWebSocket.extractLastDigit(price, pipSize);
                        const snapshot = powerEngine.addDigit(lastDigit);
                        setPowerSnapshot(snapshot);

                        // Trigger Strategy Router
                        strategyRouter.onTickUpdate(snapshot, selectedStrategy, symbol);
                    }
                });
            } catch (error: any) {
                console.error(`[v0] ❌ Failed to subscribe to ${symbol}:`, error.message || error);
            }
        };

        subscribeTicks();

        return () => {
            if (tickSubscriptionId && apiClient) {
                apiClient.forget(tickSubscriptionId).catch(() => {});
            }
        };
    }, [apiClient, symbol, isConnected, isAuthorized, selectedStrategy]);

    const [manualJournal] = useState(() => new TradingJournal('manual-trader'));
    const [autorunJournal] = useState(() => new TradingJournal('autorun-bot'));
    const [speedbotJournal] = useState(() => new TradingJournal('speedbot'));

    const [manualStats, setManualStats] = useState(manualJournal.getStats());
    const [autorunStats, setAutorunStats] = useState(autorunJournal.getStats());
    const [speedbotStats, setSpeedbotStats] = useState(speedbotJournal.getStats());

    useEffect(() => {
        manualJournal.on('stats-updated', setManualStats);
        autorunJournal.on('stats-updated', setAutorunStats);
        speedbotJournal.on('stats-updated', setSpeedbotStats);

        return () => {
            manualJournal.removeAllListeners();
            autorunJournal.removeAllListeners();
            speedbotJournal.removeAllListeners();
        };
    }, []);

    const handleSymbolChange = useCallback(
        (newSymbol: string) => {
            onSymbolChange(newSymbol);
            loadContractsForMarket(newSymbol);
        },
        [onSymbolChange]
    );

    return (
        <div
            className={`w-full rounded-lg p-3 sm:p-4 border ${currentTheme === 'dark' ? 'bg-linear-to-br from-[#0f1629]/80 to-[#1a2235]/80 border-blue-500/20' : 'bg-white border-gray-200'}`}
        >
            <div className='flex items-center justify-between mb-4 pb-3 border-b border-blue-500/20'>
                <div className='flex items-center gap-2'>
                    <div
                        className={`w-2 h-2 rounded-full ${isConnected && isAuthorized ? 'bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.5)]' : connectionStatus === 'reconnecting' || connectionStatus === 'connecting' ? 'bg-amber-400 animate-pulse' : 'bg-rose-400'}`}
                    />
                    <span
                        className={`text-[10px] font-black uppercase tracking-widest ${currentTheme === 'dark' ? 'text-slate-400' : 'text-gray-700'}`}
                    >
                        {connectionStatus === 'connecting'
                            ? 'Connecting'
                            : connectionStatus === 'reconnecting'
                              ? 'Reconnecting'
                              : isConnected && isAuthorized
                                ? 'System Online'
                                : 'Offline'}
                    </span>
                </div>

                <div className='flex items-center gap-3'>
                    <h2
                        className={`text-base sm:text-lg font-bold ${currentTheme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                    >
                        Trade Now - Continuous Indices
                    </h2>
                    <div className='flex items-center gap-3 bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-1.5 pl-3 pr-2 shadow-2xl transition-all hover:border-blue-500/30'>
                        <div className='flex flex-col items-end mr-3'>
                            <span className='text-[9px] font-black text-white/30 uppercase tracking-[0.2em] leading-none mb-1'>
                                AVAIL LIQUIDITY
                            </span>
                            <div className='flex items-baseline gap-1.5'>
                                <span className='text-[15px] font-black text-white tracking-tighter tabular-nums drop-shadow-md'>
                                    {balance.toLocaleString(undefined, {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                    })}
                                </span>
                                <span className='text-[9px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-1 py-0.5 rounded leading-none'>
                                    {currency}
                                </span>
                            </div>
                        </div>
                        <div
                            className={`h-10 px-4 rounded-xl flex items-center gap-2.5 font-black text-[10px] tracking-widest uppercase transition-all ${
                                accountType === 'DEMO'
                                    ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20'
                                    : 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/20 shadow-[0_0_15px_rgba(52,211,153,0.1)]'
                            }`}
                        >
                            <div
                                className={`w-1.5 h-1.5 rounded-full ${accountType === 'DEMO' ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`}
                            />
                            {accountType}
                        </div>
                    </div>
                    <Button
                        variant='ghost'
                        size='icon'
                        className='h-10 w-10 rounded-xl hover:bg-white/5 text-white/40 hover:text-white transition-all'
                    >
                        <Settings className='h-5 w-5' />
                    </Button>
                </div>
            </div>

            {error && (
                <div
                    className={`p-3 rounded-lg border mb-4 flex items-start gap-2 ${currentTheme === 'dark' ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-200'}`}
                >
                    <AlertCircle className='h-4 w-4 mt-0.5 shrink-0 text-red-400' />
                    <div>
                        <p
                            className={`text-sm font-medium ${currentTheme === 'dark' ? 'text-red-400' : 'text-red-600'}`}
                        >
                            Connection Error
                        </p>
                        <p className={`text-xs mt-1 ${currentTheme === 'dark' ? 'text-red-300' : 'text-red-500'}`}>
                            {error}
                        </p>
                    </div>
                </div>
            )}

            {!isConnected || !isAuthorized ? (
                <div
                    className={`p-10 rounded-2xl border text-center soft-card animate-in fade-in zoom-in duration-300 ${currentTheme === 'dark' ? 'bg-black/40 border-white/5' : 'bg-red-50 border-red-200'}`}
                >
                    <div className='flex justify-center mb-4'>
                        <div className='p-4 rounded-full bg-rose-500/10 border border-rose-500/20'>
                            <Zap className='w-8 h-8 text-rose-500 animate-pulse' />
                        </div>
                    </div>
                    <h3
                        className={`text-lg font-black uppercase tracking-widest mb-1 ${currentTheme === 'dark' ? 'text-white' : 'text-red-600'}`}
                    >
                        {connectionStatus === 'connecting'
                            ? 'Initializing Uplink'
                            : connectionStatus === 'reconnecting'
                              ? 'Restoring Connection'
                              : 'Authorization Required'}
                    </h3>
                    <p
                        className={`text-xs font-medium uppercase tracking-wider ${currentTheme === 'dark' ? 'text-slate-500' : 'text-gray-600'}`}
                    >
                        {isLoggedIn ? 'Authenticating with markets...' : 'Please connect your Deriv account to proceed'}
                    </p>
                    {!isLoggedIn && (
                        <Button
                            variant='outline'
                            className='mt-6 font-black uppercase tracking-widest border-blue-500/30 text-blue-400 hover:bg-blue-500/10'
                            onClick={() => window.dispatchEvent(new CustomEvent('open-login'))}
                        >
                            Sign In to Deriv
                        </Button>
                    )}
                </div>
            ) : (
                <>
                    <Card className='p-4 soft-card border-white/5 mb-4'>
                        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                            <div className='space-y-2'>
                                <label className='text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1'>
                                    Market Selector
                                </label>
                                <Select value={symbol} onValueChange={handleSymbolChange}>
                                    <SelectTrigger className='bg-white/5 border-white/10 text-white font-black uppercase tracking-wider h-10 rounded-lg'>
                                        <SelectValue placeholder='Select Symbol' />
                                    </SelectTrigger>
                                    <SelectContent
                                        className={
                                            currentTheme === 'dark' ? 'bg-[#0a0e27] border-blue-500/30 text-white' : ''
                                        }
                                    >
                                        {activeSymbols.map(s => (
                                            <SelectItem key={s.symbol} value={s.symbol}>
                                                {s.display_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className='flex items-center justify-end h-full'>
                                <Badge className='bg-blue-500/20 text-blue-400 border-blue-500/30 text-sm px-3 py-1 font-mono'>
                                    {symbol}
                                </Badge>
                            </div>
                        </div>
                    </Card>

                    {/* Redundant Price Card Removed - Using global price from Ticker */}

                    <Tabs value={activeTab} onValueChange={setActiveTab} className='w-full mt-4'>
                        <TabsList className='grid w-full grid-cols-4 mb-6 h-12 bg-white/[0.03] border border-white/5 rounded-xl p-1'>
                            <TabsTrigger
                                value='manual'
                                className='text-xs sm:text-sm font-semibold data-[state=active]:bg-blue-500 data-[state=active]:text-white gap-2'
                            >
                                <LayoutDashboard className='w-4 h-4 hidden sm:block' />
                                Manual
                            </TabsTrigger>
                            <TabsTrigger
                                value='autobot'
                                className='text-xs sm:text-sm font-semibold data-[state=active]:bg-orange-500 data-[state=active]:text-white gap-2'
                            >
                                <Zap className='w-4 h-4 hidden sm:block' />
                                Auto-Bot (Power)
                            </TabsTrigger>
                            <TabsTrigger
                                value='risk'
                                className='text-xs sm:text-sm font-semibold data-[state=active]:bg-indigo-500 data-[state=active]:text-white gap-2'
                            >
                                <ShieldCheck className='w-4 h-4 hidden sm:block' />
                                Risk Planning
                            </TabsTrigger>
                            <TabsTrigger
                                value='speedbot'
                                className='text-xs sm:text-sm font-semibold data-[state=active]:bg-purple-500 data-[state=active]:text-white gap-2'
                            >
                                SpeedBot
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value='autobot' className='space-y-6 mt-4'>
                            <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
                                <div className='lg:col-span-2'>
                                    <DigitPowerVisualizer snapshot={powerSnapshot} theme={currentTheme} />
                                </div>
                                <Card className='p-6 bg-black/40 border-white/5 backdrop-blur-xl space-y-4'>
                                    <div className='flex items-center justify-between'>
                                        <h3 className='font-bold text-orange-400'>Bot Controls</h3>
                                        <Button
                                            variant={autoBotConfig.autoBotEnabled ? 'destructive' : 'default'}
                                            size='sm'
                                            onClick={() =>
                                                setAutoBotConfig(prev => ({
                                                    ...prev,
                                                    autoBotEnabled: !prev.autoBotEnabled,
                                                }))
                                            }
                                        >
                                            {autoBotConfig.autoBotEnabled ? 'STOP BOT' : 'START BOT'}
                                        </Button>
                                    </div>

                                    <div className='space-y-2'>
                                        <label className='text-[10px] font-bold text-gray-500'>STRATEGY</label>
                                        <Select
                                            value={selectedStrategy}
                                            onValueChange={(v: any) => setSelectedStrategy(v)}
                                        >
                                            <SelectTrigger className='bg-white/5 border-white/10'>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value='EVEN_ODD'>Even / Odd Power</SelectItem>
                                                <SelectItem value='OVER_UNDER'>Over / Under Power</SelectItem>
                                                <SelectItem value='DIFFERS'>Smart Differs (2-7)</SelectItem>
                                                <SelectItem value='MATCHES'>High-Speed Matches</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className='grid grid-cols-2 gap-4'>
                                        <div className='space-y-1'>
                                            <label className='text-[10px] font-bold text-gray-500'>STAKE ($)</label>
                                            <Input
                                                type='number'
                                                value={autoBotConfig.stake}
                                                onChange={e =>
                                                    setAutoBotConfig(prev => ({
                                                        ...prev,
                                                        stake: Number(e.target.value),
                                                    }))
                                                }
                                                className='bg-white/5 border-white/10 h-8'
                                            />
                                        </div>
                                        <div className='space-y-1'>
                                            <label className='text-[10px] font-bold text-gray-500'>MARTINGALE</label>
                                            <Input
                                                type='number'
                                                value={autoBotConfig.martingale}
                                                onChange={e =>
                                                    setAutoBotConfig(prev => ({
                                                        ...prev,
                                                        martingale: Number(e.target.value),
                                                    }))
                                                }
                                                className='bg-white/5 border-white/10 h-8'
                                            />
                                        </div>
                                    </div>

                                    <div className='p-3 rounded-lg bg-orange-500/10 border border-orange-500/20'>
                                        <p className='text-[10px] text-orange-400 leading-relaxed uppercase font-bold text-center'>
                                            {autoBotConfig.autoBotEnabled
                                                ? 'Bot is scanning markets...'
                                                : 'Configure & Start to Automate'}
                                        </p>
                                    </div>
                                </Card>
                            </div>
                        </TabsContent>

                        <TabsContent value='risk' className='mt-4'>
                            <RiskManagementTab />
                        </TabsContent>

                        <TabsContent value='manual' className='space-y-4 mt-4'>
                            <ManualTrader
                                apiClient={apiClient}
                                isAuthorized={isAuthorized}
                                balance={balance}
                                currency={currency}
                                theme={currentTheme}
                                activeSymbols={activeSymbols}
                                contractsCache={contractsCache}
                                journal={manualJournal}
                                selectedSymbol={symbol}
                            />
                        </TabsContent>

                        <TabsContent value='autorun' className='space-y-4 mt-4'>
                            <AutoRunBot
                                apiClient={apiClient}
                                isAuthorized={isAuthorized}
                                balance={balance}
                                currency={currency}
                                theme={currentTheme}
                                activeSymbols={activeSymbols}
                                contractsCache={contractsCache}
                                journal={autorunJournal}
                                selectedSymbol={symbol}
                            />
                        </TabsContent>

                        <TabsContent value='speedbot' className='space-y-4 mt-4'>
                            <SpeedBot
                                apiClient={apiClient}
                                isAuthorized={isAuthorized}
                                balance={balance}
                                currency={currency}
                                theme={currentTheme}
                                activeSymbols={activeSymbols}
                                contractsCache={contractsCache}
                                journal={speedbotJournal}
                                selectedSymbol={symbol}
                            />
                        </TabsContent>
                    </Tabs>
                </>
            )}
        </div>
    );
}
