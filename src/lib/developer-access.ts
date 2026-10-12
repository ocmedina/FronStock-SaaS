import { createClient } from "@/lib/supabase/server";

export async function requireDeveloperAccess() {
  const configuredDeveloperId = process.env.DEVELOPER_USER_ID?.trim();
  if (!configuredDeveloperId) {
    return { allowed: false as const, error: "Panel de desarrollador no configurado" };
  }

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user || user.id !== configuredDeveloperId) {
    return { allowed: false as const, error: "No autorizado" };
  }

  return { allowed: true as const, userId: user.id };
}
