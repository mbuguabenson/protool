import React from 'react';

/* ── Shared wrapper for consistent sizing + hover glow ────────── */
interface IconWrapperProps {
    children: React.ReactNode;
    size?: number;
}

const IconWrapper: React.FC<IconWrapperProps> = ({ children, size = 48 }) => (
    <svg
        width={size}
        height={size}
        viewBox='0 0 48 48'
        fill='none'
        xmlns='http://www.w3.org/2000/svg'
        style={{ display: 'block' }}
    >
        {children}
    </svg>
);

/* ── 1. My Computer / Local Device ───────────────────────────────
   A modern monitor/device icon with data pulse lines
   ─────────────────────────────────────────────────────────────── */
export const LocalDeviceIcon: React.FC<{ size?: number }> = ({ size }) => (
    <IconWrapper size={size}>
        <defs>
            <linearGradient id='localGrad' x1='0%' y1='0%' x2='100%' y2='100%'>
                <stop offset='0%' stopColor='#22d3ee' />
                <stop offset='100%' stopColor='#0ea5e9' />
            </linearGradient>
            <filter id='localGlow'>
                <feGaussianBlur stdDeviation='1.5' result='blur' />
                <feComposite in='SourceGraphic' in2='blur' operator='over' />
            </filter>
        </defs>
        {/* Monitor body */}
        <rect
            x='6'
            y='6'
            width='36'
            height='24'
            rx='3'
            stroke='url(#localGrad)'
            strokeWidth='2'
            fill='rgba(34, 211, 238, 0.06)'
            filter='url(#localGlow)'
        />
        {/* Screen glare line */}
        <line x1='9' y1='9' x2='39' y2='9' stroke='rgba(34, 211, 238, 0.15)' strokeWidth='0.5' />
        {/* Data pulse lines on screen */}
        <polyline
            points='10,22 14,18 18,20 22,14 26,19 30,16 34,21 38,17'
            stroke='#22d3ee'
            strokeWidth='1.5'
            strokeLinecap='round'
            strokeLinejoin='round'
            fill='none'
            opacity='0.7'
        />
        {/* Stand */}
        <line x1='24' y1='30' x2='24' y2='36' stroke='url(#localGrad)' strokeWidth='2' strokeLinecap='round' />
        {/* Base */}
        <line x1='17' y1='36' x2='31' y2='36' stroke='url(#localGrad)' strokeWidth='2' strokeLinecap='round' />
        {/* Upload arrow */}
        <path d='M24 26 L24 12' stroke='#22d3ee' strokeWidth='1.5' strokeLinecap='round' opacity='0.4' />
        <path
            d='M20 16 L24 12 L28 16'
            stroke='#22d3ee'
            strokeWidth='1.5'
            strokeLinecap='round'
            strokeLinejoin='round'
            opacity='0.4'
        />
        {/* Decorative corner dots */}
        <circle cx='9' cy='27' r='1' fill='#22d3ee' opacity='0.5' />
        <circle cx='39' cy='27' r='1' fill='#22d3ee' opacity='0.5' />
    </IconWrapper>
);

/* ── 2. Google Drive ─────────────────────────────────────────────
   Layered translucent cloud/drive with gradient shards
   ─────────────────────────────────────────────────────────────── */
