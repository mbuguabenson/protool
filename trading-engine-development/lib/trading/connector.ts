import { EventEmitter } from 'events';
import { getConfig } from './config';
import { DerivWebSocketManager } from '../deriv-websocket-manager';
import { DERIV_CONFIG } from '../deriv-config';

interface PendingRequest {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
}

interface ConnectionState {
    isConnected: boolean;
    isAuthorized: boolean;
    reconnectAttempts: number;
    lastConnectionTime: number | null;
    lastMessageTime: number | null;
    lastErrorMessage: string | null;
}

export class DerivConnector extends EventEmitter {
    private manager: DerivWebSocketManager;
    private pendingRequests = new Map<string, PendingRequest>();
    private authorized = false;
    private loginId: string | null = null;
    private accountCurrency: string | null = null;
    private connectionState: ConnectionState = {
        isConnected: false,
        isAuthorized: false,
        reconnectAttempts: 0,
        lastConnectionTime: null,
        lastMessageTime: null,
        lastErrorMessage: null,
    };

    constructor() {
        super();
        this.manager = DerivWebSocketManager.getInstance();
        this.setupListeners();
    }

    private setupListeners() {
        this.manager.on('*', (data: any) => {
            this.connectionState.lastMessageTime = Date.now();
            this.handleMessage(data);
        });
    }

    async connect(): Promise<void> {
        try {
            await this.manager.connect();
            this.connectionState.isConnected = true;
            this.connectionState.lastConnectionTime = Date.now();

            await this.authorize();
        } catch (error) {
            console.error('[v0] Connection/Auth error:', error);
            this.connectionState.lastErrorMessage = `Error: ${error}`;
            throw error;
        }
    }

    private async authorize(): Promise<void> {
        const config = getConfig();
        const token = config.DERIV_API_TOKEN;

        if (!token) {
            throw new Error('No API token provided in configuration');
        }

        try {
            this.log('info', 'Authenticating bot trading session via modern REST+OTP flow...');

            // Use the manager's integrated auth flow (REST accounts -> OTP -> WS)
            await this.manager.authorize(token);

            // Sync state with the manager
            this.authorized = this.manager.isAuthorized;
            this.connectionState.isAuthorized = this.manager.isAuthorized;

            if (this.authorized) {
                this.loginId = this.manager.getAccountId();
                // We'll rely on the manager's 'authorize' event to fill in the rest of the details
                console.log(`[v0] ✅ Bot session authenticated as ${this.loginId}`);
            } else {
                throw new Error('Manager failed to authorize session');
            }
        } catch (error) {
            console.error('[v0] ❌ Bot authorization failed:', error);
            this.connectionState.lastErrorMessage = `Auth error: ${error}`;
            throw error;
        }
    }

    private log(type: 'info' | 'error', message: string) {
        console.log(`[v0][Connector] ${type.toUpperCase()}: ${message}`);
    }

    private handleMessage(data: any): void {
        if (data.req_id) {
            const pending = this.pendingRequests.get(data.req_id.toString());
            if (pending) {
                clearTimeout(pending.timeout);
                this.pendingRequests.delete(data.req_id.toString());
                if (data.error) {
                    pending.reject(new Error(data.error.message));
                } else {
                    pending.resolve(data);
                }
                return;
            }
        }

        // Emit events for known message types
        if (data.msg_type) {
            if (data.msg_type === 'authorize' && data.authorize) {
                this.loginId = data.authorize.loginid;
                this.accountCurrency = data.authorize.currency;
                this.authorized = true;
                this.connectionState.isAuthorized = true;
            }
            this.emit(data.msg_type, data[data.msg_type] || data);
        }

        // Legacy event emitters for specific keys
        if (data.tick) this.emit('tick', data.tick);
        if (data.proposal) this.emit('proposal', data.proposal);
        if (data.buy) this.emit('buy', data.buy);
        if (data.transaction) this.emit('transaction', data.transaction);
        if (data.balance) this.emit('balance', data.balance);

        if (data.error) {
            this.emit('api_error', data.error);
        }
    }

    async send(payload: any): Promise<void> {
        this.manager.send(payload);
    }

    async sendAndWait(payload: any, expectedType: string, timeoutMs = 10000): Promise<any> {
        const reqId = this.manager.getNextReqId();
        const payloadWithId = { ...payload, req_id: reqId };

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(reqId.toString());
                reject(new Error(`Timeout waiting for ${expectedType}`));
            }, timeoutMs);

            this.pendingRequests.set(reqId.toString(), { resolve, reject, timeout });

            try {
                this.manager.send(payloadWithId);
            } catch (error) {
                clearTimeout(timeout);
                this.pendingRequests.delete(reqId.toString());
                reject(error);
            }
        });
    }

    isConnected(): boolean {
        return this.connectionState.isConnected && this.authorized;
    }

    getConnectionState(): ConnectionState {
        return { ...this.connectionState };
    }

    getLoginId(): string | null {
        return this.loginId;
    }

    getCurrency(): string | null {
        return this.accountCurrency;
    }

    disconnect(): void {
        // We don't necessarily want to disconnect the manager's global socket
        // unless explicitly needed. For now, just mark as unauthorized.
        this.authorized = false;
        this.connectionState.isAuthorized = false;
    }
}

// Singleton instance
let connectorInstance: DerivConnector | null = null;

export function getConnector(): DerivConnector {
    if (!connectorInstance) {
        connectorInstance = new DerivConnector();
    }
    return connectorInstance;
}
