'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { usePermissions } from '@/hooks/usePermissions';
import { AccessDenied } from '@/components/Protected';
import { Input } from '@/components/ui/input';
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
import { Shield, ShieldAlert, BadgeCheck, History, Loader2, RefreshCw } from 'lucide-react';

const ROLES: Role[] = ['admin', 'manager', 'employee', 'delivery', 'billing', 'viewer'];

type AuditLog = {
    id: string;
    actor_user_id: string | null;
    action: 'insert' | 'update' | 'delete' | 'custom' | string;
    entity: string;
    entity_id: string | null;
    before_data: Record<string, unknown> | null;
    after_data: Record<string, unknown> | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
};

type ProfileName = {
    id: string;
    full_name: string | null;
};

const AUDIT_ACTION_OPTIONS = ['all', 'insert', 'update', 'delete', 'custom'] as const;

function actionLabel(action: string) {
    if (action === 'insert') return 'Alta';
    if (action === 'update') return 'Edicion';
    if (action === 'delete') return 'Eliminacion';
    if (action === 'custom') return 'Evento';
    return action;
}

function entityLabel(entity: string) {
    const labels: Record<string, string> = {
        products: 'Productos',
        sales: 'Ventas',
        stock_movements: 'Movimientos de stock',
        organization_permissions: 'Permisos',
        users: 'Usuarios',
    };
    return labels[entity] || entity;
}

function toShortValue(value: unknown) {
    if (value === null || value === undefined) return 'vacio';
    if (typeof value === 'string') return value.length > 30 ? `${value.slice(0, 30)}...` : value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return '[obj]';
}

function summarizeChange(row: AuditLog) {
    if (row.action === 'insert') return 'Registro creado';
    if (row.action === 'delete') return 'Registro eliminado';

    if (row.action === 'custom') {
        const eventName = typeof row.metadata?.event === 'string' ? row.metadata.event : null;
        return eventName ? `Evento: ${eventName}` : 'Evento custom';
    }

    if (row.action === 'update' && row.before_data && row.after_data) {
        const ignored = new Set(['updated_at', 'created_at']);
        const keys = Array.from(new Set([...Object.keys(row.before_data), ...Object.keys(row.after_data)]))
            .filter((key) => !ignored.has(key))
            .filter((key) => JSON.stringify(row.before_data?.[key]) !== JSON.stringify(row.after_data?.[key]));

        if (keys.length === 0) return 'Sin cambios relevantes';

        const preview = keys.slice(0, 2).map((key) => {
            const before = toShortValue(row.before_data?.[key]);
            const after = toShortValue(row.after_data?.[key]);
            return `${key}: ${before} -> ${after}`;
        });

        return keys.length > 2 ? `${preview.join(' | ')} (+${keys.length - 2} más)` : preview.join(' | ');
    }

    return '-';
}

