export type PlanType = 'free' | 'entrepreneur' | 'business' | 'enterprise';

export interface PlanLimits {
    maxUsers: number;
    maxProducts: number;
    salesHistoryMonths: number; // 0 for unlimited (or handled as null in logic)
}

export interface Plan {
    id: PlanType;
    name: string;
    price: number;
    currency: string;
    description: string;
    limits: PlanLimits;
    features: string[];
    recommended?: boolean;
}

export const PLANS: Record<PlanType, Plan> = {
    free: {
        id: 'free',
        name: 'Gratuito',
        price: 0,
        currency: 'USD',
        description: 'Ideal para probar el sistema o negocios muy pequeños.',
        limits: {
            maxUsers: 1,
            maxProducts: 50,
            salesHistoryMonths: 1,
        },
        features: [
            'Punto de Venta (POS) Básico',
            'Control de Stock Simple',
            'Historial de ventas (30 días)',
            '1 Usuario',
            'Hasta 50 Productos'
        ]
    },
    entrepreneur: {
        id: 'entrepreneur',
        name: 'Emprendedor',
        price: 10,
        currency: 'USD',
        description: 'Para profesionales independientes y startups en crecimiento.',
        limits: {
            maxUsers: 2,
            maxProducts: 500,
            salesHistoryMonths: 6,
        },
        features: [
            'Reportes Básicos',
            'Logo personalizado en tickets',
            'Historial de ventas (6 meses)',
            'Hasta 2 Usuarios',
            'Hasta 500 Productos'
        ],
        recommended: true
    },
    business: {
        id: 'business',
        name: 'Negocio',
        price: 25,
        currency: 'USD',
        description: 'Para PyMEs establecidas que necesitan control total.',
        limits: {
            maxUsers: 10,
            maxProducts: Infinity,
            salesHistoryMonths: Infinity, // Unlimited
        },
        features: [
            'Reportes Avanzados',
            'Cuentas Corrientes (Fiados)',
            'Exportación a Excel/PDF',
            'Productos Ilimitados',
            'Historial Ilimitado',
            'Hasta 10 Usuarios'
        ]
    },
    enterprise: {
        id: 'enterprise',
        name: 'Empresarial',
        price: 0, // Custom pricing usually handled differently, but kept number for type safety
        currency: 'USD',
        description: 'Soluciones a medida para grandes volúmenes.',
        limits: {
            maxUsers: Infinity,
            maxProducts: Infinity,
            salesHistoryMonths: Infinity,
        },
        features: [
            'Módulo de Reparto/Logística',
            'Acceso a API',
            'Soporte Prioritario 24/7',
            'Usuarios Ilimitados',
            'Personalización a medida'
        ]
    }
};

export const getPlanDetails = (planId: string): Plan => {
    return PLANS[planId as PlanType] || PLANS['free'];
};
