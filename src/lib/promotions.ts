import { createClient } from '@/lib/supabase/client';

export interface CartItem {
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
}

export interface ApplicablePromotion {
    id: string;
    name: string;
    type: string;
    discount: number;
    description?: string;
}

export interface Promotion {
    id: string;
    organization_id: string;
    name: string;
    description?: string;
    type: 'percentage' | 'fixed_amount' | 'volume' | 'combo' | 'happy_hour' | 'coupon';
    discount_percentage?: number;
    discount_amount?: number;
    min_quantity?: number;
    min_amount?: number;
    buy_quantity?: number;
    get_quantity?: number;
    applies_to: 'all' | 'specific' | 'category';
    product_ids?: string[];
    category_ids?: string[];
    customer_type?: 'all' | 'retail' | 'wholesale' | 'specific';
    customer_ids?: string[];
    start_time?: string;
    end_time?: string;
    days_of_week?: number[];
    coupon_code?: string;
    max_uses?: number;
    current_uses: number;
    start_date?: string;
    end_date?: string;
    active: boolean;
    created_at: string;
    updated_at: string;
}

/**
 * Calcula las promociones aplicables para un carrito de compras
 */
export async function calculateApplicablePromotions(
    organizationId: string,
    customerId: string | null,
    items: CartItem[],
    subtotal: number
): Promise<ApplicablePromotion[]> {
    const supabase = createClient();

    try {
        const { data, error } = await supabase.rpc('calculate_applicable_promotions', {
            p_org_id: organizationId,
            p_customer_id: customerId,
            p_items: items,
            p_subtotal: subtotal,
        });

        if (error) {
            console.error('Error calculating promotions:', error);
            return [];
        }

        return data || [];
    } catch (error) {
        console.error('Error in calculateApplicablePromotions:', error);
        return [];
    }
}

/**
 * Aplica un cupón de descuento
 */
export async function applyCoupon(
    organizationId: string,
    couponCode: string,
    customerId: string | null,
    subtotal: number
): Promise<{ success: boolean; promotion?: ApplicablePromotion; error?: string }> {
    const supabase = createClient();

    try {
        const { data, error } = await supabase.rpc('apply_coupon', {
            p_org_id: organizationId,
            p_coupon_code: couponCode.toUpperCase().trim(),
            p_customer_id: customerId,
            p_subtotal: subtotal,
        });

        if (error) {
            console.error('Error applying coupon:', error);
            return { success: false, error: 'Error al aplicar cupón' };
        }

        if (!data.success) {
            return { success: false, error: data.error };
        }

        return {
            success: true,
            promotion: {
                id: data.promotion_id,
                name: data.name,
                type: 'coupon',
                discount: data.discount,
                description: data.description,
            },
        };
    } catch (error) {
        console.error('Error in applyCoupon:', error);
        return { success: false, error: 'Error al aplicar cupón' };
    }
}

/**
 * Registra el uso de una promoción en una venta
 */
export async function recordPromotionUsage(
    promotionId: string,
    saleId: string,
    customerId: string | null,
    discountApplied: number
): Promise<void> {
    const supabase = createClient();

    try {
        // Registrar uso
        const { error: usageError } = await supabase.from('promotion_usages').insert({
            promotion_id: promotionId,
            sale_id: saleId,
            customer_id: customerId,
            discount_applied: discountApplied,
        });

        if (usageError) {
            console.error('Error recording promotion usage:', usageError);
            return;
        }

        // Incrementar contador
        const { error: incrementError } = await supabase.rpc('increment_promotion_usage', {
            p_promotion_id: promotionId,
        });

        if (incrementError) {
            console.error('Error incrementing promotion usage:', incrementError);
        }
    } catch (error) {
        console.error('Error in recordPromotionUsage:', error);
    }
}

/**
 * Obtiene todas las promociones activas de una organización
 */
export async function getActivePromotions(organizationId: string): Promise<Promotion[]> {
    const supabase = createClient();

    try {
        const { data, error } = await supabase
            .from('promotions')
            .select('*')
            .eq('organization_id', organizationId)
            .eq('active', true)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching promotions:', error);
            return [];
        }

        return data || [];
    } catch (error) {
        console.error('Error in getActivePromotions:', error);
        return [];
    }
}

/**
 * Obtiene todas las promociones (activas e inactivas)
 */
export async function getAllPromotions(organizationId: string): Promise<Promotion[]> {
    const supabase = createClient();

    try {
        const { data, error } = await supabase
            .from('promotions')
            .select('*')
            .eq('organization_id', organizationId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching all promotions:', error);
            return [];
        }

        return data || [];
    } catch (error) {
        console.error('Error in getAllPromotions:', error);
        return [];
    }
}

/**
 * Formatea el tipo de promoción para mostrar
 */
export function formatPromotionType(type: Promotion['type']): string {
    const labels: Record<Promotion['type'], string> = {
        percentage: 'Porcentaje',
        fixed_amount: 'Monto Fijo',
        volume: 'Por Volumen',
        combo: 'Combo',
        happy_hour: 'Happy Hour',
        coupon: 'Cupón',
    };
    return labels[type] || type;
}

/**
 * Formatea el descuento para mostrar
 */
export function formatPromotionDiscount(promotion: Promotion): string {
    if (promotion.discount_percentage) {
        return `${promotion.discount_percentage}% OFF`;
    }
    if (promotion.discount_amount) {
        return `$${promotion.discount_amount} OFF`;
    }
    return 'Descuento';
}
