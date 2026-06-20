// Trade execution: proposal → buy → monitor → close
import type { DerivConnector } from './connector';
import type { RiskManager } from './risk';

export interface TradeConfig {
    symbol: string;
    contractType: string;
    stake: number;
    duration: number;
    durationUnit: string;
    barrier?: string;
    digit?: number;
}

export interface TradeResult {
    contractId: string;
    entryPrice: number;
    entryTime: number;
    exitPrice?: number;
    exitTime?: number;
    profitLoss?: number;
    status: 'open' | 'closed' | 'failed';
}

export class TradeExecutor {
    constructor(
        private connector: DerivConnector,
        private riskManager: RiskManager
    ) {}

    async executeProposal(config: TradeConfig): Promise<any> {
        const proposal = {
            proposal: 1,
            amount: config.stake,
            basis: 'stake',
            contract_type: config.contractType,
            currency: 'USD',
            underlying_symbol: config.symbol, // V1 Options API compatibility
            duration: config.duration,
            duration_unit: config.durationUnit,
        };

        if (config.barrier) {
            (proposal as any).barrier = config.barrier;
        }

        if (config.digit !== undefined) {
            (proposal as any).barrier = String(config.digit ?? '');
        }

        try {
            const response = await this.connector.sendAndWait(proposal, 'proposal', 4000);
            if (!response?.proposal?.id) {
                console.error('[v0] Invalid proposal response:', response);
                throw new Error('Invalid proposal response: missing proposal id');
            }
            return response.proposal;
        } catch (error) {
            console.error('[v0] Proposal failed:', error);
            throw error;
        }
    }

    async buyContract(proposalId: string, price: number): Promise<any> {
        if (!proposalId) {
            throw new Error('Cannot buy contract: proposal id is missing');
        }

        const buyRequest = {
            buy: proposalId,
            price: price,
        };

        try {
            const response = await this.connector.sendAndWait(buyRequest, 'buy', 4000);
            return response.buy;
        } catch (error) {
            console.error('[v0] Buy failed:', error);
            throw error;
        }
    }

    async executeTrade(config: TradeConfig): Promise<TradeResult> {
        try {
            // Step 1: Get proposal
            const proposal = await this.executeProposal(config);
            if (!proposal?.id) {
                throw new Error('Invalid proposal returned from proposal request');
            }

            // Step 2: Buy contract
            const buy = await this.buyContract(proposal.id, proposal.ask_price);

            // Step 3: Record trade
            this.riskManager.openTrade();

            return {
                contractId: buy.contract_id,
                entryPrice: proposal.ask_price,
                entryTime: Date.now(),
                status: 'open',
            };
        } catch (error) {
            console.error('[v0] Trade execution failed:', error);
            throw error;
        }
    }

    async monitorContract(contractId: string, timeoutMs = 60000): Promise<TradeResult> {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const checkInterval = setInterval(async () => {
                try {
                    // Query contract status
                    const response = await this.connector.sendAndWait(
                        { proposal_open_contract: 1, contract_id: contractId },
                        'proposal_open_contract',
                        2000
                    );

                    const contract = response.proposal_open_contract;

                    if (contract.status === 'sold') {
                        clearInterval(checkInterval);
                        resolve({
                            contractId,
                            entryPrice: contract.entry_tick_display_value,
                            entryTime: contract.entry_tick * 1000,
                            exitPrice: contract.exit_tick_display_value,
                            exitTime: contract.exit_tick * 1000,
                            profitLoss: contract.profit,
                            status: 'closed',
                        });
                    }

                    if (Date.now() - startTime > timeoutMs) {
                        clearInterval(checkInterval);
                        reject(new Error('Contract monitoring timeout'));
                    }
                } catch (error) {
                    clearInterval(checkInterval);
                    reject(error);
                }
            }, 500);
        });
    }
}
