'use client';

import { useState } from 'react';
import { DerivHeader, tabs, type DerivTab } from '@/components/deriv-header';
import { DerivAuth } from '@/components/deriv-auth';
import { useDerivAPI } from '@/lib/deriv-api-context';
import { useRouter } from 'next/navigation';

interface DerivPlatformsTabProps {
    theme?: 'light' | 'dark';
}

export function DerivPlatformsTab({ theme = 'dark' }: DerivPlatformsTabProps) {
    const [activeTab, setActiveTab] = useState<DerivTab>(tabs[0]);
    const { token } = useDerivAPI();
    const router = useRouter();

    const getUrl = (tab: DerivTab) => {
        let baseUrl = tab.url;
        if (token) {
            const separator = baseUrl.includes('?') ? '&' : '?';
            return `${baseUrl}${separator}token=${token}`;
        }
        return baseUrl;
    };

    const iframeUrl = getUrl(activeTab);

    return (
        <div
            className={`h-screen flex flex-col ${theme === 'dark' ? 'bg-gradient-to-br from-[#0f1629]/80 to-[#1a2235]/80 text-white' : 'bg-white text-gray-900'}`}
        >
            <DerivAuth theme={theme} />
            <DerivHeader activeTab={activeTab} setActiveTab={setActiveTab} theme={theme} />

            <div className='flex-1 p-4'>
                <div
                    className={`w-full h-full rounded-2xl shadow-lg overflow-hidden ${
                        theme === 'dark' ? 'bg-black/20 border border-blue-500/20' : 'bg-gray-50'
                    }`}
                >
                    <iframe
                        key={activeTab.id} // Force reload when tab changes
                        src={iframeUrl}
                        title={activeTab.name}
                        className='w-full h-full border-0'
                        allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
                        sandbox='allow-same-origin allow-scripts allow-popups allow-forms allow-modals allow-downloads'
                    />
                </div>
            </div>
        </div>
    );
}
