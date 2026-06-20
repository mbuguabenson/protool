// components/ActiveSymbols.tsx
'use client';

import React, { useEffect, useState } from 'react';

interface SymbolInfo {
    display_name: string;
    symbol: string;
    market: string;
    submarket: string;
    // add other fields you may need
}

export default function ActiveSymbols() {
    const [symbols, setSymbols] = useState<SymbolInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Deriv API endpoint for active symbols
        const url = 'https://developers.deriv.com/docs/data/active-symbols/';
        fetch(url)
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then(data => {
                // The API returns an object with a `active_symbols` array
                // Guard against unexpected shapes
                const list: SymbolInfo[] = data?.active_symbols ?? [];
                setSymbols(list);
                setLoading(false);
            })
            .catch(err => {
                console.error('Failed to load active symbols', err);
                setError(err.message);
                setLoading(false);
            });
    }, []);

    if (loading) {
        return <div className='mt-6 text-sm text-gray-400'>Loading active symbols…</div>;
    }
    if (error) {
        return <div className='mt-6 text-sm text-red-400'>Error: {error}</div>;
    }

    return (
        <div className='mt-6'>
            <h2 className='mb-3 text-lg font-semibold text-gray-200'>Active Symbols</h2>
            <ul className='max-h-48 overflow-y-auto space-y-1 text-sm text-gray-300'>
                {symbols.slice(0, 20).map(sym => (
                    <li key={sym.symbol}>
                        <span className='font-medium'>{sym.display_name}</span>
                        <span className='ml-2 text-gray-500'>({sym.symbol})</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
