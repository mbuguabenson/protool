'use client';

import React from 'react';
import { TabsList } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ResponsiveTabsProps {
    children: React.ReactNode;
    theme?: 'light' | 'dark';
    value?: string;
    onValueChange?: (value: string) => void;
}

export function ResponsiveTabs({ children, theme = 'dark', value, onValueChange }: ResponsiveTabsProps) {
    const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
    const [internalSelectedTab, setInternalSelectedTab] = React.useState<string>('smart-analysis');

    // Use controlled value if provided, otherwise fallback to internal state
    const selectedTab = value !== undefined ? value : internalSelectedTab;
    const setSelectedTab = onValueChange !== undefined ? onValueChange : setInternalSelectedTab;

    const tabsListRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        // Only need observer if we're not fully controlled and want to sync with DOM state
        if (value !== undefined) return;

        const updateActiveTab = () => {
            const context = tabsListRef.current || document;
            const activeTrigger = context.querySelector('[role="tab"][data-state="active"]');
            if (activeTrigger) {
                const tabValue = activeTrigger.getAttribute('data-value') || activeTrigger.getAttribute('value');
                if (tabValue && tabValue !== selectedTab) {
                    setSelectedTab(tabValue);
                }
            }
        };

        updateActiveTab();

        const tabsList = tabsListRef.current;
        if (tabsList) {
            const observer = new MutationObserver(updateActiveTab);
            observer.observe(tabsList, {
                attributes: true,
                subtree: true,
                attributeFilter: ['data-state'],
            });
            return () => observer.disconnect();
        }
    }, [selectedTab, value, setSelectedTab]);

    const handleTabClick = (tabValue: string) => {
        console.log('[v0] Dropdown tab selected:', tabValue);
        setSelectedTab(tabValue);
        setIsDropdownOpen(false);

        // For controlled state, the click isn't strictly necessary as the parent will update
        // But we still do it to ensure any standard Radix behaviors are triggered
        const context = tabsListRef.current || document;
        const tabTrigger = (context.querySelector(`[role="tab"][data-value="${tabValue}"]`) ||
            context.querySelector(`[role="tab"][value="${tabValue}"]`)) as HTMLElement;

        if (tabTrigger) {
            console.log('[v0] Clicking tab trigger for:', tabValue);
            tabTrigger.click();
        } else {
            // Final attempt: fallback to standard button with data-value
            const fallbackTrigger = document.querySelector(`button[data-value="${tabValue}"]`) as HTMLElement;
            if (fallbackTrigger) {
                fallbackTrigger.click();
            }
        }
    };

    const getTabLabel = (value: string) => {
        const child = React.Children.toArray(children).find(
            c => React.isValidElement(c) && (c.props as any).value === value
        );
        if (React.isValidElement(child)) {
            return (child.props as any).children || value.replace(/-/g, ' ');
        }
        return value.replace(/-/g, ' ');
    };

    const scroll = (direction: 'left' | 'right') => {
        if (tabsListRef.current) {
            const scrollAmount = 300;
            tabsListRef.current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth',
            });
        }
    };

    return (
        <div className='relative flex items-center w-full group'>
            {/* Desktop Scroll Left Button */}
            <div
                className={`absolute left-0 z-10 hidden sm:flex items-center h-full pr-8 bg-gradient-to-r from-background to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${theme === 'dark' ? 'from-[#050505]' : 'from-white'}`}
            >
                <Button
                    variant='outline'
                    size='icon'
                    onClick={() => scroll('left')}
                    className={`h-8 w-8 rounded-full shadow-lg border absolute -left-2 ${theme === 'dark' ? 'bg-[#0f1629] border-white/10 text-white hover:bg-[#1a1f3a]' : 'bg-white border-gray-200 text-slate-700 hover:bg-gray-50'}`}
                >
                    <ChevronLeft className='h-4 w-4' />
                </Button>
            </div>

            <TabsList
                ref={tabsListRef}
                className='flex w-full justify-start bg-transparent border-0 h-auto p-1 overflow-x-auto flex-nowrap [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] scroll-smooth'
            >
                {children}
            </TabsList>

            {/* Desktop Scroll Right Button */}
            <div
                className={`absolute right-0 z-10 hidden sm:flex justify-end items-center h-full pl-8 bg-gradient-to-l from-background to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${theme === 'dark' ? 'from-[#050505]' : 'from-white'}`}
            >
                <Button
                    variant='outline'
                    size='icon'
                    onClick={() => scroll('right')}
                    className={`h-8 w-8 rounded-full shadow-lg border absolute -right-2 ${theme === 'dark' ? 'bg-[#0f1629] border-white/10 text-white hover:bg-[#1a1f3a]' : 'bg-white border-gray-200 text-slate-700 hover:bg-gray-50'}`}
                >
                    <ChevronRight className='h-4 w-4' />
                </Button>
            </div>
        </div>
    );
}
