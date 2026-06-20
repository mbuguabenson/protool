/**
 * WebSocket Connection Verification Utility
 * Run diagnostic checks on WebSocket connectivity
 */

import { DerivWebSocketManager } from '@/lib/deriv-websocket-manager';

interface DiagnosticResult {
    timestamp: Date;
    status: 'connected' | 'disconnected' | 'error';
    connectionAttempts: number;
    messageCount: number;
    lastMessage: Date | null;
    logs: Array<{
        type: 'info' | 'error' | 'warning';
        message: string;
        timestamp: Date;
    }>;
}

export class WebSocketVerifier {
    private static manager = DerivWebSocketManager.getInstance();
    private static messageCount = 0;
    private static lastMessageTime: Date | null = null;

    /**
     * Run diagnostic check on WebSocket connection
     */
    static async runDiagnostics(): Promise<DiagnosticResult> {
        const startTime = new Date();

        try {
            console.log('[v0] Starting WebSocket diagnostics...');

            // Check if already connected
            if (!this.manager.isConnected()) {
                console.log('[v0] WebSocket not connected, attempting connection...');
                await this.manager.connect();
            }

            // Test message send
            console.log('[v0] Testing message send...');
            this.manager.send({
                active_symbols: 'brief',
            });

            // Set up listener for response
            await new Promise(resolve => {
                const handler = (msg: any) => {
                    if (msg.active_symbols) {
                        this.lastMessageTime = new Date();
                        this.messageCount++;
                        console.log('[v0] ✅ Received active_symbols response');
                        resolve(true);
                    }
                };

                this.manager.on('active_symbols', handler);

                // Timeout after 5 seconds
                setTimeout(() => {
                    this.manager.off('active_symbols', handler);
                    resolve(false);
                }, 5000);
            });

            const logs = this.manager.getConnectionLogs();

            return {
                timestamp: startTime,
                status: this.manager.isConnected() ? 'connected' : 'disconnected',
                connectionAttempts: logs.filter(l => l.message.includes('Reconnecting')).length,
                messageCount: this.messageCount,
                lastMessage: this.lastMessageTime,
                logs: logs.slice(-20), // Last 20 logs
            };
        } catch (error) {
            console.error('[v0] Diagnostic error:', error);
            return {
                timestamp: startTime,
                status: 'error',
                connectionAttempts: 0,
                messageCount: this.messageCount,
                lastMessage: this.lastMessageTime,
                logs: this.manager.getConnectionLogs().slice(-20),
            };
        }
    }

    /**
     * Subscribe to test symbol and monitor
     */
    static async monitorConnection(symbol: string = ''): Promise<void> {
        console.log(`[v0] Monitoring connection with symbol: ${symbol}`);

        if (!this.manager.isConnected()) {
            await this.manager.connect();
        }

        const unsubscribe = await this.manager.subscribeTicks(symbol, tick => {
            console.log(`[v0] Received tick for ${tick.symbol}: Quote=${tick.quote}, LastDigit=${tick.lastDigit}`);
            this.messageCount++;
            this.lastMessageTime = new Date();
        });

        // Monitor for 30 seconds then stop
        setTimeout(() => {
            this.manager.unsubscribe(unsubscribe);
            console.log('[v0] Stopped monitoring connection');
        }, 30000);
    }

    /**
     * Test reconnection logic
     */
    static async testReconnection(): Promise<void> {
        console.log('[v0] Testing reconnection logic...');

        if (!this.manager.isConnected()) {
            await this.manager.connect();
        }

        console.log('[v0] Simulating disconnect...');
        this.manager.disconnect();

        // Wait a bit and try to reconnect
        await new Promise(resolve => setTimeout(resolve, 2000));

        console.log('[v0] Attempting reconnect...');
        await this.manager.connect();

        if (this.manager.isConnected()) {
            console.log('[v0] ✅ Reconnection successful!');
        } else {
            console.error('[v0] ❌ Reconnection failed!');
        }
    }

    /**
     * Print connection logs to console
     */
    static printLogs(): void {
        const logs = this.manager.getConnectionLogs();

        console.log('\n📋 WebSocket Connection Logs:');
        console.log('=' + '='.repeat(79));

        logs.forEach((log, index) => {
            const icon = log.type === 'info' ? 'ℹ️ ' : log.type === 'error' ? '❌ ' : '⚠️ ';
            console.log(`${icon} [${log.timestamp.toISOString()}] ${log.message}`);
        });

        console.log('=' + '='.repeat(79));
        console.log(`Total logs: ${logs.length}`);
    }

    /**
     * Get formatted diagnostics string
     */
    static async getDiagnosticsString(): Promise<string> {
        const diag = await this.runDiagnostics();

        return `
WebSocket Connection Diagnostics
==================================
Timestamp: ${diag.timestamp.toISOString()}
Status: ${diag.status}
Connection Attempts: ${diag.connectionAttempts}
Message Count: ${diag.messageCount}
Last Message: ${diag.lastMessage ? diag.lastMessage.toISOString() : 'Never'}

Recent Logs (Last 20):
${diag.logs.map(log => `  ${log.timestamp.toISOString()} [${log.type}] ${log.message}`).join('\n')}
    `;
    }
}

// Export for use in browser console
if (typeof window !== 'undefined') {
    (window as any).WebSocketVerifier = WebSocketVerifier;
    console.log('[v0] WebSocketVerifier available globally. Try: WebSocketVerifier.runDiagnostics()');
}
