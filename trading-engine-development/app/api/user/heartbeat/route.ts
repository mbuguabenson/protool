import { type NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

async function getGeoFromIP(ip: string): Promise<{ country: string; city: string }> {
    if (
        !ip ||
        ip === 'unknown' ||
        ip === '::1' ||
        ip.startsWith('127.') ||
        ip.startsWith('192.168.') ||
        ip.startsWith('10.')
    ) {
        return { country: 'Local', city: 'Localhost' };
    }
    try {
        const res = await fetch(`https://ip-api.com/json/${ip}?fields=country,city,status`, {
            signal: AbortSignal.timeout(2000),
        });
        const json = await res.json();
        if (json.status === 'success') {
            return { country: json.country || 'Unknown', city: json.city || 'Unknown' };
        }
    } catch {
        // Geo lookup failed silently
    }
    return { country: 'Unknown', city: 'Unknown' };
}

export async function POST(request: NextRequest) {
    try {
        const data = await request.json();
        const { loginId, name, type, currency, balance, status } = data;

        if (!loginId) {
            return NextResponse.json({ error: 'loginId is required' }, { status: 400 });
        }

        const now = Math.floor(Date.now() / 1000);

        if (status === 'offline') {
            await supabaseAdmin.from('users').update({ status: 'offline', lastSeen: now }).eq('loginId', loginId);
        } else {
            const ip =
                request.headers.get('x-real-ip') ||
                request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                request.headers.get('cf-connecting-ip') ||
                'unknown';
            const userAgent = request.headers.get('user-agent') || '';
            const geo = await getGeoFromIP(ip);

            await supabaseAdmin.from('users').upsert(
                {
                    loginId,
                    name: name || 'Deriv User',
                    type: type as 'Real' | 'Demo',
                    currency: currency || 'USD',
                    balance: balance || 0,
                    status: 'online',
                    lastSeen: now,
                    ip,
                    country: geo.country,
                    city: geo.city,
                    userAgent,
                },
                { onConflict: 'loginId' }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[User API] Heartbeat error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
