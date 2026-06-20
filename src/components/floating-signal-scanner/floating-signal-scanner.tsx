import React, { useState, useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import AiScannerCard from '@/components/ai-scanner-card/ai-scanner-card';
import { useDevice } from '@deriv-com/ui';
import './floating-signal-scanner.scss';

const FloatingSignalScanner: React.FC = observer(() => {
    const [isOpen, setIsOpen] = useState(false);
    const { isDesktop } = useDevice();

    // Draggable position state
    const [position, setPosition] = useState({ x: 80, y: 120 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const panelRef = useRef<HTMLDivElement>(null);

    // Default position on load
    useEffect(() => {
        if (isDesktop) {
            // Place it on the bottom left side of the workspace
            setPosition({
                x: 30,
                y: window.innerHeight - 560,
            });
        }
    }, [isDesktop]);

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDesktop) return; // Disable dragging on mobile

        // Only drag from the header, not internal controls/iframe
        const target = e.target as HTMLElement;
        if (!target.closest('.floating-scanner__header') || target.closest('.floating-scanner__close-btn')) {
            return;
        }

        setIsDragging(true);
        dragStart.current = {
            x: e.clientX - position.x,
            y: e.clientY - position.y,
        };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        e.preventDefault();
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDragging) return;

        const newX = e.clientX - dragStart.current.x;
        const newY = e.clientY - dragStart.current.y;

        // Boundaries check to keep panel on screen
        const boundedX = Math.max(10, Math.min(newX, window.innerWidth - 400));
        const boundedY = Math.max(70, Math.min(newY, window.innerHeight - 150));

        setPosition({ x: boundedX, y: boundedY });
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (isDragging) {
            setIsDragging(false);
            (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        }
    };

    return (
        <div className='floating-scanner-container'>
            {/* Pulsing Toggle Button */}
            <button
                className={`floating-scanner-toggle-btn ${isOpen ? 'active' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
                title={isOpen ? 'Close Signal Scanner' : 'AI Signal Scanner'}
            >
                <div className='radar-pulse'></div>
                <div className='radar-pulse-2'></div>
                <svg
                    width='24'
                    height='24'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth='2'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    className='scanner-icon'
                >
                    <path d='M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z' />
                    <path d='M12 6a6 6 0 1 0 6 6 6 6 0 0 0-6-6zm0 10a4 4 0 1 1 4-4 4 4 0 0 1-4 4z' />
                    <circle cx='12' cy='12' r='2' fill='currentColor' />
                    <line x1='12' y1='12' x2='19' y2='12' className='radar-sweep' />
                </svg>
                <span className='toggle-btn-label'>AI Scanner</span>
            </button>

            {/* Floating Panel */}
            {isOpen && (
                <div
                    ref={panelRef}
                    className='floating-scanner__panel'
                    style={isDesktop ? { left: `${position.x}px`, top: `${position.y}px`, width: '600px', height: 'auto' } : {}}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                >
                    {/* Header acts as drag handle */}
                    <div className='floating-scanner__header'>
                        <div className='floating-scanner__title-group'>
                            <span className='status-indicator'></span>
                            <span className='floating-scanner__title'>AI Signal Scanner</span>
                        </div>
                        <button
                            className='floating-scanner__close-btn'
                            onClick={() => setIsOpen(false)}
                            aria-label='Close'
                        >
                            <svg
                                width='16'
                                height='16'
                                viewBox='0 0 24 24'
                                fill='none'
                                stroke='currentColor'
                                strokeWidth='2.5'
                                strokeLinecap='round'
                                strokeLinejoin='round'
                            >
                                <line x1='18' y1='6' x2='6' y2='18'></line>
                                <line x1='6' y1='6' x2='18' y2='18'></line>
                            </svg>
                        </button>
                    </div>

                    {/* Content area: New Ai Scanner Card */}
                    <div className='floating-scanner__body'>
                        <AiScannerCard />
                    </div>
                </div>
            )}
        </div>
    );
});

export default FloatingSignalScanner;
