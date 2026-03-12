'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { createOrganizationSchema, type CreateOrganizationInput } from '@/lib/validations';
import { Building2 } from 'lucide-react';

export default function OnboardingPage() {
    const [formData, setFormData] = useState<CreateOrganizationInput>({
        name: '',
        plan_type: 'free',
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [generalError, setGeneralError] = useState<string | null>(null);

    const router = useRouter();
    const supabase = createClient();

    // Verificar si el usuario ya tiene organización
    useEffect(() => {
        const checkExistingOrg = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push('/login');
                return;
            }

            const { data: profile } = await supabase
                .from('profiles')
                .select('organization_id')
                .eq('id', user.id)
                .single();

            if (profile?.organization_id) {
                router.push('/dashboard');
            }
        };

        checkExistingOrg();
    }, [supabase, router]);

    const validateForm = () => {
        const result = createOrganizationSchema.safeParse(formData);

        if (!result.success) {
            const fieldErrors: Record<string, string> = {};
            result.error.issues.forEach((issue) => {
                const field = issue.path[0];
                if (field) {
                    fieldErrors[String(field)] = issue.message;
                }
            });
            setErrors(fieldErrors);
            return false;
        }

        setErrors({});
        return true;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateForm()) return;

        setIsLoading(true);
        setGeneralError(null);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push('/login');
                return;
            }

            // 1. Crear la organización
            const { data: org, error: orgError } = await supabase
                .from('organizations')
                .insert({
                    name: formData.name,
                    plan_type: formData.plan_type,
                })
                .select()
                .single();

            if (orgError) {
                setGeneralError(orgError.message);
                return;
            }

            // 2. Actualizar el perfil del usuario con la nueva organización
            const { error: profileError } = await supabase
                .from('profiles')
                .update({
                    organization_id: org.id,
                    role: 'admin',
                })
                .eq('id', user.id);

            if (profileError) {
                setGeneralError('Error al vincular la organización: ' + profileError.message);
                return;
            }

            // 3. Redirigir al dashboard
            router.push('/dashboard');
            router.refresh();
        } catch {
            setGeneralError('Error inesperado. Intente nuevamente.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="backdrop-blur-xl bg-white/10 rounded-2xl shadow-2xl border border-white/20 p-8">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <Building2 className="h-8 w-8 text-white" />
                        </div>
                        <h1 className="text-2xl font-bold text-white mb-2">
                            Configura tu negocio
                        </h1>
                        <p className="text-slate-400">
                            Ingresa el nombre de tu organización para comenzar
                        </p>
                    </div>

                    {generalError && (
                        <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg text-sm mb-6">
                            {generalError}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Nombre del Negocio
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                                placeholder="Ej: Mi Tienda"
                                autoFocus
                            />
                            {errors.name && (
                                <p className="mt-1 text-sm text-red-400">{errors.name}</p>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-lg shadow-lg shadow-blue-500/25 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    Creando...
                                </span>
                            ) : (
                                'Crear Organización'
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
