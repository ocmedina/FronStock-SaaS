'use client';

import { useState, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';

function sanitizeRedirectPath(value: string | null): string {
    if (!value) return '/dashboard';

    // Only allow internal absolute paths, reject protocol-relative or external URLs.
    if (!value.startsWith('/') || value.startsWith('//')) {
        return '/dashboard';
    }

    // Avoid edge-cases with backslashes that can be interpreted as external paths.
    if (value.includes('\\')) {
        return '/dashboard';
    }

    return value;
}

function LoginForm() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isTransitioning, setIsTransitioning] = useState(false);

    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectTo = sanitizeRedirectPath(searchParams.get('redirect'));

    const supabase = createClient();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const { error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (authError) {
                setError(authError.message);
                setIsLoading(false);
                return;
            }

            // Show branded transition screen
            setIsTransitioning(true);

            // Brief flash so the user sees the loading screen
            await new Promise((resolve) => setTimeout(resolve, 1000));

            router.push(redirectTo);
            router.refresh();
        } catch {
            setError('Error inesperado. Intente nuevamente.');
            setIsLoading(false);
        }
    };

    // Fullscreen branded transition (portal to body to escape auth layout container)
    if (isTransitioning) {
        return createPortal(
            <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
                {/* Animated logo */}
                <div className="relative flex items-center justify-center">
                    <div className="absolute h-28 w-28 rounded-full border-2 border-blue-500/20" style={{ animation: 'ping-slow 2s cubic-bezier(0, 0, 0.2, 1) infinite' }} />
                    <div className="absolute h-24 w-24 rounded-full border border-blue-500/10 animate-pulse" />
                    <div className="relative h-20 w-20" style={{ animation: 'bounce-subtle 2s ease-in-out infinite' }}>
                        <Image
                            src="/logo.png"
                            alt="FrontStock"
                            fill
                            className="object-contain drop-shadow-lg"
                            priority
                        />
                    </div>
                </div>

                <div className="mt-8 flex flex-col items-center gap-2">
                    <h2 className="text-xl font-bold text-slate-900 tracking-wide">FrontStock</h2>
                    <p className="text-sm text-slate-500 animate-pulse">Preparando tu espacio de trabajo...</p>
                </div>

                {/* Loading bar */}
                <div className="mt-6 w-48 h-1 bg-blue-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500 rounded-full" style={{ animation: 'loading-bar 1.5s ease-in-out infinite' }} />
                </div>

                <style jsx>{`
                    @keyframes ping-slow {
                        75%, 100% { transform: scale(1.4); opacity: 0; }
                    }
                    @keyframes bounce-subtle {
                        0%, 100% { transform: translateY(0); }
                        50% { transform: translateY(-6px); }
                    }
                    @keyframes loading-bar {
                        0% { width: 0%; margin-left: 0%; }
                        50% { width: 60%; margin-left: 20%; }
                        100% { width: 0%; margin-left: 100%; }
                    }
                `}</style>
            </div>,
            document.body
        );
    }

    return (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/70 sm:p-8">
            {/* Logo y título - visible solo en móvil */}
            <div className="text-center mb-8 lg:hidden">
                <Image
                    src="/logo.png"
                    alt="FrontStock Logo"
                    width={64}
                    height={64}
                    className="mx-auto mb-4"
                    priority
                />
                <h1 className="text-2xl font-bold text-slate-900">FrontStock</h1>
            </div>

            {/* Título del formulario */}
            <div className="mb-8 hidden lg:block">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Bienvenido de nuevo</h2>
                <p className="text-slate-500">Ingresa tus credenciales para acceder</p>
            </div>

            <div className="mb-6 lg:hidden">
                <p className="text-slate-500 text-center">Ingresa tus credenciales para acceder</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
                {error && (
                    <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {error}
                    </div>
                )}

                <div>
                    <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                        Email
                    </label>
                    <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 placeholder-slate-400 transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                        placeholder="tu@email.com"
                    />
                </div>

                <div>
                    <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
                        Contraseña
                    </label>
                    <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 placeholder-slate-400 transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                        placeholder="••••••••"
                    />
                </div>

                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white shadow-lg shadow-blue-600/20 transition-all duration-200 hover:bg-blue-700 hover:shadow-blue-600/30 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]"
                >
                    {isLoading ? (
                        <span className="flex items-center justify-center gap-2">
                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Ingresando...
                        </span>
                    ) : (
                        'Iniciar Sesión'
                    )}
                </button>
            </form>

            <div className="mt-8 border-t border-slate-100 pt-6">
                <p className="text-center text-sm text-slate-500">
                    ¿No tienes cuenta?{' '}
                    <Link href="/register" className="font-medium text-blue-600 transition-colors hover:text-blue-700">
                        Regístrate aquí
                    </Link>
                </p>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center p-8 text-slate-700">
                <svg className="animate-spin h-8 w-8 text-[#0066FF]" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
            </div>
        }>
            <LoginForm />
        </Suspense>
    );
}
