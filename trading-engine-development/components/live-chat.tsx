'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
    MessageCircle,
    X,
    Send,
    User,
    ChevronDown,
    Loader2,
    Paperclip,
    FileText,
    ImageIcon,
    XCircle,
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

interface Reply {
    adminMsg: string;
    ts: number;
}
interface Attachment {
    name: string;
    type: string;
    data: string;
}
interface Msg {
    message: string;
    fromAdmin: boolean;
    ts: number;
    attachments?: Attachment[];
}

const MAX_FILE_SIZE_MB = 5;

function genVisitorId() {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('_dtool_vid') : null;
    if (stored) return stored;
    const id = `visitor_${Math.random().toString(36).slice(2, 10)}`;
    if (typeof window !== 'undefined') localStorage.setItem('_dtool_vid', id);
    return id;
}

function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function AttachmentPreview({ att, onRemove }: { att: Attachment; onRemove?: () => void }) {
    const isImage = att.type.startsWith('image/');
    return (
        <div className='relative group inline-block'>
            {isImage ? (
                <div className='relative'>
                    <img
                        src={att.data}
                        alt={att.name}
                        className='max-h-32 max-w-[200px] rounded-xl object-cover border border-white/10'
                    />
                    {onRemove && (
                        <button
                            onClick={onRemove}
                            className='absolute -top-2 -right-2 text-rose-400 hover:text-rose-300'
                        >
                            <XCircle className='h-4 w-4 bg-[#0a0a0a] rounded-full' />
                        </button>
                    )}
                </div>
            ) : (
                <div className='flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-gray-300 max-w-[200px] relative'>
                    <FileText className='h-4 w-4 text-blue-400 shrink-0' />
                    <span className='truncate'>{att.name}</span>
                    {onRemove && (
                        <button onClick={onRemove} className='text-rose-400 hover:text-rose-300 shrink-0 ml-1'>
                            <XCircle className='h-3.5 w-3.5' />
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

export function LiveChat() {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState<Msg[]>([]);
    const [inputMsg, setInputMsg] = useState('');
    const [name, setName] = useState('');
    const [sending, setSending] = useState(false);
    const [visitorId, setVisitorId] = useState('');
    const [hasNewAdminReply, setHasNewAdminReply] = useState(false);
    const [pendingFiles, setPendingFiles] = useState<Attachment[]>([]);
    const [fileError, setFileError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const lastReplyCount = useRef(0);

    useEffect(() => {
        setName(localStorage.getItem('_dtool_chat_name') || '');
        setVisitorId(genVisitorId());
    }, []);

    // Poll for admin replies every 15 seconds
    useEffect(() => {
        if (!visitorId) return;
        const poll = async () => {
            try {
                const res = await fetch(`/api/chat/message?fromUser=${visitorId}`);
                const data = await res.json();
                if (data.messages?.length) {
                    const allMsgs: Msg[] = [];
                    data.messages.forEach((m: any) => {
                        allMsgs.push({
                            message: m.message,
                            fromAdmin: false,
                            ts: m.ts,
                            attachments: m.attachments || [],
                        });
                        m.replies.forEach((r: Reply) => {
                            allMsgs.push({ message: r.adminMsg, fromAdmin: true, ts: r.ts });
                        });
                    });
                    allMsgs.sort((a, b) => a.ts - b.ts);
                    const replyCount = allMsgs.filter(m => m.fromAdmin).length;
                    if (replyCount > lastReplyCount.current) {
                        setHasNewAdminReply(true);
                        lastReplyCount.current = replyCount;
                    }
                    setMessages(allMsgs);
                }
            } catch {}
        };
        poll();
        const iv = setInterval(poll, 15000);
        return () => clearInterval(iv);
    }, [visitorId]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, open, pendingFiles]);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        setFileError('');
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        const oversized = files.filter(f => f.size > MAX_FILE_SIZE_MB * 1024 * 1024);
        if (oversized.length) {
            setFileError(`${oversized[0].name} exceeds ${MAX_FILE_SIZE_MB}MB limit.`);
            return;
        }
        const encoded = await Promise.all(
            files.map(async f => ({ name: f.name, type: f.type, data: await fileToBase64(f) }))
        );
        setPendingFiles(prev => [...prev, ...encoded].slice(0, 5)); // max 5 files
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const removeFile = (idx: number) => {
        setPendingFiles(prev => prev.filter((_, i) => i !== idx));
    };

    const sendMessage = async () => {
        if ((!inputMsg.trim() && pendingFiles.length === 0) || !visitorId) return;
        setSending(true);
        const n = name || 'Visitor';
        if (name) localStorage.setItem('_dtool_chat_name', name);
        const optimistic: Msg = {
            message: inputMsg,
            fromAdmin: false,
            ts: Math.floor(Date.now() / 1000),
            attachments: pendingFiles,
        };
        setMessages(prev => [...prev, optimistic]);
        const msgText = inputMsg;
        const files = pendingFiles;
        setInputMsg('');
        setPendingFiles([]);
        try {
            await fetch('/api/chat/message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fromUser: visitorId, name: n, message: msgText, attachments: files }),
            });
        } catch {}
        setSending(false);
    };

    return (
        <>
            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type='file'
                multiple
                accept='image/*,.pdf,.doc,.docx,.txt,.xls,.xlsx,.csv'
                className='hidden'
                onChange={handleFileChange}
            />

            <DropdownMenu
                open={open}
                onOpenChange={val => {
                    setOpen(val);
                    if (!val) setHasNewAdminReply(false);
                }}
            >
                <DropdownMenuTrigger asChild>
                    <Button
                        variant='ghost'
                        size='icon'
                        className='relative h-8 w-8 rounded-lg transition-all bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                        title='Live Chat Support'
                    >
                        <MessageCircle className='h-4.5 w-4.5' />
                        {hasNewAdminReply && (
                            <span className='absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full border border-slate-900 animate-pulse' />
                        )}
                    </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                    align='end'
                    sideOffset={8}
                    className='w-80 p-0 rounded-3xl overflow-hidden border border-white/10 bg-[#0a0a0a] shadow-2xl z-[150]'
                >
                    <div onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className='bg-blue-600 px-5 py-4 flex items-center justify-between'>
                            <div className='flex items-center gap-3'>
                                <div className='w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center'>
                                    <MessageCircle className='h-4 w-4 text-white' />
                                </div>
                                <div>
                                    <p className='text-sm font-black text-white'>Live Support</p>
                                    <div className='flex items-center gap-1.5'>
                                        <span className='w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse' />
                                        <p className='text-[10px] text-blue-100'>Admin Online</p>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => setOpen(false)}
                                className='text-blue-200 hover:text-white transition-colors'
                            >
                                <ChevronDown className='h-5 w-5' />
                            </button>
                        </div>

                        {/* Name if empty */}
                        {!messages.length && !name && (
                            <div className='px-5 py-3 bg-blue-500/5 border-b border-white/5'>
                                <input
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder='Your name (optional)...'
                                    className='w-full bg-transparent text-xs text-white placeholder:text-gray-600 focus:outline-none'
                                />
                            </div>
                        )}

                        {/* Messages */}
                        <div className='p-4 space-y-4 overflow-y-auto max-h-64 custom-scrollbar'>
                            {messages.length === 0 ? (
                                <div className='text-center py-8'>
                                    <MessageCircle className='h-8 w-8 text-gray-700 mx-auto mb-2' />
                                    <p className='text-xs text-gray-600'>👋 Hi! How can we help?</p>
                                    <p className='text-[10px] text-gray-700 mt-1'>
                                        Send a message or attach a file. Our team will reply.
                                    </p>
                                </div>
                            ) : (
                                messages.map((msg, i) => (
                                    <div
                                        key={i}
                                        className={`flex ${msg.fromAdmin ? 'justify-start' : 'justify-end'} gap-2`}
                                    >
                                        {msg.fromAdmin && (
                                            <div className='w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center shrink-0 mt-0.5'>
                                                <span className='text-[9px] font-black text-white'>A</span>
                                            </div>
                                        )}
                                        <div
                                            className={`max-w-[80%] space-y-2 ${msg.fromAdmin ? '' : 'items-end flex flex-col'}`}
                                        >
                                            {/* Attachments */}
                                            {msg.attachments?.map((att, j) => (
                                                <AttachmentPreview key={j} att={att} />
                                            ))}
                                            {/* Text */}
                                            {msg.message && (
                                                <div
                                                    className={`rounded-2xl px-3 py-2 text-xs ${
                                                        msg.fromAdmin
                                                            ? 'bg-white/5 border border-white/5 text-gray-200 rounded-tl-none'
                                                            : 'bg-blue-600 text-white rounded-tr-none'
                                                    }`}
                                                >
                                                    {msg.message}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                            <div ref={bottomRef} />
                        </div>

                        {/* Pending file previews */}
                        {pendingFiles.length > 0 && (
                            <div className='px-4 py-2 flex flex-wrap gap-2 border-t border-white/5 max-h-28 overflow-y-auto'>
                                {pendingFiles.map((f, i) => (
                                    <AttachmentPreview key={i} att={f} onRemove={() => removeFile(i)} />
                                ))}
                            </div>
                        )}

                        {/* File error */}
                        {fileError && <p className='px-4 text-[10px] text-rose-400 py-1'>{fileError}</p>}

                        {/* Input Row */}
                        <div className='px-4 py-3 border-t border-white/5 flex gap-2 items-end'>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className='w-9 h-9 shrink-0 bg-white/[0.03] border border-white/10 rounded-xl flex items-center justify-center text-gray-500 hover:text-blue-400 hover:border-blue-500/30 transition-all'
                                title='Attach file'
                            >
                                <Paperclip className='h-4 w-4' />
                            </button>
                            <textarea
                                value={inputMsg}
                                onChange={e => setInputMsg(e.target.value)}
                                placeholder='Type a message...'
                                rows={1}
                                className='flex-1 bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2 text-xs text-white resize-none focus:outline-none focus:border-blue-500/50 placeholder:text-gray-700'
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        sendMessage();
                                    }
                                }}
                            />
                            <button
                                onClick={sendMessage}
                                disabled={sending || (!inputMsg.trim() && pendingFiles.length === 0)}
                                className='w-9 h-9 bg-blue-600 hover:bg-blue-500 rounded-xl flex items-center justify-center shrink-0 transition-all disabled:opacity-40'
                            >
                                {sending ? (
                                    <Loader2 className='h-4 w-4 text-white animate-spin' />
                                ) : (
                                    <Send className='h-4 w-4 text-white' />
                                )}
                            </button>
                        </div>
                    </div>
                </DropdownMenuContent>
            </DropdownMenu>
        </>
    );
}
