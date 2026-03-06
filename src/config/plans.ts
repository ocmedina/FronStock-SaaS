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
    priceArs?: number;
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
        description: 'Ideal para empezar: hasta 1 usuario, 50 productos y 1 mes de historial de ventas.',
        limits: {
            maxUsers: 1,
            maxProducts: 50,
            salesHistoryMonths: 1,
        },
        features: [
            'Hasta 1 usuario (límite enforzado)',
            'Hasta 50 productos (límite enforzado)',
            'Historial visible: último mes',
            'Punto de venta y stock básico',
            'Operación esencial para validar el negocio'
        ]
    },
    entrepreneur: {
        id: 'entrepreneur',
        name: 'Emprendedor',
        price: 25000,
        currency: 'ARS',
        description: 'Para equipos pequeños: hasta 2 usuarios, 500 productos y 6 meses de historial de ventas.',
        limits: {
            maxUsers: 2,
            maxProducts: 500,
            salesHistoryMonths: 6,
        },
        features: [
            'Hasta 2 usuarios (límite enforzado)',
            'Hasta 500 productos (límite enforzado)',
            'Historial visible: últimos 6 meses',
            'Reportes operativos básicos',
            'Logo en comprobantes y tickets'
        ],
        recommended: true
    },
    business: {
        id: 'business',
        name: 'Negocio',
        price: 50000,
        currency: 'ARS',
        description: 'Para operación consolidada: hasta 10 usuarios, productos ilimitados e historial ilimitado.',
        limits: {
            maxUsers: 10,
            maxProducts: Infinity,
            salesHistoryMonths: Infinity, // Unlimited
        },
        features: [
            'Hasta 10 usuarios (límite enforzado)',
            'Productos sin límite por plan',
            'Historial sin límite por plan',
            'Reportes avanzados de ventas y caja',
            'Cuentas corrientes y exportaciones'
        ]
    },
    enterprise: {
        id: 'enterprise',
        name: 'Empresarial',
        price: 90000,
        currency: 'ARS',
        description: 'Plan sin límites de usuarios, productos e historial, con implementación y soporte prioritario.',
        limits: {
            maxUsers: Infinity,
            maxProducts: Infinity,
            salesHistoryMonths: Infinity,
        },
        features: [
            'Usuarios sin límite por plan',
            'Productos sin límite por plan',
            'Historial sin límite por plan',
            'Implementación y parametrización asistida',
            'Integraciones/API y soporte prioritario'
        ]
    }
};

export const getPlanDetails = (planId: string): Plan => {
    return PLANS[planId as PlanType] || PLANS['free'];
};

export function getPlansWithArsFromEnv(): Record<PlanType, Plan> {
    const entrepreneurArs = Number(process.env.MP_PLAN_PRICE_ENTREPRENEUR_ARS) || undefined;
    const businessArs = Number(process.env.MP_PLAN_PRICE_BUSINESS_ARS) || undefined;
    const enterpriseArs = Number(process.env.MP_PLAN_PRICE_ENTERPRISE_ARS) || undefined;

    return {
        ...PLANS,
        entrepreneur: { ...PLANS.entrepreneur, priceArs: entrepreneurArs },
        business: { ...PLANS.business, priceArs: businessArs },
        enterprise: { ...PLANS.enterprise, priceArs: enterpriseArs },
    };
}
