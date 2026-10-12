"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { requireDeveloperAccess } from "@/lib/developer-access";

interface DeveloperOrganization {
  id: string;
  name: string;
  plan_type: string;
  created_at: string;
  cash_session_policy: string | null;
  cash_session_scope: string | null;
  require_permissions_password: boolean | null;
}

interface DeveloperPermission {
  organization_id: string;
  role: string;
  module: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

function createDeveloperClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Falta configurar el acceso administrativo de Supabase");
  }
  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function getDeveloperOrganizations() {
  const guard = await requireDeveloperAccess();
  if (!guard.allowed) return { error: guard.error };

  try {
    const admin = createDeveloperClient();
    const { data, error } = await admin
      .from("organizations")
      .select("id, name, plan_type, created_at, cash_session_policy, cash_session_scope, require_permissions_password")
      .order("name");

    if (error) return { error: error.message };
    return { organizations: (data || []) as DeveloperOrganization[] };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudieron cargar las organizaciones" };
  }
}

export async function getDeveloperOrganizationData(organizationId: string) {
  const guard = await requireDeveloperAccess();
  if (!guard.allowed) return { error: guard.error };

  try {
    const admin = createDeveloperClient();
    const { data, error } = await admin
      .from("organization_permissions")
      .select("organization_id, role, module, can_view, can_create, can_edit, can_delete")
      .eq("organization_id", organizationId)
      .order("role")
      .order("module");

    if (error) return { error: error.message };
    return { permissions: (data || []) as DeveloperPermission[] };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudieron cargar los permisos" };
  }
}

export async function updateDeveloperOrganization(input: {
  organizationId: string;
  name: string;
  planType: string;
  cashSessionPolicy: string;
  cashSessionScope: string;
  requirePermissionsPassword: boolean;
}) {
  const guard = await requireDeveloperAccess();
  if (!guard.allowed) return { error: guard.error };

  if (!input.name.trim()) return { error: "El nombre de la organización es obligatorio" };

  try {
    const admin = createDeveloperClient();
    const { error } = await admin
      .from("organizations")
      .update({
        name: input.name.trim(),
        plan_type: input.planType,
        cash_session_policy: input.cashSessionPolicy,
        cash_session_scope: input.cashSessionScope,
        require_permissions_password: input.requirePermissionsPassword,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.organizationId);

    return error ? { error: error.message } : { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo actualizar la organización" };
  }
}

export async function updateDeveloperPermission(input: DeveloperPermission) {
  const guard = await requireDeveloperAccess();
  if (!guard.allowed) return { error: guard.error };

  try {
    const admin = createDeveloperClient();
    const { error } = await admin
      .from("organization_permissions")
      .upsert(input, { onConflict: "organization_id,role,module" });

    return error ? { error: error.message } : { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo actualizar el permiso" };
  }
}
