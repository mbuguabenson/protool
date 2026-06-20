'use client';

import React from 'react';

// ─── GlassCard ────────────────────────────────────────────────────────────────
interface GlassCardProps {
    children: React.ReactNode;
    className?: string;
}
export function GlassCard({ children, className = '' }: GlassCardProps) {
    return (
        <div
            className={`relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-xl p-4 ${className}`}
        >
            {children}
        </div>
    );
}

// ─── GlassPanel ───────────────────────────────────────────────────────────────
interface GlassPanelProps {
    children: React.ReactNode;
    className?: string;
    title?: string;
}
export function GlassPanel({ children, className = '', title }: GlassPanelProps) {
    return (
        <div
            className={`rounded-3xl border border-white/[0.07] bg-white/[0.03] backdrop-blur-2xl p-6 shadow-2xl ${className}`}
        >
            {title && <h3 className='text-xs font-black text-white/30 uppercase tracking-[0.3em] mb-4'>{title}</h3>}
            {children}
        </div>
    );
}

// ─── NeomorphButton ───────────────────────────────────────────────────────────
interface NeomorphButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children: React.ReactNode;
    variant?: 'primary' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
}
export function NeomorphButton({
    children,
    variant = 'primary',
    size = 'md',
    className = '',
    ...props
}: NeomorphButtonProps) {
    const sizeClasses = { sm: 'px-3 py-1.5 text-xs', md: 'px-5 py-2.5 text-sm', lg: 'px-7 py-3.5 text-base' };
    const variantClasses = {
        primary: 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg hover:opacity-90',
        ghost: 'bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white',
        danger: 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg hover:opacity-90',
    };
    return (
        <button
            className={`inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-all active:scale-95 ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
            {...props}
        >
            {children}
        </button>
    );
}

// ─── StatPill ────────────────────────────────────────────────────────────────
type StatVariant = 'default' | 'positive' | 'negative';
interface StatPillProps {
    label: string;
    value: string | number;
    color?: string;
    variant?: StatVariant;
}
const variantColors: Record<StatVariant, string> = {
    default: 'text-blue-400',
    positive: 'text-emerald-400',
    negative: 'text-red-400',
};
export function StatPill({ label, value, color, variant = 'default' }: StatPillProps) {
    const textColor = color || variantColors[variant];
    return (
        <div className='flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10'>
            <span className='text-[10px] font-black text-white/30 uppercase tracking-widest'>{label}</span>
            <span className={`text-sm font-black tabular-nums ${textColor}`}>{value}</span>
        </div>
    );
}

// ─── PowerBar ────────────────────────────────────────────────────────────────
interface PowerBarProps {
    value: number; // 0-100
    color?: string;
    className?: string;
    label?: string;
    showLabel?: boolean;
    animated?: boolean;
}
export function PowerBar({
    value,
    color = 'from-blue-500 to-indigo-500',
    className = '',
    label,
    showLabel,
    animated,
}: PowerBarProps) {
    const clamped = Math.max(0, Math.min(100, value));
    return (
        <div className={`space-y-1 ${className}`}>
            {showLabel && label && (
                <div className='flex justify-between text-xs text-white/40'>
                    <span>{label}</span>
                    <span>{clamped.toFixed(1)}%</span>
                </div>
            )}
            <div className='h-2 rounded-full bg-white/10 overflow-hidden'>
                <div
                    className={`h-full rounded-full bg-gradient-to-r ${color} ${animated ? 'transition-all duration-700' : ''}`}
                    style={{ width: `${clamped}%` }}
                />
            </div>
        </div>
    );
}

// ─── StatGrid ────────────────────────────────────────────────────────────────
interface StatGridItem {
    label: string;
    value: string | number;
    color?: string;
    variant?: StatVariant;
}
interface StatGridProps {
    stats?: StatGridItem[];
    items?: StatGridItem[];
    columns?: number;
}
export function StatGrid({ stats, items, columns = 2 }: StatGridProps) {
    const data = stats || items || [];
    return (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: '1rem' }}>
            {data.map((s, i) => {
                const textColor = s.color || (s.variant ? variantColors[s.variant] : 'text-white');
                return (
                    <div key={i} className='flex flex-col gap-1'>
                        <span className='text-[10px] font-black text-white/30 uppercase tracking-widest'>
                            {s.label}
                        </span>
                        <span className={`text-2xl font-black tabular-nums ${textColor}`}>{s.value}</span>
                    </div>
                );
            })}
        </div>
    );
}

// ─── TradeCard ────────────────────────────────────────────────────────────────
interface TradeCardProps {
    symbol?: string;
    direction?: 'CALL' | 'PUT' | string;
    stake?: number;
    pnl?: number;
    status?: 'open' | 'won' | 'lost';
    // Engine-specific props
    digit?: number;
    amount?: number;
    result?: 'win' | 'loss' | 'pending' | string;
    time?: string;
    bot?: string;
}
export function TradeCard({ symbol, direction, stake, pnl, digit, amount, result, time, bot }: TradeCardProps) {
    const isWin = result === 'win';
    const isLoss = result === 'loss';
    const borderColor = isWin
        ? 'border-emerald-500/30 bg-emerald-500/10'
        : isLoss
          ? 'border-red-500/30 bg-red-500/10'
          : 'border-white/10 bg-white/5';
    return (
        <div className={`rounded-2xl border p-4 flex items-center justify-between ${borderColor}`}>
            <div>
                <p className='text-xs font-black text-white/40 uppercase tracking-widest'>{bot || symbol || '—'}</p>
                <p className='text-lg font-black text-white'>
                    {direction || (digit !== undefined ? `Digit ${digit}` : '—')}
                </p>
                {time && <p className='text-xs text-white/30'>{time}</p>}
            </div>
            <div className='text-right'>
                {stake !== undefined && <p className='text-sm font-bold text-white'>{stake.toFixed(2)}</p>}
                {amount !== undefined && (
                    <p className={`text-sm font-black ${amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {amount >= 0 ? '+' : ''}
                        {amount.toFixed(2)}
                    </p>
                )}
                {pnl !== undefined && (
                    <p className={`text-xs font-black ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {pnl >= 0 ? '+' : ''}
                        {pnl.toFixed(2)}
                    </p>
                )}
                {result && (
                    <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${isWin ? 'bg-emerald-500/20 text-emerald-400' : isLoss ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white/40'}`}
                    >
                        {result}
                    </span>
                )}
            </div>
        </div>
    );
}

// ─── GlowBadge ───────────────────────────────────────────────────────────────
type GlowColor = 'blue' | 'emerald' | 'amber' | 'red' | 'purple' | 'green';
interface GlowBadgeProps {
    children: React.ReactNode;
    color?: GlowColor;
    size?: 'sm' | 'md';
}
const glowColors: Record<GlowColor, string> = {
    blue: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
    emerald: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    amber: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    red: 'bg-red-500/10 border-red-500/30 text-red-400',
    purple: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
    green: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
};
export function GlowBadge({ children, color = 'blue', size = 'md' }: GlowBadgeProps) {
    const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-[9px]' : 'px-2.5 py-0.5 text-[10px]';
    return (
        <span
            className={`inline-flex items-center rounded-full border font-black uppercase tracking-widest ${sizeClass} ${glowColors[color]}`}
        >
            {children}
        </span>
    );
}
