"use client";

import { useEffect, useState } from "react";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
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

    const handleStatusChange = async (newStatus: string) => {
        setUpdating(true);
        try {
            const { error } = await supabase
                .from('orders')
                .update({ delivery_status: newStatus })
                .eq('id', orderId);

            if (error) throw error;

            setOrder({ ...order, delivery_status: newStatus });
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
            pending: "bg-amber-500/10 text-amber-500 border-amber-500/20",
            preparing: "bg-orange-500/10 text-orange-500 border-orange-500/20",
            ready: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
            out_for_delivery: "bg-purple-500/10 text-purple-500 border-purple-500/20",
            delivered: "bg-slate-700/50 text-slate-400 border-slate-600/20",
            cancelled: "bg-red-500/10 text-red-500 border-red-500/20"
        };

        const labels: Record<string, string> = {
            pending: "Pendiente",
            preparing: "En Cocina",
            ready: "Listo",
            out_for_delivery: "En Camino",
            delivered: "Entregado",
            cancelled: "Cancelado"
        };

        return (
            <Badge variant="outline" className={`${styles[status] || styles.pending} text-xs font-semibold`}>
                {labels[status] || status}
            </Badge>
        );
    };

    const getPaymentStatusBadge = (paymentStatus: string, paymentAmount: number, total: number) => {
        if (paymentStatus === 'paid' || paymentAmount >= total) {
            return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">Pagado</Badge>;
        }
        if (paymentAmount > 0 && paymentAmount < total) {
            return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">Parcial</Badge>;
        }
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">Pendiente</Badge>;
    };

    const getUrgencyIndicator = (createdAt: string, status: string) => {
        const minutesAgo = differenceInMinutes(new Date(), new Date(createdAt));

        if (status === 'pending' && minutesAgo > 30) {
            return (
                <Badge className="animate-pulse bg-red-500/20 text-red-400 border-red-500/30 text-xs">
                    ¡Urgente! {minutesAgo}min
                </Badge>
            );
        }
        if (status === 'preparing' && minutesAgo > 45) {
            return (
                <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs">
                    Revisar {minutesAgo}min
                </Badge>
            );
        }
        if (status === 'ready' && minutesAgo > 20) {
            return (
                <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">
                    Listo hace {minutesAgo}min
                </Badge>
            );
        }
        return null;
    };

    if (!orderId) return null;

    return (
        <ResponsiveModal
            open={open}
            onOpenChange={onOpenChange}
            contentClassName="bg-slate-950 border-slate-800 text-white max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 rounded-2xl"
        >
            <DialogTitle className="sr-only">Detalles del Pedido</DialogTitle>

            {/* Header with Gradient */}
            <div className="p-6 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-900/20">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                            <Receipt className="h-6 w-6 text-emerald-500" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white">Detalle de Pedido</h2>
                            <p className="text-sm text-slate-400 font-mono">#{orderId.substring(0, 8).toUpperCase()}</p>
                        </div>
                    </div>
                    {order && (
                        <div className="text-right">
                            <p className="text-3xl font-bold text-emerald-400">${order.total.toLocaleString()}</p>
                            <p className="text-xs text-slate-400 capitalize">{order.payment_method === 'credit' ? 'Cuenta Cte.' : order.payment_method}</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="text-center">
                            <Loader2 className="h-8 w-8 animate-spin text-emerald-500 mx-auto mb-2" />
                            <p className="text-slate-400 text-sm">Cargando detalles...</p>
                        </div>
                    </div>
                ) : order ? (
                    <>
                        {/* Status & Time Info */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-800">
                                <p className="text-xs text-slate-500 mb-1">Estado</p>
                                <div className="flex flex-col gap-1.5">
                                    {getStatusBadge(order.delivery_status || 'pending')}
                                    {getUrgencyIndicator(order.created_at, order.delivery_status || 'pending')}
                                </div>
                            </div>
                            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-800">
                                <p className="text-xs text-slate-500 mb-1">Creado</p>
                                <div className="flex items-center gap-2 text-white text-sm">
                                    <Clock className="h-4 w-4 text-slate-400" />
                                    <span>{formatDistanceToNow(new Date(order.created_at), { addSuffix: true, locale: es })}</span>
                                </div>
                                <p className="text-xs text-slate-400 mt-1">{format(new Date(order.created_at), "dd MMM yyyy, HH:mm", { locale: es })}</p>
                            </div>
                            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-800">
                                <p className="text-xs text-slate-500 mb-1">Pago</p>
                                {getPaymentStatusBadge(order.payment_status, order.payment_amount || 0, order.total)}
                                {order.payment_amount > 0 && order.payment_amount < order.total && (
                                    <p className="text-xs text-amber-400 mt-1">Pendiente: ${(order.total - order.payment_amount).toLocaleString()}</p>
                                )}
                            </div>
                        </div>

                        {/* Customer Card */}
                        <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800">
                            <h3 className="text-xs font-bold text-slate-500 uppercase mb-3">Cliente</h3>
                            <div className="flex items-start gap-4">
                                <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                                    <User className="h-6 w-6 text-emerald-500" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-bold text-white text-lg mb-2">{order.customer?.name || "Cliente Mostrador"}</p>
                                    <div className="flex flex-col gap-2 text-sm">
                                        {order.customer?.address && (
                                            <div className="flex items-start gap-2 text-slate-300">
                                                <MapPin className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                                                <span className="flex-1">{order.customer.address}</span>
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
                                            <div className="flex items-center gap-2 text-slate-300">
                                                <Phone className="h-4 w-4 text-emerald-500" />
                                                <span className="flex-1">{order.customer.phone}</span>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 px-3 text-xs border-emerald-700/50 text-emerald-400 hover:bg-emerald-500/10"
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
                                <div className="mt-3 pt-3 border-t border-slate-800/50">
                                    <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                                        <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-amber-500 font-bold text-xs uppercase">Notas de Entrega</p>
                                            <p className="text-slate-300 text-sm mt-1 italic">"{order.delivery_notes}"</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Products Table */}
                        <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
                            <div className="p-3 bg-slate-900 border-b border-slate-800">
                                <h3 className="text-xs font-bold text-slate-500 uppercase">Productos ({items.length})</h3>
                            </div>
                            <table className="w-full text-sm">
                                <thead className="text-xs text-slate-500 uppercase bg-slate-900/50">
                                    <tr>
                                        <th className="px-4 py-2 text-center w-16">Cant</th>
                                        <th className="px-4 py-2 text-left">Producto</th>
                                        <th className="px-4 py-2 text-right">Precio</th>
                                        <th className="px-4 py-2 text-right">Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {items.map((item) => (
                                        <tr key={item.id} className="text-slate-300 hover:bg-slate-800/30">
                                            <td className="px-4 py-3 text-center">
                                                <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-emerald-500/10 text-emerald-400 font-bold text-xs">
                                                    {item.quantity}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 font-medium text-white">{item.product_name}</td>
                                            <td className="px-4 py-3 text-right text-slate-400 font-mono">${item.unit_price.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-right font-semibold text-white font-mono">${(item.unit_price * item.quantity).toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-slate-900 font-bold text-white">
                                    {order.delivery_fee > 0 && (
                                        <tr>
                                            <td colSpan={3} className="px-4 py-2 text-right text-sm border-t border-slate-800">Costo Envío:</td>
                                            <td className="px-4 py-2 text-right border-t border-slate-800 font-mono">+${order.delivery_fee.toLocaleString()}</td>
                                        </tr>
                                    )}
                                    <tr>
                                        <td colSpan={3} className="px-4 py-3 text-right text-lg">Total:</td>
                                        <td className="px-4 py-3 text-right text-xl text-emerald-400 font-mono">${order.total.toLocaleString()}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* Quick Actions */}
                        {order.delivery_status !== 'delivered' && order.delivery_status !== 'cancelled' && (
                            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800">
                                <h3 className="text-xs font-bold text-slate-500 uppercase mb-3">Acciones Rápidas</h3>
                                <div className="grid grid-cols-2 gap-2">
                                    {order.delivery_status === 'pending' && (
                                        <Button
                                            className="bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 border border-orange-500/20"
                                            onClick={() => handleStatusChange('preparing')}
                                            disabled={updating}
                                        >
                                            {updating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ChefHat className="h-4 w-4 mr-2" />}
                                            Enviar a Cocina
                                        </Button>
                                    )}
                                    {order.delivery_status === 'preparing' && (
                                        <Button
                                            className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20"
                                            onClick={() => handleStatusChange('ready')}
                                            disabled={updating}
                                        >
                                            {updating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                                            Marcar Listo
                                        </Button>
                                    )}
                                    {order.delivery_status === 'ready' && (
                                        <Button
                                            className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20"
                                            onClick={() => handleStatusChange('out_for_delivery')}
                                            disabled={updating}
                                        >
                                            {updating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Truck className="h-4 w-4 mr-2" />}
                                            Enviar a Reparto
                                        </Button>
                                    )}
                                    {order.delivery_status === 'out_for_delivery' && (
                                        <Button
                                            className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20"
                                            onClick={() => handleStatusChange('delivered')}
                                            disabled={updating}
                                        >
                                            {updating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                                            Confirmar Entrega
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="text-center text-slate-500 py-12">No se pudo cargar el pedido.</div>
                )}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex justify-end gap-3">
                <Button
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    className="border-slate-700 text-slate-400 hover:text-white"
                >
                    Cerrar
                </Button>
            </div>
        </ResponsiveModal>
    );
}
