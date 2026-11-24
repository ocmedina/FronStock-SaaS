'use server';

import { requireOrganizationPermission } from '@/actions/_permissions';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/actions/audit';

type CustomerPayload = {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  tax_id?: string | null;
  customer_type?: 'retail' | 'wholesale' | string;
  service_type?: 'counter' | 'delivery' | 'both' | null;
  credit_limit?: number | null;
  notes?: string | null;
  is_active?: boolean;
};

// ─── Crear cliente ────────────────────────────────────────────────────────────

export async function createCustomer(data: CustomerPayload) {
  const guard = await requireOrganizationPermission('customers', 'create');
  if (!guard.allowed || !guard.organizationId) {
    return { error: guard.error || 'No autorizado' };
  }

  const name = String(data.name || '').trim();
  if (!name) return { error: 'El nombre del cliente es obligatorio' };

  const supabase = await createClient();

  const { data: customer, error } = await supabase
    .from('customers')
    .insert({ ...data, name, organization_id: guard.organizationId, balance: 0 })
    .select('id, name')
    .single();

  if (error || !customer) return { error: error?.message || 'No se pudo crear el cliente' };

  await logAuditEvent({
    organizationId: guard.organizationId,
    action: 'insert',
    entity: 'customers',
    entityId: customer.id,
    metadata: { event: 'customer_created', name, customer_type: data.customer_type },
  });

  return { success: true, customerId: customer.id };
}

// ─── Actualizar cliente ───────────────────────────────────────────────────────

export async function updateCustomer(customerId: string, data: Partial<CustomerPayload>) {
  const guard = await requireOrganizationPermission('customers', 'edit');
  if (!guard.allowed || !guard.organizationId) {
    return { error: guard.error || 'No autorizado' };
  }

  const supabase = await createClient();

  const { data: before } = await supabase
    .from('customers')
    .select('name, email, phone, credit_limit')
    .eq('id', customerId)
    .eq('organization_id', guard.organizationId)
    .single();

  const { error } = await supabase
    .from('customers')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', customerId)
    .eq('organization_id', guard.organizationId);

  if (error) return { error: error.message || 'No se pudo actualizar el cliente' };

  await logAuditEvent({
    organizationId: guard.organizationId,
    action: 'update',
    entity: 'customers',
    entityId: customerId,
    metadata: { event: 'customer_updated', before: before ?? null, after: data },
  });

  return { success: true };
}

// ─── Eliminar cliente ─────────────────────────────────────────────────────────

export async function deleteCustomer(customerId: string) {
  const guard = await requireOrganizationPermission('customers', 'delete');
  if (!guard.allowed || !guard.organizationId) {
    return { error: guard.error || 'No autorizado' };
  }

  const supabase = await createClient();

  const { data: customer } = await supabase
    .from('customers')
    .select('name, balance')
    .eq('id', customerId)
    .eq('organization_id', guard.organizationId)
    .single();

  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', customerId)
    .eq('organization_id', guard.organizationId);

  if (error) return { error: error.message || 'No se pudo eliminar el cliente' };

  await logAuditEvent({
    organizationId: guard.organizationId,
    action: 'delete',
    entity: 'customers',
    entityId: customerId,
    metadata: { event: 'customer_deleted', name: customer?.name ?? 'desconocido', balance: customer?.balance },
  });

  return { success: true };
}

// ─── Registrar pago de cliente ────────────────────────────────────────────────

export async function registerCustomerPayment(input: {
  customerId: string;
  amount: number;
  description?: string;
}) {
  const guard = await requireOrganizationPermission('customers', 'edit');
  if (!guard.allowed || !guard.organizationId) {
    return { error: guard.error || 'No autorizado' };
  }

  const amount = Number(input.amount || 0);
  if (!Number.isFinite(amount) || amount <= 0) return { error: 'El monto debe ser mayor a 0' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('register_customer_payment', {
    p_org_id: guard.organizationId,
    p_customer_id: input.customerId,
    p_amount: amount,
    p_description: input.description || 'Pago a cuenta',
  });

  if (error) return { error: error.message || 'Error al registrar pago' };

  const result = data as {
    success?: boolean;
    error?: string;
    customer_name?: string;
    previous_balance?: number;
    new_balance?: number;
  } | null;
  if (!result?.success) return { error: result?.error || 'No se pudo registrar el pago' };

  await logAuditEvent({
    organizationId: guard.organizationId,
    action: 'custom',
    entity: 'customers',
    entityId: input.customerId,
    metadata: {
      event: 'customer_payment',
      customer_name: result.customer_name,
      amount,
      previous_balance: result.previous_balance,
      new_balance: result.new_balance,
    },
  });

  return { success: true, newBalance: Number(result.new_balance || 0) };
}
