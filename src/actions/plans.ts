'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { PlanType } from '@/config/plans';
import { headers } from 'next/headers';

const PAID_PLAN_AMOUNT_ENV: Partial<Record<PlanType, string>> = {
    entrepreneur: 'MP_PLAN_PRICE_ENTREPRENEUR_ARS',
    business: 'MP_PLAN_PRICE_BUSINESS_ARS',
    enterprise: 'MP_PLAN_PRICE_ENTERPRISE_ARS',
};

async function getAuthorizedProfile() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return { error: 'No autorizado' as const };
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id, role')
        .eq('id', user.id)
        .single();

    if (!profile?.organization_id) {
        return { error: 'Organización no encontrada' as const };
    }

    if (!['owner', 'admin'].includes(String(profile.role || ''))) {
        return { error: 'No tienes permisos para cambiar el plan' as const };
    }

    return {
        user,
        profile: {
            organization_id: profile.organization_id,
            role: String(profile.role || ''),
        },
    };
}

async function resolveBaseUrl() {
    const configured = process.env.NEXT_PUBLIC_APP_URL;
    if (configured) {
        return configured.replace(/\/$/, '');
    }

    const headerList = await headers();
    const host = headerList.get('x-forwarded-host') || headerList.get('host');
    const proto = headerList.get('x-forwarded-proto') || 'https';

    if (!host) {
        throw new Error('No se pudo resolver URL base. Define NEXT_PUBLIC_APP_URL.');
    }

    return `${proto}://${host}`;
}

function parseExternalReference(externalReference?: string | null) {
    if (!externalReference) {
        return null;
    }

    const parts = externalReference.split('|');
    const map = new Map<string, string>();

    for (const part of parts) {
        const [key, value] = part.split(':');
        if (key && value) {
            map.set(key, value);
        }
    }

    const organizationId = map.get('org');
    const planId = map.get('plan') as PlanType | undefined;
    const requestedBy = map.get('user');

    if (!organizationId || !planId || !requestedBy) {
        return null;
    }

    if (!['entrepreneur', 'business', 'enterprise'].includes(planId)) {
        return null;
    }

    return { organizationId, planId, requestedBy };
}

export async function updatePlan(planId: PlanType) {
    try {
        if (planId !== 'free') {
            return { error: 'Los planes pagos deben activarse mediante suscripción.' };
        }

        const auth = await getAuthorizedProfile();
        if ('error' in auth) {
            return { error: auth.error };
        }

        const { createAdminClient } = await import('@/lib/supabase/admin');
        const supabaseAdmin = createAdminClient();

        // Cancel MP subscription if one exists
        const { data: org } = await supabaseAdmin
            .from('organizations')
            .select('mp_subscription_id, mp_subscription_status')
            .eq('id', auth.profile.organization_id)
            .single();

        if (org?.mp_subscription_id && org.mp_subscription_status === 'authorized') {
            try {
                const { updateSubscriptionStatus } = await import('@/lib/billing/mercadopago');
                await updateSubscriptionStatus(org.mp_subscription_id, 'cancelled');
            } catch (e) {
                console.error('Error cancelling MP subscription:', e);
                // Continue anyway — update locally
            }
        }

        const { error } = await supabaseAdmin
            .from('organizations')
            .update({
                plan_type: planId,
                mp_subscription_status: org?.mp_subscription_id ? 'cancelled' : 'none',
                plan_expires_at: null,
                updated_at: new Date().toISOString()
            })
            .eq('id', auth.profile.organization_id);

        if (error) {
            console.error('Error updating plan:', error);
            return { error: `Error al actualizar el plan: ${error.message}` };
        }

        revalidatePath('/dashboard/settings/plans');
        return { success: true };

    } catch (error) {
        console.error('Unexpected error:', error);
        return { error: 'Ocurrió un error inesperado' };
    }
}

