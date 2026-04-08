'use server';

import { requireOrganizationPermission } from '@/actions/_permissions';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/actions/audit';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type ProductPayload = {
  name: string;
  sku?: string | null;
  barcode?: string | null;
  plu?: string | null;
  price: number;
  cost_price?: number | null;
  wholesale_price?: number | null;
  stock: number;
  min_stock?: number | null;
  description?: string | null;
  unit?: string | null;
  brand?: string | null;
  category_id?: string | null;
  image_url?: string | null;
  is_combo?: boolean;
  is_active?: boolean;
};

type ComboItem = {
  child_product_id: string;
  quantity: number;
};

// ─── Límite de plan (ya existía) ─────────────────────────────────────────────

export async function checkProductLimit() {
  const guard = await requireOrganizationPermission('products', 'create');
  if (!guard.allowed || !guard.organizationId) {
    return { error: guard.error || 'No autorizado' };
  }
  const { checkOrganizationLimit } = await import('@/lib/plans/limits');
  const result = await checkOrganizationLimit(guard.organizationId, 'products');
  return result;
}

// ─── Crear producto ───────────────────────────────────────────────────────────

export async function createProduct(data: ProductPayload, comboItems?: ComboItem[]) {
  const guard = await requireOrganizationPermission('products', 'create');
  if (!guard.allowed || !guard.organizationId) {
    return { error: guard.error || 'No autorizado' };
  }

  const name = String(data.name || '').trim();
  if (!name) return { error: 'El nombre del producto es obligatorio' };
  if (Number(data.price) < 0) return { error: 'El precio no puede ser negativo' };

  // Verificar límite de plan
  const { checkOrganizationLimit } = await import('@/lib/plans/limits');
  const limitCheck = await checkOrganizationLimit(guard.organizationId, 'products');
  if (!limitCheck.allowed) return { error: limitCheck.error };

  const supabase = await createClient();

  const { data: product, error } = await supabase
    .from('products')
    .insert({ ...data, name, organization_id: guard.organizationId })
    .select('id, name')
    .single();

  if (error || !product) return { error: error?.message || 'No se pudo crear el producto' };

  // Guardar items del combo si aplica
  if (data.is_combo && comboItems && comboItems.length > 0) {
    const items = comboItems.map((item) => ({
      organization_id: guard.organizationId,
      parent_product_id: product.id,
      child_product_id: item.child_product_id,
      quantity: item.quantity,
    }));
    const { error: comboError } = await supabase.from('product_combos').insert(items);
    if (comboError) return { error: 'Producto creado pero falló el combo: ' + comboError.message };
  }

  await logAuditEvent({
    organizationId: guard.organizationId,
    action: 'insert',
    entity: 'products',
    entityId: product.id,
    metadata: { event: 'product_created', name: product.name, price: data.price, stock: data.stock },
  });

  return { success: true, productId: product.id };
}

// ─── Actualizar producto ──────────────────────────────────────────────────────

export async function updateProduct(productId: string, data: Partial<ProductPayload>, comboItems?: ComboItem[]) {
  const guard = await requireOrganizationPermission('products', 'edit');
  if (!guard.allowed || !guard.organizationId) {
    return { error: guard.error || 'No autorizado' };
  }

  const supabase = await createClient();

  // Obtener estado anterior para auditoría
  const { data: before } = await supabase
    .from('products')
    .select('name, price, cost_price, stock')
    .eq('id', productId)
    .eq('organization_id', guard.organizationId)
    .single();

  const { error } = await supabase
    .from('products')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', productId)
    .eq('organization_id', guard.organizationId);

  if (error) return { error: error.message || 'No se pudo actualizar el producto' };

  // Actualizar combo items si aplica
  if (data.is_combo !== undefined) {
    await supabase.from('product_combos').delete().eq('parent_product_id', productId);
    if (data.is_combo && comboItems && comboItems.length > 0) {
      const items = comboItems.map((item) => ({
        organization_id: guard.organizationId,
        parent_product_id: productId,
        child_product_id: item.child_product_id,
        quantity: item.quantity,
      }));
      await supabase.from('product_combos').insert(items);
    }
  }

  await logAuditEvent({
    organizationId: guard.organizationId,
    action: 'update',
    entity: 'products',
    entityId: productId,
    metadata: {
      event: 'product_updated',
      before: before ?? null,
      after: { name: data.name, price: data.price, cost_price: data.cost_price, stock: data.stock },
    },
  });

  return { success: true };
}

