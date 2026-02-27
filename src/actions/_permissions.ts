'use server';

import { createClient } from '@/lib/supabase/server';
import { defaultRolePermissions, type Role, type PermissionActions } from '@/lib/permissions';

type PermissionAction = 'view' | 'create' | 'edit' | 'delete';

export type PermissionGuardResult = {
  allowed: boolean;
  error?: string;
  role?: Role;
  organizationId?: string;
  userId?: string;
};

export async function requireOrganizationPermission(
  module: string,
  action: PermissionAction
): Promise<PermissionGuardResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { allowed: false, error: 'No autorizado' };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role, organization_id')
    .eq('id', user.id)
    .single();

  if (profileError || !profile?.organization_id || !profile?.role) {
    return { allowed: false, error: 'Perfil no válido' };
  }

  const role = profile.role as Role;

  if (role === 'owner') {
    return {
      allowed: true,
      role,
      organizationId: profile.organization_id,
      userId: user.id,
    };
  }

  const { data: perm } = await supabase
    .from('organization_permissions')
    .select('can_view, can_create, can_edit, can_delete')
    .eq('organization_id', profile.organization_id)
    .eq('role', role)
    .eq('module', module)
    .maybeSingle();

  const actionFieldMap: Record<PermissionAction, 'can_view' | 'can_create' | 'can_edit' | 'can_delete'> = {
    view: 'can_view',
    create: 'can_create',
    edit: 'can_edit',
    delete: 'can_delete',
  };

  const field = actionFieldMap[action];

  let allowed: boolean;
  if (perm) {
    allowed = Boolean(perm[field]);
  } else {
    const defaults = defaultRolePermissions[role];
    const modulePermissions = defaults?.[module] as PermissionActions | undefined;
    allowed = Boolean(modulePermissions?.[action]);
  }

  return {
    allowed,
    error: allowed ? undefined : 'No tienes permisos para realizar esta acción',
    role,
    organizationId: profile.organization_id,
    userId: user.id,
  };
}
