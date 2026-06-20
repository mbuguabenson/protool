export interface DerivAPIConfig {
    appId: string;
    token?: string;
    isOptions?: boolean;
    accountType?: 'demo' | 'real' | 'public';
}

export interface AuthorizeResponse {
    loginid: string;
    balance: number;
    currency: string;
    is_virtual: boolean;
    email: string;
}

export interface ActiveSymbol {
    symbol: string;
    display_name: string;
    market: string;
    market_display_name: string;
}

export interface ContractType {
    contract_type: string;
    contract_display: string;
    contract_category: string;
    contract_category_display: string;
    barriers: number;
}

export interface ProposalRequest {
    symbol: string;
    contract_type: string;
    amount: number;
    basis: string;
    duration: number;
    duration_unit: string;
    currency: string;
    barrier?: string;
}

export interface ProposalResponse {
    id: string;
    ask_price: number;
    payout: number;
    spot: number;
    spot_time: number;
    longcode: string;
}

export interface BuyResponse {
    contract_id: number;
    buy_price: number;
    payout: number;
    longcode: string;
    start_time: number;
    transaction_id: number;
}

export interface ContractUpdate {
    contract_id: number;
    is_sold: boolean;
    profit?: number;
    payout?: number;
    buy_price: number;
    entry_tick?: number;
    exit_tick?: number;
    entry_spot?: string;
    exit_spot?: string;
    current_spot?: string;
    current_spot_time?: number;
    tick_count?: number;
    display_name?: string;
    status?: string;
}

export interface TickData {
    symbol: string;
    quote: number;
    epoch: number;
    pipSize?: number;
    id?: string;
}

export interface TickHistoryResponse {
    prices: number[];
    times: number[];
    pip_size?: number;
}

export interface StatementTransaction {
    action_type: string;
    amount: number;
    app_id: number;
    balance_after: number;
    contract_id?: number;
    display_name: string;
    longcode: string;
    payout?: number;
    purchase_time?: number;
    reference_id: number;
    shortcode?: string;
    transaction_id: number;
    transaction_time: number;
}

export interface StatementResponse {
    count: number;
    transactions: StatementTransaction[];
}

export interface ProfitTableTransaction {
    app_id: number;
    buy_price: number;
    contract_id: number;
    contract_type: string;
    display_name: string;
    longcode: string;
    payout: number;
    profit_loss: number;
    purchase_time: number;
    sell_price: number;
    sell_time: number;
    shortcode: string;
    transaction_id: number;
}

export interface ProfitTableResponse {
    count: number;
    transactions: ProfitTableTransaction[];
}

export interface PortfolioContract {
    contract_id: number;
    contract_type: string;
    currency: string;
    buy_price: number;
    payout: number;
    symbol?: string;
    longcode?: string;
    purchase_time?: number;
}

export interface PortfolioResponse {
    contracts: PortfolioContract[];
}

import { DerivWebSocketManager } from './deriv-websocket-manager';
import { derivREST } from './deriv-rest-client';

export class DerivAPIClient {
    private manager: DerivWebSocketManager;
    private reqId = 0; // Still used locally for tracking my own requests
    private pendingRequests = new Map<number, { resolve: (value: any) => void; reject: (reason: any) => void }>();
    private subscriptions = new Map<string, (data: any) => void>();
    private activeSubscriptions = new Map<string, string>();
    private config: DerivAPIConfig;
    private isAuthorised = false;
    private onErrorCallback?: (error: any) => void;
    private wildcardListener?: (data: any) => void;

    constructor(config: DerivAPIConfig) {
        this.config = config;
        this.manager = DerivWebSocketManager.getInstance();
        this.setupListeners();
    }

    get token() {
        return this.config.token;
    }

    async call(request: any): Promise<any> {
        return this.send(request);
    }

    private setupListeners() {
        this.wildcardListener = (data: any) => {
            this.handleMessage(data);
        };
        this.manager.on('*', this.wildcardListener);
    }

    setErrorCallback(callback: (error: any) => void) {
        this.onErrorCallback = callback;
    }

    async connect(): Promise<void> {
        if (this.config.isOptions) {
            const type = this.config.accountType || 'public';
            let otpUrl: string | undefined;

            if (type !== 'public' && this.config.token) {
                // Pick the matching account by account_type, then get a fresh OTP URL
                try {
                    const accounts = await derivREST.getAccounts();
                    // getAccounts() now returns the unwrapped data[] array with { account_id, account_type }
                    const account = accounts.find((a: any) =>
                        this.config.accountType === 'demo' ? a.account_type === 'demo' : a.account_type === 'real'
                    );
                    if (account?.account_id) {
                        // getOTP() returns the full wss://…?otp=… URL — pass it straight through
                        otpUrl = await derivREST.getOTP(account.account_id);
                    }
                } catch (e) {
                    console.error('[v0] Potential error fetching OTP (might be public only):', e);
                }
            }

            // connectOptions detects a full wss:// URL and connects to it directly
            await this.manager.connectOptions(type, otpUrl);
            this.isAuthorised = type !== 'public'; // OTP auth is implicit
        } else {
            await this.manager.connect();
            if (this.config.token && !this.isAuthorised) {
                await this.authorize(this.config.token);
            }
        }
    }

