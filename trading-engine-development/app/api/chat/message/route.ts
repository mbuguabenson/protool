import { type NextRequest, NextResponse } from 'next/server';
import { addChatMessage, getRepliesForUser } from '@/lib/user-store';

// POST — user sends a message (with optional attachments as base64)
export async function POST(request: NextRequest) {
    try {
        const { fromUser, name, message, attachments } = await request.json();
        if (!fromUser || (!message && (!attachments || attachments.length === 0))) {
            return NextResponse.json({ error: 'fromUser and message or attachment required' }, { status: 400 });
        }
        const msg = addChatMessage({
            fromUser,
            name: name || 'Visitor',
            message: message || '',
            attachments: attachments || [],
            ts: Math.floor(Date.now() / 1000),
        });
        return NextResponse.json({ success: true, id: msg.id });
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// GET — user polls for admin replies
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const fromUser = searchParams.get('fromUser');
    if (!fromUser) return NextResponse.json({ error: 'fromUser required' }, { status: 400 });
    const msgs = getRepliesForUser(fromUser);
    return NextResponse.json({ messages: msgs });
}
