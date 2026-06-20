'use client';

type MessageHandler = (message: any) => void;

interface TickData {
    quote: number;
    lastDigit: number;
    epoch: number;
    symbol: string;
    id?: string;
    pipSize?: number;
}

interface ConnectionLog {
    type: 'info' | 'error' | 'warning';
    message: string;
    timestamp: Date;
}

import { DERIV_CONFIG, DERIV_API } from './deriv-config';
import { extractLastDigit, calculateDecimalCount } from './digit-utils';

export type ConnectionState =
    | 'DISCONNECTED'
    | 'CONNECTING'
    | 'CONNECTED'
    | 'AUTHORIZING'
    | 'AUTHORIZED'
    | 'RECONNECTING';

/**
 * Unified Deriv WebSocket Manager — backed by the official @deriv/deriv-api DerivAPIBasic.
 * All public methods are unchanged so every tab, hook, and bot continues to work.
 */
export class DerivWebSocketManager {
    private static instance: DerivWebSocketManager | null = null;

    // Raw WebSocket (passed into DerivAPIBasic)
    private ws: WebSocket | null = null;
    // Official Deriv API wrapper
    private api: any | null = null;

    private messageHandlers: Map<string, MessageHandler[]> = new Map();
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 10;
    private reconnectDelay = 2000;
    private heartbeatInterval: NodeJS.Timeout | null = null;
    private lastMessageTime = Date.now();
    private messageQueue: any[] = [];
    private subscriptions: Map<string, string> = new Map();
    private subscriptionRefCount: Map<string, number> = new Map();
    private connectionPromise: Promise<void> | null = null;
    private reqIdCounter = 1000;

    private symbolsCache: any[] | null = null;
    private symbolsPromise: Promise<any[]> | null = null;
    private pipSizeMap: Map<string, number> = new Map();
    private pendingRequests: Map<number, (data: any) => void> = new Map();
    private symbolToSubscriptionMap: Map<string, string> = new Map();
    private activeSubscriptions: Set<string> = new Set();
    private tickCallbacks: Map<string, Set<(tick: TickData) => void>> = new Map();

    // New V1 API state
    private accessToken: string | null = null;
    private currentAccountId: string | null = null;
    private currentEndpoint: 'public' | 'demo' | 'real' = 'public';
    private isOtpConnection = false;

    // ── Reconnection guards ──
    // Suppress reconnect when we intentionally close the socket (during authorize/disconnect)
    private intentionalDisconnect = false;
    // Prevent parallel reconnection attempts
    private isReconnecting = false;
    // Circuit breaker: after N consecutive OTP reconnect failures, stop trying OTP
    private otpConsecutiveFailures = 0;
    private readonly OTP_MAX_FAILURES = 3;
    // Prevent parallel authorize calls
    private authorizePromise: Promise<void> | null = null;
    // Track active reconnect timer to cancel it
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    // Known robust precision fallbacks for synthetic indices (if API metadata is delayed)
    // Pip sizes = number of decimal places in the price quote.
    // These are fallbacks used ONLY before the live API metadata arrives.
    // Verified against Deriv live feeds — update when API changes pip values.
    private readonly COMMON_PIP_SIZES: Record<string, number> = {
        // Standard Volatility Indices
        R_10: 3, // Vol 10
        R_25: 2, // Vol 25
        R_50: 4, // Vol 50
        R_75: 4, // Vol 75
        R_100: 2, // Vol 100
        // 1-Second Volatility Indices (1HZ)
        '1HZ10V': 2, // Vol 10 1s
        '1HZ15V': 4, // Vol 15 1s  ← was 3 (incorrect last-digit extraction)
        '1HZ25V': 2, // Vol 25 1s
        '1HZ30V': 4, // Vol 30 1s  ← was 3 (incorrect last-digit extraction)
        '1HZ50V': 2, // Vol 50 1s
        '1HZ75V': 2, // Vol 75 1s
        '1HZ90V': 4, // Vol 90 1s  ← was 3 (incorrect last-digit extraction)
        '1HZ100V': 2, // Vol 100 1s
        '1HZ150V': 4, // Vol 150 1s
        '1HZ200V': 3, // Vol 200 1s
        '1HZ250V': 3, // Vol 250 1s
        '1HZ300V': 3, // Vol 300 1s
        // Bear/Bull Market Index
        '1HA100': 2, // Bull Market Index
        '1HA200': 2, // Bear Market Index
        // Jump Indices
        JUMP10: 3,
        JUMP25: 3,
        JUMP50: 3,
        JUMP75: 3,
        JUMP100: 3,
        // Jump Daily
        JD10: 3,
        JD25: 3,
        JD50: 3,
        JD75: 3,
        JD100: 3,
    };

    // Cache for historical data to prevent redundant fetches
    private historyCache: Map<string, { data: TickData[]; timestamp: number }> = new Map();
    private readonly CACHE_TTL = 30000; // 30 seconds

    // Auth caching and concurrency management (Options V1)
    private accountsCache: any[] | null = null;
    private accountsPromise: Promise<any[]> | null = null;

    private connectionLogs: ConnectionLog[] = [];
    private readonly maxLogs = 100;
    private connectionStatusListeners: Set<(status: 'connected' | 'disconnected' | 'reconnecting') => void> = new Set();

    public isAuthorized = false;
    private readonly appId = DERIV_CONFIG.APP_ID;
    private connectionState: ConnectionState = 'DISCONNECTED';

    private setConnectionState(newState: ConnectionState) {
        console.log(`[v0] 🔄 ConnectionState: ${this.connectionState} -> ${newState}`);
        this.connectionState = newState;

        // Map state machine states to legacy notify status callbacks
        if (newState === 'CONNECTED' || newState === 'AUTHORIZED') {
            this.notifyConnectionStatus('connected');
        } else if (newState === 'DISCONNECTED') {
            this.notifyConnectionStatus('disconnected');
        } else if (newState === 'RECONNECTING' || newState === 'CONNECTING') {
            this.notifyConnectionStatus('reconnecting');
        }
    }

    /**
     * Returns the correct app_id for the WebSocket connection.
     * Always returns the numeric app_id ("110211") as required by all WebSockets.
     */
    private getActiveAppId(legacyOnly = false): string {
        return '110211';
    }
    private currentWsUrl: string = DERIV_API.WEBSOCKET;

    private constructor() {}

    public static getInstance(): DerivWebSocketManager {
        if (!DerivWebSocketManager.instance) {
            DerivWebSocketManager.instance = new DerivWebSocketManager();
        }
        return DerivWebSocketManager.instance;
    }

