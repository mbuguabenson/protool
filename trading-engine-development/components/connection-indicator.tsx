'use client';

import { motion } from 'framer-motion';

interface ConnectionIndicatorProps {
    status: 'connected' | 'disconnected' | 'reconnecting';
}

export function ConnectionIndicator({ status }: ConnectionIndicatorProps) {
    const statusConfig = {
        connected: {
            color: 'bg-success',
            text: 'Connected',
            pulse: true,
        },
        disconnected: {
            color: 'bg-destructive',
            text: 'Disconnected',
            pulse: false,
        },
        reconnecting: {
            color: 'bg-chart-5',
            text: 'Reconnecting...',
            pulse: true,
        },
    };

    const config = statusConfig[status];

    return (
        <div className='flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-full border border-slate-700/50 backdrop-blur-sm shadow-sm transition-all hover:bg-slate-800/70'>
            <div className='relative flex h-3 w-3'>
                {config.pulse && (
                    <span
                        className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${config.color === 'bg-success' ? 'bg-green-400' : config.color === 'bg-chart-5' ? 'bg-orange-400' : 'bg-red-400'}`}
                    ></span>
                )}
                <span
                    className={`relative inline-flex rounded-full h-3 w-3 ${config.color === 'bg-success' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.6)]' : config.color === 'bg-chart-5' ? 'bg-orange-500' : 'bg-red-500'}`}
                ></span>
            </div>
            <span
                className={`text-xs font-semibold tracking-wide ${config.color === 'bg-success' ? 'text-green-400' : config.color === 'bg-chart-5' ? 'text-orange-400' : 'text-red-400'}`}
            >
                {config.text.toUpperCase()}
            </span>
        </div>
    );
}
