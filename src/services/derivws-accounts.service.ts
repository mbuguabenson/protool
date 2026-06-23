import { isProduction, getConfiguredClientId } from '@/components/shared';
import brandConfig from '@/components/shared/brand.config.json';

export interface DerivAccount {
    account_id: string;
    balance: string;
    currency: string;
    group: string;
    status: string;
    account_type: 'demo' | 'real';
}

interface AccountsResponse {
    data: DerivAccount[];
}

interface OTPResponseData {
    url: string;
}

interface OTPResponse {
    data: OTPResponseData;
}

export class DerivWSAccountsService {
    private static accountsFetchPromise: Promise<DerivAccount[]> | null = null;
    private static otpFetchPromises: Map<string, Promise<string>> = new Map();

    /**
     * Direct Deriv REST API base URL — bypasses the Vercel proxy.
     * Used as primary URL since the proxy (/api/derivws) can fail due to Vercel
     * function rewrite issues. Falls back to proxy if direct call fails.
     */
    private static getDirectAPIBaseURL(): string {
        const platformUrl = (brandConfig as any).platform?.derivws?.url?.production;
        return (platformUrl || 'https://api.derivws.com').replace(/\/$/, '');
    }

    private static getProxyBaseURL(): string {
        if (typeof window !== 'undefined') {
            return `${window.location.origin}/api/derivws`;
        }
        return '/api/derivws';
    }

    private static getClientId(): string {
        return getConfiguredClientId() || brandConfig.oauth.client_id || '33yStbGyLdNdqAyCuDk1d';
    }

    static clearCache(): void {
        this.accountsFetchPromise = null;
        this.otpFetchPromises.clear();
    }

    static storeAccounts(accounts: DerivAccount[]): void {
        sessionStorage.setItem('deriv_accounts', JSON.stringify(accounts));
    }

    static getStoredAccounts(): DerivAccount[] | null {
        try {
            const accountsStr = sessionStorage.getItem('deriv_accounts');
            if (!accountsStr) return null;
            return JSON.parse(accountsStr) as DerivAccount[];
        } catch (error) {
            console.error('[DerivWS] Error parsing stored accounts:', error);
            return null;
        }
    }

    static getDefaultAccount(): DerivAccount | null {
        const accounts = this.getStoredAccounts();
        if (!accounts || accounts.length === 0) return null;
        return accounts[0];
    }

    static clearStoredAccounts(): void {
        sessionStorage.removeItem('deriv_accounts');
    }

    static async fetchAccountsList(accessToken: string): Promise<DerivAccount[]> {
        if (this.accountsFetchPromise) return this.accountsFetchPromise;

        this.accountsFetchPromise = (async () => {
            const OptionsDir = (brandConfig as any).platform?.derivws?.directories?.options || '';
            const headers: Record<string, string> = {
                Authorization: `Bearer ${accessToken}`,
                'Deriv-App-ID': this.getClientId(),
                'Content-Type': 'application/json',
            };

            // Strategy: try direct API first, then fallback to Vercel proxy
            const directEndpoint = `${this.getDirectAPIBaseURL()}${OptionsDir}accounts`;
            const proxyEndpoint = `${this.getProxyBaseURL()}${OptionsDir}accounts`;

            const tryFetch = async (endpoint: string): Promise<DerivAccount[]> => {
                const response = await fetch(endpoint, { method: 'GET', headers });
                if (!response.ok) {
                    throw new Error(`[DerivWS] ${response.status} ${response.statusText} from ${endpoint}`);
                }
                const data: AccountsResponse = await response.json();
                const accounts = data?.data || [];
                if (accounts.length === 0) console.warn('[DerivWS] No accounts found in response from', endpoint);
                return accounts;
            };

            try {
                // Try direct API (no proxy hop)
                const accounts = await tryFetch(directEndpoint);
                this.storeAccounts(accounts);
                return accounts;
            } catch (directErr) {
                console.warn('[DerivWS] Direct API call failed, trying proxy:', directErr);
                try {
                    const accounts = await tryFetch(proxyEndpoint);
                    this.storeAccounts(accounts);
                    return accounts;
                } catch (proxyErr) {
                    console.error('[DerivWS] Error fetching accounts (both direct and proxy failed):', proxyErr);
                    this.accountsFetchPromise = null;
                    throw proxyErr;
                }
            } finally {
                setTimeout(() => {
                    this.accountsFetchPromise = null;
                }, 100);
            }
        })();

        return this.accountsFetchPromise;
    }

    static async fetchOTPWebSocketURL(accessToken: string, accountId: string): Promise<string> {
        const cacheKey = `${accountId}`;
        if (this.otpFetchPromises.has(cacheKey)) return this.otpFetchPromises.get(cacheKey)!;

        const otpPromise = (async () => {
            const optionsDir = (brandConfig as any).platform?.derivws?.directories?.options || '';
            const headers: Record<string, string> = {
                Authorization: `Bearer ${accessToken}`,
                'Deriv-App-ID': this.getClientId(),
                'Content-Type': 'application/json',
            };

            const directEndpoint = `${this.getDirectAPIBaseURL()}${optionsDir}accounts/${accountId}/otp`;
            const proxyEndpoint = `${this.getProxyBaseURL()}${optionsDir}accounts/${accountId}/otp`;

            const tryFetch = async (endpoint: string): Promise<string> => {
                const response = await fetch(endpoint, { method: 'POST', headers });
                if (!response.ok) throw new Error(`[DerivWS] OTP ${response.status} ${response.statusText} from ${endpoint}`);
                const otpResponse: OTPResponse = await response.json();
                const websocketURL = otpResponse.data.url;
                if (!websocketURL) throw new Error('WebSocket URL not found in OTP response');
                return websocketURL;
            };

            try {
                return await tryFetch(directEndpoint);
            } catch (directErr) {
                console.warn('[DerivWS] Direct OTP call failed, trying proxy:', directErr);
                try {
                    return await tryFetch(proxyEndpoint);
                } catch (proxyErr) {
                    console.error('[DerivWS] Error fetching OTP (both direct and proxy failed):', proxyErr);
                    this.otpFetchPromises.delete(cacheKey);
                    throw proxyErr;
                }
            } finally {
                setTimeout(() => {
                    this.otpFetchPromises.delete(cacheKey);
                }, 100);
            }
        })();

        this.otpFetchPromises.set(cacheKey, otpPromise);
        return otpPromise;
    }

    static async getAuthenticatedWebSocketURL(accessToken: string): Promise<string> {
        try {
            let accounts: DerivAccount[] | null = null;
            const storedAccounts = this.getStoredAccounts();
            if (storedAccounts && storedAccounts.length > 0) accounts = storedAccounts;
            else accounts = await this.fetchAccountsList(accessToken);

            if (!accounts || accounts.length === 0) throw new Error('No accounts available');

            const activeLoginId = localStorage.getItem('active_loginid');
            const targetAccount = (activeLoginId && accounts.find(a => a.account_id === activeLoginId)) || accounts[0];

            const websocketURL = await this.fetchOTPWebSocketURL(accessToken, targetAccount.account_id);
            return websocketURL;
        } catch (error) {
            console.error('[DerivWS] Error in authenticated WebSocket URL flow:', error);
            throw error;
        }
    }
}

export default DerivWSAccountsService;
