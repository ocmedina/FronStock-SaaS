'use server';

import { createClient } from "@/lib/supabase/server";

export async function checkProductLimit() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { error: "No autorizado" };

    const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

    if (!profile?.organization_id) return { error: "Organización no encontrada" };

    const { checkOrganizationLimit } = await import('@/lib/plans/limits');
    const limitCheck = await checkOrganizationLimit(profile.organization_id, 'products');

    if (!limitCheck.allowed) {
        return { error: limitCheck.error };
    }

    return { success: true };
}
