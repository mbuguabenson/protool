import brandConfig from "@/components/shared/brand.config.json";
import { getAppId, getConfiguredClientId, getAuthRedirectUri } from "@/components/shared/utils/config/config";

/**
 * Deriv API Configuration
 *
 * Official Deriv API Documentation:
 * - API Reference: https://developers.deriv.com/docs/
 * - WebSocket Specifications: https://developers.deriv.com/docs/websockets/
 *
 * Official Deriv GitHub Repositories:
 * - Main Deriv App (DTrader, Cashier, Account, Bot Web UI): https://github.com/deriv-com/deriv-app
 * - SmartTrader Platform: https://github.com/deriv-com/deriv-smarttrader
 * - Deriv API (WebSocket): https://github.com/deriv-com/deriv-api
 * - Deriv Copy Trading: https://github.com/deriv-com/copy-trading
 * - DBot: https://github.com/deriv-com/deriv-bot
 * - Derivatives Base (optional): https://github.com/deriv-com/derivatives
 */

// Get values lazily to avoid SSR issues
const getDerivAppId = () => {
  if (typeof window !== 'undefined') {
    return getAppId().toString();
  }
  return process.env.NEXT_PUBLIC_DERIV_APP_ID || 
         process.env.REACT_APP_DERIV_APP_ID || 
         process.env.DERIV_APP_ID || 
         brandConfig.oauth.app_id || 
         '33yStbGyLdNdqAyCuDk1d'; // Use '33yStbGyLdNdqAyCuDk1d' as default
};

const getDerivLegacyAppId = () => {
  return getDerivAppId(); // Legacy app ID is same as main app ID
};

const getOAuthClientId = () => {
  if (typeof window !== 'undefined') {
    return getConfiguredClientId();
  }
  return process.env.NEXT_PUBLIC_DERIV_OAUTH_CLIENT_ID || 
         process.env.REACT_APP_DERIV_OAUTH_CLIENT_ID || 
         process.env.DERIV_OAUTH_CLIENT_ID || 
         process.env.CLIENT_ID || 
         brandConfig.oauth.client_id || 
         '33yStbGyLdNdqAyCuDk1d';
};

const getOAuthRedirectUrl = () => {
  if (typeof window !== 'undefined') {
    return getAuthRedirectUri();
  }
  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  const brandRedirectUrl = brandConfig.oauth.redirect_uri;
  const productionUrl = brandRedirectUrl || 'https://protooldbot.vercel.app';

  if (isProduction) {
    return productionUrl;
  }
  
  return 'http://localhost:3001';
};

export const DERIV_APP_ID = getDerivAppId();
export const DERIV_LEGACY_APP_ID = getDerivLegacyAppId();
export const OAUTH_CLIENT_ID = getOAuthClientId();
export const DERIV_REDIRECT_URL = getOAuthRedirectUrl();

export const DERIV_CONFIG = {
    APP_ID: DERIV_APP_ID,
    OAUTH_CLIENT_ID: OAUTH_CLIENT_ID,
    REDIRECT_URL: DERIV_REDIRECT_URL,
} as const;

const oauthServerBaseUrl = brandConfig.oauth.server_base_url || 'https://auth.deriv.com';
const oauthAuthorizationPath = brandConfig.oauth.authorization_path || '/oauth2/auth';

export const DERIV_API = {
    // v1 Options WebSocket base (no app_id needed per new API)
    WEBSOCKET: 'wss://api.derivws.com/trading/v1/options/ws/public',
    // Legacy WebSocket base for standard { authorize: "<api_token>" } support
    WEBSOCKET_LEGACY: 'wss://ws.derivws.com/websockets/v3',
    // Named WebSocket URLs for new API (no app_id)
    WEBSOCKET_PUBLIC: 'wss://api.derivws.com/trading/v1/options/ws/public',
    WEBSOCKET_DEMO: 'wss://api.derivws.com/trading/v1/options/ws/demo',
    WEBSOCKET_REAL: 'wss://api.derivws.com/trading/v1/options/ws/real',
    // OAuth endpoints (per Deriv docs)
    OAUTH: 'https://oauth.deriv.com/oauth2/authorize',
    TOKEN: 'https://oauth.deriv.com/oauth2/token',
    // REST base URL (per Deriv docs)
    REST_BASE: 'https://api.derivws.com',
    // Options WS structure (kept for compatibility - no app_id)
    OPTIONS_WS: {
      DEMO: 'wss://api.derivws.com/trading/v1/options/ws/demo',
      REAL: 'wss://api.derivws.com/trading/v1/options/ws/real',
      PUBLIC: 'wss://api.derivws.com/trading/v1/options/ws/public',
    },
} as const;

// Official GitHub Repositories
export const DERIV_REPOS = {
    MAIN_APP: {
        name: 'deriv-app',
        url: 'https://github.com/deriv-com/deriv-app',
        description: 'Main Deriv web platform - includes DTrader, Cashier, and Account modules',
        branch: 'master',
        integration: 'For DTrader, Auth, and base styling (via iframe embedding and API auth)',
    },
    DBOT: {
        name: 'deriv-bot',
        url: 'https://github.com/deriv-com/deriv-bot',
        description: 'Official DBot (block-based automation bot builder)',
        branch: 'master',
        integration: 'For the DBot tab - runs inside iframe using app ID for Deriv API connection',
    },
    SMARTTRADER: {
        name: 'deriv-smarttrader',
        url: 'https://github.com/deriv-com/deriv-smarttrader',
        description: 'SmartTrader web trading interface',
        branch: 'master',
        integration: 'For the SmartTrader tab - embedded iframe + login passthrough',
    },
    COPYTRADING: {
        name: 'copy-trading',
        url: 'https://github.com/deriv-com/copy-trading',
        description: 'Official Copy Trading UI',
        branch: 'main',
        integration: 'For the Copy Trading tab - iframe with API token sync',
    },
    API: {
        name: 'deriv-api',
        url: 'https://github.com/deriv-com/deriv-api',
        description: 'Official Deriv WebSocket API SDK',
        branch: 'master',
        integration: 'For integrating trading and account features into custom apps',
    },
    DERIVATIVES: {
        name: 'derivatives',
        url: 'https://github.com/deriv-com/derivatives',
        description: "Deriv's open-source derivatives engine",
        branch: 'master',
        integration: 'Optional - Used for trade execution logic (if running backend trading logic)',
    },
} as const;
