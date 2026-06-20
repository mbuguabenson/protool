/**
 * Martingale Calculator - Stake progression and recovery calculations
 */

export interface MartingaleLevel {
    level: number;
    multiplier: number;
    stake: number;
    target: '1.5x' | '2.1x' | '3.1x';
}

export interface MartingaleConfig {
    baseStake: number;
    maxLevels: number;
    riskPercentage: number; // 1-5%
    accountBalance: number;
    levels: MartingaleLevel[];
    totalRiskExposure: number;
}

export interface StakeCalculation {
    baseStake: number;
    nextStake: number;
    level: number;
    riskAmount: number;
    potentialProfit: number;
    maxLossThreshold: number;
    recommendation: string;
}

export class MartingaleCalculator {
    /**
     * Calculate martingale stakes for high-probability trader
     */
    static calculateHighProbabilityStakes(
        accountBalance: number,
        riskPercentage: number = 2,
        baseMarket: 'Over 1,2,3' | 'Under 6,7,8' = 'Over 1,2,3'
    ): MartingaleLevel[] {
        const baseStake = (accountBalance * riskPercentage) / 100;

        const levels: MartingaleLevel[] = [];

        // Over 3, Under 6 = 1.5x multiplier
        levels.push({
            level: 1,
            multiplier: 1,
            stake: baseStake,
            target: '1.5x',
        });

        // Over 2, Under 7 = 2.1x multiplier
        levels.push({
            level: 2,
            multiplier: 1.5,
            stake: Math.round(baseStake * 1.5 * 100) / 100,
            target: '2.1x',
        });

        // Over 1, Under 8 = 3.1x multiplier
        levels.push({
            level: 3,
            multiplier: 3.1,
            stake: Math.round(baseStake * 3.1 * 100) / 100,
            target: '3.1x',
        });

        return levels;
    }

    /**
     * Calculate standard martingale progression (double on loss)
     */
    static calculateStandardMartingale(
        baseStake: number,
        maxLevels: number = 5,
        maxLoss: number = baseStake * 10
    ): MartingaleLevel[] {
        const levels: MartingaleLevel[] = [];
        let currentStake = baseStake;

        for (let i = 1; i <= maxLevels; i++) {
            levels.push({
                level: i,
                multiplier: Math.pow(2, i - 1),
                stake: Math.round(currentStake * 100) / 100,
                target: '1.5x', // Standard 50% profit target
            });

            if (currentStake * 2 > maxLoss) {
                break;
            }

            currentStake *= 2;
        }

        return levels;
    }

    /**
     * Calculate next stake after a loss
     */
    static calculateNextStake(
        lastStake: number,
        lastLoss: number,
        consecutiveLosses: number,
        accountBalance: number,
        maxRiskPercentage: number = 5
    ): StakeCalculation {
        // Recovery calculation
        const amountToRecover = lastLoss;
        const nextMultiplier = 1.5 + consecutiveLosses * 0.2; // Increase multiplier each loss
        let nextStake = (Math.round((amountToRecover * nextMultiplier) / 100) * 100) / 100;

        // Ensure doesn't exceed max risk
        const maxStake = (accountBalance * maxRiskPercentage) / 100;
        nextStake = Math.min(nextStake, maxStake);

        // Calculate max loss threshold
        const maxLossThreshold = accountBalance * 0.1; // Stop if lose 10% of account

        const potentialProfit = nextStake * 0.5; // 50% profit target

        let recommendation = 'CAUTION - Multiple losses. Consider reducing position size.';
        if (consecutiveLosses === 1) {
            recommendation = 'Standard recovery - Double previous loss';
        } else if (consecutiveLosses >= 3) {
            recommendation = 'HIGH RISK - Consider stopping or using conservative stake';
        }

        return {
            baseStake: lastStake,
            nextStake,
            level: consecutiveLosses + 1,
            riskAmount: nextStake,
            potentialProfit,
            maxLossThreshold,
            recommendation,
        };
    }

