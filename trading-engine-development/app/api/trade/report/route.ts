import { type NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const { loginId, strategy, market, profit, stake } = await request.json();
        if (!loginId || !strategy) {
            return NextResponse.json({ error: 'loginId and strategy required' }, { status: 400 });
        }

        const { error } = await supabaseAdmin.from('trades').insert({
            loginId,
            contractType: strategy,
            market: market || 'Unknown',
            profitLoss: Number(profit) || 0,
            stake: Number(stake) || 0,
            createdAt: Math.floor(Date.now() / 1000),
            status: 'closed',
            entryPrice: 0,
            entryTime: 0,
        });

        if (error) {
            console.error('[Trade API] Supabase Insert Error:', error);
            throw error;
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[Trade API] Report error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'daily';
    const now = Math.floor(Date.now() / 1000);

    const periodMap: Record<string, number> = {
        hourly: now - 3600,
        daily: now - 86400,
        weekly: now - 86400 * 7,
        monthly: now - 86400 * 30,
        yearly: now - 86400 * 365,
    };
    const since = periodMap[period] ?? periodMap.daily;

    try {
        const { data: trades, error } = await supabaseAdmin
            .from('trades')
            .select('contractType, profitLoss, status, createdAt')
            .gte('createdAt', since)
            .eq('status', 'closed');

        if (error) throw error;

        const allTrades = trades || [];

        // Group by strategy
        const byStrategy: Record<
            string,
            { wins: number; losses: number; totalProfit: number; totalLoss: number; totalTrades: number }
        > = {};
        allTrades.forEach(t => {
            const s = t.contractType || 'Unknown';
            if (!byStrategy[s]) byStrategy[s] = { wins: 0, losses: 0, totalProfit: 0, totalLoss: 0, totalTrades: 0 };

            byStrategy[s].totalTrades++;
            const profit = t.profitLoss || 0;

            if (profit >= 0) {
                byStrategy[s].wins++;
                byStrategy[s].totalProfit += profit;
            } else {
                byStrategy[s].losses++;
                byStrategy[s].totalLoss += Math.abs(profit);
            }
        });

        const strategies = Object.entries(byStrategy).map(([name, data]) => ({
            name,
            ...data,
            winRate: data.totalTrades > 0 ? ((data.wins / data.totalTrades) * 100).toFixed(1) : '0.0',
            netPnl: (data.totalProfit - data.totalLoss).toFixed(2),
        }));

        return NextResponse.json({ strategies, period, totalTrades: allTrades.length });
    } catch (error) {
        console.error('[Trade API] Get error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
