import React, { useState, useEffect, useRef } from 'react';
import {
    AIFloatingScannerEngine,
    type StrategySignal,
    type ConsensuSignal,
    type TickData,
} from '@/lib/ai-floating-scanner';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const AiScannerCard: React.FC = () => {
    const [ticks, setTicks] = useState<TickData[]>([]);
    const [consensus, setConsensus] = useState<ConsensuSignal | null>(null);
    const [lastDigit, setLastDigit] = useState<number | null>(null);
    const [showScanner, setShowScanner] = useState(true);
    const tickCountRef = useRef<number>(0);

    // Generate fake tick data for testing
    useEffect(() => {
        const interval = setInterval(() => {
            const newTick = { digit: Math.floor(Math.random() * 10), timestamp: Date.now() };
            tickCountRef.current++;

            setTicks(prev => [...prev, newTick].slice(-100)); // Keep last 100 ticks
            setLastDigit(newTick.digit);
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    // Update consensus when ticks change
    useEffect(() => {
        if (ticks.length > 0) {
            const newConsensus = AIFloatingScannerEngine.generateConsensus(ticks);
            setConsensus(newConsensus);
        }
    }, [ticks]);

    const renderStrategyCard = (strategy: StrategySignal, index: number) => {
        const signalBadgeColor =
            strategy.signal === 'BUY'
                ? 'bg-green-500 text-white'
                : strategy.signal === 'SELL'
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-300 text-gray-800';

        const strengthColor =
            strategy.strength === 'ELITE'
                ? 'bg-purple-500'
                : strategy.strength === 'STRONG'
                  ? 'bg-blue-500'
                  : 'bg-gray-400';

        return (
            <Card key={index} className='w-full mb-4'>
                <CardHeader>
                    <div className='flex justify-between items-center'>
                        <CardTitle className='text-lg'>{strategy.strategy.replace(/_/g, ' ')}</CardTitle>
                        <div className='flex gap-2'>
                            <Badge className={signalBadgeColor}>{strategy.signal}</Badge>
                            <Badge className={strengthColor}>{strategy.strength}</Badge>
                        </div>
                    </div>
                    <CardDescription>Confidence: {Math.round(strategy.confidence)}%</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className='space-y-3'>
                        {strategy.entryPoint && (
                            <div className='p-3 bg-gray-50 rounded-lg'>
                                <div className='text-sm text-gray-600 mb-1'>Entry Point</div>
                                <div className='font-semibold'>{strategy.entryPoint}</div>
                            </div>
                        )}
                        <div>
                            <div className='text-sm text-gray-600 mb-1'>Market Dominance</div>
                            <div className='text-lg font-bold'>{Math.round(strategy.dominance)}%</div>
                        </div>
                        <div className='text-sm text-gray-700'>{strategy.reasoning}</div>
                        {strategy.skipTicks > 0 && (
                            <div className='text-sm text-yellow-600'>⏸️ Skip next {strategy.skipTicks} ticks</div>
                        )}
                    </div>
                </CardContent>
            </Card>
        );
    };

    return (
        <div className='p-6 max-w-6xl mx-auto'>
            <div className='flex justify-between items-center mb-6'>
                <h1 className='text-3xl font-bold'>AI Scanner</h1>
                <button
                    onClick={() => setShowScanner(!showScanner)}
                    className='px-4 py-2 bg-primary text-white rounded-lg hover:bg-opacity-80 transition'
                >
                    {showScanner ? 'Hide Scanner' : 'Show Scanner'}
                </button>
            </div>

            {showScanner && (
                <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
                    {/* Consensus Card */}
                    {consensus && (
                        <Card className='lg:col-span-3'>
                            <CardHeader>
                                <CardTitle className='text-xl'>📊 Market Consensus</CardTitle>
                                <CardDescription>
                                    {consensus.supportingStrategies} out of {consensus.allStrategies.length} strategies
                                    agree
                                </CardDescription>
                            </CardHeader>
                            <CardContent className='flex items-center justify-between'>
                                <div className='text-center'>
                                    <div className='text-4xl font-bold'>{consensus.overallSignal}</div>
                                    <div className='text-lg text-gray-600'>Overall Signal</div>
                                </div>
                                <div className='text-center'>
                                    <div className='text-3xl font-bold text-blue-600'>
                                        {Math.round(consensus.confidence)}%
                                    </div>
                                    <div className='text-sm text-gray-600'>Confidence</div>
                                </div>
                                <div className='text-center'>
                                    <div className='text-2xl font-bold'>{consensus.marketHeat}</div>
                                    <div className='text-sm text-gray-600'>Market Heat</div>
                                </div>
                                <div className='text-center'>
                                    <div className='text-lg font-semibold text-purple-600'>
                                        {consensus.dominantStrategy.replace(/_/g, ' ')}
                                    </div>
                                    <div className='text-sm text-gray-600'>Dominant Strategy</div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Last Digit Display */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Last Digit</CardTitle>
                        </CardHeader>
                        <CardContent className='text-center'>
                            <div className='text-6xl font-bold text-primary'>{lastDigit ?? '-'}</div>
                        </CardContent>
                    </Card>

                    {/* Strategy Cards */}
                    {consensus?.allStrategies?.map(renderStrategyCard) || []}
                </div>
            )}
        </div>
    );
};

export default AiScannerCard;
