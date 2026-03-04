"use client";

import { useEffect, useState } from "react";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Loader2, Receipt, Phone, MapPin, User, Truck, Calendar, DollarSign, ChefHat, CheckCircle, Clock, Copy, AlertCircle } from "lucide-react";
import { format, formatDistanceToNow, differenceInMinutes } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface OrderDetailsModalProps {
    orderId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

export function OrderDetailsModal({ orderId, open, onOpenChange, onSuccess }: OrderDetailsModalProps) {
    const { organizationId } = useOrganization();
    const [order, setOrder] = useState<any>(null);
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [updating, setUpdating] = useState(false);
    const supabase = createClient();

    useEffect(() => {
        if (open && orderId) {
            fetchOrderDetails();
        } else {
            setOrder(null);
            setItems([]);
        }
    }, [open, orderId]);

    const fetchOrderDetails = async () => {
        setLoading(true);
        try {
            // Fetch Order
            const { data: orderData, error: orderError } = await supabase
                .from('orders')
                .select(`
                    *,
                    customer:customers(*)
                `)
                .eq('id', orderId)
                .single();

            if (orderError) throw orderError;
            setOrder(orderData);

            // Fetch Items
            const { data: itemsData, error: itemsError } = await supabase
                .from('order_items')
                .select('*')
                .eq('order_id', orderId);

            if (itemsError) throw itemsError;
            setItems(itemsData || []);
        } catch (e) {
            console.error(e);
            toast.error('Error al cargar el pedido');
        } finally {
            setLoading(false);
        }
    };

    const getCurrentStatus = (currentOrder: any) => {
        if (!currentOrder) return 'assigned';
        if (currentOrder.lifecycle_status) return currentOrder.lifecycle_status;

        const legacyStatus = currentOrder.delivery_status;
        if (legacyStatus === 'out_for_delivery') return 'in_delivery';
        if (legacyStatus === 'delivered') return 'delivered';
        if (legacyStatus === 'cancelled' || legacyStatus === 'returned') return 'not_delivered';
        return 'assigned';
    };

    const handleStatusChange = async (newStatus: string) => {
        if (!organizationId || !orderId) return;

        setUpdating(true);
        try {
            const { data, error } = await supabase.rpc('set_order_status', {
                p_org_id: organizationId,
                p_order_id: orderId,
                p_new_status: newStatus,
                p_notes: 'Actualizado desde detalle de pedido',
            });

            if (error) throw error;
            if (data?.success === false) throw new Error(data?.error || 'No se pudo actualizar estado');

            const mappedLegacyStatus =
                newStatus === 'in_delivery' ? 'out_for_delivery'
                    : newStatus === 'delivered' ? 'delivered'
                        : newStatus === 'not_delivered' ? 'cancelled'
                            : order?.delivery_status;

            setOrder({
                ...order,
                lifecycle_status: newStatus,
                delivery_status: mappedLegacyStatus,
            });
            toast.success('Estado actualizado correctamente');
            onSuccess?.();
        } catch (error: any) {
            toast.error('Error al actualizar estado: ' + error.message);
        } finally {
            setUpdating(false);
        }
    };

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        toast.success(`${label} copiado al portapapeles`);
    };

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            assigned: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
            in_delivery: "bg-purple-500/10 text-purple-400 border-purple-500/20",
            delivered: "bg-muted text-muted-foreground border-border",
            not_delivered: "bg-red-500/10 text-red-500 border-red-500/20",
            rescheduled: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
            cancelled: "bg-red-500/10 text-red-500 border-red-500/20",
            pending: "bg-amber-500/10 text-amber-500 border-amber-500/20",
            preparing: "bg-orange-500/10 text-orange-500 border-orange-500/20",
            ready: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
            out_for_delivery: "bg-purple-500/10 text-purple-500 border-purple-500/20",
        };

        const labels: Record<string, string> = {
            assigned: "Asignado",
            in_delivery: "En Reparto",
            delivered: "Entregado",
            not_delivered: "No Entregado",
            rescheduled: "Reprogramado",
            cancelled: "Cancelado"
        };

        return (
            <Badge variant="outline" className={`${styles[status] || styles.pending} text-xs font-semibold`}>
                {labels[status] || status}
            </Badge>
        );
    };

    const getPaymentMethodLabel = (method?: string) => {
        if (!method) return 'Sin definir';

        const normalized = method.toLowerCase();
        const labels: Record<string, string> = {
            cash: 'Efectivo',
            transfer: 'Transferencia',
            card: 'Tarjeta',
            mixed: 'Mixto',
            fiado: 'Fiado',
            credit: 'Cuenta Cte.',
            current_account: 'Cuenta Cte.',
            cuenta_corriente: 'Cuenta Cte.',
        };

        return labels[normalized] || method;
    };

    const getPaymentStatusBadge = (paymentStatus: string, paymentAmount: number, total: number) => {
        if (paymentStatus === 'paid' || paymentAmount >= total) {
            return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-xs">Pagado</Badge>;
        }
        if (paymentAmount > 0 && paymentAmount < total) {
            return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-xs">Parcial</Badge>;
        }
        return <Badge className="bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30 text-xs">Pendiente</Badge>;
    };

    const getUrgencyIndicator = (createdAt: string, status: string) => {
        const minutesAgo = differenceInMinutes(new Date(), new Date(createdAt));

        if (status === 'assigned' && minutesAgo > 30) {
            return (
                <Badge className="animate-pulse bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30 text-xs">
                    ¡Urgente! {minutesAgo}min
                </Badge>
            );
        }
        if (status === 'in_delivery' && minutesAgo > 45) {
            return (
                <Badge className="bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30 text-xs">
                    Revisar {minutesAgo}min
                </Badge>
            );
        }
        if (status === 'rescheduled' && minutesAgo > 20) {
            return (
                <Badge className="bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30 text-xs">
                    Reprogramado hace {minutesAgo}min
                </Badge>
            );
        }
        return null;
    };

    if (!orderId) return null;
    const currentStatus = order ? getCurrentStatus(order) : 'assigned';

    return (
        <ResponsiveModal
            open={open}
            onOpenChange={onOpenChange}
            contentClassName="bg-background border-border text-foreground w-[calc(100vw-1rem)] sm:w-auto md:max-w-3xl md:max-h-[90vh] overflow-y-auto md:overflow-hidden md:flex md:flex-col p-0 gap-0 rounded-2xl shadow-xl"
            showDefaultMobileFooter={false}
        >
            <DialogTitle className="sr-only">Detalles del Pedido</DialogTitle>

            {/* Header with Gradient */}
            <div className="p-4 sm:p-6 border-b border-border bg-gradient-to-r from-primary/5 via-background to-emerald-500/10">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <Receipt className="h-6 w-6 text-primary" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-xl sm:text-2xl font-bold text-foreground">Detalle de Pedido</h2>
                            <p className="text-sm text-muted-foreground font-mono">#{orderId.substring(0, 8).toUpperCase()}</p>
                        </div>
                    </div>
                    {order && (
                        <div className="text-left sm:text-right">
                            <p className="text-2xl sm:text-3xl font-bold text-primary">${order.total.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground capitalize">{getPaymentMethodLabel(order.payment_method)}</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="text-center">
                            <Loader2 className="h-8 w-8 animate-spin text-emerald-500 mx-auto mb-2" />
                            <p className="text-muted-foreground text-sm">Cargando detalles...</p>
                        </div>
                    </div>
                ) : order ? (
                    <>
                        {/* Status & Time Info */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            <div className="bg-card/70 rounded-lg p-3 border border-border shadow-sm">
                                <p className="text-xs text-muted-foreground mb-1">Estado</p>
                                <div className="flex flex-col gap-1.5">
                                    {getStatusBadge(currentStatus || 'assigned')}
                                    {getUrgencyIndicator(order.created_at, currentStatus || 'assigned')}
                                </div>
                            </div>
                            <div className="bg-card/70 rounded-lg p-3 border border-border shadow-sm">
                                <p className="text-xs text-muted-foreground mb-1">Creado</p>
                                <div className="flex items-center gap-2 text-foreground text-sm">
                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                    <span>{formatDistanceToNow(new Date(order.created_at), { addSuffix: true, locale: es })}</span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">{format(new Date(order.created_at), "dd MMM yyyy, HH:mm", { locale: es })}</p>
                            </div>
                            <div className="bg-card/70 rounded-lg p-3 border border-border shadow-sm">
                                <p className="text-xs text-muted-foreground mb-1">Pago</p>
                                {getPaymentStatusBadge(order.payment_status, order.payment_amount || 0, order.total)}
                                {order.payment_amount > 0 && order.payment_amount < order.total && (
                                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">Pendiente: ${(order.total - order.payment_amount).toLocaleString()}</p>
                                )}
                            </div>
                        </div>

                        {/* Customer Card */}
                        <div className="bg-card/80 rounded-xl p-4 border border-border shadow-sm">
                            <h3 className="text-xs font-bold text-muted-foreground uppercase mb-3">Cliente</h3>
                            <div className="flex flex-col sm:flex-row items-start gap-4">
                                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                    <User className="h-6 w-6 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0 w-full">
                                    <p className="font-bold text-foreground text-base sm:text-lg mb-2 break-words">{order.customer?.name || "Cliente Mostrador"}</p>
                                    <div className="flex flex-col gap-2 text-sm">
                                        {order.customer?.address && (
                                            <div className="flex items-start gap-2 text-foreground/90">
                                                <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                                <span className="flex-1 break-words">{order.customer.address}</span>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-6 px-2 text-xs"
                                                    onClick={() => copyToClipboard(order.customer.address, 'Dirección')}
                                                >
                                                    <Copy className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        )}
                                        {order.customer?.phone && (
                                            <div className="flex flex-wrap items-center gap-2 text-foreground/90">
                                                <Phone className="h-4 w-4 text-primary" />
                                                <span className="flex-1">{order.customer.phone}</span>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 px-3 text-xs border-primary/30 text-primary hover:bg-primary/10 w-full sm:w-auto"
                                                    onClick={() => window.open(`tel:${order.customer.phone}`)}
                                                >
                                                    Llamar
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            {order.delivery_notes && (
                                <div className="mt-3 pt-3 border-t border-border">
                                    <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                                        <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-amber-700 dark:text-amber-400 font-bold text-xs uppercase">Notas de Entrega</p>
                                            <p className="text-foreground/90 text-sm mt-1 italic">"{order.delivery_notes}"</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Products Table */}
                        <div className="bg-card/80 rounded-xl border border-border overflow-hidden shadow-sm">
                            <div className="p-3 bg-muted/40 border-b border-border">
                                <h3 className="text-xs font-bold text-muted-foreground uppercase">Productos ({items.length})</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[560px] text-sm">
                                    <thead className="text-xs text-muted-foreground uppercase bg-muted/20">
                                        <tr>
                                            <th className="px-4 py-2 text-center w-16">Cant</th>
                                            <th className="px-4 py-2 text-left">Producto</th>
                                            <th className="px-4 py-2 text-right">Precio</th>
                                            <th className="px-4 py-2 text-right">Subtotal</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {items.map((item) => (
                                            <tr key={item.id} className="text-foreground/90 hover:bg-muted/30 transition-colors">
                                                <td className="px-4 py-3 text-center">
                                                    <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-primary/10 text-primary font-bold text-xs">
                                                        {item.quantity}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 font-medium text-foreground">{item.product_name}</td>
                                                <td className="px-4 py-3 text-right text-muted-foreground font-mono">${item.unit_price.toLocaleString()}</td>
                                                <td className="px-4 py-3 text-right font-semibold text-foreground font-mono">${(item.unit_price * item.quantity).toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-muted/30 font-bold text-foreground">
                                        {order.delivery_fee > 0 && (
                                            <tr>
                                                <td colSpan={3} className="px-4 py-2 text-right text-sm border-t border-border">Costo Envío:</td>
                                                <td className="px-4 py-2 text-right border-t border-border font-mono">+${order.delivery_fee.toLocaleString()}</td>
                                            </tr>
                                        )}
                                        <tr>
                                            <td colSpan={3} className="px-4 py-3 text-right text-lg">Total:</td>
                                            <td className="px-4 py-3 text-right text-xl text-primary font-mono">${order.total.toLocaleString()}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>

                        {/* Quick Actions */}
                        {currentStatus !== 'delivered' && currentStatus !== 'cancelled' && currentStatus !== 'not_delivered' && (
                            <div className="bg-card/80 rounded-xl p-4 border border-border shadow-sm">
                                <h3 className="text-xs font-bold text-muted-foreground uppercase mb-3">Acciones Rápidas</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {(currentStatus === 'assigned' || currentStatus === 'rescheduled') && (
                                        <Button
                                            className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-400 border border-purple-500/30 rounded-lg shadow-sm"
                                            onClick={() => handleStatusChange('in_delivery')}
                                            disabled={updating}
                                        >
                                            {updating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Truck className="h-4 w-4 mr-2" />}
                                            Iniciar Reparto
                                        </Button>
                                    )}
                                    {currentStatus === 'in_delivery' && (
                                        <Button
                                            className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 rounded-lg shadow-sm"
                                            onClick={() => {
                                                onOpenChange(false);
                                                window.location.href = `/delivery/orders?orderId=${orderId}`;
                                            }}
                                            disabled={updating}
                                        >
                                            <CheckCircle className="h-4 w-4 mr-2" />
                                            Entregar + Cobrar
                                        </Button>
                                    )}
                                    {currentStatus === 'in_delivery' && (
                                        <Button
                                            className="bg-red-500/10 hover:bg-red-500/20 text-red-700 dark:text-red-400 border border-red-500/30 rounded-lg shadow-sm"
                                            onClick={() => handleStatusChange('not_delivered')}
                                            disabled={updating}
                                        >
                                            {updating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <AlertCircle className="h-4 w-4 mr-2" />}
                                            Marcar Incidencia
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="text-center text-muted-foreground py-12">No se pudo cargar el pedido.</div>
                )}
            </div>

            <div className="p-4 border-t border-border bg-muted/20 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                <Button
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    className="w-full sm:w-auto"
                >
                    Cerrar
                </Button>
            </div>
        </ResponsiveModal>
    );
}
