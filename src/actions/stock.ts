'use server';

import { requireOrganizationPermission } from '@/actions/_permissions';
import { createClient } from '@/lib/supabase/server';

type StockMovementInput = {
  product_id: string;
  movement_type: 'entry' | 'exit';
  quantity: number;
  reason: string;
  notes?: string;
};

export async function createStockMovement(input: StockMovementInput) {
  const guard = await requireOrganizationPermission('stock', 'create');
  if (!guard.allowed || !guard.organizationId || !guard.userId) {
    return { error: guard.error || 'No autorizado' };
  }

  const quantity = Number(input.quantity || 0);
  if (!input.product_id || quantity <= 0) {
    return { error: 'Datos de movimiento inválidos' };
  }

  const supabase = await createClient();

  const { data: product, error: productError } = await supabase
    .from('products')
    .select('id, name, stock')
    .eq('id', input.product_id)
    .eq('organization_id', guard.organizationId)
    .single();

  if (productError || !product) {
    return { error: 'Producto no encontrado' };
  }

  const isEntry = input.movement_type === 'entry';
  const quantityChange = isEntry ? quantity : -quantity;
  const newStock = Number(product.stock || 0) + quantityChange;

  if (newStock < 0) {
    return { error: 'No hay suficiente stock para esta salida' };
  }

  const { error: movementError } = await supabase.from('stock_movements').insert({
    organization_id: guard.organizationId,
    product_id: product.id,
    product_name: product.name,
    movement_type: input.movement_type,
    quantity: quantityChange,
    previous_stock: product.stock,
    new_stock: newStock,
    reason: input.reason,
    reference_type: 'manual',
    notes: input.notes?.trim() || null,
    created_by: guard.userId,
  });

  if (movementError) {
    return { error: movementError.message || 'No se pudo registrar el movimiento' };
  }

  const { error: updateError } = await supabase
    .from('products')
    .update({ stock: newStock })
    .eq('id', product.id)
    .eq('organization_id', guard.organizationId);

  if (updateError) {
    return { error: updateError.message || 'No se pudo actualizar el stock' };
  }

  return { success: true };
}
