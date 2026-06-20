import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, Brain, Zap, ChevronDown, ChevronUp, Loader2, Activity, RefreshCw } from 'lucide-react';
import { DerivWebSocketManager } from '@/lib/deriv-websocket-manager';
import { AnalysisEngine } from '@/lib/analysis-engine';

interface FloatingAIScannerProps {
    theme?: 'light' | 'dark';
    availableSymbols?: any[];
    onScanComplete?: (results: ScanResult[]) => void;
}

interface ScanResult {
    symbol: string;
    displayName: string;
    strategy: string;
    signal: 'TRADE NOW' | 'WAIT' | 'SKIP';
    direction: string; // e.g. "EVEN", "ODD", "OVER 5", "UNDER 4", etc.
    entryCondition: string; // exact entry trigger
    confidence: number; // 0–100
    targetDigit?: number;
    ticksAnalyzed: number;
    evenPct: number;
    oddPct: number;
    highPct: number;
    lowPct: number;
}

const STRATEGIES = [
    { id: 'even_odd', label: 'Even/Odd', icon: '⚖️' },
    { id: 'over_under', label: 'Over/Under 4.5', icon: '📊' },
    { id: 'matches', label: 'Matches Digit', icon: '🎯' },
    { id: 'differs', label: 'Differs Digit', icon: '⚡' },
];

const SIGNAL_COLOR = {
    'TRADE NOW': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
    WAIT: 'bg-amber-500/20  text-amber-400  border-amber-500/40',
    SKIP: 'bg-slate-500/20  text-slate-400  border-slate-500/30',
};

const SIGNAL_DOT = {
    'TRADE NOW': 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]',
    WAIT: 'bg-amber-400  shadow-[0_0_6px_rgba(251,191,36,0.8)]',
    SKIP: 'bg-slate-500',
};

async function analyseMarket(
    wsManager: DerivWebSocketManager,
    symbol: string,
    displayName: string,
    strategies: string[]
): Promise<ScanResult | null> {
    try {
        // Fetch last 200 ticks — enough for solid statistical inference, fast per market
        const history = await wsManager.getTicksHistory(symbol, 200);
        if (!history || history.length < 30) return null;

        const engine = new AnalysisEngine(500);
        engine.addTicksBatch(history);

        const analysis = engine.getAnalysis();
        const signals = engine.generateSignals();

        // Score each requested strategy
        let bestScore = -1;
        let bestResult: Omit<ScanResult, 'symbol' | 'displayName' | 'ticksAnalyzed'> | null = null;

        for (const strat of strategies) {
            const sig = signals.find(s => s.type === strat);
            if (!sig) continue;

            // Only surface meaningful scores (> NEUTRAL)
            const score = sig.probability;
            if (score > bestScore) {
                bestScore = score;
                bestResult = {
                    strategy: strat,
                    signal: sig.status === 'TRADE NOW' ? 'TRADE NOW' : sig.status === 'WAIT' ? 'WAIT' : 'SKIP',
                    direction: deriveDirection(strat, analysis),
                    entryCondition: sig.entryCondition || sig.recommendation,
                    confidence: Math.min(Math.round(score), 99),
                    targetDigit: sig.targetDigit,
                    evenPct: Math.round(analysis.evenPercentage),
                    oddPct: Math.round(analysis.oddPercentage),
                    highPct: Math.round(analysis.highPercentage),
                    lowPct: Math.round(analysis.lowPercentage),
                };
            }
        }

        if (!bestResult) return null;

        return {
            symbol,
            displayName,
            ticksAnalyzed: history.length,
            ...bestResult,
        };
    } catch {
        return null;
    }
}

function deriveDirection(stratId: string, analysis: any): string {
    switch (stratId) {
        case 'even_odd':
            return analysis.evenPercentage >= analysis.oddPercentage ? 'EVEN' : 'ODD';
        case 'over_under':
            return analysis.highPercentage >= analysis.lowPercentage ? 'OVER 4' : 'UNDER 5';
        case 'matches':
            return `MATCHES ${analysis.powerIndex.strongest}`;
        case 'differs':
            return `DIFFERS ${analysis.powerIndex.weakest}`;
        default:
            return '—';
    }
}

