'use client';

import { PLANS, PlanType } from '@/config/plans';
import { PlanCard } from '@/components/settings/PlanCard';
import { updatePlan } from '@/actions/plans';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface PlansClientWrapperProps {
    currentPlanId: PlanType;
}

export function PlansClientWrapper({ currentPlanId }: PlansClientWrapperProps) {
    const [isLoading, setIsLoading] = useState<PlanType | null>(null);
    const router = useRouter();

    const handleSelectPlan = async (planId: PlanType) => {
        if (planId === currentPlanId) return;

        setIsLoading(planId);
        try {
            const result = await updatePlan(planId);

            if (result.error) {
                alert(`Error: ${result.error}`);
            } else {
                alert(`Te has cambiado exitosamente al plan ${PLANS[planId].name}.`);
                router.refresh();
            }
        } catch (error) {
            alert("Ocurrió un error inesperado al cambiar de plan.");
        } finally {
            setIsLoading(null);
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {Object.values(PLANS).map((plan) => (
                <PlanCard
                    key={plan.id}
                    plan={plan}
                    currentPlanId={currentPlanId}
                    onSelect={handleSelectPlan}
                    isLoading={isLoading === plan.id}
                />
            ))}
        </div>
    );
}
