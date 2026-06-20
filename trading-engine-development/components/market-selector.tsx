'use client';

import { useState, useMemo } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { DerivSymbol } from '@/hooks/use-deriv';

interface MarketSelectorProps {
    symbols: DerivSymbol[];
    currentSymbol: string;
    onSymbolChange: (symbol: string) => void;
    theme?: 'light' | 'dark';
}

export function MarketSelector({ symbols, currentSymbol, onSymbolChange, theme = 'dark' }: MarketSelectorProps) {
    const [open, setOpen] = useState(false);

    const groupedSymbols = useMemo(() => {
        const volatilityIndices: DerivSymbol[] = [];
        const jumpIndices: DerivSymbol[] = [];
        const boomCrashIndices: DerivSymbol[] = [];
        const stepIndices: DerivSymbol[] = [];
        const otherSymbols: DerivSymbol[] = [];

        symbols.forEach(symbol => {
            const sym = symbol.symbol.toUpperCase();
            const name = (symbol.display_name || '').toUpperCase();

            if (sym.includes('BOOM') || sym.includes('CRASH')) {
                boomCrashIndices.push(symbol);
            } else if (sym.includes('STEP') || name.includes('STEP')) {
                stepIndices.push(symbol);
            } else if (sym.includes('R_') || sym.includes('1HZ') || name.includes('VOLATILITY')) {
                volatilityIndices.push(symbol);
            } else if (sym.includes('JUMP') || name.includes('JUMP')) {
                jumpIndices.push(symbol);
            } else {
                otherSymbols.push(symbol);
            }
        });

        const sortFn = (a: DerivSymbol, b: DerivSymbol) => {
            const aNum = Number.parseInt(a.symbol.match(/\d+/)?.[0] || '0');
            const bNum = Number.parseInt(b.symbol.match(/\d+/)?.[0] || '0');
            if (aNum !== bNum) return aNum - bNum;
            return a.display_name.localeCompare(b.display_name);
        };

        volatilityIndices.sort(sortFn);
        jumpIndices.sort(sortFn);
        boomCrashIndices.sort(sortFn);
        stepIndices.sort(sortFn);

        const groups: Record<string, DerivSymbol[]> = {};
        otherSymbols.forEach(symbol => {
            const market = symbol.market_display_name || symbol.market || 'Other';
            if (!groups[market]) {
                groups[market] = [];
            }
            groups[market].push(symbol);
        });

        const sortedGroups: Record<string, DerivSymbol[]> = {};

        if (volatilityIndices.length > 0) {
            sortedGroups['Volatility Indices'] = volatilityIndices;
        }
        if (jumpIndices.length > 0) {
            sortedGroups['Jump Indices'] = jumpIndices;
        }
        if (boomCrashIndices.length > 0) {
            sortedGroups['Boom/Crash Indices'] = boomCrashIndices;
        }
        if (stepIndices.length > 0) {
            sortedGroups['Step Indices'] = stepIndices;
        }

        Object.keys(groups)
            .sort()
            .forEach(market => {
                // Sort items within other groups too
                sortedGroups[market] = groups[market].sort((a, b) => a.display_name.localeCompare(b.display_name));
            });

        return sortedGroups;
    }, [symbols]);

    const currentSymbolData = symbols.find(s => s.symbol === currentSymbol);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant='outline'
                    role='combobox'
                    aria-expanded={open}
                    className={`w-full min-w-0 h-full py-1 sm:py-2 px-1.5 sm:px-3 rounded-lg sm:rounded-xl flex items-center justify-between transition-all duration-300 overflow-hidden border-none shadow-none bg-transparent hover:bg-white/5 text-white ring-0 focus-visible:ring-0`}
                >
                    <span className='truncate w-full text-center sm:text-left font-black text-[10px] sm:text-sm tracking-tight leading-none uppercase'>
                        {currentSymbolData?.display_name || currentSymbol}
                    </span>
                    <ChevronDown className='ml-0.5 sm:ml-1 h-3 w-3 sm:h-4 sm:w-4 shrink-0 opacity-50 group-hover:opacity-100 transition-opacity' />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className={`w-[260px] p-0 max-h-[450px] overflow-y-auto ${
                    theme === 'dark' ? 'bg-[#0a0e27] border-blue-500/30' : 'bg-white border-gray-300'
                }`}
            >
                <Command className={theme === 'dark' ? 'bg-[#0a0e27]' : 'bg-white'}>
                    <CommandInput
                        placeholder='Search markets...'
                        className={theme === 'dark' ? 'text-white' : 'text-gray-900'}
                    />
                    <CommandList>
                        <CommandEmpty
                            className={`py-6 text-center ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                        >
                            No market found.
                        </CommandEmpty>
                        {Object.entries(groupedSymbols).map(([market, marketSymbols]) => (
                            <CommandGroup
                                key={market}
                                heading={market}
                                className={
                                    theme === 'dark' ? 'text-blue-400 font-semibold' : 'text-blue-600 font-semibold'
                                }
                            >
                                {marketSymbols.map(symbol => (
                                    <CommandItem
                                        key={symbol.symbol}
                                        value={symbol.symbol}
                                        onSelect={() => {
                                            onSymbolChange(symbol.symbol);
                                            setOpen(false);
                                        }}
                                        className={
                                            theme === 'dark'
                                                ? 'text-white hover:bg-blue-500/20 cursor-pointer'
                                                : 'text-gray-900 hover:bg-blue-50 cursor-pointer'
                                        }
                                    >
                                        <Check
                                            className={`mr-2 h-4 w-4 ${
                                                currentSymbol === symbol.symbol
                                                    ? 'opacity-100 text-green-400'
                                                    : 'opacity-0'
                                            }`}
                                        />
                                        {symbol.display_name}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        ))}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
