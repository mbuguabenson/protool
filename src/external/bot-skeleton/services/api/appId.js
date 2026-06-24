import { getAppId } from '@/components/shared';
import { website_name } from '@/utils/site-config';
import DerivAPIBasic from '@deriv/deriv-api/dist/DerivAPIBasic';
import { getInitialLanguage } from '@deriv-com/translations';
import APIMiddleware from './api-middleware';
import { getDemoAccountIdForSpecialCR, isSpecialCRAccount } from '@/utils/special-accounts-config';
import OAuthTokenExchangeService from '@/services/oauth-token-exchange.service';
import { DerivWSAccountsService } from '@/services/derivws-accounts.service';

class DelegatingWebSocket {
    constructor(url) {
        this.url = url;
        this.listeners = {};
        this.connectedAccountId = null;
        this.realSocket = new WebSocket(url);
        this.setupRealSocket(this.realSocket);
    }

    setupRealSocket(ws) {
        ws.onopen = e => this.trigger('open', e);
        ws.onclose = e => this.trigger('close', e);
        ws.onerror = e => this.trigger('error', e);
        ws.onmessage = e => this.trigger('message', e);
    }

    addEventListener(event, listener) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(listener);
    }

    removeEventListener(event, listener) {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event].filter(l => l !== listener);
    }

    trigger(event, data) {
        const handler = this[`on${event}`];
        if (typeof handler === 'function') {
            try {
                handler(data);
            } catch (e) {
                console.error(`Error in DelegatingWebSocket direct handler for on${event}:`, e);
            }
        }

        const list = this.listeners[event] || [];
        list.forEach(l => {
            try {
                l(data);
            } catch (e) {
                console.error(`Error in DelegatingWebSocket listener for ${event}:`, e);
            }
        });
    }

    send(data) {
        if (this.realSocket.readyState === WebSocket.OPEN) {
            this.realSocket.send(data);
        } else {
            console.warn('DelegatingWebSocket: realSocket not open, dropping message:', data);
        }
    }

    close(code, reason) {
        this.realSocket.close(code, reason);
    }

    get readyState() {
        return this.realSocket.readyState;
    }

    get binaryType() {
        return this.realSocket.binaryType;
    }

    set binaryType(val) {
        this.realSocket.binaryType = val;
    }

    async switchTo(newUrl) {
        return new Promise((resolve, reject) => {
            console.log(`🔌 [DelegatingWebSocket] Switching connection from ${this.url} to ${newUrl}`);
            const oldSocket = this.realSocket;

            oldSocket.onopen = null;
            oldSocket.onclose = null;
            oldSocket.onerror = null;
            oldSocket.onmessage = null;
            oldSocket.close();

            this.url = newUrl;
            const newSocket = new WebSocket(newUrl);
            this.realSocket = newSocket;
            this.setupRealSocket(newSocket);

            const onOpen = () => {
                newSocket.removeEventListener('open', onOpen);
                newSocket.removeEventListener('error', onErr);
                resolve();
            };
            const onErr = e => {
                newSocket.removeEventListener('open', onOpen);
                newSocket.removeEventListener('error', onErr);
                reject(e);
            };
            newSocket.addEventListener('open', onOpen);
            newSocket.addEventListener('error', onErr);
        });
    }
}

// Track the app_id used for the current WebSocket connection
let currentConnectionAppId = null;
const APP_ID_SWITCHING_DISABLED = true;

// New Deriv Trading API public WebSocket endpoint (no app_id needed - OIDC path)
const DERIVWS_PUBLIC_WS = 'wss://api.derivws.com/trading/v1/options/ws/public';

const isJwtToken = token => typeof token === 'string' && token.startsWith('eyJ');
const isModernToken = token => {
    if (typeof token !== 'string' || token.trim() === '') return false;
    return isJwtToken(token) || localStorage.getItem('oauth_flow_type') === 'modern';
};

