'use client';

import { useDerivAPI } from '@/lib/deriv-api-context';
import { DerivAuth } from '@/components/deriv-auth';
import { DERIV_CONFIG } from '@/lib/deriv-config';
import { PlatformLauncher } from '@/components/platform-launcher';
import { LineChart } from 'lucide-react';

interface SmartTraderTabProps {
    theme?: 'light' | 'dark';
}

export function SmartTraderTab({ theme = 'dark' }: SmartTraderTabProps) {
    const { token, isLoggedIn } = useDerivAPI();

    const smarttraderUrl = token
        ? `https://smarttrader.deriv.com?app_id=${DERIV_CONFIG.APP_ID}&token1=${token}`
        : `https://smarttrader.deriv.com?app_id=${DERIV_CONFIG.APP_ID}`;

    return (
        <div
            className={`min-h-[80vh] flex flex-col ${theme === 'dark' ? 'bg-gradient-to-br from-[#0f1629]/80 to-[#1a2235]/80' : 'bg-white'}`}
        >
            <div className='mb-4'>
                <DerivAuth theme={theme} />
            </div>

            <div className='max-w-4xl mx-auto w-full px-4'>
                <PlatformLauncher
                    title='SmartTrader'
                    description='Classic trading interface for straightforward binary options trading'
                    platformUrl={smarttraderUrl}
                    isAuthenticated={isLoggedIn}
                    icon={<LineChart className='h-8 w-8' />}
                    features={[
                        'Simple and intuitive interface',
                        'Quick trade execution',
                        'Multiple chart types and timeframes',
                        'Real-time price updates',
                        'Perfect for beginners and experienced traders',
                    ]}
                    theme={theme}
                />
            </div>
        </div>
    );
}
