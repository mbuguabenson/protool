import React, { useEffect, useState } from 'react';
import { useStore } from '@/hooks/useStore';
import Header from '@/components/scanner/Header';
import StrategyCards from '@/components/scanner/StrategyCards';
import MarketList from '@/components/scanner/MarketList';
import SignalCard from '@/components/scanner/SignalCard';
import Controls from '@/components/scanner/Controls';
import styles from '@/components/scanner/scanner.module.css';

// Simple draggable/resizable wrapper (using PointerEvent for pointerId)
const Scanner: React.FC = () => {
    const { scanner } = useStore();
    const [isDragging, setIsDragging] = useState(false);
    const [position, setPosition] = useState({ x: 100, y: 100 });

    const handlePointerDown = (e: React.PointerEvent) => {
        setIsDragging(true);
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging) return;
        setPosition(prev => ({ x: prev.x + e.movementX, y: prev.y + e.movementY }));
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        setIsDragging(false);
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    };

    // Placeholder effect to start scanner when component mounts (real logic later)
    useEffect(() => {
        // scanner.start(); // will be implemented in scannerService
    }, []);

    return (
        <div
            className={styles.scannerContainer}
            style={{ top: position.y, left: position.x, width: 800, height: 600 }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
        >
            <Header />
            <StrategyCards />
            <MarketList />
            {scanner.activeSignal && <SignalCard signal={scanner.activeSignal} />}
            <Controls />
        </div>
    );
};

export default Scanner;
