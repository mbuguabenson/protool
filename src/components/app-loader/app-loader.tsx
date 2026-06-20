import React, { useEffect, useState, useMemo } from 'react';
import { getBrandLabel } from '@/components/shared/utils/brand/brand';
import './app-loader.scss';

interface AppLoaderProps {
    onLoadingComplete: () => void;
    duration?: number;
}

// ── Generate realistic candlestick data ─────────────────────────
function generateCandleData(count: number) {
    const candles: Array<{
        open: number;
        close: number;
        high: number;
        low: number;
        volume: number;
        bull: boolean;
    }> = [];

    let price = 50 + Math.random() * 30;

    for (let i = 0; i < count; i++) {
        const volatility = 1.5 + Math.random() * 4;
        const direction = Math.random() > 0.45 ? 1 : -1;
        const move = direction * volatility;

        const open = price;
        const close = price + move;
        const high = Math.max(open, close) + Math.random() * 2;
        const low = Math.min(open, close) - Math.random() * 2;
        const volume = 10 + Math.random() * 40;
        const bull = close >= open;

        candles.push({ open, close, high, low, volume, bull });
        price = close;
    }

    return candles;
}

// ── Generate EMA path from candles ──────────────────────────────
function generateEmaPath(candles: ReturnType<typeof generateCandleData>, chartHeight: number, chartWidth: number) {
    const prices = candles.map(c => (c.open + c.close) / 2);
    const allPrices = candles.flatMap(c => [c.high, c.low]);
    const minP = Math.min(...allPrices);
    const maxP = Math.max(...allPrices);
    const range = maxP - minP || 1;

    // Simple EMA
    const period = 8;
    const k = 2 / (period + 1);
    const ema: number[] = [prices[0]];
    for (let i = 1; i < prices.length; i++) {
        ema.push(prices[i] * k + ema[i - 1] * (1 - k));
    }

    const points = ema.map((val, i) => {
        const x = (i / (candles.length - 1)) * chartWidth;
        const y = chartHeight - ((val - minP) / range) * chartHeight;
        return `${x},${y}`;
    });

    return `M${points.join(' L')}`;
}

