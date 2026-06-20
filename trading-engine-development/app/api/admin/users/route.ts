import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const { data: users, error } = await supabaseAdmin
            .from('users')
            .select('*')
            .order('lastSeen', { ascending: false });

        if (error) throw error;
        return NextResponse.json({ users: users || [] });
    } catch (error) {
        console.error('[Admin API] Error fetching users:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
