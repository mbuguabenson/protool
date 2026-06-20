'use client';

import { useState, useEffect, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    TrendingUp,
    TrendingDown,
    AlertTriangle,
    Activity,
    Target,
    Layers,
    Settings,
    BarChart3,
    Clock,
} from 'lucide-react';
import { derivWebSocket } from '@/lib/deriv-websocket-manager';
import { useDeriv } from '@/hooks/use-deriv';
import {
    PatternChart,
    CandleData,
    PricePoint,
    SupportResistance,
    EntryExit,
    IndicatorData,
} from '@/components/pattern-chart';
import { DigitDistribution } from '@/components/digit-distribution';
import { tradingSessionCache } from '@/lib/trading-session-cache';

interface ReversalPattern {
    type: string;
    direction: 'Bullish' | 'Bearish';
    confidence: number;
    priceLevel: number;
    timestamp: number;
    description: string;
    indices: number[];
}

type Timeframe = '1t' | '1m' | '5m' | '15m' | '1h';

interface TradingViewTabProps {
    theme?: 'light' | 'dark';
    symbol: string;
    onSymbolChange: (symbol: string) => void;
}

export function TradingViewTab({ theme = 'dark', symbol, onSymbolChange }: TradingViewTabProps) {
    const { currentPrice, currentDigit, analysis } = useDeriv();
    const [timeframe, setTimeframe] = useState<Timeframe>('1t');
    const [chartType, setChartType] = useState<'line' | 'candle'>('line');
    const [priceHistory, setPriceHistory] = useState<PricePoint[]>(() => tradingSessionCache.getTicks(symbol) || []);
    const [candleHistory, setCandleHistory] = useState<CandleData[]>(
        () => tradingSessionCache.getCandles(symbol, timeframe) || []
    );
    const [indicators, setIndicators] = useState<IndicatorData[]>([]);
    const [detectedPatterns, setDetectedPatterns] = useState<ReversalPattern[]>([]);
    const [supportResistance, setSupportResistance] = useState<SupportResistance[]>([]);
    const [entryExitPoints, setEntryExitPoints] = useState<EntryExit[]>([]);
    const [isMonitoring, setIsMonitoring] = useState(true);
    const [showSMA, setShowSMA] = useState(true);
    const [showBB, setShowBB] = useState(true);
    const [showMACD, setShowMACD] = useState(false);
    const [showDonchian, setShowDonchian] = useState(false);
    const subscriptionRef = useRef<string | null>(null);

    // Fetch History / Subscribe
    useEffect(() => {
        if (!isMonitoring) return;

        // Sync state with cache when symbol/timeframe changes
        if (timeframe === '1t') {
            const cached = tradingSessionCache.getTicks(symbol) || [];
            setPriceHistory(cached);
            if (cached.length > 0) analyzeData(cached, []);
        } else {
            const cached = tradingSessionCache.getCandles(symbol, timeframe) || [];
            setCandleHistory(cached);
            if (cached.length > 0) analyzeData([], cached);
        }

        // Pin symbol for background data collection
        tradingSessionCache.pinSymbol(symbol);

        const fetchData = async () => {
            if (timeframe === '1t') {
                setChartType('line');
                // Ticks subscription
                const callback = (tick: any) => {
                    const newPoint: PricePoint = {
                        price: tick.quote,
                        timestamp: tick.epoch,
                        digit: tick.lastDigit,
                    };
                    const updated = tradingSessionCache.updateTickInCache(symbol, newPoint);
                    setPriceHistory(updated);
                    analyzeData(updated, []);
                };
                const id = await derivWebSocket.subscribeTicks(symbol, callback);
                subscriptionRef.current = id;
                return () => {
                    if (subscriptionRef.current) derivWebSocket.unsubscribe(subscriptionRef.current, callback);
                };
            } else {
                setChartType('candle');
                // Candles (History + Stream)
                const granularity =
                    timeframe === '1m' ? 60 : timeframe === '5m' ? 300 : timeframe === '15m' ? 900 : 3600;

                // Only fetch if cache is small or empty to minimize flicker
                const response = await derivWebSocket.sendAndWait({
                    ticks_history: symbol,
                    adjust_start_time: 1,
                    count: 100,
                    end: 'latest',
                    style: 'candles',
                    granularity,
                });

                if (response.candles) {
                    const candles: CandleData[] = response.candles.map((c: any) => ({
                        open: c.open,
                        high: c.high,
                        low: c.low,
                        close: c.close,
                        timestamp: c.epoch,
                    }));
                    tradingSessionCache.setCandles(symbol, timeframe, candles);
                    setCandleHistory(candles);
                    analyzeData([], candles);
                }

                // Real-time updates for candles
                const callback = (tick: any) => {
                    setCandleHistory(prev => {
                        const last = prev[prev.length - 1];
                        if (!last) return prev;
                        const now = tick.epoch;
                        const isNewCandle = Math.floor(now / granularity) > Math.floor(last.timestamp / granularity);
                        let updated: CandleData[];
                        if (isNewCandle) {
                            const newCandle: CandleData = {
                                open: tick.quote,
                                high: tick.quote,
                                low: tick.quote,
                                close: tick.quote,
                                timestamp: Math.floor(now / granularity) * granularity,
                            };
                            updated = [...prev, newCandle].slice(-100);
                        } else {
                            const updatedLast = {
                                ...last,
                                high: Math.max(last.high, tick.quote),
                                low: Math.min(last.low, tick.quote),
                                close: tick.quote,
                            };
                            updated = [...prev.slice(0, -1), updatedLast];
                        }
                        tradingSessionCache.setCandles(symbol, timeframe, updated);
                        analyzeData([], updated);
                        return updated;
                    });
                };
                const id = await derivWebSocket.subscribeTicks(symbol, callback);
                subscriptionRef.current = id;
                return () => {
                    if (subscriptionRef.current) derivWebSocket.unsubscribe(subscriptionRef.current, callback);
                };
            }
        };

        const cleanup = fetchData();
        return () => {
            cleanup.then(fn => fn && fn());
        };
    }, [symbol, timeframe, isMonitoring]);

    const analyzeData = (ticks: PricePoint[], candles: CandleData[]) => {
        const data = timeframe === '1t' ? ticks.map(t => t.price) : candles.map(c => c.close);
        const highs = timeframe === '1t' ? ticks.map(t => t.price) : candles.map(c => c.high);
        const lows = timeframe === '1t' ? ticks.map(t => t.price) : candles.map(c => c.low);
        const timestamps = timeframe === '1t' ? ticks.map(t => t.timestamp) : candles.map(c => c.timestamp);

        if (data.length < 20) return;

        const newIndicators: IndicatorData[] = [];

        // SMA
        if (showSMA) {
            newIndicators.push({ name: 'SMA 20', color: '#60a5fa', values: calculateSMA(data, 20) });
        }

        // Bollinger Bands
        if (showBB) {
            const { upper, lower } = calculateBollingerBands(data, 20, 2);
            newIndicators.push({ name: 'BB Upper', color: 'rgba(139, 92, 246, 0.4)', values: upper });
            newIndicators.push({ name: 'BB Lower', color: 'rgba(139, 92, 246, 0.4)', values: lower });
        }

        // Donchian Channels
        if (showDonchian) {
            const { upper, lower } = calculateDonchian(highs, lows, 20);
            newIndicators.push({ name: 'DC Upper', color: 'rgba(234, 179, 8, 0.4)', values: upper });
            newIndicators.push({ name: 'DC Lower', color: 'rgba(234, 179, 8, 0.4)', values: lower });
        }

        // MACD
        if (showMACD) {
            const { macd, signal, histogram } = calculateMACD(data);
            newIndicators.push({ name: 'MACD', color: '#60a5fa', values: macd, position: 'bottom' });
            newIndicators.push({ name: 'Signal', color: '#f87171', values: signal, position: 'bottom' });
            newIndicators.push({
                name: 'Histogram',
                color: '#34d399',
                values: histogram,
                position: 'bottom',
                drawType: 'histogram',
            });
        }

        setIndicators(newIndicators);

        // Detect S/R & Patterns
        setSupportResistance(detectSR(data));
        setDetectedPatterns(detectPatterns(data, timeframe));

        // Signals
        const sma20 = calculateSMA(data, 20);
        const signals: EntryExit[] = [];
        if (sma20.length >= 2) {
            const lastPrice = data[data.length - 1],
                lastSma = sma20[sma20.length - 1];
            const prevPrice = data[data.length - 2],
                prevSma = sma20[sma20.length - 2];
            if (lastSma && prevSma) {
                if (prevPrice <= prevSma && lastPrice > lastSma)
                    signals.push({
                        price: lastPrice,
                        type: 'entry',
                        direction: 'buy',
                        timestamp: timestamps[timestamps.length - 1],
                    });
                else if (prevPrice >= prevSma && lastPrice < lastSma)
                    signals.push({
                        price: lastPrice,
                        type: 'entry',
                        direction: 'sell',
                        timestamp: timestamps[timestamps.length - 1],
                    });
            }
        }
        setEntryExitPoints(signals);
    };

    // Calculation helpers
    const calculateSMA = (d: number[], p: number) =>
        d.map((_, i) => (i < p - 1 ? null : d.slice(i - p + 1, i + 1).reduce((a, b) => a + b, 0) / p));

    const calculateEMA = (d: number[], p: number) => {
        const ema: (number | null)[] = [];
        const k = 2 / (p + 1);
        let prevEma: number | null = null;
        d.forEach((v, i) => {
            if (i < p - 1) ema.push(null);
            else if (i === p - 1) {
                prevEma = d.slice(0, p).reduce((a, b) => a + b, 0) / p;
                ema.push(prevEma);
            } else {
                prevEma = v * k + prevEma! * (1 - k);
                ema.push(prevEma);
            }
        });
        return ema;
    };

    const calculateBollingerBands = (d: number[], p: number, s: number) => {
        const upper: (number | null)[] = [],
            lower: (number | null)[] = [];
        d.forEach((_, i) => {
            if (i < p - 1) {
                upper.push(null);
                lower.push(null);
            } else {
                const slice = d.slice(i - p + 1, i + 1);
                const m = slice.reduce((a, b) => a + b, 0) / p;
                const v = Math.sqrt(slice.reduce((a, b) => a + Math.pow(b - m, 2), 0) / p);
                upper.push(m + v * s);
                lower.push(m - v * s);
            }
        });
        return { upper, lower };
    };

    const calculateDonchian = (h: number[], l: number[], p: number) => {
        const upper = h.map((_, i) => (i < p - 1 ? null : Math.max(...h.slice(i - p + 1, i + 1))));
        const lower = l.map((_, i) => (i < p - 1 ? null : Math.min(...l.slice(i - p + 1, i + 1))));
        return { upper, lower };
    };

    const calculateMACD = (d: number[]) => {
        const ema12 = calculateEMA(d, 12),
            ema26 = calculateEMA(d, 26);
        const macd = d.map((_, i) => (ema12[i] !== null && ema26[i] !== null ? ema12[i]! - ema26[i]! : null));
        const validMacd = macd.filter(v => v !== null) as number[];
        const signalValid = calculateEMA(validMacd, 9);
        const signal = macd.map((v, i) => {
            if (v === null) return null;
            const idx = macd.slice(0, i + 1).filter(x => x !== null).length - 1;
            return signalValid[idx] ?? null;
        });
        const histogram = macd.map((v, i) => (v !== null && signal[i] !== null ? v - signal[i]! : null));
        return { macd, signal, histogram };
    };

    const detectSR = (data: number[]) => {
        const levels: SupportResistance[] = [],
            points: number[] = [];
        for (let i = 2; i < data.length - 2; i++) {
            if (data[i] > data[i - 1] && data[i] > data[i - 2] && data[i] > data[i + 1] && data[i] > data[i + 2])
                points.push(data[i]);
            if (data[i] < data[i - 1] && data[i] < data[i - 2] && data[i] < data[i + 1] && data[i] < data[i + 2])
                points.push(data[i]);
        }
        points.forEach(p => {
            if (!levels.find(l => Math.abs(l.level - p) / p < 0.0005))
                levels.push({ level: p, type: p > data[data.length - 1] ? 'resistance' : 'support', strength: 50 });
        });
        return levels.slice(0, 5);
    };

    const detectPatterns = (data: number[], tf: string): ReversalPattern[] => {
        const found: ReversalPattern[] = [];
        if (data.length > 30) {
            const pks = [];
            for (let i = 2; i < data.length - 2; i++)
                if (data[i] > data[i - 1] && data[i] > data[i + 1] && data[i] > data[i - 2] && data[i] > data[i + 2])
                    pks.push(i);
            if (pks.length >= 2) {
                const p1 = pks[pks.length - 2],
                    p2 = pks[pks.length - 1];
                if (Math.abs(data[p1] - data[p2]) / data[p1] < 0.001)
                    found.push({
                        type: 'Double Top',
                        direction: 'Bearish',
                        confidence: 80,
                        priceLevel: data[p2],
                        timestamp: Date.now(),
                        description: 'Double Top Reversal',
                        indices: [p1, p2],
                    });
            }
        }
        return found;
    };

    const trendHistory =
        timeframe === '1t' ? priceHistory : candleHistory.map(c => ({ price: c.close, timestamp: c.timestamp }));
    const calculateTrend = () => {
        if (trendHistory.length < 10) return 'Neutral';
        const last = trendHistory[trendHistory.length - 1].price,
            first = trendHistory[trendHistory.length - 10].price;
        return last > first ? 'Bullish' : last < first ? 'Bearish' : 'Neutral';
    };

    const trend = calculateTrend(),
        trendColor = trend === 'Bullish' ? 'text-green-400' : trend === 'Bearish' ? 'text-red-400' : 'text-gray-400';
    const trendBg = trend === 'Bullish' ? 'bg-green-500/10' : trend === 'Bearish' ? 'bg-red-500/10' : 'bg-gray-500/10';

    return (
        <div className='space-y-4 sm:space-y-6'>
            <div
                className={`rounded-xl p-3 border flex flex-wrap items-center justify-between gap-4 ${theme === 'dark' ? 'bg-[#0f1629]/90 border-blue-500/30' : 'bg-white border-gray-200 shadow-sm'}`}
            >
                <div className='flex items-center gap-4'>
                    <div className='flex items-center gap-2'>
                        <Clock className='h-4 w-4 text-gray-400' />
                        <Select value={timeframe} onValueChange={(v: any) => setTimeframe(v)}>
                            <SelectTrigger className='w-[100px] h-9'>
                                <SelectValue placeholder='Timeframe' />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value='1t'>1 Tick</SelectItem>
                                <SelectItem value='1m'>1 Min</SelectItem>
                                <SelectItem value='5m'>5 Min</SelectItem>
                                <SelectItem value='15m'>15 Min</SelectItem>
                                <SelectItem value='1h'>1 Hour</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className='flex items-center gap-2'>
                        <BarChart3 className='h-4 w-4 text-gray-400' />
                        <Select value={chartType} onValueChange={(v: any) => setChartType(v)}>
                            <SelectTrigger className='w-[100px] h-9'>
                                <SelectValue placeholder='Chart Type' />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value='line'>Line</SelectItem>
                                <SelectItem value='candle'>Candles</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className='flex items-center border rounded-md p-0.5 bg-black/10 gap-1'>
                        <Button
                            variant={showSMA ? 'default' : 'ghost'}
                            size='sm'
                            className='h-7 px-2 text-[10px]'
                            onClick={() => setShowSMA(!showSMA)}
                        >
                            SMA
                        </Button>
                        <Button
                            variant={showBB ? 'default' : 'ghost'}
                            size='sm'
                            className='h-7 px-2 text-[10px]'
                            onClick={() => setShowBB(!showBB)}
                        >
                            BB
                        </Button>
                        <Button
                            variant={showDonchian ? 'default' : 'ghost'}
                            size='sm'
                            className='h-7 px-2 text-[10px]'
                            onClick={() => setShowDonchian(!showDonchian)}
                        >
                            DC
                        </Button>
                        <Button
                            variant={showMACD ? 'default' : 'ghost'}
                            size='sm'
                            className='h-7 px-2 text-[10px]'
                            onClick={() => setShowMACD(!showMACD)}
                        >
                            MACD
                        </Button>
                    </div>
                </div>

                <div className='flex items-center gap-3'>
                    <Badge className={`${trendBg} ${trendColor} border-0 flex items-center gap-2 px-3 py-1`}>
                        <Activity className='h-3 w-3' />
                        {trend}
                    </Badge>
                    <Button
                        size='sm'
                        variant='outline'
                        className='h-9 gap-2'
                        onClick={() => setIsMonitoring(!isMonitoring)}
                    >
                        <Settings className={`h-4 w-4 ${isMonitoring ? 'animate-spin-slow' : ''}`} />
                        {isMonitoring ? 'Monitoring' : 'Paused'}
                    </Button>
                </div>
            </div>

            <div className='grid grid-cols-1 lg:grid-cols-3 gap-4'>
                <div className='lg:col-span-2 space-y-4'>
                    <div
                        className={`rounded-xl p-4 sm:p-6 border ${theme === 'dark' ? 'bg-[#0a0e27]/80 border-blue-500/20' : 'bg-white border-gray-200'}`}
                    >
                        <div className='min-h-[500px]'>
                            <PatternChart
                                chartType={chartType}
                                priceHistory={priceHistory}
                                candleHistory={candleHistory}
                                indicators={indicators}
                                supportResistance={supportResistance}
                                entryExitPoints={entryExitPoints}
                                patterns={detectedPatterns.map(p => ({
                                    type: p.type,
                                    indices: p.indices,
                                    direction: p.direction,
                                }))}
                                theme={theme}
                            />
                        </div>
                    </div>

                    <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                        {detectedPatterns.map((p, i) => (
                            <Card
                                key={i}
                                className={`p-4 border-l-4 ${p.direction === 'Bullish' ? 'border-l-green-500' : 'border-l-red-500'} ${theme === 'dark' ? 'bg-[#1a2235] border-white/5' : 'bg-gray-50'}`}
                            >
                                <div className='flex justify-between items-start mb-2'>
                                    <h4 className='font-bold text-sm'>{p.type}</h4>
                                    <Badge variant='outline' className='text-[10px]'>
                                        {p.confidence}% Conf
                                    </Badge>
                                </div>
                                <p className='text-[11px] opacity-60 mb-2'>{p.description}</p>
                                <div className='text-[10px] font-mono text-cyan-500'>
                                    Target Level: {p.priceLevel.toFixed(5)}
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>

                <div className='space-y-4'>
                    <div
                        className={`rounded-xl p-4 border ${theme === 'dark' ? 'bg-[#111827] border-white/5' : 'bg-white border-gray-200'}`}
                    >
                        <h3 className='text-sm font-bold mb-4 flex items-center gap-2'>
                            <Target className='h-4 w-4 text-orange-500' />
                            Market Pulse
                        </h3>
                        <div className='space-y-3'>
                            <div className='flex justify-between items-center px-3 py-2 rounded bg-black/20'>
                                <span className='text-xs opacity-60'>Price</span>
                                <span className='font-mono font-bold text-lg'>{currentPrice?.toFixed(5) || '---'}</span>
                            </div>
                            <div className='flex justify-between items-center px-3 py-2 rounded bg-black/20'>
                                <span className='text-xs opacity-60'>Market</span>
                                <span className='font-bold'>{symbol.replace('_', ' ')}</span>
                            </div>
                        </div>
                    </div>

                    <div
                        className={`rounded-xl p-4 border ${theme === 'dark' ? 'bg-[#111827] border-white/5' : 'bg-white border-gray-200'}`}
                    >
                        <h3 className='text-sm font-bold mb-4 flex items-center gap-2'>
                            <Layers className='h-4 w-4 text-blue-500' />
                            Digit Volatility
                        </h3>
                        {analysis?.digitFrequencies && (
                            <DigitDistribution
                                frequencies={analysis.digitFrequencies}
                                currentDigit={currentDigit}
                                theme={theme}
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