export function FloatingAIScanner({ theme = 'dark', availableSymbols = [], onScanComplete }: FloatingAIScannerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [selected, setSelected] = useState<string[]>([]);
    const [selStrats, setSelStrats] = useState<string[]>(['even_odd', 'over_under']);
    const [isScanning, setIsScanning] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressLabel, setProgressLabel] = useState('');
    const [results, setResults] = useState<ScanResult[]>([]);
    const [error, setError] = useState<string | null>(null);
    const abortRef = useRef(false);

    // Dragging and position state
    const [position, setPosition] = useState({ x: 100, y: 100 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const positionStart = useRef({ x: 0, y: 0 });

    // Initialize position to bottom right once window is defined
    useEffect(() => {
        if (typeof window !== 'undefined') {
            setPosition({
                x: window.innerWidth - 440, // 420px width + 20px gap
                y: window.innerHeight - 660, // 600px height + 60px gap
            });
        }
    }, []);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return; // Left click only
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('input')) return;
        setIsDragging(true);
        dragStart.current = { x: e.clientX, y: e.clientY };
        positionStart.current = { ...position };
        e.preventDefault();
    };

    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            const dx = e.clientX - dragStart.current.x;
            const dy = e.clientY - dragStart.current.y;
            setPosition({
                x: positionStart.current.x + dx,
                y: positionStart.current.y + dy,
            });
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    // Filter available symbols to only continuous volatility indices
    const continuousSymbols = availableSymbols.filter(s => s.symbol.startsWith('R_') || s.symbol.startsWith('1HZ'));

    const toggleMarket = (sym: string) => setSelected(p => (p.includes(sym) ? p.filter(s => s !== sym) : [...p, sym]));
    const toggleStrategy = (id: string) => setSelStrats(p => (p.includes(id) ? p.filter(s => s !== id) : [...p, id]));

    const handleScanAll = () => setSelected(continuousSymbols.map(s => s.symbol));
    const handleClear = () => setSelected([]);

    const handleScan = useCallback(async () => {
        if (selected.length === 0) {
            setError('Select at least one market.');
            return;
        }
        if (selStrats.length === 0) {
            setError('Select at least one strategy.');
            return;
        }
        setError(null);
        setIsScanning(true);
        setProgress(0);
        setResults([]);
        abortRef.current = false;

        const ws = DerivWebSocketManager.getInstance();
        if (!ws.isConnected()) {
            try {
                await ws.connect();
            } catch {
                setError('Cannot connect to Deriv. Check your connection.');
                setIsScanning(false);
                return;
            }
        }

        const collected: ScanResult[] = [];
        const total = selected.length;

        for (let i = 0; i < total; i++) {
            if (abortRef.current) break;
            const sym = selected[i];
            const info = continuousSymbols.find(s => s.symbol === sym);
            const displayName = info?.display_name || sym;

            setProgressLabel(`Scanning ${displayName}…`);
            setProgress(Math.round((i / total) * 100));

            const result = await analyseMarket(ws, sym, displayName, selStrats);
            if (result) collected.push(result);

            // Small delay to avoid flooding the WS
            await new Promise(r => setTimeout(r, 150));
        }

        // Sort: TRADE NOW first, WAIT second, SKIP last; then by confidence desc
        const ORDER = { 'TRADE NOW': 0, WAIT: 1, SKIP: 2 };
        collected.sort((a, b) => ORDER[a.signal] - ORDER[b.signal] || b.confidence - a.confidence);

        setResults(collected);
        setProgress(100);
        setProgressLabel(`Done — ${collected.length} markets analysed`);
        setIsScanning(false);
        if (onScanComplete) onScanComplete(collected);
    }, [selected, selStrats, availableSymbols, onScanComplete]);

    const handleStop = () => {
        abortRef.current = true;
    };

    // ─────────────────────────────── UI ────────────────────────────────────────

    const dark = theme === 'dark';
    const base = dark
        ? 'bg-gray-900/95 border-purple-500/20 text-white'
        : 'bg-white/95 border-purple-300 text-gray-900';

    return (
        <div
            className='fixed z-[60]'
            style={!isOpen ? { bottom: '24px', right: '88px' } : { left: `${position.x}px`, top: `${position.y}px` }}
        >
            {!isOpen ? (
                <button
                    onClick={() => setIsOpen(true)}
                    title='Open AI Market Scanner'
                    className='rounded-full w-16 h-16 flex items-center justify-center shadow-2xl bg-gradient-to-br from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 border border-violet-400/30 transition-all hover:scale-110 active:scale-95'
                    style={{ boxShadow: '0 0 30px rgba(124,58,237,.5)' }}
                >
                    <Brain className='w-7 h-7 text-white' />
                </button>
            ) : (
                <Card
                    className={`flex flex-col shadow-2xl border ${base} backdrop-blur-xl`}
                    style={{
                        width: '420px',
                        height: isMinimized ? 'auto' : '600px',
                        minWidth: '320px',
                        minHeight: isMinimized ? 'auto' : '300px',
                        resize: isMinimized ? 'none' : 'both',
                        overflow: 'hidden',
                    }}
                >
                    {/* ── Header ── */}
                    <div
                        onMouseDown={handleMouseDown}
                        className={`px-4 py-3 flex items-center justify-between border-b cursor-move select-none ${dark ? 'border-white/5 bg-gradient-to-r from-violet-600/15 to-indigo-600/10' : 'border-gray-200 bg-purple-50'}`}
                    >
                        <div className='flex items-center gap-2'>
                            <Brain className={`w-4 h-4 ${dark ? 'text-violet-400' : 'text-violet-600'}`} />
                            <span className='text-xs font-black uppercase tracking-widest'>AI Market Scanner</span>
                            {results.length > 0 && !isScanning && (
                                <Badge className='text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-400 border-emerald-500/30 px-2 py-0'>
                                    {results.filter(r => r.signal === 'TRADE NOW').length} Signals
                                </Badge>
                            )}
                        </div>
                        <div className='flex items-center gap-1'>
                            <button
                                onClick={() => setIsMinimized(m => !m)}
                                className={`p-1 rounded ${dark ? 'hover:bg-white/10' : 'hover:bg-black/10'}`}
                            >
                                {isMinimized ? (
                                    <ChevronUp className='w-3.5 h-3.5' />
                                ) : (
                                    <ChevronDown className='w-3.5 h-3.5' />
                                )}
                            </button>
                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    setIsMinimized(false);
                                }}
                                className={`p-1 rounded ${dark ? 'hover:bg-white/10' : 'hover:bg-black/10'}`}
                            >
                                <X className='w-3.5 h-3.5' />
                            </button>
                        </div>
                    </div>

                    {!isMinimized && (
                        <div className='p-4 space-y-4 flex-1 overflow-y-auto'>
                            {/* ── Strategy chips ── */}
                            <div className='space-y-2'>
                                <p
                                    className={`text-[10px] font-black uppercase tracking-widest ${dark ? 'text-slate-500' : 'text-gray-500'}`}
                                >
                                    Strategies to scan
                                </p>
                                <div className='grid grid-cols-2 gap-2'>
                                    {STRATEGIES.map(s => {
                                        const active = selStrats.includes(s.id);
                                        return (
                                            <button
                                                key={s.id}
                                                onClick={() => toggleStrategy(s.id)}
                                                className={`px-3 py-2 rounded-lg text-[11px] font-bold text-left transition-all border ${
                                                    active
                                                        ? 'bg-violet-600/30 border-violet-500/60 text-violet-300'
                                                        : dark
                                                          ? 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                                                          : 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200'
                                                }`}
                                            >
                                                <span className='mr-1.5'>{s.icon}</span>
                                                {s.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* ── Market chips ── */}
                            <div className='space-y-2'>
                                <div className='flex items-center justify-between'>
                                    <p
                                        className={`text-[10px] font-black uppercase tracking-widest ${dark ? 'text-slate-500' : 'text-gray-500'}`}
                                    >
                                        Markets{' '}
                                        <span className={`ml-1 ${dark ? 'text-violet-400' : 'text-violet-600'}`}>
                                            ({selected.length}/{continuousSymbols.length})
                                        </span>
                                    </p>
                                    <div className='flex gap-2'>
                                        <button
                                            onClick={handleScanAll}
                                            className={`text-[10px] font-bold ${dark ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-700'}`}
                                        >
                                            All
                                        </button>
                                        {selected.length > 0 && (
                                            <button
                                                onClick={handleClear}
                                                className={`text-[10px] font-bold ${dark ? 'text-rose-400 hover:text-rose-300' : 'text-rose-600'}`}
                                            >
                                                Clear
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className='grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1'>
                                    {continuousSymbols.map(m => {
                                        const active = selected.includes(m.symbol);
                                        return (
                                            <button
                                                key={m.symbol}
                                                onClick={() => toggleMarket(m.symbol)}
                                                className={`px-2.5 py-1.5 rounded text-[10px] font-bold text-left truncate transition-all border ${
                                                    active
                                                        ? 'bg-indigo-600/30 border-indigo-500/50 text-indigo-300'
                                                        : dark
                                                          ? 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                                                          : 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200'
                                                }`}
                                                title={m.display_name || m.symbol}
                                            >
                                                {m.display_name || m.symbol}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* ── Error ── */}
                            {error && (
                                <p className='text-[11px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2'>
                                    {error}
                                </p>
                            )}

                            {/* ── Progress ── */}
                            {isScanning && (
                                <div className='space-y-2'>
                                    <div className='flex items-center justify-between'>
                                        <div className='flex items-center gap-2'>
                                            <Loader2 className='w-3.5 h-3.5 animate-spin text-violet-400' />
                                            <span
                                                className={`text-[10px] font-black truncate max-w-[250px] ${dark ? 'text-slate-400' : 'text-gray-500'}`}
                                            >
                                                {progressLabel}
                                            </span>
                                        </div>
                                        <button
                                            onClick={handleStop}
                                            className='text-[10px] font-bold text-rose-400 hover:text-rose-300'
                                        >
                                            Stop
                                        </button>
                                    </div>
                                    <div
                                        className={`w-full h-1.5 rounded-full overflow-hidden ${dark ? 'bg-white/10' : 'bg-gray-200'}`}
                                    >
                                        <div
                                            className='h-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-300 rounded-full'
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                    <p
                                        className={`text-[10px] text-right font-black ${dark ? 'text-slate-600' : 'text-gray-400'}`}
                                    >
                                        {progress}%
                                    </p>
                                </div>
                            )}

                            {/* ── Scan / Rescan button ── */}
                            {!isScanning && (
                                <button
                                    onClick={handleScan}
                                    disabled={selected.length === 0 || selStrats.length === 0}
                                    className='w-full py-2.5 rounded-xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-[0_0_20px_rgba(124,58,237,.35)]'
                                >
                                    {results.length > 0 ? (
                                        <RefreshCw className='w-3.5 h-3.5' />
                                    ) : (
                                        <Zap className='w-3.5 h-3.5' />
                                    )}
                                    {results.length > 0 ? 'Re-Scan' : 'Scan Markets'}
                                </button>
                            )}

                            {/* ── Results ── */}
                            {results.length > 0 && !isScanning && (
                                <div className='space-y-2'>
                                    <p
                                        className={`text-[10px] font-black uppercase tracking-widest ${dark ? 'text-slate-500' : 'text-gray-500'}`}
                                    >
                                        Results — sorted by opportunity
                                    </p>

                                    {results.map((r, idx) => (
                                        <div
                                            key={r.symbol + idx}
                                            className={`rounded-xl border p-3 space-y-2 transition-all ${
                                                r.signal === 'TRADE NOW'
                                                    ? dark
                                                        ? 'bg-emerald-500/5 border-emerald-500/30'
                                                        : 'bg-emerald-50 border-emerald-300'
                                                    : r.signal === 'WAIT'
                                                      ? dark
                                                          ? 'bg-amber-500/5 border-amber-500/20'
                                                          : 'bg-amber-50 border-amber-200'
                                                      : dark
                                                        ? 'bg-white/[0.02] border-white/5'
                                                        : 'bg-gray-50 border-gray-200'
                                            }`}
                                        >
                                            {/* Row 1: symbol + signal badge */}
                                            <div className='flex items-center justify-between'>
                                                <div className='flex items-center gap-2'>
                                                    <span
                                                        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${SIGNAL_DOT[r.signal]}`}
                                                    />
                                                    <span
                                                        className={`text-[11px] font-black truncate max-w-[180px] ${dark ? 'text-white' : 'text-gray-900'}`}
                                                    >
                                                        {r.displayName}
                                                    </span>
                                                </div>
                                                <Badge
                                                    className={`text-[9px] font-black uppercase px-2 py-0.5 border ${SIGNAL_COLOR[r.signal]}`}
                                                >
                                                    {r.signal}
                                                </Badge>
                                            </div>

                                            {/* Row 2: direction chip + strategy + confidence */}
                                            <div className='flex items-center gap-2 flex-wrap'>
                                                <span
                                                    className={`px-2 py-0.5 rounded font-black text-[10px] bg-indigo-500/20 border border-indigo-500/30 text-indigo-300`}
                                                >
                                                    {r.direction}
                                                </span>
                                                <span
                                                    className={`text-[10px] font-bold ${dark ? 'text-slate-500' : 'text-gray-400'}`}
                                                >
                                                    {stratLabel(r.strategy)}
                                                </span>
                                                <span
                                                    className={`ml-auto text-[11px] font-black ${
                                                        r.confidence >= 65
                                                            ? 'text-emerald-400'
                                                            : r.confidence >= 55
                                                              ? 'text-amber-400'
                                                              : dark
                                                                ? 'text-slate-500'
                                                                : 'text-gray-400'
                                                    }`}
                                                >
                                                    {r.confidence}%
                                                </span>
                                            </div>

                                            {/* Row 3: confidence bar */}
                                            <div
                                                className={`w-full h-1 rounded-full overflow-hidden ${dark ? 'bg-white/10' : 'bg-gray-200'}`}
                                            >
                                                <div
                                                    className={`h-full rounded-full ${r.confidence >= 65 ? 'bg-emerald-500' : r.confidence >= 55 ? 'bg-amber-400' : 'bg-slate-600'}`}
                                                    style={{ width: `${r.confidence}%` }}
                                                />
                                            </div>

                                            {/* Row 4: stats pills */}
                                            <div className='flex gap-2 flex-wrap'>
                                                <StatPill
                                                    label='Even'
                                                    value={`${r.evenPct}%`}
                                                    dark={dark}
                                                    highlight={r.direction === 'EVEN'}
                                                />
                                                <StatPill
                                                    label='Odd'
                                                    value={`${r.oddPct}%`}
                                                    dark={dark}
                                                    highlight={r.direction === 'ODD'}
                                                />
                                                <StatPill
                                                    label='High'
                                                    value={`${r.highPct}%`}
                                                    dark={dark}
                                                    highlight={r.direction.startsWith('OVER')}
                                                />
                                                <StatPill
                                                    label='Low'
                                                    value={`${r.lowPct}%`}
                                                    dark={dark}
                                                    highlight={r.direction.startsWith('UNDER')}
                                                />
                                                <StatPill label='Ticks' value={`${r.ticksAnalyzed}`} dark={dark} />
                                            </div>

                                            {/* Row 5: entry condition */}
                                            {r.signal !== 'SKIP' && (
                                                <div
                                                    className={`rounded-lg px-3 py-2 text-[10px] leading-relaxed font-semibold ${
                                                        dark
                                                            ? 'bg-white/5 text-slate-300'
                                                            : 'bg-white text-gray-700 border border-gray-200'
                                                    }`}
                                                >
                                                    <span
                                                        className={`font-black mr-1 ${dark ? 'text-violet-400' : 'text-violet-600'}`}
                                                    >
                                                        Entry:
                                                    </span>
                                                    {r.entryCondition}
                                                    {r.targetDigit !== undefined && (
                                                        <span
                                                            className={`ml-2 font-black px-1.5 py-0.5 rounded text-indigo-300 bg-indigo-500/20`}
                                                        >
                                                            Digit {r.targetDigit}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* ── Empty state ── */}
                            {results.length === 0 && !isScanning && (
                                <div
                                    className={`flex flex-col items-center justify-center py-8 gap-3 ${dark ? 'text-slate-600' : 'text-gray-400'}`}
                                >
                                    <Activity className='w-8 h-8 opacity-30' />
                                    <p className='text-[11px] font-black uppercase tracking-widest'>
                                        Select markets and scan
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </Card>
            )}
        </div>
    );
}

function stratLabel(id: string): string {
    return { even_odd: 'Even/Odd', over_under: 'Over/Under', matches: 'Matches', differs: 'Differs' }[id] ?? id;
}

function StatPill({
    label,
    value,
    dark,
    highlight,
}: {
    label: string;
    value: string;
    dark: boolean;
    highlight?: boolean;
}) {
    return (
        <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black border ${
                highlight
                    ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300'
                    : dark
                      ? 'bg-white/5 border-white/5 text-slate-500'
                      : 'bg-gray-100 border-gray-200 text-gray-500'
            }`}
        >
            <span className='opacity-60'>{label}</span>
            <span>{value}</span>
        </span>
    );
}
