import { URL } from 'url';

export default async function handler(req, res) {
    // CORS headers - allow same-origin and cross-origin requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Deriv-App-ID, deriv-app-id');

    // Handle preflight OPTIONS requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Lightweight diagnostics: log request method, url and masked headers
    try {
        const maskAuth = (h) => {
            if (!h) return h;
            try {
                const parts = h.split(' ');
                if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
                    const token = parts[1];
                    const last = token.slice(-6);
                    return `${parts[0]} ${token.length > 12 ? `${token.slice(0,6)}...${last}` : '***'}`;
                }
            } catch (e) {}
            return h && h.length > 24 ? `${h.slice(0,8)}...${h.slice(-8)}` : h;
        };

        const loggedHeaders = Object.fromEntries(
            Object.entries(req.headers || {}).map(([k, v]) => [k, k === 'authorization' ? maskAuth(v) : v])
        );
        console.log('[DerivWS Proxy] Incoming request:', req.method, req.url);
        console.log('[DerivWS Proxy] Incoming headers (masked):', JSON.stringify(loggedHeaders));
    } catch (e) {
        console.warn('[DerivWS Proxy] Failed to log incoming headers', e);
    }

    try {
        // Vercel may rewrite req.url to the function destination.
        // Try multiple sources to find the original request path.
        // Priority: x-original-url header > x-vercel-forwarded-for path > req.url
        let originalPath = '';

        // Check for original URL in headers (Vercel/nginx proxy headers)
        const xOriginalUrl = req.headers['x-original-url'] || req.headers['x-rewrite-url'];
        if (xOriginalUrl) {
            try {
                const parsedOriginal = new URL(xOriginalUrl, `http://${req.headers.host || 'localhost'}`);
                originalPath = parsedOriginal.pathname;
            } catch (_) {}
        }

        // Fall back to req.url
        if (!originalPath) {
            try {
                const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
                originalPath = urlObj.pathname;
            } catch (_) {
                originalPath = req.url || '/';
            }
        }

        // Extract the subpath after /api/derivws/
        // E.g. /api/derivws/trading/v1/options/accounts -> trading/v1/options/accounts
        const subpath = originalPath.replace(/^\/api\/derivws\//, '').replace(/^\//, '');

        // Sanity check: if subpath is empty or looks like the proxy file itself, reject
        if (!subpath || subpath === 'proxy.js' || subpath === 'proxy') {
            console.error(
                '[DerivWS Proxy] Could not extract valid subpath from URL:',
                req.url,
                '| originalPath:',
                originalPath
            );
            return res.status(400).json({
                error: 'invalid_proxy_path',
                error_description: `Could not determine target API path. Raw URL: ${req.url}`,
            });
        }

        const targetUrl = `https://api.derivws.com/${subpath}`;

        const authHeader = req.headers.authorization;
        const appIdHeader = req.headers['deriv-app-id'] || req.headers['Deriv-App-ID'] || req.headers['deriv-app-id'];

        const headers = {
            'Content-Type': req.headers['content-type'] || 'application/json',
        };
        if (authHeader) headers['Authorization'] = authHeader;
        if (appIdHeader) headers['Deriv-App-ID'] = appIdHeader;

        const fetchOptions = {
            method: req.method,
            headers,
        };

        if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
            // Forward body if present
            fetchOptions.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
        }

        const derivResponse = await fetch(targetUrl, fetchOptions);

        let responseData;
        const contentType = derivResponse.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            responseData = await derivResponse.json();
        } else {
            responseData = await derivResponse.text();
        }

        // Auto-create demo options account if user has none
        if (
            subpath === 'trading/v1/options/accounts' &&
            req.method === 'GET' &&
            derivResponse.ok &&
            typeof responseData === 'object' &&
            responseData !== null
        ) {
            const rawAccounts = responseData.data || responseData.accounts || responseData.trading_accounts || [];
            if (rawAccounts.length === 0) {
                console.log('[Proxy] No options accounts found. Auto-creating demo options account...');
                try {
                    const createResponse = await fetch('https://api.derivws.com/trading/v1/options/accounts', {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({
                            currency: 'USD',
                            group: 'row',
                            account_type: 'demo',
                        }),
                    });
                    if (createResponse.ok) {
                        console.log('[Proxy] Successfully auto-created demo options account!');
                        const refetchResponse = await fetch(targetUrl, fetchOptions);
                        if (refetchResponse.ok) {
                            responseData = await refetchResponse.json();
                            res.status(refetchResponse.status);
                            return res.json(responseData);
                        }
                    } else {
                        const createErrData = await createResponse.json().catch(() => ({}));
                        console.error(
                            '[Proxy] Failed to auto-create demo options account:',
                            createResponse.status,
                            createErrData
                        );
                    }
                } catch (e) {
                    console.error('[Proxy] Error auto-creating options account:', e);
                }
            }
        }

        res.status(derivResponse.status);
        if (typeof responseData === 'object') {
            return res.json(responseData);
        } else {
            return res.send(responseData);
        }
    } catch (error) {
        console.error('[DerivWS Proxy] Error forwarding request:', error);
        return res.status(500).json({
            error: 'derivws_proxy_failed',
            error_description: error instanceof Error ? error.message : String(error),
        });
    }
}
