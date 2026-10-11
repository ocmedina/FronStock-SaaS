import { toast } from "sonner";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Organization, Profile } from "@/types/database.types";

export type CashSessionPolicy = "always" | "cash_only" | "off";
export type CashSessionScope = "all_users" | "assigned_users";

export interface OpenCashSessionInfo {
  id: string;
  opened_at: string;
  opening_amount: number;
  register_id: string;
  register_name?: string;
  status: "open" | "closed";
}

export interface CashRegisterInfo {
  id: string;
  name: string;
  code: string | null;
  is_active: boolean;
}

export function normalizeCashSessionPolicy(value?: string | null): CashSessionPolicy {
  if (value === "always" || value === "cash_only" || value === "off") return value;
  return "cash_only";
}

export function normalizeCashSessionScope(value?: string | null): CashSessionScope {
  if (value === "assigned_users" || value === "all_users") return value;
  return "all_users";
}

export function paymentMethodsIncludeCash(methods?: Array<string | null | undefined>): boolean {
  if (!methods || methods.length === 0) return true;

  return methods.some((raw) => {
    const method = String(raw || "").trim().toLowerCase();
    return method === "cash" || method === "efectivo" || method === "cash_from_sales";
  });
}

export function shouldRequireOpenCashSession(options: {
  organization?: Organization | null;
  profile?: Profile | null;
  paymentMethods?: Array<string | null | undefined>;
}): boolean {
  const { organization, profile, paymentMethods } = options;
  const policy = normalizeCashSessionPolicy(organization?.cash_session_policy || null);
  const scope = normalizeCashSessionScope(organization?.cash_session_scope || null);
  const assignedUsers = Array.isArray(organization?.cash_session_assigned_user_ids)
    ? organization?.cash_session_assigned_user_ids
    : [];

  if (policy === "off") return false;

  if (scope === "assigned_users") {
    if (!profile?.id) return false;
    if (!assignedUsers.includes(profile.id)) return false;
  }

  if (policy === "always") return true;

  return paymentMethodsIncludeCash(paymentMethods);
}

export async function getOpenCashSession(
  supabase: SupabaseClient,
  organizationId?: string | null,
  registerId?: string | null,
): Promise<OpenCashSessionInfo | null> {
  if (!organizationId) return null;

  const { data, error } = await supabase
    .from("cash_sessions")
    .select("id, opened_at, opening_amount, register_id, status, cash_registers(name)")
    .eq("organization_id", organizationId)
    .eq("status", "open")
    .eq(registerId ? "register_id" : "organization_id", registerId || organizationId)
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return null;
  }

  if (!data) return null;

  const row = data as OpenCashSessionInfo & {
    cash_registers?: { name?: string } | null;
  };

  return {
    ...row,
    register_name: row.cash_registers?.name,
  };
}

export async function getOpenCashSessions(
  supabase: SupabaseClient,
  organizationId?: string | null,
): Promise<OpenCashSessionInfo[]> {
  if (!organizationId) return [];

  const { data, error } = await supabase
    .from("cash_sessions")
    .select("id, opened_at, opening_amount, register_id, status, cash_registers(name)")
    .eq("organization_id", organizationId)
    .eq("status", "open")
    .order("opened_at", { ascending: false });

  if (error) return [];

  return ((data || []) as Array<OpenCashSessionInfo & {
    cash_registers?: { name?: string } | null;
  }>).map((row) => ({
    ...row,
    register_name: row.cash_registers?.name,
  }));
}

export async function getCashRegisters(
  supabase: SupabaseClient,
  organizationId?: string | null,
): Promise<CashRegisterInfo[]> {
  if (!organizationId) return [];

  const { data, error } = await supabase
    .from("cash_registers")
    .select("id, name, code, is_active")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) return [];
  return (data || []) as CashRegisterInfo[];
}

export async function ensureOpenCashSession(
  supabase: SupabaseClient,
  organizationId?: string | null,
  options?: { silent?: boolean },
): Promise<boolean> {
  const session = await getOpenCashSession(supabase, organizationId);

  if (!session && !options?.silent) {
    toast.error("Debes abrir caja antes de operar");
  }

  return !!session;
}