    /**
     * Check if martingale progression is safe
     */
    static isSafeToContinue(
        nextStake: number,
        accountBalance: number,
        consecutiveLosses: number,
        totalExposure: number
    ): { safe: boolean; reason: string; maxAllowedStake: number } {
        const maxAllowedStake = accountBalance * 0.05; // Max 5% per trade

        if (nextStake > maxAllowedStake) {
            return {
                safe: false,
                reason: `Next stake (${nextStake}) exceeds 5% account risk limit (${maxAllowedStake})`,
                maxAllowedStake,
            };
        }

        if (totalExposure + nextStake > accountBalance * 0.2) {
            return {
                safe: false,
                reason: 'Total exposure would exceed 20% of account balance',
                maxAllowedStake: maxAllowedStake,
            };
        }

        if (consecutiveLosses > 5) {
            return {
                safe: false,
                reason: 'Too many consecutive losses - Stop and reassess strategy',
                maxAllowedStake,
            };
        }

        return {
            safe: true,
            reason: 'Safe to proceed with calculated stake',
            maxAllowedStake,
        };
    }

    /**
     * Calculate auto-stake based on hourly target
     */
    static calculateAutoStake(
        accountBalance: number,
        hourlyTargetProfit: number,
        estimatedWinRate: number = 0.55
    ): { baseStake: number; recommendation: string } {
        // Work backwards from target profit
        // If win rate is 55%, expected profit per trade = stake * (win_rate * 0.5 - loss_rate * 1)
        // Simplified: hourly_target = stake * (0.55 * 0.5 - 0.45 * 1) = stake * (0.275 - 0.45) = negative (loss)
        // More realistic: assume 50% profit on win, 100% loss on loss
        // Expected value = stake * (0.55 * 0.5 - 0.45 * 1) = stake * -0.275 (negative)
        // This is why we need higher win rates or better odds

        // Conservative approach: base stake on percentage of account
        const baseStake = (accountBalance * 1) / 100; // 1% per trade

        const dailyProjection = hourlyTargetProfit * 24;
        const annualizedProjection = dailyProjection * 365;

        let recommendation = 'Realistic projection based on 1% stake per trade';
        if (hourlyTargetProfit > accountBalance * 0.1) {
            recommendation = 'Target very aggressive - Reduce expectations or increase account size';
        } else if (hourlyTargetProfit > accountBalance * 0.05) {
            recommendation = 'Target ambitious - Requires consistent high win rate';
        }

        return {
            baseStake: Math.round(baseStake * 100) / 100,
            recommendation,
        };
    }

    /**
     * Calculate daily trading targets
     */
    static calculateDailyTargets(
        accountBalance: number,
        tradingHours: number = 24,
        dailyTargetPercentage: number = 2
    ): {
        dailyTarget: number;
        hourlyTarget: number;
        tradesPerHour: number;
        stakePerTrade: number;
    } {
        const dailyTarget = (accountBalance * dailyTargetPercentage) / 100;
        const hourlyTarget = dailyTarget / tradingHours;
        const stakePerTrade = (accountBalance * 0.5) / 100; // 0.5% per trade
        const tradesPerHour = Math.max(1, Math.round(hourlyTarget / (stakePerTrade * 0.5)));

        return {
            dailyTarget: Math.round(dailyTarget * 100) / 100,
            hourlyTarget: Math.round(hourlyTarget * 100) / 100,
            tradesPerHour,
            stakePerTrade: Math.round(stakePerTrade * 100) / 100,
        };
    }

    /**
     * Risk of ruin calculation
     */
    static calculateRiskOfRuin(
        accountBalance: number,
        stakePerTrade: number,
        winRate: number = 0.55
    ): { riskPercent: number; assessment: string } {
        // Simplified Kelly Criterion approach
        // Risk of ruin ≈ ((1-p)/p)^(b/s) where p=win_rate, b=bankroll, s=stake
        // This is a rough estimate

        const tradesBeforeBust = Math.log(0.01) / Math.log(1 - (stakePerTrade / accountBalance) * (1 - winRate));
        const riskPercent = Math.min(100, (stakePerTrade / accountBalance) * (1 - winRate) * 100);

        let assessment = 'LOW RISK';
        if (riskPercent > 10) assessment = 'MEDIUM RISK';
        if (riskPercent > 25) assessment = 'HIGH RISK';
        if (riskPercent > 50) assessment = 'EXTREME RISK';

        return {
            riskPercent: Math.round(riskPercent * 100) / 100,
            assessment,
        };
    }
}
