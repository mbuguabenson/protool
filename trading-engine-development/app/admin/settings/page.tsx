'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    Settings,
    Eye,
    EyeOff,
    AlertTriangle,
    Bell,
    Save,
    Wrench,
    Layout,
    ToggleLeft,
    ToggleRight,
    Send,
    Check,
} from 'lucide-react';

interface SiteConfig {
    maintenanceMode: boolean;
    maintenanceMessage: string;
    headerHidden: boolean;
    footerHidden: boolean;
    hiddenTabs: string[];
}

const ALL_TABS = [
    { id: 'smart', label: 'Smart Adaptive' },
    { id: 'autotrader', label: 'AutoTrader' },
    { id: 'smartauto24', label: 'SmartAuto 24' },
    { id: 'signals', label: 'Super Signals' },
    { id: 'analysis', label: 'Analysis' },
];

export default function AdminSettingsPage() {
    const [config, setConfig] = useState<SiteConfig>({
        maintenanceMode: false,
        maintenanceMessage: "We are performing scheduled maintenance. We'll be back shortly.",
        headerHidden: false,
        footerHidden: false,
        hiddenTabs: [],
    });
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [notifTitle, setNotifTitle] = useState('');
    const [notifBody, setNotifBody] = useState('');
    const [notifType, setNotifType] = useState<'info' | 'warning' | 'update'>('info');
    const [sending, setSending] = useState(false);
    const [sentNotif, setSentNotif] = useState(false);

    useEffect(() => {
        fetch('/api/admin/site-config')
            .then(r => r.json())
            .then(data => setConfig(data))
            .catch(console.error);
    }, []);

    const saveConfig = async () => {
        setSaving(true);
        setSaved(false);
        try {
            await fetch('/api/admin/site-config', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config),
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (err) {
            console.error(err);
        }
        setSaving(false);
    };

    const toggleTab = (id: string) => {
        setConfig(prev => ({
            ...prev,
            hiddenTabs: prev.hiddenTabs.includes(id) ? prev.hiddenTabs.filter(t => t !== id) : [...prev.hiddenTabs, id],
        }));
    };

    const sendNotification = async () => {
        if (!notifTitle || !notifBody) return;
        setSending(true);
        try {
            await fetch('/api/admin/notifications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: notifTitle, body: notifBody, type: notifType }),
            });
            setSentNotif(true);
            setNotifTitle('');
            setNotifBody('');
            setTimeout(() => setSentNotif(false), 3000);
        } catch (err) {
            console.error(err);
        }
        setSending(false);
    };

    const Toggle = ({ value, onToggle, label }: { value: boolean; onToggle: () => void; label: string }) => (
        <div className='flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-2xl'>
            <span className='text-sm font-medium text-gray-300'>{label}</span>
            <button onClick={onToggle} className={`transition-colors ${value ? 'text-blue-400' : 'text-gray-600'}`}>
                {value ? <ToggleRight className='h-7 w-7' /> : <ToggleLeft className='h-7 w-7' />}
            </button>
        </div>
    );

    return (
        <div className='space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20 max-w-3xl'>
            <div>
                <h2 className='text-3xl font-black text-white tracking-tight'>Settings</h2>
                <p className='text-sm text-gray-500 mt-1'>
                    Control the platform's appearance, maintenance mode, and user notifications.
                </p>
            </div>

            {/* Maintenance Mode */}
            <section className='bg-[#0a0a0a] border border-white/5 rounded-3xl p-8 space-y-6'>
                <div className='flex items-center gap-3 mb-2'>
                    <Wrench className='h-5 w-5 text-amber-500' />
                    <h3 className='text-sm font-bold text-white uppercase tracking-widest'>Maintenance Mode</h3>
                </div>
                <Toggle
                    label='Enable Maintenance Banner'
                    value={config.maintenanceMode}
                    onToggle={() => setConfig(p => ({ ...p, maintenanceMode: !p.maintenanceMode }))}
                />
                {config.maintenanceMode && (
                    <div className='space-y-2'>
                        <label className='text-[10px] text-gray-500 font-bold uppercase tracking-widest'>
                            Maintenance Message
                        </label>
                        <textarea
                            value={config.maintenanceMessage}
                            onChange={e => setConfig(p => ({ ...p, maintenanceMessage: e.target.value }))}
                            className='w-full bg-white/[0.03] border border-white/10 rounded-2xl p-4 text-sm text-white resize-none h-24 focus:outline-none focus:border-amber-500/50'
                        />
                    </div>
                )}
            </section>

            {/* Layout Controls */}
            <section className='bg-[#0a0a0a] border border-white/5 rounded-3xl p-8 space-y-4'>
                <div className='flex items-center gap-3 mb-2'>
                    <Layout className='h-5 w-5 text-blue-500' />
                    <h3 className='text-sm font-bold text-white uppercase tracking-widest'>Layout Visibility</h3>
                </div>
                <Toggle
                    label='Hide Navigation Header'
                    value={config.headerHidden}
                    onToggle={() => setConfig(p => ({ ...p, headerHidden: !p.headerHidden }))}
                />
                <Toggle
                    label='Hide Footer'
                    value={config.footerHidden}
                    onToggle={() => setConfig(p => ({ ...p, footerHidden: !p.footerHidden }))}
                />
                <div>
                    <p className='text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-3'>Hidden Tabs</p>
                    <div className='grid grid-cols-2 gap-2'>
                        {ALL_TABS.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => toggleTab(tab.id)}
                                className={`p-3 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 ${
                                    config.hiddenTabs.includes(tab.id)
                                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                                        : 'bg-white/[0.02] border-white/5 text-gray-400 hover:border-white/10'
                                }`}
                            >
                                {config.hiddenTabs.includes(tab.id) ? (
                                    <EyeOff className='h-3 w-3' />
                                ) : (
                                    <Eye className='h-3 w-3' />
                                )}
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            {/* Save Button */}
            <button
                onClick={saveConfig}
                disabled={saving}
                className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                    saved
                        ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                        : 'bg-blue-600 hover:bg-blue-500 text-white shadow-xl shadow-blue-500/20'
                } disabled:opacity-50`}
            >
                {saved ? (
                    <>
                        <Check className='h-4 w-4' /> Saved!
                    </>
                ) : (
                    <>
                        <Save className='h-4 w-4' /> Save Settings
                    </>
                )}
            </button>

            {/* Broadcast Notification */}
            <section className='bg-[#0a0a0a] border border-white/5 rounded-3xl p-8 space-y-6'>
                <div className='flex items-center gap-3 mb-2'>
                    <Bell className='h-5 w-5 text-purple-500' />
                    <h3 className='text-sm font-bold text-white uppercase tracking-widest'>
                        Broadcast Notification to Users
                    </h3>
                </div>
                <div className='space-y-2'>
                    <label className='text-[10px] text-gray-500 font-bold uppercase tracking-widest'>Type</label>
                    <div className='flex gap-2'>
                        {(['info', 'warning', 'update'] as const).map(t => (
                            <button
                                key={t}
                                onClick={() => setNotifType(t)}
                                className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${notifType === t ? 'bg-blue-600 text-white' : 'bg-white/5 border border-white/10 text-gray-400'}`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                </div>
                <input
                    value={notifTitle}
                    onChange={e => setNotifTitle(e.target.value)}
                    placeholder='Notification title...'
                    className='w-full bg-white/[0.03] border border-white/10 rounded-2xl py-3 px-4 text-sm text-white placeholder:text-gray-700 focus:outline-none focus:border-purple-500/50'
                />
                <textarea
                    value={notifBody}
                    onChange={e => setNotifBody(e.target.value)}
                    placeholder='Notification body...'
                    className='w-full bg-white/[0.03] border border-white/10 rounded-2xl p-4 text-sm text-white resize-none h-24 placeholder:text-gray-700 focus:outline-none focus:border-purple-500/50'
                />
                <button
                    onClick={sendNotification}
                    disabled={sending || !notifTitle || !notifBody}
                    className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                        sentNotif
                            ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                            : 'bg-purple-600 hover:bg-purple-500 text-white shadow-xl shadow-purple-500/20'
                    } disabled:opacity-50`}
                >
                    {sentNotif ? (
                        <>
                            <Check className='h-4 w-4' /> Sent!
                        </>
                    ) : (
                        <>
                            <Send className='h-4 w-4' /> Send to All Users
                        </>
                    )}
                </button>
            </section>
        </div>
    );
}
