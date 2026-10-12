'use client';

import {
    createContext,
    useContext,
    useEffect,
    useState,
    ReactNode,
    useCallback,
    useMemo,
    useRef,
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
    const supabase = useMemo(() => createClient(), []);
    const profileRef = useRef<Profile | null>(null);
    const organizationRef = useRef<Organization | null>(null);
    const isFetchingRef = useRef(false);

    useEffect(() => {
        profileRef.current = profile;
    }, [profile]);

    useEffect(() => {
        organizationRef.current = organization;
    }, [organization]);

    const fetchOrganizationData = useCallback(async () => {
        if (isFetchingRef.current) {
            return;
        }

        isFetchingRef.current = true;

        let hasCachedProfile = false;
        let hasCachedOrg = false;
        let cachedProfile: Profile | null = null;

        try {
            // Keep loading true only if we don't have cached data
            // setIsLoading(true); // Don't reset loading aggressive to avoid flicker

            setError(null);

            // 1. Obtener usuario autenticado (getUser es más estable que getSession en cliente)
            const { data: userData, error: userError } = await supabase.auth.getUser();
            let user = userData?.user ?? null;

            if (userError || !user) {
                const { data: { session } } = await supabase.auth.getSession();
                user = session?.user ?? null;
            }

            if (!user) {
                console.log('No active user found');
                setIsLoading(false);
                return;
            }
            
            // Local variables to track cache availability in this execution

            // --- CACHE LAYER START ---
            // Intenta cargar del cache local primero para UI inmediata
            try {
                const cachedProfileStr = localStorage.getItem(`profile_${user.id}`);
                if (cachedProfileStr) {
                    cachedProfile = JSON.parse(cachedProfileStr);
                    setProfile(cachedProfile);
                    hasCachedProfile = true;
                    
                    if (cachedProfile?.organization_id) {
                        const cachedOrgStr = localStorage.getItem(`org_${cachedProfile.organization_id}`);
                        if (cachedOrgStr) {
                            setOrganization(JSON.parse(cachedOrgStr));
                            hasCachedOrg = true;
                        }
                        
                        const cachedPermsStr = localStorage.getItem(`perms_${cachedProfile.organization_id}`);
                        if (cachedPermsStr) {
                            setPermissions(JSON.parse(cachedPermsStr));
                        }
                    }
                    // Mantenemos loading hasta finalizar el fetch de red para evitar
                    // decisiones de permisos con datos parciales de caché.
                }
            } catch (e) {
                console.warn('Error reading local cache:', e);
            }
            // --- CACHE LAYER END ---

            // 2. Fetch de red (Network)
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
                    throw insertError;
                }
                profileData = newProfile;
            } else if (profileError) {
                const fallbackProfile = profileRef.current || cachedProfile;

                if (fallbackProfile) {
                    console.warn('Using cached profile due to network error');
                    profileData = fallbackProfile;
                    hasCachedProfile = true;
                } else {
                    throw profileError;
                }
            }

            // Actualizar estado y caché
            setProfile(profileData);
            localStorage.setItem(`profile_${user.id}`, JSON.stringify(profileData));

            // 3. Si no tiene organization_id, redirigir a onboarding
            if (!profileData?.organization_id) {
                setIsLoading(false);
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
                  if (!hasCachedOrg && !organizationRef.current) throw orgError;
                 console.log('Using cached organization due to network error');
                 // Si tenemos caché de org, ignoramos error de red
            } else {
                setOrganization(orgData);
                localStorage.setItem(`org_${profileData.organization_id}`, JSON.stringify(orgData));
            }

            // 5. Cargar permisos personalizados
            const { data: permsData, error: permsError } = await supabase
                .from('organization_permissions')
                .select('role, module, can_view, can_create, can_edit, can_delete')
                .eq('organization_id', profileData.organization_id);

            if (permsError) {
                console.warn('Could not fetch organization permissions, using role defaults fallback:', permsError.message);
                setPermissions([]);
            } else if (permsData) {
                setPermissions(permsData);
                localStorage.setItem(`perms_${profileData.organization_id}`, JSON.stringify(permsData));
            }

        } catch (err: any) {
            // Solo mostramos error si no pudimos cargar nada (ni de caché)
            // Usamos las variables locales 'hasCached...' además del estado 'profile'/'organization'
            const hasProfile = !!profileRef.current || hasCachedProfile;
            const hasOrg = !!organizationRef.current || hasCachedOrg;
            const errorMessage =
                (typeof err?.message === 'string' && err.message.trim().length > 0)
                    ? err.message
                    : 'Error de conexión';
            const isFetchBlockedOrOffline =
                errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError');
            
            if (!hasProfile || !hasOrg) {
                console.warn('fetchOrganizationData failed without cache fallback', {
                    hasProfile,
                    hasOrg,
                    error: errorMessage,
                });
                if (isFetchBlockedOrOffline) {
                    setError('No se pudo conectar con Supabase. Verifica conexión y desactiva Request Blocking en DevTools o extensiones de bloqueo.');
                } else {
                    setError(errorMessage);
                }
            } else {
                console.warn('Network failed in fetchOrganizationData, using cached data');
            }
        } finally {
            isFetchingRef.current = false;
            setIsLoading(false);
        }
    }, [router, supabase]);

    useEffect(() => {
        const handleDeveloperPermissionUpdate = (event: Event) => {
            const organizationId = (event as CustomEvent<{ organizationId?: string }>).detail?.organizationId;
            if (organizationId && organizationId === profileRef.current?.organization_id) {
                void fetchOrganizationData();
            }
        };

        window.addEventListener('developer-permissions-updated', handleDeveloperPermissionUpdate);
        return () => window.removeEventListener('developer-permissions-updated', handleDeveloperPermissionUpdate);
    }, [fetchOrganizationData]);

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
    }, [fetchOrganizationData, router, supabase]);

    const updatePermission = async (
        role: string,
        module: string,
        updates: Partial<PermissionRecord>
    ): Promise<boolean> => {
        if (!organization?.id) return false;

        try {
            // Llamar server action que verifica permisos y registra auditoría
            const { updateRolePermission } = await import('@/actions/permissions');
            const result = await updateRolePermission({ role, module, updates });

            if (result.error) {
                console.error('Error updating permission:', result.error);
                return false;
            }
        } catch (err) {
            console.error('Error updating permission:', err);
            return false;
        }

        // Actualizar estado local optimistamente (UI inmediata)
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
