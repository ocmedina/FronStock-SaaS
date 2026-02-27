import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
                    supabaseResponse = NextResponse.next({
                        request,
                    });
                    cookiesToSet.forEach(({ name, value, options }) => {
                        // Make cookie session-only
                        const sessionOptions = { ...options };
                        delete sessionOptions.maxAge;
                        delete sessionOptions.expires;

                        supabaseResponse.cookies.set(name, value, sessionOptions);
                    });
                },
            },
        }
    );

    // IMPORTANT: Don't add any logic between createServerClient and getUser()
    // A simple mistake could make it very hard to debug session issues.

    let user = null;
    let authErrorType: 'none' | 'network' | 'invalid_token' | 'no_session' | 'unknown' = 'none';

    const isInvalidRefreshTokenError = (error: any) => {
        const message = (error?.message || '').toString();
        const code = (error?.code || '').toString();
        return (
            code === 'refresh_token_not_found' ||
            message.includes('Invalid Refresh Token') ||
            message.includes('Refresh Token')
        );
    };

    const isNetworkAuthError = (error: any) => {
        const message = (error?.message || '').toString().toLowerCase();
        return (
            message.includes('failed to fetch') ||
            message.includes('fetch failed') ||
            message.includes('networkerror') ||
            message.includes('network request failed') ||
            message.includes('timeout')
        );
    };

    const isMissingSessionError = (error: any) => {
        const message = (error?.message || '').toString();
        return (
            error?.name === 'AuthSessionMissingError' ||
            message.includes('Auth session missing')
        );
    };

    try {
        const { data, error } = await supabase.auth.getUser();
        if (error) {
            if (isInvalidRefreshTokenError(error)) {
                authErrorType = 'invalid_token';
                console.warn('Invalid refresh token, clearing session');
                // Clear Supabase auth cookies
                request.cookies.getAll().forEach(cookie => {
                    if (cookie.name.startsWith('sb-')) {
                        supabaseResponse.cookies.delete(cookie.name);
                    }
                });
            } else if (isMissingSessionError(error)) {
                authErrorType = 'no_session';
            } else if (isNetworkAuthError(error)) {
                authErrorType = 'network';
                console.warn('Network auth error in middleware, preserving session cookies');
            } else {
                authErrorType = 'unknown';
                console.warn('Non-fatal auth error in middleware, preserving session cookies', error);
            }
        } else {
            user = data.user;
        }
    } catch (error) {
        console.error('Auth error in middleware:', error);
        if (isNetworkAuthError(error)) {
            authErrorType = 'network';
        } else {
            authErrorType = 'unknown';
        }
    }

    return { user, supabaseResponse, authErrorType };
}