export async function cancelSubscription() {
    try {
        const auth = await getAuthorizedProfile();
        if ('error' in auth) {
            return { error: auth.error };
        }

        const { createAdminClient } = await import('@/lib/supabase/admin');
        const supabaseAdmin = createAdminClient();

        const { data: org } = await supabaseAdmin
            .from('organizations')
            .select('mp_subscription_id, mp_subscription_status')
            .eq('id', auth.profile.organization_id)
            .single();

        if (!org?.mp_subscription_id || org.mp_subscription_status !== 'authorized') {
            return { error: 'No hay suscripción activa para cancelar.' };
        }

        const { updateSubscriptionStatus } = await import('@/lib/billing/mercadopago');
        await updateSubscriptionStatus(org.mp_subscription_id, 'cancelled');

        await supabaseAdmin
            .from('organizations')
            .update({
                plan_type: 'free',
                mp_subscription_status: 'cancelled',
                plan_expires_at: null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', auth.profile.organization_id);

        revalidatePath('/dashboard/settings/plans');
        return { success: true };
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('Error cancelling subscription:', msg);
        return { error: `No se pudo cancelar la suscripción: ${msg}` };
    }
}

export async function getSubscriptionStatus() {
    try {
        const auth = await getAuthorizedProfile();
        if ('error' in auth) {
            return { status: 'none' as const };
        }

        const supabase = await createClient();
        const { data: org } = await supabase
            .from('organizations')
            .select('mp_subscription_id, mp_subscription_status, plan_expires_at')
            .eq('id', auth.profile.organization_id)
            .single();

        return {
            status: (org?.mp_subscription_status || 'none') as string,
            subscriptionId: org?.mp_subscription_id || null,
            expiresAt: org?.plan_expires_at || null,
        };
    } catch {
        return { status: 'none' as const, subscriptionId: null, expiresAt: null };
    }
}

export async function createPlanCheckout(planId: PlanType) {
    try {
        if (planId === 'free') {
            return { error: 'El plan Gratuito no requiere pago.' };
        }

        const auth = await getAuthorizedProfile();
        if ('error' in auth) {
            return { error: auth.error };
        }

        const envName = PAID_PLAN_AMOUNT_ENV[planId];
        const amountValue = envName ? process.env[envName] : undefined;
        const amount = amountValue ? Number(amountValue) : NaN;

        if (!amountValue || Number.isNaN(amount) || amount <= 0) {
            return { error: `Falta configurar monto ARS para ${planId}. Define ${envName}.` };
        }

        const { createSubscription } = await import('@/lib/billing/mercadopago');
        const { PLANS } = await import('@/config/plans');

        const baseUrl = await resolveBaseUrl();
        const planName = PLANS[planId].name;
        const notificationUrl = `${baseUrl}/api/billing/mercadopago/webhook`;
        const externalReference = `org:${auth.profile.organization_id}|plan:${planId}|user:${auth.user.id}`;

        const subscription = await createSubscription({
            reason: `FrontStock - Plan ${planName} (mensual)`,
            externalReference,
            payerEmail: auth.user.email || '',
            autoRecurring: {
                frequency: 1,
                frequencyType: 'months',
                transactionAmount: Number(amount.toFixed(2)),
                currencyId: 'ARS',
            },
            backUrl: `${baseUrl}/dashboard/settings/plans?checkout=success&plan=${planId}`,
            notificationUrl,
        });

        const isTestToken = (process.env.MP_ACCESS_TOKEN || '').startsWith('TEST-');
        const checkoutUrl = isTestToken
            ? (subscription.sandbox_init_point || subscription.init_point)
            : (subscription.init_point || subscription.sandbox_init_point);

        if (!checkoutUrl) {
            return { error: 'No se pudo generar URL de suscripción.' };
        }

        // Save subscription ID immediately so we can track it
        if (subscription.id) {
            const { createAdminClient } = await import('@/lib/supabase/admin');
            const supabaseAdmin = createAdminClient();
            await supabaseAdmin
                .from('organizations')
                .update({
                    mp_subscription_id: subscription.id,
                    mp_subscription_status: 'pending',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', auth.profile.organization_id);
        }

        return { url: checkoutUrl };
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('Error creating subscription checkout:', msg);
        return { error: `No se pudo iniciar la suscripción: ${msg}` };
    }
}

export async function finalizePlanCheckoutFromReturn(paymentId?: string | null) {
    try {
        const auth = await getAuthorizedProfile();
        if ('error' in auth) {
            return { error: auth.error };
        }

        // Check if organization has a pending subscription
        const { createAdminClient } = await import('@/lib/supabase/admin');
        const supabaseAdmin = createAdminClient();

        const { data: org } = await supabaseAdmin
            .from('organizations')
            .select('mp_subscription_id, mp_subscription_status, plan_type')
            .eq('id', auth.profile.organization_id)
            .single();

        if (org?.mp_subscription_id) {
            const { getSubscription } = await import('@/lib/billing/mercadopago');
            const subscription = await getSubscription(org.mp_subscription_id);

            if (subscription.status === 'authorized') {
                const parsed = parseExternalReference(subscription.external_reference);
                if (parsed && parsed.organizationId === auth.profile.organization_id) {
                    await supabaseAdmin
                        .from('organizations')
                        .update({
                            plan_type: parsed.planId,
                            mp_subscription_status: 'authorized',
                            plan_expires_at: subscription.next_payment_date || null,
                            updated_at: new Date().toISOString(),
                        })
                        .eq('id', auth.profile.organization_id);

                    revalidatePath('/dashboard/settings/plans');
                    return { success: true, planId: parsed.planId };
                }
            }

            if (subscription.status === 'pending') {
                return { error: 'La suscripción aún está pendiente de autorización. Puede demorar unos minutos.' };
            }
        }

        // Fallback: try one-time payment validation if paymentId provided
        if (paymentId) {
            const { getPaymentById } = await import('@/lib/billing/mercadopago');
            const payment = await getPaymentById(paymentId);

            if (payment.status !== 'approved') {
                return { error: `El pago aún no está aprobado (estado: ${payment.status}).` };
            }

            const parsed = parseExternalReference(payment.external_reference);
            if (!parsed) {
                return { error: 'No se pudo validar la referencia del checkout.' };
            }

            if (parsed.organizationId !== auth.profile.organization_id) {
                return { error: 'La referencia del pago no coincide con tu organización.' };
            }

            const { error } = await supabaseAdmin
                .from('organizations')
                .update({
                    plan_type: parsed.planId,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', parsed.organizationId);

            if (error) {
                return { error: `No se pudo activar el plan: ${error.message}` };
            }

            revalidatePath('/dashboard/settings/plans');
            return { success: true, planId: parsed.planId };
        }

        return { error: 'No se pudo confirmar el pago. Puede demorar unos minutos en activarse.' };
    } catch (error) {
        console.error('Error finalizing checkout return:', error);
        return { error: 'No se pudo confirmar el pago automáticamente.' };
    }
}

export async function finalizePlanCheckoutByReference(planId: PlanType) {
    try {
        if (!['entrepreneur', 'business', 'enterprise'].includes(planId)) {
            return { error: 'Plan inválido para validación de cobro.' };
        }

        const auth = await getAuthorizedProfile();
        if ('error' in auth) {
            return { error: auth.error };
        }

        const externalReference = `org:${auth.profile.organization_id}|plan:${planId}|user:${auth.user.id}`;
        const { searchLatestPaymentByExternalReference } = await import('@/lib/billing/mercadopago');
        const payment = await searchLatestPaymentByExternalReference(externalReference);

        if (!payment) {
            return { error: 'No se encontró pago asociado al checkout.' };
        }

        if (payment.status !== 'approved') {
            return { error: `El pago aún no está aprobado (estado: ${payment.status}).` };
        }

        const { createAdminClient } = await import('@/lib/supabase/admin');
        const supabaseAdmin = createAdminClient();

        const { error } = await supabaseAdmin
            .from('organizations')
            .update({
                plan_type: planId,
                updated_at: new Date().toISOString(),
            })
            .eq('id', auth.profile.organization_id);

        if (error) {
            return { error: `No se pudo activar el plan: ${error.message}` };
        }

        revalidatePath('/dashboard/settings/plans');
        return { success: true, planId };
    } catch (error) {
        console.error('Error finalizing checkout by reference:', error);
        return { error: 'No se pudo confirmar el pago por referencia.' };
    }
}

export async function reconcileLatestApprovedPlanPayment() {
    try {
        const auth = await getAuthorizedProfile();
        if ('error' in auth) {
            return { error: auth.error };
        }

        const { createAdminClient } = await import('@/lib/supabase/admin');
        const supabaseAdmin = createAdminClient();

        const { data: org } = await supabaseAdmin
            .from('organizations')
            .select('mp_subscription_id, mp_subscription_status, plan_type')
            .eq('id', auth.profile.organization_id)
            .single();

        if (!org?.mp_subscription_id) {
            return { success: false, reason: 'no-subscription' as const };
        }

        // If subscription is already authorized and plan matches, nothing to do
        if (org.mp_subscription_status === 'authorized' && org.plan_type !== 'free') {
            return { success: false, reason: 'already-active' as const };
        }

        // Check current subscription status from MP
        const { getSubscription } = await import('@/lib/billing/mercadopago');
        const subscription = await getSubscription(org.mp_subscription_id);

        if (subscription.status === 'authorized') {
            const parsed = parseExternalReference(subscription.external_reference);
            if (!parsed) {
                return { success: false, reason: 'invalid-reference' as const };
            }

            await supabaseAdmin
                .from('organizations')
                .update({
                    plan_type: parsed.planId,
                    mp_subscription_status: 'authorized',
                    plan_expires_at: subscription.next_payment_date || null,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', auth.profile.organization_id);

            revalidatePath('/dashboard/settings/plans');
            return {
                success: true,
                planId: parsed.planId,
            };
        }

        return { success: false, reason: 'not-authorized' as const };
    } catch (error) {
        console.error('Error reconciling subscription:', error);
        return { error: 'No se pudo reconciliar la suscripción.' };
    }
}

/**
 * DEV ONLY: Activate a plan manually without going through Mercado Pago.
 * Only works when NODE_ENV !== 'production'.
 */
export async function devActivatePlan(planId: PlanType) {
    if (process.env.NODE_ENV === 'production') {
        return { error: 'No disponible en producción.' };
    }

    const validPlans: PlanType[] = ['entrepreneur', 'business', 'enterprise'];
    if (!validPlans.includes(planId)) {
        return { error: 'Plan inválido.' };
    }

    try {
        const auth = await getAuthorizedProfile();
        if ('error' in auth) {
            return { error: auth.error };
        }

        const { createAdminClient } = await import('@/lib/supabase/admin');
        const supabaseAdmin = createAdminClient();

        const { error } = await supabaseAdmin
            .from('organizations')
            .update({
                plan_type: planId,
                mp_subscription_status: 'authorized',
                updated_at: new Date().toISOString(),
            })
            .eq('id', auth.profile.organization_id);

        if (error) {
            return { error: `No se pudo activar: ${error.message}` };
        }

        revalidatePath('/dashboard/settings/plans');
        return { success: true, planId };
    } catch (error) {
        console.error('Error in devActivatePlan:', error);
        return { error: 'Error al activar plan en modo desarrollo.' };
    }
}
