'use client';

import { useState, useEffect, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Activity, Zap, X, Eye, Power, Layers } from 'lucide-react';
import { derivWebSocket } from '@/lib/deriv-websocket-manager';

interface MarketData {
    symbol: string;
    displayName: string;
    currentPrice: number;
    lastDigit: number;
    last100Digits: number[];
    analysis: {
        under: { count: number; percentage: number; signal: 'WAIT' | 'TRADE NOW' };
        over: { count: number; percentage: number; signal: 'WAIT' | 'TRADE NOW' };
        even: { count: number; percentage: number; signal: 'WAIT' | 'TRADE NOW' };
        odd: { count: number; percentage: number; signal: 'WAIT' | 'TRADE NOW' };
        differs: { digit: number; count: number; percentage: number; signal: 'WAIT' | 'TRADE NOW' };
    };
}

interface TradeSignal {
    market: string;
    tradeType: string;
    entryPoint: string;
    validity: string;
    confidence: number;
    conditions: string[];
    category: 'even-odd' | 'over-under' | 'differs';
}

// Dynamic markets instead of hardcoded list

interface SuperSignalsTabProps {
    theme?: 'light' | 'dark';
    symbol?: string;
    availableSymbols?: any[];
    onSymbolChange?: (symbol: string) => void;
    maxTicks?: number;
}

