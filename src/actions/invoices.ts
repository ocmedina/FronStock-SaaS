'use server';

import { requireOrganizationPermission } from '@/actions/_permissions';
import { createClient } from '@/lib/supabase/server';

export async function resetInvoices() {
  const guard = await requireOrganizationPermission('invoices', 'delete');
  if (!guard.allowed || !guard.organizationId) {
    return { error: guard.error || 'No autorizado' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('reset_invoices', {
    p_organization_id: guard.organizationId,
  });

  if (error) {
    return { error: error.message || 'No se pudo resetear facturación' };
  }

  return { success: true };
}
