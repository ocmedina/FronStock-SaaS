'use server';

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { Role, canAssignRole } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

interface CreateUserData {
    email: string;
    password: string;
    fullName: string;
    role: Role;
}

export async function createUser(data: CreateUserData) {
    const supabase = await createClient();
    const { data: { user: currentUser } } = await supabase.auth.getUser();

    if (!currentUser) {
        return { error: "No autorizado" };
    }

    // Get current user's role and organization
    const { data: profile } = await supabase
        .from('profiles')
        .select('role, organization_id')
        .eq('id', currentUser.id)
        .single();

    if (!profile) {
        return { error: "Perfil no encontrado" };
    }

    if (!profile.organization_id) {
        return { error: "Error de integridad: Tu usuario no pertenece a ninguna organización. Contacta a soporte." };
    }

    // Verify permissions
    if (!canAssignRole(profile.role as Role, data.role)) {
        return { error: "No tienes permisos para asignar este rol" };
    }

    const supabaseAdmin = createAdminClient();

    // 1. Create the user in Auth
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
        user_metadata: {
            full_name: data.fullName,
            role: data.role,
            organization_id: profile.organization_id,
        }
    });

    if (createError) {
        return { error: createError.message };
    }

    if (!newUser.user) {
        return { error: "Error al crear usuario" };
    }

    // 2. Upsert the profile with role and organization
    // Using upsert ensures that if the trigger hasn't run yet, we create the profile.
    // If it has run, we update it with the correct values.
    const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert({
            id: newUser.user.id,
            full_name: data.fullName,
            role: data.role,
            organization_id: profile.organization_id,
            updated_at: new Date().toISOString(),
        })
        .select()
        .single();

    if (profileError) {
        // If update failed, maybe try to insert (though triggers usually handle it)
        // But for now, let's treat it as an error but the user exists
        return { error: "Usuario creado pero hubo error al actualizar perfil: " + profileError.message };
    }

    revalidatePath('/dashboard/users');
    return { success: true, userId: newUser.user.id };
}
