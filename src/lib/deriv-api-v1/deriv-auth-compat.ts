const LOG_PREFIX = '[AUTH]';

export const authLog = {
    step: (step: string, detail?: any) => {
        console.log(`${LOG_PREFIX} ✅ STEP: ${step}`, detail !== undefined ? detail : '');
    },
    token: (label: string, token: string) => {
        console.log(`${LOG_PREFIX} 🔑 ${label}: ${token.substring(0, 6)}...${token.slice(-4)} (len=${token.length})`);
    },
    warn: (msg: string, detail?: any) => {
        console.warn(`${LOG_PREFIX} ⚠️ ${msg}`, detail !== undefined ? detail : '');
    },
    error: (msg: string, err?: any) => {
        console.error(`${LOG_PREFIX} ❌ ${msg}`, err !== undefined ? err : '');
    },
    legacy: (msg: string, detail?: any) => {
        console.log(`${LOG_PREFIX} 🕰️ [LEGACY] ${msg}`, detail !== undefined ? detail : '');
    },
    modern: (msg: string, detail?: any) => {
        console.log(`${LOG_PREFIX} 🆕 [MODERN] ${msg}`, detail !== undefined ? detail : '');
    },
};

export interface NormalizedAuthorize {
    loginid: string;
    is_virtual: boolean;
    currency: string;
    balance: number;
    account_list: NormalizedAccountListItem[];
    account_category: string;
    landing_company: string;
    residence: string;
    account_type: string;
    email: string;
    isLegacyAccount: boolean;
}

export interface NormalizedAccountListItem {
    loginid: string;
    is_virtual: boolean;
    currency: string;
    balance: number;
}

export function normalizeAuthorizeResponse(authorize: any): NormalizedAuthorize {
    if (!authorize || typeof authorize !== 'object') {
        authLog.error('normalizeAuthorizeResponse: received null/undefined authorize payload');
        throw new Error('Invalid authorize payload');
    }

    const loginid: string = authorize.loginid || '';
    const is_virtual: boolean = authorize.is_virtual === 1 || authorize.is_virtual === true;
    const currency: string = authorize.currency || 'USD';
    const balance: number = parseFloat(String(authorize.balance ?? '0')) || 0;

    let rawList = authorize.account_list;
    const hasList = Array.isArray(rawList) && rawList.length > 0;

    if (!hasList) {
        authLog.legacy('account_list missing or empty — synthesizing from authorize root for', loginid);
        rawList = [
            {
                loginid,
                is_virtual: authorize.is_virtual,
                currency,
                balance,
            },
        ];
    }

    const account_list: NormalizedAccountListItem[] = rawList.map((acc: any) => ({
        loginid: acc.loginid || '',
        is_virtual: acc.is_virtual === 1 || acc.is_virtual === true,
        currency: acc.currency || 'USD',
        balance: parseFloat(String(acc.balance ?? '0')) || 0,
    }));

    const isLegacyAccount = !authorize.account_category && !authorize.landing_company && !authorize.account_type;

    if (isLegacyAccount) {
        authLog.legacy(
            'Detected legacy Deriv account (missing account_category/landing_company/account_type)',
            loginid
        );
    }

    return {
        loginid,
        is_virtual,
        currency,
        balance,
        account_list,
        account_category: authorize.account_category || 'trading',
        landing_company: authorize.landing_company || authorize.landing_company_name || 'svg',
        residence: authorize.residence || '',
        account_type: authorize.account_type || (is_virtual ? 'virtual' : 'real'),
        email: authorize.email || '',
        isLegacyAccount,
    };
}

export type OAuthFlowType = 'modern' | 'legacy' | 'manual' | null;

export function getOAuthFlowType(): OAuthFlowType {
    if (typeof window === 'undefined') return null;
    return (localStorage.getItem('oauth_flow_type') as OAuthFlowType) || null;
}

export function setOAuthFlowType(type: OAuthFlowType): void {
    if (typeof window === 'undefined') return;
    if (type === null) {
        localStorage.removeItem('oauth_flow_type');
        authLog.step('Cleared oauth_flow_type');
    } else {
        localStorage.setItem('oauth_flow_type', type);
        authLog.step(`Set oauth_flow_type = "${type}"`);
    }
}

export function storeLegacyOAuthTokens(accounts: Array<{ id: string; token: string; currency: string }>): {
    tokenMap: Record<string, string>;
    preferredAccount: { id: string; token: string; currency: string };
} {
    authLog.step('Storing legacy OAuth tokens for', `${accounts.length} accounts`);

    const tokenMap: Record<string, string> = {};
    accounts.forEach(acc => {
        tokenMap[acc.id] = acc.token;
        authLog.token(`Token for ${acc.id}`, acc.token);
    });

    if (typeof window !== 'undefined') {
        localStorage.setItem('deriv_auth_tokens', JSON.stringify(tokenMap));
        setOAuthFlowType('legacy');
    }

    const preferredAccount = accounts.find(a => a.id.startsWith('VR')) || accounts[0];

    authLog.step('Selected preferred account', preferredAccount.id);
    return { tokenMap, preferredAccount };
}

export function storeModernAccessToken(accessToken: string): void {
    if (typeof window === 'undefined') return;

    authLog.token('Storing modern access_token', accessToken);

    localStorage.setItem('deriv_api_token', accessToken);
    setOAuthFlowType('modern');

    sessionStorage.removeItem('oauth_state');
    sessionStorage.removeItem('pkce_code_verifier');
    authLog.step('PKCE sessionStorage cleared');
}

let authAttemptCount = 0;
const MAX_AUTH_ATTEMPTS = 3;

export function incrementAuthAttempt(): number {
    authAttemptCount++;
    authLog.warn(`Auth attempt ${authAttemptCount}/${MAX_AUTH_ATTEMPTS}`);
    return authAttemptCount;
}

export function resetAuthAttemptCount(): void {
    authLog.step(`Auth attempts reset (was ${authAttemptCount})`);
    authAttemptCount = 0;
}

export function isAuthAttemptsExceeded(): boolean {
    return authAttemptCount >= MAX_AUTH_ATTEMPTS;
}

export function cleanOAuthUrlParams(style: 'legacy' | 'modern' | 'both' = 'both'): void {
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    let changed = false;

    if (style === 'modern' || style === 'both') {
        ['code', 'state', 'scope'].forEach(p => {
            if (url.searchParams.has(p)) {
                url.searchParams.delete(p);
                changed = true;
            }
        });
    }

    if (style === 'legacy' || style === 'both') {
        for (let i = 1; i <= 20; i++) {
            [`acct${i}`, `token${i}`, `cur${i}`].forEach(p => {
                if (url.searchParams.has(p)) {
                    url.searchParams.delete(p);
                    changed = true;
                }
            });
        }
        if (url.searchParams.has('scope')) {
            url.searchParams.delete('scope');
            changed = true;
        }
    }

    if (changed) {
        window.history.replaceState({}, document.title, url.pathname + (url.search || ''));
        authLog.step(`Cleaned ${style} OAuth URL params`);
    }
}
