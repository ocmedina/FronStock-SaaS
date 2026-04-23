'use client';

import { useOrganization } from '@/contexts/OrganizationContext';
import { useLayout } from '@/contexts/LayoutContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useAppearance } from '@/contexts/AppearanceContext';
import { createClient } from '@/lib/supabase/client';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Building2,
    User,
    LogOut,
    Save,
    Loader2,
    PanelLeft,
    PanelTop,
    Check,
    Palette,
    Shield,
    Settings,
    CreditCard,
    Database,
    Monitor,
    Type,
    Minimize2,
    Maximize2,
    Clock3,
    Laptop,
    BellRing,
} from 'lucide-react';
import { PlansClientWrapper } from './plans/PlansClientWrapper';
import { OrganizationSettingsForm } from '@/components/settings/OrganizationSettingsForm';
import { OfflineDebugPanel } from '@/components/OfflineDebugPanel';
import { LegacyImportPanel } from '@/components/settings/LegacyImportPanel';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { clearOfflineOrganizationData } from '@/lib/offline/db';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type CashSessionPolicy = 'always' | 'cash_only' | 'off';
type CashSessionScope = 'all_users' | 'assigned_users';

interface SecurityUserOption {
    id: string;
    full_name: string | null;
    role: string | null;
}

export default function SettingsPage() {
    const { organization, profile, refetch } = useOrganization();
    const { layoutMode, setLayoutMode } = useLayout();
    const { theme, setTheme } = useTheme();
    const {
        density,
        setDensity,
        fontSize,
        setFontSize,
        sidebarDefaultCollapsed,
        setSidebarDefaultCollapsed,
    } = useAppearance();

    // Organization State
    const [orgName, setOrgName] = useState('');
    const [savingOrg, setSavingOrg] = useState(false);

    // Profile State
    const [profileName, setProfileName] = useState('');
    const [savingProfile, setSavingProfile] = useState(false);

    // Status State
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState<number>(60);
    const [closingOtherSessions, setClosingOtherSessions] = useState(false);
    const [notifyNewDevice, setNotifyNewDevice] = useState(false);
    const [accessHistory, setAccessHistory] = useState<Array<{ at: string; device: string }>>([]);
    const [askOpenCashOnLogin, setAskOpenCashOnLogin] = useState(true);
    const [cashSessionPolicy, setCashSessionPolicy] = useState<CashSessionPolicy>('cash_only');
    const [cashSessionScope, setCashSessionScope] = useState<CashSessionScope>('all_users');
    const [cashSessionAssignedUserIds, setCashSessionAssignedUserIds] = useState<string[]>([]);
    const [securityUsers, setSecurityUsers] = useState<SecurityUserOption[]>([]);
    const [savingCashSessionPolicy, setSavingCashSessionPolicy] = useState(false);
    const [showResetOrgDialog, setShowResetOrgDialog] = useState(false);
    const [resetOrgConfirmText, setResetOrgConfirmText] = useState('');
    const [resettingOrgData, setResettingOrgData] = useState(false);
    const [showResetOrgSuccessModal, setShowResetOrgSuccessModal] = useState(false);
    const [requirePermissionsPassword, setRequirePermissionsPassword] = useState(false);
    const [permissionsPassword, setPermissionsPassword] = useState('');
    const [savingPermissionsPassword, setSavingPermissionsPassword] = useState(false);

    // Delete Account State
    const [showDeleteAccountDialog, setShowDeleteAccountDialog] = useState(false);
    const [deleteAccountConfirmText, setDeleteAccountConfirmText] = useState('');
    const [deletingAccount, setDeletingAccount] = useState(false);

    const saveSecurityPreferences = async (payload: {
        sessionTimeoutMinutes: number;
        notifyNewDevice: boolean;
        accessHistory: Array<{ at: string; device: string }>;
    }) => {
        if (!profile?.id || !profile.organization_id) {
            return;
        }

        const { error } = await supabase
            .from('user_security_preferences')
            .upsert(
                {
                    user_id: profile.id,
                    organization_id: profile.organization_id,
                    session_timeout_minutes: payload.sessionTimeoutMinutes,
                    notify_new_device: payload.notifyNewDevice,
                    access_history: payload.accessHistory,
                },
                {
                    onConflict: 'user_id,organization_id',
                }
            );

        if (error) {
            throw error;
        }
    };

    const supabase = createClient();

    useEffect(() => {
        if (organization?.name) {
            setOrgName(organization.name);
        }
        setCashSessionPolicy((organization?.cash_session_policy as CashSessionPolicy) || 'cash_only');
        setCashSessionScope((organization?.cash_session_scope as CashSessionScope) || 'all_users');
        setCashSessionAssignedUserIds(
            Array.isArray(organization?.cash_session_assigned_user_ids)
                ? organization.cash_session_assigned_user_ids
                : []
        );
        setRequirePermissionsPassword(organization?.require_permissions_password || false);
        setPermissionsPassword(organization?.permissions_password || '');
        if (profile?.full_name) {
            setProfileName(profile.full_name);
        }

        const loadSecurityPreferences = async () => {
            if (!profile?.id || !profile.organization_id) {
                return;
            }

            const timeoutRaw = localStorage.getItem('security-session-timeout-minutes');
            const timeoutParsed = Number(timeoutRaw);
            const localTimeout = Number.isFinite(timeoutParsed) && timeoutParsed >= 5 ? timeoutParsed : 60;

            const localNotify = localStorage.getItem('security-notify-new-device') === 'true';

            const historyRaw = localStorage.getItem('security-access-history');
            const historyParsed = historyRaw ? JSON.parse(historyRaw) : [];
            const localHistory = Array.isArray(historyParsed) ? historyParsed : [];

            const { data, error } = await supabase
                .from('user_security_preferences')
                .select('session_timeout_minutes, notify_new_device, access_history')
                .eq('user_id', profile.id)
                .eq('organization_id', profile.organization_id)
                .maybeSingle();

            if (error) {
                setMessage({ type: 'error', text: `No se pudieron cargar preferencias de seguridad: ${error.message}` });
                return;
            }

            const dbTimeout = typeof data?.session_timeout_minutes === 'number' ? data.session_timeout_minutes : localTimeout;
            const dbNotify = typeof data?.notify_new_device === 'boolean' ? data.notify_new_device : localNotify;
            const dbHistory = Array.isArray(data?.access_history) ? data.access_history : localHistory;

            const currentDevice = `${navigator.platform || 'Desktop'} · ${navigator.language || 'es-AR'}`;
            const nowIso = new Date().toISOString();

            const shouldAppendCurrent =
                dbHistory.length === 0 ||
                typeof dbHistory[0]?.at !== 'string' ||
                (Date.now() - new Date(dbHistory[0].at).getTime() > 30 * 60 * 1000);

            const nextHistory = shouldAppendCurrent
                ? [{ at: nowIso, device: currentDevice }, ...dbHistory].slice(0, 10)
                : dbHistory.slice(0, 10);

            setSessionTimeoutMinutes(dbTimeout);
            setNotifyNewDevice(dbNotify);
            setAccessHistory(nextHistory);

            localStorage.setItem('security-session-timeout-minutes', String(dbTimeout));
            localStorage.setItem('security-notify-new-device', String(dbNotify));
            localStorage.setItem('security-access-history', JSON.stringify(nextHistory));

            const cashPromptRaw = localStorage.getItem(`cash-session-startup-prompt-enabled:${profile.organization_id}`);
            const cashPromptEnabled = cashPromptRaw === null ? true : cashPromptRaw === 'true';
            setAskOpenCashOnLogin(cashPromptEnabled);

            window.dispatchEvent(new Event('security-timeout-changed'));

            if (!data || shouldAppendCurrent) {
                await saveSecurityPreferences({
                    sessionTimeoutMinutes: dbTimeout,
                    notifyNewDevice: dbNotify,
                    accessHistory: nextHistory,
                });
            }
        };

        loadSecurityPreferences().catch((err: unknown) => {
            const message = err instanceof Error ? err.message : String(err);
            setMessage({ type: 'error', text: `No se pudo sincronizar seguridad: ${message}` });
        });
    }, [organization, profile]);

    useEffect(() => {
        const loadOrganizationUsers = async () => {
            if (!profile?.organization_id) {
                setSecurityUsers([]);
                return;
            }

            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, role')
                .eq('organization_id', profile.organization_id)
                .order('full_name', { ascending: true });

            if (error) {
                setMessage({ type: 'error', text: `No se pudo cargar usuarios para política de caja: ${error.message}` });
                return;
            }

            setSecurityUsers((data || []) as SecurityUserOption[]);
        };

        loadOrganizationUsers().catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err);
            setMessage({ type: 'error', text: `No se pudo cargar usuarios para política de caja: ${msg}` });
        });
    }, [profile?.organization_id]);

    const handleSessionTimeoutChange = async (minutes: number) => {
        setSessionTimeoutMinutes(minutes);
        localStorage.setItem('security-session-timeout-minutes', String(minutes));
        window.dispatchEvent(new Event('security-timeout-changed'));
        try {
            await saveSecurityPreferences({
                sessionTimeoutMinutes: minutes,
                notifyNewDevice,
                accessHistory,
            });
            setMessage({ type: 'success', text: `Timeout de sesión sincronizado a ${minutes} minutos` });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            setMessage({ type: 'error', text: `No se pudo sincronizar timeout: ${message}` });
        }
    };

    const handleNotifyNewDeviceChange = async (enabled: boolean) => {
        setNotifyNewDevice(enabled);
        localStorage.setItem('security-notify-new-device', String(enabled));
        try {
            await saveSecurityPreferences({
                sessionTimeoutMinutes,
                notifyNewDevice: enabled,
                accessHistory,
            });
            setMessage({
                type: 'success',
                text: enabled
                    ? 'Alertas de nuevo dispositivo activadas y sincronizadas'
                    : 'Alertas de nuevo dispositivo desactivadas y sincronizadas',
            });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            setMessage({ type: 'error', text: `No se pudo sincronizar alerta: ${message}` });
        }
    };

    const handleCloseOtherSessions = async () => {
        setClosingOtherSessions(true);
        setMessage(null);

        const { error } = await supabase.auth.signOut({ scope: 'others' });

        if (error) {
            setMessage({ type: 'error', text: `No se pudieron cerrar otras sesiones: ${error.message}` });
        } else {
            setMessage({ type: 'success', text: 'Se cerraron las demás sesiones activas' });
        }

        setClosingOtherSessions(false);
    };

    const handleAskOpenCashOnLoginChange = (enabled: boolean) => {
        setAskOpenCashOnLogin(enabled);

        if (profile?.organization_id) {
            localStorage.setItem(`cash-session-startup-prompt-enabled:${profile.organization_id}`, String(enabled));
        }

        setMessage({
            type: 'success',
            text: enabled
                ? 'Se activó la sugerencia para abrir caja al iniciar sesión'
                : 'Se desactivó la sugerencia para abrir caja al iniciar sesión',
        });
    };

    const handleToggleCashSessionAssignedUser = (userId: string, checked: boolean) => {
        setCashSessionAssignedUserIds((prev) => {
            if (checked) {
                if (prev.includes(userId)) return prev;
                return [...prev, userId];
            }
            return prev.filter((id) => id !== userId);
        });
    };

    const handleSaveCashSessionPolicy = async () => {
        if (!organization?.id) return;

        setSavingCashSessionPolicy(true);
        setMessage(null);

        try {
            const { error } = await supabase
                .from('organizations')
                .update({
                    cash_session_policy: cashSessionPolicy,
                    cash_session_scope: cashSessionScope,
                    cash_session_assigned_user_ids:
                        cashSessionScope === 'assigned_users' ? cashSessionAssignedUserIds : [],
                })
                .eq('id', organization.id);

            if (error) throw error;

            setMessage({ type: 'success', text: 'Política de caja guardada correctamente' });
            await refetch();
        } catch (error: any) {
            setMessage({
                type: 'error',
                text: error?.message || 'No se pudo guardar la política de caja',
            });
        } finally {
            setSavingCashSessionPolicy(false);
        }
    };

    const handleResetOrganizationData = async () => {
        if (!organization?.name) return;

        setResettingOrgData(true);
        setMessage(null);

        try {
            const { resetOrganizationData } = await import('@/actions/organization');
            const result = await resetOrganizationData(resetOrgConfirmText);

            if (result.error) {
                setMessage({ type: 'error', text: result.error });
                return;
            }

            if (profile?.organization_id) {
                await clearOfflineOrganizationData(profile.organization_id);
            }

            setMessage({
                type: 'success',
                text: 'Datos operativos y caché offline eliminados. Tu organización quedó lista para empezar desde cero.',
            });

            setShowResetOrgDialog(false);
            setShowResetOrgSuccessModal(true);
            setResetOrgConfirmText('');
            refetch();
        } catch (error: any) {
            setMessage({
                type: 'error',
                text: error?.message || 'No se pudieron borrar los datos de la organización',
            });
        } finally {
            setResettingOrgData(false);
        }
    };

    const handleSavePermissionsPassword = async () => {
        if (!organization?.id) return;
        setSavingPermissionsPassword(true);
        setMessage(null);
        try {
            const { error } = await supabase
                .from('organizations')
                .update({
                    require_permissions_password: requirePermissionsPassword,
                    permissions_password: permissionsPassword,
                })
                .eq('id', organization.id);
            if (error) throw error;
            setMessage({ type: 'success', text: 'Configuración de seguridad de permisos guardada correctamente.' });
            await refetch();
        } catch (error: any) {
            setMessage({ type: 'error', text: `Error al guardar: ${error.message}` });
        } finally {
            setSavingPermissionsPassword(false);
        }
    };

    const handleSaveOrg = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!organization) return;

        setSavingOrg(true);
        setMessage(null);

        const { error } = await supabase
            .from('organizations')
            .update({ name: orgName })
            .eq('id', organization.id);

        if (error) {
            setMessage({ type: 'error', text: 'Error al bloquear organización: ' + error.message });
        } else {
            setMessage({ type: 'success', text: 'Organización actualizada correctamente' });
            refetch();
        }

        setSavingOrg(false);
    };

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile) return;

        setSavingProfile(true);
        setMessage(null);

        const { error } = await supabase
            .from('profiles')
            .update({ full_name: profileName })
            .eq('id', profile.id);

        if (error) {
            setMessage({ type: 'error', text: 'Error al actualizar perfil: ' + error.message });
        } else {
            setMessage({ type: 'success', text: 'Perfil actualizado correctamente' });
            refetch();
        }

        setSavingProfile(false);
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.href = '/login';
    };

    const handleDeleteAccountAndOrganization = async () => {
        const confirmText = deleteAccountConfirmText.trim().toUpperCase();
        
        if (confirmText !== 'ELIMINAR DEFINITIVAMENTE') return;

        if (!organization?.name) {
            setMessage({ type: 'error', text: 'Error: No se pudo cargar el nombre de tu organización. Intenta recargar la página.' });
            return;
        }

        setDeletingAccount(true);
        setMessage(null);

        try {
            const { deleteAccountAndOrganization } = await import('@/actions/organization');
            const result = await deleteAccountAndOrganization(deleteAccountConfirmText);

            if (result.error) {
                setShowDeleteAccountDialog(false);
                setMessage({ type: 'error', text: result.error });
                setDeletingAccount(false);
                return;
            }

            if (profile?.organization_id) {
                await clearOfflineOrganizationData(profile.organization_id);
            }

            // Successfully deleted, log out and redirect
            setShowDeleteAccountDialog(false);
            await supabase.auth.signOut();
            window.location.href = '/login?status=account_deleted';
        } catch (error: any) {
            setShowDeleteAccountDialog(false);
            setMessage({
                type: 'error',
                text: error?.message || 'Error crítico durante la eliminación',
            });
            setDeletingAccount(false);
        }
    };

    return (
        <div className="space-y-6 max-w-6xl mx-auto pb-10 px-2 sm:px-0">
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Configuración</h1>
                <p className="text-sm sm:text-base text-muted-foreground mt-1">
                    Administra tus preferencias personales y de la organización.
                </p>
            </div>

            {message && (
                <div className={`px-4 py-3 rounded-lg text-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-2 ${message.type === 'success'
                    ? 'bg-green-500/10 text-green-600 border border-green-500/20'
                    : 'bg-red-500/10 text-red-600 border border-red-500/20'
                    }`}>
                    {message.type === 'success' ? <Check className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                    {message.text}
                </div>
            )}

            <Tabs defaultValue="general" className="w-full">
                <TabsList className="mb-6 w-full justify-start overflow-x-auto whitespace-nowrap gap-1 h-auto p-1">
                    <TabsTrigger value="general" className="gap-2 shrink-0">
                        <Building2 className="h-4 w-4" />
                        <span className="hidden sm:inline">General</span>
                        <span className="sm:hidden">Gral.</span>
                    </TabsTrigger>
                    <TabsTrigger value="appearance" className="gap-2 shrink-0">
                        <Palette className="h-4 w-4" />
                        <span className="hidden sm:inline">Apariencia</span>
                        <span className="sm:hidden">UI</span>
                    </TabsTrigger>
                    <TabsTrigger value="account" className="gap-2 shrink-0">
                        <User className="h-4 w-4" />
                        Cuenta
                    </TabsTrigger>
                    <TabsTrigger value="security" className="gap-2 shrink-0">
                        <Shield className="h-4 w-4" />
                        Seguridad
                    </TabsTrigger>
                    <TabsTrigger value="plans" className="gap-2 shrink-0">
                        <CreditCard className="h-4 w-4" />
                        Planes
                    </TabsTrigger>
                    <TabsTrigger value="offline" className="gap-2 shrink-0">
                        <Database className="h-4 w-4" />
                        <span className="hidden sm:inline">Sistema Offline</span>
                        <span className="sm:hidden">Offline</span>
                    </TabsTrigger>
                    <TabsTrigger value="import" className="gap-2 shrink-0">
                        <Database className="h-4 w-4" />
                        Importación
                    </TabsTrigger>
                </TabsList>

                {/* General Settings */}
                <TabsContent value="general" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Perfil de la Organización</CardTitle>
                            <CardDescription>
                                Actualiza los detalles de tu organización y verifica tu plan actual.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <OrganizationSettingsForm />
                        </CardContent>
                    </Card>
                    {/* Danger Zone */}
                    {(profile?.role === 'owner' || profile?.role === 'admin') && (
                        <Card className="border-red-500/20 bg-red-500/5 mt-8">
                            <CardHeader>
                                <CardTitle className="text-red-600 flex items-center gap-2">
                                    <Shield className="h-5 w-5" />
                                    Zona de Peligro
                                </CardTitle>
                                <CardDescription>
                                    Acciones destructivas para tu organización. Estas acciones son irreversibles.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 border border-red-500/20 rounded-lg bg-background/50">
                                    <div>
                                        <h4 className="font-semibold text-sm">Eliminar Organización y Cuenta</h4>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            Elimina de forma permanente la organización, todos los datos operativos y todos los usuarios asociados.
                                        </p>
                                    </div>
                                    <Button 
                                        variant="destructive" 
                                        onClick={() => setShowDeleteAccountDialog(true)}
                                        className="shrink-0 w-full sm:w-auto"
                                    >
                                        Eliminar Definitivamente
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                {/* Appearance Settings */}
                <TabsContent value="appearance" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Personalización de la Interfaz</CardTitle>
                            <CardDescription>
                                Elige cómo quieres navegar por la aplicación.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium mb-4">
                                    Tema
                                </label>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <Button
                                        type="button"
                                        variant={theme === 'light' ? 'default' : 'outline'}
                                        className="justify-start gap-2"
                                        onClick={() => setTheme('light')}
                                    >
                                        <Palette className="h-4 w-4" />
                                        Claro
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={theme === 'dark' ? 'default' : 'outline'}
                                        className="justify-start gap-2"
                                        onClick={() => setTheme('dark')}
                                    >
                                        <Shield className="h-4 w-4" />
                                        Oscuro
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={theme === 'system' ? 'default' : 'outline'}
                                        className="justify-start gap-2"
                                        onClick={() => setTheme('system')}
                                    >
                                        <Monitor className="h-4 w-4" />
                                        Sistema
                                    </Button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-4">
                                    Estilo de Navegación
                                </label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Sidebar Option */}
                                    <button
                                        onClick={() => setLayoutMode('sidebar')}
                                        className={`group relative p-4 rounded-xl border-2 transition-all hover:border-primary/50 text-left ${layoutMode === 'sidebar'
                                            ? 'border-primary bg-primary/5 shadow-sm'
                                            : 'border-muted hover:bg-muted/50'
                                            }`}
                                    >
                                        {layoutMode === 'sidebar' && (
                                            <div className="absolute top-3 right-3 bg-primary text-primary-foreground rounded-full p-0.5">
                                                <Check className="h-3 w-3" />
                                            </div>
                                        )}
                                        <div className="flex items-start gap-4">
                                            <div className="p-3 rounded-lg bg-background border shadow-sm group-hover:border-primary/20 transition-colors">
                                                <PanelLeft className={`h-6 w-6 ${layoutMode === 'sidebar' ? 'text-primary' : 'text-muted-foreground'}`} />
                                            </div>
                                            <div>
                                                <p className="font-semibold mb-1">Sidebar Lateral</p>
                                                <p className="text-sm text-muted-foreground">
                                                    Navegación vertical tradicional a la izquierda. Ideal para pantallas anchas.
                                                </p>
                                            </div>
                                        </div>
                                    </button>

                                    {/* Navbar Option */}
                                    <button
                                        onClick={() => setLayoutMode('navbar')}
                                        className={`group relative p-4 rounded-xl border-2 transition-all hover:border-primary/50 text-left ${layoutMode === 'navbar'
                                            ? 'border-primary bg-primary/5 shadow-sm'
                                            : 'border-muted hover:bg-muted/50'
                                            }`}
                                    >
                                        {layoutMode === 'navbar' && (
                                            <div className="absolute top-3 right-3 bg-primary text-primary-foreground rounded-full p-0.5">
                                                <Check className="h-3 w-3" />
                                            </div>
                                        )}
                                        <div className="flex items-start gap-4">
                                            <div className="p-3 rounded-lg bg-background border shadow-sm group-hover:border-primary/20 transition-colors">
                                                <PanelTop className={`h-6 w-6 ${layoutMode === 'navbar' ? 'text-primary' : 'text-muted-foreground'}`} />
                                            </div>
                                            <div>
                                                <p className="font-semibold mb-1">Barra Superior</p>
                                                <p className="text-sm text-muted-foreground">
                                                    Navegación horizontal compacta. Maximiza el espacio de trabajo vertical.
                                                </p>
                                            </div>
                                        </div>
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-4">
                                    Densidad de Interfaz
                                </label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <Button
                                        type="button"
                                        variant={density === 'comfortable' ? 'default' : 'outline'}
                                        className="justify-start gap-2"
                                        onClick={() => setDensity('comfortable')}
                                    >
                                        <Maximize2 className="h-4 w-4" />
                                        Cómoda
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={density === 'compact' ? 'default' : 'outline'}
                                        className="justify-start gap-2"
                                        onClick={() => setDensity('compact')}
                                    >
                                        <Minimize2 className="h-4 w-4" />
                                        Compacta
                                    </Button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-4">
                                    Tamaño de Fuente
                                </label>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <Button
                                        type="button"
                                        variant={fontSize === 'sm' ? 'default' : 'outline'}
                                        className="justify-start gap-2"
                                        onClick={() => setFontSize('sm')}
                                    >
                                        <Type className="h-4 w-4" />
                                        Pequeña
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={fontSize === 'md' ? 'default' : 'outline'}
                                        className="justify-start gap-2"
                                        onClick={() => setFontSize('md')}
                                    >
                                        <Type className="h-4 w-4" />
                                        Normal
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={fontSize === 'lg' ? 'default' : 'outline'}
                                        className="justify-start gap-2"
                                        onClick={() => setFontSize('lg')}
                                    >
                                        <Type className="h-4 w-4" />
                                        Grande
                                    </Button>
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-border p-4">
                                <div>
                                    <p className="text-sm font-medium">Sidebar colapsado por defecto</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Al abrir el dashboard, la barra lateral inicia en modo compacto.
                                    </p>
                                </div>
                                <Switch
                                    checked={sidebarDefaultCollapsed}
                                    onCheckedChange={setSidebarDefaultCollapsed}
                                    className="self-end sm:self-auto"
                                />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Account Settings */}
                <TabsContent value="account" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Información Personal</CardTitle>
                            <CardDescription>
                                Gestiona tu información de perfil y cómo te ven los demás.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSaveProfile} className="space-y-6">
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Nombre Completo</label>
                                        <Input
                                            value={profileName}
                                            onChange={(e) => setProfileName(e.target.value)}
                                            placeholder="Tu nombre"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Correo Electrónico</label>
                                        <Input
                                            value={organization?.created_at ? 'usuario@ejemplo.com' : ''} // Placeholder as we can't easily get email from profile yet w/o auth user object
                                            disabled
                                            className="bg-muted text-muted-foreground"
                                            placeholder="Cargando..." // In a real scenario we'd get this from auth.getUser() or pass it via context
                                        />
                                        <p className="text-[10px] text-muted-foreground">
                                            El correo electrónico es gestionado por el proveedor de autenticación.
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Rol en la Organización</label>
                                        <div>
                                            <Badge variant="outline" className="text-sm py-1 px-3 capitalize">
                                                {profile?.role || 'miembro'}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-end">
                                    <Button type="submit" disabled={savingProfile} className="w-full sm:w-auto">
                                        {savingProfile ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                        {savingProfile ? 'Guardando...' : 'Guardar Perfil'}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Security Settings */}
                <TabsContent value="security" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Clock3 className="h-5 w-5" />
                                Sesión y Acceso
                            </CardTitle>
                            <CardDescription>
                                Configura la seguridad operativa de tu cuenta en este dispositivo.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium mb-3">Timeout de sesión por inactividad</label>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                    {[15, 30, 60, 120].map((minutes) => (
                                        <Button
                                            key={minutes}
                                            type="button"
                                            variant={sessionTimeoutMinutes === minutes ? 'default' : 'outline'}
                                            onClick={() => handleSessionTimeoutChange(minutes)}
                                        >
                                            {minutes} min
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-border p-4">
                                <div>
                                    <p className="text-sm font-medium flex items-center gap-2">
                                        <BellRing className="h-4 w-4" />
                                        Alertar nuevo dispositivo
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Guarda la preferencia local para avisarte cuando detectes accesos no habituales.
                                    </p>
                                </div>
                                <Switch
                                    checked={notifyNewDevice}
                                    onCheckedChange={handleNotifyNewDeviceChange}
                                    className="self-end sm:self-auto"
                                />
                            </div>

                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-border p-4">
                                <div>
                                    <p className="text-sm font-medium">Sugerir abrir caja al iniciar sesión</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Muestra un aviso al entrar al sistema cuando no hay caja abierta.
                                    </p>
                                </div>
                                <Switch
                                    checked={askOpenCashOnLogin}
                                    onCheckedChange={handleAskOpenCashOnLoginChange}
                                    className="self-end sm:self-auto"
                                />
                            </div>

                            {(profile?.role === 'owner' || profile?.role === 'admin') && (
                                <div className="rounded-lg border border-border p-4 space-y-4">
                                    <div>
                                        <p className="text-sm font-medium">Política de apertura de caja</p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Define cuándo se exige caja abierta y a qué usuarios aplica.
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                        <Button
                                            type="button"
                                            variant={cashSessionPolicy === 'always' ? 'default' : 'outline'}
                                            onClick={() => setCashSessionPolicy('always')}
                                        >
                                            Exigir siempre
                                        </Button>
                                        <Button
                                            type="button"
                                            variant={cashSessionPolicy === 'cash_only' ? 'default' : 'outline'}
                                            onClick={() => setCashSessionPolicy('cash_only')}
                                        >
                                            Solo pagos en efectivo
                                        </Button>
                                        <Button
                                            type="button"
                                            variant={cashSessionPolicy === 'off' ? 'default' : 'outline'}
                                            onClick={() => setCashSessionPolicy('off')}
                                        >
                                            Desactivada
                                        </Button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        <Button
                                            type="button"
                                            variant={cashSessionScope === 'all_users' ? 'default' : 'outline'}
                                            onClick={() => setCashSessionScope('all_users')}
                                        >
                                            Aplicar a todos
                                        </Button>
                                        <Button
                                            type="button"
                                            variant={cashSessionScope === 'assigned_users' ? 'default' : 'outline'}
                                            onClick={() => setCashSessionScope('assigned_users')}
                                        >
                                            Solo empleados asignados
                                        </Button>
                                    </div>

                                    {cashSessionScope === 'assigned_users' && (
                                        <div className="space-y-2 rounded-md border border-border p-3 max-h-48 overflow-auto">
                                            {securityUsers.length === 0 ? (
                                                <p className="text-xs text-muted-foreground">No hay usuarios para asignar.</p>
                                            ) : (
                                                securityUsers.map((user) => {
                                                    const checked = cashSessionAssignedUserIds.includes(user.id);
                                                    return (
                                                        <label
                                                            key={user.id}
                                                            className="flex items-center justify-between gap-3 py-1"
                                                        >
                                                            <span className="text-sm">
                                                                {user.full_name || 'Sin nombre'}
                                                                <span className="text-xs text-muted-foreground ml-2 capitalize">
                                                                    {user.role || 'usuario'}
                                                                </span>
                                                            </span>
                                                            <Checkbox
                                                                checked={checked}
                                                                onCheckedChange={(value) =>
                                                                    handleToggleCashSessionAssignedUser(user.id, Boolean(value))
                                                                }
                                                            />
                                                        </label>
                                                    );
                                                })
                                            )}
                                        </div>
                                    )}

                                    <div className="flex justify-end">
                                        <Button
                                            type="button"
                                            onClick={handleSaveCashSessionPolicy}
                                            disabled={savingCashSessionPolicy}
                                            className="w-full sm:w-auto"
                                        >
                                            {savingCashSessionPolicy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                            Guardar política de caja
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {(profile?.role === 'owner' || profile?.role === 'admin') && (
                                <div className="rounded-lg border border-border p-4 space-y-4 shadow-sm">
                                    <div>
                                        <p className="text-sm font-medium">Contraseña para sección de Permisos</p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Solicita una clave secreta al entrar a "/dashboard/permissions".
                                        </p>
                                    </div>
                                    <div className="flex items-center justify-between border-b pb-4">
                                        <p className="text-sm">Requerir contraseña secreta</p>
                                        <Switch
                                            checked={requirePermissionsPassword}
                                            onCheckedChange={setRequirePermissionsPassword}
                                        />
                                    </div>
                                    
                                    {requirePermissionsPassword && (
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Clave/PIN actual</label>
                                            <Input
                                                type="text"
                                                value={permissionsPassword}
                                                onChange={(e) => setPermissionsPassword(e.target.value)}
                                                placeholder="Ej. 1234"
                                                className="max-w-xs"
                                            />
                                        </div>
                                    )}

                                    <div className="flex justify-end pt-2">
                                        <Button
                                            type="button"
                                            onClick={handleSavePermissionsPassword}
                                            disabled={savingPermissionsPassword}
                                            className="w-full sm:w-auto"
                                        >
                                            {savingPermissionsPassword ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                            Guardar acceso a Permisos
                                        </Button>
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-border p-4">
                                <div>
                                    <p className="text-sm font-medium">Cerrar otras sesiones</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Cierra sesiones activas en otros dispositivos y deja solo esta abierta.
                                    </p>
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={closingOtherSessions}
                                    onClick={handleCloseOtherSessions}
                                    className="w-full sm:w-auto"
                                >
                                    {closingOtherSessions ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                    Cerrar otras
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Laptop className="h-5 w-5" />
                                Historial de Seguridad (Local)
                            </CardTitle>
                            <CardDescription>
                                Últimos accesos registrados en este navegador.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {accessHistory.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Sin registros aún.</p>
                            ) : (
                                <div className="space-y-2">
                                    {accessHistory.map((entry) => (
                                        <div key={`${entry.at}-${entry.device}`} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 rounded-md border border-border p-3">
                                            <span className="text-sm">{entry.device}</span>
                                            <span className="text-xs text-muted-foreground">
                                                {new Date(entry.at).toLocaleString()}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="border-destructive/20">
                        <CardHeader>
                            <CardTitle className="text-destructive flex items-center gap-2">
                                <Shield className="h-5 w-5" />
                                Zona de Peligro
                            </CardTitle>
                            <CardDescription>
                                Acciones que afectan tu sesión y acceso.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {(profile?.role === 'owner' || profile?.role === 'admin') && (
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border border-destructive/20 rounded-lg bg-destructive/5">
                                    <div>
                                        <p className="font-medium text-destructive">Borrar datos de la organización</p>
                                        <p className="text-sm text-muted-foreground">
                                            Elimina ventas, compras, pedidos, clientes, productos y demás datos operativos para comenzar desde cero.
                                        </p>
                                    </div>
                                    <Button
                                        variant="destructive"
                                        className="w-full sm:w-auto"
                                        onClick={() => setShowResetOrgDialog(true)}
                                    >
                                        <Database className="h-4 w-4 mr-2" />
                                        Borrar todo
                                    </Button>
                                </div>
                            )}

                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border border-destructive/20 rounded-lg bg-destructive/5">
                                <div>
                                    <p className="font-medium text-destructive">Cerrar Sesión</p>
                                    <p className="text-sm text-muted-foreground">
                                        Finalizar tu sesión actual en este dispositivo.
                                    </p>
                                </div>
                                <Button variant="destructive" onClick={handleLogout} className="w-full sm:w-auto">
                                    <LogOut className="h-4 w-4 mr-2" />
                                    Cerrar Sesión
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                {/* Plans Settings */}
                <TabsContent value="plans" className="space-y-4">
                    <PlansClientWrapper
                        currentPlanId={organization?.plan_type as any || 'free'}
                        canManage={['owner', 'admin'].includes(String(profile?.role || ''))}
                    />
                </TabsContent>

                {/* Offline System */}
                <TabsContent value="offline" className="space-y-4">
                    <OfflineDebugPanel />
                </TabsContent>

                {/* Legacy Import */}
                <TabsContent value="import" className="space-y-4">
                    <LegacyImportPanel />
                </TabsContent>
            </Tabs>

            <AlertDialog open={showResetOrgDialog} onOpenChange={setShowResetOrgDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Borrar todos los datos de la organización?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción es irreversible. Se eliminarán datos operativos como pedidos, ventas, compras, clientes, productos y movimientos.
                            <br />
                            Para confirmar, escribe el nombre exacto de la organización: <span className="font-semibold text-foreground">{organization?.name || '-'}</span>
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Nombre de la organización</label>
                        <Input
                            value={resetOrgConfirmText}
                            onChange={(e) => setResetOrgConfirmText(e.target.value)}
                            placeholder={organization?.name || 'Nombre de organización'}
                            disabled={resettingOrgData}
                        />
                    </div>

                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={resettingOrgData}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleResetOrganizationData();
                            }}
                            disabled={resettingOrgData || !organization?.name || resetOrgConfirmText.trim().toLowerCase() !== organization.name.trim().toLowerCase()}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            {resettingOrgData ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                            Confirmar borrado total
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Dialog open={showResetOrgSuccessModal} onOpenChange={setShowResetOrgSuccessModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>¡Reseteo completado con éxito!</DialogTitle>
                        <DialogDescription>
                            Se eliminaron todos los datos operativos de la organización y también la información offline local de este dispositivo.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button onClick={() => setShowResetOrgSuccessModal(false)}>
                            Entendido
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <AlertDialog open={showDeleteAccountDialog} onOpenChange={setShowDeleteAccountDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-red-600">¿Eliminar Definitivamente la Organización y Cuenta?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción es <strong className="text-foreground">irreversible</strong>. Se eliminará permanentemente la organización, absolutamente todos los datos operativos y comerciales, y todos los usuarios asociados a la misma de nuestra plataforma.
                            <br /><br />
                            Para confirmar, escribe exactamente: <span className="font-bold text-foreground">ELIMINAR DEFINITIVAMENTE</span>
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Palabra de confirmación</label>
                        <Input
                            value={deleteAccountConfirmText}
                            onChange={(e) => setDeleteAccountConfirmText(e.target.value)}
                            placeholder="ELIMINAR DEFINITIVAMENTE"
                            disabled={deletingAccount}
                        />
                    </div>

                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deletingAccount} onClick={() => setDeleteAccountConfirmText('')}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleDeleteAccountAndOrganization();
                            }}
                            disabled={deletingAccount || deleteAccountConfirmText.trim().toUpperCase() !== 'ELIMINAR DEFINITIVAMENTE'}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            {deletingAccount ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                            Eliminar para siempre
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
