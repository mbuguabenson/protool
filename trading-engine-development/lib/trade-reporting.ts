/**
 * Utility to report trade results to the server-side store
 * for the admin dashboard and analytics.
 */

export interface TradeReportData {
    loginId?: string;
    strategy: string;
    market: string;
    profit: number;
    stake: number;
}

export async function reportTrade(data: TradeReportData) {
    try {
        // Fallback loginId if not provided (should be handled by hooks)
        const loginId = data.loginId || localStorage.getItem('deriv_login_id') || 'Unknown';

        const response = await fetch('/api/trade/report', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ...data,
                loginId,
            }),
        });

        if (!response.ok) {
            console.error('[Trade Reporting] Failed to report trade:', await response.text());
        }
    } catch (error) {
        console.error('[Trade Reporting] Error reporting trade:', error);
    }
}
