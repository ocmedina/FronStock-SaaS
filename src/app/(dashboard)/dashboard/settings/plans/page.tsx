import { createClient } from '@/lib/supabase/server';
import { PLANS, PlanType, getPlansWithArsFromEnv } from '@/config/plans';
import { PlanCard } from '@/components/settings/PlanCard';
import { redirect } from 'next/navigation';
import { PlansClientWrapper } from './PlansClientWrapper';

export default async function PlansPage() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return redirect('/login');
    }

    // Get current plan and subscription info
    const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id, organizations(plan_type, mp_subscription_status, plan_expires_at)')
        .eq('id', user.id)
        .single();

    const org = profile?.organizations as any;
    const currentPlanId = (org?.plan_type as PlanType) || 'free';
    const subscriptionStatus = (org?.mp_subscription_status as string) || 'none';
    const planExpiresAt = (org?.plan_expires_at as string) || null;

    const plansWithArs = getPlansWithArsFromEnv();
    const arsPrices: Partial<Record<PlanType, number>> = {};
    for (const [key, plan] of Object.entries(plansWithArs)) {
        if (plan.priceArs) {
            arsPrices[key as PlanType] = plan.priceArs;
        }
    }

    return (
        <div className="container mx-auto py-8 max-w-5xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight">Planes</h1>
                <p className="text-muted-foreground mt-2">
                    Todos los upgrades de plan se coordinan con ventas por WhatsApp.
                </p>
            </div>

            <PlansClientWrapper
                currentPlanId={currentPlanId}
                arsPrices={arsPrices}
                subscriptionStatus={subscriptionStatus}
                planExpiresAt={planExpiresAt}
                isDev={process.env.NODE_ENV !== 'production'}
            />
        </div>
    );
}
