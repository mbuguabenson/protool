/**
 * PKCE (Proof Key for Code Exchange) Utilities
 * Following RFC 7636 and Deriv OAuth 2.0 documentation.
 */

/**
 * Generates a random code verifier string.
 * A cryptographically random string (43–128 characters).
 */
export function generateCodeVerifier(): string {
    const array = new Uint8Array(64);
    window.crypto.getRandomValues(array);
    return Array.from(array)
        .map(v => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'[v % 66])
        .join('');
}

/**
 * Derives the code challenge from the code verifier using SHA-256.
 * Format: BASE64URL(SHA256(code_verifier))
 */
export async function generateCodeChallenge(codeVerifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const hash = await window.crypto.subtle.digest('SHA-256', data);

    return btoa(String.fromCharCode(...new Uint8Array(hash)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

/**
 * Generates a random state for CSRF protection.
 */
export function generateState(): string {
    const array = new Uint8Array(16);
    window.crypto.getRandomValues(array);
    return Array.from(array)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}
