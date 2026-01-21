'use client';

import {
    createContext,
    useContext,
    useEffect,
    useState,
    ReactNode,
    useCallback,
} from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Organization, Profile } from '@/types/database.types';

interface PermissionRecord {
    role: string;
    module: string;
    can_view: boolean;
    can_create: boolean;
    can_edit: boolean;
    can_delete: boolean;
}

interface OrganizationContextType {
    organization: Organization | null;
    organizationId: string | null;
    profile: Profile | null;
    permissions: PermissionRecord[];
    isLoading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
    updatePermission: (role: string, module: string, updates: Partial<PermissionRecord>) => Promise<boolean>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

interface OrganizationProviderProps {
    children: ReactNode;
}

export function OrganizationProvider({ children }: OrganizationProviderProps) {
    const [organization, setOrganization] = useState<Organization | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [permissions, setPermissions] = useState<PermissionRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    const supabase = createClient();

    const fetchOrganizationData = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            // 1. Obtener usuario autenticado
            const { data: { user }, error: authError } = await supabase.auth.getUser();

            if (authError || !user) {
                router.push('/login');
                return;
            }

            // 2. Obtener o crear perfil del usuario
            let { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            // Si no existe el perfil, intentar crearlo
            if (profileError && profileError.code === 'PGRST116') {
                console.log('Profile not found, creating one...');

                const { data: newProfile, error: insertError } = await supabase
                    .from('profiles')
                    .insert({
                        id: user.id,
                        full_name: user.user_metadata?.full_name || '',
                        role: 'admin',
                    })
                    .select()
                    .single();

                if (insertError) {
                    console.error('Error creating profile:', insertError);
                    setError('Error al crear el perfil: ' + insertError.message);
                    return;
                }

                profileData = newProfile;
            } else if (profileError) {
                console.error('Error fetching profile:', profileError);
                setError('Error al cargar el perfil: ' + profileError.message);
                return;
            }

            setProfile(profileData);

            // 3. Si no tiene organization_id, redirigir a onboarding
            if (!profileData?.organization_id) {
                router.push('/onboarding');
                return;
            }

            // 4. Obtener datos de la organización
            const { data: orgData, error: orgError } = await supabase
                .from('organizations')
                .select('*')
                .eq('id', profileData.organization_id)
                .single();

            if (orgError) {
                console.error('Error fetching organization:', orgError);
                setError('Error al cargar la organización: ' + orgError.message);
                return;
            }

            setOrganization(orgData);

            // 5. Cargar permisos personalizados de la organización
            const { data: permsData } = await supabase
                .from('organization_permissions')
                .select('role, module, can_view, can_create, can_edit, can_delete')
                .eq('organization_id', profileData.organization_id);

            if (permsData && permsData.length > 0) {
                setPermissions(permsData);
            }

        } catch (err) {
            console.error('Unexpected error:', err);
            setError('Error inesperado');
        } finally {
            setIsLoading(false);
        }
    }, [router, supabase]);

    useEffect(() => {
        fetchOrganizationData();

        // Escuchar cambios de autenticación
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event) => {
                if (event === 'SIGNED_OUT') {
                    setOrganization(null);
                    setProfile(null);
                    setPermissions([]);
                    router.push('/login');
                } else if (event === 'SIGNED_IN') {
                    fetchOrganizationData();
                }
            }
        );

        return () => {
            subscription.unsubscribe();
        };
    }, [fetchOrganizationData, router, supabase.auth]);

    const updatePermission = async (
        role: string,
        module: string,
        updates: Partial<PermissionRecord>
    ): Promise<boolean> => {
        if (!organization?.id) return false;

        // Verificar si existe el registro
        const existing = permissions.find((p) => p.role === role && p.module === module);

        if (existing) {
            // Actualizar
            const { error: updateError } = await supabase
                .from('organization_permissions')
                .update({
                    ...updates,
                    updated_at: new Date().toISOString(),
                })
                .eq('organization_id', organization.id)
                .eq('role', role)
                .eq('module', module);

            if (updateError) {
                console.error('Error updating permission:', updateError);
                return false;
            }
        } else {
            // Insertar nuevo
            const { error: insertError } = await supabase
                .from('organization_permissions')
                .insert({
                    organization_id: organization.id,
                    role,
                    module,
                    can_view: updates.can_view ?? false,
                    can_create: updates.can_create ?? false,
                    can_edit: updates.can_edit ?? false,
                    can_delete: updates.can_delete ?? false,
                });

            if (insertError) {
                console.error('Error inserting permission:', insertError);
                return false;
            }
        }

        // Actualizar estado local
        setPermissions((prev) => {
            const idx = prev.findIndex((p) => p.role === role && p.module === module);
            if (idx >= 0) {
                const updated = [...prev];
                updated[idx] = { ...updated[idx], ...updates };
                return updated;
            } else {
                return [
                    ...prev,
                    {
                        role,
                        module,
                        can_view: updates.can_view ?? false,
                        can_create: updates.can_create ?? false,
                        can_edit: updates.can_edit ?? false,
                        can_delete: updates.can_delete ?? false,
                    },
                ];
            }
        });

        return true;
    };

    const value: OrganizationContextType = {
        organization,
        organizationId: organization?.id ?? null,
        profile,
        permissions,
        isLoading,
        error,
        refetch: fetchOrganizationData,
        updatePermission,
    };

    return (
        <OrganizationContext.Provider value={value}>
            {children}
        </OrganizationContext.Provider>
    );
}

export function useOrganization() {
    const context = useContext(OrganizationContext);
    if (context === undefined) {
        throw new Error('useOrganization must be used within an OrganizationProvider');
    }
    return context;
}
