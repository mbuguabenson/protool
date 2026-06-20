import { DERIV_API, DERIV_CONFIG } from './deriv-config';

export class DerivRESTClient {
    private appId: string;
    private token: string | null = null;

    constructor(appId: string = DERIV_CONFIG.APP_ID) {
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

        const response = await fetch(url, {
            ...options,
            headers,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `REST Request failed with status ${response.status}`);
        }

        return response.json();
    }

    /**
     * Fetch a one-time-use WebSocket URL (OTP URL) for WebSocket authentication.
     * The returned URL already contains the OTP token as a query parameter;
     * pass it directly to `new WebSocket(url)` — do NOT append anything to it.
     *
     * @param accountId The options account ID (e.g., DOT12345)
     * @returns Full OTP WebSocket URL (wss://…?otp=…)
     */
    async getOTP(accountId: string): Promise<string> {
        try {
            const data = await this.request(`/trading/v1/options/accounts/${accountId}/otp`, {
                method: 'POST',
            });
            // Response shape: { data: { url: "wss://…?otp=…" } }
            const url = data?.data?.url as string | undefined;
            if (!url) throw new Error(`OTP response missing data.url (got: ${JSON.stringify(data)})`);
            return url;
        } catch (error) {
            console.error('[v0] Failed to fetch OTP URL:', error);
            throw error;
        }
    }

    /**
     * Get all registered Options accounts for the authenticated user.
     * Returns the raw `data` array from the REST response.
     */
    async getAccounts(): Promise<any[]> {
        const res = await this.request('/trading/v1/options/accounts', {
            method: 'GET',
        });
        return res?.data ?? res ?? [];
    }

    /**
     * Select the best account (prefers demo) and return its account_id.
     * Mirrors the reference DerivClient.selectAccount() behaviour.
     */
    async selectAccount(): Promise<{ account_id: string; account_type: 'demo' | 'real' }> {
        const accounts = (await this.getAccounts()) as Array<{ account_id: string; account_type: 'demo' | 'real' }>;
        if (!accounts || accounts.length === 0) throw new Error('No Options accounts found');
        return accounts.find(a => a.account_type === 'demo') || accounts[0];
    }

    /**
     * Reset demo account balance
     */
    async resetDemoBalance(accountId: string): Promise<any> {
        return this.request(`/trading/v1/options/accounts/${accountId}/reset-demo-balance`, {
            method: 'POST',
        });
    }
}

export const derivREST = new DerivRESTClient();
