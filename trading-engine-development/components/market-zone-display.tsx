'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, AlertTriangle, TrendingUp } from 'lucide-react';
import { MarketZoneDetector, ZoneAnalysis } from '@/lib/market-zone-detector';

interface MarketZoneDisplayProps {
    overPower: number;
    underPower: number;
    volatility: number;
    trending: boolean;
    theme?: 'light' | 'dark';
}

export function MarketZoneDisplay({
    overPower,
    underPower,
    volatility,
    trending,
    theme = 'dark',
}: MarketZoneDisplayProps) {
    const [zoneAnalysis, setZoneAnalysis] = useState<ZoneAnalysis | null>(null);

    useEffect(() => {
        const analysis = MarketZoneDetector.analyzeAllMarkets(overPower, underPower, volatility, trending);
        setZoneAnalysis(analysis);
    }, [overPower, underPower, volatility, trending]);

    if (!zoneAnalysis) return null;

    const getZoneIcon = (type: string) => {
        switch (type) {
            case 'SAFE':
                return <CheckCircle className='w-4 h-4 text-green-400' />;
            case 'CAUTION':
                return <AlertTriangle className='w-4 h-4 text-yellow-400' />;
            default:
                return <AlertCircle className='w-4 h-4 text-red-400' />;
        }
    };

    const safeZones = zoneAnalysis.zones.filter(z => z.type === 'SAFE');
    const cautionZones = zoneAnalysis.zones.filter(z => z.type === 'CAUTION');
    const badZones = zoneAnalysis.zones.filter(z => z.type === 'BAD');

    return (
        <div className='space-y-4'>
            {/* Zone Summary */}
            <div
                className={`rounded-xl p-4 border ${
                    theme === 'dark'
                        ? 'bg-gradient-to-br from-slate-900/50 to-slate-800/50 border-slate-700/50'
                        : 'bg-slate-50 border-slate-200'
                }`}
            >
                <div className='flex items-center justify-between mb-3'>
                    <h3
                        className={`font-bold text-sm uppercase tracking-wider ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                    >
                        Trading Zone Analysis
                    </h3>
                    <Badge
                        className={`${
                            zoneAnalysis.primaryZone === 'SAFE'
                                ? 'bg-green-500/20 text-green-400 border-green-500/40'
                                : zoneAnalysis.primaryZone === 'CAUTION'
                                  ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40'
                                  : 'bg-red-500/20 text-red-400 border-red-500/40'
                        }`}
                    >
                        {zoneAnalysis.primaryZone}
                    </Badge>
                </div>

                <div className='grid grid-cols-3 gap-3 text-center text-xs'>
                    <div>
                        <p className={`font-bold ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>
                            {safeZones.length}
                        </p>
                        <p className={`text-[10px] ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                            Safe Zones
                        </p>
                    </div>
                    <div>
                        <p className={`font-bold ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'}`}>
                            {cautionZones.length}
                        </p>
                        <p className={`text-[10px] ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                            Caution
                        </p>
                    </div>
                    <div>
                        <p className={`font-bold ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>
                            {badZones.length}
                        </p>
                        <p className={`text-[10px] ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                            Bad Zones
                        </p>
                    </div>
                </div>

                {zoneAnalysis.suggestedTrade && (
                    <div
                        className={`mt-3 p-3 rounded-lg border flex items-start gap-2 ${
                            theme === 'dark' ? 'bg-green-500/10 border-green-500/30' : 'bg-green-50 border-green-200'
                        }`}
                    >
                        <TrendingUp
                            className={`w-4 h-4 shrink-0 mt-0.5 ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}
                        />
                        <div>
                            <p
                                className={`text-xs font-bold ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}
                            >
                                Suggestion
                            </p>
                            <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-green-300' : 'text-green-700'}`}>
                                {zoneAnalysis.suggestedTrade}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Zones Grid */}
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                {zoneAnalysis.zones.map((zone, idx) => (
                    <div
                        key={idx}
                        className={`rounded-lg p-3 border transition-all ${
                            zone.type === 'SAFE'
                                ? `${theme === 'dark' ? 'bg-green-500/[0.08] border-green-500/30' : 'bg-green-50 border-green-200'}`
                                : zone.type === 'CAUTION'
                                  ? `${theme === 'dark' ? 'bg-yellow-500/[0.08] border-yellow-500/30' : 'bg-yellow-50 border-yellow-200'}`
                                  : `${theme === 'dark' ? 'bg-red-500/[0.08] border-red-500/30' : 'bg-red-50 border-red-200'}`
                        }`}
                    >
                        <div className='flex items-start justify-between mb-2'>
                            <div className='flex items-center gap-2'>
                                {getZoneIcon(zone.type)}
                                <div>
                                    <p
                                        className={`font-bold text-sm ${
                                            zone.type === 'SAFE'
                                                ? theme === 'dark'
                                                    ? 'text-green-400'
                                                    : 'text-green-600'
                                                : zone.type === 'CAUTION'
                                                  ? theme === 'dark'
                                                      ? 'text-yellow-400'
                                                      : 'text-yellow-600'
                                                  : theme === 'dark'
                                                    ? 'text-red-400'
                                                    : 'text-red-600'
                                        }`}
                                    >
                                        {zone.market}
                                    </p>
                                    <p
                                        className={`text-[10px] ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}
                                    >
                                        {zone.riskLevel} Risk
                                    </p>
                                </div>
                            </div>
                            <div className='text-right'>
                                <p
                                    className={`text-sm font-bold ${
                                        zone.type === 'SAFE'
                                            ? theme === 'dark'
                                                ? 'text-green-400'
                                                : 'text-green-600'
                                            : zone.type === 'CAUTION'
                                              ? theme === 'dark'
                                                  ? 'text-yellow-400'
                                                  : 'text-yellow-600'
                                              : theme === 'dark'
                                                ? 'text-red-400'
                                                : 'text-red-600'
                                    }`}
                                >
                                    {zone.power.toFixed(1)}%
                                </p>
                            </div>
                        </div>

                        <p
                            className={`text-[10px] leading-tight ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}
                        >
                            {zone.recommendation}
                        </p>
                    </div>
                ))}
            </div>

            {/* Best/Worst Market */}
            <div className='grid grid-cols-2 gap-3'>
                <div
                    className={`rounded-lg p-3 border ${theme === 'dark' ? 'bg-green-500/[0.08] border-green-500/30' : 'bg-green-50 border-green-200'}`}
                >
                    <p
                        className={`text-[10px] font-semibold uppercase ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}
                    >
                        Best Market
                    </p>
                    <p className={`text-sm font-bold mt-1 ${theme === 'dark' ? 'text-green-300' : 'text-green-700'}`}>
                        {zoneAnalysis.bestMarket}
                    </p>
                </div>
                <div
                    className={`rounded-lg p-3 border ${theme === 'dark' ? 'bg-red-500/[0.08] border-red-500/30' : 'bg-red-50 border-red-200'}`}
                >
                    <p
                        className={`text-[10px] font-semibold uppercase ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}
                    >
                        Avoid Market
                    </p>
                    <p className={`text-sm font-bold mt-1 ${theme === 'dark' ? 'text-red-300' : 'text-red-700'}`}>
                        {zoneAnalysis.worstMarket}
                    </p>
                </div>
            </div>
        </div>
    );
}
