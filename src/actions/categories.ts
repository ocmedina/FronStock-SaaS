'use server';

import { requireOrganizationPermission } from '@/actions/_permissions';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/actions/audit';

type CategoryPayload = {
  name: string;
  description?: string | null;
};

export async function saveCategory(input: { categoryId?: string; data: CategoryPayload }) {
  const isEdit = !!input.categoryId;
  const guard = await requireOrganizationPermission('categories', isEdit ? 'edit' : 'create');
  if (!guard.allowed || !guard.organizationId) {
    return { error: guard.error || 'No autorizado' };
  }

  const name = String(input.data.name || '').trim();
  if (!name) return { error: 'El nombre de la categoría es obligatorio' };

  const supabase = await createClient();

  if (isEdit) {
    const { error } = await supabase
      .from('categories')
      .update({ name, description: input.data.description || null })
      .eq('id', input.categoryId!)
      .eq('organization_id', guard.organizationId);

    if (error) return { error: error.message || 'No se pudo actualizar la categoría' };

    await logAuditEvent({
      organizationId: guard.organizationId,
      action: 'update',
      entity: 'categories',
      entityId: input.categoryId,
      metadata: { event: 'category_updated', name },
    });

    return { success: true };
  }

  const { data: category, error } = await supabase
    .from('categories')
    .insert({ organization_id: guard.organizationId, name, description: input.data.description || null })
    .select('id')
    .single();

  if (error) return { error: error.message || 'No se pudo crear la categoría' };

  await logAuditEvent({
    organizationId: guard.organizationId,
    action: 'insert',
    entity: 'categories',
    entityId: category?.id ?? null,
    metadata: { event: 'category_created', name },
  });

  return { success: true };
}

export async function deleteCategory(categoryId: string) {
  const guard = await requireOrganizationPermission('categories', 'delete');
  if (!guard.allowed || !guard.organizationId) {
    return { error: guard.error || 'No autorizado' };
  }

  const supabase = await createClient();

  const { data: category } = await supabase
    .from('categories')
    .select('name')
    .eq('id', categoryId)
    .eq('organization_id', guard.organizationId)
    .single();

  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', categoryId)
    .eq('organization_id', guard.organizationId);

  if (error) return { error: error.message || 'No se pudo eliminar la categoría' };

  await logAuditEvent({
    organizationId: guard.organizationId,
    action: 'delete',
    entity: 'categories',
    entityId: categoryId,
    metadata: { event: 'category_deleted', name: category?.name ?? 'desconocida' },
  });

  return { success: true };
}
