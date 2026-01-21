import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// Rutas que no requieren autenticación
const publicRoutes = ['/login', '/register', '/visor', '/'];
const authRoutes = ['/login', '/register'];

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Actualizar sesión y obtener usuario
    const { user, supabaseResponse } = await updateSession(request);

    // Rutas públicas: permitir acceso sin autenticación
    if (publicRoutes.some((route) => pathname === route || pathname.startsWith('/visor'))) {
        // Si está en ruta de auth y ya tiene sesión, redirigir al dashboard
        if (authRoutes.includes(pathname) && user) {
            return Response.redirect(new URL('/dashboard', request.url));
        }
        return supabaseResponse;
    }

    // Rutas protegidas: requieren autenticación
    if (pathname.startsWith('/dashboard') || pathname.startsWith('/onboarding')) {
        if (!user) {
            // Guardar la URL original para redirigir después del login
            const redirectUrl = new URL('/login', request.url);
            redirectUrl.searchParams.set('redirect', pathname);
            return Response.redirect(redirectUrl);
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
