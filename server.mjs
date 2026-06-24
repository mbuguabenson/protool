import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// Import API routes
import oauthStart from './api/oauth/start.js';
import oauthCallback from './api/oauth/callback.js';
import oauthSession from './api/oauth/session.js';
import oauthRefresh from './api/oauth/refresh.js';
import oauthLogout from './api/oauth/logout.js';
import token from './api/token.js';
import websocketSession from './api/websocket/session.js';
import derivwsProxy from './api/derivws/proxy.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3001;
const RSBUILD_PORT = 3002;

// Middleware to parse JSON requests
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes
app.get('/api/oauth/start', (req, res) => oauthStart(req, res));
app.get('/api/oauth/callback', (req, res) => oauthCallback(req, res));
app.get('/api/oauth/session', (req, res) => oauthSession(req, res));
app.post('/api/oauth/refresh', (req, res) => oauthRefresh(req, res));
app.post('/api/oauth/logout', (req, res) => oauthLogout(req, res));
app.all('/api/token', (req, res) => token(req, res));
app.all('/api/websocket/session', (req, res) => websocketSession(req, res));
app.use('/api/derivws', (req, res, next) => {
    if (req.path.startsWith('/')) {
        return derivwsProxy(req, res);
    }
    next();
});

// Proxy everything else to rsbuild dev server
app.use(
    createProxyMiddleware({
        target: `http://localhost:${RSBUILD_PORT}`,
        changeOrigin: true,
        ws: true,
        onError: (err, req, res) => {
            console.error('Proxy error:', err);
            res.status(500).send('Proxy error');
        },
    })
);

// Start server
app.listen(PORT, () => {
    console.log(`Dev server running at http://localhost:${PORT}`);
    console.log(`Rsbuild dev server running at http://localhost:${RSBUILD_PORT}`);
    console.log('API endpoints available at /api/*');
});