/**
 * Detect if the current auth token is an OIDC session.
 */
const isOidcSession = () => {
    // 1. Gather all possible client-side tokens to check if they are OIDC JWTs (start with 'eyJ')
    const tokens = [];

    const activeToken = V2GetActiveToken();
    if (activeToken) tokens.push(activeToken);

    const storedToken = localStorage.getItem('authToken');
    if (storedToken) tokens.push(storedToken);

    const legacyToken = localStorage.getItem('deriv_api_token');
    if (legacyToken) tokens.push(legacyToken);

    try {
        const authInfoStr = sessionStorage.getItem('auth_info');
        if (authInfoStr) {
            const authInfo = JSON.parse(authInfoStr);
            if (authInfo?.access_token) tokens.push(authInfo.access_token);
        }
    } catch (e) {}

    try {
        const accountsListStr = localStorage.getItem('accountsList');
        if (accountsListStr) {
            const accountsList = JSON.parse(accountsListStr);
            Object.values(accountsList).forEach(t => {
                if (typeof t === 'string') tokens.push(t);
            });
        }
    } catch (e) {}

    try {
        const clientAccountsStr = localStorage.getItem('clientAccounts');
        if (clientAccountsStr) {
            const clientAccounts = JSON.parse(clientAccountsStr);
            Object.values(clientAccounts).forEach(acc => {
                if (acc && typeof acc === 'object' && acc.token) {
                    tokens.push(acc.token);
                }
            });
        }
    } catch (e) {}

    // Filter out duplicates and empty strings
    const uniqueTokens = Array.from(new Set(tokens.filter(t => typeof t === 'string' && t.trim() !== '')));
    const oauthFlowType = typeof window !== 'undefined' ? localStorage.getItem('oauth_flow_type') : null;
    const isCallbackPath = typeof window !== 'undefined' && window.location.pathname === '/callback';
    const hasOidcQueryParams =
        typeof window !== 'undefined' &&
        (window.location.search.includes('code=ory_') || window.location.search.includes('scope=trade'));
    const hasOidcCookie =
        typeof document !== 'undefined' && document.cookie.includes('deriv_access_token');
    console.log('[appId.js] isOidcSession', { oauthFlowType, tokenCount: uniqueTokens.length });

    // Respect an explicit oauth_flow_type set by other parts of the app
    if (oauthFlowType === 'legacy') {
        console.log('[appId.js] isOidcSession -> false due to explicit legacy oauth_flow_type');
        return false;
    }
    if (oauthFlowType === 'modern') {
        const hasAuthInfo = !!OAuthTokenExchangeService.getAccessToken();
        if (hasAuthInfo || hasOidcCookie || isCallbackPath || hasOidcQueryParams) {
            console.log('[appId.js] isOidcSession -> true due to explicit modern oauth_flow_type with active OIDC evidence');
            return true;
        }
        console.warn(
            '[appId.js] isOidcSession -> modern oauth_flow_type set but no current authenticated OIDC token/cookie detected; deferring to fallback logic'
        );
    }

    if (uniqueTokens.length > 0) {
        const hasJwtToken = uniqueTokens.some(t => t.startsWith('eyJ'));
        if (hasJwtToken) {
            console.log('[appId.js] isOidcSession -> true based on JWT token presence');
            return true;
        }
        console.log('[appId.js] isOidcSession -> false because only legacy tokens were found');
        return false;
    }

    // 2. Fallback check for cookies and OAuth redirect indicators when no tokens are loaded yet
    if (typeof document !== 'undefined') {
        const cookies = document.cookie.split(';').map(c => c.trim());

        // Hydra / Ory OIDC session cookies
        const hasHydraSession = cookies.some(c => c.startsWith('ory_') || c.startsWith('oauth_'));
        if (hasHydraSession) {
            console.log('[appId.js] isOidcSession -> true due to OIDC session cookies');
            return true;
        }

        const loggedStateCookie = cookies.find(c => c.startsWith('logged_state='));
        if (loggedStateCookie && loggedStateCookie.split('=')[1] === 'true') {
            // Only classify as OIDC if we don't have any legacy indicators in the URL or local storage
            if (typeof window !== 'undefined') {
                const hasLegacyUrlParams =
                    window.location.search.includes('acct1=') || window.location.hash.includes('acct1=');
                if (!hasLegacyUrlParams) {
                    console.log('[appId.js] isOidcSession -> true due to logged_state cookie');
                    return true;
                }
            }
        }
    }

    if (typeof window !== 'undefined') {
        const hasCodeVerifier = !!sessionStorage.getItem('oauth_code_verifier');
        const isCallbackPath = window.location.pathname === '/callback';
        const hasOidcQueryParams =
            window.location.search.includes('code=ory_') || window.location.search.includes('scope=trade');
        const hasLegacyUrlParams = window.location.search.includes('acct1=') || window.location.hash.includes('acct1=');

        if ((hasCodeVerifier || isCallbackPath || hasOidcQueryParams) && !hasLegacyUrlParams) {
            console.log('[appId.js] isOidcSession -> true due to PKCE/callback/query indicators');
            return true;
        }
    }

    return false;
};

