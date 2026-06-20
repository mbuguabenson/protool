import { type NextRequest, NextResponse } from 'next/server';
import { getAllChatMessages, addChatReply, getUnreadChatCount } from '@/lib/user-store';

export async function GET() {
    const messages = getAllChatMessages();
    const unread = getUnreadChatCount();
    return NextResponse.json({ messages, unread });
}

export async function PATCH(request: NextRequest) {
    try {
        const { msgId, adminMsg } = await request.json();
        if (!msgId || !adminMsg) {
            return NextResponse.json({ error: 'msgId and adminMsg required' }, { status: 400 });
        }
        const ok = addChatReply(msgId, adminMsg);
        if (!ok) return NextResponse.json({ error: 'Message not found' }, { status: 404 });
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
