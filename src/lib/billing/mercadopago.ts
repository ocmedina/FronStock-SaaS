export interface CreatePreferenceInput {
    title: string;
    unitPrice: number;
    quantity?: number;
    payerEmail?: string;
    externalReference: string;
    notificationUrl: string;
    successUrl: string;
    failureUrl: string;
    pendingUrl: string;
}

export interface MercadoPagoPreferenceResponse {
    id: string;
    init_point?: string;
    sandbox_init_point?: string;
}

function getAccessToken() {
    const token = process.env.MP_ACCESS_TOKEN;
    if (!token) {
        throw new Error('Missing MP_ACCESS_TOKEN');
    }
    if (token.startsWith('REEMPLAZAR') || token.includes('TU_TOKEN')) {
        throw new Error('MP_ACCESS_TOKEN no está configurado con un valor real. Reemplaza el placeholder en .env.local.');
    }
    return token;
}

function getHeaders() {
    return {
        Authorization: `Bearer ${getAccessToken()}`,
        'Content-Type': 'application/json',
    };
}

export async function createCheckoutPreference(input: CreatePreferenceInput) {
    const hasBackUrls = Boolean(input.successUrl && input.failureUrl && input.pendingUrl);
    const canUseAutoReturn = hasBackUrls && input.successUrl.startsWith('https://');

    const payload: Record<string, unknown> = {
        items: [
            {
                title: input.title,
                quantity: input.quantity ?? 1,
                currency_id: 'ARS',
                unit_price: Number(input.unitPrice.toFixed(2)),
            },
        ],
        payment_methods: {
            excluded_payment_types: [
                { id: 'bank_transfer' },
                { id: 'ticket' },
                { id: 'atm' },
            ],
            installments: 1,
        },
        payer: input.payerEmail ? { email: input.payerEmail } : undefined,
        external_reference: input.externalReference,
        notification_url: input.notificationUrl.includes('localhost') ? undefined : input.notificationUrl,
    };

    if (hasBackUrls) {
        payload.back_urls = {
            success: input.successUrl,
            failure: input.failureUrl,
            pending: input.pendingUrl,
        };
    }

    if (canUseAutoReturn) {
        payload.auto_return = 'approved';
    }

    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const detail = await response.text();
        if (response.status === 403 && detail.includes('PA_UNAUTHORIZED_RESULT_FROM_POLICIES')) {
            throw new Error(
                'Mercado Pago bloqueó la operación (PA_UNAUTHORIZED_RESULT_FROM_POLICIES). Verifica que tu app y cuenta estén habilitadas para Checkout Pro, o usa credenciales TEST para pruebas.'
            );
        }
        throw new Error(`Mercado Pago preference error: ${response.status} ${detail}`);
    }

    return response.json() as Promise<MercadoPagoPreferenceResponse>;
}

export async function getPaymentById(paymentId: string) {
    if (!/^\d+$/.test(paymentId)) {
        throw new Error('paymentId inválido: debe ser numérico.');
    }

    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: getHeaders(),
        cache: 'no-store',
    });

    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Mercado Pago payment error: ${response.status} ${detail}`);
    }

    return response.json() as Promise<{
        id: number;
        status: string;
        external_reference?: string;
    }>;
}

export async function searchLatestPaymentByExternalReference(externalReference: string) {
    const url = new URL('https://api.mercadopago.com/v1/payments/search');
    url.searchParams.set('external_reference', externalReference);
    url.searchParams.set('sort', 'date_created');
    url.searchParams.set('criteria', 'desc');
    url.searchParams.set('limit', '1');

    const response = await fetch(url.toString(), {
        headers: getHeaders(),
        cache: 'no-store',
    });

    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Mercado Pago payment search error: ${response.status} ${detail}`);
    }

    const payload = await response.json() as {
        results?: Array<{
            id: number;
            status: string;
            external_reference?: string;
            date_created?: string;
        }>;
    };

    return payload.results?.[0] || null;
}

