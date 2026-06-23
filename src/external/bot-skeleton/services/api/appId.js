import { getAppId, getSocketURL } from '@/components/shared';
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
        ws.onopen = (e) => this.trigger('open', e);
        ws.onclose = (e) => this.trigger('close', e);
        ws.onerror = (e) => this.trigger('error', e);
        ws.onmessage = (e) => this.trigger('message', e);
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
            const onErr = (e) => {
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

/**
 * Generate a Deriv API instance with a specific app_id
 * @param {number} specificAppId - Optional specific app_id to use. If not provided, uses getAppId()
 */
export const generateDerivApiInstance = (specificAppId = null) => {
    const cleanedServer = getSocketURL().replace(/[^a-zA-Z0-9.]/g, '');
    const requestedAppId = specificAppId !== null ? specificAppId : getAppId();
    const appId =
        currentConnectionAppId !== null && APP_ID_SWITCHING_DISABLED && specificAppId === null
            ? currentConnectionAppId
            : requestedAppId;
    const cleanedAppId = appId?.toString()?.replace?.(/[^a-zA-Z0-9]/g, '') ?? appId?.toString();

    // Store the app_id used for this connection
    if (currentConnectionAppId === null || specificAppId !== null) {
        currentConnectionAppId = appId;
    }

    if (specificAppId === null) {
        if (currentConnectionAppId === appId) {
            console.log(`🔗 [WEBSOCKET] Creating new connection with App ID ${appId}`);
        }
    } else {
        console.log(`🔗 [WEBSOCKET] Creating connection with specific App ID ${appId}`);
    }

    const socket_url = `wss://${cleanedServer}/websockets/v3?app_id=${cleanedAppId}&l=${getInitialLanguage()}&brand=${website_name.toLowerCase()}`;

    const delegating_socket = new DelegatingWebSocket(socket_url);
    const deriv_api = new DerivAPIBasic({
        connection: delegating_socket,
        middleware: new APIMiddleware({}),
    });

    const originalAuthorize = deriv_api.authorize.bind(deriv_api);
    deriv_api.authorize = async (token) => {
        if (token && token.startsWith('eyJ')) {
            const targetAccountId = localStorage.getItem('active_loginid') || '';
            console.log(`🔑 [appId.js] Intercepted authorize call for OIDC JWT. Target account: ${targetAccountId}`);
            
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
                    return { authorize: null, error: { code: 'AccountsFetchFailed', message: err?.message || String(err) } };
                }
            }

            const targetAccount = accounts.find(a => a.account_id === targetAccountId) || accounts[0];
            if (!targetAccount) {
                console.error('❌ [appId.js] No options accounts found. Check your Deriv account has an options trading account.');
                return { authorize: null, error: { code: 'NoAccountsFound', message: 'No options accounts found for this token.' } };
            }

            if (delegating_socket.connectedAccountId !== targetAccount.account_id) {
                try {
                    console.log(`🔄 [appId.js] Switching connection to OTP URL for ${targetAccount.account_id}...`);
                    const otpUrl = await DerivWSAccountsService.fetchOTPWebSocketURL(token, targetAccount.account_id);
                    await delegating_socket.switchTo(otpUrl);
                    delegating_socket.connectedAccountId = targetAccount.account_id;
                    console.log(`✅ [appId.js] Switched to OTP connection for ${targetAccount.account_id}`);
                } catch (err) {
                    console.error(`❌ [appId.js] Failed to switch to OTP connection for ${targetAccount.account_id}:`, err);
                    // Return soft error without code 'InvalidToken' so we don't trigger the login loop
                    return { authorize: null, error: { code: 'OTPSwitchFailed', message: err?.message || String(err) } };
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

    // Prefer token from centralized OAuthTokenExchangeService
    try {
        const oauthToken = OAuthTokenExchangeService.getAccessToken();
        if (oauthToken) return oauthToken;
    } catch (e) {
        // Ignore and fallback
    }

    const token = localStorage.getItem('authToken');
    if (token && token !== 'null') return token;
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
