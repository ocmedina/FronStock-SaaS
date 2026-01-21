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
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    // IMPORTANT: Don't add any logic between createServerClient and getUser()
    // A simple mistake could make it very hard to debug session issues.

    let user = null;
    try {
        const { data, error } = await supabase.auth.getUser();
        if (error) {
            // Handle invalid refresh token by clearing auth cookies
            if (error.code === 'refresh_token_not_found' || error.message.includes('Refresh Token')) {
                console.warn('Invalid refresh token, clearing session');
                // Clear Supabase auth cookies
                request.cookies.getAll().forEach(cookie => {
                    if (cookie.name.startsWith('sb-')) {
                        supabaseResponse.cookies.delete(cookie.name);
                    }
                });
            }
        } else {
            user = data.user;
        }
    } catch (error) {
        console.error('Auth error in middleware:', error);
        // Clear cookies on any auth error
        request.cookies.getAll().forEach(cookie => {
            if (cookie.name.startsWith('sb-')) {
                supabaseResponse.cookies.delete(cookie.name);
            }
        });
    }

    return { user, supabaseResponse };
}
