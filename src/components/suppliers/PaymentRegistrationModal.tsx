import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
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
import { Loader2, DollarSign, Calendar, CreditCard } from 'lucide-react';
import { toast } from 'sonner';

interface PurchaseOrder {
    id: string;
    order_number: string | null;
    total: number;
    created_at: string;
}

interface PaymentRegistrationModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    supplierId: string;
    supplierName: string;
    organizationId: string;
    currentBalance: number;
    onSuccess?: () => void;
}

export function PaymentRegistrationModal({
    open,
    onOpenChange,
    supplierId,
    supplierName,
    organizationId,
    currentBalance,
    onSuccess,
}: PaymentRegistrationModalProps) {
    const [loading, setLoading] = useState(false);
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [formData, setFormData] = useState({
        purchase_order_id: '',
        amount: '',
        payment_method: 'cash',
        payment_date: new Date().toISOString().split('T')[0],
        reference_number: '',
        notes: '',
    });

    const supabase = createClient();

    const loadPurchaseOrders = useCallback(async () => {
        const { data } = await supabase
            .from('purchase_orders')
            .select('id, order_number, total, created_at')
            .eq('supplier_id', supplierId)
            .eq('status', 'received')
            .order('created_at', { ascending: false });

        if (data) setPurchaseOrders(data);
    }, [supabase, supplierId]);

    // Cargar órdenes de compra pendientes
    useEffect(() => {
        if (open) {
            loadPurchaseOrders();
        }
    }, [open, loadPurchaseOrders]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { registerSupplierPayment } = await import('@/actions/suppliers');
            const result = await registerSupplierPayment({
                supplierId,
                purchaseOrderId: (formData.purchase_order_id && formData.purchase_order_id !== 'no_order') ? formData.purchase_order_id : null,
                amount: parseFloat(formData.amount),
                paymentMethod: formData.payment_method,
                paymentDate: formData.payment_date,
                referenceNumber: formData.reference_number || null,
                notes: formData.notes || null,
            });

            if (result.error) {
                throw new Error(result.error);
            }

            const paymentResult = result.data as { success: boolean; error?: string; new_balance?: number };

            if (!paymentResult?.success) {
                throw new Error(paymentResult?.error || 'Error al registrar el pago');
            }

            toast.success('Pago registrado exitosamente', {
                description: `Nuevo balance: $${paymentResult.new_balance?.toLocaleString('es-AR')}`,
            });

            onOpenChange(false);
            onSuccess?.();

            // Reset form
            setFormData({
                purchase_order_id: '',
                amount: '',
                payment_method: 'cash',
                payment_date: new Date().toISOString().split('T')[0],
                reference_number: '',
                notes: '',
            });
        } catch (error: any) {
            console.error('Error registering payment:', error);
            toast.error('Error al registrar el pago', {
                description: error.message,
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-primary" />
                        Registrar Pago a {supplierName}
                    </DialogTitle>
                </DialogHeader>

                {/* Current Balance */}
                <div className="p-4 rounded-lg bg-muted/50 border">
                    <p className="text-sm text-muted-foreground mb-1">Balance Actual</p>
                    <p className="text-2xl font-bold text-destructive">
                        ${currentBalance.toLocaleString('es-AR')}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Purchase Order (Optional) */}
                    <div className="space-y-2">
                        <Label>Orden de Compra (Opcional)</Label>
                        <Select
                            value={formData.purchase_order_id}
                            onValueChange={(v) =>
                                setFormData({ ...formData, purchase_order_id: v })
                            }
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccionar orden..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="no_order">Sin orden específica</SelectItem>
                                {purchaseOrders.map((po) => (
                                    <SelectItem key={po.id} value={po.id}>
                                        {po.order_number || po.id.slice(0, 8)} - $
                                        {po.total.toLocaleString('es-AR')}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Amount */}
                    <div className="space-y-2">
                        <Label>Monto *</Label>
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="number"
                                step="0.01"
                                min="0.01"
                                max={currentBalance}
                                value={formData.amount}
                                onChange={(e) =>
                                    setFormData({ ...formData, amount: e.target.value })
                                }
                                className="pl-10"
                                placeholder="0.00"
                                required
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Máximo: ${currentBalance.toLocaleString('es-AR')}
                        </p>
                    </div>

                    {/* Payment Method */}
                    <div className="space-y-2">
                        <Label>Método de Pago *</Label>
                        <Select
                            value={formData.payment_method}
                            onValueChange={(v) =>
                                setFormData({ ...formData, payment_method: v })
                            }
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="cash">Efectivo</SelectItem>
                                <SelectItem value="transfer">Transferencia</SelectItem>
                                <SelectItem value="check">Cheque</SelectItem>
                                <SelectItem value="card">Tarjeta</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Payment Date */}
                    <div className="space-y-2">
                        <Label>Fecha de Pago *</Label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="date"
                                value={formData.payment_date}
                                onChange={(e) =>
                                    setFormData({ ...formData, payment_date: e.target.value })
                                }
                                className="pl-10"
                                max={new Date().toISOString().split('T')[0]}
                                required
                            />
                        </div>
                    </div>

                    {/* Reference Number */}
                    {formData.payment_method !== 'cash' && (
                        <div className="space-y-2">
                            <Label>Número de Referencia</Label>
                            <div className="relative">
                                <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    value={formData.reference_number}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            reference_number: e.target.value,
                                        })
                                    }
                                    className="pl-10"
                                    placeholder="Ej: 123456789"
                                />
                            </div>
                        </div>
                    )}

                    {/* Notes */}
                    <div className="space-y-2">
                        <Label>Notas</Label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) =>
                                setFormData({ ...formData, notes: e.target.value })
                            }
                            rows={2}
                            className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                            placeholder="Información adicional..."
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            className="flex-1"
                            disabled={loading}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading} className="flex-1">
                            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                            {loading ? 'Registrando...' : 'Registrar Pago'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
