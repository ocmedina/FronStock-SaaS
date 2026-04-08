'use server';

import { requireOrganizationPermission } from '@/actions/_permissions';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/actions/audit';

type SupplierInput = {
  name: string;
  legal_name?: string | null;
  trade_name?: string | null;
  tax_id?: string | null;
  tax_id_type?: string | null;
  category?: string | null;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  administrative_address?: string | null;
  warehouse_address?: string | null;
  notes?: string | null;
  credit_limit?: number;
  payment_terms?: number;
  early_payment_discount?: number;
  rating?: number;
  default_payment_condition?: string | null;
  payment_days?: number | null;
  requires_advance?: boolean;
  advance_percentage?: number | null;
  bank_name?: string | null;
  bank_account_number?: string | null;
  bank_cbu_alias?: string | null;
  lead_time_days?: number | null;
};

export async function saveSupplier(input: { supplierId?: string; data: SupplierInput }) {
  const isEdit = !!input.supplierId;
  const guard = await requireOrganizationPermission('suppliers', isEdit ? 'edit' : 'create');
  if (!guard.allowed || !guard.organizationId) {
    return { error: guard.error || 'No autorizado' };
  }

  const name = String(input.data.name || '').trim();
  if (!name) {
    return { error: 'El nombre del proveedor es obligatorio' };
  }

  const payload = {
    ...input.data,
    name,
    organization_id: guard.organizationId,
  };

  const supabase = await createClient();

  if (isEdit) {
    const { error } = await supabase
      .from('suppliers')
      .update(payload)
      .eq('id', input.supplierId!)
      .eq('organization_id', guard.organizationId);

    if (error) return { error: error.message || 'No se pudo actualizar proveedor' };

    await logAuditEvent({
      organizationId: guard.organizationId,
      action: 'update',
      entity: 'suppliers',
      entityId: input.supplierId,
      metadata: { name, event: 'supplier_updated' },
    });

    return { success: true };
  }

  const { data: newSupplier, error } = await supabase
    .from('suppliers')
    .insert([payload])
    .select('id')
    .single();

  if (error) return { error: error.message || 'No se pudo crear proveedor' };

  await logAuditEvent({
    organizationId: guard.organizationId,
    action: 'insert',
    entity: 'suppliers',
    entityId: newSupplier?.id ?? null,
    metadata: { name, event: 'supplier_created' },
  });

  return { success: true };
}

export async function deleteSupplier(supplierId: string) {
  const guard = await requireOrganizationPermission('suppliers', 'delete');
  if (!guard.allowed || !guard.organizationId) {
    return { error: guard.error || 'No autorizado' };
  }

  const supabase = await createClient();

  // Obtener nombre antes de eliminar para el log
  const { data: supplier } = await supabase
    .from('suppliers')
    .select('name')
    .eq('id', supplierId)
    .eq('organization_id', guard.organizationId)
    .single();

  const { error } = await supabase
    .from('suppliers')
    .delete()
    .eq('id', supplierId)
    .eq('organization_id', guard.organizationId);

  if (error) {
    return { error: error.message || 'No se pudo eliminar proveedor' };
  }

  await logAuditEvent({
    organizationId: guard.organizationId,
    action: 'delete',
    entity: 'suppliers',
    entityId: supplierId,
    metadata: { name: supplier?.name ?? 'desconocido', event: 'supplier_deleted' },
  });

  return { success: true };
}

export async function registerSupplierPayment(input: {
  supplierId: string;
  purchaseOrderId?: string | null;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  referenceNumber?: string | null;
  notes?: string | null;
}) {
  const guard = await requireOrganizationPermission('suppliers', 'edit');
  if (!guard.allowed || !guard.organizationId) {
    return { error: guard.error || 'No autorizado' };
  }

  const amount = Number(input.amount || 0);
  if (amount <= 0) {
    return { error: 'El monto debe ser mayor a 0' };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.rpc('register_supplier_payment', {
    p_organization_id: guard.organizationId,
    p_supplier_id: input.supplierId,
    p_purchase_order_id: input.purchaseOrderId || null,
    p_amount: amount,
    p_payment_method: input.paymentMethod,
    p_payment_date: input.paymentDate,
    p_reference_number: input.referenceNumber || null,
    p_notes: input.notes || null,
  });

  if (error) {
    return { error: error.message || 'No se pudo registrar el pago' };
  }

  await logAuditEvent({
    organizationId: guard.organizationId,
    action: 'custom',
    entity: 'suppliers',
    entityId: input.supplierId,
    metadata: {
      event: 'supplier_payment_registered',
      amount,
      payment_method: input.paymentMethod,
      purchase_order_id: input.purchaseOrderId ?? null,
    },
  });

  return { success: true, data };
}
