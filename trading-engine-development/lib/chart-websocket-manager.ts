'use client';

import { DERIV_CONFIG, DERIV_API } from './deriv-config';

/**
 * Dedicated WebSocket Manager for Charts
 * Ensures a separated connection from the main application to prevent race conditions
 * and data pollution, as per official Deriv best practices for SmartCharts.
 */
export class ChartWebSocketManager {
    private static instance: ChartWebSocketManager | null = null;
    private ws: WebSocket | null = null;
    private api: any | null = null;
    private isConnecting = false;
    private connectionPromise: Promise<void> | null = null;
    private messageHandlers: Set<(msg: any) => void> = new Set();

    private constructor() {}

    public static getInstance(): ChartWebSocketManager {
        if (!ChartWebSocketManager.instance) {
            ChartWebSocketManager.instance = new ChartWebSocketManager();
        }
        return ChartWebSocketManager.instance;
    }

    public async connect(): Promise<void> {
        if (this.ws?.readyState === WebSocket.OPEN) return;
        if (this.connectionPromise) return this.connectionPromise;

        this.isConnecting = true;
        const wsUrl = `${DERIV_API.WEBSOCKET}?app_id=${DERIV_CONFIG.APP_ID}&l=en&brand=deriv`;

        this.connectionPromise = new Promise((resolve, reject) => {
            try {
                console.log('[ChartAPI] Connecting dedicated WebSocket:', wsUrl);
                this.ws = new WebSocket(wsUrl);

                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const DerivAPIBasic = require('@deriv/deriv-api/dist/DerivAPIBasic');
                const API = DerivAPIBasic?.default ?? DerivAPIBasic;
                this.api = new API({ connection: this.ws });

                const timeout = setTimeout(() => {
                    if (this.ws?.readyState !== WebSocket.OPEN) {
                        this.ws?.close();
                        reject(new Error('Chart connection timeout'));
                    }
                }, 15000);

                this.ws.onopen = () => {
                    clearTimeout(timeout);
                    console.log('[ChartAPI] Dedicated connection opened');
                    this.isConnecting = false;
                    this.connectionPromise = null;

                    // Heartbeat
                    setInterval(() => {
                        if (this.ws?.readyState === WebSocket.OPEN) {
                            this.send({ ping: 1 });
                        }
                    }, 30000);

                    resolve();
                };

                this.ws.onmessage = e => {
                    try {
                        const data = JSON.parse(e.data);
                        this.messageHandlers.forEach(handler => handler(data));
                    } catch (err) {
                        // Silence parse errors for binary or malformed chunks
                    }
                };

                this.ws.onclose = () => {
                    console.warn('[ChartAPI] Dedicated connection closed');
                    this.isConnecting = false;
                    this.connectionPromise = null;
                    this.ws = null;
                    this.api = null;
                };

                this.ws.onerror = err => {
                    console.error('[ChartAPI] WebSocket error:', err);
                    reject(err);
                };
            } catch (err) {
                this.isConnecting = false;
                this.connectionPromise = null;
                reject(err);
            }
        });

        return this.connectionPromise;
    }

    public send(msg: any) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(msg));
        }
    }

    public async sendAndWait(msg: any, timeoutMs = 15000): Promise<any> {
        if (this.ws?.readyState !== WebSocket.OPEN) {
            await this.connect();
        }

        const req_id = Math.floor(Math.random() * 1000000);
        const payload = { ...msg, req_id };

        return new Promise((resolve, reject) => {
            const handler = (data: any) => {
                if (data.req_id === req_id) {
                    this.messageHandlers.delete(handler);
                    clearTimeout(timer);
                    if (data.error) reject(data.error);
                    else resolve(data);
                }
            };

            this.messageHandlers.add(handler);

            const timer = setTimeout(() => {
                this.messageHandlers.delete(handler);
                reject(new Error(`Chart request ${req_id} timed out`));
            }, timeoutMs);

            this.send(payload);
        });
    }

    public onMessage(handler: (msg: any) => void) {
        this.messageHandlers.add(handler);
        return () => this.messageHandlers.delete(handler);
    }

    public isConnected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN;
    }

    public disconnect() {
        this.ws?.close();
        this.ws = null;
        this.api = null;
        this.messageHandlers.clear();
    }
}

export const chartWebSocket = ChartWebSocketManager.getInstance();