export const GoogleDriveIcon: React.FC<{ size?: number }> = ({ size }) => (
    <IconWrapper size={size}>
        <defs>
            <linearGradient id='driveGradGreen' x1='0%' y1='0%' x2='100%' y2='100%'>
                <stop offset='0%' stopColor='#34d399' />
                <stop offset='100%' stopColor='#10b981' />
            </linearGradient>
            <linearGradient id='driveGradBlue' x1='0%' y1='0%' x2='100%' y2='100%'>
                <stop offset='0%' stopColor='#60a5fa' />
                <stop offset='100%' stopColor='#3b82f6' />
            </linearGradient>
            <linearGradient id='driveGradYellow' x1='0%' y1='0%' x2='100%' y2='100%'>
                <stop offset='0%' stopColor='#fbbf24' />
                <stop offset='100%' stopColor='#f59e0b' />
            </linearGradient>
            <filter id='driveGlow'>
                <feGaussianBlur stdDeviation='1' result='blur' />
                <feComposite in='SourceGraphic' in2='blur' operator='over' />
            </filter>
        </defs>
        {/* Google Drive triangle shape, modernized */}
        {/* Green shard (left) */}
        <path
            d='M8 32 L18 14 L28 32 Z'
            fill='rgba(52, 211, 153, 0.12)'
            stroke='url(#driveGradGreen)'
            strokeWidth='1.8'
            strokeLinejoin='round'
            filter='url(#driveGlow)'
        />
        {/* Blue shard (right) */}
        <path
            d='M20 14 L30 32 L40 32 L30 14 Z'
            fill='rgba(96, 165, 250, 0.12)'
            stroke='url(#driveGradBlue)'
            strokeWidth='1.8'
            strokeLinejoin='round'
            filter='url(#driveGlow)'
        />
        {/* Yellow/amber shard (bottom) */}
        <path
            d='M8 32 L28 32 L40 32'
            fill='none'
            stroke='url(#driveGradYellow)'
            strokeWidth='1.8'
            strokeLinecap='round'
            filter='url(#driveGlow)'
        />
        {/* Cloud shape overlay */}
        <path
            d='M16 22 Q16 17 20 17 Q21 14 24 14 Q27 14 28 17 Q32 17 32 22 Q32 26 28 26 L20 26 Q16 26 16 22Z'
            fill='rgba(255,255,255,0.04)'
            stroke='rgba(255,255,255,0.15)'
            strokeWidth='1'
        />
        {/* Sync arrows */}
        <path d='M22 38 L26 38' stroke='#34d399' strokeWidth='1.5' strokeLinecap='round' opacity='0.6' />
        <path
            d='M25 36 L27 38 L25 40'
            stroke='#34d399'
            strokeWidth='1.2'
            strokeLinecap='round'
            strokeLinejoin='round'
            opacity='0.6'
        />
    </IconWrapper>
);

/* ── 3. Bot Builder ──────────────────────────────────────────────
   Circuit board / puzzle / node network in violet-pink
   ─────────────────────────────────────────────────────────────── */
export const BotBuilderIcon: React.FC<{ size?: number }> = ({ size }) => (
    <IconWrapper size={size}>
        <defs>
            <linearGradient id='botGrad' x1='0%' y1='0%' x2='100%' y2='100%'>
                <stop offset='0%' stopColor='#a78bfa' />
                <stop offset='100%' stopColor='#8b5cf6' />
            </linearGradient>
            <filter id='botGlow'>
                <feGaussianBlur stdDeviation='1.5' result='blur' />
                <feComposite in='SourceGraphic' in2='blur' operator='over' />
            </filter>
        </defs>
        {/* Main bot head */}
        <rect
            x='14'
            y='14'
            width='20'
            height='18'
            rx='4'
            stroke='url(#botGrad)'
            strokeWidth='2'
            fill='rgba(139, 92, 246, 0.08)'
            filter='url(#botGlow)'
        />
        {/* Eyes */}
        <circle cx='20' cy='22' r='2.5' fill='rgba(167, 139, 250, 0.3)' stroke='#a78bfa' strokeWidth='1.2' />
        <circle cx='28' cy='22' r='2.5' fill='rgba(167, 139, 250, 0.3)' stroke='#a78bfa' strokeWidth='1.2' />
        {/* Eye glow dots */}
        <circle cx='20' cy='22' r='1' fill='#a78bfa' opacity='0.8' />
        <circle cx='28' cy='22' r='1' fill='#a78bfa' opacity='0.8' />
        {/* Mouth / speaker grill */}
        <line x1='20' y1='28' x2='28' y2='28' stroke='#a78bfa' strokeWidth='1' strokeLinecap='round' opacity='0.5' />
        {/* Antenna */}
        <line x1='24' y1='14' x2='24' y2='8' stroke='url(#botGrad)' strokeWidth='1.5' strokeLinecap='round' />
        <circle cx='24' cy='7' r='2' fill='rgba(167, 139, 250, 0.2)' stroke='#a78bfa' strokeWidth='1' />
        {/* Signal waves from antenna */}
        <path d='M19 5 Q24 2 29 5' stroke='#a78bfa' strokeWidth='0.8' fill='none' opacity='0.3' />
        <path d='M17 3 Q24 -1 31 3' stroke='#a78bfa' strokeWidth='0.6' fill='none' opacity='0.2' />
        {/* Circuit lines from body */}
        <line x1='14' y1='20' x2='8' y2='20' stroke='#a78bfa' strokeWidth='1' strokeLinecap='round' opacity='0.4' />
        <line x1='34' y1='20' x2='40' y2='20' stroke='#a78bfa' strokeWidth='1' strokeLinecap='round' opacity='0.4' />
        <line x1='14' y1='26' x2='10' y2='26' stroke='#a78bfa' strokeWidth='1' strokeLinecap='round' opacity='0.3' />
        <line x1='34' y1='26' x2='38' y2='26' stroke='#a78bfa' strokeWidth='1' strokeLinecap='round' opacity='0.3' />
        {/* Circuit node dots */}
        <circle cx='8' cy='20' r='1.5' fill='#a78bfa' opacity='0.5' />
        <circle cx='40' cy='20' r='1.5' fill='#a78bfa' opacity='0.5' />
        {/* Legs */}
        <line x1='18' y1='32' x2='18' y2='38' stroke='url(#botGrad)' strokeWidth='1.5' strokeLinecap='round' />
        <line x1='30' y1='32' x2='30' y2='38' stroke='url(#botGrad)' strokeWidth='1.5' strokeLinecap='round' />
        {/* Feet */}
        <line x1='16' y1='38' x2='20' y2='38' stroke='url(#botGrad)' strokeWidth='1.5' strokeLinecap='round' />
        <line x1='28' y1='38' x2='32' y2='38' stroke='url(#botGrad)' strokeWidth='1.5' strokeLinecap='round' />
        {/* Puzzle connector notch on right side */}
        <path
            d='M34 22 Q37 22 37 24 Q37 26 34 26'
            stroke='#a78bfa'
            strokeWidth='1'
            fill='rgba(167, 139, 250, 0.08)'
            opacity='0.5'
        />
    </IconWrapper>
);