    private handleMessage(response: any) {
        // Only handle errors if they belong to a request we sent
        const req_id = response.req_id ? Number(response.req_id) : null;

        if (response.error && req_id && this.pendingRequests.has(req_id)) {
            if (this.onErrorCallback) {
                this.onErrorCallback(response.error);
            }

            const promise = this.pendingRequests.get(req_id)!;
            promise.reject(response.error);
            this.pendingRequests.delete(req_id);
            return;
        }

        // Success response for a pending request
        if (req_id && this.pendingRequests.has(req_id)) {
            const promise = this.pendingRequests.get(req_id)!;
            promise.resolve(response);
            this.pendingRequests.delete(req_id);
        }

        // Subscription updates (these often don't have req_id after the first message)
        if (response.subscription) {
            const callback = this.subscriptions.get(response.subscription.id);
            if (callback) {
                // Skip tick type as it's handled centrally via manager and registered explicitly
                if (response.msg_type !== 'tick') {
                    callback(response);
                }
            }
        }
    }

    public async send(request: any): Promise<any> {
        return new Promise((resolve, reject) => {
            const req_id = this.manager.getNextReqId();
            this.pendingRequests.set(req_id, { resolve, reject });

            const message = { ...request, req_id };

            try {
                this.manager.send(message);
            } catch (error) {
                console.error('[v0] Error sending message:', error);
                this.pendingRequests.delete(req_id);
                reject(error);
                return;
            }

            setTimeout(() => {
                if (this.pendingRequests.has(req_id)) {
                    const errorMsg = `Request ${req_id} (${Object.keys(request)[0]}) timed out after 60000ms`;
                    console.error(`[v0] ${errorMsg}`);
                    this.pendingRequests.get(req_id)!.reject(new Error(errorMsg));
                    this.pendingRequests.delete(req_id);
                }
            }, 60000);
        });
    }

    async authorize(token: string): Promise<AuthorizeResponse> {
        this.config.token = token;

        try {
            // Use the manager's new V1 Authorization Flow (REST + OTP Reconnection)
            await this.manager.authorize(token);
            this.isAuthorised = true;

            // Since V1 auth doesn't provide a direct WebSocket 'authorize' response here,
            // we might need to fetch account info via REST or wait for the manager to stabilize.
            // For now, return a minimal success object.
            return {
                loginid: 'v1_authorized',
                balance: 0,
                currency: 'USD',
                is_virtual: true,
                email: 'v1@deriv.com',
            };
        } catch (error) {
            this.isAuthorised = false;
            throw error;
        }
    }

    async getActiveSymbols(): Promise<ActiveSymbol[]> {
        const request: any = { active_symbols: 'brief' };
        const response = await this.send(request);
        const mapped: ActiveSymbol[] = response.active_symbols.map((s: any) => ({
            symbol: s.underlying_symbol || s.symbol,
            display_name: s.underlying_symbol_name || s.display_name,
            market: s.market,
            market_display_name: s.market_display_name,
        }));

        // Ensure 15 1s, 30 1s, and 90 1s markets are present as fallbacks
        const fallbacks = [
            {
                symbol: '1HZ15V',
                display_name: 'Volatility 15 (1S) Index',
                market: 'synthetic_index',
                market_display_name: 'Derived Indices',
            },
            {
                symbol: '1HZ30V',
                display_name: 'Volatility 30 (1S) Index',
                market: 'synthetic_index',
                market_display_name: 'Derived Indices',
            },
            {
                symbol: '1HZ90V',
                display_name: 'Volatility 90 (1S) Index',
                market: 'synthetic_index',
                market_display_name: 'Derived Indices',
            },
        ];

        fallbacks.forEach(f => {
            if (!mapped.some(s => s.symbol === f.symbol)) {
                mapped.push(f);
            }
        });

        return mapped;
    }

    async getContractsFor(symbol: string): Promise<ContractType[]> {
        const response = await this.send({ contracts_for: symbol });
        return response.contracts_for.available;
    }

