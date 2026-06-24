import { useEffect, useState, useRef } from 'react';
import { DerivWebSocketManager } from '../lib/deriv-api-v1/deriv-websocket-manager';
import {
    DERIV_APP_ID,
    DERIV_LEGACY_APP_ID,
    OAUTH_CLIENT_ID,
    DERIV_API,
    DERIV_REDIRECT_URL,
} from '../lib/deriv-api-v1/deriv-config';
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
} from '../lib/deriv-api-v1/deriv-auth-compat';
import { generateOAuthURL } from '@/components/shared';

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

    useEffect(() => {
        activeLoginIdRef.current = activeLoginId;
    }, [activeLoginId]);

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
                        setOAuthFlowType(null);

                        setShowTokenModal(true);
                    }
                    return;
                }

                const { authorize: rawAuthorize } = data;
                if (rawAuthorize) {
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

                    const balanceMap = getStored('deriv_last_balances', {});
                    next.forEach(n => {
                        balanceMap[n.id] = { balance: n.balance, currency: n.currency };
                    });
                    localStorage.setItem('deriv_last_balances', JSON.stringify(balanceMap));

                    return next;
                });
            }
        };

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
    }, []);

    const isInitializingRef = useRef(true);
    useEffect(() => {
        isInitializingRef.current = isInitializing;
    }, [isInitializing]);

    useEffect(() => {
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

        const oauthResult = parseDerivOAuthParams(searchParams);

        if (oauthResult && oauthResult.accounts.length > 0) {
            authLog.legacy('Legacy OAuth redirect detected', `${oauthResult.accounts.length} accounts`);

            const { tokenMap, preferredAccount } = storeLegacyOAuthTokens(oauthResult.accounts);
            const primaryToken = preferredAccount.token;

            authLog.token(`Primary token for ${preferredAccount.id}`, primaryToken);

            localStorage.setItem('deriv_api_token', primaryToken);
            localStorage.setItem('active_login_id', preferredAccount.id);
            setToken(primaryToken);
            setIsLoggedIn(true);
            setActiveLoginId(preferredAccount.id);
            activeLoginIdRef.current = preferredAccount.id;

            const initialAccounts: Account[] = oauthResult.accounts.map(acc => ({
                id: acc.id,
                type: acc.id.startsWith('VR') ? ('Demo' as const) : ('Real' as const),
                currency: acc.currency,
                balance: 0,
            }));
            setAccounts(initialAccounts);

            cleanOAuthUrlParams('legacy');

            authLog.step('Starting legacy WebSocket authorization');
            setIsInitializing(true);
            connectWithToken(primaryToken);
            return;
        }

        const scopeParam = searchParams.get('scope');
        if (scopeParam && !searchParams.get('acct1')) {
            console.log('[v0] ⚠️ Detected stale scope param without tokens, cleaning URL');
            const url = new URL(window.location.href);
            url.searchParams.delete('scope');
            window.history.replaceState({}, document.title, url.pathname + (url.search || ''));
        }

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
            await manager.authorize(apiToken);
            authLog.step('manager.authorize() resolved without error');
            setIsInitializing(false);
        } catch (err: any) {
            authLog.error('connectWithToken: authorize threw', { code: err?.code, message: err?.message });
            setIsInitializing(false);

            if (err?.code === 'InvalidToken' || err?.code === 'AuthorizationRequired') {
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
                setOAuthFlowType(null);

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

    const loginWithDeriv = async () => {
        console.log('[v0] 🔐 Starting OAuth login flow...');
        if (typeof window === 'undefined') return;

        try {
            const oauthUrl = await generateOAuthURL();
            window.location.href = oauthUrl;
        } catch (error) {
            console.error('[v0] ❌ OAuth setup error:', error);
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

    const switchAccount = (loginid: string) => {
        if (!loginid || typeof window === 'undefined') return;
        const storedTokens = JSON.parse(localStorage.getItem('deriv_auth_tokens') || '{}');
        const targetToken = storedTokens[loginid] || token;

        if (!targetToken) return;

        console.log('[v0] 🔄 Switching account to:', loginid);
        setIsInitializing(true);
        localStorage.setItem('deriv_api_token', targetToken);
        localStorage.setItem('active_login_id', loginid);
        setToken(targetToken);

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