/**
 * Generate a Deriv API instance.
 * - OIDC JWT users: connects directly to the modern api.derivws.com public WebSocket
 *   (no legacy app_id required). The OTP switch upgrades it to an authenticated URL.
 * - Legacy token users: connects to the traditional ws.derivws.com endpoint with app_id.
 * @param {number} specificAppId - Optional specific app_id to use for legacy connections.
 */
export const generateDerivApiInstance = (specificAppId = null) => {
    // Always use the modern Deriv Trading API public WebSocket endpoint.
    // Legacy websocket app_id routes are no longer supported.
    const socket_url = DERIVWS_PUBLIC_WS;
    console.log(`🔗 [WEBSOCKET] Connecting to modern Deriv Trading API: ${socket_url}`);

    const delegating_socket = new DelegatingWebSocket(socket_url);
    const deriv_api = new DerivAPIBasic({
        connection: delegating_socket,
        middleware: new APIMiddleware({}),
    });

    const originalAuthorize = deriv_api.authorize.bind(deriv_api);
    deriv_api.authorize = async token => {
        const oauthFlowType = typeof window !== 'undefined' ? localStorage.getItem('oauth_flow_type') : null;
        const shouldInterceptOidc = token && (isJwtToken(token) || oauthFlowType === 'modern');
        if (shouldInterceptOidc) {
            const targetAccountId = localStorage.getItem('active_loginid') || '';
            console.log(`🔑 [appId.js] Intercepted authorize call for OIDC token. Target account: ${targetAccountId}`);

            let accounts = [];
            try {
                // Clear cached promise so we always get a fresh fetch on new connections
                DerivWSAccountsService.clearCache();
                accounts = await DerivWSAccountsService.fetchAccountsList(token);
            } catch (err) {
                console.error('❌ [appId.js] Failed to fetch accounts list via REST:', err);
                // Fall back to sessionStorage cached accounts to avoid auth failure loop
                const stored = DerivWSAccountsService.getStoredAccounts();
                if (stored && stored.length > 0) {
                    console.warn('⚠️ [appId.js] Using cached accounts from sessionStorage as fallback.');
                    accounts = stored;
                } else {
                    // No fallback available - return a soft error that does NOT trigger InvalidToken
                    return {
                        authorize: null,
                        error: { code: 'AccountsFetchFailed', message: err?.message || String(err) },
                    };
                }
            }

            const targetAccount = accounts.find(a => a.account_id === targetAccountId) || accounts[0];
            if (!targetAccount) {
                console.error(
                    '❌ [appId.js] No options accounts found. Check your Deriv account has an options trading account.'
                );
                return {
                    authorize: null,
                    error: { code: 'NoAccountsFound', message: 'No options accounts found for this token.' },
                };
            }

            if (delegating_socket.connectedAccountId !== targetAccount.account_id) {
                try {
                    console.log(`🔄 [appId.js] Switching connection to OTP URL for ${targetAccount.account_id}...`);
                    const otpUrl = await DerivWSAccountsService.fetchOTPWebSocketURL(token, targetAccount.account_id);
                    await delegating_socket.switchTo(otpUrl);
                    delegating_socket.connectedAccountId = targetAccount.account_id;
                    console.log(`✅ [appId.js] Switched to OTP connection for ${targetAccount.account_id}`);
                } catch (err) {
                    // OTP switch failed, but we already have account info from REST.
                    // Do NOT fail authorization — let the user be logged in.
                    // The public WS connection remains active; trading calls will
                    // attempt to get a fresh OTP URL when needed.
                    console.warn(
                        `⚠️ [appId.js] OTP switch failed for ${targetAccount.account_id}, continuing with REST auth:`,
                        err?.message || err
                    );
                }
            }

            const mappedAccountList = accounts.map(acc => ({
                loginid: acc.account_id,
                is_virtual: acc.account_type === 'demo' ? 1 : 0,
                currency: acc.currency,
                balance: parseFloat(acc.balance || '0'),
                landing_company_name: acc.account_type === 'demo' ? 'demo' : 'svg',
            }));

            const authorize = {
                loginid: targetAccount.account_id,
                is_virtual: targetAccount.account_type === 'demo' ? 1 : 0,
                currency: targetAccount.currency,
                balance: parseFloat(targetAccount.balance || '0'),
                landing_company_name: targetAccount.account_type === 'demo' ? 'demo' : 'svg',
                account_list: mappedAccountList,
                country: '',
                email: '',
                fullname: '',
                scopes: ['trade', 'read'],
            };

            console.log(`✅ [appId.js] Authorization complete for ${targetAccount.account_id}`);
            return { authorize, error: null };
        }

        return originalAuthorize(token);
    };

    return deriv_api;
};

