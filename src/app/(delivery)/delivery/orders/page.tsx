"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
    Loader2,
    Package,
    MapPin,
    Phone,
    DollarSign,
    CheckCircle2,
    XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function DeliveryOrdersPage() {
    const { profile, organizationId } = useOrganization();
    const supabase = createClient();
    const [loading, setLoading] = useState(true);
    const [orders, setOrders] = useState<any[]>([]);
    const [activeRoute, setActiveRoute] = useState<any>(null);

    useEffect(() => {
        if (profile?.id && organizationId) {
            fetchMyOrders();
            
            // Realtime subscription
            const channel = supabase
                .channel("driver-orders-updates")
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table: "orders",
                        filter: `organization_id=eq.${organizationId}`,
                    },
                    () => {
                        fetchMyOrders();
                    }
                )
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }
    }, [profile?.id, organizationId]);

    const fetchMyOrders = async () => {
        setLoading(true);
        try {
            // Primero, buscar mi ruta activa
            const { data: routeData, error: routeError } = await supabase
                .from("routes")
                .select("*")
                .eq("driver_id", profile?.id)
                .eq("organization_id", organizationId)
                .in("status", ["planned", "in_progress"])
                .maybeSingle();

            if (routeError && routeError.code !== "PGRST116") throw routeError;

            setActiveRoute(routeData);

            if (!routeData) {
                setOrders([]);
                setLoading(false);
                return;
            }

            // Traer pedidos de mi ruta
            const { data: ordersData, error: ordersError } = await supabase
                .from("orders")
                .select(`
                    *,
                    customer:customers(name, phone, address, zone),
                    order_items(
                        id,
                        product_name,
                        quantity,
                        unit_price,
                        total
                    ),
                    route_stops(stop_order)
                `)
                .eq("route_id", routeData.id)
                .order("created_at", { ascending: true });

            if (ordersError) throw ordersError;

            setOrders(ordersData || []);
        } catch (error: any) {
            console.error("Error fetching orders:", error);
            toast.error("Error al cargar pedidos");
        } finally {
            setLoading(false);
        }
    };

    const handleMarkDelivered = async (orderId: string) => {
        try {
            const { error } = await supabase
                .from("orders")
                .update({ delivery_status: "delivered" })
                .eq("id", orderId);

            if (error) throw error;
            toast.success("Pedido marcado como entregado");
            fetchMyOrders();
        } catch (error: any) {
            console.error("Error:", error);
            toast.error("Error al actualizar pedido");
        }
    };

    const handleMarkNotHome = async (orderId: string) => {
        try {
            const { error } = await supabase
                .from("orders")
                .update({ 
                    delivery_status: "cancelled",
                    delivery_notes: "Cliente no estaba en casa"
                })
                .eq("id", orderId);

            if (error) throw error;
            toast.success("Marcado como no disponible");
            fetchMyOrders();
        } catch (error: any) {
            console.error("Error:", error);
            toast.error("Error al actualizar pedido");
        }
    };

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            assigned_to_route: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
            out_for_delivery: "bg-purple-500/10 text-purple-400 border-purple-500/20",
            delivered: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
            cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
        };
        
        const labels: Record<string, string> = {
            assigned_to_route: "Asignado",
            out_for_delivery: "En Camino",
            delivered: "Entregado",
            cancelled: "Cancelado",
        };

        return (
            <Badge className={`${styles[status] || ""} border text-xs`}>
                {labels[status] || status}
            </Badge>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-950">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!activeRoute) {
        return (
            <div className="min-h-screen bg-slate-950 p-6">
                <div className="max-w-2xl mx-auto">
                    <Card className="p-12 text-center bg-slate-900 border-slate-800">
                        <MapPin className="h-16 w-16 mx-auto mb-4 text-slate-600" />
                        <h2 className="text-2xl font-bold text-white mb-2">
                            No tienes rutas activas
                        </h2>
                        <p className="text-slate-400">
                            Contacta con tu supervisor para que te asigne una ruta
                        </p>
                    </Card>
                </div>
            </div>
        );
    }

    const pendingOrders = orders.filter(o => o.delivery_status !== 'delivered' && o.delivery_status !== 'cancelled');
    const completedOrders = orders.filter(o => o.delivery_status === 'delivered');

    return (
        <div className="min-h-screen bg-slate-950 pb-20">
            {/* Header */}
            <div className="sticky top-0 z-20 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 p-4">
                <div className="max-w-2xl mx-auto">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-xl font-bold text-white">Mis Pedidos</h1>
                            <p className="text-sm text-slate-400">{activeRoute.name}</p>
                        </div>
                        <div className="text-right">
                            <div className="text-2xl font-bold text-white">{pendingOrders.length}</div>
                            <div className="text-xs text-slate-400">Pendientes</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="max-w-2xl mx-auto p-4 grid grid-cols-3 gap-3">
                <Card className="p-4 bg-slate-900/50 border-slate-800">
                    <div className="text-2xl font-bold text-white">{orders.length}</div>
                    <div className="text-xs text-slate-400">Total</div>
                </Card>
                <Card className="p-4 bg-emerald-500/10 border-emerald-500/20">
                    <div className="text-2xl font-bold text-emerald-400">{completedOrders.length}</div>
                    <div className="text-xs text-emerald-400">Entregados</div>
                </Card>
                <Card className="p-4 bg-purple-500/10 border-purple-500/20">
                    <div className="text-2xl font-bold text-purple-400">{pendingOrders.length}</div>
                    <div className="text-xs text-purple-400">Pendientes</div>
                </Card>
            </div>

            {/* Orders List */}
            <div className="max-w-2xl mx-auto p-4 space-y-4">
                {pendingOrders.length === 0 ? (
                    <Card className="p-12 text-center bg-slate-900 border-slate-800">
                        <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-emerald-500" />
                        <h3 className="text-lg font-semibold text-white mb-2">
                            ¡Todos los pedidos entregados!
                        </h3>
                        <p className="text-slate-400">
                            Has completado todos los pedidos de tu ruta
                        </p>
                    </Card>
                ) : (
                    pendingOrders.map((order) => (
                        <Card key={order.id} className="p-4 bg-slate-900 border-slate-800">
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                    <h3 className="font-semibold text-white mb-1">
                                        {order.customer?.name || "Cliente sin nombre"}
                                    </h3>
                                    <div className="flex flex-col gap-1 text-sm text-slate-400">
                                        {order.customer?.address && (
                                            <div className="flex items-center gap-1">
                                                <MapPin className="h-3 w-3" />
                                                {order.customer.address}
                                            </div>
                                        )}
                                        {order.customer?.phone && (
                                            <div className="flex items-center gap-1">
                                                <Phone className="h-3 w-3" />
                                                {order.customer.phone}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {getStatusBadge(order.delivery_status)}
                            </div>

                            <div className="flex items-center gap-2 mb-3 text-sm">
                                <Package className="h-4 w-4 text-slate-400" />
                                <span className="text-slate-300">
                                    {order.order_items?.length || 0} productos
                                </span>
                                <DollarSign className="h-4 w-4 text-slate-400 ml-2" />
                                <span className="text-white font-semibold">
                                    ${order.total.toLocaleString()}
                                </span>
                            </div>

                            {order.delivery_status !== 'delivered' && order.delivery_status !== 'cancelled' && (
                                <div className="flex gap-2 pt-3 border-t border-slate-800">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="flex-1 border-red-500/20 text-red-400 hover:bg-red-500/10"
                                        onClick={() => handleMarkNotHome(order.id)}
                                    >
                                        <XCircle className="h-4 w-4 mr-1.5" />
                                        No estaba
                                    </Button>
                                    <Button
                                        size="sm"
                                        className="flex-1 bg-emerald-600 hover:bg-emerald-500"
                                        onClick={() => handleMarkDelivered(order.id)}
                                    >
                                        <CheckCircle2 className="h-4 w-4 mr-1.5" />
                                        Entregar
                                    </Button>
                                </div>
                            )}
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
}
