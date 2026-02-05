'use client';

import { useState, useEffect } from 'react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import type { Promotion } from '@/lib/promotions';

interface PromotionFormModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    promotion?: Promotion | null;
    onSuccess: () => void;
}

export function PromotionFormModal({
    open,
    onOpenChange,
    promotion,
    onSuccess,
}: PromotionFormModalProps) {
    const { organization } = useOrganization();
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        type: 'percentage' as Promotion['type'],
        discount_percentage: '',
        discount_amount: '',
        min_quantity: '',
        min_amount: '',
        coupon_code: '',
        max_uses: '',
        start_date: '',
        end_date: '',
        start_time: '',
        end_time: '',
        active: true,
    });

    // Reset form when modal opens/closes or promotion changes
    useEffect(() => {
        if (open) {
            if (promotion) {
                setFormData({
                    name: promotion.name,
                    description: promotion.description || '',
                    type: promotion.type,
                    discount_percentage: promotion.discount_percentage?.toString() || '',
                    discount_amount: promotion.discount_amount?.toString() || '',
                    min_quantity: promotion.min_quantity?.toString() || '',
                    min_amount: promotion.min_amount?.toString() || '',
                    coupon_code: promotion.coupon_code || '',
                    max_uses: promotion.max_uses?.toString() || '',
                    start_date: promotion.start_date || '',
                    end_date: promotion.end_date || '',
                    start_time: promotion.start_time || '',
                    end_time: promotion.end_time || '',
                    active: promotion.active,
                });
            } else {
                setFormData({
                    name: '',
                    description: '',
                    type: 'percentage',
                    discount_percentage: '',
                    discount_amount: '',
                    min_quantity: '',
                    min_amount: '',
                    coupon_code: '',
                    max_uses: '',
                    start_date: '',
                    end_date: '',
                    start_time: '',
                    end_time: '',
                    active: true,
                });
            }
        }
    }, [open, promotion]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!organization?.id) return;

        // Validaciones
        if (!formData.name.trim()) {
            toast.error('El nombre es requerido');
            return;
        }

        if (formData.type === 'coupon' && !formData.coupon_code.trim()) {
            toast.error('El código de cupón es requerido');
            return;
        }

        if (!formData.discount_percentage && !formData.discount_amount) {
            toast.error('Debe especificar un descuento (porcentaje o monto)');
            return;
        }

        setIsSubmitting(true);
        const supabase = createClient();

        try {
            const data: any = {
                organization_id: organization.id,
                name: formData.name.trim(),
                description: formData.description.trim() || null,
                type: formData.type,
                discount_percentage: formData.discount_percentage ? parseFloat(formData.discount_percentage) : null,
                discount_amount: formData.discount_amount ? parseFloat(formData.discount_amount) : null,
                min_quantity: formData.min_quantity ? parseInt(formData.min_quantity) : null,
                min_amount: formData.min_amount ? parseFloat(formData.min_amount) : null,
                coupon_code: formData.coupon_code ? formData.coupon_code.toUpperCase().trim() : null,
                max_uses: formData.max_uses ? parseInt(formData.max_uses) : null,
                start_date: formData.start_date || null,
                end_date: formData.end_date || null,
                start_time: formData.start_time || null,
                end_time: formData.end_time || null,
                active: formData.active,
            };

            let error;
            if (promotion) {
                // Update
                const result = await supabase
                    .from('promotions')
                    .update(data)
                    .eq('id', promotion.id);
                error = result.error;
            } else {
                // Insert
                const result = await supabase
                    .from('promotions')
                    .insert(data);
                error = result.error;
            }

            if (error) throw error;

            toast.success(promotion ? 'Promoción actualizada' : 'Promoción creada');
            onSuccess();
            onOpenChange(false);
        } catch (error: any) {
            console.error('Error saving promotion:', error);
            toast.error(error.message || 'Error al guardar la promoción');
        } finally {
            setIsSubmitting(false);
        }
    };

    const promotionTypes = [
        { value: 'percentage', label: 'Porcentaje' },
        { value: 'fixed_amount', label: 'Monto Fijo' },
        { value: 'volume', label: 'Por Volumen' },
        { value: 'happy_hour', label: 'Happy Hour' },
        { value: 'coupon', label: 'Cupón' },
    ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {promotion ? 'Editar Promoción' : 'Nueva Promoción'}
                    </DialogTitle>
                    <DialogDescription>
                        {promotion
                            ? 'Modifica los detalles de la promoción'
                            : 'Crea una nueva promoción o descuento para tus ventas'}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Información Básica */}
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Nombre *</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Ej: Descuento de Verano"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">Descripción</Label>
                            <Textarea
                                id="description"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Descripción opcional de la promoción"
                                rows={2}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="type">Tipo de Promoción *</Label>
                            <Select
                                value={formData.type}
                                onValueChange={(value: Promotion['type']) =>
                                    setFormData({ ...formData, type: value })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {promotionTypes.map((type) => (
                                        <SelectItem key={type.value} value={type.value}>
                                            {type.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Descuento */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold">Descuento</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="discount_percentage">Porcentaje (%)</Label>
                                <Input
                                    id="discount_percentage"
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.01"
                                    value={formData.discount_percentage}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            discount_percentage: e.target.value,
                                            discount_amount: '', // Clear the other
                                        })
                                    }
                                    placeholder="15"
                                    disabled={!!formData.discount_amount}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="discount_amount">Monto Fijo ($)</Label>
                                <Input
                                    id="discount_amount"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={formData.discount_amount}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            discount_amount: e.target.value,
                                            discount_percentage: '', // Clear the other
                                        })
                                    }
                                    placeholder="500"
                                    disabled={!!formData.discount_percentage}
                                />
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Especifica porcentaje O monto fijo, no ambos
                        </p>
                    </div>

                    {/* Condiciones de Volumen */}
                    {(formData.type === 'volume') && (
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold">Condiciones de Volumen</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="min_quantity">Cantidad Mínima</Label>
                                    <Input
                                        id="min_quantity"
                                        type="number"
                                        min="1"
                                        value={formData.min_quantity}
                                        onChange={(e) => setFormData({ ...formData, min_quantity: e.target.value })}
                                        placeholder="10"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="min_amount">Monto Mínimo ($)</Label>
                                    <Input
                                        id="min_amount"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={formData.min_amount}
                                        onChange={(e) => setFormData({ ...formData, min_amount: e.target.value })}
                                        placeholder="1000"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Happy Hour */}
                    {formData.type === 'happy_hour' && (
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold">Horario Happy Hour</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="start_time">Hora Inicio</Label>
                                    <Input
                                        id="start_time"
                                        type="time"
                                        value={formData.start_time}
                                        onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="end_time">Hora Fin</Label>
                                    <Input
                                        id="end_time"
                                        type="time"
                                        value={formData.end_time}
                                        onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Cupón */}
                    {formData.type === 'coupon' && (
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold">Configuración de Cupón</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="coupon_code">Código *</Label>
                                    <Input
                                        id="coupon_code"
                                        value={formData.coupon_code}
                                        onChange={(e) =>
                                            setFormData({ ...formData, coupon_code: e.target.value.toUpperCase() })
                                        }
                                        placeholder="VERANO2026"
                                        required={formData.type === 'coupon'}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="max_uses">Usos Máximos</Label>
                                    <Input
                                        id="max_uses"
                                        type="number"
                                        min="1"
                                        value={formData.max_uses}
                                        onChange={(e) => setFormData({ ...formData, max_uses: e.target.value })}
                                        placeholder="100"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Vigencia */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold">Vigencia</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="start_date">Fecha Inicio</Label>
                                <Input
                                    id="start_date"
                                    type="date"
                                    value={formData.start_date}
                                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="end_date">Fecha Fin</Label>
                                <Input
                                    id="end_date"
                                    type="date"
                                    value={formData.end_date}
                                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Estado */}
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label htmlFor="active">Promoción Activa</Label>
                            <p className="text-xs text-muted-foreground">
                                Las promociones inactivas no se aplicarán automáticamente
                            </p>
                        </div>
                        <Switch
                            id="active"
                            checked={formData.active}
                            onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                        />
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isSubmitting}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            {promotion ? 'Actualizar' : 'Crear'} Promoción
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