export function SuperSignalsTab({
    theme = 'dark',
    symbol,
    availableSymbols,
    onSymbolChange,
    maxTicks = 100,
}: SuperSignalsTabProps) {
    const [marketsData, setMarketsData] = useState<Map<string, MarketData>>(new Map());
    const [tradeSignals, setTradeSignals] = useState<TradeSignal[]>([]);
    const [showSignalPopup, setShowSignalPopup] = useState(false);
    const [autoShowSignals, setAutoShowSignals] = useState(true);
    const [signalsDeactivated, setSignalsDeactivated] = useState(false);
    const subscriptionIdsRef = useRef<Map<string, string>>(new Map());
    const callbacksRef = useRef<Map<string, (tick: any) => void>>(new Map());
    const isInitializedRef = useRef(false);
    const maxTicksRef = useRef(maxTicks);

    useEffect(() => {
        maxTicksRef.current = maxTicks;
    }, [maxTicks]);

    useEffect(() => {
        if (isInitializedRef.current) return;
        isInitializedRef.current = true;

        const initMarkets = async () => {
            if (!availableSymbols || availableSymbols.length === 0) return;

            const initialData = new Map<string, MarketData>();
            // For SuperSignalsTab, we want ALL Derived (Synthetic) markets
            // which typically start with R_ (Volatility) or include 1HZ (1s Volatility)
            // or other synthetic prefixes like D_ (Daily Reset), etc.
            const targetMarkets = availableSymbols
                .filter(
                    s =>
                        s.market === 'synthetic_index' ||
                        s.market_display_name?.toLowerCase().includes('derived') ||
                        s.symbol.startsWith('R_') ||
                        s.symbol.includes('1HZ') ||
                        s.symbol.startsWith('BOOM') ||
                        s.symbol.startsWith('CRASH') ||
                        s.symbol.startsWith('JD') // Jump
                )
                .slice(0, 20); // Limit to top 20 for performance (expanded from 10)

            targetMarkets.forEach(market => {
                initialData.set(market.symbol, {
                    symbol: market.symbol,
                    displayName: market.display_name,
                    currentPrice: 0,
                    lastDigit: 0,
                    last100Digits: [],
                    analysis: {
                        under: { count: 0, percentage: 0, signal: 'WAIT' },
                        over: { count: 0, percentage: 0, signal: 'WAIT' },
                        even: { count: 0, percentage: 0, signal: 'WAIT' },
                        odd: { count: 0, percentage: 0, signal: 'WAIT' },
                        differs: { digit: 0, count: 0, percentage: 0, signal: 'WAIT' },
                    },
                });
            });

            setMarketsData(initialData);

            try {
                console.log('[v0] Initializing dynamic subscriptions for SuperSignalsTab...');

                for (const market of targetMarkets) {
                    const callback = (tick: any) => {
                        setMarketsData(prev => {
                            const updated = new Map(prev);
                            const marketData = updated.get(market.symbol);
                            if (!marketData) return prev;

                            const currentPrice = tick.quote;
                            const lastDigit = tick.lastDigit;
                            const currentMaxTicks = maxTicksRef.current;
                            const newDigits = [...marketData.last100Digits, lastDigit].slice(-currentMaxTicks);

                            // Analysis logic
                            const total = newDigits.length || 1;
                            const underCount = newDigits.filter(d => d < 5).length;
                            const overCount = newDigits.filter(d => d >= 5).length;
                            const evenCount = newDigits.filter(d => d % 2 === 0).length;
                            const oddCount = newDigits.filter(d => d % 2 === 1).length;

                            const digitCounts = Array(10).fill(0);
                            newDigits.forEach(d => digitCounts[d]++);
                            const minCount = Math.min(...digitCounts);
                            const leastFrequentDigit = digitCounts.indexOf(minCount);

                            const analysis: MarketData['analysis'] = {
                                under: {
                                    count: underCount,
                                    percentage: (underCount / total) * 100,
                                    signal: underCount / total >= 0.6 ? 'TRADE NOW' : 'WAIT',
                                },
                                over: {
                                    count: overCount,
                                    percentage: (overCount / total) * 100,
                                    signal: overCount / total >= 0.6 ? 'TRADE NOW' : 'WAIT',
                                },
                                even: {
                                    count: evenCount,
                                    percentage: (evenCount / total) * 100,
                                    signal: evenCount / total >= 0.6 ? 'TRADE NOW' : 'WAIT',
                                },
                                odd: {
                                    count: oddCount,
                                    percentage: (oddCount / total) * 100,
                                    signal: oddCount / total >= 0.6 ? 'TRADE NOW' : 'WAIT',
                                },
                                differs: {
                                    digit: leastFrequentDigit,
                                    count: minCount,
                                    percentage: 100 - (minCount / total) * 100,
                                    signal: minCount / total <= 0.05 ? 'TRADE NOW' : 'WAIT',
                                },
                            };

                            updated.set(market.symbol, {
                                ...marketData,
                                currentPrice,
                                lastDigit,
                                last100Digits: newDigits,
                                analysis,
                            });

                            if (newDigits.length >= 50) {
                                checkForTradeSignal(market.symbol, marketData.displayName, analysis, currentPrice);
                            }

                            return updated;
                        });
                    };

                    callbacksRef.current.set(market.symbol, callback);
                    const subscriptionId = await derivWebSocket.subscribeTicks(market.symbol, callback);
                    subscriptionIdsRef.current.set(market.symbol, subscriptionId);
                }
            } catch (error) {
                console.error('[v0] Failed to subscribe to ticks:', error);
            }
        };

        initMarkets();

        return () => {
            // Cleanup: Unsubscribe from all active markets
            marketsData.forEach((_, symbol) => {
                const subId = subscriptionIdsRef.current.get(symbol);
                const callback = callbacksRef.current.get(symbol);
                if (subId && callback) {
                    derivWebSocket.unsubscribe(subId, callback);
                }
            });
            subscriptionIdsRef.current.clear();
            callbacksRef.current.clear();
        };
    }, [availableSymbols]); // Re-run when symbols load

    const checkForTradeSignal = (
        symbol: string,
        displayName: string,
        analysis: MarketData['analysis'],
        price: number
    ) => {
        if (signalsDeactivated) return;

        const signals: TradeSignal[] = [];

        if (analysis.under.signal === 'TRADE NOW') {
            signals.push({
                market: displayName,
                tradeType: 'Under (0-4)',
                entryPoint: (price || 0).toFixed(5),
                validity: '5 ticks',
                confidence: analysis.under.percentage,
                category: 'over-under',
                conditions: [
                    `Under digits: ${analysis.under.count}/${maxTicksRef.current} (${analysis.under.percentage.toFixed(1)}%)`,
                    `Strong dominance detected`,
                    `Entry confidence: HIGH`,
                ],
            });
        }

        if (analysis.over.signal === 'TRADE NOW') {
            signals.push({
                market: displayName,
                tradeType: 'Over (5-9)',
                entryPoint: (price || 0).toFixed(5),
                validity: '5 ticks',
                confidence: analysis.over.percentage,
                category: 'over-under',
                conditions: [
                    `Over digits: ${analysis.over.count}/${maxTicksRef.current} (${analysis.over.percentage.toFixed(1)}%)`,
                    `Strong dominance detected`,
                    `Entry confidence: HIGH`,
                ],
            });
        }

        if (analysis.even.signal === 'TRADE NOW') {
            signals.push({
                market: displayName,
                tradeType: 'Even',
                entryPoint: (price || 0).toFixed(5),
                validity: '5 ticks',
                confidence: analysis.even.percentage,
                category: 'even-odd',
                conditions: [
                    `Even digits: ${analysis.even.count}/${maxTicksRef.current} (${analysis.even.percentage.toFixed(1)}%)`,
                    `Strong pattern detected`,
                    `Entry confidence: HIGH`,
                ],
            });
        }

        if (analysis.odd.signal === 'TRADE NOW') {
            signals.push({
                market: displayName,
                tradeType: 'Odd',
                entryPoint: (price || 0).toFixed(5),
                validity: '5 ticks',
                confidence: analysis.odd.percentage,
                category: 'even-odd',
                conditions: [
                    `Odd digits: ${analysis.odd.count}/${maxTicksRef.current} (${analysis.odd.percentage.toFixed(1)}%)`,
                    `Strong pattern detected`,
                    `Entry confidence: HIGH`,
                ],
            });
        }

        if (analysis.differs.signal === 'TRADE NOW') {
            signals.push({
                market: displayName,
                tradeType: `Differs (${analysis.differs.digit})`,
                entryPoint: (price || 0).toFixed(5),
                validity: '5 ticks',
                confidence: analysis.differs.percentage,
                category: 'differs',
                conditions: [
                    `Digit ${analysis.differs.digit} rarely appears: ${analysis.differs.count}/${maxTicksRef.current}`,
                    `High probability of difference`,
                    `Entry confidence: HIGH`,
                ],
            });
        }

        if (signals.length > 0) {
            setTradeSignals(prev => {
                const uniqueSignals = [...prev];
                signals.forEach(signal => {
                    const exists = uniqueSignals.some(
                        s => s.market === signal.market && s.tradeType === signal.tradeType
                    );
                    if (!exists) {
                        uniqueSignals.push(signal);
                    }
                });
                return uniqueSignals;
            });
            if (autoShowSignals) {
                setShowSignalPopup(true);
            }
        }
    };

    const handleCloseAllSignals = () => {
        setShowSignalPopup(false);
    };

    const handleDismissPopup = () => {
        setShowSignalPopup(false);
    };

    const handleDeactivateSignals = () => {
        setSignalsDeactivated(true);
        setShowSignalPopup(false);
        setAutoShowSignals(false);
        setTradeSignals([]);
    };

    const handleReactivateSignals = () => {
        setSignalsDeactivated(false);
        setAutoShowSignals(true);
    };

    const handleShowActiveSignals = () => {
        if (tradeSignals.length > 0 && !signalsDeactivated) {
            setShowSignalPopup(true);
        }
    };

    const handleCloseSignal = (idx: number) => {
        setTradeSignals(prev => prev.filter((_, index) => index !== idx));
    };

    const totalMarkets = Array.from(marketsData.values());
    const marketsWithSignals = totalMarkets.filter(
        m =>
            m.analysis.under.signal === 'TRADE NOW' ||
            m.analysis.over.signal === 'TRADE NOW' ||
            m.analysis.even.signal === 'TRADE NOW' ||
            m.analysis.odd.signal === 'TRADE NOW' ||
            m.analysis.differs.signal === 'TRADE NOW'
    );

    return (
        <div className='space-y-6 pb-10'>
            {/* Header Section */}
            <div
                className={`rounded-lg p-6 border ${
                    theme === 'dark'
                        ? 'bg-gradient-to-br from-[#0f1629]/80 to-[#1a2235]/80 border-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.2)]'
                        : 'bg-white/80 backdrop-blur-xl border-blue-200 shadow-[0_8px_32px_rgba(31,38,135,0.15)]'
                }`}
            >
                <div className='flex items-center justify-between mb-6 flex-wrap gap-4'>
                    <h2
                        className={`text-2xl md:text-3xl font-bold ${theme === 'dark' ? 'bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent' : 'bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent'}`}
                    >
                        Super Signals - Multi-Market Analysis
                    </h2>
                    <div className='flex items-center gap-4'>
                        {signalsDeactivated ? (
                            <Button
                                onClick={handleReactivateSignals}
                                className='bg-green-500 hover:bg-green-600 text-white flex items-center gap-2'
                            >
                                <Power className='h-4 w-4' />
                                Activate Signals
                            </Button>
                        ) : (
                            <>
                                <div className='flex items-center gap-2'>
                                    <Switch
                                        checked={autoShowSignals}
                                        onCheckedChange={setAutoShowSignals}
                                        className='data-[state=checked]:bg-green-500'
                                    />
                                    <Label
                                        className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                                    >
                                        Auto-show signals
                                    </Label>
                                </div>
                                {tradeSignals.length > 0 && (
                                    <Button
                                        onClick={handleShowActiveSignals}
                                        className='bg-emerald-500 hover:bg-emerald-600 text-white flex items-center gap-2'
                                    >
                                        <Eye className='h-4 w-4' />
                                        View Signals ({tradeSignals.length})
                                    </Button>
                                )}
                                <Button
                                    onClick={handleDeactivateSignals}
                                    variant='destructive'
                                    className='flex items-center gap-2'
                                >
                                    <Power className='h-4 w-4' />
                                    Deactivate All
                                </Button>
                            </>
                        )}
                        <Badge className='bg-emerald-500 text-white text-sm px-4 py-2 animate-pulse flex items-center gap-2'>
                            <Activity className='h-4 w-4' />
                            {signalsDeactivated ? 'Signals Inactive' : `Live Monitoring ${marketsData.size} Markets`}
                        </Badge>
                    </div>
                </div>

                <div className='grid grid-cols-1 md:grid-cols-3 gap-4 mb-6'>
                    <div
                        className={`rounded-lg p-4 border ${theme === 'dark' ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50 border-blue-200'}`}
                    >
                        <div className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                            Total Markets
                        </div>
                        <div className={`text-2xl font-bold ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>
                            {marketsData.size}
                        </div>
                    </div>
                    <div
                        className={`rounded-lg p-4 border ${theme === 'dark' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200'}`}
                    >
                        <div className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                            Active Signals
                        </div>
                        <div
                            className={`text-2xl font-bold ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}
                        >
                            {marketsWithSignals.length}
                        </div>
                    </div>
                    <div
                        className={`rounded-lg p-4 border ${theme === 'dark' ? 'bg-purple-500/10 border-purple-500/30' : 'bg-purple-50 border-purple-200'}`}
                    >
                        <div className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                            Analyzed Ticks
                        </div>
                        <div
                            className={`text-2xl font-bold ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`}
                        >
                            {maxTicks}
                        </div>
                    </div>
                </div>
            </div>

            {/* Markets Comparison Section */}
            {marketsWithSignals.length > 1 && (
                <div
                    className={`rounded-lg p-6 border ${
                        theme === 'dark'
                            ? 'bg-gradient-to-br from-indigo-500/10 to-purple-500/5 border-indigo-500/30'
                            : 'bg-indigo-50/50 border-indigo-200'
                    }`}
                >
                    <h3
                        className={`text-lg font-bold mb-4 flex items-center gap-2 ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-700'}`}
                    >
                        <Layers className='w-5 h-5' />
                        Top Markets by Signal Strength
                    </h3>
                    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3'>
                        {marketsWithSignals.slice(0, 4).map(market => {
                            const maxSignal = Math.max(
                                market.analysis.even.percentage,
                                market.analysis.odd.percentage,
                                market.analysis.under.percentage,
                                market.analysis.over.percentage
                            );
                            const signalType =
                                maxSignal === market.analysis.even.percentage
                                    ? 'EVEN'
                                    : maxSignal === market.analysis.odd.percentage
                                      ? 'ODD'
                                      : maxSignal === market.analysis.under.percentage
                                        ? 'UNDER'
                                        : 'OVER';

                            return (
                                <div
                                    key={market.symbol}
                                    className={`p-4 rounded-lg border ${
                                        theme === 'dark'
                                            ? 'bg-gray-900/60 border-indigo-500/40 hover:border-indigo-500/60'
                                            : 'bg-white/70 border-indigo-300 hover:border-indigo-400'
                                    } transition-all`}
                                >
                                    <div className='flex items-center justify-between mb-2'>
                                        <h4
                                            className={`font-bold text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                                        >
                                            {market.displayName}
                                        </h4>
                                        <Badge
                                            className={`text-xs ${theme === 'dark' ? 'bg-indigo-500/50 text-indigo-200' : 'bg-indigo-200 text-indigo-900'}`}
                                        >
                                            {signalType}
                                        </Badge>
                                    </div>
                                    <div className='flex items-center gap-2 mb-2'>
                                        <div
                                            className={`flex-1 h-2 rounded-full ${theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-200'}`}
                                        >
                                            <div
                                                className='h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500'
                                                style={{ width: `${maxSignal}%` }}
                                            />
                                        </div>
                                        <span
                                            className={`text-sm font-bold w-10 text-right ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}`}
                                        >
                                            {maxSignal.toFixed(0)}%
                                        </span>
                                    </div>
                                    <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                                        Price:{' '}
                                        <span className='font-bold text-cyan-400'>
                                            {(market.currentPrice || 0).toFixed(5)}
                                        </span>
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Markets Grid - Modern Card Design */}
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                {totalMarkets.map(market => {
                    const hasSignal =
                        market.analysis.under.signal === 'TRADE NOW' ||
                        market.analysis.over.signal === 'TRADE NOW' ||
                        market.analysis.even.signal === 'TRADE NOW' ||
                        market.analysis.odd.signal === 'TRADE NOW' ||
                        market.analysis.differs.signal === 'TRADE NOW';

                    // Calculate signal strength
                    const signals = [];
                    if (market.analysis.under.signal === 'TRADE NOW') signals.push(market.analysis.under.percentage);
                    if (market.analysis.over.signal === 'TRADE NOW') signals.push(market.analysis.over.percentage);
                    if (market.analysis.even.signal === 'TRADE NOW') signals.push(market.analysis.even.percentage);
                    if (market.analysis.odd.signal === 'TRADE NOW') signals.push(market.analysis.odd.percentage);
                    if (market.analysis.differs.signal === 'TRADE NOW')
                        signals.push(market.analysis.differs.percentage);

                    const avgConfidence = signals.length > 0 ? signals.reduce((a, b) => a + b, 0) / signals.length : 0;

                    return (
                        <Card
                            key={market.symbol}
                            className={`p-5 border transition-all duration-300 ${
                                hasSignal
                                    ? theme === 'dark'
                                        ? 'border-green-500/60 bg-gradient-to-br from-green-500/15 to-emerald-500/5 shadow-[0_0_25px_rgba(34,197,94,0.25)]'
                                        : 'border-green-400/60 bg-gradient-to-br from-green-50 to-emerald-50/50 shadow-[0_8px_24px_rgba(34,197,94,0.15)]'
                                    : theme === 'dark'
                                      ? 'border-gray-700/50 bg-gray-900/40 hover:bg-gray-800/50'
                                      : 'border-gray-200 bg-white/50 hover:bg-white/70'
                            }`}
                        >
                            {/* Market Header */}
                            <div className='flex items-start justify-between mb-4'>
                                <div className='flex-1 min-w-0'>
                                    <h3
                                        className={`text-sm font-bold truncate ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                                    >
                                        {market.displayName}
                                    </h3>
                                    <p
                                        className={`text-xs mt-0.5 font-mono ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                                    >
                                        {market.symbol}
                                    </p>
                                </div>
                                {hasSignal && (
                                    <div className='ml-2 px-2 py-1 rounded-md bg-green-500/20 border border-green-500/50'>
                                        <Zap className='h-3.5 w-3.5 text-green-500' />
                                    </div>
                                )}
                            </div>

                            {/* Price & Digit Info */}
                            <div className='space-y-3 mb-4'>
                                <div className='grid grid-cols-2 gap-3'>
                                    <div
                                        className={`p-2.5 rounded-lg ${theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-gray-100/50 border border-gray-200'}`}
                                    >
                                        <span
                                            className={`text-xs font-semibold ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                                        >
                                            Price
                                        </span>
                                        <div
                                            className={`text-sm font-bold mt-1 ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'}`}
                                        >
                                            {(market.currentPrice || 0).toFixed(5)}
                                        </div>
                                    </div>
                                    <div
                                        className={`p-2.5 rounded-lg ${theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-gray-100/50 border border-gray-200'}`}
                                    >
                                        <span
                                            className={`text-xs font-semibold ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                                        >
                                            Last Digit
                                        </span>
                                        <div
                                            className={`text-sm font-bold mt-1 ${theme === 'dark' ? 'text-orange-400' : 'text-orange-600'}`}
                                        >
                                            {market.lastDigit !== null && market.lastDigit !== undefined
                                                ? market.lastDigit
                                                : '—'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Signal Analysis */}
                            {market.last100Digits.length >= Math.min(maxTicks, 25) && (
                                <div className='space-y-2 mb-4 pt-4 border-t border-white/10'>
                                    <div className='flex items-center justify-between mb-2'>
                                        <span
                                            className={`text-xs font-semibold ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                                        >
                                            Signal Status
                                        </span>
                                        {hasSignal && (
                                            <span
                                                className={`text-xs font-bold px-2 py-1 rounded-full ${theme === 'dark' ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'}`}
                                            >
                                                {signals.length} Signal{signals.length !== 1 ? 's' : ''}
                                            </span>
                                        )}
                                    </div>

                                    <div className='space-y-2'>
                                        {/* Even/Odd Analysis */}
                                        <div
                                            className={`p-2.5 rounded-lg ${theme === 'dark' ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-blue-50/50 border border-blue-200/50'}`}
                                        >
                                            <div className='text-xs font-bold mb-2 flex items-center justify-between'>
                                                <span className={theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}>
                                                    Even/Odd
                                                </span>
                                                <span
                                                    className={`text-xs px-2 py-0.5 rounded ${market.analysis.even.signal === 'TRADE NOW' || market.analysis.odd.signal === 'TRADE NOW' ? (theme === 'dark' ? 'bg-green-500/30 text-green-300' : 'bg-green-100 text-green-700') : theme === 'dark' ? 'bg-gray-500/20 text-gray-400' : 'bg-gray-200 text-gray-600'}`}
                                                >
                                                    {Math.max(
                                                        market.analysis.even.percentage,
                                                        market.analysis.odd.percentage
                                                    ).toFixed(0)}
                                                    %
                                                </span>
                                            </div>
                                            <div className='space-y-1'>
                                                <div className='flex items-center gap-1.5 text-[10px]'>
                                                    <span
                                                        className={`w-8 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                                                    >
                                                        Even:
                                                    </span>
                                                    <div
                                                        className={`flex-1 h-1.5 rounded-full ${theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-200'}`}
                                                    >
                                                        <div
                                                            className={`h-full rounded-full transition-all ${market.analysis.even.signal === 'TRADE NOW' ? 'bg-green-500' : 'bg-blue-400'}`}
                                                            style={{
                                                                width: `${Math.min(market.analysis.even.percentage, 100)}%`,
                                                            }}
                                                        />
                                                    </div>
                                                    <span
                                                        className={`w-10 text-right font-bold ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
                                                    >
                                                        {market.analysis.even.percentage.toFixed(0)}%
                                                    </span>
                                                </div>
                                                <div className='flex items-center gap-1.5 text-[10px]'>
                                                    <span
                                                        className={`w-8 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                                                    >
                                                        Odd:
                                                    </span>
                                                    <div
                                                        className={`flex-1 h-1.5 rounded-full ${theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-200'}`}
                                                    >
                                                        <div
                                                            className={`h-full rounded-full transition-all ${market.analysis.odd.signal === 'TRADE NOW' ? 'bg-green-500' : 'bg-blue-400'}`}
                                                            style={{
                                                                width: `${Math.min(market.analysis.odd.percentage, 100)}%`,
                                                            }}
                                                        />
                                                    </div>
                                                    <span
                                                        className={`w-10 text-right font-bold ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
                                                    >
                                                        {market.analysis.odd.percentage.toFixed(0)}%
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Under/Over Analysis */}
                                        <div
                                            className={`p-2.5 rounded-lg ${theme === 'dark' ? 'bg-purple-500/10 border border-purple-500/20' : 'bg-purple-50/50 border border-purple-200/50'}`}
                                        >
                                            <div className='text-xs font-bold mb-2 flex items-center justify-between'>
                                                <span
                                                    className={theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}
                                                >
                                                    Under/Over
                                                </span>
                                                <span
                                                    className={`text-xs px-2 py-0.5 rounded ${market.analysis.under.signal === 'TRADE NOW' || market.analysis.over.signal === 'TRADE NOW' ? (theme === 'dark' ? 'bg-green-500/30 text-green-300' : 'bg-green-100 text-green-700') : theme === 'dark' ? 'bg-gray-500/20 text-gray-400' : 'bg-gray-200 text-gray-600'}`}
                                                >
                                                    {Math.max(
                                                        market.analysis.under.percentage,
                                                        market.analysis.over.percentage
                                                    ).toFixed(0)}
                                                    %
                                                </span>
                                            </div>
                                            <div className='space-y-1'>
                                                <div className='flex items-center gap-1.5 text-[10px]'>
                                                    <span
                                                        className={`w-8 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                                                    >
                                                        Under:
                                                    </span>
                                                    <div
                                                        className={`flex-1 h-1.5 rounded-full ${theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-200'}`}
                                                    >
                                                        <div
                                                            className={`h-full rounded-full transition-all ${market.analysis.under.signal === 'TRADE NOW' ? 'bg-green-500' : 'bg-purple-400'}`}
                                                            style={{
                                                                width: `${Math.min(market.analysis.under.percentage, 100)}%`,
                                                            }}
                                                        />
                                                    </div>
                                                    <span
                                                        className={`w-10 text-right font-bold ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
                                                    >
                                                        {market.analysis.under.percentage.toFixed(0)}%
                                                    </span>
                                                </div>
                                                <div className='flex items-center gap-1.5 text-[10px]'>
                                                    <span
                                                        className={`w-8 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                                                    >
                                                        Over:
                                                    </span>
                                                    <div
                                                        className={`flex-1 h-1.5 rounded-full ${theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-200'}`}
                                                    >
                                                        <div
                                                            className={`h-full rounded-full transition-all ${market.analysis.over.signal === 'TRADE NOW' ? 'bg-green-500' : 'bg-purple-400'}`}
                                                            style={{
                                                                width: `${Math.min(market.analysis.over.percentage, 100)}%`,
                                                            }}
                                                        />
                                                    </div>
                                                    <span
                                                        className={`w-10 text-right font-bold ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
                                                    >
                                                        {market.analysis.over.percentage.toFixed(0)}%
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Entry/Exit Information */}
                                        {hasSignal && (
                                            <div
                                                className={`p-2.5 rounded-lg ${theme === 'dark' ? 'bg-green-500/10 border border-green-500/20' : 'bg-green-50/50 border border-green-200/50'}`}
                                            >
                                                <div
                                                    className={`text-xs font-bold mb-2 ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}
                                                >
                                                    Entry Conditions
                                                </div>
                                                <p
                                                    className={`text-[10px] leading-snug ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
                                                >
                                                    {market.analysis.even.signal === 'TRADE NOW'
                                                        ? `Enter EVEN at ${market.analysis.even.percentage.toFixed(0)}% confidence. `
                                                        : ''}
                                                    {market.analysis.odd.signal === 'TRADE NOW'
                                                        ? `Enter ODD at ${market.analysis.odd.percentage.toFixed(0)}% confidence. `
                                                        : ''}
                                                    {market.analysis.under.signal === 'TRADE NOW'
                                                        ? `Enter UNDER at ${market.analysis.under.percentage.toFixed(0)}% confidence. `
                                                        : ''}
                                                    {market.analysis.over.signal === 'TRADE NOW'
                                                        ? `Enter OVER at ${market.analysis.over.percentage.toFixed(0)}% confidence.`
                                                        : ''}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </Card>
                    );
                })}
            </div>

            {showSignalPopup && tradeSignals.length > 0 && !signalsDeactivated && (
                <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm'>
                    <div className='max-w-6xl w-full max-h-[85vh] overflow-hidden flex flex-col bg-gray-900/95 rounded-2xl'>
                        <div className='flex justify-between items-center p-4 border-b border-white/10 flex-shrink-0'>
                            <h3 className='text-xl font-bold text-white flex items-center gap-2'>
                                <Zap className='h-5 w-5 text-yellow-400' />
                                Active Trade Signals ({tradeSignals.length})
                            </h3>
                            <div className='flex items-center gap-2'>
                                <Button
                                    onClick={handleDismissPopup}
                                    variant='outline'
                                    size='sm'
                                    className='bg-orange-700/50 hover:bg-orange-700 border-orange-600 text-white'
                                >
                                    Dismiss
                                </Button>
                                <Button
                                    onClick={handleDeactivateSignals}
                                    variant='outline'
                                    size='sm'
                                    className='bg-red-700/50 hover:bg-red-700 border-red-600 text-white'
                                >
                                    <Power className='h-4 w-4 mr-2' />
                                    Deactivate All
                                </Button>
                                <Button
                                    onClick={handleCloseAllSignals}
                                    variant='outline'
                                    size='sm'
                                    className='bg-red-500/20 hover:bg-red-500/30 border-red-500/50 text-white'
                                >
                                    <X className='h-4 w-4 mr-2' />
                                    Clear All
                                </Button>
                            </div>
                        </div>

                        <div className='overflow-y-auto p-4 flex-1'>
                            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                                {tradeSignals.map((signal, idx) => {
                                    const bgColors = {
                                        'even-odd':
                                            theme === 'dark'
                                                ? 'from-green-900/90 to-emerald-900/90 border-green-500/50 shadow-[0_0_30px_rgba(34,197,94,0.5)]'
                                                : 'from-green-50 to-emerald-50 border-green-400',
                                        'over-under':
                                            theme === 'dark'
                                                ? 'from-blue-900/90 to-cyan-900/90 border-blue-500/50 shadow-[0_0_30px_rgba(59,130,246,0.5)]'
                                                : 'from-blue-50 to-cyan-50 border-blue-400',
                                        differs:
                                            theme === 'dark'
                                                ? 'from-purple-900/90 to-violet-900/90 border-purple-500/50 shadow-[0_0_30px_rgba(168,85,247,0.5)]'
                                                : 'from-purple-50 to-violet-50 border-purple-400',
                                    };

                                    const textColors = {
                                        'even-odd': theme === 'dark' ? 'text-green-400' : 'text-green-600',
                                        'over-under': theme === 'dark' ? 'text-blue-400' : 'text-blue-600',
                                        differs: theme === 'dark' ? 'text-purple-400' : 'text-purple-600',
                                    };

                                    return (
                                        <div
                                            key={idx}
                                            className={`bg-gradient-to-br ${bgColors[signal.category]} border-2 rounded-xl p-4 relative`}
                                        >
                                            <Button
                                                onClick={() => handleCloseSignal(idx)}
                                                variant='ghost'
                                                size='icon'
                                                className='absolute top-2 right-2 h-6 w-6 hover:bg-white/10'
                                            >
                                                <X className='h-4 w-4' />
                                            </Button>

                                            <div
                                                className={`text-xl font-bold flex items-center gap-2 mb-3 ${textColors[signal.category]}`}
                                            >
                                                <Zap className='h-5 w-5' />
                                                TRADE NOW!
                                            </div>

                                            <div
                                                className={`p-3 rounded-lg border mb-3 ${theme === 'dark' ? 'bg-gray-900/50 border-white/10' : 'bg-white border-gray-200'}`}
                                            >
                                                <div className='space-y-2 text-xs'>
                                                    <div className='flex justify-between'>
                                                        <span
                                                            className={
                                                                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                                                            }
                                                        >
                                                            Market:
                                                        </span>
                                                        <div
                                                            className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                                                        >
                                                            {signal.market}
                                                        </div>
                                                    </div>
                                                    <div className='flex justify-between'>
                                                        <span
                                                            className={
                                                                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                                                            }
                                                        >
                                                            Type:
                                                        </span>
                                                        <div className={`font-bold ${textColors[signal.category]}`}>
                                                            {signal.tradeType}
                                                        </div>
                                                    </div>
                                                    <div className='flex justify-between'>
                                                        <span
                                                            className={
                                                                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                                                            }
                                                        >
                                                            Validity:
                                                        </span>
                                                        <div
                                                            className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                                                        >
                                                            {signal.validity}
                                                        </div>
                                                    </div>
                                                    <div className='flex justify-between'>
                                                        <span
                                                            className={
                                                                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                                                            }
                                                        >
                                                            Confidence:
                                                        </span>
                                                        <div
                                                            className={`font-bold ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}
                                                        >
                                                            {signal.confidence}%
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Entry/Exit Conditions */}
                                            <div className='space-y-2'>
                                                <div
                                                    className={`p-2.5 rounded-lg border ${theme === 'dark' ? 'bg-green-500/10 border-green-500/30' : 'bg-green-50 border-green-200'}`}
                                                >
                                                    <div
                                                        className={`text-xs font-bold mb-1.5 flex items-center gap-1.5 ${theme === 'dark' ? 'text-green-400' : 'text-green-700'}`}
                                                    >
                                                        <span>📍</span> Entry Conditions
                                                    </div>
                                                    <p
                                                        className={`text-[11px] leading-snug ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
                                                    >
                                                        Wait for 2-3 consecutive opposite signal ticks, then enter{' '}
                                                        {signal.tradeType} immediately at entry point{' '}
                                                        {signal.entryPoint}
                                                    </p>
                                                </div>

                                                <div
                                                    className={`p-2.5 rounded-lg border ${theme === 'dark' ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-200'}`}
                                                >
                                                    <div
                                                        className={`text-xs font-bold mb-1.5 flex items-center gap-1.5 ${theme === 'dark' ? 'text-red-400' : 'text-red-700'}`}
                                                    >
                                                        <span>🎯</span> Exit Conditions
                                                    </div>
                                                    <p
                                                        className={`text-[11px] leading-snug ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
                                                    >
                                                        Exit when: 1) Confidence drops below 55%, 2) Market shifts to
                                                        opposite signal, 3) 5+ ticks without confirmation
                                                    </p>
                                                </div>
                                            </div>

                                            <div className='text-xs font-semibold mb-2 text-white mt-3'>
                                                Strategy Conditions:
                                            </div>
                                            <ul
                                                className={`text-xs space-y-1 mb-3 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
                                            >
                                                {signal.conditions.map((condition, i) => (
                                                    <li key={i} className='flex items-start gap-2'>
                                                        <span className='text-green-500 mt-0.5'>✓</span>
                                                        <span>{condition}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
