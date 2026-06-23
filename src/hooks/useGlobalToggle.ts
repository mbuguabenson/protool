import { useState, useEffect } from 'react';

type ToggleConfig = {
    key: string;
    defaultValue: boolean;
};

export function useGlobalToggle({ key, defaultValue }: ToggleConfig) {
    const [value, setValue] = useState<boolean>(() => {
        const stored = localStorage.getItem(key);
        return stored !== null ? stored === 'true' : defaultValue;
    });

    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === key) {
                setValue(e.newValue === 'true');
            }
        };

        // Also listen to custom events for same-window updates
        const handleCustomChange = (e: Event) => {
            const customEvent = e as CustomEvent;
            if (customEvent.detail.key === key) {
                setValue(customEvent.detail.value);
            }
        };

        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('app-toggle-change', handleCustomChange);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('app-toggle-change', handleCustomChange);
        };
    }, [key]);

    const updateValue = (newValue: boolean) => {
        setValue(newValue);
        localStorage.setItem(key, String(newValue));
        window.dispatchEvent(
            new CustomEvent('app-toggle-change', {
                detail: { key, value: newValue },
            })
        );
    };

    return [value, updateValue] as const;
}
