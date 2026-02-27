'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useOrganization } from './OrganizationContext';
import { defaultRolePermissions, type Role, MODULES } from '@/lib/permissions';

interface PermissionRecord {
    role: string;
    module: string;
    can_view: boolean;
    can_create: boolean;
    can_edit: boolean;
    can_delete: boolean;
}

interface PermissionsContextValue {
    permissions: PermissionRecord[];
    isLoading: boolean;
    error: string | null;
    getPermission: (role: string, module: string) => PermissionRecord | null;
    updatePermission: (role: string, module: string, updates: Partial<PermissionRecord>) => Promise<void>;
    resetToDefaults: (role: string) => Promise<void>;
    refetch: () => void;
}

const PermissionsContext = createContext<PermissionsContextValue | null>(null);

export function usePermissionsConfig() {
    const context = useContext(PermissionsContext);
    if (!context) {
        throw new Error('usePermissionsConfig must be used within PermissionsProvider');
    }
    return context;
}

interface PermissionsProviderProps {
    children: ReactNode;
}

export function PermissionsProvider({ children }: PermissionsProviderProps) {
    const { organizationId, isLoading: orgLoading } = useOrganization();
    const [permissions, setPermissions] = useState<PermissionRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const supabase = useMemo(() => createClient(), []);

    const fetchPermissions = useCallback(async () => {
        if (!organizationId) return;

        setIsLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
            .from('organization_permissions')
            .select('role, module, can_view, can_create, can_edit, can_delete')
            .eq('organization_id', organizationId);

        if (fetchError) {
            // Si la tabla no existe o hay error, usar defaults
            console.warn('Could not fetch permissions, using defaults:', fetchError.message);
            initializeDefaults();
        } else if (data && data.length > 0) {
            setPermissions(data);
        } else {
            // No hay permisos configurados, inicializar con defaults
            initializeDefaults();
        }

        setIsLoading(false);
    }, [organizationId, supabase]);

    const initializeDefaults = async () => {
        if (!organizationId) return;

        const defaultPerms: PermissionRecord[] = [];
        const roles: Role[] = ['owner', 'admin', 'manager', 'employee', 'delivery', 'viewer'];

        for (const role of roles) {
            for (const module of MODULES) {
                const perms = defaultRolePermissions[role]?.[module] || {
                    view: false,
                    create: false,
                    edit: false,
                    delete: false,
                };
                defaultPerms.push({
                    role,
                    module,
                    can_view: perms.view,
                    can_create: perms.create,
                    can_edit: perms.edit,
                    can_delete: perms.delete,
                });
            }
        }

        // Intentar guardar en DB
        const toInsert = defaultPerms.map((p) => ({
            organization_id: organizationId,
            ...p,
        }));

        await supabase.from('organization_permissions').upsert(toInsert, {
            onConflict: 'organization_id,role,module',
        });

        setPermissions(defaultPerms);
    };

    useEffect(() => {
        if (organizationId && !orgLoading) {
            fetchPermissions();
        }
    }, [organizationId, orgLoading, fetchPermissions]);

    const getPermission = (role: string, module: string): PermissionRecord | null => {
        return permissions.find((p) => p.role === role && p.module === module) || null;
    };

    const updatePermission = async (
        role: string,
        module: string,
        updates: Partial<PermissionRecord>
    ) => {
        if (!organizationId) return;

        const { error: updateError } = await supabase
            .from('organization_permissions')
            .update({
                can_view: updates.can_view,
                can_create: updates.can_create,
                can_edit: updates.can_edit,
                can_delete: updates.can_delete,
                updated_at: new Date().toISOString(),
            })
            .eq('organization_id', organizationId)
            .eq('role', role)
            .eq('module', module);

        if (updateError) {
            setError('Error al actualizar permiso: ' + updateError.message);
            return;
        }

        // Actualizar estado local
        setPermissions((prev) =>
            prev.map((p) =>
                p.role === role && p.module === module ? { ...p, ...updates } : p
            )
        );
    };

    const resetToDefaults = async (role: string) => {
        if (!organizationId) return;

        const defaults = defaultRolePermissions[role as Role];
        if (!defaults) return;

        for (const module of MODULES) {
            const perms = defaults[module];
            if (perms) {
                await updatePermission(role, module, {
                    can_view: perms.view,
                    can_create: perms.create,
                    can_edit: perms.edit,
                    can_delete: perms.delete,
                });
            }
        }
    };

    return (
        <PermissionsContext.Provider
            value={{
                permissions,
                isLoading,
                error,
                getPermission,
                updatePermission,
                resetToDefaults,
                refetch: fetchPermissions,
            }}
        >
            {children}
        </PermissionsContext.Provider>
    );
}
