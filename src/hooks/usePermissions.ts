'use client';

import { useOrganization } from '@/contexts/OrganizationContext';
import { defaultRolePermissions, type Role, type PermissionActions } from '@/lib/permissions';

interface UsePermissionsReturn {
    role: Role | null;
    can: (module: string, action: 'view' | 'create' | 'edit' | 'delete') => boolean;
    canView: (module: string) => boolean;
    canCreate: (module: string) => boolean;
    canEdit: (module: string) => boolean;
    canDelete: (module: string) => boolean;
    isOwner: boolean;
    isAdmin: boolean;
    isManager: boolean;
    isEmployee: boolean;
    isViewer: boolean;
    canEditPermissions: boolean;
}

/**
 * Hook para verificar permisos del usuario actual
 * Lee de la tabla organization_permissions si está disponible, sino usa defaults
 */
export function usePermissions(): UsePermissionsReturn {
    const { profile, permissions: orgPermissions } = useOrganization();
    const role = (profile?.role as Role) || null;

    const can = (module: string, action: 'view' | 'create' | 'edit' | 'delete') => {
        // Owner siempre tiene todos los permisos
        if (role === 'owner') return true;
        if (!role) return false;

        const actionFieldMap: Record<string, 'can_view' | 'can_create' | 'can_edit' | 'can_delete'> = {
            view: 'can_view',
            create: 'can_create',
            edit: 'can_edit',
            delete: 'can_delete',
        };
        const field = actionFieldMap[action];

        // Buscar en permisos personalizados de la org
        if (orgPermissions && orgPermissions.length > 0) {
            const perm = orgPermissions.find((p) => p.role === role && p.module === module);
            if (perm) {
                // Encontró el permiso en la DB, usar ese valor
                return Boolean(perm[field]);
            }
            // Si hay permisos en la org pero no para este rol/módulo, 
            // probablemente todavía no se inicializó, usar defaults
        }

        // Fallback a permisos por defecto (solo si no hay permisos en DB)
        const permissions = defaultRolePermissions[role];
        if (!permissions) return false;
        const modulePermissions = permissions[module] as PermissionActions | undefined;
        if (!modulePermissions) return false;
        return modulePermissions[action];
    };

    return {
        role,
        can,
        canView: (module: string) => can(module, 'view'),
        canCreate: (module: string) => can(module, 'create'),
        canEdit: (module: string) => can(module, 'edit'),
        canDelete: (module: string) => can(module, 'delete'),
        isOwner: role === 'owner',
        isAdmin: role === 'admin' || role === 'owner',
        isManager: role === 'manager' || role === 'admin' || role === 'owner',
        isEmployee: role === 'employee',
        isViewer: role === 'viewer',
        canEditPermissions: role === 'owner' || role === 'admin',
    };
}
