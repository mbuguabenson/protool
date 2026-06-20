/**
 * Deriv OTP Handler
 * Manages OAuth2 access token -> OTP URL -> WebSocket connection
 * Reference: https://developers.deriv.com/docs/
 */

import { OtpResponse } from './deriv-otp-types';
import { DERIV_API, DERIV_CONFIG } from './deriv-config';

export class DerivOtpHandler {
    private static instance: DerivOtpHandler | null = null;

    private constructor() {}

    static getInstance(): DerivOtpHandler {
        if (!DerivOtpHandler.instance) {
            DerivOtpHandler.instance = new DerivOtpHandler();
        }
        return DerivOtpHandler.instance;
    }

    /**
     * Get OTP WebSocket URL using OAuth2 access token
     * Step 1 of OAuth2 + OTP flow
     *
     * @param accessToken OAuth2 access token from Deriv
     * @param accountId Options account ID (e.g., DOT90004580)
     * @returns WebSocket URL with OTP token
     */
    async getOtpUrl(accessToken: string, accountId: string): Promise<string> {
        console.log('[v0] 🔐 OTP: Requesting OTP URL for account', accountId);

        const url = `${DERIV_API.REST_BASE}/trading/v1/options/accounts/${accountId}/otp`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Deriv-App-ID': DERIV_CONFIG.APP_ID,
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[v0] ❌ OTP: Request failed ${response.status}:`, errorText);
                throw new Error(`OTP request failed: ${response.status} ${errorText}`);
            }

            const data = (await response.json()) as OtpResponse;
            const otpUrl = data.data.url;

            console.log('[v0] ✅ OTP: Received OTP URL');
            console.log('[v0] 🔐 OTP: Connecting to', otpUrl.split('?')[0] + '?otp=***');

            return otpUrl;
        } catch (error) {
            console.error('[v0] ❌ OTP: Error getting OTP URL:', error);
            throw error;
        }
    }

    /**
     * Extract account ID from OAuth response
     * The OAuth response contains account details needed to request OTP
     *
     * @param oauthData OAuth2 response data
     * @returns Account ID for OTP request
     */
    extractAccountId(oauthData: any): string {
        // Deriv OAuth response typically contains account information
        // The account ID is used to request the OTP URL
        // Format is usually DOT{digits} for Options Trading accounts

        if (!oauthData || !oauthData.account_id) {
            console.warn('[v0] ⚠️  OTP: No account_id in OAuth response');
            // Try alternative locations
            return oauthData?.loginid || oauthData?.id || '';
        }

        return oauthData.account_id;
    }

    /**
     * Validate that we have all required data for OTP flow
     */
    validateOtpPrerequisites(accessToken: string, accountId: string): boolean {
        if (!accessToken) {
            console.error('[v0] ❌ OTP: Missing access token');
            return false;
        }

        if (!accountId) {
            console.error('[v0] ❌ OTP: Missing account ID');
            return false;
        }

        return true;
    }
}

export const derivOtpHandler = DerivOtpHandler.getInstance();
