/**
 * Market Zone Detector - Identifies safe and bad trading zones
 */

export interface MarketZone {
    type: 'SAFE' | 'CAUTION' | 'BAD';
    market: string;
    power: number;
    recommendation: string;
    color: string;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface ZoneAnalysis {
    primaryZone: 'SAFE' | 'CAUTION' | 'BAD';
    zones: MarketZone[];
    bestMarket: string;
    worstMarket: string;
    overallRisk: 'LOW' | 'MEDIUM' | 'HIGH';
    suggestedTrade?: string;
}

export class MarketZoneDetector {
    /**
     * Detect zones for all common markets
     */
    static analyzeAllMarkets(
        overPower: number,
        underPower: number,
        volatility: number,
        trending: boolean,
        marketsList: string[] = ['Over 5-9', 'Under 0-4', 'Over 0-1', 'Over 2-3', 'Under 6-7', 'Under 8-9']
    ): ZoneAnalysis {
        const zones: MarketZone[] = [];

        // Over (5-9) zone
        zones.push(this.classifyZone('Over 5-9', overPower, volatility, trending, overPower > underPower));

        // Under (0-4) zone
        zones.push(this.classifyZone('Under 0-4', underPower, volatility, trending, underPower > overPower));

        // Sub-markets for high-probability trader
        zones.push(this.classifyZone('Over 0-1', overPower * 0.8, volatility, trending, false));
        zones.push(this.classifyZone('Over 2-3', overPower * 0.85, volatility, trending, false));
        zones.push(this.classifyZone('Under 6-7', underPower * 0.8, volatility, trending, false));
        zones.push(this.classifyZone('Under 8-9', underPower * 0.85, volatility, trending, false));

        // Sort by safety
        zones.sort((a, b) => {
            const typeOrder = { SAFE: 0, CAUTION: 1, BAD: 2 };
            return typeOrder[a.type] - typeOrder[b.type] || b.power - a.power;
        });

        const safeZones = zones.filter(z => z.type === 'SAFE');
        const cautionZones = zones.filter(z => z.type === 'CAUTION');
        const badZones = zones.filter(z => z.type === 'BAD');

        let primaryZone: 'SAFE' | 'CAUTION' | 'BAD' = 'BAD';
        let overallRisk: 'LOW' | 'MEDIUM' | 'HIGH' = 'HIGH';

        if (safeZones.length > 0) {
            primaryZone = 'SAFE';
            overallRisk = 'LOW';
        } else if (cautionZones.length > 0) {
            primaryZone = 'CAUTION';
            overallRisk = 'MEDIUM';
        }

        const bestMarket = zones[0]?.market || 'Unknown';
        const worstMarket = zones[zones.length - 1]?.market || 'Unknown';

        let suggestedTrade = undefined;
        if (safeZones.length > 0) {
            suggestedTrade = `Trade ${safeZones[0].market} with ${overallRisk} risk`;
        }

        return {
            primaryZone,
            zones,
            bestMarket,
            worstMarket,
            overallRisk,
            suggestedTrade,
        };
    }

    /**
     * Classify a single zone
     */
    private static classifyZone(
        market: string,
        power: number,
        volatility: number,
        trending: boolean,
        isDominant: boolean
    ): MarketZone {
        let type: 'SAFE' | 'CAUTION' | 'BAD';
        let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
        let recommendation: string;

        if (power >= 65 && volatility < 5 && trending && isDominant) {
            type = 'SAFE';
            riskLevel = 'LOW';
            recommendation = 'EXCELLENT - Very high probability trade';
        } else if (power >= 58 && volatility < 8 && trending) {
            type = 'SAFE';
            riskLevel = 'LOW';
            recommendation = 'GOOD - Favorable conditions';
        } else if (power >= 55 && volatility < 10) {
            type = 'CAUTION';
            riskLevel = 'MEDIUM';
            recommendation = 'OKAY - Acceptable but watch for reversals';
        } else if (power >= 52 && volatility < 12) {
            type = 'CAUTION';
            riskLevel = 'MEDIUM';
            recommendation = 'RISKY - Market less clear';
        } else {
            type = 'BAD';
            riskLevel = 'HIGH';
            recommendation = 'AVOID - High risk, low probability';
        }

        return {
            type,
            market,
            power: Math.round(power * 10) / 10,
            recommendation,
            color: type === 'SAFE' ? '#10b981' : type === 'CAUTION' ? '#f59e0b' : '#ef4444',
            riskLevel,
        };
    }

    /**
     * Detect if current market is suitable for trading
     */
    static isGoodTradingWindow(
        power: number,
        volatility: number,
        trending: boolean,
        threshold: 'STRICT' | 'MODERATE' | 'LOOSE' = 'MODERATE'
    ): boolean {
        const thresholds = {
            STRICT: { power: 65, volatility: 5, trending: true },
            MODERATE: { power: 55, volatility: 10, trending: true },
            LOOSE: { power: 52, volatility: 15, trending: false },
        };

        const t = thresholds[threshold];

        return power >= t.power && volatility <= t.volatility && (trending === t.trending || threshold === 'LOOSE');
    }

    /**
     * Recommend best market to trade from list
     */
    static recommendBestMarket(markets: MarketZone[]): MarketZone | null {
        const safeMarkets = markets.filter(m => m.type === 'SAFE').sort((a, b) => b.power - a.power);

        if (safeMarkets.length > 0) {
            return safeMarkets[0];
        }

        const cautionMarkets = markets.filter(m => m.type === 'CAUTION').sort((a, b) => b.power - a.power);
        if (cautionMarkets.length > 0) {
            return cautionMarkets[0];
        }

        return null;
    }

    /**
     * Auto-switch market recommendation based on performance
     */
    static recommendAutoSwitch(
        currentMarket: string,
        consecutiveLosses: number,
        availableMarkets: MarketZone[]
    ): { switchTo?: string; reason: string } {
        if (consecutiveLosses < 3) {
            return { reason: 'Continue current market' };
        }

        if (consecutiveLosses >= 5) {
            const bestMarket = this.recommendBestMarket(availableMarkets);
            if (bestMarket && bestMarket.market !== currentMarket) {
                return {
                    switchTo: bestMarket.market,
                    reason: `Consecutive losses detected. Switch to ${bestMarket.market} (${bestMarket.type} zone)`,
                };
            }
        }

        return { reason: 'Wait for market reversal or stabilization' };
    }

    /**
     * Calculate recovery entry conditions
     */
    static calculateRecoveryEntry(
        consecutiveLosses: number,
        lastTicks: number[]
    ): {
        useRecovery: boolean;
        safeEntry: string;
        strategy: string;
        reasoning: string;
    } {
        if (consecutiveLosses < 3) {
            return {
                useRecovery: false,
                safeEntry: '',
                strategy: '',
                reasoning: 'No recovery mode needed',
            };
        }

        // After losses, use most conservative approach: Over 0 or Even
        return {
            useRecovery: true,
            safeEntry: consecutiveLosses >= 5 ? 'Even' : 'Over 0',
            strategy: consecutiveLosses >= 5 ? 'Even/Odd High Probability' : 'Over 0 (Most Likely)',
            reasoning: `${consecutiveLosses} consecutive losses - Using safest high-probability entry point`,
        };
    }
}
