import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    const next = searchParams.get('next') ?? '/dashboard';
    
    // Obtenemos el host original si estamos detrás de un load balancer (como en Vercel)
    const forwardedHost = request.headers.get('x-forwarded-host');
    const isLocalEnv = process.env.NODE_ENV === 'development';
    
    const getRedirectUrl = (path: string) => {
        if (isLocalEnv) {
            return `${origin}${path}`;
        } else if (forwardedHost) {
            return `https://${forwardedHost}${path}`;
        } else {
            return `${origin}${path}`;
        }
    };

    if (code) {
        const supabase = await createClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        
        if (!error) {
            return NextResponse.redirect(getRedirectUrl(next));
        } else {
            // Si hay error en el exchange
            return NextResponse.redirect(getRedirectUrl('/verify-email?status=error'));
        }
    }

    // Si no hay código o algo falló (quizás el enlace ya fue usado)
    return NextResponse.redirect(getRedirectUrl('/verify-email?status=error'));
}
