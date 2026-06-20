'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Filter, Zap, Activity, Info, Loader2, Zap as ZapIcon } from 'lucide-react';
import { AnalysisEngine, type Signal } from '@/lib/analysis-engine';
import { DerivWebSocketManager } from '@/lib/deriv-websocket-manager';

interface AdvancedSignalResult {
    symbol: string;
    displayName: string;
    signals: Signal[];
    lastUpdate: number;
}

interface AdvancedSignalsTabProps {
    theme: 'light' | 'dark';
    availableSymbols: any[];
}

export function AdvancedSignalsTab({ theme, availableSymbols }: AdvancedSignalsTabProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [activeSignalFilter, setActiveSignalFilter] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<string | null>(null);
    const [scannedResults, setScannedResults] = useState<AdvancedSignalResult[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    const [scanProgress, setScanProgress] = useState(0);

    const scannerActiveRef = useRef(false);

    // Filtering logic
    const filteredResults = useMemo(() => {
        return scannedResults
            .filter(result => {
                const matchesSearch =
                    result.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    result.symbol.toLowerCase().includes(searchQuery.toLowerCase());

                const matchesSignalFilter =
                    !activeSignalFilter ||
                    result.signals.some(s => {
                        if (activeSignalFilter === 'even_odd')
                            return s.type === 'even_odd' || s.type === 'pro_even_odd';
                        if (activeSignalFilter === 'over_under')
                            return s.type === 'over_under' || s.type === 'pro_over_under';
                        if (activeSignalFilter === 'matches') return s.type === 'matches';
                        if (activeSignalFilter === 'differs') return s.type === 'differs' || s.type === 'pro_differs';
                        return false;
                    });

                const matchesStatusFilter =
                    !statusFilter ||
                    result.signals.some(s => {
                        if (statusFilter === 'trade_now') return s.status === 'TRADE NOW';
                        if (statusFilter === 'wait') return s.status === 'WAIT';
                        if (statusFilter === 'high_prob') return s.probability >= 70;
                        return false;
                    });

                return matchesSearch && matchesSignalFilter && matchesStatusFilter;
            })
            .sort((a, b) => {
                const maxA = Math.max(...a.signals.map(s => s.probability), 0);
                const maxB = Math.max(...b.signals.map(s => s.probability), 0);
                return maxB - maxA;
            });
    }, [scannedResults, searchQuery, activeSignalFilter, statusFilter]);

    // Scan Logic
    useEffect(() => {
        let isMounted = true;
        const ws = DerivWebSocketManager.getInstance();

        const startScanner = async () => {
            // Use availableSymbols directly as they are already filtered and sorted in use-deriv hook
            // This ensures consistency across the app.
            const filteredMarkets = [...availableSymbols];

            if (scannerActiveRef.current || filteredMarkets.length === 0) return;

            console.log('[v0] 🚀 Heritage Scanner: Starting scan for', filteredMarkets.length, 'markets');
            scannerActiveRef.current = true;
            setIsScanning(true);
            setScanProgress(0);

            const results: AdvancedSignalResult[] = [];
            const batchSize = 10;

            try {
                for (let i = 0; i < filteredMarkets.length; i += batchSize) {
                    if (!isMounted) break;

                    const batch = filteredMarkets.slice(i, i + batchSize);
                    setScanProgress(Math.round((i / filteredMarkets.length) * 100));

                    await Promise.all(
                        batch.map(async item => {
                            try {
                                const historyPromise = ws.getTicksHistory(item.symbol, 100);
                                const timeoutPromise = new Promise((_, reject) =>
                                    setTimeout(() => reject(new Error('Timeout')), 8000)
                                );
                                const history = (await Promise.race([historyPromise, timeoutPromise])) as any[];

                                if (history && history.length > 0) {
                                    const tempEngine = new AnalysisEngine(100);
                                    tempEngine.addTicksBatch(history);

                                    const signals = [
                                        ...tempEngine.generateSignals(),
                                        ...tempEngine.generateProSignals(),
                                        ...tempEngine.generateAdvancedSignalsList(),
                                    ].filter(s => s.status !== 'NEUTRAL');

                                    if (signals.length > 0) {
                                        results.push({
                                            symbol: item.symbol,
                                            displayName: item.display_name,
                                            signals,
                                            lastUpdate: Date.now(),
                                        });
                                    }
                                }
                            } catch (e) {
                                // Silently catch skip
                            }
                        })
                    );

                    setScannedResults([...results]);
                    await new Promise(r => setTimeout(r, 150));
                }
            } finally {
                if (isMounted) {
                    setIsScanning(false);
                    setScanProgress(100);
                    scannerActiveRef.current = false;
                }
            }
        };

        const initialDelay = setTimeout(startScanner, 2000);
        const interval = setInterval(startScanner, 120000);

        return () => {
            isMounted = false;
            clearInterval(interval);
            clearTimeout(initialDelay);
        };
    }, [availableSymbols.length]);

    const getStatusColor = (status: string) => {
        if (status === 'TRADE NOW') return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
        if (status === 'WAIT') return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    };

    return (
        <div className='space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500'>
            {/* Scanner Control Bar - Heritage Style */}
            <Card className='soft-card border-white/5 overflow-hidden'>
                <CardContent className='p-4'>
                    <div className='flex flex-col md:flex-row gap-4 items-center justify-between'>
                        <div className='relative w-full md:w-96'>
                            <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500' />
                            <Input
                                placeholder='Market Search...'
                                className='pl-10 h-10 rounded-xl border-white/10 bg-white/5 focus:bg-white/10 text-white font-bold tracking-wide'
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>

                        <div className='flex flex-col gap-3 w-full md:w-auto'>
                            {/* Signal Type Filters */}
                            <div className='flex items-center gap-2 overflow-x-auto pb-1'>
                                <span className='text-[10px] font-black uppercase text-slate-500 mr-2 flex items-center gap-1 whitespace-nowrap'>
                                    <Filter className='w-3 h-3' /> Signal Type
                                </span>
                                {[
                                    { id: 'even_odd', label: 'Even/Odd' },
                                    { id: 'over_under', label: 'Over/Under' },
                                    { id: 'matches', label: 'Matches' },
                                    { id: 'differs', label: 'Differs' },
                                ].map(f => (
                                    <Badge
                                        key={f.id}
                                        onClick={() => setActiveSignalFilter(activeSignalFilter === f.id ? null : f.id)}
                                        className={`cursor-pointer px-3 py-1 rounded-lg transition-all border-none font-bold uppercase text-[9px] whitespace-nowrap ${
                                            activeSignalFilter === f.id
                                                ? 'bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]'
                                                : 'bg-white/5 text-slate-400 hover:bg-white/10'
                                        }`}
                                    >
                                        {f.label}
                                    </Badge>
                                ))}
                            </div>

                            {/* Status Filters */}
                            <div className='flex items-center gap-2 overflow-x-auto pb-1'>
                                <span className='text-[10px] font-black uppercase text-slate-500 mr-2 flex items-center gap-1 whitespace-nowrap'>
                                    <Zap className='w-3 h-3' /> Status
                                </span>
                                {[
                                    { id: 'trade_now', label: 'Trade Now', color: 'bg-green-500' },
                                    { id: 'wait', label: 'Wait', color: 'bg-amber-500' },
                                    { id: 'high_prob', label: 'High Prob (70%+)', color: 'bg-blue-500' },
                                ].map(f => (
                                    <Badge
                                        key={f.id}
                                        onClick={() => setStatusFilter(statusFilter === f.id ? null : f.id)}
                                        className={`cursor-pointer px-3 py-1 rounded-lg transition-all border-none font-bold uppercase text-[9px] whitespace-nowrap ${
                                            statusFilter === f.id
                                                ? `${f.color} text-white shadow-lg`
                                                : 'bg-white/5 text-slate-400 hover:bg-white/10'
                                        }`}
                                    >
                                        {f.label}
                                    </Badge>
                                ))}
                            </div>
                        </div>

                        <div className='flex items-center gap-3 min-w-fit'>
                            {isScanning ? (
                                <div className='flex items-center gap-2 text-[10px] font-black uppercase text-primary animate-pulse'>
                                    <Loader2 className='w-3 h-3 animate-spin' />
                                    Scanning {scanProgress}%
                                </div>
                            ) : (
                                <div className='flex items-center gap-2 text-[10px] font-black uppercase text-emerald-400'>
                                    <div className='w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse' />
                                    Scanner Active
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Results Grid - Modern Card Design */}
            <div>
                {filteredResults.length > 0 ? (
                    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                        {filteredResults.map(result =>
                            result.signals.map((signal, idx) => (
                                <Card
                                    key={`${result.symbol}-${idx}`}
                                    className='border-indigo-500/40 bg-gradient-to-br from-indigo-500/10 via-white/[0.02] to-blue-500/5 hover:from-indigo-500/15 hover:via-white/[0.04] hover:to-blue-500/10 transition-all duration-300 p-5 overflow-hidden'
                                >
                                    {/* Header - Market Info */}
                                    <div className='flex items-start justify-between mb-4 pb-4 border-b border-white/10'>
                                        <div className='flex-1 min-w-0'>
                                            <h3 className='font-bold text-sm text-white truncate'>
                                                {result.displayName}
                                            </h3>
                                            <p className='text-xs text-slate-400 font-mono mt-1'>{result.symbol}</p>
                                        </div>
                                        <div className='text-right ml-2'>
                                            <Badge
                                                variant='outline'
                                                className='rounded-md bg-indigo-500/20 text-indigo-300 border-indigo-500/40 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider whitespace-nowrap block mb-2'
                                            >
                                                {signal.type.replace(/_/g, ' ')}
                                            </Badge>
                                            <Badge
                                                className={`rounded-md border font-black text-[8px] px-2 py-1 uppercase tracking-widest ${getStatusColor(signal.status)}`}
                                            >
                                                {signal.status}
                                            </Badge>
                                        </div>
                                    </div>

                                    {/* Confidence Indicator */}
                                    <div className='mb-4 space-y-1.5'>
                                        <div className='flex items-center justify-between'>
                                            <span className='text-xs font-semibold text-slate-400'>CONFIDENCE</span>
                                            <span
                                                className={`text-sm font-bold ${signal.probability > 70 ? 'text-green-400' : signal.probability > 50 ? 'text-blue-400' : 'text-slate-300'}`}
                                            >
                                                {signal.probability.toFixed(0)}%
                                            </span>
                                        </div>
                                        <div className='w-full h-2.5 rounded-full bg-white/10 overflow-hidden'>
                                            <div
                                                className={`h-full transition-all duration-1000 ${signal.probability > 70 ? 'bg-gradient-to-r from-green-500 to-emerald-500' : signal.probability > 50 ? 'bg-gradient-to-r from-blue-500 to-cyan-500' : 'bg-gradient-to-r from-slate-500 to-slate-600'}`}
                                                style={{ width: `${signal.probability}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* Signal Details Grid */}
                                    <div className='grid grid-cols-2 gap-2.5 mb-4 py-3 border-y border-white/10'>
                                        {/* Recommendation Detail */}
                                        <div className='col-span-2'>
                                            <p className='text-xs font-semibold text-slate-400 uppercase mb-1'>
                                                Signal Recommendation
                                            </p>
                                            <p className='text-xs text-slate-200 leading-snug'>
                                                {signal.recommendation}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Entry & Exit Information */}
                                    <div className='space-y-3 mb-4'>
                                        {/* Entry Condition */}
                                        <div className='bg-white/[0.03] border border-white/5 rounded-lg p-3'>
                                            <div className='flex items-start gap-2 mb-1'>
                                                <Zap className='w-3.5 h-3.5 text-yellow-400 mt-0.5 flex-shrink-0' />
                                                <span className='text-xs font-black text-yellow-400/90 uppercase tracking-wider'>
                                                    Entry Trigger
                                                </span>
                                            </div>
                                            <p className='text-[10px] text-slate-300 ml-5 leading-snug'>
                                                {signal.entryCondition}
                                            </p>
                                        </div>

                                        {/* Signal Type Details */}
                                        <div className='bg-white/[0.02] border border-indigo-500/20 rounded-lg p-3'>
                                            <div className='flex items-center justify-between'>
                                                <span className='text-xs font-semibold text-slate-400 uppercase'>
                                                    Signal Type
                                                </span>
                                                <span
                                                    className={`text-[11px] font-bold px-2 py-1 rounded ${
                                                        signal.type.includes('even_odd')
                                                            ? 'bg-blue-500/30 text-blue-300'
                                                            : signal.type.includes('over_under')
                                                              ? 'bg-purple-500/30 text-purple-300'
                                                              : signal.type.includes('matches')
                                                                ? 'bg-green-500/30 text-green-300'
                                                                : signal.type.includes('differs')
                                                                  ? 'bg-orange-500/30 text-orange-300'
                                                                  : 'bg-slate-500/30 text-slate-300'
                                                    }`}
                                                >
                                                    {signal.type.replace(/_/g, '/').toUpperCase()}
                                                </span>
                                            </div>
                                            {signal.targetDigit !== undefined && (
                                                <p className='text-[10px] text-slate-400 mt-1.5'>
                                                    Target Digit:{' '}
                                                    <span className='font-bold text-slate-200'>
                                                        {signal.targetDigit}
                                                    </span>
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Footer Stats */}
                                    <div className='flex items-center justify-between pt-2 border-t border-white/10 text-[9px] text-slate-500'>
                                        <span className='flex items-center gap-1'>
                                            <Activity className='w-3 h-3' />
                                            Last Update: Just Now
                                        </span>
                                        <span>ID: {result.symbol.slice(0, 3)}</span>
                                    </div>
                                </Card>
                            ))
                        )}
                    </div>
                ) : (
                    <Card className='soft-card border-white/5 p-16'>
                        <div className='flex flex-col items-center justify-center space-y-4'>
                            <div className='p-6 rounded-full bg-white/5 border border-white/10'>
                                <Zap className='w-12 h-12 text-slate-600 animate-pulse' />
                            </div>
                            <div className='space-y-1 text-center'>
                                <p className='text-slate-500 font-black uppercase tracking-[0.2em] text-sm'>
                                    {isScanning
                                        ? 'Analyzing Market Frequencies...'
                                        : 'Scanning Complete - No Signals Met Filter'}
                                </p>
                                {isScanning && (
                                    <div className='w-64 mx-auto h-2 bg-white/5 rounded-full overflow-hidden mt-4'>
                                        <div
                                            className='h-full bg-indigo-500 transition-all duration-300'
                                            style={{ width: `${scanProgress}%` }}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </Card>
                )}
            </div>

            {/* Heritage Footer */}
            <div className='flex items-center justify-between px-3 py-2 border-t border-white/5'>
                <p className='text-[10px] font-black uppercase tracking-[0.15em] text-slate-600 flex items-center gap-2'>
                    <Activity className='w-3.5 h-3.5 text-primary' /> Active Monitoring: {availableSymbols.length}{' '}
                    Instruments
                </p>
                <p className='text-[10px] font-black uppercase tracking-[0.15em] text-slate-600'>
                    Uplink Update: {new Date().toLocaleTimeString()}
                </p>
            </div>
        </div>
    );
}
