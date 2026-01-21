'use client';

import { useState } from 'react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { usePermissions } from '@/hooks/usePermissions';
import { AccessDenied } from '@/components/Protected';
import {
    MODULES,
    moduleLabels,
    roleLabels,
    defaultRolePermissions,
    type Role,
    type Module,
} from '@/lib/permissions';

const ROLES: Role[] = ['admin', 'manager', 'employee', 'viewer'];

export default function PermissionsPage() {
    const { permissions, updatePermission, isLoading: orgLoading } = useOrganization();
    const { canEditPermissions, isOwner } = usePermissions();
    const [selectedRole, setSelectedRole] = useState<Role>('admin');
    const [saving, setSaving] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const getPermission = (role: string, module: string) => {
        const perm = permissions.find((p) => p.role === role && p.module === module);
        if (perm) {
            return {
                can_view: perm.can_view,
                can_create: perm.can_create,
                can_edit: perm.can_edit,
                can_delete: perm.can_delete,
            };
        }
        // Fallback a defaults
        const defaults = defaultRolePermissions[role as Role]?.[module];
        return {
            can_view: defaults?.view ?? false,
            can_create: defaults?.create ?? false,
            can_edit: defaults?.edit ?? false,
            can_delete: defaults?.delete ?? false,
        };
    };

    const handleToggle = async (
        role: string,
        module: string,
        action: 'can_view' | 'can_create' | 'can_edit' | 'can_delete'
    ) => {
        if (!canEditPermissions) return;

        const current = getPermission(role, module);
        const newValue = !current[action];

        setSaving(`${role}-${module}-${action}`);
        setMessage(null);

        const success = await updatePermission(role, module, {
            ...current,
            [action]: newValue,
        });

        if (success) {
            setMessage({ type: 'success', text: 'Permiso actualizado' });
        } else {
            setMessage({ type: 'error', text: 'Error al actualizar' });
        }

        setSaving(null);
        setTimeout(() => setMessage(null), 2000);
    };

    const resetRoleToDefaults = async (role: Role) => {
        if (!canEditPermissions) return;

        setSaving(`reset-${role}`);
        setMessage(null);

        const defaults = defaultRolePermissions[role];
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

        setMessage({ type: 'success', text: `Rol "${roleLabels[role]}" restaurado a valores por defecto` });
        setSaving(null);
    };

    if (orgLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
        );
    }

    if (!canEditPermissions) {
        return <AccessDenied message="Solo propietarios y administradores pueden gestionar permisos" />;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-800">Gestión de Permisos</h1>
                <p className="text-slate-500">
                    Configura qué puede hacer cada rol en tu organización
                </p>
            </div>

            {/* Message */}
            {message && (
                <div
                    className={`px-4 py-3 rounded-lg text-sm ${message.type === 'success'
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                        }`}
                >
                    {message.text}
                </div>
            )}

            {/* Role Tabs */}
            <div className="flex gap-2 border-b border-slate-200">
                {ROLES.map((role) => (
                    <button
                        key={role}
                        onClick={() => setSelectedRole(role)}
                        className={`px-4 py-3 font-medium border-b-2 transition-colors ${selectedRole === role
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        {roleLabels[role]}
                    </button>
                ))}
            </div>

            {/* Permissions Grid */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">
                                Módulo
                            </th>
                            <th className="text-center px-4 py-4 text-sm font-semibold text-slate-600">
                                👁️ Ver
                            </th>
                            <th className="text-center px-4 py-4 text-sm font-semibold text-slate-600">
                                ➕ Crear
                            </th>
                            <th className="text-center px-4 py-4 text-sm font-semibold text-slate-600">
                                ✏️ Editar
                            </th>
                            <th className="text-center px-4 py-4 text-sm font-semibold text-slate-600">
                                🗑️ Eliminar
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {MODULES.map((module) => {
                            const perms = getPermission(selectedRole, module);
                            const isOwnerModule = module === 'permissions' && !isOwner;

                            return (
                                <tr key={module} className="hover:bg-slate-50">
                                    <td className="px-6 py-4 font-medium text-slate-800">
                                        {moduleLabels[module as Module]}
                                    </td>
                                    {(['can_view', 'can_create', 'can_edit', 'can_delete'] as const).map(
                                        (action) => (
                                            <td key={action} className="text-center px-4 py-4">
                                                <button
                                                    onClick={() => handleToggle(selectedRole, module, action)}
                                                    disabled={isOwnerModule || saving !== null}
                                                    className={`w-10 h-6 rounded-full transition-colors relative ${perms[action]
                                                        ? 'bg-green-500'
                                                        : 'bg-slate-300'
                                                        } ${isOwnerModule ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                >
                                                    <span
                                                        className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${perms[action] ? 'left-4' : 'left-0.5'
                                                            }`}
                                                    />
                                                </button>
                                            </td>
                                        )
                                    )}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Reset Button */}
            <div className="flex justify-end">
                <button
                    onClick={() => resetRoleToDefaults(selectedRole)}
                    disabled={saving !== null}
                    className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                >
                    {saving === `reset-${selectedRole}` ? 'Restaurando...' : `Restaurar "${roleLabels[selectedRole]}" a valores por defecto`}
                </button>
            </div>

            {/* Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
                <strong>💡 Nota:</strong> Los cambios se aplican inmediatamente a todos los usuarios con el rol seleccionado.
                El rol "Propietario" siempre tiene acceso completo y no puede ser modificado.
            </div>
        </div>
    );
}
