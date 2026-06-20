import { URL } from 'url';

export default async function handler(req, res) {
    try {
        // Extract the subpath after /api/derivws/
        // E.g. /api/derivws/trading/v1/options/accounts -> trading/v1/options/accounts
        const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const subpath = urlObj.pathname.replace(/^\/api\/derivws\//, '');
        
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
