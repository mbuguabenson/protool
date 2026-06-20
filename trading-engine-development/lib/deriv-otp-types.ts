/**
 * Deriv Options Trading API Types
 * OAuth2 + OTP -> WebSocket Flow
 * Reference: https://developers.deriv.com/docs/
 */

// OAuth2 + OTP Response Types
export interface OtpResponse {
    data: {
        url: string; // wss://.../ws/demo?otp=...
    };
}

// WebSocket Message Types
export interface ProposalMsg {
    msg_type: 'proposal';
    proposal: {
        id: string;
        ask_price: number;
        payout: number;
        spot: number;
        spot_time: number;
        longcode: string;
    };
    req_id?: number;
    error?: {
        code: string;
        message: string;
    };
}

export interface BuyMsg {
    msg_type: 'buy';
    buy: {
        contract_id: number;
        buy_price: number;
        payout: number;
        longcode: string;
        start_time: number;
        transaction_id: number;
    };
    req_id?: number;
    error?: {
        code: string;
        message: string;
    };
}

export interface ProposalOpenContractMsg {
    msg_type: 'proposal_open_contract';
    proposal_open_contract: {
        contract_id: number;
        is_sold: boolean;
        profit?: number;
        payout?: number;
        bid_price?: number;
        buy_price: number;
        entry_tick?: number;
        exit_tick?: number;
        entry_spot?: string;
        exit_spot?: string;
        current_spot?: string;
        current_spot_time?: number;
        tick_count?: number;
        status?: string;
        shortcode?: string;
        longcode?: string;
    };
    req_id?: number;
}

export interface ActiveSymbolsMsg {
    msg_type: 'active_symbols';
    active_symbols: Array<{
        symbol: string;
        display_name: string;
        market: string;
        market_display_name: string;
        submarket?: string;
        submarket_display_name?: string;
        is_trading_suspended?: number;
    }>;
    req_id?: number;
}

export interface TickMsg {
    msg_type: 'tick';
    tick: {
        symbol: string;
        quote: number;
        epoch: number;
        pip_size?: number;
    };
    req_id?: number;
}

export interface SubscriptionMsg {
    msg_type: 'subscription';
    subscription: {
        id: string;
    };
    req_id?: number;
}

export type DerivMessage =
    | ProposalMsg
    | BuyMsg
    | ProposalOpenContractMsg
    | ActiveSymbolsMsg
    | TickMsg
    | SubscriptionMsg
    | { error?: { message: string; code: string }; msg_type?: string; req_id?: number };

// Trading Request Types
export interface ProposalRequest {
    proposal: number; // 1 for getting a proposal
    amount: number;
    basis: 'stake' | 'payout' | 'multiplier';
    contract_type: 'CALL' | 'PUT' | 'DIGITDIFF' | 'DIGITEVEN' | 'DIGITODD' | 'DIGITMATCH' | 'DIGITDIFFMATCH'; // Add more as needed
    currency: string;
    duration: number;
    duration_unit: 't' | 's' | 'm' | 'h' | 'd'; // tick, second, minute, hour, day
    underlying_symbol: string;
    req_id?: number;
    symbol?: string; // Deprecated but might still be used
    barrier?: string | number;
}

export interface BuyRequest {
    buy: string | number; // proposal ID from proposal response
    price: number;
    req_id?: number;
}

export interface ContractSubscriptionRequest {
    proposal_open_contract: number; // 1 for subscription
    contract_id: number;
    subscribe: number; // 1 to subscribe
    req_id?: number;
}

export interface ActiveSymbolsRequest {
    active_symbols: 'brief' | 'full';
    req_id?: number;
}

export interface TickSubscriptionRequest {
    ticks: string;
    subscribe: number; // 1 to subscribe
    req_id?: number;
}

// Account Types
export interface OptionsAccount {
    id: string;
    email: string;
    currency: string;
    is_virtual: boolean;
}
