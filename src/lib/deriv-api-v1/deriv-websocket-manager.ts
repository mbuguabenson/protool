
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
  type: "info" | "error" | "warning";
  message: string;
  timestamp: Date;
}

import { DERIV_CONFIG, DERIV_API, DERIV_LEGACY_APP_ID } from "./deriv-config";
import { extractLastDigit, calculateDecimalCount } from "./digit-utils";

export type ConnectionState =
  | "DISCONNECTED"
  | "CONNECTING"
  | "CONNECTED"
  | "AUTHORIZING"
  | "AUTHORIZED"
  | "RECONNECTING";

export class DerivWebSocketManager {
  private static instance: DerivWebSocketManager | null = null;
  private ws: WebSocket | null = null;
  private api: any | null = null;
  private messageHandlers: Map<string, MessageHandler[]> = new Map();
  private globalMessageHandler: ((data: any) => void) | null = null; // New global handler
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
  private accessToken: string | null = null;
  private currentAccountId: string | null = null;
  private currentEndpoint: "public" | "demo" | "real" = "public";
  private isOtpConnection = false;
  private intentionalDisconnect = false;
  private isReconnecting = false;
  private otpConsecutiveFailures = 0;
  private readonly OTP_MAX_FAILURES = 3;
  private authorizePromise: Promise<void> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly COMMON_PIP_SIZES: Record<string, number> = {
    R_10: 3,
    R_25: 2,
    R_50: 4,
    R_75: 4,
    R_100: 2,
    "1HZ10V": 2,
    "1HZ15V": 4,
    "1HZ25V": 2,
    "1HZ30V": 4,
    "1HZ50V": 2,
    "1HZ75V": 2,
    "1HZ90V": 4,
    "1HZ100V": 2,
    "1HZ150V": 4,
    "1HZ200V": 3,
    "1HZ250V": 3,
    "1HZ300V": 3,
    "1HA100": 2,
    "1HA200": 2,
    JUMP10: 3,
    JUMP25: 3,
    JUMP50: 3,
    JUMP75: 3,
    JUMP100: 3,
    JD10: 3,
    JD25: 3,
    JD50: 3,
    JD75: 3,
    JD100: 3,
  };
  private historyCache: Map<string, { data: TickData[]; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 30000;
  private accountsCache: any[] | null = null;
  private accountsPromise: Promise<any[]> | null = null;
  private connectionLogs: ConnectionLog[] = [];
  private readonly maxLogs = 100;
  private connectionStatusListeners: Set<(status: "connected" | "disconnected" | "reconnecting") => void> = new Set();
  public isAuthorized = false;
  private readonly appId = DERIV_CONFIG.APP_ID;
  private connectionState: ConnectionState = "DISCONNECTED";
  public onTokenExpired: (() => void) | null = null;

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

  private setConnectionState(newState: ConnectionState) {
    console.log(`[v0] 🔄 ConnectionState: ${this.connectionState} -> ${newState}`);
    this.connectionState = newState;
    if (newState === "CONNECTED" || newState === "AUTHORIZED") {
      this.notifyConnectionStatus("connected");
    } else if (newState === "DISCONNECTED") {
      this.notifyConnectionStatus("disconnected");
    } else if (newState === "RECONNECTING" || newState === "CONNECTING") {
      this.notifyConnectionStatus("reconnecting");
    }
  }

  private getActiveAppId(legacyOnly = false): string {
    return legacyOnly ? DERIV_LEGACY_APP_ID : DERIV_CONFIG.OAUTH_CLIENT_ID;
  }

  private currentWsUrl: string = DERIV_API.WEBSOCKET;

  public async connect(url?: string, force = false): Promise<void> {
    let targetUrl = url || this.currentWsUrl;

    if (!force && this.ws) {
      const state = this.ws.readyState;
      if ((state === WebSocket.OPEN || state === WebSocket.CONNECTING) && this.ws.url === targetUrl) {
        if (state === WebSocket.OPEN) {
          this.log("info", "Already connected");
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

    if (this.connectionState !== "RECONNECTING") {
      this.setConnectionState("CONNECTING");
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
        this.log("info", `Connecting to ${this.currentWsUrl}`);

        this.ws = new WebSocket(this.currentWsUrl);
        const wsInstance = this.ws;

        const DerivAPIBasic = require("@deriv/deriv-api/dist/DerivAPIBasic");
        const API = DerivAPIBasic?.default || DerivAPIBasic;
        this.api = new API({ connection: this.ws });

        const connectionTimeout = setTimeout(() => {
          if (wsInstance !== this.ws) return;
          if (this.ws?.readyState !== WebSocket.OPEN) {
            this.log("error", "Connection timeout after 10 seconds");
            this.ws?.close();
            this.connectionPromise = null;
            this.setConnectionState("DISCONNECTED");
            reject(new Error("Connection timeout"));
          }
        }, 10000);

        this.ws.addEventListener("open", () => {
          if (wsInstance !== this.ws) return;
          clearTimeout(connectionTimeout);
          console.log(`[v0] DerivAPIBasic WebSocket connected to ${this.ws?.url}`);
          this.log("info", `Connected to ${this.ws?.url}`);
          this.reconnectAttempts = 0;
          this.lastMessageTime = Date.now();
          this.setConnectionState("CONNECTED");
          this.startHeartbeat();
          this.processMessageQueue();
          this.connectionPromise = null;
          settle(() => resolve());
        });

        this.ws.addEventListener("message", (event) => {
          if (wsInstance !== this.ws) return;
          try {
            this.lastMessageTime = Date.now();
            const data = JSON.parse(event.data);
            if (data.msg_type) {
              console.log(`[v0] 📥 Incoming Raw: ${data.msg_type}${data.req_id ? ` (req_id: ${data.req_id})` : ""}`);
            }
            this.routeMessage(data);
          } catch (err) {
            console.error("[v0] Raw message parsing/routing error:", err);
          }
        });

        this.ws.addEventListener("error", (event) => {
          if (wsInstance !== this.ws) return;
          clearTimeout(connectionTimeout);
          const msg = (event as ErrorEvent).message || "WebSocket connection failed";
          console.error("[v0] WebSocket error:", msg, event);
          this.log("error", `WebSocket error: ${msg}`);
          this.connectionPromise = null;
          this.setConnectionState("DISCONNECTED");
          this.rejectAllPendingRequests(new Error(msg));
          settle(() => reject(new Error(msg)));
        });

        this.ws.addEventListener("close", (event) => {
          if (wsInstance !== this.ws) return;
          clearTimeout(connectionTimeout);
          const reason = event.reason || `code ${event.code}`;
          settle(() => reject(new Error(`WebSocket closed during connection: ${reason}`)));
          this.connectionPromise = null;
          this.stopHeartbeat();
          this.setConnectionState("DISCONNECTED");
          this.rejectAllPendingRequests(new Error("WebSocket connection closed"));
          if (this.intentionalDisconnect) {
            console.log(`[v0] WebSocket closed intentionally (${reason}), skipping reconnect.`);
            this.intentionalDisconnect = false;
          } else {
            console.log(`[v0] WebSocket closed unexpectedly (${reason}), reconnecting…`);
            this.log("warning", `WebSocket closed (${reason}), reconnecting…`);
            this.handleReconnect();
          }
        });
      } catch (error) {
        console.error("[v0] Connection setup error:", error);
        this.log("error", `Connection setup error: ${error}`);
        this.connectionPromise = null;
        this.setConnectionState("DISCONNECTED");
        this.rejectAllPendingRequests(error instanceof Error ? error : new Error(String(error)));
        settle(() => reject(error instanceof Error ? error : new Error(String(error))));
      }
    });

    return this.connectionPromise;
  }

  private async fetchWithAuth(path: string, options: RequestInit = {}, retryCount = 0): Promise<any> {
    if (!this.accessToken) throw new Error("No access token available");

    const url = `${DERIV_API.REST_BASE}${path}`;
    const headers = new Headers(options.headers);
    headers.set("Authorization", `Bearer ${this.accessToken}`);
    headers.set("Deriv-App-ID", this.getActiveAppId());
    const hasBody = options.body !== undefined && options.body !== null;
    if (hasBody && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    console.log(`[v0] REST ${options.method || "GET"} ${url}${retryCount > 0 ? ` (retry ${retryCount})` : ""}`);

    try {
      const response = await fetch(url, { ...options, headers });
      if (response.status === 429) {
        if (retryCount >= 3) {
          throw new Error("Rate limit exceeded (429) and max retries reached.");
        }
        let retryAfter = parseInt(response.headers.get("Retry-After") || "0");
        if (retryAfter <= 0) {
          const backoffs = [5, 10, 20];
          retryAfter = backoffs[retryCount];
        }
        this.log("warning", `Rate limit hit (429). Retrying in ${retryAfter}s...`);
        await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
        return this.fetchWithAuth(path, options, retryCount + 1);
      }
      if (response.status === 401) {
        this.log("warning", "REST 401: access token expired. Notifying auth layer.");
        this.isAuthorized = false;
        this.accessToken = null;
        this.accountsCache = null;
        this.clearGlobalCache();
        if (this.onTokenExpired) this.onTokenExpired();
        throw new Error("Access token expired (401). Please log in again.");
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
      if (err instanceof Error && err.message.includes("429")) throw err;
      throw err;
    }
  }

  private async getAccounts(): Promise<any[]> {
    if (this.accountsCache) return this.accountsCache;
    const tokenHash = this.accessToken ? this.accessToken.substring(0, 8) : "none";
    const cacheKey = `deriv_accounts_v1_${tokenHash}`;
    const lockKey = `deriv_auth_lock_v1_${tokenHash}`;

    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        this.accountsCache = parsed;
        console.log("[v0] 🌐 Using Cross-Tab Cached Accounts.");
        return parsed;
      }
    } catch {}

    const MAX_WAIT = 15;
    for (let i = 0; i < MAX_WAIT; i++) {
      const lockTime = parseInt(localStorage.getItem(lockKey) || "0");
      const now = Date.now();
      if (!lockTime || now - lockTime > 20000) break;
      console.log(`[v0] 🛰️ Waiting for other tab to finish /accounts fetch (${i + 1}/${MAX_WAIT})...`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      try {
        const reCached = localStorage.getItem(cacheKey);
        if (reCached) {
          const parsed = JSON.parse(reCached);
          this.accountsCache = parsed;
          return parsed;
        }
      } catch {}
    }

    if (this.accountsPromise) return this.accountsPromise;

    this.accountsPromise = (async () => {
      try {
        localStorage.setItem(lockKey, Date.now().toString());
        const accountsRes = await this.fetchWithAuth("/trading/v1/options/accounts");
        const accounts = accountsRes?.data || accountsRes || [];
        this.accountsCache = accounts;
        localStorage.setItem(cacheKey, JSON.stringify(accounts));
        return accounts || [];
      } finally {
        this.accountsPromise = null;
        localStorage.removeItem(lockKey);
      }
    })();

    return this.accountsPromise;
  }

  private clearGlobalCache() {
    try {
      const tokenHash = this.accessToken ? this.accessToken.substring(0, 8) : "none";
      localStorage.removeItem(`deriv_accounts_v1_${tokenHash}`);
      localStorage.removeItem(`deriv_auth_lock_v1_${tokenHash}`);
    } catch {}
  }

  public async authorize(token: string): Promise<void> {
    if (!token) return;
    if (this.authorizePromise) {
      console.log("[v0] ⏳ authorize() already in progress, waiting for existing call...");
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
    this.setConnectionState("AUTHORIZING");

    if (this.ws?.url && this.ws.url.includes("otp=") && this.ws.readyState === WebSocket.OPEN) {
      this.isAuthorized = true;
      this.isOtpConnection = true;
      this.setConnectionState("AUTHORIZED");
      console.log("[v0] Connection is already authenticated via OTP URL.");
      return;
    }

    const oauthFlowType = typeof window !== "undefined" ? localStorage.getItem("oauth_flow_type") : null;

    if (oauthFlowType !== "modern") {
      console.log(`[v0] ${oauthFlowType || "Default"} flow detected. Skipping REST handshake and going straight to direct WebSocket authorize.`);
      this.isOtpConnection = false;
      await this.authorizeDirectly(token);
      return;
    }

    try {
      this.log("info", `Starting modern V1 Authorization for: ${token.substring(0, 5)}...`);
      const accounts = await this.getAccounts();
      if (accounts.length > 0) {
        const activeLoginId = typeof window !== "undefined" ? localStorage.getItem("active_login_id") : null;
        if (activeLoginId && accounts.some((a: any) => a.account_id === activeLoginId)) {
          this.currentAccountId = activeLoginId;
          this.log("info", `Selected stored active account: ${this.currentAccountId}`);
        } else if (!this.currentAccountId || !accounts.some((a: any) => a.account_id === this.currentAccountId)) {
          const targetAccount = accounts.find((a: any) => a.account_type === "demo") || accounts[0];
          this.currentAccountId = targetAccount.account_id;
          this.log("info", `Selected default account: ${this.currentAccountId} (${targetAccount.account_type})`);
        }

        const targetAccount = accounts.find((a: any) => a.account_id === this.currentAccountId) || accounts[0];
        const otpRes = await this.fetchWithAuth(`/trading/v1/options/accounts/${this.currentAccountId}/otp`, {
          method: "POST",
        });
        const otpUrl = otpRes?.data?.url?.trim();
        if (otpUrl) {
          this.log("info", "OTP obtained. Reconnecting to authenticated environment...");
          this.currentEndpoint = targetAccount.account_type === "demo" ? "demo" : "real";
          await this.disconnect();
          this.isOtpConnection = true;
          this.otpConsecutiveFailures = 0;
          await this.connect(otpUrl, true);

          this.isAuthorized = true;
          this.setConnectionState("AUTHORIZED");

          try {
            localStorage.setItem("deriv_active_loginid", this.currentAccountId || "");
          } catch {}

          const syntheticAuthorize = {
            msg_type: "authorize",
            authorize: {
              loginid: targetAccount.account_id,
              is_virtual: targetAccount.account_type === "demo" ? 1 : 0,
              currency: targetAccount.currency,
              balance: parseFloat(targetAccount.balance || "0"),
              landing_company_name: targetAccount.account_type,
              account_list: accounts.map((acc: any) => ({
                loginid: acc.account_id,
                is_virtual: acc.account_type === "demo" ? 1 : 0,
                currency: acc.currency,
                balance: parseFloat(acc.balance || "0"),
              })),
            },
          };
          this.emit("authorize", syntheticAuthorize);
          console.log(`[v0] ✅ Successfully authorized modern connection for ${this.currentAccountId}`);
          return;
        }
      }
      throw new Error("No suitable options accounts found for this token.");
    } catch (e) {
      console.warn("[v0] Modern auth failed. Falling back to direct WebSocket authorize...", e);
      this.log("warning", `Modern auth failed: ${e instanceof Error ? e.message : String(e)}. Falling back to direct WebSocket authorize.`);
      this.isOtpConnection = false;
      await this.authorizeDirectly(token);
    }
  }

  private async authorizeDirectly(token: string): Promise<void> {
    try {
      const legacyAppId = this.getActiveAppId(true);
      const publicUrl = `${DERIV_API.WEBSOCKET_LEGACY}?app_id=${legacyAppId}`;

      if (!this.isConnected() || (this.ws?.url && (this.ws.url.includes("otp=") || this.ws.url.includes("trading/v1/options")))) {
        await this.disconnect();
        await this.connect(publicUrl, true);
      }

      console.log(`[v0] Sending authorize message over WebSocket with App ID ${legacyAppId}...`);
      const response = await this.sendAndWait({ authorize: token }, 20000);

      if (response.error) {
        throw response.error;
      }

      this.isAuthorized = true;
      this.setConnectionState("AUTHORIZED");
      const { authorize } = response;
      this.currentAccountId = authorize.loginid;

      try {
        localStorage.setItem("deriv_active_loginid", authorize.loginid || "");
      } catch {}

      this.emit("authorize", response);
      console.log(`[v0] ✅ Successfully authorized via fallback WebSocket for ${this.currentAccountId}`);
    } catch (fallbackError: any) {
      console.error("[v0] Fallback WebSocket authorize failed:", fallbackError);
      this.log("error", `Fallback authorize failed: ${fallbackError?.message || String(fallbackError)}`);
      this.isAuthorized = false;
      this.setConnectionState("DISCONNECTED");
      throw fallbackError;
    }
  }

  private handleReconnect() {
    this.setConnectionState("RECONNECTING");
    if (this.isReconnecting) {
      console.log("[v0] handleReconnect: Already reconnecting, skipping.");
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.log("error", "Max reconnection attempts reached. Waiting 60s before reset.");
      this.isReconnecting = false;
      this.reconnectTimer = setTimeout(() => {
        this.reconnectAttempts = 0;
        this.otpConsecutiveFailures = 0;
        this.handleReconnect();
      }, 60000);
      return;
    }

    this.isReconnecting = true;

    if (this.isOtpConnection && this.accessToken && this.currentAccountId) {
      if (this.otpConsecutiveFailures >= this.OTP_MAX_FAILURES) {
        console.warn(`[v0] ⛔ Circuit breaker: ${this.otpConsecutiveFailures} consecutive OTP failures. Stopping OTP reconnection.`);
        this.log("error", `Circuit breaker activated after ${this.otpConsecutiveFailures} OTP failures. Waiting 60s.`);
        this.isReconnecting = false;
        this.reconnectTimer = setTimeout(() => {
          this.otpConsecutiveFailures = 0;
          this.reconnectAttempts = 0;
          this.handleReconnect();
        }, 60000);
        return;
      }

      this.messageQueue = [];
      const otpDelays = [2000, 4000, 8000, 16000, 30000];
      const delayMs = otpDelays[Math.min(this.reconnectAttempts, otpDelays.length - 1)];
      this.reconnectAttempts++;
      this.log("info", `[OTP] Fetching fresh OTP for ${this.currentAccountId} in ${delayMs}ms (attempt ${this.reconnectAttempts})...`);

      this.reconnectTimer = setTimeout(async () => {
        try {
          const otpRes = await this.fetchWithAuth(`/trading/v1/options/accounts/${this.currentAccountId}/otp`, { method: "POST" });
          const otpUrl = otpRes?.data?.url?.trim();
          if (!otpUrl) throw new Error("OTP response missing data.url");
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
          this.setConnectionState("AUTHORIZED");
          this.isReconnecting = false;
          this.log("info", `[OTP] Reconnected successfully for ${this.currentAccountId}`);
        } catch (err) {
          this.otpConsecutiveFailures++;
          this.log("error", `[OTP] Reconnection attempt failed (${this.otpConsecutiveFailures}/${this.OTP_MAX_FAILURES}): ${err}`);
          this.isReconnecting = false;
          this.handleReconnect();
        }
      }, delayMs);
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
    this.log("info", `Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    this.reconnectTimer = setTimeout(() => {
      this.connect(this.currentWsUrl, true)
        .then(() => {
          this.isReconnecting = false;
        })
        .catch((err) => {
          this.log("error", `Reconnection failed: ${err}`);
          this.isReconnecting = false;
        });
    }, delay);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    setTimeout(() => {
      this.heartbeatInterval = setInterval(() => {
        const timeSinceLastMessage = Date.now() - this.lastMessageTime;
        if (timeSinceLastMessage > 60000) {
          this.log("warning", "No messages for 60s, reconnecting");
          this.ws?.close();
          return;
        }
        if (this.ws?.readyState === WebSocket.OPEN) {
          try {
            this.send({ ping: 1, req_id: this.getNextReqId() });
          } catch (err) {
            this.log("error", `Heartbeat ping failed: ${err}`);
          }
        }
      }, 30000);
    }, 5000);
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

  public send(message: any): void {
    if (this.api && this.ws?.readyState === WebSocket.OPEN) {
      this.api.send(message).catch(() => {});
    } else if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      this.messageQueue.push(message);
    }
  }

  public async sendAndWait(message: any, timeoutMs = 30000): Promise<any> {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      console.log("[v0] sendAndWait: WebSocket not open, connecting...");
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

      this.pendingRequests.set(req_id, (data) => {
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
        this.messageQueue.push(payload);
      }
    });
  }

  private routeMessage(message: any) {
    try {
      if (message.msg_type === "ping" || message.echo_req?.ping) return;

      // Call the global message handler first
      if (this.globalMessageHandler) {
        try {
          this.globalMessageHandler(message);
        } catch (err) {
          console.error("[v0] Error in global message handler:", err);
        }
      }

      if (message.req_id) {
        const req_id = Number(message.req_id);
        const callback = this.pendingRequests.get(req_id);
        if (message.subscription && !message.error) {
          const symbol = message.echo_req?.ticks || message.echo_req?.underlying_symbol || message.echo_req?.active_symbols;
          if (symbol && typeof symbol === "string") {
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
            pipSize,
          };
          callbacks.forEach((cb) => cb(tickData));
        }
      }

      const msgType = message.msg_type;
      if (msgType) {
        const handlers = this.messageHandlers.get(msgType);
        if (handlers) {
          handlers.forEach((handler) => {
            try {
              handler(message);
            } catch (e) {
              console.error(`[v0] Error in message handler for ${msgType}:`, e);
            }
          });
        }
      }
    } catch (err) {
      console.error("[v0] Error in routeMessage:", err);
    }
  }

  // New methods for global message handling
  public setGlobalMessageHandler(handler: (data: any) => void): void {
    this.globalMessageHandler = handler;
  }

  public clearGlobalMessageHandler(): void {
    this.globalMessageHandler = null;
  }

  public on(event: string, handler: MessageHandler): () => void {
    if (event === "*") {
      console.warn("[v0] on('*') is deprecated and should not be used.");
      return () => {};
    }
    if (!this.messageHandlers.has(event)) {
      this.messageHandlers.set(event, []);
    }
    this.messageHandlers.get(event)?.push(handler);
    return () => {
      const handlers = this.messageHandlers.get(event);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  public off(event: string, handler?: MessageHandler): void {
    if (event === "*") return;
    if (handler) {
      const handlers = this.messageHandlers.get(event);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    } else {
      this.messageHandlers.delete(event);
    }
  }

  public emit(event: string, data: any): void {
    const handlers = this.messageHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (e) {
          console.error(`[v0] Error in universal handler for ${event}:`, e);
        }
      });
    }
  }

  public async subscribeTicks(symbol: string, callback: (tick: TickData) => void): Promise<string> {
    if (!symbol || typeof symbol !== "string" || symbol.trim() === "") {
      console.warn("[v0] subscribeTicks: Invalid symbol provided:", symbol);
      return "";
    }
    const cleanSymbol = symbol.trim();
    if (!this.tickCallbacks.has(cleanSymbol)) this.tickCallbacks.set(cleanSymbol, new Set());
    this.tickCallbacks.get(cleanSymbol)?.add(callback);

    const existingId = this.symbolToSubscriptionMap.get(cleanSymbol);
    if (existingId) {
      const ref = this.subscriptionRefCount.get(existingId) || 0;
      this.subscriptionRefCount.set(existingId, ref + 1);
      return existingId;
    }

    if (this.activeSubscriptions.has(cleanSymbol)) {
      return new Promise((resolve) => {
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
          resolve("");
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
            pipSize,
          });
          return subscriptionId;
        }
        throw new Error(response.error?.message || "Invalid subscription response");
      } catch (error: any) {
        lastError = error;
        if (error.code === "AlreadySubscribed") {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          const recoveredId = this.symbolToSubscriptionMap.get(cleanSymbol);
          if (recoveredId) {
            const ref = this.subscriptionRefCount.get(recoveredId) || 0;
            this.subscriptionRefCount.set(recoveredId, ref + 1);
            this.activeSubscriptions.delete(cleanSymbol);
            return recoveredId;
          }
        }
        if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }

    this.activeSubscriptions.delete(cleanSymbol);
    const errMsg =
      lastError?.error?.message ||
      lastError?.message ||
      (typeof lastError === "object" && Object.keys(lastError).length === 0
        ? "SymbolNotFound or market not available on this connection"
        : JSON.stringify(lastError));
    const errCode = lastError?.error?.code || lastError?.code || "unknown";
    if (["SymbolNotFound", "MarketIsClosed", "InvalidSymbol", "unknown"].includes(errCode)) {
      console.warn(`[v0] subscribeTicks: ${cleanSymbol} not available (${errCode}): ${errMsg}`);
    } else {
      console.error(`[v0] Failed to subscribe to ${cleanSymbol}: [${errCode}] ${errMsg}`);
    }

    return "";
  }

  public async unsubscribe(subscriptionId: string, callback?: (tick: TickData) => void) {
    if (!subscriptionId || typeof subscriptionId !== "string") return;
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
      console.error("[v0] Unsubscribe error:", error);
    }
  }

  public async unsubscribeAll() {
    this.send({
      forget_all: ["ticks", "balance", "proposal_open_contract", "transaction"],
      req_id: this.getNextReqId(),
    });
    this.subscriptions.clear();
    this.subscriptionRefCount.clear();
    this.symbolToSubscriptionMap.clear();
    this.tickCallbacks.clear();
    this.activeSubscriptions.clear();
    this.log("info", "Unsubscribed from all active subscriptions (ticks, balance, proposals, transactions)");
  }

  public async getTicksHistory(symbol: string, count = 5000): Promise<TickData[]> {
    if (!symbol || typeof symbol !== "string") {
      return [];
    }
    const cleanSymbol = symbol.trim();
    if (cleanSymbol === "") return [];

    const cached = this.historyCache.get(cleanSymbol);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL && cached.data.length >= count) {
      this.log("info", `Returning ${count} cached historical ticks for ${cleanSymbol}`);
      return cached.data.slice(-count);
    }

    try {
      this.log("info", `Fetching ${count} historical ticks for ${cleanSymbol}`);
      const response = await this.sendAndWait({
        ticks_history: cleanSymbol,
        adjust_start_time: 1,
        count,
        end: "latest",
        style: "ticks",
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
          pipSize,
        }));

        this.historyCache.set(symbol, { data, timestamp: Date.now() });
        return data;
      }
      return [];
    } catch (error: any) {
      this.log("error", `getTicksHistory failed for ${cleanSymbol}: ${error.message || JSON.stringify(error)}`);
      console.error("[v0] getTicksHistory error:", error);
      return [];
    }
  }

  public async getActiveSymbols(): Promise<
    Array<{ symbol: string; display_name: string; market?: string; market_display_name?: string }>
  > {
    if (this.symbolsCache) return this.symbolsCache;
    if (this.symbolsPromise) return this.symbolsPromise;

    this.symbolsPromise = (async () => {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const response = await this.sendAndWait({ active_symbols: "brief" }, 15000);
          if (response?.active_symbols) {
            let mapped = response.active_symbols.map((s: any) => {
              const symbol = s.underlying_symbol || s.symbol || "";
              const display_name = s.underlying_symbol_name || s.display_name || symbol;
              const market = s.market || "unknown";
              const market_display_name = s.market_display_name || market;
              const submarket = s.submarket || "unknown";
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

            const fallbacks = [
              {
                symbol: "1HZ15V",
                display_name: "Volatility 15 (1S) Index",
                market: "synthetic_index",
                market_display_name: "Derived Indices",
                submarket: "random_index",
                submarket_display_name: "Continuous Indices",
                pip_size: 4,
              },
              {
                symbol: "1HZ30V",
                display_name: "Volatility 30 (1S) Index",
                market: "synthetic_index",
                market_display_name: "Derived Indices",
                submarket: "random_index",
                submarket_display_name: "Continuous Indices",
                pip_size: 4,
              },
              {
                symbol: "1HZ90V",
                display_name: "Volatility 90 (1S) Index",
                market: "synthetic_index",
                market_display_name: "Derived Indices",
                submarket: "random_index",
                submarket_display_name: "Continuous Indices",
                pip_size: 4,
              },
            ];

            fallbacks.forEach((f) => {
              if (!mapped.some((s: any) => s.symbol === f.symbol)) {
                this.pipSizeMap.set(f.symbol, f.pip_size);
                mapped.push(f);
              }
            });

            this.symbolsCache = mapped;
            console.log(`[v0] Loaded ${this.symbolsCache?.length} symbols`);
            return this.symbolsCache!;
          }
          throw new Error("Invalid symbols response");
        } catch (error) {
          console.error(`[v0] getActiveSymbols attempt ${attempt} failed:`, error);
          if (attempt === 3) {
            this.symbolsCache = [];
            return this.symbolsCache;
          }
          await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
        }
      }
      return [];
    })();

    return this.symbolsPromise.finally(() => {
      this.symbolsPromise = null;
    });
  }

  public getPipSize(symbol: string, rawHint?: number): number {
    if (this.pipSizeMap.has(symbol)) {
      return this.pipSizeMap.get(symbol)!;
    }
    if (rawHint !== undefined && !isNaN(rawHint)) {
      return this.getDecimalCount(rawHint);
    }
    for (const [key, size] of Object.entries(this.COMMON_PIP_SIZES)) {
      if (symbol === key || symbol.includes(key)) return size;
    }
    return 2;
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
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.isReconnecting = false;
    this.unsubscribeAll();
    this.messageQueue = [];
    if (this.ws) {
      this.intentionalDisconnect = true;
      this.ws.close();
      this.ws = null;
    }
    this.api = null;
    this.connectionPromise = null;
    this.isAuthorized = false;
    this.log("info", "Disconnected");
    this.setConnectionState("DISCONNECTED");
  }

  private log(type: "info" | "error" | "warning", message: string) {
    this.connectionLogs.push({ type, message, timestamp: new Date() });
    if (this.connectionLogs.length > this.maxLogs) this.connectionLogs.shift();
  }

  public getConnectionLogs(): ConnectionLog[] {
    return [...this.connectionLogs];
  }

  public onConnectionStatus(callback: (status: "connected" | "disconnected" | "reconnecting") => void): () => void {
    this.connectionStatusListeners.add(callback);
    return () => this.connectionStatusListeners.delete(callback);
  }

  private notifyConnectionStatus(status: "connected" | "disconnected" | "reconnecting") {
    this.connectionStatusListeners.forEach((cb) => cb(status));
  }

  private rejectAllPendingRequests(error: Error) {
    this.pendingRequests.forEach((cb, req_id) => {
      cb({ error: { message: error.message, code: "ConnectionLoss" }, req_id });
    });
    this.pendingRequests.clear();
  }

  public static subscribe(symbol: string, callback: (data: TickData) => void): () => void {
    const instance = DerivWebSocketManager.getInstance();
    let subscriptionId: string | null = null;
    let isCancelled = false;

    instance.subscribeTicks(symbol, callback).then((id) => {
      if (isCancelled && id) instance.unsubscribe(id, callback);
      else subscriptionId = id;
    });

    return () => {
      isCancelled = true;
      if (subscriptionId) instance.unsubscribe(subscriptionId, callback);
    };
  }

  public async connectOptions(type: "demo" | "real" | "public", otpOrUrl?: string): Promise<void> {
    if (otpOrUrl && (otpOrUrl.startsWith("wss://") || otpOrUrl.startsWith("ws://"))) {
      return this.connect(otpOrUrl, true);
    }
    const typeKey = type.toUpperCase() as keyof typeof DERIV_API.OPTIONS_WS;
    const baseUrl: string = DERIV_API.OPTIONS_WS[typeKey];
    const separator = baseUrl.includes("?") ? "&" : "?";
    const url = otpOrUrl ? `${baseUrl}${separator}otp=${otpOrUrl}` : baseUrl;
    return this.connect(url as string, true);
  }
}

export const derivWebSocket = DerivWebSocketManager.getInstance();
