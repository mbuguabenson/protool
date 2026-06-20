'use client';

import { motion, AnimatePresence } from 'framer-motion';
import React, { useEffect, useState } from 'react';
import { TrendingUp, ArrowRight, Zap, Shield, BarChart2 } from 'lucide-react';

import ActiveSymbols from '@/components/ActiveSymbols';

export interface WelcomeScreenProps {
    onContinue?: () => void;
}

const ORBS = [
    { size: 420, x: '-10%', y: '-15%', color: 'rgba(99,102,241,0.18)', blur: 120, delay: 0 },
    { size: 320, x: '70%', y: '55%', color: 'rgba(6,182,212,0.14)', blur: 100, delay: 0.4 },
    { size: 260, x: '55%', y: '-20%', color: 'rgba(168,85,247,0.12)', blur: 90, delay: 0.8 },
    { size: 200, x: '5%', y: '65%', color: 'rgba(34,211,238,0.10)', blur: 80, delay: 1.2 },
];

const FEATURES = [
    { icon: Zap, label: 'Real‑time Signals' },
    { icon: BarChart2, label: 'Smart Analytics' },
    { icon: Shield, label: 'Risk‑aware Execution' },
];

export default function WelcomeScreen({ onContinue }: WelcomeScreenProps) {
    const [progress, setProgress] = useState(0);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        // Simulate loading progress
        const intervals = [
            setTimeout(() => setProgress(30), 400),
            setTimeout(() => setProgress(60), 900),
            setTimeout(() => setProgress(85), 1500),
            setTimeout(() => setProgress(100), 2200),
            setTimeout(() => setReady(true), 2600),
        ];
        return () => intervals.forEach(clearTimeout);
    }, []);

    return (
        <div className='aph-welcome-root'>
            {/* Ambient background orbs */}
            {ORBS.map((orb, i) => (
                <motion.div
                    key={i}
                    className='aph-orb'
                    style={{
                        width: orb.size,
                        height: orb.size,
                        left: orb.x,
                        top: orb.y,
                        background: orb.color,
                        filter: `blur(${orb.blur}px)`,
                    }}
                    animate={{ scale: [1, 1.12, 1], opacity: [0.7, 1, 0.7] }}
                    transition={{ repeat: Infinity, duration: 7 + i * 1.5, delay: orb.delay, ease: 'easeInOut' }}
                />
            ))}

            {/* Grid overlay */}
            <div className='aph-grid' />

            {/* Card */}
            <motion.div
                className='aph-card'
                initial={{ opacity: 0, y: 32, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
                {/* Top accent line */}
                <div className='aph-accent-line' />

                {/* Logo mark */}
                <motion.div
                    className='aph-logo-wrap'
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                >
                    <motion.div
                        className='aph-logo-ring'
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 10, ease: 'linear' }}
                    />
                    <div className='aph-logo-inner'>
                        <TrendingUp size={28} strokeWidth={1.8} />
                    </div>
                </motion.div>

                {/* Brand name */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35, duration: 0.5 }}
                >
                    <p className='aph-eyebrow'>ANALYSIS PROFIT HUB</p>
                    <h1 className='aph-headline'>
                        Trade Smarter,
                        <br />
                        <span className='aph-headline-accent'>Not Harder.</span>
                    </h1>
                    <p className='aph-sub'>
                        AI-powered analytics, live market signals, and automated execution — all in one place.
                    </p>
                </motion.div>

                {/* Feature pills */}
                <motion.div
                    className='aph-pills'
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5, duration: 0.5 }}
                >
                    {FEATURES.map(({ icon: Icon, label }) => (
                        <div key={label} className='aph-pill'>
                            <Icon size={13} />
                            <span>{label}</span>
                        </div>
                    ))}
                </motion.div>

                {/* Charts removed */}
                <ActiveSymbols />
                <motion.div
                    className='aph-progress-wrap'
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                >
                    <div className='aph-progress-track'>
                        <motion.div
                            className='aph-progress-fill'
                            initial={{ width: '0%' }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.5, ease: 'easeOut' }}
                        />
                    </div>
                    <div className='aph-progress-labels'>
                        <span>{ready ? 'Ready!' : 'Initializing…'}</span>
                        <span>{progress}%</span>
                    </div>
                </motion.div>

                {/* CTA buttons */}
                <AnimatePresence>
                    {ready && (
                        <motion.div
                            className='aph-actions'
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.45 }}
                        >
                            <button className='aph-btn-primary' onClick={() => onContinue?.()}>
                                Launch Dashboard
                                <ArrowRight size={16} />
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Footer */}
                <motion.p
                    className='aph-footer'
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                >
                    Powered by Deriv API &nbsp;·&nbsp; v2.0
                </motion.p>
            </motion.div>

            <style>{`
        .aph-welcome-root {
          position: fixed; inset: 0; z-index: 9999;
          display: flex; align-items: center; justify-content: center;
          background: radial-gradient(ellipse at 20% 20%, #0d0f1f 0%, #080910 60%, #0a0c15 100%);
          overflow: hidden; font-family: 'Inter', 'Segoe UI', sans-serif;
        }
        .aph-orb {
          position: absolute; border-radius: 50%; pointer-events: none;
        }
        .aph-grid {
          position: absolute; inset: 0; pointer-events: none;
          background-image:
            linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
          background-size: 48px 48px;
          mask-image: radial-gradient(ellipse at center, black 30%, transparent 75%);
        }
        .aph-card {
          position: relative; width: 100%; max-width: 480px;
          background: linear-gradient(145deg, rgba(255,255,255,0.065) 0%, rgba(255,255,255,0.025) 100%);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 24px; padding: 44px 40px 36px;
          backdrop-filter: blur(32px) saturate(160%);
          box-shadow: 0 0 0 1px rgba(99,102,241,0.1), 0 32px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08);
          overflow: hidden;
        }
        .aph-accent-line {
          position: absolute; top: 0; left: 10%; right: 10%; height: 2px;
          background: linear-gradient(90deg, transparent, #6366f1, #06b6d4, transparent);
          border-radius: 0 0 4px 4px;
        }
        .aph-logo-wrap {
          position: relative; width: 68px; height: 68px; margin: 0 auto 28px;
          display: flex; align-items: center; justify-content: center;
        }
        .aph-logo-ring {
          position: absolute; inset: 0; border-radius: 50%;
          border: 1.5px dashed rgba(99,102,241,0.5);
        }
        .aph-logo-inner {
          width: 52px; height: 52px; border-radius: 16px;
          background: linear-gradient(135deg, #4f46e5, #06b6d4);
          display: flex; align-items: center; justify-content: center;
          color: #fff; box-shadow: 0 0 32px rgba(99,102,241,0.45), 0 8px 24px rgba(0,0,0,0.4);
        }
        .aph-eyebrow {
          text-align: center; font-size: 10px; letter-spacing: 0.2em;
          color: rgba(99,102,241,0.8); font-weight: 600; margin-bottom: 10px; text-transform: uppercase;
        }
        .aph-headline {
          text-align: center; font-size: 32px; font-weight: 800; line-height: 1.15;
          color: #f1f5f9; letter-spacing: -0.02em; margin-bottom: 14px;
        }
        .aph-headline-accent {
          background: linear-gradient(90deg, #818cf8, #22d3ee);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        .aph-sub {
          text-align: center; font-size: 13.5px; color: rgba(148,163,184,0.85); line-height: 1.6; margin-bottom: 24px;
        }
        .aph-pills {
          display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin-bottom: 28px;
        }
        .aph-pill {
          display: flex; align-items: center; gap: 5px; padding: 5px 12px;
          border-radius: 999px; background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.2);
          font-size: 11.5px; color: #a5b4fc; font-weight: 500;
        }
        .aph-progress-wrap { margin-bottom: 28px; }
        .aph-progress-track {
          width: 100%; height: 5px; border-radius: 999px;
          background: rgba(255,255,255,0.08); overflow: hidden;
        }
        .aph-progress-fill {
          height: 100%; border-radius: 999px;
          background: linear-gradient(90deg, #6366f1, #06b6d4);
          box-shadow: 0 0 12px rgba(99,102,241,0.6);
        }
        .aph-progress-labels {
          display: flex; justify-content: space-between;
          font-size: 11px; color: rgba(148,163,184,0.6); margin-top: 8px;
        }
        .aph-actions { display: flex; justify-content: center; margin-bottom: 20px; }
        .aph-btn-primary {
          display: flex; align-items: center; gap: 8px;
          padding: 13px 32px; border-radius: 14px; border: none; cursor: pointer;
          background: linear-gradient(135deg, #4f46e5 0%, #0891b2 100%);
          color: #fff; font-size: 14.5px; font-weight: 700; letter-spacing: 0.01em;
          box-shadow: 0 4px 24px rgba(79,70,229,0.45), 0 1px 0 rgba(255,255,255,0.12) inset;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .aph-btn-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 32px rgba(79,70,229,0.6), 0 1px 0 rgba(255,255,255,0.12) inset;
        }
        .aph-btn-primary:active { transform: translateY(0); }
        .aph-footer {
          text-align: center; font-size: 11px; color: rgba(100,116,139,0.6); letter-spacing: 0.04em;
        }
      `}</style>
        </div>
    );
}
