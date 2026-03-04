import { toast } from "sonner";

export interface OpenCashSessionInfo {
  id: string;
  opened_at: string;
  opening_amount: number;
  register_id: string;
  status: "open" | "closed";
}

export async function getOpenCashSession(
  supabase: any,
  organizationId?: string | null,
): Promise<OpenCashSessionInfo | null> {
  if (!organizationId) return null;

  const { data, error } = await supabase
    .from("cash_sessions")
    .select("id, opened_at, opening_amount, register_id, status")
    .eq("organization_id", organizationId)
    .eq("status", "open")
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return null;
  }

  return (data as OpenCashSessionInfo | null) || null;
}

export async function ensureOpenCashSession(
  supabase: any,
  organizationId?: string | null,
  options?: { silent?: boolean },
): Promise<boolean> {
  const session = await getOpenCashSession(supabase, organizationId);

  if (!session && !options?.silent) {
    toast.error("Debes abrir caja antes de operar");
  }

  return !!session;
}
