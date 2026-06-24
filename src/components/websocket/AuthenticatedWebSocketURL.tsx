import React, { useState } from 'react';
import DerivWSAccountsService from '@/services/derivws-accounts.service';

/**
 * AuthenticatedWebSocketURL component
 * -------------------------------------------------
 * Renders a simple UI that, given an access token (and optional
 * account ID), contacts the Deriv OTP endpoint (`/trading/v1/options/accounts/{accountId}/otp`)
 * using {@link DerivWSAccountsService.getAuthenticatedWebSocketURL} and displays the
 * resulting WebSocket URL.
 *
 * The component is deliberately lightweight – it does **not** open the WebSocket
 * itself; it merely demonstrates the OTP flow and returns the URL so that calling
 * code can decide how to handle the connection.
 *
 * Props:
 *  - `accessToken`: Bearer token for the Deriv API (required).
 *  - `accountId?`: Specific account to target. If omitted, the service will resolve
 *    the active account from stored state.
 */
interface AuthenticatedWebSocketURLProps {
    accessToken: string;
    accountId?: string;
}

const AuthenticatedWebSocketURL: React.FC<AuthenticatedWebSocketURLProps> = ({ accessToken, accountId }) => {
    const [websocketURL, setWebSocketURL] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>('');

    const fetchURL = async () => {
        setLoading(true);
        setError('');
        try {
            const url = accountId
                ? await DerivWSAccountsService.fetchOTPWebSocketURL(accessToken, accountId)
                : await DerivWSAccountsService.getAuthenticatedWebSocketURL(accessToken);
            setWebSocketURL(url);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            setError(`Failed to obtain WebSocket URL: ${msg}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className='authenticated-ws-url'>
            <button type='button' onClick={fetchURL} disabled={loading} className='fetch-url-btn'>
                {loading ? 'Fetching...' : 'Get Authenticated WebSocket URL'}
            </button>

            {error && (
                <p className='error-msg' style={{ color: 'red' }}>
                    {error}
                </p>
            )}
            {websocketURL && (
                <div className='url-output' style={{ marginTop: '0.5rem' }}>
                    <label>WebSocket URL:</label>
                    <pre style={{ overflowX: 'auto', background: '#f5f5f5', padding: '0.5rem' }}>{websocketURL}</pre>
                </div>
            )}
        </div>
    );
};

export default AuthenticatedWebSocketURL;
