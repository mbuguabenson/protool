import { NextRequest, NextResponse } from 'next/server';

/**
 * Secondary OAuth 2.0 Callback Handler for Deriv
 *
 * This server-side route receives the authorization code when Deriv routes the
 * callback to /api/auth/oauth-callback. It CANNOT do client-side PKCE exchange
 * because:
 *   - sessionStorage (where pkce_code_verifier lives) is inaccessible on the server.
 *   - The primary PKCE exchange is handled by use-deriv-auth.ts on the index page (/).
 *
 * FIX: Pass the code + state back to the index page as URL params so the
 * client-side handler in use-deriv-auth.ts can do the full PKCE exchange with
 * access to sessionStorage.
 *
 * PREVIOUS BUG: This route was redirecting to /dashboard (non-existent route)
 * and attempted cookie-based PKCE state validation (always failed — client uses
 * sessionStorage, not cookies).
 */

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        console.log('[v0] OAuth secondary callback received:', { code: code?.substring(0, 8), state, error });

        // Handle OAuth errors from Deriv
        if (error) {
            console.error('[v0] OAuth error from Deriv:', error, errorDescription);
            return NextResponse.redirect(
                new URL(
                    `/auth-error?error=${encodeURIComponent(error)}&description=${encodeURIComponent(errorDescription || '')}`,
                    request.nextUrl.origin
                )
            );
        }

        if (!code) {
            console.error('[v0] OAuth callback missing authorization code');
            return NextResponse.redirect(
                new URL(
                    '/auth-error?error=missing_code&description=Authorization%20code%20not%20received',
                    request.nextUrl.origin
                )
            );
        }

        // Pass the code + state to the index page where use-deriv-auth.ts will handle
        // the full client-side PKCE exchange with access to sessionStorage.
        const redirectUrl = new URL('/', request.nextUrl.origin);
        redirectUrl.searchParams.set('code', code);
        if (state) redirectUrl.searchParams.set('state', state);

        console.log('[v0] Forwarding OAuth code to index page for client-side PKCE exchange');
        return NextResponse.redirect(redirectUrl);
    } catch (err) {
        console.error('[v0] OAuth callback server error:', err);
        return NextResponse.redirect(
            new URL(
                `/auth-error?error=server_error&description=${encodeURIComponent(err instanceof Error ? err.message : 'Unknown error')}`,
                request.nextUrl.origin
            )
        );
    }
}