    public getNextReqId(): number {
        return ++this.reqIdCounter;
    }

    public getAccountId(): string | null {
        return this.currentAccountId;
    }

    // ─── Connection ────────────────────────────────────────────────────────────

    public async connect(url?: string, force = false): Promise<void> {
        let targetUrl = url || this.currentWsUrl;

        // If targetUrl is the public websocket base without app_id, append it dynamically
        if (
            targetUrl === 'wss://api.derivws.com/trading/v1/options/ws/public' ||
            targetUrl === 'wss://api.derivws.com/trading/v1/options/ws/public/'
        ) {
            targetUrl = `wss://api.derivws.com/trading/v1/options/ws/public?app_id=${this.getActiveAppId()}`;
        }

        if (!force && this.ws) {
            const state = this.ws.readyState;
            if ((state === WebSocket.OPEN || state === WebSocket.CONNECTING) && this.ws.url === targetUrl) {
                if (state === WebSocket.OPEN) {
                    this.log('info', 'Already connected');
                    return Promise.resolve();
                }
                if (this.connectionPromise) return this.connectionPromise;
            }
            if (this.ws.url !== targetUrl) {
                this.ws.close();
            }
        }

        this.currentWsUrl = targetUrl;
        if (this.connectionPromise) return this.connectionPromise;

        if (this.connectionState !== 'RECONNECTING') {
            this.setConnectionState('CONNECTING');
        }

        this.connectionPromise = new Promise((resolve, reject) => {
            let settled = false;
            const settle = (fn: () => void) => {
                if (!settled) {
                    settled = true;
                    fn();
                }
            };

            try {
                console.log(`[v0] 🚀 Opening WebSocket: ${this.currentWsUrl}`);
                this.log('info', `Connecting to ${this.currentWsUrl}`);

                // Create raw WebSocket and capture its reference
                this.ws = new WebSocket(this.currentWsUrl);
                const wsInstance = this.ws;

                // Wrap with DerivAPIBasic (the bundle uses CommonJS exports)
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const DerivAPIBasic = require('@deriv/deriv-api/dist/DerivAPIBasic');
                const API = DerivAPIBasic?.default ?? DerivAPIBasic;
                this.api = new API({ connection: this.ws });

                const connectionTimeout = setTimeout(() => {
                    if (wsInstance !== this.ws) return;
                    if (this.ws?.readyState !== WebSocket.OPEN) {
                        this.log('error', 'Connection timeout after 10 seconds');
                        this.ws?.close();
                        this.connectionPromise = null;
                        this.setConnectionState('DISCONNECTED');
                        reject(new Error('Connection timeout'));
                    }
                }, 10000);

                // Use addEventListener to avoid overwriting DerivAPIBasic's internal .onopen/.onclose handlers
                this.ws.addEventListener('open', () => {
                    if (wsInstance !== this.ws) return;
                    clearTimeout(connectionTimeout);
                    console.log(`[v0] DerivAPIBasic WebSocket connected to ${this.ws?.url}`);
                    this.log('info', `Connected to ${this.ws?.url}`);
                    this.reconnectAttempts = 0;
                    this.lastMessageTime = Date.now();
                    this.setConnectionState('CONNECTED');
                    this.startHeartbeat();
                    this.processMessageQueue();
                    this.connectionPromise = null;
                    settle(() => resolve());
                });

                // Route all messages through our existing routeMessage handler using the RAW WebSocket event.
                this.ws.addEventListener('message', event => {
                    if (wsInstance !== this.ws) return;
                    try {
                        this.lastMessageTime = Date.now();
                        const data = JSON.parse(event.data);

                        // Console trace for every message to help debug timeouts
                        if (data.msg_type) {
                            console.log(
                                `[v0] 📥 Incoming Raw: ${data.msg_type}${data.req_id ? ` (req_id: ${data.req_id})` : ''}`
                            );
                        }

                        this.routeMessage(data);
                    } catch (err) {
                        console.error('[v0] Raw message parsing/routing error:', err);
                    }
                });

                this.ws.addEventListener('error', event => {
                    if (wsInstance !== this.ws) return;
                    clearTimeout(connectionTimeout);
                    const msg = (event as ErrorEvent).message || 'WebSocket connection failed';
                    console.error('[v0] WebSocket error:', msg, event);
                    this.log('error', `WebSocket error: ${msg}`);
                    this.connectionPromise = null;
                    this.setConnectionState('DISCONNECTED');
                    this.rejectAllPendingRequests(new Error(msg));
                    settle(() => reject(new Error(msg)));
                });

                this.ws.addEventListener('close', event => {
                    if (wsInstance !== this.ws) return;
                    clearTimeout(connectionTimeout);
                    const reason = event.reason || `code ${event.code}`;
                    settle(() => reject(new Error(`WebSocket closed during connection: ${reason}`)));
                    this.connectionPromise = null;
                    this.stopHeartbeat();
                    this.setConnectionState('DISCONNECTED');
                    this.rejectAllPendingRequests(new Error('WebSocket connection closed'));

                    // CRITICAL: Only reconnect if this was NOT an intentional close
                    if (this.intentionalDisconnect) {
                        console.log(`[v0] WebSocket closed intentionally (${reason}), skipping reconnect.`);
                        this.intentionalDisconnect = false;
                    } else {
                        console.log(`[v0] WebSocket closed unexpectedly (${reason}), reconnecting…`);
                        this.log('warning', `WebSocket closed (${reason}), reconnecting…`);
                        this.handleReconnect();
                    }
                });
            } catch (error) {
                console.error('[v0] Connection setup error:', error);
                this.log('error', `Connection setup error: ${error}`);
                this.connectionPromise = null;
                this.setConnectionState('DISCONNECTED');
                this.rejectAllPendingRequests(error instanceof Error ? error : new Error(String(error)));
                settle(() => reject(error instanceof Error ? error : new Error(String(error))));
            }
        });

        return this.connectionPromise;
    }

    /**
     * Callback invoked when a REST call returns 401 Unauthorized.
     * Set by the auth layer (e.g. deriv-api-context) to trigger re-login.
     */
    public onTokenExpired: (() => void) | null = null;

