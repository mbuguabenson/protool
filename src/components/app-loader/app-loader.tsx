import React, { useEffect, useState, useMemo } from 'react';
import { getBrandLabel } from '@/components/shared/utils/brand/brand';
import './app-loader.scss';

interface AppLoaderProps {
    onLoadingComplete: () => void;
    duration?: number;
}

// Removed CSS candle generation in favor of a static blurred TradingView image.

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

    // Price range simulation removed.

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

    // Axis labels removed as we use image now.

    if (!isVisible) return null;

    return (
        <div className='georgetown-loader'>
            {/* ── TradingView Chart Background ── */}
            <div className='tv-chart-bg'>
                <img src="/assets/tv_chart_bg.png" alt="Trading View Background" className="tv-chart-bg__image" />
                <div className='tv-chart-bg__blur-overlay' />
                <div className='tv-chart-bg__scanline' />
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
