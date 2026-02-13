import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// Rutas que no requieren autenticación
const publicRoutes = ['/login', '/register', '/visor', '/'];
const authRoutes = ['/login', '/register'];

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Actualizar sesión y obtener usuario
    const { user, supabaseResponse, authErrorType } = await updateSession(request);
    const hasSupabaseAuthCookie = request.cookies
        .getAll()
        .some((cookie) => cookie.name.startsWith('sb-') && cookie.value);

    // Rutas públicas: permitir acceso sin autenticación
    if (publicRoutes.some((route) => pathname === route || pathname.startsWith('/visor'))) {
        // Si está en ruta de auth y ya tiene sesión, redirigir al dashboard
        if (authRoutes.includes(pathname) && user) {
            return Response.redirect(new URL('/dashboard', request.url));
        }
        return supabaseResponse;
    }

    // Rutas protegidas: requieren autenticación
    if (pathname.startsWith('/dashboard') || pathname.startsWith('/onboarding') || pathname.startsWith('/delivery')) {
        if (!user) {
            if (authErrorType === 'network' && hasSupabaseAuthCookie) {
                return supabaseResponse;
            }

            // Guardar la URL original para redirigir después del login
            const redirectUrl = new URL('/login', request.url);
            redirectUrl.searchParams.set('redirect', pathname);
            return Response.redirect(redirectUrl);
        }

        // Obtener rol del usuario
        // Nota: Idealmente el rol debería estar en user_metadata para evitar llamada a DB.

        // const { createServerClient } = require('@supabase/ssr');
        // Usamos import dinámico o workaround
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { createServerClient } = require('@supabase/ssr');
        const supabaseClient = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() { return request.cookies.getAll(); },
                    setAll() { } // No escribimos cookies aquí
                }
            }
        );

        const { data: profile, error: roleError } = await supabaseClient
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (roleError) {
            return supabaseResponse;
        }

        const role = profile?.role;

        // Redirección para repartidores
        if (role === 'delivery') {
            if (pathname.startsWith('/dashboard')) {
                return Response.redirect(new URL('/delivery', request.url));
            }
        }

        // Redirección para NO repartidores intentando entrar a delivery
        if (role !== 'delivery' && pathname.startsWith('/delivery')) {
            if (role !== 'owner' && role !== 'admin') {
                return Response.redirect(new URL('/dashboard', request.url));
            }
        }
    }

    return supabaseResponse;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};