    /**
     * Helper for authenticated REST API calls (Deriv V1) with 429 (Rate Limit) handling.
     */
    private async fetchWithAuth(path: string, options: RequestInit = {}, retryCount = 0): Promise<any> {
        if (!this.accessToken) throw new Error('No access token available');

        const url = `${DERIV_API.REST_BASE}${path}`;
        const headers = new Headers(options.headers);
        headers.set('Authorization', `Bearer ${this.accessToken}`);
        headers.set('Deriv-App-ID', this.getActiveAppId());

        const hasBody = options.body !== undefined && options.body !== null;
        if (hasBody && !headers.has('Content-Type')) {
            headers.set('Content-Type', 'application/json');
        }

        console.log(`[v0] REST ${options.method || 'GET'} ${url}${retryCount > 0 ? ` (retry ${retryCount})` : ''}`);

        try {
            const response = await fetch(url, { ...options, headers });

            // 429 = Rate Limit Exceeded
            if (response.status === 429) {
                if (retryCount >= 3) {
                    throw new Error('Rate limit exceeded (429) and max retries reached.');
                }

                // 1. Read Retry-After header (seconds)
                let retryAfter = parseInt(response.headers.get('Retry-After') || '0');

                // 2. Default backoff: [5s, 10s, 20s]
                if (retryAfter <= 0) {
                    const backoffs = [5, 10, 20];
                    retryAfter = backoffs[retryCount];
                }

                this.log('warning', `Rate limit hit (429). Retrying in ${retryAfter}s...`);
                await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
                return this.fetchWithAuth(path, options, retryCount + 1);
            }

            // 401 = access_token expired — notify the auth layer to re-initiate login
            if (response.status === 401) {
                this.log('warning', 'REST 401: access token expired. Notifying auth layer.');
                this.isAuthorized = false;
                this.accessToken = null;
                this.accountsCache = null; // Invalidate local cache
                this.clearGlobalCache(); // Invalidate global tab cache
                if (this.onTokenExpired) this.onTokenExpired();
                throw new Error('Access token expired (401). Please log in again.');
            }

            if (!response.ok) {
                const errorText = await response.text();
                try {
                    const errorJson = JSON.parse(errorText);
                    throw new Error(errorJson.error?.message || `HTTP ${response.status}: ${errorText}`);
                } catch {
                    throw new Error(`HTTP ${response.status}: ${errorText}`);
                }
            }
            return response.json();
        } catch (err) {
            if (err instanceof Error && err.message.includes('429')) throw err;
            // Connection errors or timeouts
            throw err;
        }
    }
    /**
     * Internal helper to fetch accounts once per session with a promise-based mutex.
     * Now includes localStorage synchronization to share state across multiple tabs.
     */
    private async getAccounts(): Promise<any[]> {
        if (this.accountsCache) return this.accountsCache;

        // 1. Try reading from Global Cross-Tab Cache first
        const tokenHash = this.accessToken ? this.accessToken.substring(0, 8) : 'none';
        const cacheKey = `deriv_accounts_v1_${tokenHash}`;
        const lockKey = `deriv_auth_lock_v1_${tokenHash}`;

        try {
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                const parsed = JSON.parse(cached);
                this.accountsCache = parsed;
                console.log('[v0] 🌐 Using Cross-Tab Cached Accounts.');
                return parsed;
            }
        } catch {
            /* SSR or parse error */
        }

        // 2. Check for Global Cross-Tab Lock (someone else is already fetching)
        const MAX_WAIT = 15; // 15 seconds max wait for other tab
        for (let i = 0; i < MAX_WAIT; i++) {
            const lockTime = parseInt(localStorage.getItem(lockKey) || '0');
            const now = Date.now();

            // If no lock or lock is stale (> 20s), we take it
            if (!lockTime || now - lockTime > 20000) {
                break;
            }

            // Someone else is fetching. Wait and check cache again.
            console.log(`[v0] 🛰️ Waiting for other tab to finish /accounts fetch (${i + 1}/${MAX_WAIT})...`);
            await new Promise(resolve => setTimeout(resolve, 1000));

            try {
                const reCached = localStorage.getItem(cacheKey);
                if (reCached) {
                    const parsed = JSON.parse(reCached);
                    this.accountsCache = parsed;
                    return parsed;
                }
            } catch {
                /* ignore */
            }
        }

        // 3. Perform the fetch (and hold the local promise-mutex too)
        if (this.accountsPromise) return this.accountsPromise;

        this.accountsPromise = (async () => {
            try {
                // Take the global lock
                localStorage.setItem(lockKey, Date.now().toString());

                const accountsRes = await this.fetchWithAuth('/trading/v1/options/accounts');
                const accounts = accountsRes?.data ?? accountsRes ?? [];

                this.accountsCache = accounts;
                // Update global cache for other tabs
                localStorage.setItem(cacheKey, JSON.stringify(accounts));

                return accounts || [];
            } finally {
                this.accountsPromise = null;
                localStorage.removeItem(lockKey); // Release lock
            }
        })();

