'use client';

import { useEffect, useState, useRef } from 'react';
import { DerivWebSocketManager } from '@/lib/deriv-websocket-manager';
import { DERIV_APP_ID, DERIV_LEGACY_APP_ID, OAUTH_CLIENT_ID, DERIV_API, DERIV_REDIRECT_URL } from '@/lib/deriv-config';
import {
    authLog,
    normalizeAuthorizeResponse,
    storeLegacyOAuthTokens,
    storeModernAccessToken,
    setOAuthFlowType,
    cleanOAuthUrlParams,
    incrementAuthAttempt,
    resetAuthAttemptCount,
    isAuthAttemptsExceeded,
} from '@/lib/deriv-auth-compat';

interface Balance {
    amount: number;
    currency: string;
}

interface Account {
    id: string;
    type: 'Demo' | 'Real';
    currency: string;
    balance: number;
}

// Helper to get initial values from localStorage safely
const getStored = (key: string, defaultValue: any) => {
    if (typeof window === 'undefined') return defaultValue;
    const saved = localStorage.getItem(key);
    if (!saved) return defaultValue;
    try {
        return JSON.parse(saved);
    } catch {
        return saved;
    }
};

/**
 * Parse legacy Deriv redirect parameters from the URL.
 *
 * This is retained for old-style direct token redirects, but newer Deriv
 * login flows should use auth.deriv.com/oauth2/auth with app_id routing.
 */
function parseDerivOAuthParams(
    searchParams: URLSearchParams
): { accounts: Array<{ id: string; token: string; currency: string }> } | null {
    const accounts: Array<{ id: string; token: string; currency: string }> = [];

    for (let i = 1; i <= 20; i++) {
        const acct = searchParams.get(`acct${i}`);
        const token = searchParams.get(`token${i}`);
        const cur = searchParams.get(`cur${i}`);

        if (acct && token) {
            accounts.push({ id: acct, token, currency: cur || 'USD' });
        } else {
            break;
        }
    }

    if (accounts.length > 0) return { accounts };
    return null;
}

