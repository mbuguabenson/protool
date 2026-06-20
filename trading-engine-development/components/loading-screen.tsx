'use client';

import { useState, useEffect, useRef } from 'react';
import { Shield, Zap, Globe, Cpu, Rocket, Activity, Wifi, CheckCircle2 } from 'lucide-react';

interface LoadingStep {
    id: string;
    label: string;
    sublabel: string;
    status: 'pending' | 'loading' | 'complete';
    icon: any;
    accent: string;
    glow: string;
}

interface LoadingScreenProps {
    onComplete: () => void;
}

export function LoadingScreen({ onComplete }: LoadingScreenProps) {
    const [progress, setProgress] = useState(0);
    const [currentStepIdx, setCurrentStepIdx] = useState(-1);
    const [dots, setDots] = useState('.');
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const progressRef = useRef(0);

    const [steps, setSteps] = useState<LoadingStep[]>([
        {
            id: 'connect',
            label: 'Secure Link',
            sublabel: 'Encrypted WebSocket tunnel',
            status: 'pending',
            icon: Globe,
            accent: 'text-indigo-400',
            glow: 'shadow-indigo-500/40',
        },
        {
            id: 'markets',
            label: 'Market Feed',
            sublabel: 'Live data calibration',
            status: 'pending',
            icon: Wifi,
            accent: 'text-cyan-400',
            glow: 'shadow-cyan-500/40',
        },
        {
            id: 'analyze',
            label: 'Quantum Core',
            sublabel: 'Analysis engine boot',
            status: 'pending',
            icon: Cpu,
            accent: 'text-violet-400',
            glow: 'shadow-violet-500/40',
        },
        {
            id: 'account',
            label: 'Auth Vault',
            sublabel: 'Credential verification',
            status: 'pending',
            icon: Shield,
            accent: 'text-emerald-400',
            glow: 'shadow-emerald-500/40',
        },
        {
            id: 'launch',
            label: 'Launch',
            sublabel: 'Terminal initializing',
            status: 'pending',
            icon: Rocket,
            accent: 'text-amber-400',
            glow: 'shadow-amber-500/40',
        },
    ]);

    /* ── Animated dots ── */
    useEffect(() => {
        const t = setInterval(() => {
            setDots(d => (d.length >= 3 ? '.' : d + '.'));
        }, 480);
        return () => clearInterval(t);
    }, []);

    /* ── Canvas particle network ── */
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let raf: number;
        let W = (canvas.width = window.innerWidth);
        let H = (canvas.height = window.innerHeight);

        type P = { x: number; y: number; vx: number; vy: number; r: number; hue: number; a: number };
        const ps: P[] = Array.from({ length: 70 }, () => ({
            x: Math.random() * W,
            y: Math.random() * H,
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.5,
            r: Math.random() * 1.6 + 0.4,
            hue: [245, 195, 270][Math.floor(Math.random() * 3)],
            a: Math.random() * 0.2 + 0.05,
        }));

        const onResize = () => {
            W = canvas.width = window.innerWidth;
            H = canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', onResize);

        const draw = () => {
            ctx.clearRect(0, 0, W, H);
            ps.forEach((p, i) => {
                p.x += p.vx;
                p.y += p.vy;
                if (p.x < 0 || p.x > W) p.vx *= -1;
                if (p.y < 0 || p.y > H) p.vy *= -1;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = `hsla(${p.hue},80%,65%,${p.a})`;
                ctx.fill();
                for (let j = i + 1; j < ps.length; j++) {
                    const q = ps[j];
                    const d = Math.hypot(p.x - q.x, p.y - q.y);
                    if (d < 140) {
                        ctx.beginPath();
                        ctx.moveTo(p.x, p.y);
                        ctx.lineTo(q.x, q.y);
                        ctx.strokeStyle = `hsla(240,75%,65%,${0.07 * (1 - d / 140)})`;
                        ctx.lineWidth = 0.5;
                        ctx.stroke();
                    }
                }
            });
            raf = requestAnimationFrame(draw);
        };
        draw();
        return () => {
            window.removeEventListener('resize', onResize);
            cancelAnimationFrame(raf);
        };
    }, []);

    /* ── Loading sequence ── */
    useEffect(() => {
        const animateTo = (target: number, ms: number) =>
            new Promise<void>(res => {
                const from = progressRef.current;
                const start = Date.now();
                const tick = () => {
                    const t = Math.min((Date.now() - start) / ms, 1);
                    const eased = 1 - Math.pow(1 - t, 3);
                    const cur = from + (target - from) * eased;
                    progressRef.current = cur;
                    setProgress(cur);
                    if (t < 1) requestAnimationFrame(tick);
                    else res();
                };
                requestAnimationFrame(tick);
            });

        const sequence = async () => {
            await new Promise(r => setTimeout(r, 600));
            for (let i = 0; i < steps.length; i++) {
                setCurrentStepIdx(i);
                setSteps(prev => prev.map((s, idx) => (idx === i ? { ...s, status: 'loading' } : s)));
                await animateTo((i + 1) * (100 / steps.length), 700);
                setSteps(prev => prev.map((s, idx) => (idx === i ? { ...s, status: 'complete' } : s)));
                await new Promise(r => setTimeout(r, 100));
            }
            await new Promise(r => setTimeout(r, 500));
            onComplete();
        };
        sequence();
    }, []);

    const currentStep = steps[currentStepIdx];

    return (
        <div className='fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden bg-[#030508] select-none'>
            {/* Canvas particles */}
            <canvas ref={canvasRef} className='absolute inset-0 z-0 pointer-events-none opacity-70' />

            {/* Layered ambient glows */}
            <div className='absolute inset-0 z-0 pointer-events-none overflow-hidden'>
                <div className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-indigo-600/[0.07] blur-[140px]' />
                <div className='absolute -top-16 left-1/4 w-72 h-72 rounded-full bg-violet-600/[0.06] blur-[100px]' />
                <div className='absolute bottom-0 right-1/4 w-72 h-72 rounded-full bg-cyan-500/[0.05] blur-[100px]' />
                {/* Subtle scan line */}
                <div
                    className='absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent'
                    style={{ top: `${(progress / 100) * 80 + 10}%`, transition: 'top 0.3s ease' }}
                />
                {/* Grid */}
                <div
                    className='absolute inset-0 opacity-[0.022]'
                    style={{
                        backgroundImage: `linear-gradient(rgba(99,102,241,1) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,1) 1px, transparent 1px)`,
                        backgroundSize: '55px 55px',
                    }}
                />
            </div>

            <div className='relative z-10 w-full max-w-lg px-6 flex flex-col items-center gap-8'>
                {/* ── Glowing Orb ── */}
                <div className='relative w-44 h-44 flex items-center justify-center'>
                    {/* Outer slow-pulse halo */}
                    <div
                        className='absolute inset-0 rounded-full bg-indigo-600/10 blur-2xl animate-pulse'
                        style={{ animationDuration: '3s' }}
                    />
                    {/* Ring 1 – slow dashed */}
                    <div
                        className='absolute w-[168px] h-[168px] rounded-full border border-dashed border-indigo-500/25'
                        style={{ animation: 'spin 45s linear infinite' }}
                    />
                    {/* Ring 2 – medium solid */}
                    <div
                        className='absolute w-36 h-36 rounded-full border border-violet-500/30'
                        style={{ animation: 'spin 18s linear infinite reverse' }}
                    />
                    {/* Ring 3 – fast */}
                    <div
                        className='absolute w-28 h-28 rounded-full border border-cyan-400/25'
                        style={{ animation: 'spin 8s linear infinite' }}
                    />
                    {/* Pulsing core glow */}
                    <div className='absolute w-20 h-20 rounded-full bg-gradient-to-tr from-indigo-600/50 via-blue-500/30 to-cyan-400/20 blur-2xl animate-pulse' />
                    {/* Core icon box */}
                    <div className='relative w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 flex items-center justify-center border border-white/10 shadow-[0_0_50px_rgba(99,102,241,0.55),inset_0_1px_0_rgba(255,255,255,0.1)]'>
                        <Activity className='w-7 h-7 text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]' />
                    </div>
                    {/* Orbiting dot 1 */}
                    <div className='absolute w-full h-full' style={{ animation: 'spin 4s linear infinite' }}>
                        <div className='absolute top-0.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_12px_#22d3ee,0_0_6px_#22d3ee]' />
                    </div>
                    {/* Orbiting dot 2 */}
                    <div className='absolute w-full h-full' style={{ animation: 'spin 7s linear infinite reverse' }}>
                        <div className='absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-violet-400 shadow-[0_0_10px_#a78bfa]' />
                    </div>
                </div>

                {/* ── Brand ── */}
                <div className='text-center space-y-2'>
                    {/* Badge */}
                    <div className='inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/20 bg-indigo-500/5 backdrop-blur-sm mb-1'>
                        <div className='w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)] animate-pulse' />
                        <span className='text-[9px] font-black tracking-[0.3em] text-emerald-400 uppercase'>
                            System Booting
                        </span>
                    </div>

                    <h1 className='text-5xl font-black tracking-[-0.03em] leading-none text-white'>
                        PRO
                        <span className='bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-300 bg-clip-text text-transparent drop-shadow-[0_0_25px_rgba(139,92,246,0.5)]'>
                            TOOL
                        </span>
                    </h1>
                    <div className='flex items-center justify-center gap-2'>
                        <span className='text-lg font-black text-white/30 tracking-widest'>3.0</span>
                        <span className='px-2 py-0.5 rounded-md bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-[10px] font-black text-amber-400 tracking-widest uppercase'>
                            TURBO
                        </span>
                    </div>
                    <p className='text-[9px] font-black tracking-[0.35em] text-white/20 uppercase'>
                        Advanced Trading Intelligence Platform
                    </p>
                </div>

                {/* ── Progress track ── */}
                <div className='w-full space-y-3'>
                    <div className='flex items-center justify-between'>
                        <span className='text-[10px] font-black text-indigo-300/60 uppercase tracking-widest'>
                            {currentStep?.sublabel || 'Initializing'}
                            <span className='text-indigo-400/40'>{dots}</span>
                        </span>
                        <span className='text-base font-black text-white font-mono tabular-nums'>
                            {Math.round(progress)}
                            <span className='text-xs text-white/25 ml-0.5'>%</span>
                        </span>
                    </div>

                    {/* Track */}
                    <div className='relative h-2 w-full rounded-full bg-white/[0.04] border border-white/[0.06] overflow-hidden'>
                        <div
                            className='absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-400 shadow-[0_0_16px_rgba(99,102,241,0.6)] transition-all duration-100'
                            style={{ width: `${progress}%` }}
                        />
                        {/* Shimmer */}
                        <div
                            className='absolute inset-y-0 w-16 rounded-full bg-gradient-to-r from-transparent via-white/20 to-transparent'
                            style={{ left: `${Math.max(0, progress - 8)}%`, transition: 'left 0.1s linear' }}
                        />
                    </div>

                    {/* Step dots row */}
                    <div className='flex items-center justify-between px-1'>
                        {steps.map((s, i) => (
                            <div key={s.id} className='flex items-center gap-1'>
                                <div
                                    className={`transition-all duration-500 rounded-full ${
                                        s.status === 'complete'
                                            ? 'w-2.5 h-2.5 bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                                            : s.status === 'loading'
                                              ? 'w-2.5 h-2.5 bg-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.9)] animate-pulse'
                                              : 'w-2 h-2 bg-white/10'
                                    }`}
                                />
                                {i < steps.length - 1 && (
                                    <div
                                        className={`h-px flex-1 transition-all duration-700 ${
                                            i < currentStepIdx ? 'bg-emerald-400/40' : 'bg-white/5'
                                        }`}
                                        style={{ width: '18px' }}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Step Cards ── */}
                <div className='w-full grid grid-cols-5 gap-1.5'>
                    {steps.map(step => {
                        const Icon = step.icon;
                        const isComplete = step.status === 'complete';
                        const isActive = step.status === 'loading';
                        return (
                            <div
                                key={step.id}
                                className={`relative flex flex-col items-center gap-1.5 py-3 px-1 rounded-2xl border transition-all duration-500 overflow-hidden ${
                                    isComplete
                                        ? 'bg-white/[0.03] border-white/10'
                                        : isActive
                                          ? 'bg-indigo-950/50 border-indigo-500/40 scale-[1.05]'
                                          : 'bg-white/[0.01] border-white/[0.04] opacity-40'
                                }`}
                            >
                                {/* Glow layer for active */}
                                {isActive && <div className='absolute inset-0 bg-indigo-500/5 rounded-2xl' />}
                                <div
                                    className={`relative w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-500 ${
                                        isComplete
                                            ? 'bg-emerald-500/10'
                                            : isActive
                                              ? 'bg-indigo-500/15 animate-pulse'
                                              : 'bg-white/5'
                                    }`}
                                >
                                    {isComplete ? (
                                        <CheckCircle2 className='w-4 h-4 text-emerald-400' />
                                    ) : (
                                        <Icon className={`w-4 h-4 ${isActive ? step.accent : 'text-white/20'}`} />
                                    )}
                                </div>
                                <p
                                    className={`text-[8px] font-black uppercase tracking-wide text-center leading-none ${
                                        isComplete ? 'text-emerald-300/70' : isActive ? step.accent : 'text-white/15'
                                    }`}
                                >
                                    {step.label}
                                </p>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── Bottom status bar ── */}
            <div className='absolute bottom-0 left-0 right-0 z-10 border-t border-white/[0.04] bg-black/20 backdrop-blur-xl px-8 py-3 flex items-center justify-between'>
                <div className='flex items-center gap-4'>
                    <div className='flex items-center gap-1.5'>
                        <div className='w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)] animate-pulse' />
                        <span className='text-[8px] font-black tracking-[0.3em] uppercase text-white/20'>Live</span>
                    </div>
                    <span className='text-[8px] font-black tracking-[0.25em] uppercase text-white/10'>·</span>
                    <span className='text-[8px] font-black tracking-[0.25em] uppercase text-white/10'>Secure</span>
                    <span className='text-[8px] font-black tracking-[0.25em] uppercase text-white/10'>·</span>
                    <span className='text-[8px] font-black tracking-[0.25em] uppercase text-white/10'>Encrypted</span>
                </div>
                <span className='text-[8px] font-black tracking-[0.3em] uppercase text-white/10 font-mono'>
                    PROTOOL v3.0-TURBO
                </span>
            </div>
        </div>
    );
}
