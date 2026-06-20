'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'auto';

interface ThemeContextType {
    theme: Theme;
    currentTheme: 'light' | 'dark';
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within ThemeProvider');
    }
    return context;
};

interface ThemeProviderProps {
    children: React.ReactNode;
    defaultTheme?: Theme;
    storageKey?: string;
}

export const ThemeProviderAdvanced: React.FC<ThemeProviderProps> = ({
    children,
    defaultTheme = 'auto',
    storageKey = 'app-theme',
}) => {
    const [theme, setThemeState] = useState<Theme>(defaultTheme);
    const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>('dark');
    const [mounted, setMounted] = useState(false);

    // Determine actual theme based on preference
    const determineTheme = (selectedTheme: Theme): 'light' | 'dark' => {
        if (typeof window !== 'undefined' && selectedTheme === 'auto') {
            return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        return selectedTheme === 'light' ? 'light' : 'dark';
    };

    // Initialize theme on mount
    useEffect(() => {
        setMounted(true);

        if (typeof window === 'undefined') return;

        // Get stored theme preference
        const stored = localStorage.getItem(storageKey) as Theme | null;
        const initialTheme = stored || defaultTheme;

        setThemeState(initialTheme);
        const actual = determineTheme(initialTheme);
        setCurrentTheme(actual);
        applyTheme(actual);

        // Listen for system preference changes
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = () => {
            if (theme === 'auto') {
                const newActual = determineTheme('auto');
                setCurrentTheme(newActual);
                applyTheme(newActual);
            }
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    const applyTheme = (themeToApply: 'light' | 'dark') => {
        if (typeof document === 'undefined') return;
        const root = document.documentElement;

        // Remove existing theme classes
        root.classList.remove('light', 'dark');

        // Add new theme class
        root.classList.add(themeToApply);

        // Update CSS variables for glow intensity
        if (themeToApply === 'light') {
            root.style.setProperty('--glow-intensity', '0.3');
        } else {
            root.style.setProperty('--glow-intensity', '0.6');
        }

        // Update data attribute for CSS selectors
        root.setAttribute('data-theme', themeToApply);
    };

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme);
        if (typeof window !== 'undefined') {
            localStorage.setItem(storageKey, newTheme);
        }

        const actual = determineTheme(newTheme);
        setCurrentTheme(actual);
        applyTheme(actual);
    };

    const toggleTheme = () => {
        setTheme(currentTheme === 'dark' ? 'light' : 'dark');
    };

    return (
        <ThemeContext.Provider value={{ theme, currentTheme, setTheme, toggleTheme }}>
            <div style={{ visibility: mounted ? 'visible' : 'hidden' }}>{children}</div>
        </ThemeContext.Provider>
    );
};
