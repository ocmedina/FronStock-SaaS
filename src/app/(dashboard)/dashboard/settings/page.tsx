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
        </div>
    );
}
