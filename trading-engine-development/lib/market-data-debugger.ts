// Market Data Debugger - Monitors the flow of market data through the system
// This helps diagnose why tabs are not receiving market data

export interface DataFlowEvent {
    timestamp: Date;
    stage: 'websocket_receive' | 'tick_processing' | 'analysis_update' | 'signals_generation' | 'ui_render';
    symbol: string;
    digit?: number;
    price?: number;
    message: string;
    status: 'success' | 'error' | 'warning';
}

class MarketDataDebugger {
    private events: DataFlowEvent[] = [];
    private maxEvents = 1000;
    private listeners: ((event: DataFlowEvent) => void)[] = [];

    log(event: Omit<DataFlowEvent, 'timestamp'>) {
        const fullEvent: DataFlowEvent = {
            ...event,
            timestamp: new Date(),
        };

        this.events.push(fullEvent);
        if (this.events.length > this.maxEvents) {
            this.events.shift();
        }

        // Log to console with styling
        const color = event.status === 'error' ? '#ff6b6b' : event.status === 'warning' ? '#ffd93d' : '#51cf66';
        console.log(
            `%c[MARKET_DATA] ${event.stage.toUpperCase()}`,
            `color: ${color}; font-weight: bold;`,
            `${event.symbol} | ${event.message}`,
            event
        );

        // Notify listeners
        this.listeners.forEach(listener => listener(fullEvent));
    }

    onUpdate(callback: (event: DataFlowEvent) => void) {
        this.listeners.push(callback);
    }

    getEvents(stage?: string): DataFlowEvent[] {
        return stage ? this.events.filter(e => e.stage === stage) : this.events;
    }

    getLastEvent(stage?: string): DataFlowEvent | undefined {
        const events = stage ? this.events.filter(e => e.stage === stage) : this.events;
        return events[events.length - 1];
    }

    clear() {
        this.events = [];
    }

    getStats() {
        const success = this.events.filter(e => e.status === 'success').length;
        const errors = this.events.filter(e => e.status === 'error').length;
        const warnings = this.events.filter(e => e.status === 'warning').length;

        return { success, errors, warnings, total: this.events.length };
    }
}

export const marketDataDebugger = new MarketDataDebugger();
