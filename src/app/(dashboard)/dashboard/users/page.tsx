"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { usePermissions } from "@/hooks/usePermissions";
import { AccessDenied } from "@/components/Protected";
import { canAssignRole, type Role } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  UserPlus,
  AlertCircle,
  CheckCircle,
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
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newRole, setNewRole] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [inviteData, setInviteData] = useState({ email: "", role: "employee" });
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const supabase = createClient();
  const currentRole = profile?.role as Role;

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
    setMessage(null);
  };

  const handleSaveRole = async () => {
    if (!editingUser || !newRole) return;

    if (!canAssignRole(currentRole, newRole as Role)) {
      setMessage({
        type: "error",
        text: "No puedes asignar un rol igual o superior al tuyo",
      });
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("id", editingUser.id);

    if (error) {
      setMessage({
        type: "error",
        text: "Error al actualizar: " + error.message,
      });
    } else {
      setMessage({ type: "success", text: "Rol actualizado correctamente" });
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

    const { error } = await supabase.from("invitations").insert({
      organization_id: organizationId,
      email: inviteData.email.toLowerCase(),
      role: inviteData.role,
      invited_by: profile?.id,
      token,
      expires_at: expiresAt.toISOString(),
    });

    if (error) {
      if (error.code === "23505") {
        setMessage({
          type: "error",
          text: "Este email ya tiene una invitación pendiente",
        });
      } else {
        setMessage({
          type: "error",
          text: "Error al invitar: " + error.message,
        });
      }
    } else {
      setMessage({
        type: "success",
        text: `Invitación enviada a ${inviteData.email}`,
      });
      setInviteData({ email: "", role: "employee" });
      setShowInviteModal(false);
      fetchData();
    }

    setSaving(false);
  };

  const handleCancelInvitation = async (invitationId: string) => {
    if (!confirm("¿Cancelar esta invitación?")) return;

    await supabase.from("invitations").delete().eq("id", invitationId);
    fetchData();
  };

  const handleRemoveUser = async (userId: string, userName: string) => {
    if (
      !confirm(`¿Estás seguro de eliminar a "${userName}" de la organización?`)
    )
      return;

    // En lugar de eliminar, quitamos la organization_id
    const { error } = await supabase
      .from("profiles")
      .update({ organization_id: null, role: "viewer" })
      .eq("id", userId);

    if (error) {
      setMessage({
        type: "error",
        text: "Error al eliminar usuario: " + error.message,
      });
    } else {
      setMessage({
        type: "success",
        text: "Usuario eliminado de la organización",
      });
      fetchData();
    }
  };

  const availableRoles = ASSIGNABLE_ROLES.filter((r) =>
    canAssignRole(currentRole, r),
  );

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

      {/* Message */}
      {
        message && (
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm ${message.type === "success"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800"
              : "bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
              }`}
          >
            {message.type === "success" ? (
              <CheckCircle className="h-5 w-5" />
            ) : (
              <AlertCircle className="h-5 w-5" />
            )}
            {message.text}
          </div>
        )
      }

      {/* Pending Invitations */}
      <PendingInvitations
        invitations={invitations}
        canDeleteUsers={canDelete("users")}
        onCancel={handleCancelInvitation}
      />

      {/* Users Grid */}
      <UserGrid
        users={users}
        currentUserId={profile?.id}
        currentRole={currentRole}
        loading={isLoading}
        canEdit={canEdit("users")}
        canDelete={canDelete("users")}
        onEditRole={handleEditRole}
        onRemoveUser={handleRemoveUser}
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
        onSuccess={fetchData}
      />
    </div >
  );
}
