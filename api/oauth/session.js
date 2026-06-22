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
        const finalAppId = app_id || process.env.DERIV_OAUTH_CLIENT_ID || process.env.CLIENT_ID || '33yStbGyLdNdqAyCuDk1d';

        if (!access_token) {
            return res.status(200).json({ logged_in: false, app_id: finalAppId });
        }

        const account_headers = {
            Authorization: `Bearer ${access_token}`,
            'Content-Type': 'application/json',
            'Deriv-App-ID': finalAppId,
            'X-APP-ID': finalAppId,
        };

        let accounts = [];

        // Try trading/v1 API first (works for new wallet accounts: DOT, ROT)
        try {
            const tradingResponse = await fetch('https://api.derivws.com/trading/v1/options/accounts', {
                headers: account_headers,
            });

            if (tradingResponse.ok) {
                const tradingData = await tradingResponse.json();
                const tradingAccounts = tradingData.data || tradingData.accounts || tradingData.trading_accounts || [];
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
            // Fallback if trading API fails
            console.error('[Session] Error during options accounts retrieval/creation:', err);
        }

        // Determine selected account: prefer stored selection, then first account
        let selectedLoginId = stored_selected_loginid || accounts[0]?.loginid || null;
        const selectedAccount = accounts.find(account => account.loginid === selectedLoginId) || accounts[0] || null;

        return res.status(200).json({
            logged_in: true,
            account_id: selectedAccount?.loginid || selectedLoginId || null,
            account_type: selectedAccount?.account_type || null,
            currency: selectedAccount?.currency || null,
            app_id: app_id || null,
            access_token,
            accounts,
        });
    } catch (err) {
        return res
            .status(500)
            .json({ error: 'session_error', error_description: err instanceof Error ? err.message : String(err) });
    }
}
