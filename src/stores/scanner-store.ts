import { makeAutoObservable } from 'mobx';
import {
    getOrCreateWebSocketManager,
    WebSocketSessionRequest,
    WebSocketSessionManager,
} from '@/services/websocket/WebSocketSessionManager';

export default class ScannerStore {
    // Observable state
    activeSignal: any = null;
    isScanning: boolean = false;
    selectedStrategy: string | null = null;

    private wsManager?: WebSocketSessionManager;

    constructor() {
        makeAutoObservable(this);
    }

    setStrategy = (strategy: string) => {
        this.selectedStrategy = strategy;
    };

    startScanning = async () => {
        this.isScanning = true;
        // Placeholder config – replace with real account data as needed
        const config: WebSocketSessionRequest = {
            account_id: 'placeholder_account',
            access_token: 'placeholder_token',
            account_type: 'dot',
        };
        try {
            const manager = await getOrCreateWebSocketManager(config);
            this.wsManager = manager;
            // Listen for custom "signal" messages (adjust msg_type as per backend)
            manager.onMessage('signal', msg => {
                this.setActiveSignal(msg);
            });
        } catch (error) {
            console.error('WebSocket init error:', error);
        }
    };

    stopScanning = () => {
        this.isScanning = false;
        if (this.wsManager) {
            this.wsManager.disconnect();
            this.wsManager = undefined;
        }
        this.activeSignal = null;
    };

    setActiveSignal = (signal: any) => {
        this.activeSignal = signal;
    };
}
