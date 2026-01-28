import { createClient } from '@/lib/supabase/server';
import { PLANS, PlanType } from '@/config/plans';
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

    // Get current plan
    const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id, organizations(plan_type)')
        .eq('id', user.id)
        .single();

    const currentPlanId = (profile?.organizations as any)?.plan_type as PlanType || 'free';

    return (
        <div className="container mx-auto py-8 max-w-5xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight">Planes de Suscripción</h1>
                <p className="text-muted-foreground mt-2">
                    Elige el plan que mejor se adapte a las necesidades de tu negocio.
                </p>
            </div>

            <PlansClientWrapper currentPlanId={currentPlanId} />
        </div>
    );
}