const AppLoader: React.FC<AppLoaderProps> = ({ onLoadingComplete }) => {
    const [isVisible, setIsVisible] = useState(true);
    const [progress, setProgress] = useState(0);
    const brandLabel = getBrandLabel();

    const effectiveDuration = 6000;

    const terminalLogs = useMemo(
        () => [
            'Initializing Protool core modules...',
            'Loading local state engine...',
            'Core services ready.',
            'Connecting to Deriv API gateway...',
            'WebSocket handshake established...',
            'Secure connection verified.',
            'Fetching volatility market symbols...',
            'Subscribing to tick history streams...',
            'Market streams connected.',
            'Mounting Blockly components...',
            'Compiling bot workspace layout...',
            'Blockly engine active.',
            'Loading user settings...',
            'Initializing copy-trading replicator...',
            'PROTOOL is ready. Opening Dashboard...',
        ],
        []
    );

    // Pre-generate chart data once
    const candleData = useMemo(() => generateCandleData(80), []);
    const emaPath = useMemo(() => generateEmaPath(candleData, 400, 1200), [candleData]);

    // Price range for scaling
    const priceRange = useMemo(() => {
        const allPrices = candleData.flatMap(c => [c.high, c.low]);
        return { min: Math.min(...allPrices), max: Math.max(...allPrices) };
    }, [candleData]);

    const priceSpread = priceRange.max - priceRange.min || 1;

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsVisible(false);
            setTimeout(onLoadingComplete, 300);
        }, effectiveDuration);

        return () => clearTimeout(timer);
    }, [onLoadingComplete, effectiveDuration]);

    useEffect(() => {
        if (!isVisible) return;

        const updateInterval = 50;
        const increment = 100 / (effectiveDuration / updateInterval);
        let currentProgress = 0;

        const interval = setInterval(() => {
            currentProgress += increment;
            if (currentProgress >= 100) {
                currentProgress = 100;
                clearInterval(interval);
            }
            setProgress(Math.floor(currentProgress));
        }, updateInterval);

        return () => clearInterval(interval);
    }, [isVisible]);

    const visibleLogs = useMemo(() => {
        const linesToReveal = Math.min(terminalLogs.length, Math.floor((progress / 100) * terminalLogs.length) + 1);
        return terminalLogs.slice(Math.max(0, linesToReveal - 3), linesToReveal);
    }, [progress, terminalLogs]);

    // SVG ring math
    const ringRadius = 62;
    const ringCircumference = 2 * Math.PI * ringRadius;
    const ringOffset = ringCircumference - (progress / 100) * ringCircumference;

    // Glow dot position (angle on ring)
    const angle = ((progress / 100) * 360 - 90) * (Math.PI / 180);
    const dotX = 75 + ringRadius * Math.cos(angle);
    const dotY = 75 + ringRadius * Math.sin(angle);

    // Status text
    const statusText =
        progress < 30 ? 'INITIALIZING' : progress < 70 ? 'CONNECTING' : progress < 95 ? 'LOADING' : 'READY';

    // Price axis labels
    const priceLabels = useMemo(() => {
        const labels: string[] = [];
        for (let i = 0; i < 6; i++) {
            const val = priceRange.max - (i / 5) * priceSpread;
            labels.push(val.toFixed(2));
        }
        return labels;
    }, [priceRange, priceSpread]);

    // Time labels
    const timeLabels = ['09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30'];

    if (!isVisible) return null;

    return (
        <div className='georgetown-loader'>
            {/* ── TradingView Chart Background ── */}
            <div className='tv-chart-bg'>
                <div className='tv-chart-bg__grid' />
                <div className='tv-chart-bg__grid-minor' />

                {/* Candlesticks */}
                <div className='tv-chart-bg__candles'>
                    {candleData.map((candle, i) => {
                        const bodyHeight = Math.max(3, (Math.abs(candle.close - candle.open) / priceSpread) * 250);
                        const wickHeight = ((candle.high - candle.low) / priceSpread) * 250;
                        const bodyBottom = ((Math.min(candle.open, candle.close) - priceRange.min) / priceSpread) * 250;
                        const wickBottom = ((candle.low - priceRange.min) / priceSpread) * 250;

                        return (
                            <div
                                key={i}
                                className={`tv-candle tv-candle--${candle.bull ? 'bull' : 'bear'}`}
                                style={{ height: `${wickHeight + 20}px` }}
                            >
                                <div
                                    className='tv-candle__wick'
                                    style={{
                                        height: `${wickHeight}px`,
                                        bottom: `${wickBottom - ((Math.min(...candleData.map(c => c.low)) - priceRange.min) / priceSpread) * 250}px`,
                                    }}
                                />
                                <div
                                    className='tv-candle__body'
                                    style={{
                                        height: `${bodyHeight}px`,
                                        marginTop: 'auto',
                                        marginBottom: `${bodyBottom - ((Math.min(...candleData.map(c => c.low)) - priceRange.min) / priceSpread) * 250}px`,
                                    }}
                                />
                            </div>
                        );
                    })}
                </div>

                {/* Volume Bars */}
                <div className='tv-chart-bg__volume'>
                    {candleData.map((candle, i) => (
                        <div
                            key={i}
                            className={`tv-volume-bar tv-volume-bar--${candle.bull ? 'bull' : 'bear'}`}
                            style={{ height: `${candle.volume}%` }}
                        />
                    ))}
                </div>

                {/* EMA Line */}
                <div className='tv-chart-bg__ema'>
                    <svg viewBox='0 0 1200 400' preserveAspectRatio='none'>
                        <defs>
                            <linearGradient id='emaGrad' x1='0%' y1='0%' x2='100%' y2='0%'>
                                <stop offset='0%' stopColor='#f59e0b' stopOpacity='0.6' />
                                <stop offset='50%' stopColor='#f59e0b' stopOpacity='0.8' />
                                <stop offset='100%' stopColor='#f59e0b' stopOpacity='0.6' />
                            </linearGradient>
                        </defs>
                        <path d={emaPath} fill='none' stroke='url(#emaGrad)' strokeWidth='2' strokeLinecap='round' />
                    </svg>
                </div>

                {/* Price Axis */}
                <div className='tv-chart-bg__price-axis'>
                    {priceLabels.map((label, i) => (
                        <span key={i} className='tv-price-label'>
                            {label}
                        </span>
                    ))}
                </div>

                {/* Time Axis */}
                <div className='tv-chart-bg__time-axis'>
                    {timeLabels.map((label, i) => (
                        <span key={i} className='tv-time-label'>
                            {label}
                        </span>
                    ))}
                </div>

                {/* Crosshair */}
                <div className='tv-chart-bg__crosshair' />
                <div className='tv-chart-bg__current-price'>{((priceRange.min + priceRange.max) / 2).toFixed(2)}</div>

                {/* Scanning effect */}
                <div className='tv-chart-bg__scanline' />

                {/* Blur overlay on top */}
                <div className='tv-chart-bg__blur-overlay' />
            </div>

            {/* ── Ambient Glow Orbs ── */}
            <div className='ambient-orb ambient-orb--1' />
            <div className='ambient-orb ambient-orb--2' />
            <div className='ambient-orb ambient-orb--3' />

            {/* ── Main Card ── */}
            <div className='smart-loader__wrap'>
                <div className='smart-loader__card'>
                    {/* Brand Header */}
                    <div className='smart-loader__header'>
                        <div className='smart-loader__brand'>
                            <div className='smart-loader__brand-logo'>
                                <svg width='26' height='26' viewBox='0 0 24 24' fill='none'>
                                    <path
                                        d='M12 2L2 7L12 12L22 7L12 2Z'
                                        stroke='#22d3ee'
                                        strokeWidth='2'
                                        strokeLinecap='round'
                                        strokeLinejoin='round'
                                    />
                                    <path
                                        d='M2 17L12 22L22 17'
                                        stroke='#3b82f6'
                                        strokeWidth='2'
                                        strokeLinecap='round'
                                        strokeLinejoin='round'
                                    />
                                    <path
                                        d='M2 12L12 17L22 12'
                                        stroke='#22d3ee'
                                        strokeWidth='2'
                                        strokeLinecap='round'
                                        strokeLinejoin='round'
                                    />
                                </svg>
                            </div>
                            <div className='smart-loader__brand-text'>
                                <div className='smart-loader__brand-title'>PROTOOL</div>
                                <div className='smart-loader__brand-subtitle'>TRADING HUB</div>
                            </div>
                        </div>
                    </div>

                    {/* SVG Progress Ring */}
                    <div className='progress-ring-container'>
                        <svg className='progress-ring-svg' viewBox='0 0 150 150'>
                            <defs>
                                <linearGradient id='progressGradient' x1='0%' y1='0%' x2='100%' y2='100%'>
                                    <stop offset='0%' stopColor='#22d3ee' />
                                    <stop offset='50%' stopColor='#3b82f6' />
                                    <stop offset='100%' stopColor='#8b5cf6' />
                                </linearGradient>
                            </defs>

                            {/* Decorative outer ring */}
                            <circle className='progress-ring__deco-outer' cx='75' cy='75' r='72' />

                            {/* Track */}
                            <circle className='progress-ring__track' cx='75' cy='75' r={ringRadius} />

                            {/* Filled arc */}
                            <circle
                                className='progress-ring__fill'
                                cx='75'
                                cy='75'
                                r={ringRadius}
                                strokeDasharray={ringCircumference}
                                strokeDashoffset={ringOffset}
                            />

                            {/* Decorative inner ring */}
                            <circle className='progress-ring__deco-inner' cx='75' cy='75' r='50' />
                        </svg>

                        {/* Glow dot at progress tip */}
                        {progress > 0 && progress < 100 && (
                            <div
                                className='progress-ring__glow-dot'
                                style={{
                                    left: `${(dotX / 150) * 100}%`,
                                    top: `${(dotY / 150) * 100}%`,
                                    transform: 'translate(-50%, -50%)',
                                }}
                            />
                        )}

                        {/* Center content */}
                        <div className='progress-ring__center'>
                            <span className='progress-ring__percentage'>
                                {progress}
                                <span className='progress-ring__percentage-symbol'>%</span>
                            </span>
                            <span className='progress-ring__status'>{statusText}</span>
                        </div>
                    </div>

                    {/* Terminal Logs */}
                    <div className='smart-loader__terminal'>
                        <div className='terminal-header'>
                            <span className='terminal-dot red' />
                            <span className='terminal-dot yellow' />
                            <span className='terminal-dot green' />
                            <span className='terminal-title'>SYSTEM CONSOLE</span>
                        </div>
                        <div className='terminal-body'>
                            {visibleLogs.map((log, index) => {
                                const isLatest = index === visibleLogs.length - 1;
                                return (
                                    <div
                                        key={log}
                                        className={`terminal-line ${isLatest ? 'terminal-line--latest' : ''}`}
                                    >
                                        <span className='terminal-prompt'>&gt;</span> {log}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Linear Progress Bar */}
                    <div className='progress-wrapper'>
                        <div className='progress-track'>
                            <div className='loading-bar-glow' style={{ width: `${progress}%` }} />
                            <div className='loading-bar-shimmer' />
                        </div>
                        <div className='progress-status-container'>
                            <span className='system-status'>STATUS: {statusText}</span>
                            <span className='progress-counter'>{progress}%</span>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className='smart-loader__footer'>
                        © 2026 {brandLabel}. Powered by Deriv. All rights reserved.
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AppLoader;
