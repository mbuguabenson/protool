'use client';
import '@/lib/react-19-shim';
import React from 'react';

import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { DerivAPIClient } from './deriv-api';
import { DERIV_APP_ID } from './deriv-config';
import { useDerivAuth } from '@/hooks/use-deriv-auth';
import { DerivWebSocketManager } from './deriv-websocket-manager';

interface Balance {
    amount: number;
    currency: string;
}

interface Account {
    id: string;
    type: 'Demo' | 'Real';
    currency: string;
    balance: number;
}

interface DerivAPIContextType {
    apiClient: DerivAPIClient | null;
    isConnected: boolean;
    isAuthorized: boolean;
    isInitializing: boolean;
    error: string | null;
    connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
    // Auth properties from useDerivAuth
    token: string;
    isLoggedIn: boolean;
    balance: Balance | null;
    accountType: 'Demo' | 'Real' | null;
    accountCode: string;
    accounts: Account[];
    activeLoginId: string | null;
    logout: () => void;
    requestLogin: () => void;
    switchAccount: (loginId: string) => void;
    submitApiToken: (token: string) => void;
    openTokenSettings: () => void;
}

const DerivAPIContext = createContext<DerivAPIContextType | null>(null);

let globalAPIClient: DerivAPIClient | null = null;

export function DerivAPIProvider({ children }: { children: React.ReactNode }) {
    const [apiClient, setApiClient] = useState<DerivAPIClient | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [connectionStatus, setConnectionStatus] = useState<
        'disconnected' | 'connecting' | 'connected' | 'reconnecting'
    >('disconnected');
    const clientRef = useRef<DerivAPIClient | null>(null);
    const initAttemptRef = useRef(0);
    const auth = useDerivAuth();
    const { token, isLoggedIn, isInitializing } = auth;

    useEffect(() => {
        // 1. Ensure basic API client exists even without token
        if (!globalAPIClient) {
            console.log('[v0] Initializing baseline DerivAPIClient with App ID:', DERIV_APP_ID);
            globalAPIClient = new DerivAPIClient({
                appId: String(DERIV_APP_ID),
            });

            globalAPIClient.setErrorCallback(err => {
                const errorMessage = err?.message || (typeof err === 'string' ? err : 'Unknown API Error');
                setError(errorMessage);
            });

            clientRef.current = globalAPIClient;
            setApiClient(globalAPIClient);
        }

        // Register the 401 / token-expiry hook on the singleton WS manager.
        // When any REST call (accounts or OTP) returns 401, the access token is
        // expired — clear local storage and send the user back to login.
        const wsManager = DerivWebSocketManager.getInstance();
        wsManager.onTokenExpired = () => {
            console.warn('[v0] 🔑 Access token expired (401). Clearing session and requesting re-login.');
            localStorage.removeItem('deriv_api_token');
            localStorage.removeItem('deriv_auth_token');
            localStorage.removeItem('authToken');
            localStorage.removeItem('clientToken');
            auth.requestLogin();
        };

        const client = globalAPIClient;

        // 2. Handle Connection and Authorization
        // NOTE: Authorization is driven by the useDerivAuth hook's connectWithToken().
        // We do NOT call client.authorize(token) here — doing so caused parallel auth
        // flows that fought each other, spawning duplicate OTP requests and 429 loops.
        const syncConnection = async () => {
            try {
                setIsConnected(client.isConnected());
                setIsAuthorized(client.isAuth());

                if (client.isConnected() && client.isAuth() && error) {
                    setError(null);
                    setConnectionStatus('connected');
                } else if (client.isConnected()) {
                    setConnectionStatus('connected');
                }
            } catch (err: any) {
                console.error('[v0] Sync failed:', err);
                setConnectionStatus('reconnecting');
                setError(err?.message || 'Connection sync failed');
            }
        };

        syncConnection();

        // 3. Status Polling
        const interval = setInterval(() => {
            if (client) {
                const connected = client.isConnected();
                const authorized = client.isAuth();

                setIsConnected(connected);
                setIsAuthorized(authorized);

                if (connected && authorized && error) {
                    setError(null);
                    setConnectionStatus('connected');
                }
            }
        }, 3000);

        // 4. Cross-Tab Synchronization
        const handleStorageChange = (e: StorageEvent) => {
            // Invalidate local state if accounts or active account changes in another tab
            if (e.key?.startsWith('deriv_accounts_v1_') || e.key === 'deriv_active_loginid') {
                console.log(`[v0] 🔄 Syncing auth state from other tab (${e.key})...`);
                if (token && isLoggedIn) {
                    syncConnection();
                }
            }
        };

        window.addEventListener('storage', handleStorageChange);

        return () => {
            clearInterval(interval);
            window.removeEventListener('storage', handleStorageChange);
            // Clean up the token-expiry hook when this effect re-runs
            const mgr = DerivWebSocketManager.getInstance();
            if (mgr.onTokenExpired === wsManager.onTokenExpired) {
                mgr.onTokenExpired = null;
            }
        };
    }, [token, isLoggedIn]);

    return (
        <DerivAPIContext.Provider
            value={{
                apiClient,
                isConnected,
                isAuthorized,
                isInitializing,
                error,
                connectionStatus,
                token: auth.token,
                isLoggedIn: auth.isLoggedIn,
                balance: auth.balance,
                accountType: auth.accountType,
                accountCode: auth.accountCode,
                accounts: auth.accounts,
                activeLoginId: auth.activeLoginId,
                logout: auth.logout,
                requestLogin: auth.requestLogin,
                switchAccount: auth.switchAccount,
                submitApiToken: auth.submitApiToken,
                openTokenSettings: auth.openTokenSettings,
            }}
        >
            {children}
        </DerivAPIContext.Provider>
    );
}

export function useDerivAPI() {
    const context = useContext(DerivAPIContext);
    if (!context) {
        // Return a dummy context to avoid crashing, but warn
        console.error('useDerivAPI must be used within DerivAPIProvider');
        return {
            apiClient: null,
            isConnected: false,
            isAuthorized: false,
            isInitializing: false,
            error: 'Context not found',
            connectionStatus: 'disconnected',
            token: '',
            isLoggedIn: false,
            balance: null,
            accountType: null,
            accountCode: '',
            accounts: [],
            activeLoginId: null,
            logout: () => {},
            requestLogin: () => {},
            switchAccount: () => {},
            submitApiToken: () => {},
            openTokenSettings: () => {},
        } as DerivAPIContextType;
    }
    return context;
}
