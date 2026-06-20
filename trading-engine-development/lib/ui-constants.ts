// Shared UI design constants for consistent theming across all tabs

export const CARD_STYLES = {
    dark: {
        container: 'bg-gradient-to-br from-[#0f1629]/80 to-[#1a2235]/80 border-blue-500/20',
        softCard: 'soft-card p-4 border-white/5',
        header: 'text-white',
        text: 'text-gray-400',
        subtext: 'text-gray-500',
    },
    light: {
        container: 'bg-white border-gray-200',
        softCard: 'soft-card p-4 border-gray-200',
        header: 'text-gray-900',
        text: 'text-gray-600',
        subtext: 'text-gray-500',
    },
};

export const BADGE_STYLES = {
    tradeNow: (theme: 'light' | 'dark') =>
        theme === 'dark'
            ? 'bg-green-500/20 text-green-400 border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.3)]'
            : 'bg-green-100 text-green-700 border-green-300',
    wait: (theme: 'light' | 'dark') =>
        theme === 'dark'
            ? 'bg-blue-500/20 text-blue-300 border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.3)]'
            : 'bg-blue-100 text-blue-700 border-blue-300',
    neutral: (theme: 'light' | 'dark') =>
        theme === 'dark'
            ? 'bg-gray-500/20 text-gray-400 border-gray-500/30'
            : 'bg-gray-100 text-gray-600 border-gray-300',
    warning: (theme: 'light' | 'dark') =>
        theme === 'dark'
            ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
            : 'bg-yellow-100 text-yellow-700 border-yellow-300',
};

export const SECTION_STYLES = {
    primaryBox: (theme: 'light' | 'dark') =>
        theme === 'dark'
            ? 'rounded-lg p-6 border bg-blue-500/10 border-blue-500/30'
            : 'rounded-lg p-6 border bg-blue-50 border-blue-200',
    secondaryBox: (theme: 'light' | 'dark') =>
        theme === 'dark'
            ? 'rounded-lg p-6 border bg-purple-500/10 border-purple-500/30'
            : 'rounded-lg p-6 border bg-purple-50 border-purple-200',
    infoBox: (theme: 'light' | 'dark') =>
        theme === 'dark'
            ? 'rounded-lg p-4 bg-blue-500/10 border border-blue-500/30'
            : 'rounded-lg p-4 bg-blue-50 border border-blue-200',
};

export const TEXT_STYLES = {
    largeNumber: (theme: 'light' | 'dark', color: 'green' | 'blue' | 'cyan' | 'purple' | 'orange') => {
        const colors = {
            green: theme === 'dark' ? 'text-green-400' : 'text-green-600',
            blue: theme === 'dark' ? 'text-blue-400' : 'text-blue-600',
            cyan: theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600',
            purple: theme === 'dark' ? 'text-purple-400' : 'text-purple-600',
            orange: theme === 'dark' ? 'text-orange-400' : 'text-orange-600',
        };
        return `text-4xl font-bold ${colors[color]}`;
    },
};

export const BUTTON_STYLES = {
    tradeNow:
        'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white px-6 py-3 text-lg font-bold shadow-[0_0_30px_rgba(34,197,94,0.6)] animate-pulse',
    primary:
        'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white px-6 py-3 font-bold',
    secondary: 'bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 font-bold',
};

export const getContainerClass = (theme: 'light' | 'dark', type: 'primary' | 'secondary' = 'primary') => {
    if (theme === 'dark') {
        return type === 'primary'
            ? 'rounded-xl p-6 border bg-gradient-to-br from-[#0f1629]/80 to-[#1a2235]/80 border-blue-500/20'
            : 'rounded-xl p-6 border bg-gradient-to-br from-purple-900/30 to-blue-900/30 border-purple-500/30';
    } else {
        return type === 'primary'
            ? 'rounded-xl p-6 border bg-white border-gray-200'
            : 'rounded-xl p-6 border bg-purple-50 border-purple-200';
    }
};

export const getTextColor = (theme: 'light' | 'dark', tone: 'primary' | 'secondary' | 'muted') => {
    const mapping = {
        dark: {
            primary: 'text-white',
            secondary: 'text-gray-300',
            muted: 'text-gray-400',
        },
        light: {
            primary: 'text-gray-900',
            secondary: 'text-gray-700',
            muted: 'text-gray-600',
        },
    };
    return mapping[theme][tone];
};
