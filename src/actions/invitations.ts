'use server';

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { canAssignRole, type Role } from "@/lib/permissions";
import { checkOrganizationLimit } from "@/lib/plans/limits";

type InviteUserData = {
  email: string;
  role: Role;
};

type AcceptInvitationData = {
  token: string;
  userId: string;
  fullName: string;
};

export async function createInvitation(data: InviteUserData) {
  const supabase = await createClient();
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  if (!currentUser) {
    return { error: "No autorizado" };
  }

  const normalizedEmail = String(data.email || "").trim().toLowerCase();
  if (!normalizedEmail) {
    return { error: "Email inválido" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, organization_id")
    .eq("id", currentUser.id)
    .single();

  if (!profile?.organization_id) {
    return { error: "Perfil u organización no encontrada" };
  }

  if (!canAssignRole(profile.role as Role, data.role)) {
    return { error: "No tienes permisos para invitar con ese rol" };
  }

  const limitCheck = await checkOrganizationLimit(profile.organization_id, "users", {
    includePendingInvitations: true,
  });

  if (!limitCheck.allowed) {
    return { error: limitCheck.error || "Límite de usuarios alcanzado" };
  }

  const supabaseAdmin = createAdminClient();

  const { data: existingInvitation, error: existingError } = await supabaseAdmin
    .from("invitations")
    .select("id, status")
    .eq("organization_id", profile.organization_id)
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (existingError) {
    return { error: "No se pudo validar invitaciones previas" };
  }

  if (existingInvitation?.status === "pending") {
    return { error: "Este email ya tiene una invitación pendiente" };
  }

  const token = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  if (existingInvitation?.id) {
    const { error: updateError } = await supabaseAdmin
      .from("invitations")
      .update({
        role: data.role,
        invited_by: currentUser.id,
        status: "pending",
        token,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString(),
      })
      .eq("id", existingInvitation.id);

    if (updateError) {
      return { error: updateError.message || "No se pudo actualizar la invitación" };
    }
  } else {
    const { error: insertError } = await supabaseAdmin.from("invitations").insert({
      organization_id: profile.organization_id,
      email: normalizedEmail,
      role: data.role,
      invited_by: currentUser.id,
      status: "pending",
      token,
      expires_at: expiresAt.toISOString(),
    });

    if (insertError) {
      return { error: insertError.message || "No se pudo crear la invitación" };
    }
  }

  revalidatePath("/dashboard/users");
  return { success: true };
}

export async function acceptInvitationForRegisteredUser(data: AcceptInvitationData) {
  const token = String(data.token || "").trim();
  const userId = String(data.userId || "").trim();
  const fullName = String(data.fullName || "").trim();

  if (!token || !userId || !fullName) {
    return { error: "Datos incompletos para aceptar invitación" };
  }

  const supabaseAdmin = createAdminClient();

  const rpcResult = await supabaseAdmin.rpc("accept_invitation_with_plan_check", {
    p_token: token,
    p_user_id: userId,
    p_full_name: fullName,
  });

  if (!rpcResult.error) {
    const dataResult = rpcResult.data as any;
    if (dataResult?.success === false) {
      return { error: dataResult.error || "No se pudo aceptar la invitación" };
    }

    revalidatePath("/dashboard/users");
    return { success: true };
  }

  const rpcErrorMessage = String(rpcResult.error?.message || "").toLowerCase();
  const rpcNotFound = rpcErrorMessage.includes("function") && rpcErrorMessage.includes("does not exist");

  if (!rpcNotFound) {
    return { error: rpcResult.error.message || "No se pudo aceptar la invitación" };
  }

  const { data: invitation, error: invitationError } = await supabaseAdmin
    .from("invitations")
    .select("id, email, role, organization_id, expires_at, status")
    .eq("token", token)
    .eq("status", "pending")
    .maybeSingle();

  if (invitationError || !invitation) {
    return { error: "Invitación inválida o ya utilizada" };
  }

  if (new Date(invitation.expires_at) <= new Date()) {
    return { error: "La invitación expiró" };
  }

  const { data: authUserData, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (authUserError || !authUserData?.user?.email) {
    return { error: "No se pudo validar el usuario registrado" };
  }

  if (authUserData.user.email.toLowerCase() !== String(invitation.email || "").toLowerCase()) {
    return { error: "El email registrado no coincide con la invitación" };
  }

  const limitCheck = await checkOrganizationLimit(invitation.organization_id, "users", {
    includePendingInvitations: true,
  });

  if (limitCheck.maxLimit !== -1) {
    const usersCount = limitCheck.breakdown?.users || 0;
    const pendingCount = limitCheck.breakdown?.pendingInvitations || 0;
    const seatsAfterAccept = usersCount + Math.max(0, pendingCount - 1);

    if (seatsAfterAccept >= limitCheck.maxLimit) {
      return {
        error:
          "No hay cupos disponibles en el plan actual para aceptar esta invitación. Libera un cupo o actualiza el plan.",
      };
    }
  }

  const { error: upsertError } = await supabaseAdmin.from("profiles").upsert({
    id: userId,
    full_name: fullName,
    organization_id: invitation.organization_id,
    role: invitation.role,
    updated_at: new Date().toISOString(),
  });

  if (upsertError) {
    return { error: "No se pudo asociar el usuario a la organización" };
  }

  const { error: invitationUpdateError } = await supabaseAdmin
    .from("invitations")
    .update({ status: "accepted" })
    .eq("id", invitation.id)
    .eq("status", "pending");

  if (invitationUpdateError) {
    return { error: invitationUpdateError.message || "No se pudo cerrar la invitación" };
  }

  revalidatePath("/dashboard/users");
  return { success: true };
}
