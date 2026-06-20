import { type NextRequest, NextResponse } from 'next/server';

// This is a simple API route to provide market symbols
// The actual WebSocket connection happens on the client side
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');

    if (action === 'symbols') {
        // Return available Deriv markets
        const symbols: any[] = [];

        return NextResponse.json({ symbols });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
