import { type NextRequest, NextResponse } from 'next/server';
import { getSiteConfig, updateSiteConfig } from '@/lib/user-store';

export async function GET() {
    return NextResponse.json(getSiteConfig());
}

export async function PATCH(request: NextRequest) {
    try {
        const patch = await request.json();
        const updated = updateSiteConfig(patch);
        return NextResponse.json(updated);
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
