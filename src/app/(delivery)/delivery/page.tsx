"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Truck, ShoppingCart, MapPin, User, LogOut, Clock, CheckCircle2, Package, AlertCircle, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOrganization } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { ShiftControl } from "@/components/delivery/ShiftControl";
import { OrderDetailsModal } from "@/components/delivery/OrderDetailsModal";
import { toast } from "sonner";

type DeliveryOrder = {
    id: string;
    lifecycle_status?: string;
    customer: { name: string; address: string; phone: string } | null;
    total: number;
    delivery_status: string;
    payment_status: string;
    payment_method: string;
    created_at: string;
    order_items?: { quantity: number; product_name: string }[];
};

export default function DeliveryHomePage() {
    const { profile, organization } = useOrganization();
    const [orders, setOrders] = useState<DeliveryOrder[]>([]);
    const [todayDelivered, setTodayDelivered] = useState({ count: 0, total: 0 });
    const [loading, setLoading] = useState(true);
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const supabase = createClient();

    const handleViewDetails = (id: string) => {
        setSelectedOrderId(id);
        setDetailsOpen(true);
    };

    const fetchOrders = async () => {
        if (!organization?.id) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('orders')
                .select(`
                    id,
                    total,
                    status,
                    lifecycle_status,
                    delivery_status,
                    payment_status,
                    payment_method,
                    created_at,
                    customer:customers(name, address, phone),
                    order_items(quantity, product_name)
                `)
                .eq('organization_id', organization.id)
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) throw error;

            if (data) {
                setOrders(data as any[]);
            }

            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);

            const { data: todayData, error: todayError } = await supabase
                .from('orders')
                .select('total, lifecycle_status, delivery_status')
                .eq('organization_id', organization.id)
                .gte('created_at', startOfDay.toISOString())
                .order('created_at', { ascending: false });

            if (todayError) throw todayError;

            const deliveredToday = (todayData || []).filter((order: any) => {
                const status = order.lifecycle_status || order.delivery_status;
                return status === 'delivered';
            });

            setTodayDelivered({
                count: deliveredToday.length,
                total: deliveredToday.reduce((acc: number, order: any) => acc + Number(order.total || 0), 0),
            });
        } catch (e) {
            console.error("Error fetching orders", e);
            setTodayDelivered({ count: 0, total: 0 });
        } finally {
            setLoading(false);
        }
    };

    const getCurrentStatus = (order: DeliveryOrder) => {
        if (order.lifecycle_status) return order.lifecycle_status;
        if (order.delivery_status === "out_for_delivery") return "in_delivery";
        if (order.delivery_status === "cancelled") return "not_delivered";
        return order.delivery_status || "assigned";
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
            draft: "bg-slate-500/20 text-slate-300 border-slate-500/20",
            confirmed: "bg-blue-500/20 text-blue-400 border-blue-500/20",
            assigned: "bg-indigo-500/20 text-indigo-400 border-indigo-500/20",
            in_delivery: "bg-purple-500/20 text-purple-400 border-purple-500/20",
            delivered: "bg-emerald-500/20 text-emerald-400 border-emerald-500/20",
            not_delivered: "bg-red-500/20 text-red-500 border-red-500/20",
            rescheduled: "bg-yellow-500/20 text-yellow-400 border-yellow-500/20",
            cancelled: "bg-red-500/20 text-red-500 border-red-500/20",
        };

        const labels: Record<string, string> = {
            draft: "Borrador",
            confirmed: "Confirmado",
            assigned: "Asignado",
            in_delivery: "En Reparto",
            delivered: "Entregado",
            not_delivered: "No Entregado",
            rescheduled: "Reprogramado",
            cancelled: "Cancelado",
        };

        return (
            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${styles[status] || styles.pending}`}>
                {labels[status] || status}
            </span>
        );
    };

    const handleUpdateStatus = async (orderId: string, newStatus: string) => {
        try {
            const { data, error } = await supabase.rpc("set_order_status", {
                p_org_id: organization?.id,
                p_order_id: orderId,
                p_new_status: newStatus,
                p_notes: "Actualizado desde centro operativo",
            });

            if (error) throw error;
            if (data?.success === false) throw new Error(data?.error || "No se pudo actualizar estado");
            toast.success("Estado actualizado");
            fetchOrders();
        } catch (e: any) {
            toast.error("Error: " + e.message);
        }
    };

    const actionableOrders = orders
        .filter((order) => ["confirmed", "assigned", "in_delivery", "rescheduled"].includes(getCurrentStatus(order)))
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .slice(0, 8);

    const kpis = {
        toAssign: orders.filter((o) => getCurrentStatus(o) === "confirmed").length,
        inRoute: orders.filter((o) => getCurrentStatus(o) === "in_delivery").length,
        delivered: orders.filter((o) => getCurrentStatus(o) === "delivered").length,
        pendingPayment: orders.filter((o) => o.payment_status === "pending" || o.payment_status === "partial").length,
    };

    return (
        <div className="min-h-screen bg-slate-950 pb-20">
            {/* Header */}
            <div className="sticky top-0 z-20 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 px-4 py-3">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                            Centro de Operaciones
                        </h1>
                        <p className="text-xs text-slate-400 font-medium">
                            {organization?.name || 'Panel de Reparto'} • Preventa + Entrega
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <ShiftControl />
                        <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                            <span className="font-bold text-xs text-emerald-400">
                                {profile?.full_name?.substring(0, 2).toUpperCase() || 'OP'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-3 gap-2 px-4 mt-4">
                <Link href="/delivery/order">
                    <Button className="w-full bg-emerald-600 hover:bg-emerald-500 text-white h-11">
                        <ShoppingCart className="h-4 w-4 mr-2" />
                        Tomar Pedido
                    </Button>
                </Link>
                <Link href="/delivery/routes">
                    <Button variant="outline" className="w-full border-slate-700 text-slate-200 h-11">
                        <MapPin className="h-4 w-4 mr-2" />
                        Mi Ruta
                    </Button>
                </Link>
                <Link href="/delivery/orders">
                    <Button variant="outline" className="w-full border-slate-700 text-slate-200 h-11">
                        <Truck className="h-4 w-4 mr-2" />
                        Entregas
                    </Button>
                </Link>
            </div>

            {/* KPI */}
            <div className="grid grid-cols-2 gap-3 px-4 mt-4">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                    <p className="text-xs text-slate-500 uppercase">Para asignar</p>
                    <p className="text-2xl font-bold text-blue-400">{kpis.toAssign}</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                    <p className="text-xs text-slate-500 uppercase">En reparto</p>
                    <p className="text-2xl font-bold text-purple-400">{kpis.inRoute}</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                    <p className="text-xs text-slate-500 uppercase">Entregados</p>
                    <p className="text-2xl font-bold text-emerald-400">{kpis.delivered}</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                    <p className="text-xs text-slate-500 uppercase">Con deuda</p>
                    <p className="text-2xl font-bold text-red-400">{kpis.pendingPayment}</p>
                </div>
            </div>

            <div className="px-4 mt-3">
                <Link href="/delivery/history">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs uppercase text-slate-500">Entregas de hoy</p>
                            <p className="text-lg font-bold text-emerald-400">{todayDelivered.count} entregas</p>
                            <p className="text-xs text-slate-400">Total: ${todayDelivered.total.toLocaleString()}</p>
                        </div>
                        <span className="text-xs text-emerald-400 font-medium">Ver realizadas</span>
                    </div>
                </Link>
            </div>

            {/* Action Queue */}
            <div className="p-4 space-y-4">
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Cola Operativa</h2>

                {actionableOrders.length === 0 && !loading && (
                    <div className="text-center py-10">
                        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-slate-900 mb-4">
                            <Package className="h-8 w-8 text-slate-600" />
                        </div>
                        <h3 className="text-slate-200 font-medium">Sin tareas pendientes</h3>
                        <p className="text-slate-500 text-sm mt-1">La operación del día está al día</p>
                    </div>
                )}

                {actionableOrders.map((order) => {
                    const status = getCurrentStatus(order);
                    return (
                        <div key={order.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                            <div className="flex items-start justify-between gap-3 mb-3">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="font-bold text-white">{order.customer?.name || "Cliente"}</p>
                                        <StatusBadge status={status} />
                                    </div>
                                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                                        <MapPin className="h-3 w-3" />
                                        {order.customer?.address || "Sin dirección"}
                                    </p>
                                    <p className="text-[11px] text-slate-500 mt-1">
                                        {formatDistanceToNow(new Date(order.created_at), { addSuffix: true, locale: es })}
                                    </p>
                                </div>
                                <p className="font-mono text-lg font-bold text-emerald-400">
                                    ${order.total.toLocaleString()}
                                </p>
                            </div>

                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                    <Package className="h-3.5 w-3.5" />
                                    <span>{order.order_items?.length || 0} ítems</span>
                                    <Wallet className="h-3.5 w-3.5 ml-2" />
                                    <span>{order.payment_status === "paid" ? "Pagado" : "Pendiente"}</span>
                                </div>

                                <div className="flex items-center gap-2">
                                    {(status === "confirmed" || status === "assigned" || status === "rescheduled") && (
                                        <Button
                                            size="sm"
                                            className="h-8 bg-purple-600 hover:bg-purple-500 text-white"
                                            onClick={() => handleUpdateStatus(order.id, "in_delivery")}
                                        >
                                            Iniciar
                                        </Button>
                                    )}
                                    {status === "in_delivery" && (
                                        <Link href={`/delivery/orders?orderId=${order.id}`}>
                                            <Button
                                                size="sm"
                                                className="h-8 bg-emerald-600 hover:bg-emerald-500 text-white"
                                            >
                                                Entregar
                                            </Button>
                                        </Link>
                                    )}
                                    <Button size="sm" variant="outline" className="h-8 border-slate-700 text-slate-200" onClick={() => handleViewDetails(order.id)}>
                                        Ver
                                    </Button>
                                </div>
                            </div>
                        </div>
                    );
                })}
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
                onSuccess={fetchOrders}
            />
        </div>
    );
}
