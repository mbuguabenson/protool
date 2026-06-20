'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { OAUTH_CLIENT_ID, DERIV_REDIRECT_URL } from '@/lib/deriv-config';

export default function AuthCallbackPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState('Authenticating...');

    useEffect(() => {
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const errorParam = searchParams.get('error');
        const errorDesc = searchParams.get('error_description');

        if (errorParam) {
            setError(`${errorParam}: ${errorDesc || 'Access denied'}`);
            return;
        }

        if (!code) {
            setError('No authorization code found in callback');
            return;
        }

        const exchangeCode = async () => {
            try {
                const storedState = sessionStorage.getItem('oauth_state');
                const codeVerifier = sessionStorage.getItem('pkce_code_verifier');

                if (state !== storedState) {
                    throw new Error('Invalid state parameter (CSRF protection)');
                }

                if (!codeVerifier) {
                    throw new Error('Missing code verifier');
                }

                setStatus('Exchanging code for access token...');

                const response = await fetch('/api/auth/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        code,
                        code_verifier: codeVerifier,
                        redirect_uri: DERIV_REDIRECT_URL,
                        client_id: OAUTH_CLIENT_ID,
                    }),
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error_description || data.error || 'Token exchange failed');
                }

                setStatus('Storing session and logging in...');

                // Clear PKCE storage
                sessionStorage.removeItem('oauth_state');
                sessionStorage.removeItem('pkce_code_verifier');

                // Store token for the app
                localStorage.setItem('deriv_api_token', data.access_token);

                // Redirect back home to trigger useDerivAuth initialization
                router.push('/');
            } catch (err: any) {
                console.error('[v0] ❌ Callback error:', err);
                setError(err.message || 'Authentication failed');
            }
        };

        exchangeCode();
    }, [searchParams, router]);

    if (error) {
        return (
            <div className='flex flex-col items-center justify-center min-h-screen bg-background p-4 text-center'>
                <h1 className='text-2xl font-bold text-destructive mb-4'>Authentication Error</h1>
                <p className='text-muted-foreground mb-6 max-w-md'>{error}</p>
                <button
                    onClick={() => router.push('/')}
                    className='px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors'
                >
                    Return Home
                </button>
            </div>
        );
    }

    return (
        <div className='flex flex-col items-center justify-center min-h-screen bg-black overflow-hidden relative'>
            <div className='absolute inset-0 bg-blue-500/5 blur-[120px] rounded-full translate-x-[-20%] translate-y-[-20%]' />
            <div className='absolute inset-0 bg-purple-500/5 blur-[120px] rounded-full translate-x-[20%] translate-y-[20%]' />

            <div className='relative z-10 flex flex-col items-center'>
                <div className='w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-8' />
                <h2 className='text-3xl font-light tracking-widest text-primary mb-2 animate-pulse'>
                    ANALYSIS<span className='font-bold'>TOOLPRO</span>
                </h2>
                <p className='text-muted-foreground font-mono text-sm tracking-tighter uppercase opacity-70'>
                    {status}
                </p>
            </div>
        </div>
    );
}
