"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { usePermissions } from "@/hooks/usePermissions";
import { AccessDenied } from "@/components/Protected";
import { canAssignRole, roleLabels, type Role } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Loader2,
  Search,
  UserPlus,
  UsersRound,
} from "lucide-react";
import {
  User,
  Invitation,
  ASSIGNABLE_ROLES,
  UserStats,
  PendingInvitations,
  UserGrid,
  RoleLegend,
  EditRoleModal,
  InviteUserModal,
  CreateUserModal,
} from "@/components/users";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function UsersPage() {
  const {
    organizationId,
    organization,
    profile,
    isLoading: orgLoading,
  } = useOrganization();
  const { canView, canCreate, canEdit, canDelete } = usePermissions();
  const [users, setUsers] = useState<User[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Edit Role State
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newRole, setNewRole] = useState<string>("");

  // Delete User State
  const [userToDelete, setUserToDelete] = useState<{ id: string; name: string } | null>(null);

  const [saving, setSaving] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [inviteData, setInviteData] = useState({ email: "", role: "employee" });
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const supabase = createClient();
  const currentRole = profile?.role as Role;
  const canDeleteUsers = canDelete("users") || currentRole === "owner" || currentRole === "admin";

  const fetchData = useCallback(async () => {
    if (!organizationId) return;
    setIsLoading(true);

    // Fetch users
    const { data: usersData } = await supabase
      .from("profiles")
      .select("id, full_name, role, updated_at")
      .eq("organization_id", organizationId)
      .order("role");

    if (usersData) setUsers(usersData);


    // Fetch pending invitations
    const { data: invitationsData } = await supabase
      .from("invitations")
      .select("id, email, role, status, created_at")
      .eq("organization_id", organizationId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (invitationsData) setInvitations(invitationsData);

    setIsLoading(false);
  }, [organizationId, supabase]);

  useEffect(() => {
    if (organizationId) fetchData();
  }, [organizationId, fetchData]);

  const handleEditRole = (user: User) => {
    setEditingUser(user);
    setNewRole(user.role);
  };


  const handleSaveRole = async () => {
    if (!editingUser || !newRole) return;

    if (!canAssignRole(currentRole, newRole as Role)) {
      toast.error("No puedes asignar un rol igual o superior al tuyo");
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("id", editingUser.id);

    if (error) {
      toast.error("Error al actualizar: " + error.message);
    } else {
      toast.success("Rol actualizado correctamente");
      fetchData();
      setEditingUser(null);
    }

    setSaving(false);
  };

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId || !inviteData.email) return;

    setSaving(true);

    const { createInvitation } = await import("@/actions/invitations");
    const result = await createInvitation({
      email: inviteData.email,
      role: inviteData.role as Role,
    });

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`Invitación enviada a ${inviteData.email}`);
      setInviteData({ email: "", role: "employee" });
      setShowInviteModal(false);
      fetchData();
    }

    setSaving(false);
  };

  const handleCancelInvitation = async (invitationId: string) => {
    const { error } = await supabase.from("invitations").delete().eq("id", invitationId);
    if (error) {
      toast.error("No se pudo cancelar la invitación: " + error.message);
      return;
    }
    toast.success("Invitación cancelada");
    fetchData();
  };

  // Logic to OPEN the dialog
  const handleRemoveUserClick = (userId: string, userName: string) => {
    setUserToDelete({ id: userId, name: userName });
  };

  // Logic to CONFIRM deletion
  const confirmDeleteUser = async () => {
    if (!userToDelete) return;

    const { deleteUser } = await import("@/actions/users");
    const result = await deleteUser(userToDelete.id);

    if (result.error) {
      toast.error("Error: " + result.error);
    } else {
      toast.success("Usuario eliminado correctamente");
      fetchData();
    }
    setUserToDelete(null);
  };

  const availableRoles = ASSIGNABLE_ROLES.filter((r) =>
    canAssignRole(currentRole, r),
  );
  const filteredUsers = users.filter((user) => {
    const matchesSearch = (user.full_name || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  if (orgLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!canView("users")) {
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
        {canCreate("users") && (
          <div className="flex gap-2">
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20"
            >
              <UserPlus className="h-4 w-4 mr-2" /> Crear Usuario
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowInviteModal(true)}
              className="shadow-sm"
            >
              <UserPlus className="h-4 w-4 mr-2" /> Invitar
            </Button>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <UserStats
        users={users}
        invitations={invitations}
        currentRole={currentRole}
      />

      {/* Pending Invitations */}
      <PendingInvitations
        invitations={invitations}
        canDeleteUsers={canDeleteUsers}
        onCancel={handleCancelInvitation}
      />

      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <UsersRound className="h-5 w-5 text-primary" />
            <div>
              <h2 className="font-semibold">Directorio de usuarios</h2>
              <p className="text-sm text-muted-foreground">{filteredUsers.length} de {users.length} usuarios</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar usuario..."
                className="w-full pl-9 sm:w-64"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Filtrar por rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los roles</SelectItem>
                {["owner", ...ASSIGNABLE_ROLES].map((role) => (
                  <SelectItem key={role} value={role}>{roleLabels[role as Role] || role}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Users table */}
      <UserGrid
        users={filteredUsers}
        currentUserId={profile?.id}
        currentRole={currentRole}
        loading={isLoading}
        canEdit={canEdit("users")}
        canDelete={canDeleteUsers}
        onEditRole={handleEditRole}
        onRemoveUser={handleRemoveUserClick}
      />

      {/* Role Legend */}
      <RoleLegend />

      {/* Edit Role Modal */}
      <EditRoleModal
        user={editingUser}
        newRole={newRole}
        saving={saving}
        availableRoles={availableRoles}
        onClose={() => setEditingUser(null)}
        onSave={handleSaveRole}
        onRoleChange={setNewRole}
      />

      {/* Invite User Modal */}
      <InviteUserModal
        open={showInviteModal}
        onOpenChange={setShowInviteModal}
        inviteData={inviteData}
        setInviteData={setInviteData}
        availableRoles={availableRoles}
        saving={saving}
        onInvite={handleInviteUser}
      />

      {/* Create User Modal */}
      <CreateUserModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        availableRoles={availableRoles}
        onSuccess={() => {
          fetchData();
          toast.success("Usuario creado correctamente");
        }}
      />


      {/* Delete User Confirmation Dialog */}
      <AlertDialog open={!!userToDelete} onOpenChange={(open: boolean) => !open && setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás completamente seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará al usuario <span className="font-bold text-foreground">{userToDelete?.name}</span> de forma permanente.
              <br />
              Perderá acceso al sistema y esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteUser}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Eliminar Definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div >
  );
}
