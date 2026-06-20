'use client';

import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface RiskDisclaimerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAccept: () => void;
    theme?: 'light' | 'dark';
}

export function RiskDisclaimerModal({ isOpen, onClose, onAccept, theme = 'dark' }: RiskDisclaimerModalProps) {
    return (
        <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
            <DialogContent
                className={`sm:max-w-[500px] w-[95vw] max-h-[90vh] border-none p-0 overflow-hidden rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] ${
                    theme === 'dark' ? 'bg-[#0a0f1e] text-white' : 'bg-white text-slate-900'
                }`}
            >
                <div className='relative p-5 sm:p-8 overflow-y-auto max-h-[90vh]'>
                    {/* Background Glow */}
                    <div className='absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-amber-500/10 blur-[80px] rounded-full pointer-events-none' />

                    <DialogHeader className='relative z-10 flex flex-col items-center text-center space-y-4'>
                        <div
                            className={`w-12 h-12 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center shadow-lg ${
                                theme === 'dark'
                                    ? 'bg-amber-500/10 border border-amber-500/20 text-amber-500'
                                    : 'bg-amber-50 border border-amber-200 text-amber-600'
                            }`}
                        >
                            <AlertTriangle className='h-6 w-6 sm:h-8 sm:w-8' />
                        </div>
                        <DialogTitle className='text-xl sm:text-2xl font-bold tracking-tight'>
                            Important Risk Disclosure
                        </DialogTitle>
                    </DialogHeader>

                    <div
                        className={`mt-6 space-y-4 relative z-10 text-xs sm:text-sm leading-relaxed ${
                            theme === 'dark' ? 'text-slate-300' : 'text-slate-600'
                        }`}
                    >
                        <p className='font-medium text-amber-500 uppercase tracking-widest text-[9px] sm:text-[10px]'>
                            Please read carefully
                        </p>

                        <p className='bg-white/5 p-3 sm:p-4 rounded-2xl border border-white/5 backdrop-blur-sm'>
                            Deriv offers complex derivatives, such as options and contracts for difference ("CFDs").
                            These products may not be suitable for all clients, and trading them puts you at risk.
                        </p>

                        <div className='space-y-3'>
                            <p className='font-medium'>
                                Please understand the following risks before trading Deriv products:
                            </p>
                            <ul className='space-y-3'>
                                <li className='flex gap-3'>
                                    <span className='flex-shrink-0 w-5 h-5 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center text-[10px] font-bold'>
                                        A
                                    </span>
                                    <span>You may lose some or all of the money you invest in the trade.</span>
                                </li>
                                <li className='flex gap-3'>
                                    <span className='flex-shrink-0 w-5 h-5 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center text-[10px] font-bold'>
                                        B
                                    </span>
                                    <span>
                                        If your trade involves currency conversion, exchange rates will affect your
                                        profit and loss.
                                    </span>
                                </li>
                            </ul>
                        </div>

                        <p
                            className={`p-3 sm:p-4 rounded-2xl font-bold border ${
                                theme === 'dark'
                                    ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                                    : 'bg-rose-50 border-rose-100 text-rose-600'
                            }`}
                        >
                            You should never trade with borrowed money or with money that you cannot afford to lose.
                        </p>
                    </div>

                    <DialogFooter className='mt-8 flex flex-col sm:flex-row gap-3 relative z-10'>
                        <Button
                            onClick={onAccept}
                            className={`w-full h-12 sm:h-14 rounded-2xl text-sm sm:text-base font-bold transition-all duration-300 flex items-center justify-center gap-2 group ${
                                theme === 'dark'
                                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)]'
                                    : 'bg-slate-900 hover:bg-slate-800 text-white shadow-lg'
                            }`}
                        >
                            <ShieldCheck className='h-4 w-4 sm:h-5 sm:w-5 transition-transform group-hover:scale-110' />
                            I Understand & Accept
                        </Button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    );
}