// ─── Eliminar producto ────────────────────────────────────────────────────────

export async function deleteProduct(productId: string) {
  const guard = await requireOrganizationPermission('products', 'delete');
  if (!guard.allowed || !guard.organizationId) {
    return { error: guard.error || 'No autorizado' };
  }

  const supabase = await createClient();

  const { data: product } = await supabase
    .from('products')
    .select('name, price')
    .eq('id', productId)
    .eq('organization_id', guard.organizationId)
    .single();

  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', productId)
    .eq('organization_id', guard.organizationId);

  if (error) return { error: error.message || 'No se pudo eliminar el producto' };

  await logAuditEvent({
    organizationId: guard.organizationId,
    action: 'delete',
    entity: 'products',
    entityId: productId,
    metadata: { event: 'product_deleted', name: product?.name ?? 'desconocido', price: product?.price },
  });

  return { success: true };
}

// ─── Importar productos (bulk insert) ────────────────────────────────────────

export async function importProducts(products: ProductPayload[]) {
  const guard = await requireOrganizationPermission('products:import', 'view');
  if (!guard.allowed || !guard.organizationId) {
    return { error: guard.error || 'No tienes permiso para importar productos' };
  }

  if (!products.length) return { error: 'No hay productos para importar' };

  const supabase = await createClient();
  const rows = products.map((p) => ({ ...p, organization_id: guard.organizationId }));

  const { error, count } = await supabase.from('products').insert(rows);
  if (error) return { error: error.message || 'Error en la importación' };

  await logAuditEvent({
    organizationId: guard.organizationId,
    action: 'custom',
    entity: 'products',
    entityId: null,
    metadata: { event: 'products_imported', count: products.length },
  });

  return { success: true, count: count ?? products.length };
}

// ─── Actualización masiva de precio o stock ───────────────────────────────────

export async function bulkUpdateProducts(
  productIds: string[],
  field: 'price' | 'stock',
  operation: 'set' | 'add' | 'subtract' | 'percentage',
  value: number
) {
  const guard = await requireOrganizationPermission('products', 'edit');
  if (!guard.allowed || !guard.organizationId) {
    return { error: guard.error || 'No autorizado' };
  }

  if (!productIds.length) return { error: 'No hay productos seleccionados' };

  const supabase = await createClient();

  // Obtener valores actuales para calcular nuevos valores
  const { data: current, error: fetchError } = await supabase
    .from('products')
    .select('id, price, stock')
    .in('id', productIds)
    .eq('organization_id', guard.organizationId);

  if (fetchError || !current) return { error: 'No se pudieron leer los productos' };

  let errors = 0;
  for (const product of current) {
    const currentValue = field === 'price' ? Number(product.price) : Number(product.stock);
    let newValue: number;

    switch (operation) {
      case 'set':        newValue = value; break;
      case 'add':        newValue = currentValue + value; break;
      case 'subtract':   newValue = Math.max(0, currentValue - value); break;
      case 'percentage': newValue = currentValue * (1 + value / 100); break;
      default:           newValue = currentValue;
    }

    newValue = field === 'price'
      ? Math.round(newValue * 100) / 100
      : Math.round(newValue);

    const { error } = await supabase
      .from('products')
      .update({ [field]: newValue, updated_at: new Date().toISOString() })
      .eq('id', product.id)
      .eq('organization_id', guard.organizationId);

    if (error) errors++;
  }

  await logAuditEvent({
    organizationId: guard.organizationId,
    action: 'custom',
    entity: 'products',
    entityId: null,
    metadata: {
      event: 'bulk_price_update',
      field,
      operation,
      value,
      product_count: productIds.length,
      errors,
    },
  });

  if (errors > 0) return { success: true, warning: `${errors} productos no se pudieron actualizar` };
  return { success: true };
}
