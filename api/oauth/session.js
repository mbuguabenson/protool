import { URLSearchParams } from 'url';

function parseCookies(cookieHeader) {
    const list = {};
    if (!cookieHeader) return list;
    cookieHeader.split(';').forEach(function (cookie) {
        const parts = cookie.split('=');
        const key = parts.shift().trim();
        const value = parts.join('=');
        list[key] = decodeURIComponent(value);
    });
    return list;
}

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const cookies = parseCookies(req.headers.cookie || '');
        const access_token = cookies.deriv_access_token;
        const app_id = cookies.deriv_app_id || process.env.DERIV_LEGACY_APP_ID;
        const stored_selected_loginid = cookies.deriv_selected_loginid;
        
        // Alphanumeric client ID required for REST calls to https://api.derivws.com
        const oauth_client_id = process.env.DERIV_OAUTH_CLIENT_ID || process.env.CLIENT_ID || '33yStbGyLdNdqAyCuDk1d';
        // Numeric legacy app ID required for frontend/bot-skeleton websocket connection parameter
        const legacy_app_id = app_id || process.env.DERIV_LEGACY_APP_ID || '113555';

        console.log('[Session] Restoring session. Token present:', !!access_token, 'Legacy App ID:', legacy_app_id, 'OAuth Client ID:', oauth_client_id);

        if (!access_token) {
            console.log('[Session] No access token found in cookies. Returning logged_in: false');
            return res.status(200).json({ logged_in: false, app_id: legacy_app_id });
        }

        // Check if the access token has expired
        const token_expires_str = cookies.deriv_token_expires;
        if (token_expires_str) {
            const token_expires = parseInt(token_expires_str, 10);
            if (!isNaN(token_expires) && Date.now() >= token_expires) {
                // Token expired - try to refresh it first
                const refresh_token = cookies.deriv_refresh_token;
                if (refresh_token) {
                    console.log('[Session] Access token expired. Attempting token refresh...');
                    try {
                        const refreshResp = await fetch('https://auth.deriv.com/oauth2/token', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                            body: new URLSearchParams({
                                grant_type: 'refresh_token',
                                refresh_token,
                                client_id: oauth_client_id,
                            }).toString(),
                        });
                        if (refreshResp.ok) {
                            const newTokenData = await refreshResp.json();
                            if (newTokenData.access_token) {
                                // Update access_token for this request
                                // Note: The response will set new cookies too
                                const maxAge = Number(newTokenData.expires_in) || 3600;
                                const cookieOpts = ['HttpOnly', 'Path=/', 'SameSite=Lax', 'Secure'];
                                res.setHeader('Set-Cookie', [
                                    `deriv_access_token=${encodeURIComponent(newTokenData.access_token)}; ${cookieOpts.join('; ')}; Max-Age=${maxAge}`,
                                    `deriv_token_expires=${Date.now() + maxAge * 1000}; ${cookieOpts.join('; ')}`,
                                    ...(newTokenData.refresh_token ? [`deriv_refresh_token=${encodeURIComponent(newTokenData.refresh_token)}; ${cookieOpts.join('; ')}; Max-Age=604800`] : []),
                                ]);
                                // Use the new access token for this request
                                cookies.deriv_access_token = newTokenData.access_token;
                                console.log('[Session] Token refreshed successfully.');
                            } else {
                                console.warn('[Session] Token refresh response missing access_token. Returning logged_in: false.');
                                return res.status(200).json({ logged_in: false, app_id: legacy_app_id });
                            }
                        } else {
                            console.warn('[Session] Token refresh failed. Returning logged_in: false.');
                            return res.status(200).json({ logged_in: false, app_id: legacy_app_id });
                        }
                    } catch (refreshErr) {
                        console.error('[Session] Token refresh error:', refreshErr);
                        return res.status(200).json({ logged_in: false, app_id: legacy_app_id });
                    }
                } else {
                    console.log('[Session] Access token expired and no refresh token. Returning logged_in: false.');
                    return res.status(200).json({ logged_in: false, app_id: legacy_app_id });
                }
            }
        }

        const account_headers = {
            Authorization: `Bearer ${access_token}`,
            'Content-Type': 'application/json',
            'Deriv-App-ID': oauth_client_id,
            'X-APP-ID': oauth_client_id,
        };

        let accounts = [];

        // Try trading/v1 API first (works for new wallet accounts: DOT, ROT)
        try {
            console.log('[Session] Fetching options accounts from api.derivws.com...');
            const tradingResponse = await fetch('https://api.derivws.com/trading/v1/options/accounts', {
                headers: account_headers,
            });

            console.log('[Session] Options accounts response status:', tradingResponse.status, tradingResponse.statusText);

            if (tradingResponse.ok) {
                const tradingData = await tradingResponse.json();
                const tradingAccounts = tradingData.data || tradingData.accounts || tradingData.trading_accounts || [];
                console.log('[Session] Options accounts fetched successfully. Raw count:', tradingAccounts.length);
                accounts = tradingAccounts
                    .map(account => ({
                        loginid: account.account_id || account.loginid || account.login_id || '',
                        currency: account.currency || '',
                        account_type: account.account_type || (account.is_virtual ? 'demo' : 'real'),
                        is_virtual: account.is_virtual ?? false,
                        balance: account.balance ?? null,
                        token: access_token,
                    }))
                    .filter(account => account.loginid);
            } else {
                const errText = await tradingResponse.text().catch(() => '');
                console.error('[Session] Failed to fetch options accounts. Response:', errText);
            }

            // Auto-create demo options account if none found
            if (tradingResponse.ok && accounts.length === 0) {
                console.log('[Session] No options accounts found. Attempting to auto-create demo options account...');
                const createResponse = await fetch('https://api.derivws.com/trading/v1/options/accounts', {
                    method: 'POST',
                    headers: account_headers,
                    body: JSON.stringify({
                        currency: 'USD',
                        group: 'row',
                        account_type: 'demo',
                    }),
                });
                if (createResponse.ok) {
                    console.log('[Session] Successfully auto-created demo options account!');
                    const refetchResponse = await fetch('https://api.derivws.com/trading/v1/options/accounts', {
                        headers: account_headers,
                    });
                    if (refetchResponse.ok) {
                        const refetchData = await refetchResponse.json();
                        const refetchAccounts = refetchData.data || refetchData.accounts || refetchData.trading_accounts || [];
                        accounts = refetchAccounts
                            .map(account => ({
                                loginid: account.account_id || account.loginid || account.login_id || '',
                                currency: account.currency || '',
                                account_type: account.account_type || (account.is_virtual ? 'demo' : 'real'),
                                is_virtual: account.is_virtual ?? false,
                                balance: account.balance ?? null,
                                token: access_token,
                            }))
                            .filter(account => account.loginid);
                    }
                } else {
                    const createErrData = await createResponse.json().catch(() => ({}));
                    console.error('[Session] Failed to auto-create demo options account:', createResponse.status, createErrData);
                }
            }
        } catch (err) {
            // Continue even if account fetch fails - frontend will discover via api_base.init()
            console.error('[Session] Error during options accounts retrieval/creation:', err);
        }

        // Determine selected account: prefer stored selection, then first account
        let selectedLoginId = stored_selected_loginid || accounts[0]?.loginid || null;
        const selectedAccount = accounts.find(account => account.loginid === selectedLoginId) || accounts[0] || null;

        console.log('[Session] Session recovery complete. Selected account ID:', selectedAccount?.loginid || selectedLoginId, 'Account count:', accounts.length);

        return res.status(200).json({
            logged_in: true,
            account_id: selectedAccount?.loginid || selectedLoginId || null,
            account_type: selectedAccount?.account_type || null,
            currency: selectedAccount?.currency || null,
            app_id: legacy_app_id || null,
            access_token,
            accounts,
        });
    } catch (err) {
        return res
            .status(500)
            .json({ error: 'session_error', error_description: err instanceof Error ? err.message : String(err) });
    }
}
