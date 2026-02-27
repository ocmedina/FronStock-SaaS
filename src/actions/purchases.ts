'use server';

import { requireOrganizationPermission } from '@/actions/_permissions';
import { createClient } from '@/lib/supabase/server';

type PurchaseOrderItemInput = {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_cost: number;
};

export async function createPurchaseOrder(input: {
  supplierId: string;
  notes?: string | null;
  items: PurchaseOrderItemInput[];
}) {
  const guard = await requireOrganizationPermission('purchases', 'create');
  if (!guard.allowed || !guard.organizationId) {
    return { error: guard.error || 'No autorizado' };
  }

  const items = (input.items || []).filter((item) => Number(item.quantity) > 0 && Number(item.unit_cost) >= 0);
  if (!input.supplierId || items.length === 0) {
    return { error: 'Datos de orden inválidos' };
  }

  const supabase = await createClient();

  const total = items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unit_cost), 0);

  const { data: order, error: orderError } = await supabase
    .from('purchase_orders')
    .insert({
      organization_id: guard.organizationId,
      supplier_id: input.supplierId,
      order_number: `OC-${Date.now().toString().slice(-6)}`,
      status: 'pending',
      total,
      notes: input.notes || null,
    })
    .select('id')
    .single();

  if (orderError || !order) {
    return { error: orderError?.message || 'No se pudo crear la orden de compra' };
  }

  const orderItemsData = items.map((item) => ({
    purchase_order_id: order.id,
    product_id: item.product_id,
    product_name: item.product_name,
    quantity: Number(item.quantity),
    unit_cost: Number(item.unit_cost),
    total: Number(item.quantity) * Number(item.unit_cost),
  }));

  const { error: itemsError } = await supabase.from('purchase_order_items').insert(orderItemsData);
  if (itemsError) {
    return { error: itemsError.message || 'No se pudieron crear los ítems de la orden' };
  }

  return { success: true, orderId: order.id };
}
