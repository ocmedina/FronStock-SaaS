'use client';

import { useOrganization } from '@/contexts/OrganizationContext';
import { createClient } from '@/lib/supabase/client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Loader2, Save, Building2, MapPin, Hash, Calendar, FileText } from 'lucide-react';
import { toast } from 'sonner';

export function OrganizationSettingsForm() {
    const { organization, refetch } = useOrganization();
    const [isLoading, setIsLoading] = useState(false);
    const supabase = createClient();

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        address: '',
        city: '',
        cuit: '',
        tax_condition: 'Responsable Inscripto',
        gross_income_number: '',
        activity_start_date: '',
        logo_url: '',
    });

    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        if (organization) {
            setFormData({
                name: organization.name || '',
                address: organization.address || '',
                city: organization.city || '',
                cuit: organization.cuit || '',
                tax_condition: organization.tax_condition || 'Responsable Inscripto',
                gross_income_number: organization.gross_income_number || '',
                activity_start_date: organization.activity_start_date || '',
                logo_url: organization.logo_url || '',
            });
        }
    }, [organization]);

    const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        try {
            setUploading(true);

            if (!event.target.files || event.target.files.length === 0) {
                return;
            }

            const file = event.target.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `logo-${Date.now()}.${fileExt}`;
            const filePath = `${organization!.id}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('organization-logos')
                .upload(filePath, file, { upsert: true });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('organization-logos')
                .getPublicUrl(filePath);

            setFormData(prev => ({ ...prev, logo_url: publicUrl }));
            toast.success("Logo subido. Guarda los cambios para confirmar.");

        } catch (error: any) {
            console.error("Error uploading logo:", error);
            toast.error("Error al subir logo: " + error.message);
        } finally {
            setUploading(false);
        }
    };

    const handleChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!organization) return;

        setIsLoading(true);

        try {
            const { error } = await supabase
                .from('organizations')
                .update({
                    name: formData.name,
                    address: formData.address,
                    city: formData.city || null,
                    cuit: formData.cuit,
                    tax_condition: formData.tax_condition,
                    gross_income_number: formData.gross_income_number,
                    activity_start_date: formData.activity_start_date || null,
                    logo_url: formData.logo_url,
                })
                .eq('id', organization.id);

            if (error) throw error;

            toast.success('Datos de la organización actualizados');
            refetch();
        } catch (error: any) {
            console.error('Error updating organization:', error);
            toast.error('Error al guardar: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    if (!organization) return null;

    return (
        <form onSubmit={handleSave} className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
                <div className="relative group">
                    <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-full overflow-hidden border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50">
                        {formData.logo_url ? (
                            <img src={formData.logo_url} alt="Logo" className="h-full w-full object-cover" />
                        ) : (
                            <span className="text-xs text-gray-400 text-center px-1">Subir Logo</span>
                        )}
                    </div>
                    <label className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 group-hover:opacity-100 cursor-pointer rounded-full transition-opacity text-xs font-medium">
                        {uploading ? "..." : "Cambiar"}
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleLogoUpload}
                            disabled={uploading}
                            className="hidden"
                        />
                    </label>
                </div>
                <div>
                    <h3 className="font-medium">Logo de la Empresa</h3>
                    <p className="text-sm text-muted-foreground">
                        Se mostrará en tus facturas y presupuestos. <br />
                        Recomendado: PNG o JPG cuadrarado.
                    </p>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2"> {/* Changed gap-6 to gap-4 */}
                {/* Nombre */}
                <div className="space-y-2">
                    <Label htmlFor="name" className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        Nombre de la Fantasía / Razón Social
                    </Label>
                    <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => handleChange('name', e.target.value)}
                        placeholder="Mi Empresa S.A."
                        required
                    />
                </div>

                {/* CUIT */}
                <div className="space-y-2">
                    <Label htmlFor="cuit" className="flex items-center gap-2">
                        <Hash className="h-4 w-4 text-muted-foreground" />
                        CUIT
                    </Label>
                    <Input
                        id="cuit"
                        value={formData.cuit}
                        onChange={(e) => handleChange('cuit', e.target.value)}
                        placeholder="30-00000000-0"
                    />
                </div>

                {/* Dirección */}
                <div className="space-y-2">
                    <Label htmlFor="address" className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        Dirección Comercial
                    </Label>
                    <Input
                        id="address"
                        value={formData.address}
                        onChange={(e) => handleChange('address', e.target.value)}
                        placeholder="Av. Corrientes 1234"
                    />
                </div>

                {/* Ciudad */}
                <div className="space-y-2">
                    <Label htmlFor="city" className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        Ciudad / Localidad
                    </Label>
                    <Input
                        id="city"
                        value={formData.city}
                        onChange={(e) => handleChange('city', e.target.value)}
                        placeholder="Ej: Mendoza, Argentina"
                    />
                </div>

                {/* Condición Fiscal */}
                <div className="space-y-2">
                    <Label htmlFor="tax_condition" className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        Condición Fiscal
                    </Label>
                    <Select
                        value={formData.tax_condition}
                        onValueChange={(val) => handleChange('tax_condition', val)}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Seleccionar..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Responsable Inscripto">Responsable Inscripto</SelectItem>
                            <SelectItem value="Monotributista">Monotributista</SelectItem>
                            <SelectItem value="Exento">Exento</SelectItem>
                            <SelectItem value="Consumidor Final">Consumidor Final</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Ingresos Brutos */}
                <div className="space-y-2">
                    <Label htmlFor="iibb" className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        Ingresos Brutos (IIBB)
                    </Label>
                    <Input
                        id="iibb"
                        value={formData.gross_income_number}
                        onChange={(e) => handleChange('gross_income_number', e.target.value)}
                        placeholder="N° IIBB o Convenio Mult."
                    />
                </div>

                {/* Inicio de Actividades */}
                <div className="space-y-2">
                    <Label htmlFor="start_date" className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        Inicio de Actividades
                    </Label>
                    <Input
                        id="start_date"
                        type="date"
                        value={formData.activity_start_date}
                        onChange={(e) => handleChange('activity_start_date', e.target.value)}
                    />
                </div>
            </div>

            <div className="flex justify-end pt-4 border-t">
                <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                    {isLoading ? 'Guardando...' : 'Guardar Datos de Empresa'}
                </Button>
            </div>
        </form>
    );
}
