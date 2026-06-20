import { type NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const { data: trades, error } = await supabaseAdmin
            .from('trades')
            .select('*')
            .order('createdAt', { ascending: false })
            .limit(100);

        if (error) throw error;

        const transactions = (trades || []).map((t: any) => ({
            id: t.id,
            loginId: t.loginId,
            type: (t.profitLoss || 0) >= 0 ? 'Deposit' : 'Withdrawal',
            amount: Math.abs(t.profitLoss || t.stake),
            currency: 'USD',
            method: t.market,
            status: 'Completed',
            strategy: t.contractType || 'Unknown',
            stake: t.stake || 0,
            timestamp: t.createdAt,
        }));
        return NextResponse.json({ transactions });
    } catch (error) {
        console.error('[Admin API] Error fetching transactions:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
