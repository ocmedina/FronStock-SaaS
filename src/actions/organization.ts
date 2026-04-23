'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const IGNORABLE_ERROR_CODES = new Set(['42P01', 'PGRST205']);

function normalize(value: string): string {
  return String(value || '').trim().toLowerCase();
}

export async function resetOrganizationData(confirmOrganizationName: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'No autorizado' };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile?.organization_id) {
    return { error: 'No se pudo validar tu organización' };
  }

  if (profile.role !== 'owner' && profile.role !== 'admin') {
    return { error: 'Solo propietario o administrador pueden borrar todos los datos' };
  }

  const { data: organization, error: orgError } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('id', profile.organization_id)
    .single();

  if (orgError || !organization) {
    return { error: 'No se pudo cargar la organización' };
  }

  if (normalize(confirmOrganizationName) !== normalize(organization.name)) {
    return { error: 'Debes escribir el nombre exacto de la organización para confirmar' };
  }

  const admin = createAdminClient();
  const organizationId = organization.id;

  const ensure = (error: any, context: string) => {
    if (!error) return;
    if (IGNORABLE_ERROR_CODES.has(error.code)) return;
    throw new Error(`${context}: ${error.message || 'error desconocido'}`);
  };

  const deleteByOrganization = async (table: string) => {
    const { error } = await admin.from(table).delete().eq('organization_id', organizationId);
    ensure(error, `No se pudo limpiar ${table}`);
  };

  const fetchIds = async (table: string) => {
    const { data, error } = await admin.from(table).select('id').eq('organization_id', organizationId);
    ensure(error, `No se pudo listar ${table}`);
    return (data || []).map((row: { id: string }) => row.id).filter(Boolean);
  };

  const deleteByIds = async (table: string, column: string, ids: string[]) => {
    if (ids.length === 0) return;
    const { error } = await admin.from(table).delete().in(column, ids);
    ensure(error, `No se pudo limpiar ${table}`);
  };

  try {
    const [orderIds, saleIds, purchaseIds, purchaseOrderIds, routeIds] = await Promise.all([
      fetchIds('orders'),
      fetchIds('sales'),
      fetchIds('purchases'),
      fetchIds('purchase_orders'),
      fetchIds('routes'),
    ]);

    // Child tables without organization_id must be deleted first.
    await deleteByIds('order_items', 'order_id', orderIds);
    await deleteByIds('order_payments', 'order_id', orderIds);
    await deleteByIds('order_events', 'order_id', orderIds);
    await deleteByIds('route_stops', 'order_id', orderIds);
    await deleteByIds('sale_items', 'sale_id', saleIds);
    await deleteByIds('purchase_items', 'purchase_id', purchaseIds);
    await deleteByIds('purchase_order_items', 'purchase_order_id', purchaseOrderIds);
    await deleteByIds('route_stops', 'route_id', routeIds);

    // Organization-scoped operational data.
    await deleteByOrganization('cash_movements');
    await deleteByOrganization('payments');
    await deleteByOrganization('supplier_payments');
    await deleteByOrganization('supplier_transactions');
    await deleteByOrganization('supplier_invoice_payments');
    await deleteByOrganization('supplier_invoices');
    await deleteByOrganization('daily_reports');
    await deleteByOrganization('expenses');
    await deleteByOrganization('stock_movements');
    await deleteByOrganization('invoices');
    await deleteByOrganization('delivery_shifts');
    await deleteByOrganization('purchase_orders');
    await deleteByOrganization('orders');
    await deleteByOrganization('sales');
    await deleteByOrganization('purchases');
    await deleteByOrganization('customers');
    await deleteByOrganization('suppliers');
    await deleteByOrganization('products');
    await deleteByOrganization('categories');
    await deleteByOrganization('brands');
    await deleteByOrganization('promotions');
    await deleteByOrganization('routes');

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/settings');
    revalidatePath('/delivery');

    return { success: true };
  } catch (error: any) {
    return {
      error: error?.message || 'No se pudieron borrar los datos de la organización',
    };
  }
}

export async function deleteAccountAndOrganization(confirmText: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'No autorizado' };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile?.organization_id) {
    return { error: 'No se pudo validar tu organización' };
  }

  if (profile.role !== 'owner' && profile.role !== 'admin') {
    return { error: 'Solo el propietario o administrador pueden eliminar la cuenta y la organización' };
  }

  if (confirmText.trim().toUpperCase() !== 'ELIMINAR DEFINITIVAMENTE') {
    return { error: 'La frase de confirmación no es correcta' };
  }

  const organizationId = profile.organization_id;

  // Re-use the resetOrganizationData to clean up foreign keys safely
  // We'll bypass the exact name check since they already typed the confirm text
  // but to reuse the code, it's easier to just do it here or call a refactored version.
  // We'll just fetch the org name to pass to resetOrganizationData:
  const { data: org } = await supabase.from('organizations').select('name').eq('id', organizationId).single();
  if (!org) {
    return { error: 'Organización no encontrada' };
  }

  const resetResult = await resetOrganizationData(org.name);
  if (resetResult.error) {
    return { error: `Error al limpiar datos operativos: ${resetResult.error}` };
  }

  const admin = createAdminClient();

  try {
    // Buscar a todos los usuarios de esta organización para eliminarlos de Auth
    const { data: usersData, error: usersError } = await admin
      .from('profiles')
      .select('id')
      .eq('organization_id', organizationId);

    if (usersError) throw new Error(`Error buscando usuarios: ${usersError.message}`);

    const userIds = (usersData || []).map(u => u.id);

    // 1. Clean up remaining cross-references manually before deleting organization
    await admin.from('user_security_preferences').delete().in('user_id', userIds);
    await admin.from('organization_permissions').delete().eq('organization_id', organizationId);
    await admin.from('audit_logs').delete().eq('organization_id', organizationId);

    const { error: profilesDelError } = await admin
      .from('profiles')
      .delete()
      .eq('organization_id', organizationId);
    
    if (profilesDelError) throw new Error(`Error eliminando perfiles: ${profilesDelError.message}`);

    // 2. Finally delete the organization
    const { error: orgDelError } = await admin.from('organizations').delete().eq('id', organizationId);
    if (orgDelError) throw new Error(`Error eliminando organización: ${orgDelError.message}`);

    // 3. Delete each user from Supabase Auth so they are completely wiped
    for (const uId of userIds) {
      const { error: deleteUserError } = await admin.auth.admin.deleteUser(uId);
      if (deleteUserError) {
         throw new Error(`No se pudo eliminar el usuario ${uId} de autenticación: ${deleteUserError.message}`);
      }
    }

    return { success: true };
  } catch (error: any) {
    return {
      error: error?.message || 'Error crítico durante la eliminación',
    };
  }
}
