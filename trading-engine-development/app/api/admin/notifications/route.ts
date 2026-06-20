import { type NextRequest, NextResponse } from 'next/server';
import { getNotifications, addNotification } from '@/lib/user-store';

export async function GET() {
    return NextResponse.json({ notifications: getNotifications() });
}

export async function POST(request: NextRequest) {
    try {
        const { title, body, type } = await request.json();
        if (!title || !body) {
            return NextResponse.json({ error: 'title and body required' }, { status: 400 });
        }
        const n = addNotification({ title, body, type: type || 'info' });
        return NextResponse.json({ success: true, notification: n });
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
