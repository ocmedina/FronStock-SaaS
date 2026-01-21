'use client';

import { useOrganization } from '@/contexts/OrganizationContext';
import { useLayout } from '@/contexts/LayoutContext';
import { createClient } from '@/lib/supabase/client';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
} from 'lucide-react';

export default function SettingsPage() {
    const { organization, profile, refetch } = useOrganization();
    const { layoutMode, setLayoutMode } = useLayout();
    const [orgName, setOrgName] = useState('');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const supabase = createClient();

    useEffect(() => {
        if (organization?.name) {
            setOrgName(organization.name);
        }
    }, [organization]);

    const handleSaveOrg = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!organization) return;

        setSaving(true);
        setMessage(null);

        const { error } = await supabase
            .from('organizations')
            .update({ name: orgName })
            .eq('id', organization.id);

        if (error) {
            setMessage({ type: 'error', text: 'Error al guardar: ' + error.message });
        } else {
            setMessage({ type: 'success', text: 'Configuración guardada correctamente' });
            refetch();
        }

        setSaving(false);
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.href = '/login';
    };

    return (
        <div className="space-y-6 max-w-3xl">
            <div>
                <h1 className="text-2xl font-bold">Configuración</h1>
                <p className="text-muted-foreground">Administra tu organización y personalización</p>
            </div>

            {message && (
                <div className={`px-4 py-3 rounded-lg text-sm ${message.type === 'success'
                    ? 'bg-green-500/10 text-green-600 border border-green-500/20'
                    : 'bg-red-500/10 text-red-600 border border-red-500/20'
                    }`}>
                    {message.text}
                </div>
            )}

            {/* Personalization */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Palette className="h-5 w-5" />
                        Personalización
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Layout Selection */}
                    <div>
                        <label className="block text-sm font-medium mb-3">
                            Estilo de navegación
                        </label>
                        <div className="grid grid-cols-2 gap-4">
                            {/* Sidebar Option */}
                            <button
                                onClick={() => setLayoutMode('sidebar')}
                                className={`relative p-4 rounded-xl border-2 transition-all hover:border-primary/50 ${layoutMode === 'sidebar'
                                        ? 'border-primary bg-primary/5'
                                        : 'border-border'
                                    }`}
                            >
                                {layoutMode === 'sidebar' && (
                                    <div className="absolute top-2 right-2">
                                        <Check className="h-4 w-4 text-primary" />
                                    </div>
                                )}
                                <div className="flex flex-col items-center gap-3">
                                    <div className="w-full h-20 rounded-lg bg-muted overflow-hidden flex">
                                        <div className="w-1/4 bg-primary/20 flex items-center justify-center">
                                            <PanelLeft className="h-4 w-4 text-primary" />
                                        </div>
                                        <div className="flex-1 p-2">
                                            <div className="h-2 w-full bg-muted-foreground/20 rounded mb-1" />
                                            <div className="h-2 w-3/4 bg-muted-foreground/20 rounded" />
                                        </div>
                                    </div>
                                    <div className="text-center">
                                        <p className="font-medium">Sidebar</p>
                                        <p className="text-xs text-muted-foreground">Menú lateral</p>
                                    </div>
                                </div>
                            </button>

                            {/* Navbar Option */}
                            <button
                                onClick={() => setLayoutMode('navbar')}
                                className={`relative p-4 rounded-xl border-2 transition-all hover:border-primary/50 ${layoutMode === 'navbar'
                                        ? 'border-primary bg-primary/5'
                                        : 'border-border'
                                    }`}
                            >
                                {layoutMode === 'navbar' && (
                                    <div className="absolute top-2 right-2">
                                        <Check className="h-4 w-4 text-primary" />
                                    </div>
                                )}
                                <div className="flex flex-col items-center gap-3">
                                    <div className="w-full h-20 rounded-lg bg-muted overflow-hidden flex flex-col">
                                        <div className="h-1/4 bg-primary/20 flex items-center justify-center">
                                            <PanelTop className="h-3 w-3 text-primary" />
                                        </div>
                                        <div className="flex-1 p-2">
                                            <div className="h-2 w-full bg-muted-foreground/20 rounded mb-1" />
                                            <div className="h-2 w-3/4 bg-muted-foreground/20 rounded" />
                                        </div>
                                    </div>
                                    <div className="text-center">
                                        <p className="font-medium">Navbar</p>
                                        <p className="text-xs text-muted-foreground">Menú superior</p>
                                    </div>
                                </div>
                            </button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Organization Settings */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5" />
                        Organización
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSaveOrg} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Nombre de la Organización</label>
                            <Input
                                value={orgName}
                                onChange={(e) => setOrgName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Plan</label>
                            <div className="flex items-center gap-2">
                                <Badge variant="secondary">{organization?.plan_type || 'free'}</Badge>
                                <span className="text-xs text-muted-foreground">(Próximamente: planes premium)</span>
                            </div>
                        </div>
                        <Button type="submit" disabled={saving}>
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            {saving ? 'Guardando...' : 'Guardar Cambios'}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {/* Profile Info */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <User className="h-5 w-5" />
                        Mi Cuenta
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-muted-foreground">Nombre</label>
                            <p className="font-medium">{profile?.full_name || 'Sin nombre'}</p>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-muted-foreground">Rol</label>
                            <Badge>{profile?.role || 'admin'}</Badge>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card className="border-destructive/50">
                <CardHeader>
                    <CardTitle className="text-destructive">Zona de Peligro</CardTitle>
                </CardHeader>
                <CardContent>
                    <Button variant="destructive" onClick={handleLogout}>
                        <LogOut className="h-4 w-4" />
                        Cerrar Sesión
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
