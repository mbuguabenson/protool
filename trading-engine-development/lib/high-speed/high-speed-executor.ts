'use client';

import { DerivWebSocketManager } from '@/lib/deriv-websocket-manager';

/**
 * Ultra-Low Latency Trade Executor
 * Direct connection to WebSocket manager to bypass any unnecessary queuing.
 */
export class HighSpeedExecutor {
    private manager = DerivWebSocketManager.getInstance();
    private isExecuting = false;

    /**
     * Execute a trade immediately.
     * Returns contract_id or throws error.
     */
    public async executeTrade(params: {
        symbol: string;
        contract_type: string;
        amount: number;
        duration: number;
        duration_unit: string;
        prediction?: number;
    }): Promise<number> {
        if (this.isExecuting) {
            console.warn('[v0] Execution already in progress, skipping duplicate.');
            return 0;
        }

        try {
            this.isExecuting = true;

            // 1. Get proposal
            const proposalReq = {
                proposal: 1,
                subscribe: 0,
                amount: params.amount,
                basis: 'stake',
                contract_type: params.contract_type,
                currency: 'USD',
                duration: params.duration,
                duration_unit: params.duration_unit,
                underlying_symbol: params.symbol, // V1 Options API compatibility
                ...(params.prediction !== undefined && { barrier: params.prediction.toString() }),
            };

            const proposal = await this.manager.sendAndWait(proposalReq);
            if (!proposal?.proposal?.id) {
                console.error('[v0] Invalid proposal response:', proposal);
                throw new Error('Invalid proposal response: missing proposal id');
            }

            // 2. Buy
            const buyReq = {
                buy: proposal.proposal.id,
                price: proposal.proposal.ask_price,
            };

            const buyRes = await this.manager.sendAndWait(buyReq);
            if (buyRes.error) {
                throw new Error(buyRes.error.message);
            }

            console.log(`[v0] ✅ Trade Executed: ${buyRes.buy.contract_id}`);
            return buyRes.buy.contract_id;
        } finally {
            this.isExecuting = false;
        }
    }
}

export const highSpeedExecutor = new HighSpeedExecutor();
