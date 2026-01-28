'use client';

import { useOrganization } from '@/contexts/OrganizationContext';
import { useLayout } from '@/contexts/LayoutContext';
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
} from 'lucide-react';
import { PlansClientWrapper } from './plans/PlansClientWrapper';

export default function SettingsPage() {
    const { organization, profile, refetch } = useOrganization();
    const { layoutMode, setLayoutMode } = useLayout();

    // Organization State
    const [orgName, setOrgName] = useState('');
    const [savingOrg, setSavingOrg] = useState(false);

    // Profile State
    const [profileName, setProfileName] = useState('');
    const [savingProfile, setSavingProfile] = useState(false);

    // Status State
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const supabase = createClient();

    useEffect(() => {
        if (organization?.name) {
            setOrgName(organization.name);
        }
        if (profile?.full_name) {
            setProfileName(profile.full_name);
        }
    }, [organization, profile]);

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
        <div className="space-y-6 max-w-4xl mx-auto pb-10">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Configuración</h1>
                <p className="text-muted-foreground mt-1">
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
                <TabsList className="mb-6">
                    <TabsTrigger value="general" className="gap-2">
                        <Building2 className="h-4 w-4" />
                        General
                    </TabsTrigger>
                    <TabsTrigger value="appearance" className="gap-2">
                        <Palette className="h-4 w-4" />
                        Apariencia
                    </TabsTrigger>
                    <TabsTrigger value="account" className="gap-2">
                        <User className="h-4 w-4" />
                        Cuenta
                    </TabsTrigger>
                    <TabsTrigger value="security" className="gap-2">
                        <Shield className="h-4 w-4" />
                        Seguridad
                    </TabsTrigger>
                    <TabsTrigger value="plans" className="gap-2">
                        <CreditCard className="h-4 w-4" />
                        Planes
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
                            <form onSubmit={handleSaveOrg} className="space-y-6">
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Nombre de la Organización</label>
                                        <Input
                                            value={orgName}
                                            onChange={(e) => setOrgName(e.target.value)}
                                            placeholder="Mi Empresa"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Plan Actual</label>
                                        <div className="flex items-center gap-2 h-10 px-3 rounded-md border bg-muted/50">
                                            <Badge variant="secondary" className="uppercase">
                                                {organization?.plan_type || 'free'}
                                            </Badge>
                                            <span className="text-xs text-muted-foreground ml-auto">
                                                {organization?.plan_type === 'enterprise' ? 'Plan Empresarial' : 'Plan Gratuito'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-end">
                                    <Button type="submit" disabled={savingOrg}>
                                        {savingOrg ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                        {savingOrg ? 'Guardando...' : 'Guardar Cambios'}
                                    </Button>
                                </div>
                            </form>
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
                                    <Button type="submit" disabled={savingProfile}>
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
                            <div className="flex items-center justify-between p-4 border border-destructive/20 rounded-lg bg-destructive/5">
                                <div>
                                    <p className="font-medium text-destructive">Cerrar Sesión</p>
                                    <p className="text-sm text-muted-foreground">
                                        Finalizar tu sesión actual en este dispositivo.
                                    </p>
                                </div>
                                <Button variant="destructive" onClick={handleLogout}>
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
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}