/**
 * Check if the current app_id in localStorage has changed from the one used for the WebSocket connection
 * Returns true if app_id has changed and reconnection is needed
 */
export const hasAppIdChanged = () => {
    if (APP_ID_SWITCHING_DISABLED) {
        return false;
    }
    const currentAppId = getAppId();
    return currentConnectionAppId !== null && currentAppId !== currentConnectionAppId;
};

/**
 * Get the app_id that was used for the current WebSocket connection
 */
export const getCurrentConnectionAppId = () => {
    return currentConnectionAppId;
};

/**
 * Ensure the API instance is using the current app_id from localStorage
 * If app_id has changed, returns true indicating a new instance should be created
 * This should be called before making trades to ensure correct app_id is used
 */
export const shouldRecreateApiInstance = storedAppId => {
    if (APP_ID_SWITCHING_DISABLED) {
        return false;
    }
    const currentAppId = getAppId();
    return storedAppId !== currentAppId;
};

export const getLoginId = () => {
    const login_id = localStorage.getItem('active_loginid');
    if (login_id && login_id !== 'null') return login_id;
    return null;
};

export const V2GetActiveToken = () => {
    // CRITICAL: If show_as_cr flag is set, always use demo account token
    // This ensures all trades are executed on demo account, even when a special CR account is displayed
    const showAsCR = typeof window !== 'undefined' ? localStorage.getItem('show_as_cr') : null;
    if (showAsCR) {
        const accountsList =
            typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('accountsList') || '{}') : {};
        const demoAccountId = isSpecialCRAccount(showAsCR) ? getDemoAccountIdForSpecialCR(showAsCR) : 'VRTC10109979';
        const demoToken = demoAccountId ? accountsList[demoAccountId] : undefined;
        if (demoToken) {
            console.log('[V2GetActiveToken] 🎯 Using demo token for special account', showAsCR, '->', demoAccountId);
            return demoToken;
        }
        console.warn('[V2GetActiveToken] ⚠️ No demo token found for special account', showAsCR, 'using fallback');
    }

    // Prefer token from centralized OAuthTokenExchangeService (checks sessionStorage first)
    try {
        const oauthToken = OAuthTokenExchangeService.getAccessToken();
        if (oauthToken) {
            console.log(
                '[V2GetActiveToken] Using OAuthTokenExchangeService token.',
                oauthToken.startsWith('eyJ') ? 'OIDC JWT' : 'opaque/legacy token'
            );
            return oauthToken;
        }
    } catch (e) {
        // Ignore and fallback
    }

    // After page reload, sessionStorage is cleared, so check for persisted OIDC token
    const oidcToken = typeof window !== 'undefined' ? localStorage.getItem('oidc_access_token') : null;
    if (oidcToken && oidcToken !== 'null') {
        console.log(
            '[V2GetActiveToken] ✅ Using persisted localStorage oidc_access_token.',
            oidcToken.slice(0, 20) + '...',
            oidcToken.startsWith('eyJ') ? 'OIDC JWT' : 'opaque/legacy token'
        );
        return oidcToken;
    } else if (oidcToken === null) {
        console.warn('[V2GetActiveToken] ⚠️ No oidc_access_token in localStorage');
    }

    const authToken = localStorage.getItem('authToken');
    if (authToken && authToken !== 'null') {
        console.log(
            '[V2GetActiveToken] Using localStorage authToken.',
            authToken.startsWith('eyJ') ? 'OIDC JWT' : 'opaque/legacy token'
        );
        return authToken;
    }

    const legacyToken = localStorage.getItem('deriv_api_token');
    if (legacyToken && legacyToken !== 'null') {
        console.log('[V2GetActiveToken] Using legacy deriv_api_token from localStorage.');
        return legacyToken;
    }

    console.warn('[V2GetActiveToken] ⚠️ NO TOKEN FOUND in any storage location!');
    return null;
};

