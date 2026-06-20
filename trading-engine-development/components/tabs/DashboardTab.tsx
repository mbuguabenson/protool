'use client';

import React from 'react';
import { UnifiedTradingDashboard } from '../unified-trading-dashboard';

interface DashboardTabProps {
    theme?: 'light' | 'dark';
}

/**
 * Dashboard tab component rendering the unified trading dashboard.
 * It accepts an optional theme prop to toggle light/dark styling.
 */
export default function DashboardTab({ theme = 'dark' }: DashboardTabProps) {
    return (
        <div
            className={`p-6 min-h-screen backdrop-blur-lg transition-all duration-300 ${
                theme === 'dark'
                    ? 'bg-gradient-to-br from-[#0f1629]/40 via-[#1a2235]/30 to-[#0f1629]/40'
                    : 'bg-gradient-to-br from-blue-50/30 via-white/40 to-purple-50/30'
            }`}
        >
            <UnifiedTradingDashboard />
        </div>
    );
}
