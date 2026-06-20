import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const { data: trades, error } = await supabaseAdmin
            .from('trades')
            .select('id, loginId, stake, status, createdAt')
            .order('createdAt', { ascending: false })
            .limit(50);

        if (error) throw error;

        return NextResponse.json({ trades: trades || [] });
    } catch (error) {
        console.error('[Admin API] Error fetching trades:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
