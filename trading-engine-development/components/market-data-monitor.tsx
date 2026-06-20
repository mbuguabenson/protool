'use client';

import { useState, useEffect } from 'react';
import { marketDataDebugger, type DataFlowEvent } from '@/lib/market-data-debugger';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function MarketDataMonitor({ theme = 'dark' }: { theme?: 'light' | 'dark' }) {
    const [events, setEvents] = useState<DataFlowEvent[]>([]);
    const [isExpanded, setIsExpanded] = useState(false);
    const [stats, setStats] = useState({ success: 0, errors: 0, warnings: 0, total: 0 });

    useEffect(() => {
        // Update initial state
        setEvents(marketDataDebugger.getEvents().slice(-20));
        setStats(marketDataDebugger.getStats());

        // Listen for updates
        const unsubscribe = marketDataDebugger.onUpdate(event => {
            setEvents(prev => [...prev.slice(-19), event]);
            setStats(marketDataDebugger.getStats());
        });

        return unsubscribe;
    }, []);

    if (!isExpanded) {
        return (
            <Button
                variant='ghost'
                onClick={() => setIsExpanded(true)}
                className={`fixed bottom-4 right-4 z-50 ${
                    theme === 'dark'
                        ? 'bg-blue-500/20 hover:bg-blue-500/30 border-blue-500/30 text-blue-400'
                        : 'bg-blue-100 hover:bg-blue-200 border-blue-200 text-blue-700'
                } border`}
            >
                Market Data Monitor ({stats.total})
            </Button>
        );
    }

    const stageColors = {
        websocket_receive: 'bg-green-500/10 border-green-500/30 text-green-400',
        tick_processing: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
        analysis_update: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
        signals_generation: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
        ui_render: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400',
    };

    const statusColors = {
        success: 'bg-green-500 text-white',
        error: 'bg-red-500 text-white',
        warning: 'bg-yellow-500 text-white',
    };

    return (
        <div className={`fixed bottom-4 right-4 z-50 w-96 max-h-[600px] overflow-hidden flex flex-col`}>
            <Card
                className={`${
                    theme === 'dark'
                        ? 'bg-[#0a0e27]/95 border-blue-500/20 shadow-lg shadow-blue-500/20'
                        : 'bg-white/95 border-blue-200'
                } border`}
            >
                <div className='p-3 border-b border-blue-500/20 flex items-center justify-between'>
                    <h3 className={`font-bold text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        Market Data Monitor
                    </h3>
                    <Button variant='ghost' size='sm' onClick={() => setIsExpanded(false)} className='h-6 w-6 p-0'>
                        ×
                    </Button>
                </div>

                {/* Stats Row */}
                <div className='grid grid-cols-4 gap-1 p-2 border-b border-blue-500/20'>
                    <div
                        className={`text-center p-2 rounded ${theme === 'dark' ? 'bg-green-500/10 border border-green-500/30' : 'bg-green-50 border border-green-200'}`}
                    >
                        <div className='text-xs text-green-400 font-bold'>{stats.success}</div>
                        <div className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Success</div>
                    </div>
                    <div
                        className={`text-center p-2 rounded ${theme === 'dark' ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-yellow-50 border border-yellow-200'}`}
                    >
                        <div className='text-xs text-yellow-400 font-bold'>{stats.warnings}</div>
                        <div className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                            Warnings
                        </div>
                    </div>
                    <div
                        className={`text-center p-2 rounded ${theme === 'dark' ? 'bg-red-500/10 border border-red-500/30' : 'bg-red-50 border border-red-200'}`}
                    >
                        <div className='text-xs text-red-400 font-bold'>{stats.errors}</div>
                        <div className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Errors</div>
                    </div>
                    <div
                        className={`text-center p-2 rounded ${theme === 'dark' ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-blue-50 border border-blue-200'}`}
                    >
                        <div className='text-xs text-blue-400 font-bold'>{stats.total}</div>
                        <div className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Total</div>
                    </div>
                </div>

                {/* Events List */}
                <div className='p-2 max-h-96 overflow-y-auto space-y-1'>
                    {events.length === 0 ? (
                        <div
                            className={`text-center py-4 text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}
                        >
                            No events yet...
                        </div>
                    ) : (
                        events.map((event, index) => (
                            <div
                                key={index}
                                className={`text-xs p-2 rounded border ${stageColors[event.stage]} transition-all`}
                            >
                                <div className='flex items-start justify-between gap-1 mb-1'>
                                    <span className='font-semibold capitalize text-xs'>
                                        {event.stage.replace(/_/g, ' ')}
                                    </span>
                                    <Badge className={`text-xs h-5 ${statusColors[event.status]}`}>
                                        {event.status}
                                    </Badge>
                                </div>
                                <div className={`text-xs ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {event.message}
                                </div>
                                {(event.price !== undefined || event.digit !== undefined) && (
                                    <div
                                        className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}
                                    >
                                        {event.symbol}
                                        {event.price !== undefined && ` | Price: ${event.price.toFixed(5)}`}
                                        {event.digit !== undefined && ` | Digit: ${event.digit}`}
                                    </div>
                                )}
                                <div className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                                    {event.timestamp.toLocaleTimeString()}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </Card>
        </div>
    );
}
