import { type NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest, context: { params: Promise<{ loginId: string }> }) {
    try {
        const { loginId } = await context.params;
        const { action } = await request.json();

        const validActions = ['none', 'whitelisted', 'blacklisted', 'blocked'];
        if (!validActions.includes(action)) {
            return NextResponse.json(
                { error: 'Invalid action. Use: none, whitelisted, blacklisted, blocked' },
                { status: 400 }
            );
        }

        const { data: user, error: fetchError } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('loginId', loginId)
            .single();

        if (fetchError || !user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const { error: updateError } = await supabaseAdmin
            .from('users')
            .update({ flag: action })
            .eq('loginId', loginId);

        if (updateError) throw updateError;

        return NextResponse.json({ success: true, loginId, flag: action });
    } catch (error) {
        console.error('[Admin API] Error updating user:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function GET(_request: NextRequest, context: { params: Promise<{ loginId: string }> }) {
    try {
        const { loginId } = await context.params;
        const { data: user, error } = await supabaseAdmin.from('users').select('*').eq('loginId', loginId).single();

        if (error || !user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        return NextResponse.json({ user });
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
