import { z } from 'zod';

// Esquema para crear un nuevo producto (adaptado a tu estructura)
export const createProductSchema = z.object({
    name: z
        .string()
        .min(1, 'El nombre es requerido')
        .max(200, 'El nombre no puede exceder 200 caracteres'),
    sku: z.string().max(50).optional().nullable(),
    stock: z
        .number()
        .int('El stock debe ser un número entero')
        .min(0, 'El stock no puede ser negativo')
        .or(z.string().transform((val) => parseInt(val, 10)))
        .default(0),
    price: z
        .number()
        .min(0, 'El precio no puede ser negativo')
        .or(z.string().transform((val) => parseFloat(val)))
        .default(0),
});

// Esquema para actualizar producto
export const updateProductSchema = createProductSchema.partial();

// Tipos inferidos
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