export const V2GetActiveClientId = () => {
    // CRITICAL: If show_as_cr flag is set, always return demo account ID
    // This ensures API always uses demo account for trading
    const showAsCR = typeof window !== 'undefined' ? localStorage.getItem('show_as_cr') : null;
    if (showAsCR) {
        const demoAccountId = isSpecialCRAccount(showAsCR) ? getDemoAccountIdForSpecialCR(showAsCR) : 'VRTC10109979';
        if (demoAccountId) {
            console.log(
                '[V2GetActiveClientId] 🎯 Using demo account ID for special account',
                showAsCR,
                '->',
                demoAccountId
            );
            return demoAccountId;
        }
    }

    const active_loginid = getLoginId();
    if (active_loginid) {
        return active_loginid;
    }

    const token = V2GetActiveToken();
    if (!token) return null;

    // Prefer stored accounts from DerivWSAccountsService
    try {
        const storedAccounts = DerivWSAccountsService.getStoredAccounts();
        const account_list_map = JSON.parse(localStorage.getItem('accountsList') || '{}');
        if (storedAccounts && Object.keys(account_list_map).length) {
            for (const acc of storedAccounts) {
                if (acc?.account_id && account_list_map[acc.account_id] === token) {
                    return acc.account_id;
                }
            }
        }
    } catch (e) {
        // ignore and fallback
    }

    const account_list = JSON.parse(localStorage.getItem('accountsList') || '{}');
    if (account_list && account_list !== 'null') {
        return Object.keys(account_list).find(key => account_list[key] === token) ?? null;
    }
    return null;
};

export const getToken = () => {
    const active_loginid = getLoginId();
    const client_accounts = JSON.parse(localStorage.getItem('accountsList')) ?? undefined;
    const active_account = (client_accounts && client_accounts[active_loginid]) || {};
    return {
        token: active_account ?? undefined,
        account_id: active_loginid ?? undefined,
    };
};
