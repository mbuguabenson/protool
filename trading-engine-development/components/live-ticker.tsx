'use client';

import { useState, useEffect } from 'react';

interface LiveTickerProps {
    price: number | null | undefined;
    digit: number | null;
    theme?: 'light' | 'dark';
    symbol?: string;
    children?: React.ReactNode;
    depthSelector?: React.ReactNode;
    compact?: boolean;
}

export function LiveTicker({
    price,
    digit,
    theme = 'dark',
    symbol = 'Volatility',
    children,
    depthSelector,
    compact = false,
}: LiveTickerProps) {
    const [animatingPrice, setAnimatingPrice] = useState(false);
    const [animatingDigit, setAnimatingDigit] = useState(false);
    const [prevPrice, setPrevPrice] = useState(price);
    const [prevDigit, setPrevDigit] = useState(digit);

    useEffect(() => {
        if (price !== prevPrice) {
            setAnimatingPrice(true);
            setPrevPrice(price);
            const timer = setTimeout(() => setAnimatingPrice(false), 500);
            return () => clearTimeout(timer);
        }
    }, [price, prevPrice]);

    useEffect(() => {
        if (digit !== prevDigit) {
            setAnimatingDigit(true);
            setPrevDigit(digit);
            const timer = setTimeout(() => setAnimatingDigit(false), 500);
            return () => clearTimeout(timer);
        }
    }, [digit, prevDigit]);

    const priceChange = price && prevPrice ? price - prevPrice : 0;
    const priceUp = priceChange > 0;
    const priceDown = priceChange < 0;

    if (compact) {
        return (
            <div
                className={`relative group overflow-hidden flex items-center w-full h-9 sm:h-11 rounded-lg sm:rounded-xl transition-all duration-500 border p-0.5 ${
                    theme === 'dark'
                        ? 'glass-fintech border-cyan-500/10 bg-black/40 shadow-none'
                        : 'bg-white border-cyan-50 shadow-none'
                } ${animatingPrice || animatingDigit ? 'border-cyan-400/40' : ''}`}
            >
                {/* Market Selector area */}
                <div className='flex items-center px-1 sm:px-3 h-full bg-white/5 rounded-md sm:rounded-lg transition-colors overflow-hidden flex-shrink-0 w-[110px] sm:w-auto'>
                    <div className='w-full'>{children}</div>
                </div>

                {/* Data area - Strict single row */}
                <div className='flex flex-1 items-center justify-between px-1.5 sm:px-3 h-full gap-1 sm:gap-4 min-w-0'>
                    {/* Depth/Price Cluster */}
                    <div className='flex items-center gap-1 sm:gap-3 min-w-0'>
                        {depthSelector && <div>{depthSelector}</div>}

                        <div className='flex flex-col min-w-0 justify-center'>
                            <span
                                className={`text-[8px] sm:text-[9px] uppercase tracking-wider font-bold leading-none mb-[2px] ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'}`}
                            >
                                Market Price
                            </span>
                            <div
                                className={`text-sm sm:text-base font-mono font-black tabular-nums leading-none transition-all duration-300 flex items-center gap-0.5 ${
                                    animatingPrice
                                        ? priceUp
                                            ? 'text-emerald-400'
                                            : priceDown
                                              ? 'text-rose-400'
                                              : 'text-white'
                                        : theme === 'dark'
                                          ? 'text-white'
                                          : 'text-slate-900'
                                }`}
                            >
                                <span className='truncate'>{price?.toFixed(5) || '-----.--'}</span>
                                <div className='flex flex-col text-[8px] leading-none shrink-0 ml-0.5'>
                                    {priceUp && <span className='text-emerald-400'>▲</span>}
                                    {priceDown && <span className='text-rose-400'>▼</span>}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Vertical Divider (Desktop) */}
                    <div className='h-5 sm:h-7 w-px bg-cyan-500/10 hidden lg:block' />

                    {/* Digit Cluster */}
                    <div className='flex items-center gap-1 shrink-0'>
                        <div className='flex flex-col text-right hidden lg:flex justify-center'>
                            <span
                                className={`text-[8px] uppercase tracking-wider font-bold leading-none mb-[2px] ${theme === 'dark' ? 'text-orange-400' : 'text-orange-600'}`}
                            >
                                Live
                            </span>
                            <span className='text-[9px] text-gray-500 font-bold leading-none'>Digit</span>
                        </div>
                        <div
                            className={`text-sm sm:text-base font-black w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-md sm:rounded-lg transition-all duration-300 ${
                                animatingDigit
                                    ? 'bg-orange-500/20 text-orange-400 scale-105 border border-orange-500/30'
                                    : theme === 'dark'
                                      ? 'bg-slate-900/50 text-orange-500 border border-white/5'
                                      : 'bg-slate-50 text-orange-600 border border-gray-200'
                            }`}
                        >
                            {digit !== null ? digit : '-'}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            className={`relative group overflow-hidden flex flex-col sm:flex-row items-stretch gap-2 sm:gap-0 px-3 py-2 sm:px-6 sm:py-0 sm:h-20 rounded-2xl border transition-all duration-500 ${
                theme === 'dark'
                    ? 'glass-fintech border-cyan-500/20 bg-[#0a1128]/50 shadow-[0_0_30px_rgba(6,182,212,0.1)]'
                    : 'bg-white border-cyan-100 shadow-lg'
            } ${animatingPrice || animatingDigit ? 'border-cyan-400/50 shadow-cyan-500/20' : ''}`}
        >
            {/* Background Glow Pulse (Dark Mode Only) */}
            {theme === 'dark' && (
                <div className='absolute inset-0 bg-linear-to-r from-cyan-500/5 via-blue-500/5 to-purple-500/5 opacity-50 group-hover:opacity-100 transition-opacity duration-1000' />
            )}

            {/* Market Info Section */}
            <div className='flex-1 flex flex-col justify-center sm:px-6 relative z-10 py-1 sm:py-0'>
                <div className='flex items-center gap-2 mb-0.5 sm:mb-1'>
                    <div className='h-1 w-1 sm:h-1.5 sm:w-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.8)]' />
                    <h3
                        className={`text-[8px] sm:text-[10px] uppercase tracking-[0.2em] font-black ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'}`}
                    >
                        Market Node
                    </h3>
                </div>
                <div className='flex items-center min-w-0'>
                    {children ? (
                        children
                    ) : (
                        <div
                            className={`text-sm sm:text-2xl font-black tracking-tight truncate ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}
                        >
                            {symbol}
                        </div>
                    )}
                </div>
            </div>

            {/* Vertical Dividers (Desktop) */}
            <div
                className={`hidden sm:block w-px h-full ${theme === 'dark' ? 'bg-linear-to-b from-transparent via-cyan-500/20 to-transparent' : 'bg-slate-200'}`}
            />

            {/* Price Section */}
            <div className='flex-[1.5] flex flex-col justify-center relative sm:px-8 group/price z-10 border-t border-b sm:border-0 border-cyan-500/10 py-2 sm:py-0'>
                <div className='absolute inset-0 bg-cyan-500/0 group-hover/price:bg-cyan-500/2 transition-colors duration-300' />
                <h3
                    className={`text-[9px] sm:text-[10px] uppercase tracking-[0.2em] font-black mb-0.5 sm:mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}
                >
                    Market Price Stream
                </h3>
                <div
                    className={`text-xl sm:text-3xl font-mono font-black tabular-nums transition-all duration-300 flex items-center gap-2 ${
                        animatingPrice
                            ? priceUp
                                ? 'text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.5)]'
                                : priceDown
                                  ? 'text-rose-400 drop-shadow-[0_0_10px_rgba(251,113,113,0.5)]'
                                  : 'text-white'
                            : theme === 'dark'
                              ? 'text-white'
                              : 'text-slate-900'
                    }`}
                >
                    {price?.toFixed(5) || '-----.--'}
                    <div className='flex flex-col text-[10px] leading-none'>
                        {priceUp && <span className='text-emerald-400 animate-bounce'>▲</span>}
                        {priceDown && <span className='text-rose-400 animate-bounce'>▼</span>}
                    </div>
                </div>

                {/* Technical Scanline effect for price */}
                <div className='absolute inset-0 pointer-events-none opacity-[0.03] overflow-hidden'>
                    <div className='w-full h-[2px] bg-white animate-[scanline_4s_linear_infinite]' />
                </div>
            </div>

            {/* Vertical Dividers (Desktop) */}
            <div
                className={`hidden sm:block w-px h-full ${theme === 'dark' ? 'bg-linear-to-b from-transparent via-cyan-500/20 to-transparent' : 'bg-slate-200'}`}
            />

            {/* Digit/Tick Section */}
            <div className='flex flex-row sm:flex-row items-center justify-between sm:justify-start gap-4 sm:px-8 bg-black/10 sm:bg-transparent rounded-xl sm:rounded-none p-2 sm:p-0 z-10'>
                <div className='text-left sm:text-right'>
                    <h3
                        className={`text-[9px] sm:text-[10px] uppercase tracking-[0.2em] font-black mb-0.5 sm:mb-1 ${theme === 'dark' ? 'text-orange-400' : 'text-orange-600'}`}
                    >
                        Terminal Tick
                    </h3>
                    <div className={`text-[10px] font-bold ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                        V.24.4.1
                    </div>
                </div>
                <div
                    className={`text-2xl sm:text-4xl font-black transition-all duration-500 w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center rounded-xl sm:rounded-2xl ${
                        animatingDigit
                            ? 'bg-orange-500/30 text-orange-400 scale-110 shadow-[0_0_25px_rgba(249,115,22,0.4)] border border-orange-500/50'
                            : theme === 'dark'
                              ? 'bg-slate-900/80 text-orange-500 border border-orange-500/20'
                              : 'bg-slate-100 text-orange-600 border border-orange-200'
                    }`}
                >
                    {digit !== null ? digit : '-'}
                </div>
            </div>

            {/* Decorative Corner Accents */}
            <div className='absolute top-0 right-0 w-8 h-8 pointer-events-none'>
                <div className='absolute top-2 right-2 w-1 h-3 bg-cyan-500/20 rounded-full' />
                <div className='absolute top-2 right-2 w-3 h-1 bg-cyan-500/20 rounded-full' />
            </div>
        </div>
    );
}