export function useDerivAuth() {
    const [token, setToken] = useState<string>(() => getStored('deriv_api_token', ''));
    const [isLoggedIn, setIsLoggedIn] = useState(() => !!getStored('deriv_api_token', ''));
    const [balance, setBalance] = useState<Balance | null>(null);
    const [accountType, setAccountType] = useState<'Demo' | 'Real' | null>(null);
    const [accountCode, setAccountCode] = useState<string>('');
    const [accounts, setAccounts] = useState<Account[]>(() => {
        const tokens = getStored('deriv_auth_tokens', {});
        const lastBalances = getStored('deriv_last_balances', {});
        return Object.keys(tokens).map(id => ({
            id,
            type: id.startsWith('VR') ? 'Demo' : 'Real',
            currency: lastBalances[id]?.currency || 'USD',
            balance: lastBalances[id]?.balance || 0,
        }));
    });
    const [activeLoginId, setActiveLoginId] = useState<string | null>(() => getStored('active_login_id', null));
    const activeLoginIdRef = useRef<string | null>(getStored('active_login_id', null));
    const [isInitializing, setIsInitializing] = useState(true);
    const [showApprovalModal, setShowApprovalModal] = useState(false);
    const [showTokenModal, setShowTokenModal] = useState(false);
    const [balanceSubscribed, setBalanceSubscribed] = useState(false);
    const balanceSubscribedRef = useRef(false);
    const manager = DerivWebSocketManager.getInstance();

    // Keep ref in sync immediately
    useEffect(() => {
        activeLoginIdRef.current = activeLoginId;
    }, [activeLoginId]);

    // 1. Stable listener for auth and balance updates
    // NOTE: This effect runs only ONCE on mount (empty deps) so handlers stay
    // registered across all state changes. isInitializing is read via a ref to
    // avoid stale-closure issues without re-mounting the effect.
    const isInitializingRef = useRef(true);
    useEffect(() => {
        isInitializingRef.current = isInitializing;
    }, [isInitializing]);

    useEffect(() => {
        const handleAuthMessages = (data: any) => {
            authLog.step('WS message received', data.msg_type);
            if (data.msg_type === 'authorize') {
                setIsInitializing(false);
                isInitializingRef.current = false;
                if (data.error) {
                    authLog.error('Authorize error', `code=${data.error.code} msg=${data.error.message}`);
                    if (data.error.code === 'InvalidToken' || data.error.code === 'AuthorizationRequired') {
                        authLog.warn('InvalidToken/AuthorizationRequired — clearing session');
                        setIsLoggedIn(false);
                        setActiveLoginId(null);
                        activeLoginIdRef.current = null;
                        setAccountCode('');
                        setToken('');

                        localStorage.removeItem('deriv_api_token');
                        localStorage.removeItem('deriv_auth_tokens');
                        localStorage.removeItem('active_login_id');
                        localStorage.removeItem('deriv_last_balances');
                        setOAuthFlowType(null); // FIX: Reset flow type on token rejection

                        setShowTokenModal(true);
                    }
                    return;
                }

                const { authorize: rawAuthorize } = data;
                if (rawAuthorize) {
                    // FIX: Normalize the authorize response to handle both legacy and new accounts.
                    // Legacy accounts may be missing: account_category, landing_company, account_type,
                    // and may return an empty or missing account_list.
                    let normalized;
                    try {
                        normalized = normalizeAuthorizeResponse(rawAuthorize);
                    } catch (e) {
                        authLog.error('Failed to normalize authorize response', e);
                        return;
                    }

                    authLog.step('Authorization successful', {
                        loginid: normalized.loginid,
                        isLegacy: normalized.isLegacyAccount,
                        accounts: normalized.account_list.length,
                        currency: normalized.currency,
                    });

                    resetAuthAttemptCount();
                    setIsLoggedIn(true);
                    setActiveLoginId(normalized.loginid);
                    activeLoginIdRef.current = normalized.loginid;
                    setAccountCode(normalized.loginid);
                    setAccountType(normalized.is_virtual ? 'Demo' : 'Real');

                    setBalance({
                        amount: normalized.balance,
                        currency: normalized.currency,
                    });

                    // account_list is always present after normalization (synthesized if missing)
                    const lastBalancesMap = getStored('deriv_last_balances', {});
                    const formatted = normalized.account_list.map(acc => {
                        const apiBalance = Number(acc.balance) || 0;
                        const finalBalance =
                            acc.loginid === normalized.loginid || apiBalance > 0
                                ? apiBalance
                                : lastBalancesMap[acc.loginid]?.balance || 0;

                        return {
                            id: acc.loginid,
                            type: acc.is_virtual ? ('Demo' as const) : ('Real' as const),
                            currency: acc.currency,
                            balance: finalBalance,
                        };
                    });

                    // Cache balances for persistence across page refreshes
                    const balanceMap: Record<string, { balance: number; currency: string }> = {};
                    formatted.forEach((f: Account) => {
                        balanceMap[f.id] = { balance: f.balance, currency: f.currency };
                    });
                    localStorage.setItem('deriv_last_balances', JSON.stringify(balanceMap));
                    setAccounts(formatted);

                    if (!balanceSubscribedRef.current) {
                        authLog.step('Subscribing to balance stream');
                        manager.send({ balance: 1, subscribe: 1 });
                        balanceSubscribedRef.current = true;
                        setBalanceSubscribed(true);
                    }
                }
            }

            if (data.msg_type === 'balance' && data.balance) {
                const msgLoginId = data.balance.loginid || activeLoginIdRef.current;
                console.log('[v0] 💰 Balance update:', data.balance.balance, 'for', msgLoginId);

                if (msgLoginId === activeLoginIdRef.current) {
                    setBalance({
                        amount: Number(data.balance.balance),
                        currency: data.balance.currency,
                    });
                }

                setAccounts(prev => {
                    const next = prev.map(acc => {
                        if (acc.id === msgLoginId) {
                            return { ...acc, balance: Number(data.balance.balance) };
                        }
                        return acc;
                    });

                    // Persist updated balances
                    const balanceMap = getStored('deriv_last_balances', {});
                    next.forEach(n => {
                        balanceMap[n.id] = { balance: n.balance, currency: n.currency };
                    });
                    localStorage.setItem('deriv_last_balances', JSON.stringify(balanceMap));

                    return next;
                });
            }
        };

        // ── Register listeners (was missing — this was the root cause of missing balances) ──
        manager.on('authorize', handleAuthMessages);
        manager.on('balance', handleAuthMessages);

        const statusHandler = (status: string) => {
            if (status === 'disconnected' && !localStorage.getItem('deriv_api_token')) {
                setIsInitializing(false);
                isInitializingRef.current = false;
            }
        };
        const unbindStatus = manager.onConnectionStatus(statusHandler);

        return () => {
            manager.off('authorize', handleAuthMessages);
            manager.off('balance', handleAuthMessages);
            unbindStatus();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 2. Safety timeout — separate effect so it can re-arm when isInitializing resets to true
    useEffect(() => {
        if (!isInitializing) return;
        const safetyTimeout = setTimeout(() => {
            console.warn('[v0] 🕒 Authorization safety timeout reached. Forcing end of initialization.');
            setIsInitializing(false);
            isInitializingRef.current = false;
        }, 12000);
        return () => clearTimeout(safetyTimeout);
    }, [isInitializing]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const searchParams = new URLSearchParams(window.location.search);

        // ─── 1. PKCE OAuth Redirect Handler (code + state) ─────────────────────────
        const code = searchParams.get('code');
        const state = searchParams.get('state');

        const handlePKCERedirectAuth = async () => {
            authLog.step('PKCE redirect detected', { code: code?.substring(0, 8) + '...' });

            // FIX: Deduplication guard — read PKCE state before clearing to detect
            // if the /api/auth/callback page already processed this exchange.
            const storedState = sessionStorage.getItem('oauth_state');
            const codeVerifier = sessionStorage.getItem('pkce_code_verifier');

            // Clear PKCE storage immediately to prevent double-exchange across concurrent renders
            sessionStorage.removeItem('oauth_state');
            sessionStorage.removeItem('pkce_code_verifier');

            if (!storedState && !codeVerifier) {
                authLog.warn('PKCE state+verifier already consumed — skipping duplicate execution');
                return;
            }

            if (!state || state !== storedState) {
                authLog.error('State mismatch (CSRF protection)', { received: state, stored: storedState });
                setIsInitializing(false);
                return;
            }

            if (!codeVerifier) {
                authLog.error('Missing code_verifier in sessionStorage');
                setIsInitializing(false);
                return;
            }

            if (isAuthAttemptsExceeded()) {
                authLog.error('Max auth attempts exceeded. Aborting to prevent redirect loop.');
                setIsInitializing(false);
                return;
            }
            incrementAuthAttempt();

            authLog.step('Exchanging PKCE code for access token via /api/auth/token');
            setIsInitializing(true);

            try {
                const response = await fetch('/api/auth/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        code,
                        code_verifier: codeVerifier,
                        redirect_uri: DERIV_REDIRECT_URL,
                        client_id: OAUTH_CLIENT_ID,
                    }),
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error_description || data.error || 'Token exchange failed');
                }

                authLog.token('Modern access_token received', data.access_token);

                // FIX: Use compat helper — sets deriv_api_token, oauth_flow_type="modern",
                // and clears PKCE sessionStorage atomically.
                storeModernAccessToken(data.access_token);
                setToken(data.access_token);

                // Clean URL query parameters
                cleanOAuthUrlParams('modern');

                authLog.step('Connecting with modern access token');
                await connectWithToken(data.access_token);
            } catch (err: any) {
                authLog.error('PKCE auth callback error', err);
                alert(`Authentication failed: ${err.message || 'Unknown error'}`);
                setIsInitializing(false);
            }
        };

        if (code && state) {
            handlePKCERedirectAuth();
            return;
        }

        // ─── 2. Legacy OAuth Redirect Handler (acct1/token1 params) ─────────────
        const oauthResult = parseDerivOAuthParams(searchParams);

        if (oauthResult && oauthResult.accounts.length > 0) {
            authLog.legacy('Legacy OAuth redirect detected', `${oauthResult.accounts.length} accounts`);

            // FIX: Use compat helper which atomically stores tokens AND sets
            // oauth_flow_type="legacy". Without this, a stale "modern" value in
            // localStorage causes the REST handshake to run for legacy tokens,
            // which fails (legacy accounts have no Options V1 accounts), adding
            // 10-20s of delay before falling back to the correct direct WS path.
            const { tokenMap, preferredAccount } = storeLegacyOAuthTokens(oauthResult.accounts);
            const primaryToken = preferredAccount.token;

            authLog.token(`Primary token for ${preferredAccount.id}`, primaryToken);

            // Store as active
            localStorage.setItem('deriv_api_token', primaryToken);
            localStorage.setItem('active_login_id', preferredAccount.id);
            setToken(primaryToken);
            setIsLoggedIn(true);
            setActiveLoginId(preferredAccount.id);
            activeLoginIdRef.current = preferredAccount.id;

            // Build initial accounts list (balances = 0; authorize event will populate)
            const initialAccounts: Account[] = oauthResult.accounts.map(acc => ({
                id: acc.id,
                type: acc.id.startsWith('VR') ? ('Demo' as const) : ('Real' as const),
                currency: acc.currency,
                balance: 0,
            }));
            setAccounts(initialAccounts);

            // Clean URL — remove all legacy OAuth params
            cleanOAuthUrlParams('legacy');

            authLog.step('Starting legacy WebSocket authorization');
            setIsInitializing(true);
            connectWithToken(primaryToken);
            return;
        }

        // ─── 3. Clean stale scope params (stuck after failed OAuth) ──────────────
        const scopeParam = searchParams.get('scope');
        if (scopeParam && !searchParams.get('acct1') && !code) {
            console.log('[v0] ⚠️ Detected stale scope param without tokens, cleaning URL');
            const url = new URL(window.location.href);
            url.searchParams.delete('scope');
            window.history.replaceState({}, document.title, url.pathname + (url.search || ''));
        }

        // ─── 4. Standard session check ──────────────────────────────────────────
        const storedToken = localStorage.getItem('deriv_api_token');
        if (storedToken && storedToken.length > 10) {
            connectWithToken(storedToken);
        } else {
            console.log('[v0] ℹ️ No session found');
            setIsInitializing(false);
        }
    }, []);

    const connectWithToken = async (apiToken: string) => {
        if (!apiToken || apiToken.length < 10) {
            authLog.warn('connectWithToken: token too short, skipping', apiToken?.length);
            setIsInitializing(false);
            return;
        }

        authLog.token('connectWithToken: starting authorize', apiToken);
        authLog.step('oauth_flow_type', localStorage.getItem('oauth_flow_type') || '(not set)');

        try {
            // Delegates to manager._doAuthorize() which routes based on oauth_flow_type:
            //   "modern" → REST /accounts → OTP → wss://...?otp=... (new accounts)
            //   anything else → direct { authorize: token } on legacy WS (legacy accounts)
            await manager.authorize(apiToken);
            // Note: isInitializing is set to false in the 'authorize' event handler above
            authLog.step('manager.authorize() resolved without error');
            setIsInitializing(false);
        } catch (e: any) {
            authLog.error('connectWithToken: authorize threw', { code: e?.code, message: e?.message });
            setIsInitializing(false);

            if (e?.code === 'InvalidToken' || e?.code === 'AuthorizationRequired') {
                authLog.warn('InvalidToken/AuthorizationRequired — clearing session');
                setIsLoggedIn(false);
                setActiveLoginId(null);
                activeLoginIdRef.current = null;
                setAccountCode('');
                setToken('');

                localStorage.removeItem('deriv_api_token');
                localStorage.removeItem('deriv_auth_tokens');
                localStorage.removeItem('active_login_id');
                localStorage.removeItem('deriv_last_balances');
                setOAuthFlowType(null); // FIX: Always reset on invalid token

                setShowTokenModal(true);
            } else if (!isLoggedIn) {
                setShowTokenModal(true);
            }
        }
    };

    const submitApiToken = (apiToken: string) => {
        if (!apiToken || apiToken.length < 10) {
            alert('Please enter a valid API token');
            return;
        }

        localStorage.setItem('oauth_flow_type', 'manual');
        setIsInitializing(true);
        localStorage.setItem('deriv_api_token', apiToken);
        setToken(apiToken);
        connectWithToken(apiToken);
    };

    const openTokenSettings = () => {
        setShowTokenModal(true);
    };

    /**
     * Modern OAuth 2.0 PKCE Login Flow
     *
     * Uses auth.deriv.com/oauth2/auth with PKCE (Proof Key for Code Exchange).
     * The app_id uses the numeric legacy ID (110211) which is required by the Deriv
     * authorization server.
     */
    const loginWithDeriv = async () => {
        console.log('[v0] 🔐 Starting Modern OAuth 2.0 PKCE login flow...');
        if (typeof window === 'undefined') return;

        try {
            localStorage.setItem('oauth_flow_type', 'modern');
            // 1. Generate a random code_verifier
            const array = crypto.getRandomValues(new Uint8Array(64));
            const codeVerifier = Array.from(array)
                .map(v => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'[v % 66])
                .join('');

            // 2. Derive the code_challenge
            const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
            const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');

            // 3. Generate a random state for CSRF protection
            const state = crypto
                .getRandomValues(new Uint8Array(16))
                .reduce((s, b) => s + b.toString(16).padStart(2, '0'), '');

            // 4. Store code_verifier and state before redirecting
            sessionStorage.setItem('pkce_code_verifier', codeVerifier);
            sessionStorage.setItem('oauth_state', state);

            // Build the standard authorization URL with all required PKCE parameters
            // app_id MUST be the numeric legacy ID (110211) — string IDs cause "missing app_id" errors
            const params = new URLSearchParams({
                response_type: 'code',
                client_id: OAUTH_CLIENT_ID, // Modern OAuth ID
                redirect_uri: DERIV_REDIRECT_URL,
                scope: 'trade account_manage',
                state: state,
                code_challenge: codeChallenge,
                code_challenge_method: 'S256',
                app_id: DERIV_LEGACY_APP_ID, // Numeric App ID (110211) — required by Deriv auth server
            });

            const oauthUrl = `https://auth.deriv.com/oauth2/auth?${params.toString()}`;

            console.log('[v0] 🔐 Redirecting to Deriv PKCE OAuth URL:', oauthUrl);
            window.location.href = oauthUrl;
        } catch (error) {
            console.error('[v0] ❌ OAuth PKCE setup error:', error);
        }
    };

    /**
     * Legacy OAuth Login Flow (App ID: 110211)
     *
     * Uses auth.deriv.com/oauth2/auth with `app_id` routing so Deriv can
     * route legacy users to the legacy API platform while preserving the
     * standard PKCE code exchange flow.
     */
    const loginWithDerivLegacy = async () => {
        console.log('[v0] 🔐 Starting Legacy OAuth login flow (App ID: 110211)...');
        if (typeof window === 'undefined') return;

        try {
            localStorage.setItem('oauth_flow_type', 'legacy');

            const array = crypto.getRandomValues(new Uint8Array(64));
            const codeVerifier = Array.from(array)
                .map(v => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'[v % 66])
                .join('');

            const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
            const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');

            const state = crypto
                .getRandomValues(new Uint8Array(16))
                .reduce((s, b) => s + b.toString(16).padStart(2, '0'), '');

            sessionStorage.setItem('pkce_code_verifier', codeVerifier);
            sessionStorage.setItem('oauth_state', state);

            const params = new URLSearchParams({
                response_type: 'code',
                client_id: OAUTH_CLIENT_ID,
                redirect_uri: DERIV_REDIRECT_URL,
                scope: 'trade account_manage',
                state,
                code_challenge: codeChallenge,
                code_challenge_method: 'S256',
                app_id: DERIV_LEGACY_APP_ID,
            });

            const oauthUrl = `https://auth.deriv.com/oauth2/auth?${params.toString()}`;

            console.log('[v0] 🔐 Redirecting to Deriv Legacy OAuth URL:', oauthUrl);
            window.location.href = oauthUrl;
        } catch (error) {
            console.error('[v0] ❌ Legacy OAuth login error:', error);
        }
    };

    const requestLogin = () => {
        loginWithDeriv();
    };

    const logout = () => {
        if (typeof window === 'undefined') return;
        authLog.step('Logout initiated');
        manager.unsubscribeAll();
        localStorage.removeItem('deriv_api_token');
        localStorage.removeItem('deriv_auth_tokens');
        localStorage.removeItem('active_login_id');
        localStorage.removeItem('deriv_last_balances');
        // FIX: Clear oauth_flow_type on logout so the next login starts fresh.
        // Leaving a stale "modern" value here is the primary cause of legacy users
        // hitting the REST handshake on subsequent logins after a modern session.
        setOAuthFlowType(null);
        setToken('');
        setIsLoggedIn(false);
        setBalance(null);
        setAccounts([]);
        setActiveLoginId(null);
        activeLoginIdRef.current = null;
        setIsInitializing(false);
        balanceSubscribedRef.current = false;
        setBalanceSubscribed(false);
        setShowTokenModal(true);
        authLog.step('Logout complete');
    };

    const switchAccount = (loginId: string) => {
        if (!loginId || typeof window === 'undefined') return;
        const storedTokens = JSON.parse(localStorage.getItem('deriv_auth_tokens') || '{}');
        const targetToken = storedTokens[loginId] || token;

        if (!targetToken) return;

        console.log('[v0] 🔄 Switching account to:', loginId);
        setIsInitializing(true);
        localStorage.setItem('deriv_api_token', targetToken);
        localStorage.setItem('active_login_id', loginId);
        setToken(targetToken);

        // Reset subscription flags so authorize handler re-subscribes for the NEW account
        balanceSubscribedRef.current = false;
        setBalanceSubscribed(false);

        manager.authorize(targetToken).catch(console.error);
    };

    return {
        token,
        isLoggedIn,
        isInitializing,
        isAuthenticated: isLoggedIn,
        loginWithDeriv,
        loginWithDerivLegacy,
        requestLogin,
        showApprovalModal,
        logout,
        balance,
        accountType,
        accountCode,
        accounts,
        switchAccount,
        activeLoginId,
        showTokenModal,
        submitApiToken,
        openTokenSettings,
    };
}
