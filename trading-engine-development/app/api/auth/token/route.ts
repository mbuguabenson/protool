import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { code, code_verifier, redirect_uri, client_id } = body;

        if (!code || !code_verifier || !client_id) {
            return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        console.log('[v0] 🔑 Exchanging authorization code for tokens...');

        const response = await fetch('https://auth.deriv.com/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                client_id,
                code,
                code_verifier,
                redirect_uri,
            }).toString(),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('[v0] ❌ Token exchange failed:', data);
            return NextResponse.json(data, { status: response.status });
        }

        console.log('[v0] ✅ Token exchange successful');
        return NextResponse.json(data);
    } catch (error) {
        console.error('[v0] ❌ Token exchange error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
