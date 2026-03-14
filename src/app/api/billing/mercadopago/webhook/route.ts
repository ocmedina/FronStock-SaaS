import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { PlanType } from '@/config/plans';
import { getPaymentById, getSubscription, verifyWebhookSignature } from '@/lib/billing/mercadopago';

export const runtime = 'nodejs';
const MERCADOPAGO_ENABLED = process.env.ENABLE_MERCADOPAGO === 'true';

const ALLOWED_PAID_PLANS: PlanType[] = ['entrepreneur', 'business', 'enterprise'];

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

    if (!organizationId || !planId || !ALLOWED_PAID_PLANS.includes(planId)) {
        return null;
    }

    return { organizationId, planId };
}

async function activatePlan(organizationId: string, planId: PlanType, subscriptionId?: string) {
    const supabaseAdmin = createAdminClient();

    const updateData: Record<string, unknown> = {
        plan_type: planId,
        updated_at: new Date().toISOString(),
    };

    if (subscriptionId) {
        updateData.mp_subscription_id = subscriptionId;
        updateData.mp_subscription_status = 'authorized';
    }

    const { error } = await supabaseAdmin
        .from('organizations')
        .update(updateData)
        .eq('id', organizationId);

    if (error) {
        throw new Error(`No se pudo actualizar plan de organización: ${error.message}`);
    }
}

async function handleSubscriptionWebhook(subscriptionId: string) {
    const subscription = await getSubscription(subscriptionId);
    const parsed = parseExternalReference(subscription.external_reference);
    if (!parsed) {
        return { ignored: true, reason: 'invalid-reference' };
    }

    const supabaseAdmin = createAdminClient();

    if (subscription.status === 'authorized') {
        await supabaseAdmin
            .from('organizations')
            .update({
                plan_type: parsed.planId,
                mp_subscription_id: subscriptionId,
                mp_subscription_status: 'authorized',
                plan_expires_at: subscription.next_payment_date || null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', parsed.organizationId);

        console.info(`[MP Webhook] Subscription ${subscriptionId} authorized → org ${parsed.organizationId} activated plan ${parsed.planId}`);
        return { activated: true };
    }

    if (subscription.status === 'cancelled') {
        // Only downgrade if the cancelled subscription matches the org's current subscription
        // This prevents a stale cancellation webhook from downgrading a newer subscription
        const { data: org } = await supabaseAdmin
            .from('organizations')
            .select('mp_subscription_id, plan_type')
            .eq('id', parsed.organizationId)
            .single();

        if (org?.mp_subscription_id === subscriptionId) {
            await supabaseAdmin
                .from('organizations')
                .update({
                    plan_type: 'free',
                    mp_subscription_status: 'cancelled',
                    plan_expires_at: null,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', parsed.organizationId);

            console.info(`[MP Webhook] Subscription ${subscriptionId} cancelled → org ${parsed.organizationId} downgraded to free`);
            return { cancelled: true };
        }

        console.info(`[MP Webhook] Ignoring cancellation for old subscription ${subscriptionId} (org has ${org?.mp_subscription_id})`);
        return { ignored: true, reason: 'subscription-id-mismatch' };
    }

    if (subscription.status === 'paused') {
        await supabaseAdmin
            .from('organizations')
            .update({
                mp_subscription_status: 'paused',
                updated_at: new Date().toISOString(),
            })
            .eq('id', parsed.organizationId);

        console.info(`[MP Webhook] Subscription ${subscriptionId} paused → org ${parsed.organizationId}`);
        return { paused: true };
    }

    // pending or other statuses
    await supabaseAdmin
        .from('organizations')
        .update({
            mp_subscription_status: subscription.status || 'pending',
            updated_at: new Date().toISOString(),
        })
        .eq('id', parsed.organizationId);

    return { status: subscription.status };
}

export async function POST(req: NextRequest) {
    try {
        if (!MERCADOPAGO_ENABLED) {
            return NextResponse.json({ received: true, ignored: true, reason: 'mercadopago-disabled' }, { status: 200 });
        }

        const search = req.nextUrl.searchParams;
        const body = await req.json().catch(() => ({} as Record<string, unknown>));

        const topic =
            search.get('topic') ||
            search.get('type') ||
            (typeof body.type === 'string' ? body.type : null);

        const dataId =
            search.get('data.id') ||
            (typeof (body as { data?: { id?: string | number } }).data?.id !== 'undefined'
                ? String((body as { data?: { id?: string | number } }).data?.id)
                : null);

        if (!dataId) {
            return NextResponse.json({ received: true, ignored: true }, { status: 200 });
        }

        // Verify webhook signature
        const webhookSecret = process.env.MP_WEBHOOK_SECRET;
        const isProduction = process.env.NODE_ENV === 'production';

        if (!webhookSecret && isProduction) {
            console.error('Webhook MP: MP_WEBHOOK_SECRET no configurado en producción. Rechazando request.');
            return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
        }

        if (webhookSecret) {
            const xSignature = req.headers.get('x-signature') || '';
            const xRequestId = req.headers.get('x-request-id') || '';

            if (!xSignature || !xRequestId) {
                console.warn('Webhook MP: faltan headers x-signature o x-request-id');
                return NextResponse.json({ error: 'Missing signature headers' }, { status: 401 });
            }

            const isValid = await verifyWebhookSignature(xSignature, xRequestId, dataId, webhookSecret);
            if (!isValid) {
                console.warn('Webhook MP: firma inválida', { dataId });
                return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
            }
        } else {
            console.warn('Webhook MP: MP_WEBHOOK_SECRET no configurado, omitiendo validación de firma (solo desarrollo)');
        }

        // Handle subscription events
        if (topic === 'subscription_preapproval') {
            const result = await handleSubscriptionWebhook(dataId);
            return NextResponse.json({ received: true, ...result }, { status: 200 });
        }

        // Handle one-time payment events (legacy support)
        if (topic !== 'payment') {
            return NextResponse.json({ received: true, ignored: true }, { status: 200 });
        }

        const payment = await getPaymentById(dataId);

        if (payment.status !== 'approved') {
            return NextResponse.json({ received: true, ignored: true }, { status: 200 });
        }

        const parsed = parseExternalReference(payment.external_reference);
        if (!parsed) {
            return NextResponse.json({ received: true, ignored: true }, { status: 200 });
        }

        // Guard: check current plan to avoid redundant updates
        const supabaseAdmin = createAdminClient();
        const { data: org } = await supabaseAdmin
            .from('organizations')
            .select('plan_type')
            .eq('id', parsed.organizationId)
            .single();

        if (org?.plan_type === parsed.planId) {
            return NextResponse.json({ received: true, already_active: true }, { status: 200 });
        }

        await activatePlan(parsed.organizationId, parsed.planId);

        return NextResponse.json({ received: true }, { status: 200 });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Error procesando webhook';
        console.error('Webhook MP error:', message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
