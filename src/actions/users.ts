'use server';

import { createAdminClient } from "@/lib/supabase/admin";
import { requireOrganizationPermission } from "@/actions/_permissions";
import { Role, canAssignRole } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/actions/audit";

interface CreateUserData {
    email: string;
    password: string;
    fullName: string;
    role: Role;
}

export async function createUser(data: CreateUserData) {
    // Usar el guard centralizado para verificar permiso de crear usuarios
    const guard = await requireOrganizationPermission('users', 'create');
    if (!guard.allowed || !guard.organizationId || !guard.userId || !guard.role) {
        return { error: guard.error || 'No autorizado' };
    }

    // Verificar que el rol actual puede asignar el rol pedido (jerarquía)
    if (!canAssignRole(guard.role, data.role)) {
        return { error: "No tienes permisos para asignar este rol" };
    }

    // --- VERIFICAR LÍMITE DE PLAN ---
    const { checkOrganizationLimit } = await import('@/lib/plans/limits');
    const limitCheck = await checkOrganizationLimit(guard.organizationId, 'users');
    if (!limitCheck.allowed) {
        return { error: limitCheck.error };
    }
    // --------------------------------

    const supabaseAdmin = createAdminClient();

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
        user_metadata: {
            full_name: data.fullName,
            role: data.role,
            organization_id: guard.organizationId,
        }
    });

    if (createError) {
        return { error: createError.message };
    }

    if (!newUser.user) {
        return { error: "Error al crear usuario" };
    }

    const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert({
            id: newUser.user.id,
            full_name: data.fullName,
            role: data.role,
            organization_id: guard.organizationId,
            updated_at: new Date().toISOString(),
        })
        .select()
        .single();

    if (profileError) {
        return { error: "Usuario creado pero hubo error al actualizar perfil: " + profileError.message };
    }

    revalidatePath('/dashboard/users');

    await logAuditEvent({
        organizationId: guard.organizationId,
        action: 'custom',
        entity: 'users',
        entityId: newUser.user.id,
        metadata: {
            event: 'user_created',
            role: data.role,
            email: data.email,
            created_by_role: guard.role,
        },
    });

    return { success: true, userId: newUser.user.id };
}

export async function deleteUser(userId: string) {
    // El guard ya verifica auth, perfil y permisos del módulo 'users' → 'delete'
    const guard = await requireOrganizationPermission('users', 'delete');
    if (!guard.allowed || !guard.organizationId || !guard.userId) {
        return { error: guard.error || 'No autorizado' };
    }

    const supabaseAdmin = createAdminClient();

    // Verificar que el usuario objetivo pertenece a la misma organización
    const { data: targetProfile } = await supabaseAdmin
        .from('profiles')
        .select('organization_id, role')
        .eq('id', userId)
        .single();

    if (!targetProfile) return { error: "Usuario a eliminar no encontrado" };

    if (targetProfile.organization_id !== guard.organizationId) {
        return { error: "No puedes eliminar usuarios de otra organización" };
    }

    // Prevenir auto-eliminación
    if (userId === guard.userId) {
        return { error: "No puedes eliminar tu propio usuario" };
    }

    // Solo owner puede eliminar a otro owner
    if (targetProfile.role === 'owner' && guard.role !== 'owner') {
        return { error: "Solo un propietario puede eliminar a otro propietario" };
    }

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteError) {
        return { error: "Error al eliminar usuario del sistema: " + deleteError.message };
    }

    revalidatePath('/dashboard/users');

    await logAuditEvent({
        organizationId: guard.organizationId,
        action: 'custom',
        entity: 'users',
        entityId: userId,
        metadata: {
            event: 'user_deleted',
            deleted_role: targetProfile.role,
            deleted_by_role: guard.role,
        },
    });

    return { success: true };
}
