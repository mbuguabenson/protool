import { type NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const typeFilter = searchParams.get('type');
        const pnlFilter = searchParams.get('pnl');

        // Fetch Users
        const { data: users, error: usersError } = await supabaseAdmin
            .from('users')
            .select('loginId, name, balance, type, status, lastSeen')
            .order('lastSeen', { ascending: false });

        if (usersError) throw usersError;

        // Deduplicate Users by loginId (keeping latest heartbeat only)
        const userMap = new Map<string, any>();
        if (users) {
            users.forEach(u => {
                if (!userMap.has(u.loginId)) {
                    userMap.set(u.loginId, u);
                }
            });
        }
        const allUsers = Array.from(userMap.values());

        // Fetch Trades
        const { data: trades, error: tradesError } = await supabaseAdmin
            .from('trades')
            .select('id, loginId, stake, profitLoss, status, createdAt, market')
            .order('createdAt', { ascending: false })
            .limit(1000);

        if (tradesError) throw tradesError;

        let allTrades = trades || [];

        // Filter trades
        const filteredTrades = allTrades.filter(t => {
            const u = userMap.get(t.loginId);

            if (typeFilter && typeFilter !== 'All') {
                if (u?.type !== typeFilter) return false;
            }
            if (pnlFilter === 'Profits' && (t.profitLoss || 0) <= 0) return false;
            if (pnlFilter === 'Losses' && (t.profitLoss || 0) >= 0) return false;
            return true;
        });

        const now = Math.floor(Date.now() / 1000);

        const totalUsers = allUsers.length;
        const onlineUsers = allUsers.filter(u => u.status === 'online').length;
        const totalRealBalance = allUsers.filter(u => u.type === 'Real').reduce((s, u) => s + (u.balance || 0), 0);
        const totalDemoBalance = allUsers.filter(u => u.type === 'Demo').reduce((s, u) => s + (u.balance || 0), 0);

        const totalTradesCount = filteredTrades.length;
        const netPerformance = filteredTrades.reduce((s, t) => s + (t.profitLoss || 0), 0);
        const totalVolume = filteredTrades.reduce((s, t) => s + (t.stake || 0), 0);

        // Calculate Top Traders
        const traderMap: Record<string, any> = {};
        filteredTrades.forEach(t => {
            if (!traderMap[t.loginId]) {
                const u = userMap.get(t.loginId);
                traderMap[t.loginId] = {
                    loginId: t.loginId,
                    name: u?.name || 'User',
                    type: u?.type || 'Demo',
                    netPnl: 0,
                    wins: 0,
                    total: 0,
                };
            }
            const stats = traderMap[t.loginId];
            stats.netPnl += t.profitLoss || 0;
            stats.total++;
            if ((t.profitLoss || 0) > 0) stats.wins++;
        });

        const topTraders = Object.values(traderMap)
            .sort((a, b) => b.netPnl - a.netPnl)
            .slice(0, 5);

        // Calculate chart data (last 20 trades)
        const chartData = filteredTrades
            .slice(0, 20)
            .reverse()
            .map(t => ({
                ts: t.createdAt,
                profit: t.profitLoss || 0,
                stake: t.stake,
                market: t.market,
                strategy: 'Smart',
            }));

        return NextResponse.json({
            totalUsers,
            onlineUsers,
            totalRealBalance,
            totalDemoBalance,
            totalTrades: totalTradesCount,
            netPerformance,
            totalVolume,
            topTraders,
            chartData,
        });
    } catch (error) {
        console.error('[Admin API] Error fetching overview stats:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
