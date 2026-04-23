'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

function VerifyEmailContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

    useEffect(() => {
        const statusParam = searchParams.get('status');
        if (statusParam === 'success') {
            setStatus('success');
        } else if (statusParam === 'error') {
            setStatus('error');
        } else {
            // Si llegamos aquí sin un estado claro, podríamos asumir éxito si la sesión se creó (esto depende del flujo de la app)
            // Por defecto, si llegamos directo a /verify-email sin parámetros, mostramos loading o un error genérico
            setStatus('error');
        }
    }, [searchParams, router]);

    return (
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-8 shadow-2xl text-center max-w-md w-full mx-auto">
            {status === 'loading' && (
                <div className="flex flex-col items-center justify-center">
                    <svg className="animate-spin h-12 w-12 text-[#0066FF] mb-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <h2 className="text-2xl font-bold text-white mb-2">Verificando...</h2>
                    <p className="text-gray-400">Por favor, espera un momento.</p>
                </div>
            )}

            {status === 'success' && (
                <div className="flex flex-col items-center justify-center">
                    <div className="w-16 h-16 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mb-6">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">¡Correo Verificado!</h2>
                    <p className="text-gray-400 mb-6">
                        Tu dirección de correo electrónico ha sido confirmada con éxito. Ya puedes comenzar a utilizar FrontStock.
                    </p>
                    <Link
                        href="/onboarding"
                        className="w-full inline-block py-3 px-4 bg-[#0066FF] hover:bg-[#0052CC] text-white font-semibold rounded-xl transition-all duration-200"
                    >
                        Continuar
                    </Link>
                </div>
            )}

            {status === 'error' && (
                <div className="flex flex-col items-center justify-center">
                    <div className="w-16 h-16 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center mb-6">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Error de Verificación</h2>
                    <p className="text-gray-400 mb-6">
                        El enlace de verificación es inválido o ha expirado. Por favor, intenta iniciar sesión para solicitar un nuevo enlace o regístrate nuevamente.
                    </p>
                    <Link
                        href="/login"
                        className="w-full inline-block py-3 px-4 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl transition-all duration-200"
                    >
                        Ir al Login
                    </Link>
                </div>
            )}
        </div>
    );
}

export default function VerifyEmailPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center p-8 text-white">
                <svg className="animate-spin h-8 w-8 text-[#0066FF]" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
            </div>
        }>
            <VerifyEmailContent />
        </Suspense>
    );
}
