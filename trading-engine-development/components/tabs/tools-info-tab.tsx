'use client';
import { useState, useEffect } from 'react';
import { AutoBotTab } from './autobot-tab';
import { SettingsPanel } from '@/components/settings-panel';
import { HelpPanel } from '@/components/help-panel';
import { ConnectionLogs } from '@/components/connection-logs';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import type { ConnectionLog } from '@/hooks/use-deriv';

interface ToolsInfoTabProps {
    theme: 'light' | 'dark';
    connectionLogs: ConnectionLog[];
}

export function ToolsInfoTab({ theme, connectionLogs = [] }: ToolsInfoTabProps) {
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        try {
            console.log('[v0] Tools & Info tab loaded successfully');
        } catch (error) {
            console.error('[v0] Error in Tools & Info tab:', error);
            setHasError(true);
        }
    }, []);

    if (hasError) {
        return (
            <div className='text-center py-16'>
                <p className={theme === 'dark' ? 'text-red-400' : 'text-red-600'}>
                    An error occurred loading this tab. Please refresh the page.
                </p>
            </div>
        );
    }

    return (
        <div className='w-full'>
            <Tabs defaultValue='bots' className='w-full'>
                <div
                    className={`relative backdrop-blur-lg border-b transition-all duration-300 ${
                        theme === 'dark'
                            ? 'bg-gradient-to-r from-blue-500/5 via-transparent to-purple-500/5 border-blue-400/20'
                            : 'bg-gradient-to-r from-blue-50 via-white to-purple-50 border-gray-200'
                    }`}
                >
                    <TabsList
                        className={`w-full justify-start rounded-none overflow-x-auto p-0 bg-transparent ${theme === 'dark' ? 'border-0' : 'border-0'}`}
                    >
                        {[
                            { value: 'bots', label: 'Trading Bots', icon: '🤖' },
                            { value: 'settings', label: 'Settings', icon: '⚙️' },
                            { value: 'help', label: 'Help & Docs', icon: '📚' },
                            { value: 'logs', label: 'Logs', icon: '📋' },
                        ].map(tab => (
                            <TabsTrigger
                                key={tab.value}
                                value={tab.value}
                                className={`flex-shrink-0 rounded-lg mx-1 my-2 border-b-0 text-xs sm:text-sm px-3 sm:px-5 py-2 sm:py-2.5 whitespace-nowrap transition-all font-semibold group ${
                                    theme === 'dark'
                                        ? 'text-gray-400 hover:text-white data-[state=active]:text-white data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600/40 data-[state=active]:to-purple-600/40 data-[state=active]:border data-[state=active]:border-blue-400/30 data-[state=active]:shadow-lg data-[state=active]:shadow-blue-500/20'
                                        : 'text-gray-600 hover:text-gray-900 data-[state=active]:text-blue-700 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-50 data-[state=active]:to-purple-50 data-[state=active]:border data-[state=active]:border-blue-300 data-[state=active]:shadow-md'
                                }`}
                            >
                                <span className='mr-1.5'>{tab.icon}</span>
                                {tab.label}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </div>

                <div
                    className={`w-full p-4 sm:p-6 backdrop-blur-sm ${theme === 'dark' ? 'bg-gradient-to-br from-[#0f1629]/30 to-[#1a2235]/20' : 'bg-white/50'}`}
                >
                    <TabsContent value='bots' className='mt-0 animate-in fade-in slide-in-from-bottom-2 duration-300'>
                        <AutoBotTab theme={theme} symbol='' />
                    </TabsContent>

                    <TabsContent
                        value='settings'
                        className='mt-0 animate-in fade-in slide-in-from-bottom-2 duration-300'
                    >
                        <SettingsPanel />
                    </TabsContent>

                    <TabsContent value='help' className='mt-0 animate-in fade-in slide-in-from-bottom-2 duration-300'>
                        <HelpPanel />
                    </TabsContent>

                    <TabsContent value='logs' className='mt-0 animate-in fade-in slide-in-from-bottom-2 duration-300'>
                        <ConnectionLogs logs={connectionLogs} />
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    );
}
