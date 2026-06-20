import { clearCodeVerifier, getAuthRedirectUri, getCodeVerifier, isProduction } from '@/components/shared';
import { getConfiguredClientId } from '@/components/shared/utils/config/config';
import brandConfig from '@/components/shared/brand.config.json';

/**
 * Response from OAuth2 token exchange endpoint
 */
interface TokenExchangeResponse {
    access_token?: string;
    token_type?: string;
    expires_in?: number;
    refresh_token?: string;
    scope?: string;
    error?: string;
    error_description?: string;
}

interface AuthInfo {
    access_token: string;
    token_type: string;
    expires_in: number;
    expires_at: number; // Timestamp when token expires
    scope?: string;
    refresh_token?: string;
}

export class OAuthTokenExchangeService {
    private static getOAuth2TokenUrl(): string {
        const environment = isProduction() ? 'production' : 'staging';
        const configuredTokenUrl = (brandConfig as any).oauth?.token_url;
        if (typeof configuredTokenUrl === 'string' && configuredTokenUrl.trim()) {
            return configuredTokenUrl;
        }

        const configuredServerBaseUrl = (brandConfig as any).oauth?.server_base_url;
        if (typeof configuredServerBaseUrl === 'string' && configuredServerBaseUrl.trim()) {
            return `${configuredServerBaseUrl.replace(/\/$/, '')}/oauth2/token`;
        }

        return (brandConfig as any).platform?.auth2_url?.[environment] || 'https://auth.deriv.com/oauth2/token';
    }

    static getAuthInfo(): AuthInfo | null {
        try {
            const authInfoStr = sessionStorage.getItem('auth_info');
            if (!authInfoStr) return null;

            const authInfo: AuthInfo = JSON.parse(authInfoStr);
            if (authInfo.expires_at && Date.now() >= authInfo.expires_at) {
                this.clearAuthInfo();
                return null;
            }
            return authInfo;
        } catch (error) {
            console.error('OAuth', 'Error parsing auth_info', error);
            return null;
        }
    }

    /**
     * Store auth info object directly in sessionStorage
     */
    static setAuthInfo(authInfo: AuthInfo): void {
        try {
            sessionStorage.setItem('auth_info', JSON.stringify(authInfo));
        } catch (error) {
            console.error('OAuth', 'Failed to set auth_info', error);
        }
    }

    static clearAuthInfo(): void {
        sessionStorage.removeItem('auth_info');
    }

    static isAuthenticated(): boolean {
        const authInfo = this.getAuthInfo();
        return authInfo !== null && !!authInfo.access_token;
    }

    static getAccessToken(): string | null {
        const authInfo = this.getAuthInfo();
        return authInfo?.access_token || null;
    }

    static async exchangeCodeForToken(code: string): Promise<TokenExchangeResponse> {
        try {
            const codeVerifier = getCodeVerifier();
            if (!codeVerifier) {
                console.error('OAuth: PKCE code verifier not found or expired');
                return {
                    error: 'invalid_request',
                    error_description: 'PKCE code verifier not found or expired. Please restart authentication.',
                };
            }

            const clientId = getConfiguredClientId();
            if (!clientId) {
                console.error('OAuth: client ID is not configured in brand config, local storage, or env aliases');
                return {
                    error: 'invalid_client',
                    error_description: 'CLIENT_ID not configured',
                };
            }

            const redirectUrl = getAuthRedirectUri();

            // Call the server-side token exchange endpoint
            const response = await fetch('/api/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code,
                    code_verifier: codeVerifier,
                    redirect_uri: redirectUrl,
                    client_id: clientId,
                }),
            });

            const data: TokenExchangeResponse = await response.json();

            if (data.error) {
                console.error(`OAuth Token exchange error: ${data.error}`, data.error_description);
                return { error: data.error, error_description: data.error_description };
            }

            if (data.access_token) {
                clearCodeVerifier();

                const authInfo: AuthInfo = {
                    access_token: data.access_token,
                    token_type: data.token_type || 'bearer',
                    expires_in: data.expires_in || 3600,
                    expires_at: Date.now() + (data.expires_in || 3600) * 1000,
                    scope: data.scope,
                };

                if (data.refresh_token) authInfo.refresh_token = data.refresh_token;

                sessionStorage.setItem('auth_info', JSON.stringify(authInfo));

                // NOTE: Do NOT store the OIDC access_token in localStorage as 'authToken'.
                // The Deriv WebSocket API only accepts legacy short API tokens — not JWTs.
                // The server has already stored the access_token in the HttpOnly
                // 'deriv_access_token' cookie (via /api/token). On the next page load,
                // AuthWrapper will detect this cookie via /api/oauth/session and restore
                // the session properly (fetching accounts from the DerivWS REST API).
            }

            return data;
        } catch (error: unknown) {
            console.error('OAuth: Token exchange network or parsing error', error);
            return {
                error: 'network_error',
                error_description: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    static async refreshAccessToken(refreshToken: string): Promise<TokenExchangeResponse> {
        try {
            const tokenEndpoint = this.getOAuth2TokenUrl();

            const requestBody = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken });

            const response = await fetch(tokenEndpoint, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: requestBody.toString(),
            });

            const data: TokenExchangeResponse = await response.json();

            if (data.error) {
                console.error(`OAuth Token refresh error: ${data.error}`, data.error_description);
                return { error: data.error, error_description: data.error_description };
            }

            if (data.access_token) {
                const authInfo: AuthInfo = {
                    access_token: data.access_token,
                    token_type: data.token_type || 'bearer',
                    expires_in: data.expires_in || 3600,
                    expires_at: Date.now() + (data.expires_in || 3600) * 1000,
                    scope: data.scope,
                };

                if (data.refresh_token) authInfo.refresh_token = data.refresh_token;
                else {
                    const existingAuth = this.getAuthInfo();
                    if (existingAuth?.refresh_token) authInfo.refresh_token = existingAuth.refresh_token;
                }

                sessionStorage.setItem('auth_info', JSON.stringify(authInfo));
            }

            return data;
        } catch (error: unknown) {
            console.error('OAuth: Token refresh error', error);
            return {
                error: 'network_error',
                error_description: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
}

export default OAuthTokenExchangeService;