    async getProposal(params: ProposalRequest): Promise<ProposalResponse> {
        const validatedParams = { ...params };

        // For digit contracts, ensure minimum duration and ticks duration_unit
        if (params.contract_type?.includes('DIGIT')) {
            if (params.duration < 5) {
                console.log(`[v0] Adjusting duration from ${params.duration} to 5 for digit contract`);
                validatedParams.duration = 5;
            }
            validatedParams.duration_unit = 't';
        }

        if (!validatedParams.symbol || validatedParams.symbol.length === 0) {
            throw new Error('Invalid symbol: Symbol cannot be empty');
        }

        const proposalReq: any = {
            proposal: 1,
            amount: validatedParams.amount,
            basis: validatedParams.basis || 'stake',
            contract_type: validatedParams.contract_type,
            currency: validatedParams.currency,
            duration: validatedParams.duration,
            duration_unit: validatedParams.duration_unit,
            underlying_symbol: validatedParams.symbol,
            ...(validatedParams.barrier ? { barrier: validatedParams.barrier } : {}),
        };

        console.log('[v0] Proposal request payload:', proposalReq);

        const response = await this.send(proposalReq);

        if (response.error) {
            console.error('[v0] Proposal error:', response.error);
            throw new Error(response.error.message || 'Proposal failed');
        }

        return response.proposal;
    }

    async getTickHistory(symbol: string, count = 1000): Promise<TickHistoryResponse> {
        const response = await this.send({
            ticks_history: symbol,
            count: count,
            end: 'latest',
            style: 'ticks',
        });
        return {
            prices: response.history.prices,
            times: response.history.times,
        };
    }

    async getTick(symbol: string): Promise<TickData> {
        const response = await this.send({ ticks: symbol });
        return response.tick;
    }

    async buyContract(proposalId: string, askPrice?: number): Promise<BuyResponse> {
        console.log('[v0] 🛒 buying contract:', proposalId, 'at price:', askPrice);
        const buyRequest: any = { buy: proposalId };
        if (askPrice !== undefined && isFinite(askPrice)) {
            buyRequest.price = askPrice;
        }

        // For Options API, we might need a request ID or specific fields
        // Migration: loginid is removed (we already don't send it here)

        try {
            const response = await this.send(buyRequest);
            if (response.error) {
                throw new Error(response.error.message || 'Buy request failed');
            }
            return response.buy;
        } catch (err) {
            console.error('[v0] ❌ Buy execution failed:', err);
            throw err;
        }
    }

    async sellContract(contractId: number, price: number): Promise<any> {
        console.log('[v0] 💰 selling contract:', contractId, 'at price:', price);
        try {
            const response = await this.send({
                sell: contractId,
                price: price,
            });
            if (response.error) {
                throw new Error(response.error.message || 'Sell request failed');
            }
            return response.sell;
        } catch (err) {
            console.error('[v0] ❌ Sell execution failed:', err);
            throw err;
        }
    }

    async getStatement(limit = 100, offset = 0, date_from?: number, date_to?: number): Promise<StatementResponse> {
        const response = await this.send({
            statement: 1,
            description: 1,
            limit,
            offset,
            ...(date_from && { date_from }),
            ...(date_to && { date_to }),
        });
        return response.statement;
    }

    async getProfitTable(limit = 100, offset = 0, date_from?: number, date_to?: number): Promise<ProfitTableResponse> {
        const response = await this.send({
            profit_table: 1,
            description: 1,
            limit,
            offset,
            ...(date_from && { date_from }),
            ...(date_to && { date_to }),
        });
        return response.profit_table;
    }

    async subscribeBalance(callback: (balance: number, currency: string) => void): Promise<string> {
        const existingSubscription = Array.from(this.subscriptions.keys()).find(key =>
            key.toLowerCase().includes('balance')
        );

        if (existingSubscription) {
            console.log('[v0] Already subscribed to balance, reusing existing subscription');
            return existingSubscription;
        }

        const response = await this.send({ balance: 1, subscribe: 1 });
        const subscriptionId = response.subscription.id;

        this.subscriptions.set(subscriptionId, data => {
            if (data.balance) {
                callback(data.balance.balance, data.balance.currency);
            }
        });

        return subscriptionId;
    }

    async subscribeProposalOpenContract(
        contractId: number,
        callback: (contract: ContractUpdate) => void
    ): Promise<string> {
        const response = await this.send({ proposal_open_contract: 1, contract_id: contractId, subscribe: 1 });
        const subscriptionId = response.subscription.id;

        this.subscriptions.set(subscriptionId, data => {
            if (data.proposal_open_contract) {
                callback(data.proposal_open_contract);
            }
        });

        return subscriptionId;
    }