export default function PermissionsPage() {
    const supabase = useMemo(() => createClient(), []);
    const { organizationId, permissions, updatePermission, isLoading: orgLoading } = useOrganization();
    const { canEditPermissions, isOwner, canView } = usePermissions();

    const [activeTab, setActiveTab] = useState<'permissions' | 'audit'>('permissions');
    const [selectedRole, setSelectedRole] = useState<Role>('admin');
    const [saving, setSaving] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const [auditLoading, setAuditLoading] = useState(false);
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [namesByUserId, setNamesByUserId] = useState<Record<string, string>>({});
    const [auditActionFilter, setAuditActionFilter] = useState<(typeof AUDIT_ACTION_OPTIONS)[number]>('all');
    const [auditEntityFilter, setAuditEntityFilter] = useState('all');
    const [auditSearch, setAuditSearch] = useState('');
    const [hidePermissionNoise, setHidePermissionNoise] = useState(true);
    const [auditPage, setAuditPage] = useState(1);
    const [auditHasMore, setAuditHasMore] = useState(false);
    const AUDIT_PAGE_SIZE = 50;

    const canViewAudit = canView('audit:view');

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

    const fetchAuditLogs = useCallback(async (page = 1, append = false) => {
        if (!organizationId || !canViewAudit) {
            setAuditLogs([]);
            setNamesByUserId({});
            return;
        }

        setAuditLoading(true);
        try {
            const from = (page - 1) * AUDIT_PAGE_SIZE;
            const to = from + AUDIT_PAGE_SIZE - 1;

            const { data, error } = await supabase
                .from('audit_logs')
                .select('id, actor_user_id, action, entity, entity_id, before_data, after_data, metadata, created_at')
                .eq('organization_id', organizationId)
                .order('created_at', { ascending: false })
                .range(from, to + 1); // +1 para detectar si hay más páginas

            if (error) throw error;

            const rawLogs = (data || []) as AuditLog[];
            const hasMore = rawLogs.length > AUDIT_PAGE_SIZE;
            const logs = hasMore ? rawLogs.slice(0, AUDIT_PAGE_SIZE) : rawLogs;

            setAuditHasMore(hasMore);
            setAuditLogs((prev) => (append ? [...prev, ...logs] : logs));

            const allLogs = append ? [...auditLogs, ...logs] : logs;
            const userIds = Array.from(new Set(allLogs.map((row) => row.actor_user_id).filter(Boolean) as string[]));

            if (userIds.length === 0) {
                if (!append) setNamesByUserId({});
                return;
            }

            const { data: profilesData, error: profilesError } = await supabase
                .from('profiles')
                .select('id, full_name')
                .in('id', userIds);

            if (profilesError) throw profilesError;

            const mapped: Record<string, string> = append ? { ...namesByUserId } : {};
            (profilesData as ProfileName[]).forEach((profile) => {
                mapped[profile.id] = profile.full_name?.trim() || profile.id;
            });

            setNamesByUserId(mapped);
        } catch (error) {
            console.error('Error cargando auditoria:', error);
            if (!append) {
                setAuditLogs([]);
                setNamesByUserId({});
            }
        } finally {
            setAuditLoading(false);
        }
    }, [canViewAudit, organizationId, supabase]);

    useEffect(() => {
        if (activeTab === 'audit') {
            setAuditPage(1);
            fetchAuditLogs(1, false);
        }
    }, [activeTab, fetchAuditLogs]);

    const auditEntityOptions = useMemo(() => {
        const entities = Array.from(new Set(auditLogs.map((row) => row.entity))).sort((a, b) => a.localeCompare(b));
        return ['all', ...entities];
    }, [auditLogs]);

    const filteredAuditLogs = useMemo(() => {
        const term = auditSearch.trim().toLowerCase();

        return auditLogs.filter((row) => {
            if (auditActionFilter !== 'all' && row.action !== auditActionFilter) return false;
            if (auditEntityFilter !== 'all' && row.entity !== auditEntityFilter) return false;
            if (hidePermissionNoise && row.entity === 'organization_permissions') return false;
            if (!term) return true;

            const actor = row.actor_user_id ? namesByUserId[row.actor_user_id] || row.actor_user_id : 'Sistema';
            const metadataText = row.metadata ? JSON.stringify(row.metadata).toLowerCase() : '';
            const changeText = summarizeChange(row).toLowerCase();

            return (
                row.entity.toLowerCase().includes(term) ||
                String(row.entity_id || '').toLowerCase().includes(term) ||
                actor.toLowerCase().includes(term) ||
                metadataText.includes(term) ||
                changeText.includes(term)
            );
        });
    }, [auditActionFilter, auditEntityFilter, auditLogs, auditSearch, hidePermissionNoise, namesByUserId]);

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
            <div>
                <h1 className="text-2xl font-bold text-slate-800">Gestion de Permisos</h1>
                <p className="text-slate-500">Configura que puede hacer cada rol en tu organizacion</p>
            </div>

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

            <div className="flex gap-2 border-b border-slate-200">
                <button
                    onClick={() => setActiveTab('permissions')}
                    className={`px-4 py-3 font-medium border-b-2 transition-colors ${activeTab === 'permissions'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                >
                    Permisos
                </button>
                <button
                    onClick={() => setActiveTab('audit')}
                    className={`px-4 py-3 font-medium border-b-2 transition-colors ${activeTab === 'audit'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                >
                    Auditoria
                </button>
            </div>

            {activeTab === 'permissions' && (
                <>
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Subseccion 1: Seleccion de rol</p>
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
                    </div>

                    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Subseccion 2: Matriz de modulos</p>
                        <div className="flex items-center gap-2">
                            <Shield className="h-5 w-5 text-blue-600" />
                            <h2 className="text-lg font-semibold text-slate-800">Modulos Principales</h2>
                        </div>

                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                            <table className="w-full">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Modulo</th>
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
                                                {(['can_view', 'can_create', 'can_edit', 'can_delete'] as const).map((action) => (
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
                                                                className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${perms[action] ? 'left-7' : 'left-1'}`}
                                                            />
                                                        </button>
                                                    </td>
                                                ))}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Subseccion 3: Permisos granulares</p>
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
                                                    className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${isEnabled ? 'left-7' : 'left-1'}`}
                                                />
                                            </button>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-2">
                                            {module.startsWith('products') && 'Modulo de Productos'}
                                            {module.startsWith('sales') && 'Modulo de Ventas'}
                                            {module.startsWith('audit') && 'Modulo de Auditoria'}
                                            {module.startsWith('users') && 'Gestion de Usuarios'}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Subseccion 4: Acciones y ayuda</p>
                        <div className="flex justify-end pt-2 border-t border-slate-200">
                            <button
                                onClick={() => resetRoleToDefaults(selectedRole)}
                                disabled={saving !== null}
                                className="flex items-center px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                            >
                                Restaurar permisos por defecto para "{roleLabels[selectedRole]}"
                            </button>
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
                            <BadgeCheck className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                            <div className="text-sm text-blue-800">
                                <strong>Informacion Importante:</strong>
                                <ul className="list-disc ml-4 mt-1 space-y-1 text-blue-700">
                                    <li>Los permisos se aplican inmediatamente a todos los usuarios con el rol seleccionado.</li>
                                    <li>Los permisos avanzados controlan visibilidad de datos sensibles y acciones criticas.</li>
                                    <li>El rol Propietario siempre tiene acceso total.</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {activeTab === 'audit' && (
                <div className="space-y-4">
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Subseccion 1: Control</p>
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <History className="h-5 w-5 text-slate-700" />
                                <h2 className="text-lg font-semibold text-slate-800">Auditoria</h2>
                            </div>

                            {canViewAudit && (
                                <button
                                    onClick={() => { setAuditPage(1); fetchAuditLogs(1, false); }}
                                    disabled={auditLoading}
                                    className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50"
                                >
                                    <RefreshCw className={`h-4 w-4 mr-2 ${auditLoading ? 'animate-spin' : ''}`} />
                                    Actualizar
                                </button>
                            )}
                        </div>
                    </div>

                    {!canViewAudit ? (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                            Este usuario puede gestionar permisos, pero no tiene activo el permiso granular de auditoria.
                        </div>
                    ) : (
                        <>
                            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Subseccion 2: Filtros</p>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                    <select
                                        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                        value={auditActionFilter}
                                        onChange={(e) => setAuditActionFilter(e.target.value as (typeof AUDIT_ACTION_OPTIONS)[number])}
                                    >
                                        {AUDIT_ACTION_OPTIONS.map((value) => (
                                            <option key={value} value={value}>
                                                {value === 'all' ? 'Todas las acciones' : actionLabel(value)}
                                            </option>
                                        ))}
                                    </select>

                                    <select
                                        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                        value={auditEntityFilter}
                                        onChange={(e) => setAuditEntityFilter(e.target.value)}
                                    >
                                        {auditEntityOptions.map((value) => (
                                            <option key={value} value={value}>
                                                {value === 'all' ? 'Todas las entidades' : value}
                                            </option>
                                        ))}
                                    </select>

                                    <div className="md:col-span-2">
                                        <Input
                                            value={auditSearch}
                                            onChange={(e) => setAuditSearch(e.target.value)}
                                            placeholder="Buscar por actor, entidad, id o metadata"
                                        />
                                    </div>
                                </div>
                                <label className="inline-flex items-center gap-2 text-sm text-slate-600">
                                    <input
                                        type="checkbox"
                                        checked={hidePermissionNoise}
                                        onChange={(e) => setHidePermissionNoise(e.target.checked)}
                                    />
                                    Ocultar ruido de cambios masivos de permisos
                                </label>
                            </div>

                            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Subseccion 3: Resultados</p>
                                <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                {auditLoading ? (
                                    <div className="flex items-center justify-center py-14 text-slate-500">
                                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                        Cargando auditoria...
                                    </div>
                                ) : filteredAuditLogs.length === 0 ? (
                                    <div className="py-14 text-center text-slate-500">No se encontraron registros</div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-50 border-b border-slate-200">
                                                <tr>
                                                    <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">Fecha</th>
                                                    <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">Accion</th>
                                                    <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">Entidad</th>
                                                    <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">ID</th>
                                                    <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">Actor</th>
                                                    <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">Cambio</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200">
                                                {filteredAuditLogs.map((row) => {
                                                    const actor = row.actor_user_id
                                                        ? namesByUserId[row.actor_user_id] || row.actor_user_id
                                                        : 'Sistema';
                                                    const change = summarizeChange(row);

                                                    return (
                                                        <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                                                            <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                                                                {new Date(row.created_at).toLocaleString('es-AR')}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                                                                    {actionLabel(row.action)}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 font-medium text-slate-800">{entityLabel(row.entity)}</td>
                                                            <td className="px-4 py-3 text-slate-600 max-w-[220px] truncate">{row.entity_id || '-'}</td>
                                                            <td className="px-4 py-3 text-slate-600 max-w-[220px] truncate">{actor}</td>
                                                            <td className="px-4 py-3 text-slate-600 max-w-[420px] truncate" title={change}>{change}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                                </div>

                                {/* Paginación — Cargar más */}
                                {auditHasMore && !auditLoading && (
                                    <div className="flex flex-col items-center gap-2 pt-2">
                                        <p className="text-xs text-slate-500">
                                            Mostrando {filteredAuditLogs.length} de más registros
                                        </p>
                                        <button
                                            onClick={() => {
                                                const nextPage = auditPage + 1;
                                                setAuditPage(nextPage);
                                                fetchAuditLogs(nextPage, true);
                                            }}
                                            className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 transition-colors"
                                        >
                                            Cargar más registros
                                        </button>
                                    </div>
                                )}
                                {auditLoading && auditLogs.length > 0 && (
                                    <div className="flex justify-center py-3 text-slate-500 text-sm">
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Cargando más...
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
