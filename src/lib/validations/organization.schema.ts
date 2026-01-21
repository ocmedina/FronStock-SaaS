import { z } from 'zod';

// Esquema para crear una nueva organización (adaptado a tu estructura)
export const createOrganizationSchema = z.object({
    name: z
        .string()
        .min(2, 'El nombre debe tener al menos 2 caracteres')
        .max(100, 'El nombre no puede exceder 100 caracteres'),
    plan_type: z.string().default('free'),
});

// Esquema para actualizar organización
export const updateOrganizationSchema = createOrganizationSchema.partial();

// Tipos inferidos de los esquemas
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
