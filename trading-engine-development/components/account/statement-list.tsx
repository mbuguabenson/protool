'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDerivAPI } from '@/lib/deriv-api-context';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCcw, ArrowUpRight, ArrowDownLeft, ReceiptText, Calendar, Wallet, History, Search } from 'lucide-react';
import { format, subDays, subMonths, subYears } from 'date-fns';

interface StatementTransaction {
    action_type: string;
    amount: number;
    balance_after: number;
    contract_id?: number;
    display_name: string;
    longcode: string;
    transaction_id: number;
    transaction_time: number;
    reference_id: number;
}

interface StatementListProps {
    theme?: 'light' | 'dark';
}

const QUICK_PRESETS = [
    { label: 'Today', getRange: () => ({ from: new Date(new Date().setHours(0, 0, 0, 0)), to: new Date() }) },
    { label: '7 Days', getRange: () => ({ from: subDays(new Date(), 7), to: new Date() }) },
    { label: '30 Days', getRange: () => ({ from: subDays(new Date(), 30), to: new Date() }) },
    { label: '3 Months', getRange: () => ({ from: subMonths(new Date(), 3), to: new Date() }) },
    { label: '1 Year', getRange: () => ({ from: subYears(new Date(), 1), to: new Date() }) },
];

export function StatementList({ theme = 'dark' }: StatementListProps) {
    const { apiClient, isAuthorized, activeLoginId } = useDerivAPI();
    const [statement, setStatement] = useState<StatementTransaction[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activePreset, setActivePreset] = useState('30 Days');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [showCustom, setShowCustom] = useState(false);

    const fetchStatement = useCallback(
        async (dateFrom?: number, dateTo?: number) => {
            if (!apiClient || !isAuthorized) return;

            setIsLoading(true);
            setError(null);
            try {
                const response = await apiClient.getStatement(50, 0, dateFrom, dateTo);
                if (response && response.transactions) {
                    setStatement(response.transactions);
                } else {
                    setStatement([]);
                }
            } catch (err: any) {
                console.error('[v0] Error fetching statement:', err);
                setError(err?.message || 'Failed to fetch statement');
            } finally {
                setIsLoading(false);
            }
        },
        [apiClient, isAuthorized]
    );

    const applyPreset = (preset: (typeof QUICK_PRESETS)[0]) => {
        setActivePreset(preset.label);
        setShowCustom(false);
        const { from, to } = preset.getRange();
        fetchStatement(Math.floor(from.getTime() / 1000), Math.floor(to.getTime() / 1000));
    };

    const applyCustom = () => {
        if (!customFrom || !customTo) return;
        const from = new Date(customFrom);
        const to = new Date(customTo);
        to.setHours(23, 59, 59, 999);
        fetchStatement(Math.floor(from.getTime() / 1000), Math.floor(to.getTime() / 1000));
        setActivePreset('Custom');
        setShowCustom(false);
    };

    useEffect(() => {
        const from = subDays(new Date(), 30);
        fetchStatement(Math.floor(from.getTime() / 1000));
    }, [fetchStatement, activeLoginId]);

    const formatDate = (timestamp: number) => {
        return new Date(timestamp * 1000).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        });
    };

    const formatCurrency = (val: number | undefined | null) => {
        const safeVal = val == null || isNaN(Number(val)) ? 0 : Number(val);
        return safeVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const getActionBadge = (action: string) => {
        const type = action.toLowerCase();
        let colors = 'bg-white/5 text-white/40 border-white/10';

        if (type === 'buy') colors = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
        if (type === 'sell') colors = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
        if (type === 'deposit') colors = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
        if (type === 'withdrawal') colors = 'bg-rose-500/10 text-rose-400 border-rose-500/20';

        return (
            <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border ${colors}`}>
                {action}
            </span>
        );
    };

    const getAmountColor = (amount: number) => {
        if (amount > 0) return 'text-emerald-400';
        if (amount < 0) return 'text-rose-400';
        return 'text-white/40';
    };

    return (
        <div className='space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700'>
            {/* Header Area */}
            <div className='flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6'>
                <div>
                    <h3 className='text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3'>
                        <History className='h-6 w-6 text-blue-500' /> Nexus Ledger
                    </h3>
                    <p className='text-[10px] text-white/30 font-bold uppercase tracking-[0.2em] mt-1'>
                        Universal transaction synchronization
                    </p>
                </div>

                <div className='flex flex-wrap items-center gap-2 bg-white/[0.02] border border-white/5 p-1.5 rounded-2xl'>
                    {QUICK_PRESETS.map(p => (
                        <button
                            key={p.label}
                            onClick={() => applyPreset(p)}
                            className={`h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                activePreset === p.label
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                                    : 'text-white/40 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            {p.label}
                        </button>
                    ))}
                    <div className='w-px h-4 bg-white/10 mx-1' />
                    <button
                        onClick={() => setShowCustom(!showCustom)}
                        className={`h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                            showCustom
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                                : 'text-white/40 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        <Calendar className='h-3 w-3' />
                        Custom
                    </button>
                    <button
                        onClick={() => {
                            const p = QUICK_PRESETS.find(p => p.label === activePreset);
                            if (p) applyPreset(p);
                        }}
                        disabled={isLoading}
                        className='h-9 w-9 flex items-center justify-center rounded-xl bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-all'
                    >
                        <RefreshCcw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {showCustom && (
                <div className='grid grid-cols-1 md:grid-cols-3 gap-4 p-6 bg-white/[0.03] border border-white/10 rounded-[2rem] animate-in slide-in-from-top-4 duration-300'>
                    <div className='space-y-2'>
                        <label className='text-[10px] text-white/30 font-black uppercase tracking-[0.2em] ml-1'>
                            Origin Date
                        </label>
                        <input
                            type='date'
                            value={customFrom}
                            onChange={e => setCustomFrom(e.target.value)}
                            className='w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500/50 transition-all'
                        />
                    </div>
                    <div className='space-y-2'>
                        <label className='text-[10px] text-white/30 font-black uppercase tracking-[0.2em] ml-1'>
                            Target Date
                        </label>
                        <input
                            type='date'
                            value={customTo}
                            onChange={e => setCustomTo(e.target.value)}
                            className='w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500/50 transition-all'
                        />
                    </div>
                    <div className='flex items-end'>
                        <button
                            onClick={applyCustom}
                            disabled={!customFrom || !customTo}
                            className='w-full h-11 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-blue-600/20 active:scale-95 disabled:opacity-50 disabled:grayscale'
                        >
                            EXECUTE QUERY
                        </button>
                    </div>
                </div>
            )}

            {error && (
                <div className='p-5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[11px] font-bold uppercase tracking-wider flex items-center gap-3'>
                    <div className='w-2 h-2 rounded-full bg-rose-500 animate-pulse' />
                    Ledger Error: {error}
                </div>
            )}

            {/* Premium Table Container */}
            <div className='bg-[#0a0a0a] border border-white/5 rounded-[2.5rem] overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.4)]'>
                <div className='overflow-x-auto'>
                    <Table>
                        <TableHeader className='bg-white/[0.02]'>
                            <TableRow className='hover:bg-transparent border-white/[0.05] h-14'>
                                <TableHead className='text-[10px] font-black uppercase tracking-widest text-white/30 pl-8'>
                                    Timeline
                                </TableHead>
                                <TableHead className='text-[10px] font-black uppercase tracking-widest text-white/30'>
                                    Reference
                                </TableHead>
                                <TableHead className='text-[10px] font-black uppercase tracking-widest text-white/30 text-center'>
                                    Protocol
                                </TableHead>
                                <TableHead className='text-[10px] font-black uppercase tracking-widest text-white/30 text-right'>
                                    Transaction ID
                                </TableHead>
                                <TableHead className='text-[10px] font-black uppercase tracking-widest text-white/30 text-right'>
                                    Delta ($)
                                </TableHead>
                                <TableHead className='text-[10px] font-black uppercase tracking-widest text-white/30 text-right pr-8'>
                                    Post-Balance
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: 8 }).map((_, i) => (
                                    <TableRow key={i} className='border-white/[0.03]'>
                                        <TableCell className='pl-8'>
                                            <Skeleton className='h-4 w-32 bg-white/5' />
                                        </TableCell>
                                        <TableCell>
                                            <Skeleton className='h-4 w-20 bg-white/5' />
                                        </TableCell>
                                        <TableCell className='flex justify-center'>
                                            <Skeleton className='h-4 w-16 bg-white/5' />
                                        </TableCell>
                                        <TableCell>
                                            <Skeleton className='h-4 w-24 ml-auto bg-white/5' />
                                        </TableCell>
                                        <TableCell>
                                            <Skeleton className='h-4 w-20 ml-auto bg-white/5' />
                                        </TableCell>
                                        <TableCell className='pr-8'>
                                            <Skeleton className='h-4 w-24 ml-auto bg-white/5' />
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : statement.length > 0 ? (
                                statement.map(tx => (
                                    <TableRow
                                        key={tx.transaction_id}
                                        className='border-white/[0.03] group/row transition-all hover:bg-white/[0.015]'
                                    >
                                        <TableCell className='pl-8'>
                                            <div className='flex flex-col'>
                                                <span className='text-[11px] font-black text-white/60 tracking-tighter'>
                                                    {formatDate(tx.transaction_time).split(',')[0]}
                                                </span>
                                                <span className='text-[9px] font-bold text-white/20 uppercase'>
                                                    {formatDate(tx.transaction_time).split(',')[1]}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <span className='text-[10px] font-mono font-bold text-white/30 border border-white/5 px-2 py-1 rounded-md bg-white/[0.01]'>
                                                {tx.reference_id}
                                            </span>
                                        </TableCell>
                                        <TableCell className='text-center'>{getActionBadge(tx.action_type)}</TableCell>
                                        <TableCell className='text-right'>
                                            <span className='text-[10px] font-mono text-white/40 tracking-tighter'>
                                                #{tx.transaction_id}
                                            </span>
                                        </TableCell>
                                        <TableCell className='text-right'>
                                            <div className='flex flex-col items-end'>
                                                <span
                                                    className={`text-sm font-black tracking-tighter tabular-nums ${getAmountColor(tx.amount ?? 0)}`}
                                                >
                                                    {(tx.amount ?? 0) > 0 ? '+' : ''}
                                                    {formatCurrency(tx.amount)}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className='text-right pr-8'>
                                            <div className='flex flex-col items-end'>
                                                <span className='text-sm font-black text-white tracking-tighter tabular-nums shadow-current'>
                                                    {formatCurrency(tx.balance_after)}
                                                </span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow className='hover:bg-transparent'>
                                    <TableCell colSpan={6} className='h-64 text-center'>
                                        <div className='flex flex-col items-center justify-center'>
                                            <div className='w-16 h-16 bg-white/[0.02] border border-white/5 rounded-[1.5rem] flex items-center justify-center mb-6'>
                                                <ReceiptText className='h-8 w-8 text-white/10' />
                                            </div>
                                            <h4 className='text-lg font-black text-white/40 uppercase tracking-tight'>
                                                Ledger Empty
                                            </h4>
                                            <p className='text-white/20 text-xs mt-2 max-w-sm font-medium'>
                                                {isAuthorized
                                                    ? 'No trajectory data detected in the selected temporal range.'
                                                    : 'Authorize your bio-metric signature to decrypt ledger data.'}
                                            </p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Internal Ledger Footer */}
                <div className='px-8 py-5 border-t border-white/[0.05] bg-white/[0.01] flex items-center justify-between'>
                    <div className='flex items-center gap-6'>
                        <div className='flex items-center gap-2'>
                            <div className='w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b881]' />
                            <span className='text-[9px] font-black text-white/30 uppercase tracking-widest'>
                                Core Synchronized
                            </span>
                        </div>
                        <div className='flex items-center gap-2'>
                            <History className='h-3 w-3 text-white/20' />
                            <span className='text-[9px] font-black text-white/30 uppercase tracking-widest'>
                                {statement.length} Records
                            </span>
                        </div>
                    </div>
                    <div className='text-[9px] font-black text-white/20 uppercase tracking-widest font-mono'>
                        Vault Release: v4.2.0-STABLE
                    </div>
                </div>
            </div>
        </div>
    );
}
