"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Receipt, Phone, MapPin, User, Truck, Calendar, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface OrderDetailsModalProps {
    orderId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function OrderDetailsModal({ orderId, open, onOpenChange }: OrderDetailsModalProps) {
    const [order, setOrder] = useState<any>(null);
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
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
        } finally {
            setLoading(false);
        }
    };

    if (!orderId) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-slate-950 border-slate-800 text-white max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 rounded-2xl">
                <div className="p-6 border-b border-slate-800 bg-slate-950/50 backdrop-blur">
                    <DialogHeader>
                        <DialogTitle className="flex items-center justify-between text-xl font-bold">
                            <span className="flex items-center gap-2">
                                <Receipt className="text-emerald-500" />
                                Detalle de Pedido
                            </span>
                            {order && (
                                <Badge variant="outline" className="font-mono text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
                                    #{orderId.substring(0, 8).toUpperCase()}
                                </Badge>
                            )}
                        </DialogTitle>
                    </DialogHeader>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                        </div>
                    ) : order ? (
                        <>
                            {/* Status & Timing */}
                            <div className="flex flex-wrap gap-4 text-sm text-slate-400">
                                <div className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-slate-500" />
                                    <span>{format(new Date(order.created_at), "dd MMM yyyy, HH:mm", { locale: es })}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <DollarSign className="h-4 w-4 text-slate-500" />
                                    <span>{order.payment_method === 'cash' ? 'Efectivo' : order.payment_method}</span>
                                </div>
                                {order.assigned_to_profile && (
                                    <div className="flex items-center gap-2">
                                        <Truck className="h-4 w-4 text-slate-500" />
                                        <span>Chofer: <strong className="text-white">{order.assigned_to_profile.full_name}</strong></span>
                                    </div>
                                )}
                            </div>

                            {/* Customer Card */}
                            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-xs font-bold text-slate-500 uppercase">Cliente</h3>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs uppercase font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded">
                                            {order.delivery_status}
                                        </span>
                                        {/* Simple Status Updater */}
                                        <select
                                            className="bg-slate-900 border border-slate-700 text-xs text-white rounded px-2 py-0.5"
                                            value={order.delivery_status || 'pending'}
                                            onChange={async (e) => {
                                                const newStatus = e.target.value;
                                                const { error } = await supabase
                                                    .from('orders')
                                                    .update({ delivery_status: newStatus })
                                                    .eq('id', orderId);

                                                if (!error) {
                                                    setOrder({ ...order, delivery_status: newStatus });
                                                }
                                            }}
                                        >
                                            <option value="pending">Pendiente</option>
                                            <option value="preparing">En Cocina</option>
                                            <option value="ready">Listo</option>
                                            <option value="out_for_delivery">En Camino</option>
                                            <option value="delivered">Entregado</option>
                                            <option value="cancelled">Cancelado</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="h-10 w-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                                        <User className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-white text-lg">{order.customer?.name || "Cliente Mostrador"}</p>
                                        <div className="flex flex-col gap-1 mt-1 text-sm text-slate-400">
                                            <span className="flex items-center gap-2">
                                                <MapPin className="h-3.5 w-3.5 text-emerald-500" />
                                                {order.customer?.address || order.delivery_address || "Sin dirección"}
                                            </span>
                                            {order.customer?.phone && (
                                                <span className="flex items-center gap-2">
                                                    <Phone className="h-3.5 w-3.5 text-emerald-500" />
                                                    {order.customer.phone}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {order.delivery_notes && (
                                    <div className="mt-3 pt-3 border-t border-slate-800/50 text-sm">
                                        <span className="text-amber-500 font-bold text-xs uppercase block mb-1">Notas:</span>
                                        <p className="text-slate-300 italic">"{order.delivery_notes}"</p>
                                    </div>
                                )}
                            </div>

                            {/* Products Table */}
                            <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
                                <div className="p-3 bg-slate-900 border-b border-slate-800">
                                    <h3 className="text-xs font-bold text-slate-500 uppercase">Productos</h3>
                                </div>
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-slate-500 uppercase bg-slate-900/50">
                                        <tr>
                                            <th className="px-4 py-2">Cant</th>
                                            <th className="px-4 py-2">Producto</th>
                                            <th className="px-4 py-2 text-right">Precio</th>
                                            <th className="px-4 py-2 text-right">Subtotal</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800">
                                        {items.map((item) => (
                                            <tr key={item.id} className="text-slate-300">
                                                <td className="px-4 py-3 font-bold text-emerald-400 w-16 text-center">{item.quantity}</td>
                                                <td className="px-4 py-3">{item.product_name}</td>
                                                <td className="px-4 py-3 text-right text-slate-400">${item.unit_price}</td>
                                                <td className="px-4 py-3 text-right font-medium text-white">${item.unit_price * item.quantity}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-slate-900 font-bold text-white">
                                        <tr>
                                            <td colSpan={3} className="px-4 py-3 text-right border-t border-slate-800">Costo Envío:</td>
                                            <td className="px-4 py-3 text-right border-t border-slate-800">+${order.delivery_fee || 0}</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={3} className="px-4 py-3 text-right">Total:</td>
                                            <td className="px-4 py-3 text-right text-lg text-emerald-400">${order.total}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </>
                    ) : (
                        <div className="text-center text-slate-500">No se pudo cargar el pedido.</div>
                    )}
                </div>

                <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex justify-end gap-3">
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="border-slate-700 text-slate-400 hover:text-white">
                        Cerrar
                    </Button>
                    <Button variant="default" className="bg-emerald-600 hover:bg-emerald-500">
                        <Receipt className="mr-2 h-4 w-4" />
                        Imprimir Ticket
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
