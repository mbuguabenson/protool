'use client';

import { useEffect, useRef } from 'react';

export interface CandleData {
    open: number;
    high: number;
    low: number;
    close: number;
    timestamp: number;
}

export interface PricePoint {
    price: number;
    timestamp: number;
    digit: number;
}

export interface SupportResistance {
    level: number;
    type: 'support' | 'resistance';
    strength: number;
}

export interface EntryExit {
    price: number;
    type: 'entry' | 'exit';
    direction: 'buy' | 'sell' | 'neutral';
    timestamp: number;
}

export interface IndicatorData {
    name: string;
    color: string;
    values: (number | null)[];
    position?: 'overlay' | 'bottom';
    drawType?: 'line' | 'histogram';
}

interface PatternChartProps {
    priceHistory: PricePoint[];
    candleHistory?: CandleData[];
    supportResistance: SupportResistance[];
    entryExitPoints: EntryExit[];
    indicators?: IndicatorData[];
    patterns: Array<{
        type: string;
        indices: number[];
        direction: 'Bullish' | 'Bearish';
    }>;
    theme?: 'light' | 'dark';
    chartType?: 'line' | 'candle';
}

export function PatternChart({
    priceHistory,
    candleHistory = [],
    supportResistance,
    entryExitPoints,
    indicators = [],
    patterns,
    theme = 'dark',
    chartType = 'line',
}: PatternChartProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (
            !canvas ||
            (chartType === 'line' && priceHistory.length === 0) ||
            (chartType === 'candle' && candleHistory.length === 0)
        )
            return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas size
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        const width = rect.width;
        const height = rect.height;

        // Define areas
        const bottomIndicators = indicators.filter(ind => ind.position === 'bottom');
        const hasBottomPane = bottomIndicators.length > 0;
        const bottomPaneHeight = hasBottomPane ? 100 : 0;
        const mainHeight = height - bottomPaneHeight;

        const padding = { top: 30, right: 70, bottom: 40, left: 70 };
        const mainContentHeight = mainHeight - padding.top - padding.bottom;

        // Clear canvas
        ctx.fillStyle = theme === 'dark' ? '#0a0e27' : '#ffffff';
        ctx.fillRect(0, 0, width, height);

        const historyLength = chartType === 'candle' ? candleHistory.length : priceHistory.length;
        if (historyLength < 2) return;

        // --- MAIN CHART SCALE ---
        let minPrice: number, maxPrice: number;
        if (chartType === 'candle') {
            minPrice = Math.min(...candleHistory.map(c => c.low));
            maxPrice = Math.max(...candleHistory.map(c => c.high));
        } else {
            minPrice = Math.min(...priceHistory.map(p => p.price));
            maxPrice = Math.max(...priceHistory.map(p => p.price));
        }

        // Include overlay indicators in range calculation
        indicators
            .filter(i => i.position !== 'bottom')
            .forEach(ind => {
                ind.values.forEach(v => {
                    if (v !== null) {
                        minPrice = Math.min(minPrice, v);
                        maxPrice = Math.max(maxPrice, v);
                    }
                });
            });

        // Include SR levels in range calculation
        supportResistance.forEach(sr => {
            minPrice = Math.min(minPrice, sr.level);
            maxPrice = Math.max(maxPrice, sr.level);
        });

        const margin = (maxPrice - minPrice) * 0.1 || 0.0001;
        minPrice -= margin;
        maxPrice += margin;

        // Scaling Helpers
        const xScale = (index: number) =>
            padding.left + (index / (historyLength - 1)) * (width - padding.left - padding.right);
        const yScale = (price: number) =>
            mainHeight - padding.bottom - ((price - minPrice) / (maxPrice - minPrice)) * mainContentHeight;

        // Draw grid for main chart
        ctx.strokeStyle = theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 5; i++) {
            const y = padding.top + (i / 5) * mainContentHeight;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(width - padding.right, y);
            ctx.stroke();
        }

        // Draw support and resistance zones
        supportResistance.forEach(sr => {
            const y = yScale(sr.level);
            const alpha = sr.strength / 100;
            ctx.fillStyle =
                sr.type === 'support' ? `rgba(34, 197, 94, ${alpha * 0.1})` : `rgba(239, 68, 68, ${alpha * 0.1})`;
            ctx.fillRect(padding.left, y - 4, width - padding.left - padding.right, 8);
            ctx.strokeStyle =
                sr.type === 'support' ? `rgba(34, 197, 94, ${alpha * 0.8})` : `rgba(239, 68, 68, ${alpha * 0.8})`;
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(width - padding.right, y);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.fillStyle = sr.type === 'support' ? '#22c55e' : '#ef4444';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(
                `${sr.type === 'support' ? 'SUP' : 'RES'} ${sr.level.toFixed(5)}`,
                width - padding.right + 5,
                y + 3
            );
        });

        if (chartType === 'candle') {
            const candleWidth = Math.max(2, ((width - padding.left - padding.right) / historyLength) * 0.7);
            candleHistory.forEach((candle, i) => {
                const x = xScale(i);
                const yOpen = yScale(candle.open);
                const yClose = yScale(candle.close);
                const yHigh = yScale(candle.high);
                const yLow = yScale(candle.low);
                const isBullish = candle.close >= candle.open;
                ctx.strokeStyle = isBullish ? '#22c55e' : '#ef4444';
                ctx.fillStyle = isBullish ? '#22c55e' : '#ef4444';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(x, yHigh);
                ctx.lineTo(x, yLow);
                ctx.stroke();
                const bodyY = Math.min(yOpen, yClose);
                const bodyHeight = Math.abs(yOpen - yClose) || 1;
                ctx.fillRect(x - candleWidth / 2, bodyY, candleWidth, bodyHeight);
            });
        } else {
            ctx.strokeStyle = theme === 'dark' ? '#60a5fa' : '#3b82f6';
            ctx.lineWidth = 2;
            ctx.beginPath();
            priceHistory.forEach((p, i) => {
                i === 0 ? ctx.moveTo(xScale(i), yScale(p.price)) : ctx.lineTo(xScale(i), yScale(p.price));
            });
            ctx.stroke();
            const grad = ctx.createLinearGradient(0, padding.top, 0, mainHeight - padding.bottom);
            grad.addColorStop(0, theme === 'dark' ? 'rgba(96, 165, 250, 0.15)' : 'rgba(59, 130, 246, 0.15)');
            grad.addColorStop(1, 'transparent');
            ctx.lineTo(xScale(priceHistory.length - 1), mainHeight - padding.bottom);
            ctx.lineTo(xScale(0), mainHeight - padding.bottom);
            ctx.fillStyle = grad;
            ctx.fill();
        }

        // Overlay Indicators
        indicators
            .filter(i => i.position !== 'bottom')
            .forEach(ind => {
                ctx.strokeStyle = ind.color;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                let s = false;
                ind.values.forEach((v, i) => {
                    if (v !== null) {
                        const x = xScale(i);
                        const y = yScale(v);
                        if (!s) {
                            ctx.moveTo(x, y);
                            s = true;
                        } else ctx.lineTo(x, y);
                    }
                });
                ctx.stroke();
            });

        // --- BOTTOM OSCILLATOR PANE ---
        if (hasBottomPane) {
            const paneY = mainHeight;
            const paneContentHeight = bottomPaneHeight - 20;

            // Pane Background & Grid
            ctx.fillStyle = theme === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)';
            ctx.fillRect(padding.left, paneY, width - padding.left - padding.right, bottomPaneHeight);
            ctx.strokeStyle = theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
            ctx.strokeRect(padding.left, paneY, width - padding.left - padding.right, bottomPaneHeight);

            // Scale for bottom indicators
            const allVals = bottomIndicators.flatMap(i => i.values).filter(v => v !== null) as number[];
            let minOsc = Math.min(...allVals),
                maxOsc = Math.max(...allVals);
            if (minOsc === maxOsc) {
                minOsc -= 1;
                maxOsc += 1;
            }
            const oscRange = maxOsc - minOsc;

            const yOsc = (val: number) =>
                paneY + paneContentHeight - ((val - minOsc) / oscRange) * (paneContentHeight - 10);
            const yZero = yOsc(0);

            // Draw Zero Line
            ctx.setLineDash([2, 4]);
            ctx.strokeStyle = 'rgba(156, 163, 175, 0.5)';
            ctx.beginPath();
            ctx.moveTo(padding.left, yZero);
            ctx.lineTo(width - padding.right, yZero);
            ctx.stroke();
            ctx.setLineDash([]);

            bottomIndicators.forEach(ind => {
                if (ind.drawType === 'histogram') {
                    const barWidth = Math.max(1, ((width - padding.left - padding.right) / historyLength) * 0.6);
                    ind.values.forEach((v, i) => {
                        if (v !== null) {
                            const x = xScale(i);
                            const y = yOsc(v);
                            ctx.fillStyle = v >= 0 ? 'rgba(34, 197, 94, 0.6)' : 'rgba(239, 68, 68, 0.6)';
                            ctx.fillRect(x - barWidth / 2, Math.min(y, yZero), barWidth, Math.abs(y - yZero));
                        }
                    });
                } else {
                    ctx.strokeStyle = ind.color;
                    ctx.lineWidth = 1.2;
                    ctx.beginPath();
                    let s = false;
                    ind.values.forEach((v, i) => {
                        if (v !== null) {
                            const x = xScale(i);
                            const y = yOsc(v);
                            if (!s) {
                                ctx.moveTo(x, y);
                                s = true;
                            } else ctx.lineTo(x, y);
                        }
                    });
                    ctx.stroke();
                }
            });

            // Oscillator Labels
            ctx.fillStyle = '#9ca3af';
            ctx.font = '9px monospace';
            ctx.textAlign = 'right';
            ctx.fillText(maxOsc.toFixed(2), padding.left - 8, paneY + 10);
            ctx.fillText(minOsc.toFixed(2), padding.left - 8, paneY + paneContentHeight);
        }

        // Patterns & Entries (re-use main chart helpers)
        patterns.forEach(p => {
            ctx.strokeStyle = p.direction === 'Bullish' ? '#22c55e' : '#ef4444';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            p.indices.forEach((idx, i) => {
                if (idx >= historyLength) return;
                const val = chartType === 'candle' ? candleHistory[idx].close : priceHistory[idx].price;
                i === 0 ? ctx.moveTo(xScale(idx), yScale(val)) : ctx.lineTo(xScale(idx), yScale(val));
            });
            ctx.stroke();
            const lastIdx = p.indices[p.indices.length - 1];
            if (lastIdx < historyLength) {
                const val = chartType === 'candle' ? candleHistory[lastIdx].close : priceHistory[lastIdx].price;
                ctx.fillStyle = p.direction === 'Bullish' ? '#22c55e' : '#ef4444';
                ctx.font = 'bold 10px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(p.type, xScale(lastIdx), yScale(val) - 15);
            }
        });

        entryExitPoints.forEach(pt => {
            const h = chartType === 'candle' ? candleHistory : priceHistory;
            const idx = h.findIndex(pt2 => pt2.timestamp >= pt.timestamp);
            if (idx === -1) return;
            const x = xScale(idx);
            const y = yScale(pt.price);
            if (pt.type === 'entry') {
                ctx.fillStyle = pt.direction === 'buy' ? '#22c55e' : pt.direction === 'sell' ? '#ef4444' : '#9ca3af';
                ctx.beginPath();
                pt.direction === 'buy'
                    ? (ctx.moveTo(x, y + 12), ctx.lineTo(x - 6, y + 2), ctx.lineTo(x + 6, y + 2))
                    : (ctx.moveTo(x, y - 12), ctx.lineTo(x - 6, y - 2), ctx.lineTo(x + 6, y - 2));
                ctx.fill();
            } else {
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(x, y, 5, 0, 2 * Math.PI);
                ctx.stroke();
            }
        });

        // Labels and axes logic (price)
        ctx.fillStyle = theme === 'dark' ? '#9ca3af' : '#6b7280';
        ctx.font = '10px monospace';
        ctx.textAlign = 'right';
        for (let i = 0; i <= 8; i++) {
            const p = minPrice + (maxPrice - minPrice) * (i / 8);
            ctx.fillText(p.toFixed(5), padding.left - 8, yScale(p) + 4);
        }

        // X axis (Time)
        ctx.textAlign = 'center';
        const tStep = Math.floor(historyLength / 4);
        for (let i = 0; i < historyLength; i += tStep) {
            if (i >= historyLength) break;
            const date = new Date(
                (chartType === 'candle' ? candleHistory[i].timestamp : priceHistory[i].timestamp) * 1000
            );
            ctx.fillText(
                date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                xScale(i),
                height - 10
            );
        }
    }, [priceHistory, candleHistory, supportResistance, entryExitPoints, indicators, patterns, theme, chartType]);

    return (
        <div className='relative w-full h-full min-h-[500px]'>
            <canvas ref={canvasRef} className='w-full h-full rounded-lg' />
        </div>
    );
}
