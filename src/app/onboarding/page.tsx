'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
    createOrganizationSchema,
    organizationTaxConditions,
    type CreateOrganizationInput,
} from '@/lib/validations';
import {
    ArrowLeft,
    ArrowRight,
    Building2,
    Calendar,
    CheckCircle2,
    FileText,
    Hash,
    MapPin,
} from 'lucide-react';
import Image from 'next/image';

const onboardingSteps = [
    { id: 1, title: 'Negocio', description: 'Datos principales de tu empresa' },
    { id: 2, title: 'Fiscal', description: 'Informacion impositiva (opcional)' },
    { id: 3, title: 'Confirmar', description: 'Revisa y crea tu organizacion' },
] as const;

const stepFieldMap: Record<number, Array<keyof CreateOrganizationInput>> = {
    1: ['name', 'address', 'city'],
    2: ['cuit', 'tax_condition', 'gross_income_number', 'activity_start_date'],
    3: [],
};

function mapValidationErrors(input: CreateOrganizationInput): Record<string, string> {
    const result = createOrganizationSchema.safeParse(input);

    if (result.success) {
        return {};
    }

    const fieldErrors: Record<string, string> = {};
    result.error.issues.forEach((issue) => {
        const field = issue.path[0];
        if (field && !fieldErrors[String(field)]) {
            fieldErrors[String(field)] = issue.message;
        }
    });

    return fieldErrors;
}