    async subscribeTicks(symbol: string, callback: (tick: TickData) => void): Promise<string> {
        const existingSubscriptionId = this.activeSubscriptions.get(`tick_${symbol}`);
        if (existingSubscriptionId && this.subscriptions.has(existingSubscriptionId)) {
            console.log(`[v0] Reusing existing tick subscription for ${symbol}`);
            return existingSubscriptionId;
        }

        try {
            // Delegate to manager for shared subscription handling
            const request: any = { ticks: symbol, subscribe: 1 };

            const subscriptionId = await this.manager.subscribeTicks(symbol, callback);

            if (subscriptionId) {
                this.activeSubscriptions.set(`tick_${symbol}`, subscriptionId);
                // The manager successfully handles the callback using its tickCallbacks map.
                // Doing this.subscriptions.set() double-fires the callback with raw tick objects
                // that are missing the 'lastDigit' property.
            }

            return subscriptionId;
        } catch (error: any) {
            const errorDetail = error?.message || JSON.stringify(error);
            if (errorDetail.includes('already subscribed') || error?.code === 'AlreadySubscribed') {
                console.log(`[v0] Already subscribed to ${symbol}, reusing connection`);
                return '';
            }
            console.error(`[v0] Failed to subscribe to ${symbol}:`, errorDetail);
            throw error;
        }
    }

    async getPortfolio(): Promise<PortfolioResponse> {
        const response = await this.send({ portfolio: 1 });
        if (response.error) {
            throw new Error(response.error.message || 'Portfolio fetch failed');
        }

        // Migration: symbol -> underlying_symbol
        if (this.config.isOptions && response.portfolio?.contracts) {
            response.portfolio.contracts = response.portfolio.contracts.map((c: any) => ({
                ...c,
                symbol: c.underlying_symbol || c.symbol,
            }));
        }

        return response.portfolio;
    }

    async subscribePortfolio(callback: (portfolio: PortfolioResponse) => void): Promise<string> {
        const response = await this.send({ portfolio: 1, subscribe: 1 });
        const subscriptionId = response.subscription.id;

        this.subscriptions.set(subscriptionId, data => {
            if (data.portfolio) {
                callback(data.portfolio);
            }
        });

        return subscriptionId;
    }

    private async clearZombieSubscriptions(symbol: string): Promise<void> {
        try {
            const oldId = this.activeSubscriptions.get(`tick_${symbol}`);
            if (oldId && !this.subscriptions.has(oldId)) {
                this.activeSubscriptions.delete(`tick_${symbol}`);
                console.log(`[v0] Cleared zombie subscription reference for ${symbol}`);
            }
        } catch (error) {
            console.log(`[v0] Error clearing zombie subscriptions:`, error);
        }
    }

    async forget(subscriptionId: string, callback?: (data: any) => void): Promise<void> {
        if (!subscriptionId) return;
        try {
            // Use manager's unsubscribe to handle reference counting
            await this.manager.unsubscribe(subscriptionId, callback);
            this.subscriptions.delete(subscriptionId);

            Array.from(this.activeSubscriptions.entries()).forEach(([key, value]) => {
                if (value === subscriptionId) {
                    this.activeSubscriptions.delete(key);
                    console.log(`[v0] Cleaned up subscription reference: ${key}`);
                }
            });
        } catch (error) {
            console.log('[v0] Forget error (ignored):', error);
        }
    }

    async forgetAll(...types: string[]): Promise<void> {
        try {
            const forgetTypes = types.length > 0 ? types : ['balance', 'ticks', 'proposal_open_contract'];
            await this.send({ forget_all: forgetTypes });

            console.log(`[v0] Forgetting all subscriptions for types: ${forgetTypes.join(', ')}`);

            this.subscriptions.clear();
            this.activeSubscriptions.clear();

            console.log('[v0] All subscriptions cleared');
        } catch (error) {
            console.log('[v0] ForgetAll error (ignored):', error);
        }
    }

    async clearSubscription(type: string): Promise<void> {
        try {
            await this.send({ forget_all: type });
            const keysToDelete: string[] = [];
            this.subscriptions.forEach((_, key) => {
                if (key.includes(type)) {
                    keysToDelete.push(key);
                }
            });
            keysToDelete.forEach(key => this.subscriptions.delete(key));

            if (type === 'ticks') {
                for (const key of Array.from(this.activeSubscriptions.keys())) {
                    if (key.startsWith('tick_')) {
                        this.activeSubscriptions.delete(key);
                    }
                }
            }
        } catch (error) {
            console.log('[v0] Clear subscription error (ignored):', error);
        }
    }

    disconnect() {
        this.isAuthorised = false;
        this.pendingRequests.clear();
        this.subscriptions.clear();
        this.activeSubscriptions.clear();
        if (this.wildcardListener) {
            this.manager.off('*', this.wildcardListener);
        }
        console.log('[v0] DerivAPIClient detached from manager');
    }

    isConnected(): boolean {
        return this.manager.isConnected();
    }

    getPipSize(symbol: string): number {
        return this.manager.getPipSize(symbol);
    }

    isAuth(): boolean {
        return this.isAuthorised || this.manager.isAuthorized;
    }
}
