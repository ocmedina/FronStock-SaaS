import { z } from 'zod';

const optionalText = (max: number, message: string) =>
    z
        .string()
        .trim()
        .max(max, message)
        .default('');

const cuitRegex = /^[0-9]{2}-?[0-9]{8}-?[0-9]$/;

export const organizationTaxConditions = [
    'Responsable Inscripto',
    'Monotributista',
    'Exento',
    'Consumidor Final',
] as const;

// Esquema para crear una nueva organización (adaptado a tu estructura)
export const createOrganizationSchema = z.object({
    name: z
        .string()
        .trim()
        .min(2, 'El nombre debe tener al menos 2 caracteres')
        .max(100, 'El nombre no puede exceder 100 caracteres'),
    plan_type: z.string().default('free'),
    address: optionalText(160, 'La dirección no puede exceder 160 caracteres'),
    city: optionalText(80, 'La ciudad no puede exceder 80 caracteres'),
    cuit: z
        .string()
        .trim()
        .max(20, 'El CUIT no puede exceder 20 caracteres')
        .refine((value) => value.length === 0 || cuitRegex.test(value), {
            message: 'Ingresa un CUIT válido (ej: 30-12345678-9)',
        })
        .default(''),
    tax_condition: z.enum(organizationTaxConditions).default('Responsable Inscripto'),
    gross_income_number: optionalText(50, 'Ingresos Brutos no puede exceder 50 caracteres'),
    activity_start_date: z
        .string()
        .refine((value) => value.length === 0 || !Number.isNaN(Date.parse(value)), {
            message: 'La fecha de inicio no es válida',
        })
        .default(''),
});

// Esquema para actualizar organización
export const updateOrganizationSchema = createOrganizationSchema.partial();

// Tipos inferidos de los esquemas
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
