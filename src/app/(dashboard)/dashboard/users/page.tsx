'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { usePermissions } from '@/hooks/usePermissions';
import { AccessDenied } from '@/components/Protected';
import { roleLabels, roleDescriptions, canAssignRole, type Role } from '@/lib/permissions';

interface User {
    id: string;
    full_name: string | null;
    role: string;
    updated_at: string;
}

interface Invitation {
    id: string;
    email: string;
    role: string;
    status: string;
    created_at: string;
}

const ASSIGNABLE_ROLES: Role[] = ['admin', 'manager', 'employee', 'viewer'];

export default function UsersPage() {
    const { organizationId, organization, profile, isLoading: orgLoading } = useOrganization();
    const { canView, canCreate, canEdit, canDelete } = usePermissions();
    const [users, setUsers] = useState<User[]>([]);
    const [invitations, setInvitations] = useState<Invitation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [newRole, setNewRole] = useState<string>('');
    const [saving, setSaving] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteData, setInviteData] = useState({ email: '', role: 'employee' });
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const supabase = createClient();
    const currentRole = profile?.role as Role;

    const fetchData = useCallback(async () => {
        if (!organizationId) return;
        setIsLoading(true);

        // Fetch users
        const { data: usersData } = await supabase
            .from('profiles')
            .select('id, full_name, role, updated_at')
            .eq('organization_id', organizationId)
            .order('role');

        if (usersData) setUsers(usersData);

        // Fetch pending invitations
        const { data: invitationsData } = await supabase
            .from('invitations')
            .select('id, email, role, status, created_at')
            .eq('organization_id', organizationId)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (invitationsData) setInvitations(invitationsData);

        setIsLoading(false);
    }, [organizationId, supabase]);

    useEffect(() => {
        if (organizationId) fetchData();
    }, [organizationId, fetchData]);

    const handleEditRole = (user: User) => {
        setEditingUser(user);
        setNewRole(user.role);
        setMessage(null);
    };

    const handleSaveRole = async () => {
        if (!editingUser || !newRole) return;

        if (!canAssignRole(currentRole, newRole as Role)) {
            setMessage({ type: 'error', text: 'No puedes asignar un rol igual o superior al tuyo' });
            return;
        }

        setSaving(true);

        const { error } = await supabase
            .from('profiles')
            .update({ role: newRole })
            .eq('id', editingUser.id);

        if (error) {
            setMessage({ type: 'error', text: 'Error al actualizar: ' + error.message });
        } else {
            setMessage({ type: 'success', text: 'Rol actualizado correctamente' });
            fetchData();
            setEditingUser(null);
        }

        setSaving(false);
    };

    const handleInviteUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!organizationId || !inviteData.email) return;

        setSaving(true);
        setMessage(null);

        // Generar token único
        const token = crypto.randomUUID();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // Expira en 7 días

        const { error } = await supabase
            .from('invitations')
            .insert({
                organization_id: organizationId,
                email: inviteData.email.toLowerCase(),
                role: inviteData.role,
                invited_by: profile?.id,
                token,
                expires_at: expiresAt.toISOString(),
            });

        if (error) {
            if (error.code === '23505') {
                setMessage({ type: 'error', text: 'Este email ya tiene una invitación pendiente' });
            } else {
                setMessage({ type: 'error', text: 'Error al invitar: ' + error.message });
            }
        } else {
            setMessage({ type: 'success', text: `Invitación enviada a ${inviteData.email}` });
            setInviteData({ email: '', role: 'employee' });
            setShowInviteModal(false);
            fetchData();
        }

        setSaving(false);
    };

    const handleCancelInvitation = async (invitationId: string) => {
        if (!confirm('¿Cancelar esta invitación?')) return;

        await supabase.from('invitations').delete().eq('id', invitationId);
        fetchData();
    };

    const handleRemoveUser = async (userId: string, userName: string) => {
        if (!confirm(`¿Estás seguro de eliminar a "${userName}" de la organización?`)) return;

        // En lugar de eliminar, quitamos la organization_id
        const { error } = await supabase
            .from('profiles')
            .update({ organization_id: null, role: 'viewer' })
            .eq('id', userId);

        if (error) {
            setMessage({ type: 'error', text: 'Error al eliminar usuario: ' + error.message });
        } else {
            setMessage({ type: 'success', text: 'Usuario eliminado de la organización' });
            fetchData();
        }
    };

    const availableRoles = ASSIGNABLE_ROLES.filter((r) => canAssignRole(currentRole, r));

    if (orgLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
        );
    }

    if (!canView('users')) {
        return <AccessDenied />;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Usuarios</h1>
                    <p className="text-slate-500">
                        {users.length} usuarios en {organization?.name}
                    </p>
                </div>
                {canCreate('users') && (
                    <button
                        onClick={() => setShowInviteModal(true)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                    >
                        <span>+</span> Invitar Usuario
                    </button>
                )}
            </div>

            {/* Message */}
            {message && (
                <div className={`px-4 py-3 rounded-lg text-sm ${message.type === 'success'
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                    {message.text}
                </div>
            )}

            {/* Pending Invitations */}
            {invitations.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                    <h3 className="font-semibold text-yellow-800 mb-3">📧 Invitaciones Pendientes</h3>
                    <div className="space-y-2">
                        {invitations.map((inv) => (
                            <div key={inv.id} className="flex items-center justify-between bg-white rounded-lg p-3 border border-yellow-200">
                                <div>
                                    <span className="font-medium text-slate-800">{inv.email}</span>
                                    <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                                        {roleLabels[inv.role as Role] || inv.role}
                                    </span>
                                </div>
                                {canDelete('users') && (
                                    <button
                                        onClick={() => handleCancelInvitation(inv.id)}
                                        className="text-red-600 hover:text-red-800 text-sm"
                                    >
                                        Cancelar
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Users Table */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {isLoading ? (
                    <div className="flex items-center justify-center h-32">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                    </div>
                ) : (
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Usuario</th>
                                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Rol</th>
                                <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {users.map((user) => (
                                <tr key={user.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-medium">
                                                {(user.full_name || 'U').charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="font-medium text-slate-800">{user.full_name || 'Sin nombre'}</p>
                                                {user.id === profile?.id && (
                                                    <span className="text-xs text-blue-600">(Tú)</span>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${user.role === 'owner' ? 'bg-purple-100 text-purple-700' :
                                                user.role === 'admin' ? 'bg-blue-100 text-blue-700' :
                                                    user.role === 'manager' ? 'bg-green-100 text-green-700' :
                                                        user.role === 'employee' ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-700'
                                            }`}>
                                            {roleLabels[user.role as Role] || user.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right space-x-2">
                                        {canEdit('users') && user.role !== 'owner' && user.id !== profile?.id && canAssignRole(currentRole, user.role as Role) && (
                                            <button
                                                onClick={() => handleEditRole(user)}
                                                className="text-blue-600 hover:text-blue-800"
                                            >
                                                Cambiar rol
                                            </button>
                                        )}
                                        {canDelete('users') && user.role !== 'owner' && user.id !== profile?.id && (
                                            <button
                                                onClick={() => handleRemoveUser(user.id, user.full_name || 'usuario')}
                                                className="text-red-600 hover:text-red-800"
                                            >
                                                Eliminar
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Role Legend */}
            <div className="bg-slate-50 rounded-xl p-4">
                <h3 className="font-semibold text-slate-800 mb-3">Roles Disponibles</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                    {(Object.keys(roleLabels) as Role[]).map((role) => (
                        <div key={role} className="bg-white rounded-lg p-3 border border-slate-200">
                            <div className="font-medium text-slate-800">{roleLabels[role]}</div>
                            <p className="text-xs text-slate-500">{roleDescriptions[role]}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Edit Role Modal */}
            {editingUser && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
                        <div className="p-6 border-b border-slate-200">
                            <h2 className="text-xl font-semibold text-slate-800">Cambiar Rol</h2>
                            <p className="text-slate-500 text-sm">Usuario: {editingUser.full_name}</p>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Nuevo Rol</label>
                                <select
                                    value={newRole}
                                    onChange={(e) => setNewRole(e.target.value)}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    {availableRoles.map((role) => (
                                        <option key={role} value={role}>
                                            {roleLabels[role]} - {roleDescriptions[role]}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setEditingUser(null)}
                                    className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSaveRole}
                                    disabled={saving || newRole === editingUser.role}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {saving ? 'Guardando...' : 'Guardar'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Invite User Modal */}
            {showInviteModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
                        <div className="p-6 border-b border-slate-200">
                            <h2 className="text-xl font-semibold text-slate-800">Invitar Usuario</h2>
                            <p className="text-slate-500 text-sm">El usuario recibirá acceso a la organización</p>
                        </div>
                        <form onSubmit={handleInviteUser} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                                <input
                                    type="email"
                                    value={inviteData.email}
                                    onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
                                    required
                                    placeholder="usuario@ejemplo.com"
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Rol</label>
                                <select
                                    value={inviteData.role}
                                    onChange={(e) => setInviteData({ ...inviteData, role: e.target.value })}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    {availableRoles.map((role) => (
                                        <option key={role} value={role}>
                                            {roleLabels[role]}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                                💡 El usuario debe registrarse con este email. Al registrarse, se unirá automáticamente a la organización con el rol asignado.
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowInviteModal(false)}
                                    className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {saving ? 'Enviando...' : 'Invitar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