/* ── 4. Quick Strategy ───────────────────────────────────────────
   Lightning bolt / rocket dashboard gauge in orange-amber
   ─────────────────────────────────────────────────────────────── */
export const QuickStrategyIcon: React.FC<{ size?: number }> = ({ size }) => (
    <IconWrapper size={size}>
        <defs>
            <linearGradient id='quickGrad' x1='0%' y1='0%' x2='100%' y2='100%'>
                <stop offset='0%' stopColor='#fbbf24' />
                <stop offset='50%' stopColor='#f59e0b' />
                <stop offset='100%' stopColor='#ea580c' />
            </linearGradient>
            <filter id='quickGlow'>
                <feGaussianBlur stdDeviation='1.5' result='blur' />
                <feComposite in='SourceGraphic' in2='blur' operator='over' />
            </filter>
        </defs>
        {/* Speedometer arc */}
        <path
            d='M10 34 A18 18 0 0 1 38 34'
            fill='none'
            stroke='rgba(251, 191, 36, 0.15)'
            strokeWidth='3'
            strokeLinecap='round'
        />
        {/* Speedometer filled arc (performance) */}
        <path
            d='M10 34 A18 18 0 0 1 34 12'
            fill='none'
            stroke='url(#quickGrad)'
            strokeWidth='3'
            strokeLinecap='round'
            filter='url(#quickGlow)'
        />
        {/* Gauge tick marks */}
        <line x1='12' y1='32' x2='14' y2='30' stroke='#fbbf24' strokeWidth='1' opacity='0.3' />
        <line x1='14' y1='22' x2='16' y2='23' stroke='#fbbf24' strokeWidth='1' opacity='0.3' />
        <line x1='24' y1='15' x2='24' y2='17' stroke='#fbbf24' strokeWidth='1' opacity='0.4' />
        <line x1='34' y1='22' x2='32' y2='23' stroke='#fbbf24' strokeWidth='1' opacity='0.3' />
        <line x1='36' y1='32' x2='34' y2='30' stroke='#fbbf24' strokeWidth='1' opacity='0.3' />
        {/* Needle pointing to high performance */}
        <line
            x1='24'
            y1='32'
            x2='32'
            y2='16'
            stroke='url(#quickGrad)'
            strokeWidth='2'
            strokeLinecap='round'
            filter='url(#quickGlow)'
        />
        {/* Center pivot */}
        <circle cx='24' cy='32' r='3' fill='rgba(251, 191, 36, 0.2)' stroke='#fbbf24' strokeWidth='1.5' />
        <circle cx='24' cy='32' r='1.2' fill='#fbbf24' />
        {/* Lightning bolt overlay */}
        <path
            d='M22 40 L25 36 L23 36 L26 31 L22 36 L24 36 Z'
            fill='url(#quickGrad)'
            opacity='0.7'
            filter='url(#quickGlow)'
        />
        {/* Speed lines */}
        <line x1='36' y1='14' x2='42' y2='10' stroke='#fbbf24' strokeWidth='1' strokeLinecap='round' opacity='0.3' />
        <line x1='38' y1='18' x2='43' y2='16' stroke='#fbbf24' strokeWidth='0.8' strokeLinecap='round' opacity='0.2' />
        <line x1='37' y1='22' x2='42' y2='21' stroke='#fbbf24' strokeWidth='0.6' strokeLinecap='round' opacity='0.15' />
    </IconWrapper>
);
