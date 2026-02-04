
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
                    customer:customers(name, address, phone),
                    order_items(quantity, product_name)
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

    // Helper to format item summary
    const getOrderSummary = (items: any[]) => {
        if (!items || items.length === 0) return "Sin items";
        return items.map(i => `${i.quantity}x ${i.product_name}`).join(", ");
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

    // Grouping Logic
    const groupedOrders = orders.reduce((acc, order) => {
        const customerId = (order as any).customer_id || 'guest';
        const customerName = order.customer?.name || 'Cliente Mostrador';

        if (!acc[customerId]) {
            acc[customerId] = {
                customerId,
                customerName,
                customerAddress: order.customer?.address || 'Retira en local',
                customerPhone: order.customer?.phone || '',
                orders: [],
                totalAmount: 0,
                lastCreatedAt: order.created_at
            };
        }

        acc[customerId].orders.push(order);
        acc[customerId].totalAmount += order.total;
        if (new Date(order.created_at) > new Date(acc[customerId].lastCreatedAt)) {
            acc[customerId].lastCreatedAt = order.created_at;
        }

        return acc;
    }, {} as Record<string, any>);

    const sortedGroups = Object.values(groupedOrders).sort((a: any, b: any) =>
        new Date(b.lastCreatedAt).getTime() - new Date(a.lastCreatedAt).getTime()
    );

    const handleUpdateStatus = async (orderId: string, newStatus: string) => {
        try {
            const { error } = await supabase
                .from('orders')
                .update({ delivery_status: newStatus })
                .eq('id', orderId);

            if (error) throw error;
            toast.success("Estado actualizado");
            fetchOrders();
        } catch (e: any) {
            toast.error("Error: " + e.message);
        }
    };

    const handleDeliverGroup = (groupOrders: DeliveryOrder[]) => {
        setOrderToDeliver(groupOrders);
        setDeliveryConfirmOpen(true);
    }

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

            {/* Stats */}
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

            {/* Orders List (Grouped) */}
            <div className="p-4 space-y-4">
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Pedidos Activos</h2>

                {sortedGroups.length === 0 && !loading && (
                    <div className="text-center py-10">
                        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-slate-900 mb-4">
                            <Package className="h-8 w-8 text-slate-600" />
                        </div>
                        <h3 className="text-slate-200 font-medium">Sin pedidos activos</h3>
                        <p className="text-slate-500 text-sm mt-1">Comienza registrando una nueva orden</p>
                    </div>
                )}

                {sortedGroups.map((group: any) => (
                    <div key={group.customerId} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
                        {/* Group Header */}
                        <div className="p-4 bg-slate-900/50 border-b border-slate-800 flex justify-between items-start">
                            <div className="flex items-start gap-3">
                                <div className="h-10 w-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                                    <User className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-base text-white leading-tight">
                                        {group.customerName}
                                    </h3>
                                    <div className="flex items-center gap-1.5 mt-1 text-slate-400 text-xs">
                                        <MapPin className="h-3 w-3 shrink-0 text-slate-500" />
                                        <span>{group.customerAddress}</span>
                                    </div>
                                    <div className="mt-1">
                                        <Badge variant="outline" className="text-[10px] h-5 border-slate-700 text-slate-400">
                                            {group.orders.length} pedidos
                                        </Badge>
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="block text-2xl font-mono font-bold text-emerald-400">
                                    ${group.totalAmount.toLocaleString()}
                                </span>
                                <span className="text-[10px] text-slate-500 uppercase">Total Acumulado</span>
                            </div>
                        </div>

                        {/* Orders in Group */}
                        <div className="flex flex-col gap-2 p-2 bg-slate-950/20">
                            {group.orders.map((order: any, index: number) => (
                                <div key={order.id} className="bg-slate-900 border border-slate-800 rounded-lg p-3 hover:border-slate-700 transition-colors relative overflow-hidden group/item">
                                    {/* Numbering Badge */}
                                    <div className="absolute top-0 right-0 bg-slate-800 text-[10px] text-slate-400 px-2 py-0.5 rounded-bl-lg font-mono border-b border-l border-slate-700">
                                        #{group.orders.length - index}
                                    </div>

                                    <div className="flex justify-between items-start mb-2 pr-8">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xs font-bold ${order.delivery_status === 'delivered' ? 'text-slate-500' : 'text-emerald-400'}`}>
                                                    Pedido #{order.id.slice(0, 4)}
                                                </span>
                                                <StatusBadge status={order.delivery_status || 'pending'} />
                                            </div>
                                            <span className="text-[10px] text-slate-500">
                                                {formatDistanceToNow(new Date(order.created_at), { addSuffix: true, locale: es })}
                                            </span>
                                        </div>
                                        <span className="font-mono font-medium text-white">
                                            ${order.total.toLocaleString()}
                                        </span>
                                    </div>

                                    {/* Item Summary */}
                                    <div className="mb-3 text-xs text-slate-300 bg-slate-950/50 p-2 rounded border border-slate-800/50">
                                        {getOrderSummary(order.order_items)}
                                    </div>

                                    <div className="flex items-center gap-2 justify-end">
                                        {/* Individual Quick Actions */}
                                        {(order.delivery_status === 'pending' || !order.delivery_status) && (
                                            <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px] text-orange-500 hover:bg-orange-500/10 hover:text-orange-400" onClick={() => handleUpdateStatus(order.id, 'preparing')}>
                                                <ChefHat className="h-3 w-3 mr-1" /> Cocina
                                            </Button>
                                        )}
                                        {order.delivery_status === 'preparing' && (
                                            <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px] text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-400" onClick={() => handleUpdateStatus(order.id, 'ready')}>
                                                <CheckCircle2 className="h-3 w-3 mr-1" /> Listo
                                            </Button>
                                        )}
                                        {order.delivery_status === 'ready' && (
                                            <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px] text-purple-500 hover:bg-purple-500/10 hover:text-purple-400" onClick={() => handleUpdateStatus(order.id, 'out_for_delivery')}>
                                                <Truck className="h-3 w-3 mr-1" /> Enviar
                                            </Button>
                                        )}

                                        <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-500 hover:text-white" onClick={() => handleViewDetails(order.id)}>
                                            <Package className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Group Actions Footer */}
                        <div className="p-3 bg-slate-950/30 border-t border-slate-800 flex gap-2">
                            <Button
                                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white h-10"
                                onClick={() => handleDeliverGroup(group.orders)}
                            >
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Entregar / Cobrar ({group.orders.length})
                            </Button>
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
                orders={Array.isArray(orderToDeliver) ? orderToDeliver : (orderToDeliver ? [orderToDeliver] : [])}
                open={deliveryConfirmOpen}
                onOpenChange={setDeliveryConfirmOpen}
                onSuccess={fetchOrders}
            />
        </div>
    );
}