export async function searchPaymentsByOrgAndPlan(organizationId: string, planId: string) {
    const url = new URL('https://api.mercadopago.com/v1/payments/search');
    url.searchParams.set('sort', 'date_created');
    url.searchParams.set('criteria', 'desc');
    url.searchParams.set('limit', '5');

    const response = await fetch(url.toString(), {
        headers: getHeaders(),
        cache: 'no-store',
    });

    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Mercado Pago payment search error: ${response.status} ${detail}`);
    }

    const payload = await response.json() as {
        results?: Array<{
            id: number;
            status: string;
            external_reference?: string;
            date_created?: string;
        }>;
    };

    const prefix = `org:${organizationId}|plan:${planId}`;
    return (payload.results || []).filter(
        (p) => p.external_reference?.startsWith(prefix)
    );
}

export async function verifyWebhookSignature(
    xSignature: string,
    xRequestId: string,
    dataId: string,
    secret: string,
): Promise<boolean> {
    const parts = xSignature.split(',');
    let ts = '';
    let hash = '';

    for (const part of parts) {
        const [key, value] = part.trim().split('=', 2);
        if (key === 'ts') ts = value;
        if (key === 'v1') hash = value;
    }

    if (!ts || !hash) return false;

    const { createHmac } = await import('crypto');
    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
    const computed = createHmac('sha256', secret).update(manifest).digest('hex');

    return computed === hash;
}

// ─── Subscriptions (Preapproval) ────────────────────────────────

export interface CreateSubscriptionInput {
    reason: string;
    externalReference: string;
    payerEmail: string;
    autoRecurring: {
        frequency: number;
        frequencyType: 'months' | 'days';
        transactionAmount: number;
        currencyId: string;
    };
    backUrl: string;
    notificationUrl?: string;
}

export interface MercadoPagoSubscriptionResponse {
    id: string;
    status: string;
    init_point?: string;
    sandbox_init_point?: string;
    external_reference?: string;
    payer_id?: number;
    date_created?: string;
    next_payment_date?: string;
}

export async function createSubscription(input: CreateSubscriptionInput): Promise<MercadoPagoSubscriptionResponse> {
    const payload: Record<string, unknown> = {
        reason: input.reason,
        external_reference: input.externalReference,
        payer_email: input.payerEmail,
        auto_recurring: {
            frequency: input.autoRecurring.frequency,
            frequency_type: input.autoRecurring.frequencyType,
            transaction_amount: input.autoRecurring.transactionAmount,
            currency_id: input.autoRecurring.currencyId,
        },
        back_url: input.backUrl.includes('localhost') ? 'https://frontstock.app' : input.backUrl,
    };

    if (input.notificationUrl && !input.notificationUrl.includes('localhost')) {
        payload.notification_url = input.notificationUrl;
    }

    const response = await fetch('https://api.mercadopago.com/preapproval', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Mercado Pago subscription error: ${response.status} ${detail}`);
    }

    return response.json() as Promise<MercadoPagoSubscriptionResponse>;
}

export async function getSubscription(subscriptionId: string): Promise<MercadoPagoSubscriptionResponse> {
    const response = await fetch(`https://api.mercadopago.com/preapproval/${encodeURIComponent(subscriptionId)}`, {
        headers: getHeaders(),
        cache: 'no-store',
    });

    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Mercado Pago get subscription error: ${response.status} ${detail}`);
    }

    return response.json() as Promise<MercadoPagoSubscriptionResponse>;
}

export async function updateSubscriptionStatus(
    subscriptionId: string,
    status: 'authorized' | 'paused' | 'cancelled',
): Promise<MercadoPagoSubscriptionResponse> {
    const response = await fetch(`https://api.mercadopago.com/preapproval/${encodeURIComponent(subscriptionId)}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ status }),
    });

    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Mercado Pago update subscription error: ${response.status} ${detail}`);
    }

    return response.json() as Promise<MercadoPagoSubscriptionResponse>;
}
