'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    MessageSquare,
    RefreshCw,
    Send,
    User,
    Clock,
    Check,
    CheckCheck,
    Inbox,
    FileText,
    Download,
} from 'lucide-react';

interface Reply {
    adminMsg: string;
    ts: number;
}
interface Attachment {
    name: string;
    type: string;
    data: string;
}
interface ChatMessage {
    id: string;
    fromUser: string;
    name: string;
    message: string;
    ts: number;
    read: boolean;
    attachments: Attachment[];
    replies: Reply[];
}

function timeAgo(ts: number) {
    const diff = Math.floor(Date.now() / 1000) - ts;
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
}

export default function AdminMessagesPage() {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [selected, setSelected] = useState<ChatMessage | null>(null);
    const [reply, setReply] = useState('');
    const [sending, setSending] = useState(false);
    const [unread, setUnread] = useState(0);
    const [loading, setLoading] = useState(true);
    const replyRef = useRef<HTMLTextAreaElement>(null);

    const fetchMessages = useCallback(
        async (silent = false) => {
            if (!silent) setLoading(true);
            try {
                const res = await fetch('/api/admin/messages');
                const data = await res.json();
                setMessages(data.messages || []);
                setUnread(data.unread || 0);
                // Update selected if open
                if (selected) {
                    const fresh = (data.messages || []).find((m: ChatMessage) => m.id === selected.id);
                    if (fresh) setSelected(fresh);
                }
            } catch (err) {
                console.error(err);
            }
            setLoading(false);
        },
        [selected]
    );

    useEffect(() => {
        fetchMessages();
        const iv = setInterval(() => fetchMessages(true), 10000);
        return () => clearInterval(iv);
    }, [fetchMessages]);

    const sendReply = async () => {
        if (!selected || !reply.trim()) return;
        setSending(true);
        try {
            await fetch('/api/admin/messages', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ msgId: selected.id, adminMsg: reply }),
            });
            setReply('');
            fetchMessages(true);
        } catch (err) {
            console.error(err);
        }
        setSending(false);
    };

    return (
        <div className='animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20 h-[calc(100vh-120px)] flex flex-col space-y-6'>
            <div className='flex items-center justify-between'>
                <div>
                    <h2 className='text-3xl font-black text-white tracking-tight flex items-center gap-3'>
                        Messages
                        {unread > 0 && (
                            <span className='inline-flex items-center justify-center w-7 h-7 bg-blue-500 text-white text-xs font-black rounded-full'>
                                {unread}
                            </span>
                        )}
                    </h2>
                    <p className='text-sm text-gray-500 mt-1'>
                        Live chat messages from platform users. Auto-refreshes every 10s.
                    </p>
                </div>
                <button
                    onClick={() => fetchMessages(true)}
                    className='flex items-center gap-2 px-4 py-2 text-xs font-bold bg-white/5 border border-white/10 rounded-xl text-gray-400 hover:bg-white/10'
                >
                    <RefreshCw className='h-3 w-3' /> Refresh
                </button>
            </div>

            <div className='flex gap-6 flex-1 overflow-hidden'>
                {/* Message List */}
                <div className='w-80 shrink-0 bg-[#0a0a0a] border border-white/5 rounded-3xl overflow-hidden flex flex-col'>
                    <div className='px-5 py-4 border-b border-white/5'>
                        <p className='text-[10px] font-bold text-gray-500 uppercase tracking-widest'>
                            {messages.length} conversations
                        </p>
                    </div>
                    <div className='overflow-y-auto flex-1 custom-scrollbar'>
                        {loading ? (
                            <div className='flex items-center justify-center h-32'>
                                <div className='w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin' />
                            </div>
                        ) : messages.length === 0 ? (
                            <div className='flex flex-col items-center justify-center h-40 text-center px-4'>
                                <Inbox className='h-8 w-8 text-gray-700 mb-2' />
                                <p className='text-sm text-gray-600'>No messages yet</p>
                            </div>
                        ) : (
                            messages.map(msg => (
                                <button
                                    key={msg.id}
                                    onClick={() => setSelected(msg)}
                                    className={`w-full text-left px-5 py-4 border-b border-white/[0.03] transition-all ${selected?.id === msg.id ? 'bg-blue-600/10 border-l-2 border-l-blue-500' : 'hover:bg-white/[0.02]'}`}
                                >
                                    <div className='flex items-start justify-between gap-2'>
                                        <div className='flex items-center gap-2 min-w-0'>
                                            <div className='w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0'>
                                                <User className='h-4 w-4 text-blue-400' />
                                            </div>
                                            <div className='min-w-0'>
                                                <p className='text-xs font-bold text-white truncate'>{msg.name}</p>
                                                <p className='text-[10px] font-mono text-gray-500 truncate'>
                                                    {msg.fromUser}
                                                </p>
                                            </div>
                                        </div>
                                        <div className='flex flex-col items-end shrink-0'>
                                            <span className='text-[9px] text-gray-600'>{timeAgo(msg.ts)}</span>
                                            {!msg.read && <span className='w-2 h-2 bg-blue-500 rounded-full mt-1' />}
                                        </div>
                                    </div>
                                    <p className='text-xs text-gray-500 mt-2 truncate pl-10'>{msg.message}</p>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Chat Thread */}
                {selected ? (
                    <div className='flex-1 bg-[#0a0a0a] border border-white/5 rounded-3xl flex flex-col overflow-hidden'>
                        <div className='px-6 py-4 border-b border-white/5 flex items-center gap-3'>
                            <div className='w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center'>
                                <User className='h-5 w-5 text-blue-400' />
                            </div>
                            <div>
                                <p className='text-sm font-bold text-white'>{selected.name}</p>
                                <p className='text-[10px] font-mono text-gray-500'>{selected.fromUser}</p>
                            </div>
                        </div>
                        <div className='flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar'>
                            {/* User message + attachments */}
                            <div className='flex gap-3'>
                                <div className='w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5'>
                                    <User className='h-4 w-4 text-blue-400' />
                                </div>
                                <div className='space-y-2 max-w-sm'>
                                    {/* Attachments */}
                                    {selected.attachments?.map((att, j) =>
                                        att.type.startsWith('image/') ? (
                                            <img
                                                key={j}
                                                src={att.data}
                                                alt={att.name}
                                                className='max-h-48 rounded-2xl rounded-tl-none border border-white/10 object-cover cursor-pointer hover:opacity-90'
                                                onClick={() => window.open(att.data, '_blank')}
                                            />
                                        ) : (
                                            <a
                                                key={j}
                                                href={att.data}
                                                download={att.name}
                                                className='flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl rounded-tl-none px-4 py-3 text-xs text-gray-300 hover:bg-white/10 transition-all group'
                                            >
                                                <FileText className='h-4 w-4 text-blue-400 shrink-0' />
                                                <span className='flex-1 truncate'>{att.name}</span>
                                                <Download className='h-3.5 w-3.5 text-gray-500 group-hover:text-blue-400 transition-colors' />
                                            </a>
                                        )
                                    )}
                                    {/* Text */}
                                    {selected.message && (
                                        <div className='bg-white/5 border border-white/5 rounded-2xl rounded-tl-none px-4 py-3'>
                                            <p className='text-sm text-gray-200'>{selected.message}</p>
                                        </div>
                                    )}
                                    <p className='text-[9px] text-gray-600 ml-1'>{timeAgo(selected.ts)}</p>
                                </div>
                            </div>
                            {/* Admin replies */}
                            {selected.replies.map((r, i) => (
                                <div key={i} className='flex gap-3 flex-row-reverse'>
                                    <div className='w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shrink-0 mt-0.5'>
                                        <span className='text-xs font-black text-white'>A</span>
                                    </div>
                                    <div className='flex flex-col items-end'>
                                        <div className='bg-blue-600 rounded-2xl rounded-tr-none px-4 py-3 max-w-sm'>
                                            <p className='text-sm text-white'>{r.adminMsg}</p>
                                        </div>
                                        <p className='text-[9px] text-gray-600 mt-1 mr-1 flex items-center gap-1'>
                                            <CheckCheck className='h-3 w-3 text-blue-400' /> {timeAgo(r.ts)}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className='p-4 border-t border-white/5 flex gap-3'>
                            <textarea
                                ref={replyRef}
                                value={reply}
                                onChange={e => setReply(e.target.value)}
                                placeholder='Type a reply...'
                                rows={2}
                                className='flex-1 bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-3 text-sm text-white resize-none focus:outline-none focus:border-blue-500/50 placeholder:text-gray-700'
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        sendReply();
                                    }
                                }}
                            />
                            <button
                                onClick={sendReply}
                                disabled={sending || !reply.trim()}
                                className='px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold flex items-center gap-2 transition-all disabled:opacity-40'
                            >
                                <Send className='h-4 w-4' />
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className='flex-1 bg-[#0a0a0a] border border-white/5 border-dashed rounded-3xl flex flex-col items-center justify-center text-center'>
                        <MessageSquare className='h-12 w-12 text-gray-700 mb-4' />
                        <p className='text-gray-500 font-bold'>Select a conversation</p>
                        <p className='text-gray-700 text-sm mt-1'>Choose a user message from the left to reply</p>
                    </div>
                )}
            </div>
        </div>
    );
}
