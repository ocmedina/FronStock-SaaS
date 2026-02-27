import { createAdminClient } from "@/lib/supabase/admin";
import { getPlanDetails } from "@/config/plans";

export type LimitResource = "users" | "products";

export type LimitCheckOptions = {
    includePendingInvitations?: boolean;
};

export type LimitCheckResult = {
    allowed: boolean;
    error?: string;
    currentCount: number;
    maxLimit: number;
    planName: string;
    breakdown?: {
        users: number;
        pendingInvitations: number;
    };
};

/**
 * Checks if an organization has reached its limit for a specific resource.
 * Uses the Supabase Admin Client to bypass RLS and ensure accurate counting.
 */
export async function checkOrganizationLimit(
    organizationId: string,
    resource: LimitResource,
    options: LimitCheckOptions = {}
): Promise<LimitCheckResult> {
    const supabaseAdmin = createAdminClient();
    const { includePendingInvitations = true } = options;

    // 1. Get Organization Plan
    const { data: orgData, error: orgError } = await supabaseAdmin
        .from("organizations")
        .select("plan_type")
        .eq("id", organizationId)
        .single();

    // If organization not found or error, default to free/restricted to be safe, 
    // but logically we should handle error.
    if (orgError || !orgData) {
        console.error(`Error checking plan limit for org ${organizationId}:`, orgError);
        // Fail safe: deny action if we can't verify plan
        return {
            allowed: false,
            error: "No se pudo verificar el plan de la organización. Contacte a soporte.",
            currentCount: 0,
            maxLimit: 0,
            planName: "Unknown",
        };
    }

    const planType = orgData.plan_type || "free";
    const planDetails = getPlanDetails(planType);
    const limits = planDetails.limits;

    let currentCount = 0;
    let maxLimit = 0;

    // 2. Count Usage
    if (resource === "users") {
        const { count: usersCount, error: usersError } = await supabaseAdmin
            .from("profiles")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", organizationId);

        if (usersError) {
            console.error("Error counting profiles:", usersError);
            return { allowed: false, error: "Error verificando cantidad de usuarios.", currentCount: 0, maxLimit: 0, planName: planDetails.name };
        }

        const safeUsersCount = usersCount || 0;
        let pendingInvitationsCount = 0;

        if (includePendingInvitations) {
            const { count: invitesCount, error: invitesError } = await supabaseAdmin
                .from("invitations")
                .select("id", { count: "exact", head: true })
                .eq("organization_id", organizationId)
                .eq("status", "pending");

            if (invitesError) {
                console.error("Error counting pending invitations:", invitesError);
                return {
                    allowed: false,
                    error: "Error verificando invitaciones pendientes.",
                    currentCount: 0,
                    maxLimit: 0,
                    planName: planDetails.name,
                };
            }

            pendingInvitationsCount = invitesCount || 0;
        }

        currentCount = safeUsersCount + pendingInvitationsCount;
        maxLimit = limits.maxUsers;

        const isUnlimited = maxLimit === Infinity;
        const allowed = isUnlimited || currentCount < maxLimit;

        return {
            allowed,
            currentCount,
            maxLimit: isUnlimited ? -1 : maxLimit,
            planName: planDetails.name,
            breakdown: {
                users: safeUsersCount,
                pendingInvitations: pendingInvitationsCount,
            },
            error: allowed
                ? undefined
                : `Has alcanzado el límite de usuarios para tu plan ${planDetails.name} (${currentCount}/${isUnlimited ? "Ilimitado" : maxLimit
                }). Actualiza tu plan para agregar más.`,
        };

    } else if (resource === "products") {
        // Count products linked to this organization
        const { count, error } = await supabaseAdmin
            .from("products")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", organizationId);

        if (error) {
            console.error("Error counting products:", error);
            return { allowed: false, error: "Error verificando cantidad de productos.", currentCount: 0, maxLimit: 0, planName: planDetails.name };
        }
        currentCount = count || 0;
        maxLimit = limits.maxProducts;
    }

    // 3. Evaluate
    // Handle Infinity
    const isUnlimited = maxLimit === Infinity;
    const allowed = isUnlimited || currentCount < maxLimit;

    return {
        allowed,
        currentCount,
        maxLimit: isUnlimited ? -1 : maxLimit, // -1 or generic indicator for frontend if needed, though we use boolean mainly
        planName: planDetails.name,
        error: allowed
            ? undefined
            : `Has alcanzado el límite de productos para tu plan ${planDetails.name} (${currentCount}/${isUnlimited ? "Ilimitado" : maxLimit
            }). Actualiza tu plan para agregar más.`,
    };
}
