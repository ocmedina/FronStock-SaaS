'use client';

import { useState } from 'react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { usePermissions } from '@/hooks/usePermissions';
import { AccessDenied } from '@/components/Protected';
import {
    MODULES,
    SUB_MODULES,
    moduleLabels,
    subModuleLabels,
    roleLabels,
    defaultRolePermissions,
    type Role,
    type Module,
    type SubModule,
} from '@/lib/permissions';
import { Shield, ShieldAlert, BadgeCheck } from 'lucide-react';

const ROLES: Role[] = ['admin', 'manager', 'employee', 'delivery', 'billing', 'viewer'];

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

        // Reset Standard Modules
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

        // Reset Granular Modules
        for (const module of SUB_MODULES) {
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

            {/* SECTION 1: Standard Modules */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-blue-600" />
                    <h2 className="text-lg font-semibold text-slate-800">Módulos Principales</h2>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Módulo</th>
                                <th className="text-center px-4 py-4 text-sm font-semibold text-slate-600">Ver</th>
                                <th className="text-center px-4 py-4 text-sm font-semibold text-slate-600">Crear</th>
                                <th className="text-center px-4 py-4 text-sm font-semibold text-slate-600">Editar</th>
                                <th className="text-center px-4 py-4 text-sm font-semibold text-slate-600">Eliminar</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {MODULES.map((module) => {
                                const perms = getPermission(selectedRole, module);
                                const isOwnerModule = module === 'permissions' && !isOwner;

                                return (
                                    <tr key={module} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-slate-800">
                                            {moduleLabels[module as Module]}
                                        </td>
                                        {(['can_view', 'can_create', 'can_edit', 'can_delete'] as const).map(
                                            (action) => (
                                                <td key={action} className="text-center px-4 py-4">
                                                    <button
                                                        onClick={() => handleToggle(selectedRole, module, action)}
                                                        disabled={isOwnerModule || saving !== null}
                                                        className={`w-12 h-6 rounded-full transition-all relative ${perms[action]
                                                            ? 'bg-blue-600'
                                                            : 'bg-slate-200'
                                                            } ${isOwnerModule ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
                                                    >
                                                        <span
                                                            className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${perms[action] ? 'left-7' : 'left-1'
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
            </div>

            {/* SECTION 2: Granular Permissions */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5 text-purple-600" />
                    <h2 className="text-lg font-semibold text-slate-800">Permisos Avanzados y Granulares</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {SUB_MODULES.map((module) => {
                        const perms = getPermission(selectedRole, module);
                        const isEnabled = perms.can_view;

                        return (
                            <div
                                key={module}
                                className={`p-4 rounded-xl border transition-all ${isEnabled
                                        ? 'bg-purple-50 border-purple-200 shadow-sm'
                                        : 'bg-white border-slate-200 hover:border-purple-200'
                                    }`}
                            >
                                <div className="flex items-center justify-between">
                                    <span className={`font-medium ${isEnabled ? 'text-purple-900' : 'text-slate-600'}`}>
                                        {subModuleLabels[module as SubModule]}
                                    </span>
                                    <button
                                        onClick={() => handleToggle(selectedRole, module, 'can_view')}
                                        disabled={saving !== null}
                                        className={`w-12 h-6 rounded-full transition-all relative ${isEnabled
                                            ? 'bg-purple-600'
                                            : 'bg-slate-200'
                                            }`}
                                    >
                                        <span
                                            className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${isEnabled ? 'left-7' : 'left-1'
                                                }`}
                                        />
                                    </button>
                                </div>
                                <p className="text-xs text-slate-500 mt-2">
                                    {module.startsWith('products') && 'Módulo de Productos'}
                                    {module.startsWith('sales') && 'Módulo de Ventas'}
                                    {module.startsWith('users') && 'Gestión de Usuarios'}
                                </p>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Reset Button */}
            <div className="flex justify-end pt-4 border-t border-slate-200">
                <button
                    onClick={() => resetRoleToDefaults(selectedRole)}
                    disabled={saving !== null}
                    className="flex items-center px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                >
                    Restaurar permisos por defecto para "{roleLabels[selectedRole]}"
                </button>
            </div>

            {/* Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
                <BadgeCheck className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                    <strong>Información Importante:</strong>
                    <ul className="list-disc ml-4 mt-1 space-y-1 text-blue-700">
                        <li>Los permisos se aplican inmediatamente a todos los usuarios con el rol seleccionado.</li>
                        <li>Los "Permisos Avanzados" controlan visibilidad de columnas sensibles (precios de costo) y acciones críticas (exportar datos).</li>
                        <li>El rol "Propietario" siempre tiene acceso total.</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
