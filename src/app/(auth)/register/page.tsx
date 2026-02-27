'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { acceptInvitationForRegisteredUser } from '@/actions/invitations';

function RegisterForm() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [invitationInfo, setInvitationInfo] = useState<{
        organizationName: string;
        role: string;
        token: string;
        organizationId: string;
    } | null>(null);

    const router = useRouter();
    const searchParams = useSearchParams();
    const supabase = createClient();

    // Check for invitation token in URL
    useEffect(() => {
        const token = searchParams.get('token');
        if (token) {
            checkInvitation(token);
        }
    }, [searchParams]);

    const checkInvitation = async (token: string) => {
        const { data: invitation } = await supabase
            .from('invitations')
            .select('*, organizations(name)')
            .eq('token', token)
            .eq('status', 'pending')
            .single();

        if (invitation && new Date(invitation.expires_at) > new Date()) {
            setEmail(invitation.email);
            setInvitationInfo({
                organizationName: invitation.organizations?.name || 'la organización',
                role: invitation.role,
                token: invitation.token,
                organizationId: invitation.organization_id,
            });
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        if (password !== confirmPassword) {
            setError('Las contraseñas no coinciden');
            setIsLoading(false);
            return;
        }

        if (password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres');
            setIsLoading(false);
            return;
        }

        try {
            // Register user
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName,
                    },
                },
            });

            if (authError) {
                setError(authError.message);
                return;
            }

            // If invited, join the organization
            if (invitationInfo && authData.user) {
                const invitationResult = await acceptInvitationForRegisteredUser({
                    token: invitationInfo.token,
                    userId: authData.user.id,
                    fullName,
                });

                if (invitationResult.error) {
                    setError(invitationResult.error);
                    return;
                }

                // Redirect to dashboard
                router.push('/dashboard');
            } else {
                // Regular registration - go to onboarding
                router.push('/onboarding');
            }
            router.refresh();
        } catch {
            setError('Error inesperado. Intente nuevamente.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="backdrop-blur-xl bg-white/10 rounded-2xl shadow-2xl border border-white/20 p-8">
            <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">FrontStock</h1>
                {invitationInfo ? (
                    <div className="text-center">
                        <p className="text-slate-300">¡Has sido invitado!</p>
                        <p className="text-blue-400 font-medium">{invitationInfo.organizationName}</p>
                    </div>
                ) : (
                    <p className="text-slate-400">Crea tu cuenta</p>
                )}
            </div>

            <form onSubmit={handleRegister} className="space-y-5">
                {error && (
                    <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg text-sm">
                        {error}
                    </div>
                )}

                {invitationInfo && (
                    <div className="bg-green-500/20 border border-green-500/50 text-green-200 px-4 py-3 rounded-lg text-sm">
                        Te unirás como <strong>{invitationInfo.role}</strong>
                    </div>
                )}

                <div>
                    <label htmlFor="fullName" className="block text-sm font-medium text-slate-300 mb-2">
                        Nombre Completo
                    </label>
                    <input
                        id="fullName"
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                        placeholder="Juan Pérez"
                    />
                </div>

                <div>
                    <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                        Email
                    </label>
                    <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={!!invitationInfo}
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition disabled:opacity-50"
                        placeholder="tu@email.com"
                    />
                </div>

                <div>
                    <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
                        Contraseña
                    </label>
                    <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                        placeholder="••••••••"
                    />
                </div>

                <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-300 mb-2">
                        Confirmar Contraseña
                    </label>
                    <input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                        placeholder="••••••••"
                    />
                </div>

                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-lg shadow-lg shadow-blue-500/25 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isLoading ? 'Registrando...' : invitationInfo ? 'Unirme al Equipo' : 'Crear Cuenta'}
                </button>
            </form>

            <p className="mt-6 text-center text-slate-400 text-sm">
                ¿Ya tienes cuenta?{' '}
                <Link href="/login" className="text-blue-400 hover:text-blue-300 font-medium">
                    Inicia sesión
                </Link>
            </p>
        </div>
    );
}

export default function RegisterPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center p-8 text-white">
                <svg className="animate-spin h-8 w-8 text-blue-500" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
            </div>
        }>
            <RegisterForm />
        </Suspense>
    );
}
