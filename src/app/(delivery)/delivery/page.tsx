
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Truck, ShoppingCart, MapPin, User, LogOut, Clock, CheckCircle2, Package, ChefHat, Bike, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOrganization } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { ShiftControl } from "@/components/delivery/ShiftControl";
import { OrderDetailsModal } from "@/components/delivery/OrderDetailsModal";
import { DeliveryConfirmationModal } from "@/components/delivery/DeliveryConfirmationModal";
import { toast } from "sonner";

type DeliveryOrder = {
    id: string;
    customer: { name: string; address: string; phone: string } | null;
    total: number;
    delivery_status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'out_for_delivery' | 'delivered' | 'cancelled';
    payment_status: 'paid' | 'pending';
    payment_method: string;
    created_at: string;
    items_count?: number; // Calculated or joined
};

export default function DeliveryHomePage() {
    const { profile, organization } = useOrganization();
    const [orders, setOrders] = useState<DeliveryOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [deliveryConfirmOpen, setDeliveryConfirmOpen] = useState(false);
    const [orderToDeliver, setOrderToDeliver] = useState<any>(null);
    const supabase = createClient();

    const handleViewDetails = (id: string) => {
        setSelectedOrderId(id);
        setDetailsOpen(true);
    };

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('orders')
                .select(`
                    id,
                    total,
                    status,
                    delivery_status,
                    payment_status,
                    payment_method,
                    created_at,
                    customer:customers(name, address, phone)
                `)
                .order('created_at', { ascending: false })
                .limit(20);

            if (data) {
                setOrders(data as any[]);
            }
        } catch (e) {
            console.error("Error fetching orders", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!organization?.id) return;

        fetchOrders();
        // Setup subscription for realtime updates with organization filter
        const channel = supabase
            .channel('delivery-updates')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'orders',
                filter: `organization_id=eq.${organization.id}`
            }, () => {
                fetchOrders();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [organization?.id]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.href = '/login';
    };

    const StatusBadge = ({ status }: { status: string }) => {
        const styles: Record<string, string> = {
            pending: "bg-amber-500/20 text-amber-500 border-amber-500/20",
            confirmed: "bg-blue-500/20 text-blue-500 border-blue-500/20",
            preparing: "bg-orange-500/20 text-orange-500 border-orange-500/20",
            ready: "bg-emerald-500/20 text-emerald-500 border-emerald-500/20",
            out_for_delivery: "bg-purple-500/20 text-purple-500 border-purple-500/20",
            delivered: "bg-slate-800 text-slate-400 border-slate-700",
            cancelled: "bg-red-500/20 text-red-500 border-red-500/20",
        };

        const labels: Record<string, string> = {
            pending: "Pendiente",
            confirmed: "Confirmado",
            preparing: "En Preparación",
            ready: "Listo para Enviar",
            out_for_delivery: "En Camino",
            delivered: "Entregado",
            cancelled: "Cancelado",
        };

        return (
            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${styles[status] || styles.pending}`}>
                {labels[status] || status}
            </span>
        );
    };

    const handleUpdateStatus = async (orderId: string, newStatus: string) => {
        // If marking as delivered, open confirmation modal
        if (newStatus === 'delivered') {
            const order = orders.find(o => o.id === orderId);
            if (order) {
                setOrderToDeliver(order);
                setDeliveryConfirmOpen(true);
            }
            return;
        }

        // For other status updates, proceed normally
        try {
            const { error } = await supabase
                .from('orders')
                .update({ delivery_status: newStatus })
                .eq('id', orderId);

            if (error) throw error;

            toast.success("Estado actualizado correctamente");
            fetchOrders();
        } catch (e: any) {
            console.error("Error updating status:", e);
            toast.error("Error al actualizar: " + (e.message || "Desconocido"));
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 pb-20">
            {/* Header */}
            <div className="sticky top-0 z-20 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 px-4 py-3">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                            Logística
                        </h1>
                        <p className="text-xs text-slate-400 font-medium">
                            {organization?.name || 'Panel de Reparto'}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <ShiftControl />
                        <Link href="/delivery/order">
                            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20 rounded-full pr-4">
                                <ShoppingCart className="h-4 w-4 mr-1" />
                                Nuevo
                            </Button>
                        </Link>
                        <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                            <span className="font-bold text-xs text-emerald-400">
                                {profile?.full_name?.substring(0, 2).toUpperCase() || 'OP'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats / Quick filters */}
            <div className="flex gap-2 px-4 mt-4 overflow-x-auto no-scrollbar pb-1">
                <div className="flex-1 min-w-[100px] bg-slate-900/50 border border-slate-800 rounded-xl p-2.5 flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500">
                        <ChefHat className="h-4 w-4" />
                    </div>
                    <div>
                        <span className="block text-lg font-bold text-white leading-none">
                            {orders.filter(o => ['pending', 'confirmed', 'preparing'].includes(o.delivery_status || 'pending')).length}
                        </span>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wide">Cocina</span>
                    </div>
                </div>
                <div className="flex-1 min-w-[100px] bg-slate-900/50 border border-slate-800 rounded-xl p-2.5 flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-500">
                        <Truck className="h-4 w-4" />
                    </div>
                    <div>
                        <span className="block text-lg font-bold text-white leading-none">
                            {orders.filter(o => o.delivery_status === 'out_for_delivery').length}
                        </span>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wide">Ruta</span>
                    </div>
                </div>
                <div className="flex-1 min-w-[100px] bg-slate-900/50 border border-slate-800 rounded-xl p-2.5 flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                        <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <div>
                        <span className="block text-lg font-bold text-white leading-none">
                            {orders.filter(o => o.delivery_status === 'delivered').length}
                        </span>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wide">Ok</span>
                    </div>
                </div>
            </div>

            {/* Orders List */}
            <div className="p-4 space-y-3">
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Pedidos Recientes</h2>

                {orders.length === 0 && !loading && (
                    <div className="text-center py-10">
                        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-slate-900 mb-4">
                            <Package className="h-8 w-8 text-slate-600" />
                        </div>
                        <h3 className="text-slate-200 font-medium">Sin pedidos activos</h3>
                        <p className="text-slate-500 text-sm mt-1">Comienza registrando una nueva orden</p>
                    </div>
                )}

                {orders.map((order) => (
                    <div key={order.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 active:scale-[0.99] transition-transform">
                        <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-2">
                                <StatusBadge status={order.delivery_status || 'pending'} />
                                <span className="text-xs text-slate-500">
                                    {formatDistanceToNow(new Date(order.created_at), { addSuffix: true, locale: es })}
                                </span>
                            </div>
                            <span className="font-mono font-bold text-emerald-400 text-lg">
                                ${order.total.toLocaleString()}
                            </span>
                        </div>

                        <div className="mb-3">
                            <h3 className="font-bold text-white text-base">
                                {order.customer?.name || "Cliente Mostrador"}
                            </h3>
                            <div className="flex items-start gap-1.5 mt-1 text-slate-400 text-sm">
                                <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-slate-500" />
                                <p className="leading-snug">
                                    {order.customer?.address || "Retira en local"}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 pt-3 border-t border-slate-800">
                            <Button
                                size="sm"
                                variant="ghost"
                                className="flex-1 h-9 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs"
                                onClick={() => handleViewDetails(order.id)}
                            >
                                Ver Detalles
                            </Button>
                            {/* Acciones Rápidas según estado */}
                            {(order.delivery_status === 'pending' || !order.delivery_status) && (
                                <Button
                                    size="sm"
                                    className="flex-1 h-9 bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 border border-orange-500/20 text-xs"
                                    onClick={() => handleUpdateStatus(order.id, 'preparing')}
                                >
                                    <ChefHat className="h-3 w-3 mr-1.5" />
                                    A Cocina
                                </Button>
                            )}
                            {order.delivery_status === 'preparing' && (
                                <Button
                                    size="sm"
                                    className="flex-1 h-9 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 text-xs"
                                    onClick={() => handleUpdateStatus(order.id, 'ready')}
                                >
                                    <CheckCircle2 className="h-3 w-3 mr-1.5" />
                                    Listo
                                </Button>
                            )}
                            {order.delivery_status === 'ready' && (
                                <Button
                                    size="sm"
                                    className="flex-1 h-9 bg-purple-500/10 hover:bg-purple-500/20 text-purple-500 border border-purple-500/20 text-xs"
                                    onClick={() => handleUpdateStatus(order.id, 'out_for_delivery')}
                                >
                                    <Truck className="h-3 w-3 mr-1.5" />
                                    Enviar
                                </Button>
                            )}
                            {order.delivery_status === 'out_for_delivery' && (
                                <Button
                                    size="sm"
                                    className="flex-1 h-9 bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
                                    onClick={() => handleUpdateStatus(order.id, 'delivered')}
                                >
                                    <CheckCircle2 className="h-3 w-3 mr-1.5" />
                                    Entregado
                                </Button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Bottom Nav */}
            <div className="fixed bottom-0 left-0 right-0 bg-slate-950/95 backdrop-blur border-t border-slate-800 h-16 flex items-center justify-around px-2 z-50">
                <Link href="/delivery" className="flex flex-col items-center gap-1 text-emerald-500">
                    <Package className="h-5 w-5" />
                    <span className="text-[10px] font-medium">Pedidos</span>
                </Link>
                <Link href="/delivery/debtors" className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-100">
                    <User className="h-5 w-5" />
                    <span className="text-[10px] font-medium">Deudores</span>
                </Link>
                <Link href="/delivery/history" className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-100">
                    <Clock className="h-5 w-5" />
                    <span className="text-[10px] font-medium">Historial</span>
                </Link>
                <Button variant="ghost" size="icon" onClick={handleLogout} className="flex flex-col items-center gap-1 text-slate-400 hover:text-red-400 h-auto py-1">
                    <LogOut className="h-5 w-5" />
                    <span className="text-[10px] font-medium">Salir</span>
                </Button>
            </div>

            <OrderDetailsModal
                orderId={selectedOrderId}
                open={detailsOpen}
                onOpenChange={setDetailsOpen}
            />

            <DeliveryConfirmationModal
                orderId={orderToDeliver?.id || null}
                orderTotal={orderToDeliver?.total || 0}
                currentPaymentMethod={orderToDeliver?.payment_method || "cash"}
                open={deliveryConfirmOpen}
                onOpenChange={setDeliveryConfirmOpen}
                onSuccess={fetchOrders}
            />
        </div >
    );
}
