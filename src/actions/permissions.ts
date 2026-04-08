'use server';

import { requireOrganizationPermission } from '@/actions/_permissions';
import { logAuditEvent } from '@/actions/audit';
import { createClient } from '@/lib/supabase/server';

type PermissionUpdate = {
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
};

/**
 * Server Action para actualizar un permiso de rol y registrar la auditoría.
 * Reemplaza la escritura directa desde el cliente en OrganizationContext.
 */
export async function updateRolePermission(input: {
  role: string;
  module: string;
  updates: Partial<PermissionUpdate>;
}) {
  const guard = await requireOrganizationPermission('permissions', 'edit');
  if (!guard.allowed || !guard.organizationId) {
    return { error: guard.error || 'No autorizado' };
  }

  const supabase = await createClient();

  // Verificar si ya existe la fila
  const { data: existing } = await supabase
    .from('organization_permissions')
    .select('can_view, can_create, can_edit, can_delete')
    .eq('organization_id', guard.organizationId)
    .eq('role', input.role)
    .eq('module', input.module)
    .maybeSingle();

  const beforeData = existing ?? null;

  if (existing) {
    const { error } = await supabase
      .from('organization_permissions')
      .update({
        ...input.updates,
        updated_at: new Date().toISOString(),
      })
      .eq('organization_id', guard.organizationId)
      .eq('role', input.role)
      .eq('module', input.module);

    if (error) return { error: error.message || 'No se pudo actualizar el permiso' };
  } else {
    const { error } = await supabase
      .from('organization_permissions')
      .insert({
        organization_id: guard.organizationId,
        role: input.role,
        module: input.module,
        can_view: input.updates.can_view ?? false,
        can_create: input.updates.can_create ?? false,
        can_edit: input.updates.can_edit ?? false,
        can_delete: input.updates.can_delete ?? false,
      });

    if (error) return { error: error.message || 'No se pudo crear el permiso' };
  }

  // Auditar el cambio con before/after del campo modificado
  await logAuditEvent({
    organizationId: guard.organizationId,
    action: 'update',
    entity: 'organization_permissions',
    entityId: `${input.role}:${input.module}`,
    metadata: {
      event: 'permission_changed',
      role: input.role,
      module: input.module,
      before: beforeData,
      after: input.updates,
      changed_by_role: guard.role,
    },
  });

  return { success: true };
}