export default function OnboardingPage() {
    const [formData, setFormData] = useState<CreateOrganizationInput>({
        name: '',
        plan_type: 'free',
        address: '',
        city: '',
        cuit: '',
        tax_condition: 'Responsable Inscripto',
        gross_income_number: '',
        activity_start_date: '',
    });
    const [currentStep, setCurrentStep] = useState(1);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [generalError, setGeneralError] = useState<string | null>(null);
    const [isTransitioning, setIsTransitioning] = useState(false);

    const router = useRouter();
    const supabase = createClient();

    // Verificar si el usuario ya tiene organización
    useEffect(() => {
        const checkExistingOrg = async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser();
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

    const setFieldValue = (field: keyof CreateOrganizationInput, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        setErrors((prev) => {
            if (!prev[field]) return prev;
            const next = { ...prev };
            delete next[field];
            return next;
        });
    };

    const validateCurrentStep = () => {
        const validationErrors = mapValidationErrors(formData);
        const stepFields = stepFieldMap[currentStep] ?? [];

        if (stepFields.length === 0) {
            setErrors({});
            return true;
        }

        const stepErrors: Record<string, string> = {};
        stepFields.forEach((field) => {
            const message = validationErrors[field];
            if (message) {
                stepErrors[field] = message;
            }
        });

        setErrors(stepErrors);
        return Object.keys(stepErrors).length === 0;
    };

    const validateForm = () => {
        const validationErrors = mapValidationErrors(formData);
        setErrors(validationErrors);
        return Object.keys(validationErrors).length === 0;
    };

    const handleNextStep = () => {
        if (!validateCurrentStep()) return;
        setCurrentStep((prev) => Math.min(prev + 1, onboardingSteps.length));
    };

    const handlePreviousStep = () => {
        setErrors({});
        setCurrentStep((prev) => Math.max(prev - 1, 1));
    };

    const handleCreateOrganization = async () => {
        if (!validateForm()) return;

        setIsLoading(true);
        setGeneralError(null);

        try {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) {
                router.push('/login');
                return;
            }

            const { data: org, error: orgError } = await supabase
                .from('organizations')
                .insert({
                    name: formData.name.trim(),
                    plan_type: formData.plan_type,
                    address: formData.address.trim() || null,
                    city: formData.city.trim() || null,
                    cuit: formData.cuit.trim() || null,
                    tax_condition: formData.tax_condition.trim() || null,
                    gross_income_number: formData.gross_income_number.trim() || null,
                    activity_start_date: formData.activity_start_date || null,
                })
                .select()
                .single();

            if (orgError) {
                setGeneralError(orgError.message);
                return;
            }

            const { error: profileError } = await supabase
                .from('profiles')
                .update({
                    organization_id: org.id,
                    role: 'owner',
                })
                .eq('id', user.id);

            if (profileError) {
                setGeneralError('Error al vincular la organización: ' + profileError.message);
                return;
            }

            // Show branded transition
            setIsTransitioning(true);
            await new Promise((resolve) => setTimeout(resolve, 1000));

            router.push('/dashboard');
            router.refresh();
        } catch {
            setGeneralError('Error inesperado. Intente nuevamente.');
            setIsLoading(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (currentStep < onboardingSteps.length) {
            handleNextStep();
            return;
        }

        void handleCreateOrganization();
    };

    const progressPercent = (currentStep / onboardingSteps.length) * 100;

    if (isTransitioning) {
        return createPortal(
            <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
                <div className="relative flex items-center justify-center">
                    <div className="absolute h-28 w-28 rounded-full border-2 border-blue-500/20" style={{ animation: 'ping-slow 2s cubic-bezier(0, 0, 0.2, 1) infinite' }} />
                    <div className="absolute h-24 w-24 rounded-full border border-blue-500/10 animate-pulse" />
                    <div className="relative h-20 w-20" style={{ animation: 'bounce-subtle 2s ease-in-out infinite' }}>
                        <Image src="/logo.png" alt="FrontStock" fill className="object-contain drop-shadow-lg" priority />
                    </div>
                </div>
                <div className="mt-8 flex flex-col items-center gap-2">
                    <h2 className="text-xl font-bold text-white tracking-wide">FrontStock</h2>
                    <p className="text-sm text-slate-400 animate-pulse">¡Tu negocio está listo! Ingresando...</p>
                </div>
                <div className="mt-6 w-48 h-1 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500 rounded-full" style={{ animation: 'loading-bar 1.5s ease-in-out infinite' }} />
                </div>
                <style jsx>{`
                    @keyframes ping-slow { 75%, 100% { transform: scale(1.4); opacity: 0; } }
                    @keyframes bounce-subtle { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
                    @keyframes loading-bar { 0% { width: 0%; margin-left: 0%; } 50% { width: 60%; margin-left: 20%; } 100% { width: 0%; margin-left: 100%; } }
                `}</style>
            </div>,
            document.body
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
            <div className="w-full max-w-3xl">
                <div className="backdrop-blur-xl bg-white/10 rounded-2xl shadow-2xl border border-white/20 p-6 sm:p-8">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <Building2 className="h-8 w-8 text-white" />
                        </div>
                        <h1 className="text-2xl font-bold text-white mb-2">
                            Configura tu negocio
                        </h1>
                        <p className="text-slate-400">
                            Completa estos pasos para dejar tu cuenta lista desde el primer ingreso.
                        </p>
                    </div>

                    <div className="mb-8">
                        <div className="grid grid-cols-3 gap-2 mb-4">
                            {onboardingSteps.map((step) => {
                                const isActive = currentStep === step.id;
                                const isCompleted = currentStep > step.id;

                                return (
                                    <div
                                        key={step.id}
                                        className={`rounded-lg border px-3 py-2 text-left transition ${isCompleted
                                            ? 'border-emerald-400/40 bg-emerald-500/10'
                                            : isActive
                                                ? 'border-blue-400/40 bg-blue-500/10'
                                                : 'border-white/10 bg-white/5'
                                            }`}
                                    >
                                        <p className="text-xs font-semibold text-slate-300">Paso {step.id}</p>
                                        <p className="text-sm text-white">{step.title}</p>
                                        <p className="text-xs text-slate-400">{step.description}</p>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                    </div>

                    {generalError && (
                        <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg text-sm mb-6">
                            {generalError}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {currentStep === 1 && (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Nombre del Negocio *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFieldValue('name', e.target.value)}
                                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                                        placeholder="Ej: Distribuidora Central"
                                        autoFocus
                                    />
                                    {errors.name && (
                                        <p className="mt-1 text-sm text-red-400">{errors.name}</p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        <span className="inline-flex items-center gap-2">
                                            <MapPin className="h-4 w-4" />
                                            Direccion Comercial
                                        </span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.address}
                                        onChange={(e) => setFieldValue('address', e.target.value)}
                                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                                        placeholder="Ej: Av. Corrientes 1234"
                                    />
                                    {errors.address && (
                                        <p className="mt-1 text-sm text-red-400">{errors.address}</p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Ciudad / Localidad
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.city}
                                        onChange={(e) => setFieldValue('city', e.target.value)}
                                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                                        placeholder="Ej: Mendoza, Argentina"
                                    />
                                    {errors.city && (
                                        <p className="mt-1 text-sm text-red-400">{errors.city}</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {currentStep === 2 && (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        <span className="inline-flex items-center gap-2">
                                            <Hash className="h-4 w-4" />
                                            CUIT
                                        </span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.cuit}
                                        onChange={(e) => setFieldValue('cuit', e.target.value)}
                                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                                        placeholder="Ej: 30-12345678-9"
                                    />
                                    {errors.cuit && (
                                        <p className="mt-1 text-sm text-red-400">{errors.cuit}</p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        <span className="inline-flex items-center gap-2">
                                            <FileText className="h-4 w-4" />
                                            Condicion Fiscal
                                        </span>
                                    </label>
                                    <select
                                        value={formData.tax_condition}
                                        onChange={(e) => setFieldValue('tax_condition', e.target.value)}
                                        className="w-full px-4 py-3 bg-slate-800 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                                    >
                                        {organizationTaxConditions.map((option) => (
                                            <option key={option} value={option} className="bg-slate-800">
                                                {option}
                                            </option>
                                        ))}
                                    </select>
                                    {errors.tax_condition && (
                                        <p className="mt-1 text-sm text-red-400">{errors.tax_condition}</p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Ingresos Brutos (IIBB)
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.gross_income_number}
                                        onChange={(e) => setFieldValue('gross_income_number', e.target.value)}
                                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                                        placeholder="N° IIBB o Convenio Mult."
                                    />
                                    {errors.gross_income_number && (
                                        <p className="mt-1 text-sm text-red-400">{errors.gross_income_number}</p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        <span className="inline-flex items-center gap-2">
                                            <Calendar className="h-4 w-4" />
                                            Inicio de Actividades
                                        </span>
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.activity_start_date}
                                        onChange={(e) => setFieldValue('activity_start_date', e.target.value)}
                                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                                    />
                                    {errors.activity_start_date && (
                                        <p className="mt-1 text-sm text-red-400">{errors.activity_start_date}</p>
                                    )}
                                </div>

                                <p className="text-xs text-slate-400">
                                    Estos datos son opcionales y podras editarlos luego en Configuracion.
                                </p>
                            </div>
                        )}

                        {currentStep === 3 && (
                            <div className="space-y-4">
                                <div className="rounded-xl border border-white/15 bg-white/5 p-4 space-y-3">
                                    <h2 className="text-white font-semibold flex items-center gap-2">
                                        <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                                        Resumen de configuracion inicial
                                    </h2>

                                    <div className="grid sm:grid-cols-2 gap-3 text-sm">
                                        <div className="bg-white/5 rounded-lg p-3">
                                            <p className="text-slate-400">Negocio</p>
                                            <p className="text-white font-medium">{formData.name || 'Sin definir'}</p>
                                        </div>
                                        <div className="bg-white/5 rounded-lg p-3">
                                            <p className="text-slate-400">Ciudad</p>
                                            <p className="text-white font-medium">{formData.city || 'No especificada'}</p>
                                        </div>
                                        <div className="bg-white/5 rounded-lg p-3">
                                            <p className="text-slate-400">Direccion</p>
                                            <p className="text-white font-medium">{formData.address || 'No especificada'}</p>
                                        </div>
                                        <div className="bg-white/5 rounded-lg p-3">
                                            <p className="text-slate-400">CUIT</p>
                                            <p className="text-white font-medium">{formData.cuit || 'No especificado'}</p>
                                        </div>
                                        <div className="bg-white/5 rounded-lg p-3">
                                            <p className="text-slate-400">Condicion Fiscal</p>
                                            <p className="text-white font-medium">{formData.tax_condition || 'No especificada'}</p>
                                        </div>
                                        <div className="bg-white/5 rounded-lg p-3">
                                            <p className="text-slate-400">IIBB</p>
                                            <p className="text-white font-medium">
                                                {formData.gross_income_number || 'No especificado'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <p className="text-sm text-slate-400">
                                    Despues de crear la organizacion podras cargar logo, usuarios y politicas desde Configuracion.
                                </p>
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-3 pt-2">
                            {currentStep > 1 && (
                                <button
                                    type="button"
                                    onClick={handlePreviousStep}
                                    className="w-full sm:w-auto py-3 px-4 bg-white/5 border border-white/20 hover:bg-white/10 text-white font-medium rounded-lg transition"
                                >
                                    <span className="inline-flex items-center justify-center gap-2">
                                        <ArrowLeft className="h-4 w-4" />
                                        Atras
                                    </span>
                                </button>
                            )}

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
                                ) : currentStep < onboardingSteps.length ? (
                                    <span className="inline-flex items-center justify-center gap-2">
                                        Continuar
                                        <ArrowRight className="h-4 w-4" />
                                    </span>
                                ) : (
                                    'Crear Organizacion'
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
