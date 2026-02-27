'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { PlanType } from '@/config/plans';

export async function updatePlan(planId: PlanType) {
    const supabase = await createClient();

    try {
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return { error: 'No autorizado' };
        }

        // Get organization_id from profile
        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id, role')
            .eq('id', user.id)
            .single();

        if (!profile?.organization_id) {
            return { error: 'Organización no encontrada' };
        }

        if (!['owner', 'admin'].includes(String(profile.role || ''))) {
            return { error: 'No tienes permisos para cambiar el plan' };
        }

        // Update organization plan using Admin Client (bypassing RLS)
        const { createAdminClient } = await import('@/lib/supabase/admin');
        const supabaseAdmin = createAdminClient();

        const { error } = await supabaseAdmin
            .from('organizations')
            .update({
                plan_type: planId,
                updated_at: new Date().toISOString()
            })
            .eq('id', profile.organization_id);

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