        return this.accountsPromise;
    }

    private clearGlobalCache() {
        try {
            const tokenHash = this.accessToken ? this.accessToken.substring(0, 8) : 'none';
            localStorage.removeItem(`deriv_accounts_v1_${tokenHash}`);
            localStorage.removeItem(`deriv_auth_lock_v1_${tokenHash}`);
        } catch {
            /* ignore */
        }
    }

    /**
   * New V1 Authorization Flow:
  /**
   * New V1 Authorization Flow with Legacy Fallback:
   * 1. Detect if token is legacy (direct auth) or modern (REST+OTP).
   * 2. For modern: Fetch accounts via REST, get OTP, reconnect.
   * 3. For legacy or failure: Fallback to direct WebSocket { authorize: token }.
   */
    public async authorize(token: string): Promise<void> {
        if (!token) return;

        // Prevent parallel authorize calls — return the existing promise if one is in-flight
        if (this.authorizePromise) {
            console.log('[v0] ⏳ authorize() already in progress, waiting for existing call...');
            return this.authorizePromise;
        }

        this.authorizePromise = this._doAuthorize(token);
        try {
            await this.authorizePromise;
        } finally {
            this.authorizePromise = null;
        }
    }

    private async _doAuthorize(token: string): Promise<void> {
        this.accessToken = token;
        this.setConnectionState('AUTHORIZING');

        // If the current WebSocket URL already contains an OTP, the connection is already authenticated.
        // Skip the REST handshake to avoid infinite loop or redundant calls.
        if (this.ws?.url && this.ws.url.includes('otp=') && this.ws.readyState === WebSocket.OPEN) {
            this.isAuthorized = true;
            this.isOtpConnection = true;
            this.setConnectionState('AUTHORIZED');
            console.log('[v0] Connection is already authenticated via OTP URL.');
            return;
        }

        const oauthFlowType = typeof window !== 'undefined' ? localStorage.getItem('oauth_flow_type') : null;

        if (oauthFlowType !== 'modern') {
            console.log(
                `[v0] ${oauthFlowType || 'Default'} flow detected. Skipping REST handshake and going straight to direct WebSocket authorize.`
            );
            this.isOtpConnection = false;
            await this.authorizeDirectly(token);
            return;
        }

        try {
            this.log('info', `Starting modern V1 Authorization for: ${token.substring(0, 5)}...`);

            // 1. Fetch available accounts via REST (Once per session)
            const accounts = await this.getAccounts();

            if (accounts.length > 0) {
                // 2. Pick an account
                const activeLoginId = typeof window !== 'undefined' ? localStorage.getItem('active_login_id') : null;
                if (activeLoginId && accounts.some((a: any) => a.account_id === activeLoginId)) {
                    this.currentAccountId = activeLoginId;
                    this.log('info', `Selected stored active account: ${this.currentAccountId}`);
                } else if (
                    !this.currentAccountId ||
                    !accounts.some((a: any) => a.account_id === this.currentAccountId)
                ) {
                    const targetAccount = accounts.find((a: any) => a.account_type === 'demo') || accounts[0];
                    this.currentAccountId = targetAccount.account_id;
                    this.log(
                        'info',
                        `Selected default account: ${this.currentAccountId} (${targetAccount.account_type})`
                    );
                }

                const targetAccount = accounts.find((a: any) => a.account_id === this.currentAccountId) || accounts[0];

                // 3. Obtain OTP for this account (Always fresh for new connection)
                const otpRes = await this.fetchWithAuth(`/trading/v1/options/accounts/${this.currentAccountId}/otp`, {
                    method: 'POST',
                });

                const otpUrl = otpRes?.data?.url?.trim();
                if (otpUrl) {
                    this.log('info', 'OTP obtained. Reconnecting to authenticated environment...');
                    this.currentEndpoint = targetAccount.account_type === 'demo' ? 'demo' : 'real';

                    // Intentional disconnect — suppress auto-reconnect
                    await this.disconnect();
                    this.isOtpConnection = true;
                    this.otpConsecutiveFailures = 0; // Reset circuit breaker on fresh authorize
                    // OTP URL is a complete wss:// URL — connect to it directly.
                    await this.connect(otpUrl, true);

                    this.isAuthorized = true;
                    this.setConnectionState('AUTHORIZED');

                    // Persist selected account for other tabs to pick up
                    try {
                        localStorage.setItem('deriv_active_loginid', this.currentAccountId || '');
                    } catch {
                        /* ignore */
                    }

                    // Synthesize legacy 'authorize' event to sync UI components (balances, etc.)
                    const syntheticAuthorize = {
                        msg_type: 'authorize',
                        authorize: {
                            loginid: targetAccount.account_id,
                            is_virtual: targetAccount.account_type === 'demo' ? 1 : 0,
                            currency: targetAccount.currency,
                            balance: parseFloat(targetAccount.balance || '0'),
                            landing_company_name: targetAccount.account_type,
                            account_list: accounts.map((acc: any) => ({
                                loginid: acc.account_id,
                                is_virtual: acc.account_type === 'demo' ? 1 : 0,
                                currency: acc.currency,
                                balance: parseFloat(acc.balance || '0'),
                            })),
                        },
                    };
                    this.emit('authorize', syntheticAuthorize);
                    console.log(`[v0] ✅ Successfully authorized modern connection for ${this.currentAccountId}`);
                    return;
                }
            }
            throw new Error('No suitable options accounts found for this token.');
        } catch (e) {
            console.warn('[v0] Modern auth failed. Falling back to direct WebSocket authorize...', e);
            this.log(
                'warning',
                `Modern auth failed: ${e instanceof Error ? e.message : String(e)}. Falling back to direct WebSocket authorize.`
            );
            this.isOtpConnection = false;
            await this.authorizeDirectly(token);
        }
    }

    private async authorizeDirectly(token: string): Promise<void> {
        try {
            // IMPORTANT: authorizeDirectly ALWAYS connects to the legacy V3 WebSocket.
            // That endpoint requires a NUMERIC app_id. The string OAuth ID
            // (33tdJCamBVncjRj9m3WFe) will cause InputValidationFailed.
            const legacyAppId = this.getActiveAppId(true); // legacyOnly=true → always "110211"
            const publicUrl = `${DERIV_API.WEBSOCKET_LEGACY}?app_id=${legacyAppId}`;

            if (
                !this.isConnected() ||
                (this.ws?.url && (this.ws.url.includes('otp=') || this.ws.url.includes('trading/v1/options')))
            ) {
                // Intentional disconnect — suppress auto-reconnect
                await this.disconnect();
                await this.connect(publicUrl, true);
            }

            console.log(`[v0] Sending authorize message over WebSocket with App ID ${legacyAppId}...`);
            const response = await this.sendAndWait({ authorize: token }, 20000);

            if (response.error) {
                throw response.error;
            }

            this.isAuthorized = true;
            this.setConnectionState('AUTHORIZED');
            const { authorize } = response;
            this.currentAccountId = authorize.loginid;

            try {
                localStorage.setItem('deriv_active_loginid', authorize.loginid || '');
            } catch {
                /* ignore */
            }

            this.emit('authorize', response);
            console.log(`[v0] ✅ Successfully authorized via fallback WebSocket for ${this.currentAccountId}`);
        } catch (fallbackError: any) {
            console.error('[v0] Fallback WebSocket authorize failed:', fallbackError);
            this.log('error', `Fallback authorize failed: ${fallbackError?.message || String(fallbackError)}`);
            this.isAuthorized = false;
            this.setConnectionState('DISCONNECTED');
            throw fallbackError;
        }
    }

    // tryAutoAuthorize intentionally disabled — authorization is driven by the
    // React auth hook/context, which calls manager.authorize() exactly once.
    // Having it here on every ws.open caused parallel auth flows that fought
    // each other, creating OTP spam and 429 loops.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private tryAutoAuthorize() {
        // NO-OP: Authorization is managed externally.
    }

    // ─── Heartbeat & reconnect ─────────────────────────────────────────────────

    private handleReconnect() {
        this.setConnectionState('RECONNECTING');
        // ── Guard: prevent parallel reconnection attempts ──
        if (this.isReconnecting) {
            console.log('[v0] handleReconnect: Already reconnecting, skipping.');
            return;
        }

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.log('error', 'Max reconnection attempts reached. Waiting 60s before reset.');
            this.isReconnecting = false;
            this.reconnectTimer = setTimeout(() => {
                this.reconnectAttempts = 0;
                this.otpConsecutiveFailures = 0;
                this.handleReconnect();
            }, 60000);
            return;
        }

        this.isReconnecting = true;

        // ── OTP Reconnection Path (Modern V1 REST + OTP) ──
        if (this.isOtpConnection && this.accessToken && this.currentAccountId) {
            // Circuit breaker: after N consecutive OTP failures, stop hammering the endpoint
            if (this.otpConsecutiveFailures >= this.OTP_MAX_FAILURES) {
                console.warn(
                    `[v0] ⛔ Circuit breaker: ${this.otpConsecutiveFailures} consecutive OTP failures. Stopping OTP reconnection.`
                );
                this.log(
                    'error',
                    `Circuit breaker activated after ${this.otpConsecutiveFailures} OTP failures. Waiting 60s.`
                );
                this.isReconnecting = false;
                this.reconnectTimer = setTimeout(() => {
                    this.otpConsecutiveFailures = 0;
                    this.reconnectAttempts = 0;
                    this.handleReconnect();
                }, 60000);
                return;
            }

            this.messageQueue = []; // Prevent stale messages from previous connection
            // Exponential backoff: [2s, 4s, 8s, 16s, 30s]
            const otpDelays = [2000, 4000, 8000, 16000, 30000];
            const delayMs = otpDelays[Math.min(this.reconnectAttempts, otpDelays.length - 1)];
            this.reconnectAttempts++;
            this.log(
                'info',
                `[OTP] Fetching fresh OTP for ${this.currentAccountId} in ${delayMs}ms (attempt ${this.reconnectAttempts})...`
            );
            this.reconnectTimer = setTimeout(async () => {
                try {
                    // Reuses the already cached account ID. Never calls /accounts during reconnect.
                    const otpRes = await this.fetchWithAuth(
                        `/trading/v1/options/accounts/${this.currentAccountId}/otp`,
                        { method: 'POST' }
                    );
                    const otpUrl = otpRes?.data?.url?.trim();
                    if (!otpUrl) throw new Error('OTP response missing data.url');

                    // Intentional disconnect — suppress the close handler from calling handleReconnect again
                    this.intentionalDisconnect = true;
                    if (this.ws) {
                        this.ws.close();
                        this.ws = null;
                    }
                    this.api = null;
                    this.connectionPromise = null;

                    await this.connect(otpUrl, true);

                    this.reconnectAttempts = 0;
                    this.otpConsecutiveFailures = 0;
                    this.isAuthorized = true;
                    this.setConnectionState('AUTHORIZED');
                    this.isReconnecting = false;
                    this.log('info', `[OTP] Reconnected successfully for ${this.currentAccountId}`);
                } catch (err) {
                    this.otpConsecutiveFailures++;
                    this.log(
                        'error',
                        `[OTP] Reconnection attempt failed (${this.otpConsecutiveFailures}/${this.OTP_MAX_FAILURES}): ${err}`
                    );
                    this.isReconnecting = false;
                    this.handleReconnect();
                }
            }, delayMs);
            return;
        }

        // ── Standard (non-OTP) Reconnection Path ──
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
        this.log('info', `Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.reconnectTimer = setTimeout(() => {
            this.connect(this.currentWsUrl, true)
                .then(() => {
                    this.isReconnecting = false;
                })
                .catch(err => {
                    this.log('error', `Reconnection failed: ${err}`);
                    this.isReconnecting = false;
                });
        }, delay);
    }

    private startHeartbeat() {
        this.stopHeartbeat();
        // Delay heartbeat start after opening to let OTP session stabilize
        setTimeout(() => {
            this.heartbeatInterval = setInterval(() => {
                const timeSinceLastMessage = Date.now() - this.lastMessageTime;
                if (timeSinceLastMessage > 60000) {
                    this.log('warning', 'No messages for 60s, reconnecting');
                    this.ws?.close();
                    return;
                }
                if (this.ws?.readyState === WebSocket.OPEN) {
                    try {
                        this.send({ ping: 1, req_id: this.getNextReqId() });
                    } catch (err) {
                        this.log('error', `Heartbeat ping failed: ${err}`);
                    }
                }
            }, 30000);
        }, 5000); // 5-second grace period
    }

    private stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    private processMessageQueue() {
        while (this.messageQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
            this.send(this.messageQueue.shift());
        }
    }

    // ─── Send ──────────────────────────────────────────────────────────────────

    public send(message: any): void {
        if (this.api && this.ws?.readyState === WebSocket.OPEN) {
            // DerivAPIBasic.send() returns a Promise — suppress unhandled rejection for fire-and-forget
            this.api.send(message).catch(() => {});
        } else if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            this.messageQueue.push(message);
        }
    }

    /**
     * Send a message and await the response via DerivAPIBasic's native Promise API.
     */
    public async sendAndWait(message: any, timeoutMs = 30000): Promise<any> {
        if (this.ws?.readyState !== WebSocket.OPEN) {
            console.log('[v0] sendAndWait: WebSocket not open, connecting...');
            await this.connect();
        }

        const req_id = message.req_id || this.getNextReqId();
        const payload = { ...message, req_id };

        return new Promise((resolve, reject) => {
            const t = setTimeout(() => {
                if (this.pendingRequests.has(req_id)) {
                    this.pendingRequests.delete(req_id);
                    reject(new Error(`Request ${req_id} timed out after ${timeoutMs}ms`));
                }
            }, timeoutMs);

            this.pendingRequests.set(req_id, data => {
                clearTimeout(t);
                this.pendingRequests.delete(req_id);
                if (data.error) {
                    reject(data.error);
                } else {
                    resolve(data);
                }
            });

            if (this.ws?.readyState === WebSocket.OPEN) {
                try {
                    this.ws.send(JSON.stringify(payload));
                } catch (err) {
                    clearTimeout(t);
                    this.pendingRequests.delete(req_id);
                    reject(err);
                }
            } else {
                // Double check: if still not open after connect(), queue it
                this.messageQueue.push(payload);
            }
        });
    }

    // ─── Message routing ───────────────────────────────────────────────────────

    private routeMessage(message: any) {
        try {
            if (message.msg_type === 'ping' || message.echo_req?.ping) return;

            // Resolve pending req_id-based requests (fallback path)
            if (message.req_id) {
                const req_id = Number(message.req_id);
                const callback = this.pendingRequests.get(req_id);

                // Track subscription IDs
                if (message.subscription && !message.error) {
                    const symbol =
                        message.echo_req?.ticks ||
                        message.echo_req?.underlying_symbol ||
                        message.echo_req?.active_symbols;
                    if (symbol && typeof symbol === 'string') {
                        const subId = message.subscription.id;
                        const existing = this.symbolToSubscriptionMap.get(symbol);
                        if (existing && existing !== subId) {
                            this.send({ forget: subId, req_id: this.getNextReqId() });
                        } else {
                            this.subscriptions.set(subId, symbol);
                            this.symbolToSubscriptionMap.set(symbol, subId);
                            if (!this.subscriptionRefCount.has(subId)) this.subscriptionRefCount.set(subId, 1);
                        }
                    }
                }

                if (callback) {
                    this.pendingRequests.delete(req_id);
                    callback(message);
                }
            }

            // Tick handling
            if (message.tick) {
                const symbol = message.tick.underlying_symbol || message.tick.symbol;
                if (message.subscription?.id) {
                    const subId = message.subscription.id;
                    const existing = this.symbolToSubscriptionMap.get(symbol);
                    if (!existing) {
                        this.subscriptions.set(subId, symbol);
                        this.symbolToSubscriptionMap.set(symbol, subId);
                        if (!this.subscriptionRefCount.has(subId)) this.subscriptionRefCount.set(subId, 1);
                    } else if (existing !== subId) {
                        this.send({ forget: subId, req_id: this.getNextReqId() });
                    }
                }
                const callbacks = this.tickCallbacks.get(symbol);
                if (callbacks) {
                    const rawPip = message.tick.pip_size !== undefined ? Number(message.tick.pip_size) : undefined;
                    if (rawPip !== undefined) this.pipSizeMap.set(symbol, rawPip);
                    const pipSize = this.getPipSize(symbol, rawPip);
                    const tickData: TickData = {
                        quote: message.tick.quote,
                        lastDigit: this.extractLastDigit(message.tick.quote, pipSize),
                        epoch: message.tick.epoch,
                        symbol,
                        id: message.subscription?.id,
                        pipSize: pipSize,
                    };
                    callbacks.forEach(cb => cb(tickData));
                }
            }

            // Route by msg_type
            if (message.msg_type) {
                (this.messageHandlers.get(message.msg_type) || []).forEach(h => h(message));
            }

            // Legacy msg_type-less messages
            if (!message.msg_type) {
                if (message.proposal) (this.messageHandlers.get('proposal') || []).forEach(h => h(message));
                if (message.buy) (this.messageHandlers.get('buy') || []).forEach(h => h(message));
            }

            if (message.error) (this.messageHandlers.get('error') || []).forEach(h => h(message));
            (this.messageHandlers.get('*') || []).forEach(h => h(message));
        } catch (error) {
            console.error('[v0] Error routing message:', error);
        }
    }

    // ─── Message handler registration ─────────────────────────────────────────

    public on(event: string, handler: MessageHandler) {
        if (!this.messageHandlers.has(event)) this.messageHandlers.set(event, []);
        this.messageHandlers.get(event)!.push(handler);
    }

    public off(event: string, handler: MessageHandler) {
        const handlers = this.messageHandlers.get(event);
        if (handlers) {
            const i = handlers.indexOf(handler);
            if (i > -1) handlers.splice(i, 1);
        }
    }

    /**
     * Internal emitter for synthesizing messages (e.g. from V1 REST handshake)
     */
    private emit(event: string, data: any) {
        const handlers = this.messageHandlers.get(event) || [];
        const universalHandlers = this.messageHandlers.get('*') || [];

        // Notify specific event handlers
        handlers.forEach(h => {
            try {
                h(data);
            } catch (e) {
                console.error(`[v0] Error in ${event} handler:`, e);
            }
        });

        // Notify universal handlers
        universalHandlers.forEach(h => {
            try {
                h(data);
            } catch (e) {
                console.error(`[v0] Error in universal handler for ${event}:`, e);
            }
        });
    }

    // ─── Tick subscriptions ────────────────────────────────────────────────────

    public async subscribeTicks(symbol: string, callback: (tick: TickData) => void): Promise<string> {
        if (!symbol || typeof symbol !== 'string' || symbol.trim() === '') {
            console.warn('[v0] subscribeTicks: Invalid symbol provided:', symbol);
            return '';
        }
        const cleanSymbol = symbol.trim();
        if (!this.tickCallbacks.has(cleanSymbol)) this.tickCallbacks.set(cleanSymbol, new Set());
        this.tickCallbacks.get(cleanSymbol)!.add(callback);

        const existingId = this.symbolToSubscriptionMap.get(cleanSymbol);
        if (existingId) {
            const ref = this.subscriptionRefCount.get(existingId) || 0;
            this.subscriptionRefCount.set(existingId, ref + 1);
            return existingId;
        }

        if (this.activeSubscriptions.has(cleanSymbol)) {
            return new Promise(resolve => {
                const check = setInterval(() => {
                    const id = this.symbolToSubscriptionMap.get(cleanSymbol);
                    if (id) {
                        clearInterval(check);
                        const ref = this.subscriptionRefCount.get(id) || 0;
                        this.subscriptionRefCount.set(id, ref + 1);
                        resolve(id);
                    }
                }, 200);
                setTimeout(() => {
                    clearInterval(check);
                    resolve('');
                }, 15000);
            });
        }

        this.activeSubscriptions.add(cleanSymbol);

        let lastError: any = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                console.log(`[v0] Subscribing to ${cleanSymbol} (attempt ${attempt})`);
                const response = await this.sendAndWait({ ticks: cleanSymbol, subscribe: 1 }, 30000);

                if (response.subscription?.id) {
                    const subscriptionId = response.subscription.id;
                    const existing = this.symbolToSubscriptionMap.get(cleanSymbol);
                    if (existing && existing !== subscriptionId) {
                        this.send({ forget: subscriptionId, req_id: this.getNextReqId() });
                        const ref = this.subscriptionRefCount.get(existing) || 0;
                        this.subscriptionRefCount.set(existing, ref + 1);
                        this.activeSubscriptions.delete(cleanSymbol);
                        return existing;
                    }
                    this.subscriptions.set(subscriptionId, cleanSymbol);
                    this.symbolToSubscriptionMap.set(cleanSymbol, subscriptionId);
                    this.subscriptionRefCount.set(subscriptionId, 1);
                    this.activeSubscriptions.delete(cleanSymbol);
                    const pipSize = this.getPipSize(cleanSymbol);
                    callback({
                        quote: response.tick.quote,
                        lastDigit: this.extractLastDigit(response.tick.quote, pipSize),
                        epoch: response.tick.epoch,
                        symbol: cleanSymbol,
                        id: subscriptionId,
                        pipSize: pipSize,
                    });
                    return subscriptionId;
                }
                throw new Error(response.error?.message || 'Invalid subscription response');
            } catch (error: any) {
                lastError = error;
                if (error.code === 'AlreadySubscribed') {
                    await new Promise(r => setTimeout(r, 1000));
                    const recoveredId = this.symbolToSubscriptionMap.get(cleanSymbol);
                    if (recoveredId) {
                        const ref = this.subscriptionRefCount.get(recoveredId) || 0;
                        this.subscriptionRefCount.set(recoveredId, ref + 1);
                        this.activeSubscriptions.delete(cleanSymbol);
                        return recoveredId;
                    }
                }
                if (attempt < 3) await new Promise(r => setTimeout(r, 1000 * attempt));
            }
        }

        this.activeSubscriptions.delete(cleanSymbol);
        // Decode the error: empty {} usually means SymbolNotFound or MarketIsClosed
        const errMsg =
            lastError?.error?.message ||
            lastError?.message ||
            (typeof lastError === 'object' && Object.keys(lastError).length === 0
                ? 'SymbolNotFound or market not available on this connection'
                : JSON.stringify(lastError));
        const errCode = lastError?.error?.code || lastError?.code || 'unknown';
        // Only log as error for truly unexpected failures; symbol-not-found is expected for some markets
        if (['SymbolNotFound', 'MarketIsClosed', 'InvalidSymbol', 'unknown'].includes(errCode)) {
            console.warn(`[v0] subscribeTicks: ${cleanSymbol} not available (${errCode}): ${errMsg}`);
        } else {
            console.error(`[v0] Failed to subscribe to ${cleanSymbol}: [${errCode}] ${errMsg}`);
        }

        return '';
    }

    public async unsubscribe(subscriptionId: string, callback?: (tick: TickData) => void) {
        if (!subscriptionId || typeof subscriptionId !== 'string') return;
        const symbol = this.subscriptions.get(subscriptionId);
        if (symbol && callback) {
            const cbs = this.tickCallbacks.get(symbol);
            if (cbs) {
                cbs.delete(callback);
                if (cbs.size === 0) this.tickCallbacks.delete(symbol);
            }
        }
        const ref = this.subscriptionRefCount.get(subscriptionId) || 1;
        if (ref > 1) {
            this.subscriptionRefCount.set(subscriptionId, ref - 1);
            return;
        }
        if (symbol) {
            this.symbolToSubscriptionMap.delete(symbol);
            this.tickCallbacks.delete(symbol);
        }
        try {
            this.send({ forget: subscriptionId, req_id: this.getNextReqId() });
            this.subscriptions.delete(subscriptionId);
            this.subscriptionRefCount.delete(subscriptionId);
        } catch (error) {
            console.error('[v0] Unsubscribe error:', error);
        }
    }

    public async unsubscribeAll() {
        // Forget all subscription types the server may hold open
        this.send({
            forget_all: ['ticks', 'balance', 'proposal_open_contract', 'transaction'],
            req_id: this.getNextReqId(),
        });
        this.subscriptions.clear();
        this.subscriptionRefCount.clear();
        this.symbolToSubscriptionMap.clear();
        this.tickCallbacks.clear();
        this.activeSubscriptions.clear();
        this.log('info', 'Unsubscribed from all active subscriptions (ticks, balance, proposals, transactions)');
    }

    // ─── History ───────────────────────────────────────────────────────────────

    /**
     * Fetch historical ticks for a symbol with caching.
     */
    /**
     * Fetch historical ticks for a symbol.
     * Deriv API hard-limit: 5000 ticks per request (documented at developers.deriv.com).
     * Requesting more than 5000 returns an error; the API will silently cap at 5000.
     */
    public async getTicksHistory(symbol: string, count = 5000): Promise<TickData[]> {
        if (!symbol || typeof symbol !== 'string') {
            return [];
        }
        const cleanSymbol = symbol.trim();
        if (cleanSymbol === '') return [];

        // Check cache first
        const cached = this.historyCache.get(cleanSymbol);
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL && cached.data.length >= count) {
            this.log('info', `Returning ${count} cached historical ticks for ${cleanSymbol}`);
            return cached.data.slice(-count);
        }

        try {
            this.log('info', `Fetching ${count} historical ticks for ${cleanSymbol}`);
            const response = await this.sendAndWait({
                ticks_history: cleanSymbol,
                adjust_start_time: 1,
                count,
                end: 'latest',
                style: 'ticks',
            });

            if (response.history) {
                const prices = Array.isArray(response.history.prices) ? response.history.prices : [];
                const times = Array.isArray(response.history.times) ? response.history.times : [];
                const pipSize = this.getPipSize(symbol);

                const data = prices.map((price: number, i: number) => ({
                    quote: price,
                    lastDigit: this.extractLastDigit(price, pipSize),
                    epoch: times[i],
                    symbol,
                    pipSize: pipSize,
                }));

                // Update cache
                this.historyCache.set(symbol, { data, timestamp: Date.now() });

                return data;
            }
            return [];
        } catch (error: any) {
            this.log('error', `getTicksHistory failed for ${cleanSymbol}: ${error.message || JSON.stringify(error)}`);
            console.error('[v0] getTicksHistory error:', error);
            return [];
        }
    }

    // ─── Active symbols ────────────────────────────────────────────────────────

    public async getActiveSymbols(): Promise<
        Array<{ symbol: string; display_name: string; market?: string; market_display_name?: string }>
    > {
        if (this.symbolsCache) return this.symbolsCache;
        if (this.symbolsPromise) return this.symbolsPromise;

        this.symbolsPromise = (async () => {
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    const response = await this.sendAndWait({ active_symbols: 'brief' }, 15000);
                    if (response?.active_symbols) {
                        let mapped = response.active_symbols.map((s: any) => {
                            const symbol = s.underlying_symbol || s.symbol || '';
                            const display_name = s.underlying_symbol_name || s.display_name || symbol;
                            const market = s.market || 'unknown';
                            const market_display_name = s.market_display_name || market;
                            const submarket = s.submarket || 'unknown';
                            const submarket_display_name = s.submarket_display_name || submarket;

                            const rawPip = s.pip_size !== undefined ? s.pip_size : s.pip;
                            const decimalCount = rawPip !== undefined ? this.getDecimalCount(rawPip) : 2;
                            this.pipSizeMap.set(symbol, decimalCount);

                            return {
                                ...s,
                                symbol,
                                display_name,
                                market,
                                market_display_name,
                                submarket,
                                submarket_display_name,
                                pip_size: decimalCount,
                            };
                        });

                        // Ensure 15 1s, 30 1s, and 90 1s markets are present as fallbacks
                        const fallbacks = [
                            {
                                symbol: '1HZ15V',
                                display_name: 'Volatility 15 (1S) Index',
                                market: 'synthetic_index',
                                market_display_name: 'Derived Indices',
                                submarket: 'random_index',
                                submarket_display_name: 'Continuous Indices',
                                pip_size: 4,
                            },
                            {
                                symbol: '1HZ30V',
                                display_name: 'Volatility 30 (1S) Index',
                                market: 'synthetic_index',
                                market_display_name: 'Derived Indices',
                                submarket: 'random_index',
                                submarket_display_name: 'Continuous Indices',
                                pip_size: 4,
                            },
                            {
                                symbol: '1HZ90V',
                                display_name: 'Volatility 90 (1S) Index',
                                market: 'synthetic_index',
                                market_display_name: 'Derived Indices',
                                submarket: 'random_index',
                                submarket_display_name: 'Continuous Indices',
                                pip_size: 4,
                            },
                        ];

                        fallbacks.forEach(f => {
                            if (!mapped.some((s: any) => s.symbol === f.symbol)) {
                                this.pipSizeMap.set(f.symbol, f.pip_size);
                                mapped.push(f);
                            }
                        });

                        this.symbolsCache = mapped;
                        console.log(`[v0] Loaded ${this.symbolsCache?.length} symbols`);
                        return this.symbolsCache!;
                    }
                    throw new Error('Invalid symbols response');
                } catch (error) {
                    console.error(`[v0] getActiveSymbols attempt ${attempt} failed:`, error);
                    if (attempt === 3) {
                        this.symbolsCache = [];
                        return this.symbolsCache;
                    }
                    await new Promise(r => setTimeout(r, 2000 * attempt));
                }
            }
            return [];
        })();

        return this.symbolsPromise.finally(() => {
            this.symbolsPromise = null;
        });
    }

    // ─── Utilities ─────────────────────────────────────────────────────────────

    public getPipSize(symbol: string, rawHint?: number): number {
        // 1. Use API metadata cache if available (Most reliable)
        if (this.pipSizeMap.has(symbol)) {
            return this.pipSizeMap.get(symbol)!;
        }

        // 2. Use raw hint from the current message if provided (Convert if float)
        if (rawHint !== undefined && !isNaN(rawHint)) {
            return this.getDecimalCount(rawHint);
        }

        // 3. Robust hardcoded fallbacks (When API metadata is missing)
        for (const [key, size] of Object.entries(this.COMMON_PIP_SIZES)) {
            if (symbol === key || symbol.includes(key)) return size;
        }

        return 2; // Final fallback
    }

    public extractLastDigit(quote: number, pipSize: number): number {
        return extractLastDigit(quote, pipSize);
    }

    public getDecimalCount(pip: number): number {
        return calculateDecimalCount(pip);
    }

    public isConnected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN;
    }

    public async disconnect(): Promise<void> {
        this.stopHeartbeat();
        // Cancel any pending reconnect timer
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        this.isReconnecting = false;
        this.unsubscribeAll();
        this.messageQueue = []; // Critical: Wipe the queue to prevent early OTP interference
        if (this.ws) {
            // CRITICAL: Set intentionalDisconnect BEFORE closing so the close handler
            // does NOT trigger handleReconnect()
            this.intentionalDisconnect = true;
            this.ws.close();
            this.ws = null;
        }
        this.api = null;
        this.connectionPromise = null;
        this.isAuthorized = false;
        this.log('info', 'Disconnected');
        this.setConnectionState('DISCONNECTED');
    }

    // ─── Logging ───────────────────────────────────────────────────────────────

    private log(type: 'info' | 'error' | 'warning', message: string) {
        this.connectionLogs.push({ type, message, timestamp: new Date() });
        if (this.connectionLogs.length > this.maxLogs) this.connectionLogs.shift();
    }

    public getConnectionLogs(): ConnectionLog[] {
        return [...this.connectionLogs];
    }

    // ─── Connection status listeners ───────────────────────────────────────────

    public onConnectionStatus(callback: (status: 'connected' | 'disconnected' | 'reconnecting') => void): () => void {
        this.connectionStatusListeners.add(callback);
        return () => this.connectionStatusListeners.delete(callback);
    }

    private notifyConnectionStatus(status: 'connected' | 'disconnected' | 'reconnecting') {
        this.connectionStatusListeners.forEach(cb => cb(status));
    }

    private rejectAllPendingRequests(error: Error) {
        this.pendingRequests.forEach((cb, req_id) => {
            cb({ error: { message: error.message, code: 'ConnectionLoss' }, req_id });
        });
        this.pendingRequests.clear();
    }

    // ─── Static helpers ────────────────────────────────────────────────────────

    public static subscribe(symbol: string, callback: (data: TickData) => void): () => void {
        const instance = DerivWebSocketManager.getInstance();
        let subscriptionId: string | null = null;
        let isCancelled = false;

        instance.subscribeTicks(symbol, callback).then(id => {
            if (isCancelled && id) instance.unsubscribe(id, callback);
            else subscriptionId = id;
        });

        return () => {
            isCancelled = true;
            if (subscriptionId) instance.unsubscribe(subscriptionId, callback);
        };
    }

    public async connectOptions(type: 'demo' | 'real' | 'public', otpOrUrl?: string): Promise<void> {
        // If the value passed is already a full OTP URL (from getOTP()), use it directly.
        // Otherwise build a URL from the OPTIONS_WS base and append the token.
        if (otpOrUrl && (otpOrUrl.startsWith('wss://') || otpOrUrl.startsWith('ws://'))) {
            return this.connect(otpOrUrl, true);
        }

        const typeKey = type.toUpperCase() as keyof typeof DERIV_API.OPTIONS_WS;
        const baseUrl: string = DERIV_API.OPTIONS_WS[typeKey];

        // Construct URL based on whether baseUrl already has a query string
        const separator = baseUrl.includes('?') ? '&' : '?';
        const url = otpOrUrl ? `${baseUrl}${separator}otp=${otpOrUrl}` : baseUrl;
        return this.connect(url as string, true);
    }
}

export const derivWebSocket = DerivWebSocketManager.getInstance();
