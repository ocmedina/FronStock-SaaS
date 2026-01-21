'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { usePermissions } from '@/hooks/usePermissions';
import { AccessDenied } from '@/components/Protected';
import { roleLabels, roleDescriptions, canAssignRole, type Role } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Users, UserPlus, Shield, Mail, Clock, Loader2, Crown, ShieldCheck, Briefcase, Eye, UserCog, Trash2, AlertCircle, CheckCircle } from 'lucide-react';

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

const ROLE_COLORS: Record<string, string> = {
    owner: 'bg-gradient-to-r from-purple-500 to-pink-500',
    admin: 'bg-gradient-to-r from-blue-500 to-cyan-500',
    manager: 'bg-gradient-to-r from-emerald-500 to-green-500',
    employee: 'bg-gradient-to-r from-amber-500 to-orange-500',
    viewer: 'bg-gradient-to-r from-slate-400 to-slate-500',
};

const ROLE_ICONS: Record<string, typeof Crown> = {
    owner: Crown,
    admin: ShieldCheck,
    manager: Briefcase,
    employee: UserCog,
    viewer: Eye,
};

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

    // Función para obtener iniciales
    const getInitials = (name: string | null) => {
        if (!name) return 'U';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    if (orgLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!canView('users')) {
        return <AccessDenied />;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                        Usuarios
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        {users.length} usuarios en {organization?.name}
                    </p>
                </div>
                {canCreate('users') && (
                    <Button onClick={() => setShowInviteModal(true)} className="shadow-lg shadow-primary/20">
                        <UserPlus className="h-4 w-4" /> Invitar Usuario
                    </Button>
                )}
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 shadow-lg shadow-blue-500/20">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-blue-100 text-sm">Total Usuarios</p>
                                <p className="text-2xl font-bold mt-1">{users.length}</p>
                            </div>
                            <Users className="h-8 w-8 opacity-50" />
                        </div>
                    </CardContent>
                </Card>
                
                <Card className="bg-gradient-to-br from-amber-500 to-orange-500 text-white border-0 shadow-lg shadow-amber-500/20">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-amber-100 text-sm">Invitaciones</p>
                                <p className="text-2xl font-bold mt-1">{invitations.length}</p>
                            </div>
                            <Mail className="h-8 w-8 opacity-50" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-muted-foreground text-sm">Administradores</p>
                                <p className="text-2xl font-bold mt-1">{users.filter(u => u.role === 'admin' || u.role === 'owner').length}</p>
                            </div>
                            <Shield className="h-8 w-8 text-muted-foreground/30" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-muted-foreground text-sm">Tu Rol</p>
                                <p className="text-lg font-bold mt-1">{roleLabels[currentRole] || currentRole}</p>
                            </div>
                            <UserCog className="h-8 w-8 text-muted-foreground/30" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Message */}
            {message && (
                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm ${
                    message.type === 'success'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800'
                        : 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
                }`}>
                    {message.type === 'success' ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                    {message.text}
                </div>
            )}

            {/* Pending Invitations */}
            {invitations.length > 0 && (
                <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2 text-amber-700 dark:text-amber-400">
                            <Mail className="h-5 w-5" />
                            Invitaciones Pendientes
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {invitations.map((inv) => {
                                const RoleIcon = ROLE_ICONS[inv.role] || Eye;
                                return (
                                    <div key={inv.id} className="flex items-center justify-between bg-background rounded-xl p-4 border">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                                <Mail className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                                            </div>
                                            <div>
                                                <p className="font-medium">{inv.email}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Badge variant="secondary" className="text-xs">
                                                        <RoleIcon className="h-3 w-3 mr-1" />
                                                        {roleLabels[inv.role as Role] || inv.role}
                                                    </Badge>
                                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                        <Clock className="h-3 w-3" />
                                                        {new Date(inv.created_at).toLocaleDateString('es-AR')}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        {canDelete('users') && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleCancelInvitation(inv.id)}
                                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                            >
                                                Cancelar
                                            </Button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Users Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {isLoading ? (
                    <div className="col-span-full flex items-center justify-center h-32">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : (
                    users.map((user) => {
                        const RoleIcon = ROLE_ICONS[user.role] || Eye;
                        const isCurrentUser = user.id === profile?.id;
                        return (
                            <Card key={user.id} className={`hover:shadow-lg transition-shadow ${isCurrentUser ? 'ring-2 ring-primary/20' : ''}`}>
                                <CardContent className="p-6">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-12 h-12 rounded-full ${ROLE_COLORS[user.role] || ROLE_COLORS.viewer} flex items-center justify-center text-white font-bold text-lg shadow-lg`}>
                                                {getInitials(user.full_name)}
                                            </div>
                                            <div>
                                                <p className="font-semibold flex items-center gap-2">
                                                    {user.full_name || 'Sin nombre'}
                                                    {isCurrentUser && (
                                                        <Badge variant="outline" className="text-xs">Tú</Badge>
                                                    )}
                                                </p>
                                                <div className="flex items-center gap-1.5 mt-1">
                                                    <RoleIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                                    <span className="text-sm text-muted-foreground">
                                                        {roleLabels[user.role as Role] || user.role}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <p className="text-xs text-muted-foreground mb-4">
                                        {roleDescriptions[user.role as Role]}
                                    </p>

                                    {!isCurrentUser && user.role !== 'owner' && (
                                        <div className="flex gap-2">
                                            {canEdit('users') && canAssignRole(currentRole, user.role as Role) && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleEditRole(user)}
                                                    className="flex-1"
                                                >
                                                    <UserCog className="h-4 w-4" />
                                                    Cambiar Rol
                                                </Button>
                                            )}
                                            {canDelete('users') && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleRemoveUser(user.id, user.full_name || 'usuario')}
                                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })
                )}
            </div>

            {/* Role Legend */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Shield className="h-5 w-5 text-primary" />
                        Roles Disponibles
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                        {(Object.keys(roleLabels) as Role[]).map((role) => {
                            const RoleIcon = ROLE_ICONS[role] || Eye;
                            return (
                                <div key={role} className="rounded-xl p-4 bg-muted/50 hover:bg-muted transition-colors">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className={`w-8 h-8 rounded-lg ${ROLE_COLORS[role]} flex items-center justify-center shadow-sm`}>
                                            <RoleIcon className="h-4 w-4 text-white" />
                                        </div>
                                        <span className="font-medium">{roleLabels[role]}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">{roleDescriptions[role]}</p>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Edit Role Modal */}
            <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <UserCog className="h-5 w-5 text-primary" />
                            Cambiar Rol
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50">
                            <div className={`w-12 h-12 rounded-full ${ROLE_COLORS[editingUser?.role || 'viewer']} flex items-center justify-center text-white font-bold`}>
                                {getInitials(editingUser?.full_name || null)}
                            </div>
                            <div>
                                <p className="font-semibold">{editingUser?.full_name || 'Sin nombre'}</p>
                                <p className="text-sm text-muted-foreground">Rol actual: {roleLabels[editingUser?.role as Role] || editingUser?.role}</p>
                            </div>
                        </div>
                        
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Nuevo Rol</label>
                            <Select value={newRole} onValueChange={setNewRole}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableRoles.map((role) => {
                                        const RoleIcon = ROLE_ICONS[role] || Eye;
                                        return (
                                            <SelectItem key={role} value={role}>
                                                <div className="flex items-center gap-2">
                                                    <RoleIcon className="h-4 w-4" />
                                                    {roleLabels[role]}
                                                </div>
                                            </SelectItem>
                                        );
                                    })}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">{roleDescriptions[newRole as Role]}</p>
                        </div>

                        <div className="flex gap-3 pt-4">
                            <Button variant="outline" onClick={() => setEditingUser(null)} className="flex-1">
                                Cancelar
                            </Button>
                            <Button
                                onClick={handleSaveRole}
                                disabled={saving || newRole === editingUser?.role}
                                className="flex-1"
                            >
                                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                                {saving ? 'Guardando...' : 'Guardar'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Invite User Modal */}
            <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <UserPlus className="h-5 w-5 text-primary" />
                            Invitar Usuario
                        </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleInviteUser} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-2">
                                <Mail className="h-4 w-4 text-muted-foreground" />
                                Email
                            </label>
                            <Input
                                type="email"
                                value={inviteData.email}
                                onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
                                required
                                placeholder="usuario@ejemplo.com"
                            />
                        </div>
                        
                        <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-2">
                                <Shield className="h-4 w-4 text-muted-foreground" />
                                Rol
                            </label>
                            <Select value={inviteData.role} onValueChange={(v) => setInviteData({ ...inviteData, role: v })}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableRoles.map((role) => {
                                        const RoleIcon = ROLE_ICONS[role] || Eye;
                                        return (
                                            <SelectItem key={role} value={role}>
                                                <div className="flex items-center gap-2">
                                                    <RoleIcon className="h-4 w-4" />
                                                    {roleLabels[role]}
                                                </div>
                                            </SelectItem>
                                        );
                                    })}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 text-sm text-blue-700 dark:text-blue-300">
                            <p className="font-medium mb-1">💡 Cómo funciona:</p>
                            <p className="text-blue-600 dark:text-blue-400">
                                El usuario debe registrarse con este email. Al registrarse, se unirá automáticamente a la organización con el rol asignado.
                            </p>
                        </div>

                        <div className="flex gap-3 pt-4">
                            <Button type="button" variant="outline" onClick={() => setShowInviteModal(false)} className="flex-1">
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={saving} className="flex-1">
                                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                                {saving ? 'Enviando...' : 'Invitar'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
