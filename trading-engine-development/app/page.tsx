'use client';

import { useState, useEffect } from 'react';
import { useDeriv } from '@/hooks/use-deriv';
import { Tabs, TabsContent, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Moon,
    Sun,
    User,
    AlertTriangle,
    Menu,
    TrendingUp,
    Layers,
    Eye,
    Hash,
    Clock,
    Activity,
    LayoutDashboard,
    Sliders,
    LineChart,
    Sparkles,
    Cpu,
    Terminal,
    Radio,
    Flame,
    Percent,
    CheckSquare,
    XCircle,
    HelpCircle,
    BrainCircuit,
    ArrowUpDown,
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Link from 'next/link';
import { DigitDistribution } from '@/components/digit-distribution';
import { SignalsTab } from '@/components/tabs/signals-tab';
import { ProSignalsTab } from '@/components/tabs/pro-signals-tab';
import { EvenOddTab } from '@/components/tabs/even-odd-tab';
import { OverUnderTab } from '@/components/tabs/over-under-tab';
import { MatchesTab } from '@/components/tabs/matches-tab';
import { DiffersTab } from '@/components/tabs/differs-tab';
import { StatisticalAnalysis } from '@/components/statistical-analysis';
import { LastDigitsChart } from '@/components/charts/last-digits-chart';
import { LastDigitsLineChart } from '@/components/charts/last-digits-line-chart';
import { AIAnalysisTab } from '@/components/tabs/ai-analysis-tab';
import { HeritageSuperSignals } from '@/components/heritage-super-signals';
import { SuperSignalsTab } from '@/components/tabs/super-signals-tab';
import { LoadingScreen } from '@/components/loading-screen';
import { DerivAuth } from '@/components/deriv-auth';
import { AutoBotTab } from '@/components/tabs/autobot-tab';
import { AutomatedTab } from '@/components/tabs/automated-tab';
import { SmartAuto24Tab } from '@/components/tabs/smartauto24-tab';
import { AdvancedSignalsTab } from '@/components/advanced-signals-tab';
import { useGlobalTradingContext } from '@/hooks/use-global-trading-context';
import { verifier } from '@/lib/system-verifier';
import { ResponsiveTabs } from '@/components/responsive-tabs';
import { MoneyMakerTab } from '@/components/tabs/money-maker-tab';
import type { Variants } from 'framer-motion';
import { ToolsInfoTab } from '@/components/tabs/tools-info-tab';
import SmartAdaptiveTradingTab from '@/components/tabs/smart-adaptive-trading';
import { DashboardTab } from '@/components/tabs';
import { RiskDisclaimerModal } from '@/components/modals/risk-disclaimer-modal';
import { MarketSelector } from '@/components/market-selector';


import { LiveChat } from '@/components/live-chat';
import { ApiTokenModal } from '@/components/api-token-modal';
import { useDerivAuth } from '@/hooks/use-deriv-auth';

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

export default function DerivAnalysisApp() {
    const [theme, setTheme] = useState<'light' | 'dark'>('dark');
    const [activeTab, setActiveTab] = useState('smart-analysis');
    const [isLoading, setIsLoading] = useState(true);
    const [initError, setInitError] = useState<string | null>(null);
    const [isDisclaimerOpen, setIsDisclaimerOpen] = useState(false);
    const [showRiskModal, setShowRiskModal] = useState(false);

    const [siteConfig, setSiteConfig] = useState<any>(null);
    const [watchedDigits, setWatchedDigits] = useState<number[]>(() => {
        if (typeof window === 'undefined') return [];
        const saved = localStorage.getItem('deriv_watched_digits');
        return saved ? JSON.parse(saved) : [];
    });
    const globalContext = useGlobalTradingContext();
    const { showTokenModal, submitApiToken, loginWithDeriv, loginWithDerivLegacy } = useDerivAuth();

    const itemVariants: Variants = {
        hidden: { y: 15, opacity: 0 },
        visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 100 } },
    };

    const containerVariants: Variants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.08 },
        },
    };

    // Wrapper to ensure OAuth login is properly triggered
    const handleOAuthLogin = () => {
        console.log('[v0] 🔐 Page: Triggering OAuth login...');
        try {
            loginWithDeriv();
        } catch (error) {
            console.error('[v0] ❌ Page: OAuth login error:', error);
        }
    };

    const {
        connectionStatus,
        currentPrice,
        currentDigit,
        tickCount,
        analysis,
        signals,
        proSignals,
        symbol,
        maxTicks,
        availableSymbols,
        connectionLogs,
        changeSymbol,
        changeMaxTicks,
        getRecentDigits,
    } = useDeriv('R_100');

    const toggleTheme = () => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
        if (newTheme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    };

    useEffect(() => {
        try {
            document.documentElement.classList.add('dark');
            console.log('[v0] App initialization started');
            verifier.markComplete('Core System');
            console.log('[v0] App initialization completed successfully');
        } catch (error) {
            console.error('[v0] Initialization error:', error);
            setInitError(error instanceof Error ? error.message : 'Unknown error');
        }

        // Check for risk acceptance
        const accepted = localStorage.getItem('deriv_risk_accepted');
        if (!accepted) {
            setShowRiskModal(true);
        }

        // Fetch site config
        fetch('/api/admin/site-config')
            .then(r => r.json())
            .then(setSiteConfig)
            .catch(console.error);
    }, []);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('deriv_watched_digits', JSON.stringify(watchedDigits));
        }
    }, [watchedDigits]);

    // Defensive filtering to prevent `.toString()` crashes in chart components
    const recent100DigitsRaw = getRecentDigits(100);
    const recent100Digits = recent100DigitsRaw.filter((d: any) => d !== undefined && d !== null);

    const recent50Digits = recent100Digits.length >= 50 ? recent100Digits.slice(-50) : recent100Digits;
    const recent40Digits = recent100Digits.length >= 40 ? recent100Digits.slice(-40) : recent100Digits;
    const recentDigits = recent100Digits.length >= 20 ? recent100Digits.slice(-20) : recent100Digits;

    const activeSignals = (signals || []).filter(s => s.status !== 'NEUTRAL');
    const powerfulSignalsCount = activeSignals.filter(s => s.status === 'TRADE NOW').length;

    if (initError) {
        return (
            <div className='min-h-screen flex items-center justify-center bg-linear-to-br from-red-900 to-red-950'>
                <div className='text-center p-8 bg-red-800/50 rounded-xl border border-red-500 max-w-md'>
                    <h2 className='text-2xl font-bold text-white mb-4'>Initialization Error</h2>
                    <p className='text-red-200 mb-6'>{initError}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className='px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors'
                    >
                        Reload Page
                    </button>
                </div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <LoadingScreen
                onComplete={() => {
                    console.log('[v0] Loading screen completed, showing main app');
                    setIsLoading(false);
                }}
            />
        );
    }

    return (
        <div
            className={`min-h-screen flex flex-col ${theme === 'dark' ? 'bg-linear-to-br from-[#0a0e27] via-[#0f1629] to-[#1a1f3a]' : 'bg-linear-to-br from-gray-50 via-white to-gray-100'}`}
        >
            <Tabs value={activeTab} onValueChange={setActiveTab} className='w-full flex-1 flex flex-col relative'>
                {!siteConfig?.headerHidden && (
                    <header
                        className={`fixed top-0 left-0 right-0 z-[100] shrink-0 w-full transition-all duration-500 border-b ${
                            theme === 'dark' ? 'bg-[#0a0a0a]/95 border-white/8' : 'bg-white/98 border-gray-200'
                        } backdrop-blur-xl`}
                    >
                        <div className='mx-auto w-full px-2 sm:px-6 lg:px-8'>
                            <div className='flex flex-nowrap items-center h-16 sm:h-20 gap-4 sm:gap-6 w-full justify-between overflow-hidden'>
                                {/* Brand Name Only - Clean Modern */}
                                <div className='flex items-center shrink-0 gap-2.5 sm:min-w-[220px]'>
                                    <div
                                        className={`p-2 rounded-xl flex items-center justify-center shrink-0 ${theme === 'dark' ? 'bg-indigo-500/10 text-indigo-400 animate-pulse' : 'bg-indigo-50 text-indigo-600'}`}
                                    >
                                        <Activity className='h-4.5 w-4.5' />
                                    </div>
                                    <div className='flex flex-col leading-none'>
                                        <h1
                                            className={`text-base sm:text-lg font-black tracking-tight uppercase bg-gradient-to-r from-indigo-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent`}
                                        >
                                            analysistoolpro
                                        </h1>
                                        <h2
                                            className={`text-[8px] sm:text-[9px] font-black tracking-[0.25em] opacity-60 uppercase ${theme === 'dark' ? 'text-indigo-300' : 'text-indigo-600'}`}
                                        >
                                            QUANTUM ENGINE
                                        </h2>
                                    </div>
                                </div>

                                <div className='flex-1' />

                                <div className='flex items-center gap-1 sm:gap-2 shrink-0'>
                                    <div className='hidden sm:flex items-center gap-2'>
                                        <Link href='/account'>
                                            <Button
                                                variant='ghost'
                                                size='sm'
                                                className={`h-8 px-3 text-[10px] rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                                                    theme === 'dark'
                                                        ? 'bg-slate-800/50 text-slate-300 border border-slate-700/50 hover:bg-blue-600 hover:text-white'
                                                        : 'bg-gray-100 text-slate-700 hover:bg-blue-500 hover:text-white'
                                                }`}
                                            >
                                                <User className='h-3.5 w-3.5' />
                                                Account
                                            </Button>
                                        </Link>
                                        <Button
                                            variant='ghost'
                                            size='sm'
                                            onClick={() => setShowRiskModal(true)}
                                            className={`h-8 px-3 text-[10px] rounded-lg font-bold flex items-center gap-1 transition-all ${
                                                theme === 'dark'
                                                    ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20'
                                                    : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                                            }`}
                                        >
                                            <AlertTriangle className='h-3.5 w-3.5' />
                                            Risk
                                        </Button>
                                        <LiveChat />
                                        <Button
                                            variant='ghost'
                                            size='icon'
                                            onClick={toggleTheme}
                                            className={`h-8 w-8 rounded-lg transition-all ${
                                                theme === 'dark'
                                                    ? 'bg-white/5 text-yellow-500 hover:bg-white/10'
                                                    : 'bg-black/5 text-slate-700 hover:bg-black/10'
                                            }`}
                                        >
                                            {theme === 'dark' ? (
                                                <Sun className='h-3.5 w-3.5' />
                                            ) : (
                                                <Moon className='h-3.5 w-3.5' />
                                            )}
                                        </Button>
                                    </div>

                                    <DerivAuth theme={theme} />

                                    {/* Unified Hamburger Sheet containing Dashboard and mobile links */}
                                    <div className='flex items-center'>
                                        <Sheet>
                                            <SheetTrigger asChild>
                                                <Button
                                                    variant='ghost'
                                                    size='icon'
                                                    className={`h-9 w-9 rounded-lg transition-all ${
                                                        theme === 'dark'
                                                            ? 'bg-white/5 text-white hover:bg-white/10'
                                                            : 'bg-black/5 text-slate-900 hover:bg-black/10'
                                                    }`}
                                                >
                                                    <Menu className='h-5 w-5' />
                                                </Button>
                                            </SheetTrigger>
                                            <SheetContent
                                                side='right'
                                                className={`w-full sm:max-w-2xl border-l overflow-y-auto ${
                                                    theme === 'dark'
                                                        ? 'bg-[#0b0f19] text-white border-white/10'
                                                        : 'bg-white text-slate-900 border-slate-200'
                                                } p-0`}
                                            >
                                                <div className='p-6 border-b border-white/5 flex items-center justify-between'>
                                                    <SheetTitle
                                                        className={
                                                            theme === 'dark'
                                                                ? 'text-white text-xl font-black uppercase tracking-tight'
                                                                : 'text-slate-900 text-xl font-black uppercase tracking-tight'
                                                        }
                                                    >
                                                        Dashboard Hub
                                                    </SheetTitle>
                                                </div>

                                                {/* Mobile quick actions at the top of the sidebar */}
                                                <div className='sm:hidden flex items-center justify-around gap-2 p-4 border-b border-white/5 bg-slate-950/25'>
                                                    <Link href='/account' className='flex-1'>
                                                        <Button
                                                            variant='outline'
                                                            size='sm'
                                                            className='w-full text-[10px] font-bold h-8'
                                                        >
                                                            <User className='h-3 w-3 mr-1' /> Account
                                                        </Button>
                                                    </Link>
                                                    <Button
                                                        variant='outline'
                                                        size='sm'
                                                        onClick={() => setShowRiskModal(true)}
                                                        className='flex-1 text-[10px] font-bold h-8'
                                                    >
                                                        <AlertTriangle className='h-3 w-3 mr-1' /> Risk
                                                    </Button>
                                                    <Button
                                                        variant='outline'
                                                        size='sm'
                                                        onClick={toggleTheme}
                                                        className='flex-1 text-[10px] font-bold h-8'
                                                    >
                                                        {theme === 'dark' ? (
                                                            <Sun className='h-3 w-3 mr-1' />
                                                        ) : (
                                                            <Moon className='h-3.5 w-3.5 mr-1' />
                                                        )}{' '}
                                                        Theme
                                                    </Button>
                                                </div>
                                            </SheetContent>
                                        </Sheet>
                                    </div>
                                </div>
                            </div>

                            <div className='px-2 sm:px-6 lg:px-8 flex flex-col gap-2 pb-2'>
                                {/* Navigation Tabs - Clean Design */}
                                <div className='flex items-center justify-start w-full overflow-x-auto no-scrollbar -mx-2 sm:-mx-6 lg:-mx-8 px-2 sm:px-6 lg:px-8 py-1'>
                                    <div
                                        className={`inline-flex rounded-2xl border transition-all duration-500 p-1 gap-1.5 ${
                                            theme === 'dark'
                                                ? 'bg-slate-950/45 border-white/5 shadow-inner backdrop-blur-md'
                                                : 'bg-slate-100/80 border-slate-200 shadow-xs backdrop-blur-md'
                                        }`}
                                    >
                                        <div className='overflow-x-auto no-scrollbar flex'>
                                            <ResponsiveTabs
                                                theme={theme}
                                                value={activeTab}
                                                onValueChange={setActiveTab}
                                            >
                                                {[
                                                    'dashboard',
                                                    'smart-adaptive',
                                                    'smart-analysis',
                                                    'smartauto24',
                                                    'money-maker',
                                                    'autobot',
                                                    'automated',
                                                    'signals',
                                                    'pro-signals',
                                                    'super-signals',
                                                    'advanced-signals',
                                                    'even-odd',
                                                    'over-under',
                                                    'advanced-over-under',
                                                    'matches',
                                                    'differs',
                                                    'ai-analysis',
                                                    'tools-info',
                                                ]
                                                    .filter(tab => !siteConfig?.hiddenTabs?.includes(tab))
                                                    .map(tab => {
                                                        const tabLabels: Record<string, string> = {
                                                            dashboard: 'Dashboard',
                                                            'smart-adaptive': 'Smart Adaptive',
                                                            'smart-analysis': 'Smart Analysis',
                                                            smartauto24: 'SmartAuto24',
                                                            'money-maker': 'Money Maker',
                                                            autobot: 'Auto Bot',
                                                            automated: 'Automated',
                                                            signals: 'Signals',
                                                            'pro-signals': 'Pro Signals',
                                                            'super-signals': 'Super Signals',
                                                            'advanced-signals': 'Advanced Signals',
                                                            'even-odd': 'Even/Odd',
                                                            'over-under': 'Over/Under',
                                                            'advanced-over-under': 'Advanced Over/Under',
                                                            matches: 'Matches',
                                                            differs: 'Differs',
                                                            'ai-analysis': 'AI Analysis',
                                                            'tools-info': 'Tools Info',
                                                        };
                                                        const tabIcons: Record<string, any> = {
                                                            dashboard: LayoutDashboard,
                                                            'smart-adaptive': Sliders,
                                                            'smart-analysis': LineChart,
                                                            smartauto24: Sparkles,
                                                            'money-maker': TrendingUp,
                                                            autobot: Cpu,
                                                            automated: Terminal,
                                                            signals: Radio,
                                                            'pro-signals': TrendingUp,
                                                            'super-signals': Flame,
                                                            'advanced-signals': Activity,
                                                            'even-odd': Hash,
                                                            'over-under': ArrowUpDown,
                                                            'advanced-over-under': Percent,
                                                            matches: CheckSquare,
                                                            differs: XCircle,
                                                            'ai-analysis': BrainCircuit,
                                                            'tools-info': HelpCircle,
                                                        };
                                                        const IconComponent = tabIcons[tab];
                                                        return (
                                                            <TabsTrigger
                                                                key={tab}
                                                                value={tab}
                                                                className={`shrink-0 rounded-xl text-[10px] sm:text-xs h-9 px-3.5 sm:px-4.5 whitespace-nowrap transition-all duration-300 font-bold flex items-center gap-1.5 border-0 ${
                                                                    activeTab === tab
                                                                        ? theme === 'dark'
                                                                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                                                                            : 'bg-indigo-600 text-white shadow-md shadow-indigo-500/10'
                                                                        : theme === 'dark'
                                                                          ? 'text-slate-400 hover:text-white hover:bg-white/5'
                                                                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                                                                }`}
                                                                onClick={e => {
                                                                    e.currentTarget.scrollIntoView({
                                                                        behavior: 'smooth',
                                                                        block: 'nearest',
                                                                        inline: 'center',
                                                                    });
                                                                }}
                                                            >
                                                                {IconComponent && (
                                                                    <IconComponent className='h-3.5 w-3.5 shrink-0' />
                                                                )}
                                                                <span>{tabLabels[tab] || tab}</span>
                                                            </TabsTrigger>
                                                        );
                                                    })}
                                            </ResponsiveTabs>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 2. Balanced HUD Row - Dashboard Grid Style */}
                            <div className='flex items-center justify-center w-full px-1'>
                                <div
                                    className={`p-0.5 sm:p-1 rounded-xl sm:rounded-2xl border ${theme === 'dark' ? 'bg-[#050505]/60 border-white/5 shadow-2xl' : 'bg-white/50 border-gray-100 shadow-xl'} backdrop-blur-2xl w-full sm:w-auto`}
                                >
                                    <div className='flex flex-nowrap items-center justify-center gap-0.5 sm:gap-2.5 overflow-x-auto no-scrollbar py-0.5 px-0.5'>
                                        {/* 1. Market Selection Tile */}
                                        {availableSymbols.length > 0 && (
                                            <div
                                                className={`flex flex-col items-center justify-center min-w-[110px] sm:min-w-[170px] h-9 sm:h-11 rounded-lg sm:rounded-xl border transition-all ${
                                                    theme === 'dark'
                                                        ? 'bg-white/[0.03] border-white/10 shadow-inner'
                                                        : 'bg-gray-50 border-gray-200 shadow-xs'
                                                }`}
                                            >
                                                <span
                                                    className={`text-[7px] sm:text-[8px] font-bold uppercase tracking-[0.18em] mb-0 opacity-70 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}
                                                >
                                                    Market Selection
                                                </span>
                                                <div className='w-full flex items-center justify-center scale-[0.85] sm:scale-100 origin-center -mt-0.5 sm:mt-0'>
                                                    <MarketSelector
                                                        symbols={availableSymbols}
                                                        currentSymbol={symbol}
                                                        onSymbolChange={changeSymbol}
                                                        theme={theme}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {/* 2. Price Tile */}
                                        <div
                                            className={`flex flex-col items-center justify-center min-w-[75px] sm:min-w-[140px] h-9 sm:h-11 rounded-lg sm:rounded-xl border ${
                                                theme === 'dark'
                                                    ? 'bg-white/[0.03] border-white/10 shadow-inner'
                                                    : 'bg-gray-50 border-gray-200 shadow-xs'
                                            }`}
                                        >
                                            <span
                                                className={`text-[7px] sm:text-[8px] font-bold uppercase tracking-[0.18em] mb-0 opacity-70 ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'}`}
                                            >
                                                Price
                                            </span>
                                            <span
                                                className={`text-[11px] sm:text-[16px] font-black tabular-nums leading-none ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'}`}
                                            >
                                                {currentPrice?.toFixed(5) || '0.00000'}
                                            </span>
                                        </div>

                                        {/* 3. Last Digit Tile */}
                                        <div
                                            className={`flex flex-col items-center justify-center min-w-[55px] sm:min-w-[110px] h-9 sm:h-11 rounded-lg sm:rounded-xl border relative overflow-hidden transition-all duration-300 ${
                                                theme === 'dark'
                                                    ? 'bg-orange-500/[0.08] border-orange-500/30 shadow-[0_0_15px_rgba(249,115,22,0.12)]'
                                                    : 'bg-orange-50 border-orange-200'
                                            }`}
                                        >
                                            <div className='absolute inset-0 bg-gradient-to-t from-orange-500/[0.05] to-transparent animate-pulse pointer-events-none' />
                                            <span
                                                className={`text-[7px] sm:text-[8px] font-bold uppercase tracking-[0.18em] mb-0 relative z-10 opacity-70 ${theme === 'dark' ? 'text-orange-400' : 'text-orange-600'}`}
                                            >
                                                Last Digit
                                            </span>
                                            <span
                                                className={`text-[15px] sm:text-[22px] font-black relative z-10 leading-none ${theme === 'dark' ? 'text-orange-400' : 'text-orange-600'}`}
                                            >
                                                {currentDigit ?? '0'}
                                            </span>
                                        </div>

                                        {/* 4. Ticks Tile */}
                                        <div
                                            className={`flex flex-col items-center justify-center min-w-[75px] sm:min-w-[140px] h-9 sm:h-11 rounded-lg sm:rounded-xl border ${
                                                theme === 'dark'
                                                    ? 'bg-white/[0.03] border-white/10 shadow-inner'
                                                    : 'bg-gray-50 border-gray-200 shadow-xs'
                                            }`}
                                        >
                                            <span
                                                className={`text-[7px] sm:text-[8px] font-bold uppercase tracking-[0.18em] mb-0 opacity-70 ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}
                                            >
                                                Ticks
                                            </span>
                                            <div className='flex items-center gap-1 sm:gap-1.5 h-4 sm:h-5'>
                                                <span
                                                    className={`text-[11px] sm:text-[15px] font-black tabular-nums tracking-tight ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}
                                                >
                                                    {(tickCount || 0).toLocaleString()}
                                                </span>
                                                <div
                                                    className={`h-3 w-px ${theme === 'dark' ? 'bg-white/20' : 'bg-gray-300'}`}
                                                />
                                                <select
                                                    value={maxTicks}
                                                    onChange={e => changeMaxTicks(Number(e.target.value))}
                                                    className={`bg-transparent text-[9px] sm:text-[11px] font-black focus:outline-hidden cursor-pointer appearance-none ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}
                                                >
                                                    {[25, 60, 100, 250, 500, 1000, 2500, 5000].map(v => (
                                                        <option
                                                            key={v}
                                                            value={v}
                                                            className={
                                                                theme === 'dark'
                                                                    ? 'bg-slate-900 text-white'
                                                                    : 'bg-white text-slate-900'
                                                            }
                                                        >
                                                            {v}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        {/* 5. Watch Tile - Optimized Ultra-Compact */}
                                        <div
                                            className={`flex flex-col items-center justify-center min-w-[45px] sm:min-w-[80px] h-9 sm:h-11 rounded-lg sm:rounded-xl border transition-all ${
                                                theme === 'dark'
                                                    ? 'bg-white/[0.03] border-white/10 hover:border-amber-500/50 shadow-inner'
                                                    : 'bg-gray-50 border-gray-200 shadow-xs'
                                            }`}
                                        >
                                            <span
                                                className={`text-[7px] sm:text-[8px] font-bold uppercase tracking-[0.18em] mb-0 opacity-70 ${theme === 'dark' ? 'text-amber-400' : 'text-amber-600'}`}
                                            >
                                                Watch
                                            </span>
                                            <div className='flex items-center gap-1 px-1 w-full justify-center'>
                                                <Eye className='h-2.5 w-2.5 sm:h-3.5 sm:w-3.5 text-amber-500 shrink-0' />
                                                <input
                                                    type='text'
                                                    placeholder='D'
                                                    className={`bg-transparent text-[9px] sm:text-[11px] font-black w-[15px] sm:w-[30px] focus:outline-hidden text-center placeholder:text-slate-600 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}
                                                    value={watchedDigits.join(',')}
                                                    onChange={e => {
                                                        const val = e.target.value;
                                                        const digits = val
                                                            .split(',')
                                                            .map(d => parseInt(d.trim()))
                                                            .filter(d => !isNaN(d) && d >= 0 && d <= 9);
                                                        setWatchedDigits([...new Set(digits)]);
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </header>
                )}

                <main className='flex-1 pt-[180px] sm:pt-[240px] pb-4 px-1 sm:px-4 space-y-2 sm:space-y-4 max-w-7xl mx-auto w-full'>
                    {connectionStatus === 'disconnected' && tickCount === 0 ? (
                        <div className='text-center py-12 sm:py-20 md:py-32'>
                            <h2
                                className={`text-xl sm:text-2xl md:text-3xl font-bold mb-2 sm:mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                            >
                                Connection Failed
                            </h2>
                            <p
                                className={`text-sm sm:text-base md:text-lg ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                            >
                                Unable to connect to Deriv. Please check your internet connection and refresh the page.
                            </p>
                            <Button
                                onClick={() => window.location.reload()}
                                className='mt-6 bg-green-500 hover:bg-green-600 text-white font-bold'
                            >
                                Retry Connection
                            </Button>
                        </div>
                    ) : (
                        <>
                            {connectionStatus === 'reconnecting' && (
                                <div className='absolute top-0 left-0 right-0 z-50 bg-yellow-500/20 backdrop-blur-md p-2 text-center text-xs font-bold text-yellow-500 border-b border-yellow-500/30 animate-pulse'>
                                    Reconnecting to Deriv API... Some data may be delayed.
                                </div>
                            )}
                            <TabsContent value='dashboard' className='mt-0'>
                                <DashboardTab theme={theme} />
                            </TabsContent>

                            <TabsContent value='smart-analysis' className='mt-0 space-y-2 sm:space-y-3 md:space-y-4'>
                                <div
                                    className={`rounded-lg sm:rounded-xl p-2 sm:p-3 border flex items-center justify-between ${theme === 'dark' ? 'bg-linear-to-br from-[#0f1629]/80 to-[#1a2235]/80 border-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.2)]' : 'bg-white border-gray-200 shadow-lg'}`}
                                >
                                    <div className='flex items-center gap-2'>
                                        <div
                                            className={`h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse`}
                                        />
                                        <span
                                            className={`text-[10px] font-bold uppercase ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}
                                        >
                                            Market Live
                                        </span>
                                    </div>
                                </div>

                                {analysis && analysis.digitFrequencies && (
                                    <div
                                        className={`rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-6 border ${theme === 'dark' ? 'bg-linear-to-br from-[#0f1629]/80 to-[#1a2235]/80 border-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.2)]' : 'bg-white border-gray-200 shadow-lg'}`}
                                    >
                                        <div className='flex flex-col sm:flex-row items-center justify-between mb-4 sm:mb-6 gap-3'>
                                            <h3
                                                className={`text-sm sm:text-lg md:text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                                            >
                                                Digits Distribution
                                            </h3>
                                        </div>

                                        <DigitDistribution
                                            frequencies={analysis.digitFrequencies}
                                            currentDigit={currentDigit}
                                            theme={theme}
                                            watchedDigits={watchedDigits}
                                        />
                                    </div>
                                )}

                                {analysis && recent100Digits.length > 0 && recentDigits.length > 0 && (
                                    <div className='grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 md:gap-4'>
                                        <div
                                            className={`rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-4 border ${theme === 'dark' ? 'bg-linear-to-br from-[#0f1629]/80 to-[#1a2235]/80 border-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.2)]' : 'bg-white border-gray-200 shadow-lg'}`}
                                        >
                                            <h3
                                                className={`text-sm sm:text-base md:text-lg font-bold mb-3 sm:mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                                            >
                                                Last Digits Line Chart
                                            </h3>
                                            <LastDigitsLineChart digits={recentDigits.slice(-10)} />
                                        </div>

                                        <div
                                            className={`rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-4 border ${theme === 'dark' ? 'bg-linear-to-br from-[#0f1629]/80 to-[#1a2235]/80 border-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.2)]' : 'bg-white border-gray-200 shadow-lg'}`}
                                        >
                                            <h3
                                                className={`text-sm sm:text-base md:text-lg font-bold mb-3 sm:mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                                            >
                                                Last 50 Digits Chart
                                            </h3>
                                            <LastDigitsChart digits={recent50Digits} />
                                        </div>
                                    </div>
                                )}

                                {analysis && recent100Digits.length > 0 && (
                                    <div
                                        className={`rounded-lg sm:rounded-xl p-6 border ${theme === 'dark' ? 'bg-linear-to-br from-[#0f1629]/80 to-[#1a2235]/80 border-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.2)]' : 'bg-white border-gray-200 shadow-lg'}`}
                                    >
                                        <StatisticalAnalysis
                                            analysis={analysis}
                                            recentDigits={recent100Digits}
                                            theme={theme}
                                        />
                                    </div>
                                )}

                                {analysis && analysis.digitFrequencies && analysis.powerIndex && (
                                    <div
                                        className={`rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-6 border ${theme === 'dark' ? 'bg-linear-to-br from-green-500/10 to-green-500/10 border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.2)]' : 'bg-green-50 border-green-200 shadow-lg'}`}
                                    >
                                        <h3
                                            className={`text-sm sm:text-base md:text-lg font-bold mb-3 sm:mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                                        >
                                            Frequency Analysis
                                        </h3>
                                        <div className='grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4'>
                                            <div
                                                className={`text-center rounded-lg p-2 sm:p-3 md:p-4 border ${theme === 'dark' ? 'bg-blue-500/10' : 'bg-blue-50'}`}
                                            >
                                                <div
                                                    className={`text-xs sm:text-sm mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                                                >
                                                    Most Frequent
                                                </div>
                                                <div
                                                    className={`text-xl sm:text-2xl md:text-3xl font-bold ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}
                                                >
                                                    {analysis.powerIndex.strongest}
                                                </div>
                                                <div
                                                    className={`mt-1 text-xs sm:text-sm md:text-base font-bold ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}
                                                >
                                                    {analysis.digitFrequencies[
                                                        analysis.powerIndex.strongest
                                                    ]?.percentage.toFixed(1)}
                                                    %
                                                </div>
                                            </div>
                                            <div
                                                className={`text-center rounded-lg p-2 sm:p-3 md:p-4 border ${theme === 'dark' ? 'bg-red-500/10' : 'bg-red-50'}`}
                                            >
                                                <div
                                                    className={`text-xs sm:text-sm mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                                                >
                                                    Least Frequent
                                                </div>
                                                <div
                                                    className={`text-xl sm:text-2xl md:text-3xl font-bold ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}
                                                >
                                                    {analysis.powerIndex.weakest}
                                                </div>
                                                <div
                                                    className={`mt-1 text-xs sm:text-sm md:text-base font-bold ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}
                                                >
                                                    {analysis.digitFrequencies[
                                                        analysis.powerIndex.weakest
                                                    ]?.percentage.toFixed(1)}
                                                    %
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value='signals' className='mt-0'>
                                {analysis && (
                                    <SignalsTab
                                        signals={signals}
                                        proSignals={proSignals}
                                        analysis={analysis}
                                        theme={theme}
                                        symbol={symbol}
                                        currentPrice={currentPrice}
                                        currentDigit={currentDigit}
                                        tickCount={tickCount}
                                        maxTicks={maxTicks}
                                        onMaxTicksChange={changeMaxTicks}
                                    />
                                )}
                            </TabsContent>

                            <TabsContent value='pro-signals' className='mt-0'>
                                {analysis && (
                                    <ProSignalsTab
                                        proSignals={proSignals}
                                        analysis={analysis}
                                        theme={theme}
                                        symbol={symbol}
                                        currentPrice={currentPrice}
                                        currentDigit={currentDigit}
                                        tickCount={tickCount}
                                        maxTicks={maxTicks}
                                        onMaxTicksChange={changeMaxTicks}
                                    />
                                )}
                            </TabsContent>

                            <TabsContent value='super-signals' className='mt-0'>
                                {analysis && (
                                    <HeritageSuperSignals
                                        theme={theme}
                                        symbol={symbol}
                                        availableSymbols={availableSymbols}
                                        maxTicks={maxTicks}
                                        analysis={analysis}
                                        recentDigits={recentDigits}
                                        tickCount={tickCount}
                                    />
                                )}
                            </TabsContent>

                            <TabsContent value='advanced-signals' className='mt-0'>
                                <AdvancedSignalsTab theme={theme} availableSymbols={availableSymbols} />
                            </TabsContent>

                            <TabsContent value='even-odd' className='mt-0'>
                                {analysis && (
                                    <EvenOddTab
                                        analysis={analysis}
                                        signals={signals}
                                        currentDigit={currentDigit}
                                        currentPrice={currentPrice}
                                        recentDigits={recent40Digits}
                                        theme={theme}
                                        symbol={symbol}
                                        availableSymbols={availableSymbols}
                                        onSymbolChange={changeSymbol}
                                        tickCount={tickCount}
                                    />
                                )}
                            </TabsContent>

                            <TabsContent value='over-under' className='mt-0'>
                                {analysis && (
                                    <OverUnderTab
                                        analysis={analysis}
                                        signals={signals}
                                        currentDigit={currentDigit}
                                        currentPrice={currentPrice}
                                        recentDigits={recent50Digits}
                                        theme={theme}
                                        symbol={symbol}
                                        availableSymbols={availableSymbols}
                                        onSymbolChange={changeSymbol}
                                        tickCount={tickCount}
                                    />
                                )}
                            </TabsContent>

                            <TabsContent value='advanced-over-under' className='mt-0'>
                                {analysis && (
                                    <MoneyMakerTab theme={theme} recentDigits={recent50Digits} symbol={symbol} />
                                )}
                            </TabsContent>

                            <TabsContent value='matches' className='mt-0'>
                                {analysis && (
                                    <MatchesTab
                                        analysis={analysis}
                                        signals={signals}
                                        recentDigits={recentDigits}
                                        theme={theme}
                                        symbol={symbol}
                                        currentPrice={currentPrice}
                                        currentDigit={currentDigit}
                                        tickCount={tickCount}
                                        maxTicks={maxTicks}
                                        onMaxTicksChange={changeMaxTicks}
                                    />
                                )}
                            </TabsContent>

                            <TabsContent value='differs' className='mt-0'>
                                {analysis && (
                                    <DiffersTab
                                        analysis={analysis}
                                        signals={signals}
                                        recentDigits={recentDigits}
                                        theme={theme}
                                        symbol={symbol}
                                        currentPrice={currentPrice}
                                        currentDigit={currentDigit}
                                        tickCount={tickCount}
                                        maxTicks={maxTicks}
                                        onMaxTicksChange={changeMaxTicks}
                                    />
                                )}
                            </TabsContent>

                            <TabsContent value='ai-analysis' className='mt-0'>
                                {analysis && (
                                    <AIAnalysisTab
                                        analysis={analysis}
                                        currentDigit={currentDigit}
                                        currentPrice={currentPrice}
                                        symbol={symbol}
                                        theme={theme}
                                        availableSymbols={availableSymbols}
                                        onSymbolChange={changeSymbol}
                                    />
                                )}
                            </TabsContent>

                            <TabsContent value='autobot' className='mt-0'>
                                <AutoBotTab theme={theme} symbol={symbol} />
                            </TabsContent>

                            <TabsContent value='automated' className='mt-0'>
                                <AutomatedTab theme={theme} symbol={symbol} />
                            </TabsContent>

                            <TabsContent value='smartauto24' className='mt-0'>
                                <SmartAuto24Tab
                                    theme={theme}
                                    symbol={symbol}
                                    onSymbolChange={changeSymbol}
                                    availableSymbols={availableSymbols}
                                    maxTicks={maxTicks}
                                    onMaxTicksChange={changeMaxTicks}
                                />
                            </TabsContent>

                            <TabsContent value='money-maker' className='mt-0'>
                                <MoneyMakerTab
                                    theme={theme}
                                    symbol={symbol}
                                    onSymbolChange={changeSymbol}
                                    availableSymbols={availableSymbols}
                                    recentDigits={recent100Digits}
                                />
                            </TabsContent>

                            <TabsContent value='smart-adaptive' className='mt-0'>
                                {analysis && (
                                    <SmartAdaptiveTradingTab
                                        signals={signals}
                                        analysis={analysis}
                                        symbol={symbol}
                                        theme={theme}
                                        currentPrice={currentPrice}
                                        currentDigit={currentDigit}
                                        tickCount={tickCount}
                                    />
                                )}
                            </TabsContent>

                            <TabsContent value='tools-info' className='mt-0'>
                                <ToolsInfoTab theme={theme} connectionLogs={connectionLogs} />
                            </TabsContent>
                        </>
                    )}
                </main>
            </Tabs>

            {!siteConfig?.footerHidden && (
                <footer
                    className={`mt-4 py-3 transition-all duration-300 border-t ${
                        theme === 'dark' ? 'bg-[#0a0a0a] border-white/8' : 'bg-gray-50 border-gray-200'
                    }`}
                >
                    <div className='mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8'>
                        <div
                            className={`flex flex-col sm:flex-row items-center justify-between gap-3 text-[10px] sm:text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}
                        >
                            <div className='flex flex-wrap items-center gap-4'>
                                <span className='font-bold text-slate-800 dark:text-gray-400'>
                                    analysistoolpro © 2026
                                </span>
                                <button
                                    onClick={() => setIsDisclaimerOpen(true)}
                                    className='hover:text-blue-500 transition-colors'
                                >
                                    Risk Disclaimer
                                </button>
                            </div>
                        </div>
                    </div>
                </footer>
            )}

            {/* Unified Risk Disclaimer Modal */}
            <RiskDisclaimerModal
                isOpen={isDisclaimerOpen || showRiskModal}
                onClose={() => {
                    setIsDisclaimerOpen(false);
                    setShowRiskModal(false);
                }}
                onAccept={() => {
                    localStorage.setItem('deriv_risk_accepted', 'true');
                    setIsDisclaimerOpen(false);
                    setShowRiskModal(false);
                }}
                theme={theme}
            />



            {/* API Token Modal */}
            <ApiTokenModal
                open={showTokenModal}
                onSubmit={submitApiToken}
                onOAuthLogin={handleOAuthLogin}
                onLegacyOAuthLogin={loginWithDerivLegacy}
                theme={theme}
            />
        </div>
    );
}
