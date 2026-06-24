import { DERIV_API, DERIV_CONFIG } from './deriv-config';

export class DerivRESTClient {
    private appId: string;
    private token: string | null = null;

    constructor(appId: string = DERIV_CONFIG.OAUTH_CLIENT_ID) {
        this.appId = appId;
        this.resolveToken();
    }

    private resolveToken() {
        if (typeof window !== 'undefined') {
            this.token =
                localStorage.getItem('deriv_auth_token') ||
                localStorage.getItem('authToken') ||
                localStorage.getItem('clientToken') ||
                localStorage.getItem('deriv_api_token');
        }
    }

    setToken(token: string) {
        this.token = token;
    }

    private async request(path: string, options: RequestInit = {}): Promise<any> {
        const url = `${DERIV_API.REST_BASE}${path}`;
        const headers = new Headers(options.headers || {});

        headers.set('Deriv-App-ID', this.appId);

        const hasBody = options.body !== undefined;
        if (hasBody) {
            headers.set('Content-Type', 'application/json');
        }

        if (this.token) {
            headers.set('Authorization', `Bearer ${this.token}`);
        }

        console.log(`[REST] ${options.method || 'GET'} ${url}`);
        console.log(`[REST] App-ID: ${this.appId}, Token: ${this.token ? this.token.substring(0, 10) + '...' : 'NONE'}`);

        try {
            const response = await fetch(url, {
                ...options,
                headers,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error(`[REST] Error ${response.status}:`, errorData);
                throw new Error(errorData.message || `REST Request failed with status ${response.status}`);
            }

            return response.json();
        } catch (error) {
            console.error(`[REST] Fetch failed:`, error instanceof Error ? error.message : String(error));
            throw error;
        }
    }

    async getOTP(accountId: string): Promise<string> {
        try {
            const data = await this.request(`/trading/v1/options/accounts/${accountId}/otp`, {
                method: 'POST',
            });
            const url = data?.data?.url as string | undefined;
            if (!url) throw new Error(`OTP response missing data.url (got: ${JSON.stringify(data)})`);
            return url;
        } catch (error) {
            console.error('[v0] Failed to fetch OTP URL:', error);
            throw error;
        }
    }

    async getAccounts(): Promise<any[]> {
        const res = await this.request('/trading/v1/options/accounts', {
            method: 'GET',
        });
        return res?.data || res || [];
    }

    async selectAccount(): Promise<{ account_id: string; account_type: 'demo' | 'real' }> {
        const accounts = (await this.getAccounts()) as Array<{ account_id: string; account_type: 'demo' | 'real' }>;
        if (!accounts || accounts.length === 0) throw new Error('No Options accounts found');
        return accounts.find(a => a.account_type === 'demo') || accounts[0];
    }

    async resetDemoBalance(accountId: string): Promise<any> {
        return this.request(`/trading/v1/options/accounts/${accountId}/reset-demo-balance`, {
            method: 'POST',
        });
    }
}

export const derivREST = new DerivRESTClient();
