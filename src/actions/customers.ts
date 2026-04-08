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
  if (amount <= 0) return { error: 'El monto debe ser mayor a 0' };

  const supabase = await createClient();

  // Leer balance actual
  const { data: customer } = await supabase
    .from('customers')
    .select('name, balance')
    .eq('id', input.customerId)
    .eq('organization_id', guard.organizationId)
    .single();

  if (!customer) return { error: 'Cliente no encontrado' };

  const newBalance = (customer.balance || 0) - amount;

  const [{ error: balanceError }, { error: movementError }] = await Promise.all([
    supabase
      .from('customers')
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq('id', input.customerId)
      .eq('organization_id', guard.organizationId),
    supabase.from('customer_account_movements').insert({
      customer_id: input.customerId,
      type: 'payment',
      amount,
      description: input.description || 'Pago a cuenta',
    }),
  ]);

  if (balanceError) return { error: balanceError.message || 'Error al actualizar saldo' };
  if (movementError) return { error: movementError.message || 'Error al registrar movimiento' };

  await logAuditEvent({
    organizationId: guard.organizationId,
    action: 'custom',
    entity: 'customers',
    entityId: input.customerId,
    metadata: {
      event: 'customer_payment',
      customer_name: customer.name,
      amount,
      previous_balance: customer.balance,
      new_balance: newBalance,
    },
  });

  return { success: true, newBalance };
}
