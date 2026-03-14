"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
    const searchParams = useSearchParams();
    const supabase = createClient();
    const [loading, setLoading] = useState(true);
    const [orders, setOrders] = useState<any[]>([]);
    const [activeRoute, setActiveRoute] = useState<any>(null);
    const [withoutRouteMode, setWithoutRouteMode] = useState(false);
    const [allowWithoutRouteMode, setAllowWithoutRouteMode] = useState(true);
    const [routeModeBlocked, setRouteModeBlocked] = useState(false);
    const [deliveryOrder, setDeliveryOrder] = useState<any | null>(null);
    const [paymentAmount, setPaymentAmount] = useState<string>("");
    const [paymentMethod, setPaymentMethod] = useState<string>("cash");
    const [deliveryConfirmed, setDeliveryConfirmed] = useState(false);
    const [submittingDelivery, setSubmittingDelivery] = useState(false);
    const targetOrderId = searchParams.get("orderId");
    const deliveryFlow = [
        {
            title: "1) Revisar pendientes",
            description: "Trabaja la lista Pendientes por entregar de arriba hacia abajo.",
        },
        {
            title: "2) Si no estaba el cliente",
            description: "Usa No estaba para registrar la incidencia y seguir con el siguiente pedido.",
        },
        {
            title: "3) Si entregaste",
            description: "Usa Entregar + Cobrar, confirma método, monto y luego marca la entrega.",
        },
        {
            title: "4) Verificación final",
            description: "El pedido pasa a Entregas realizadas y se actualiza el estado/pago en el sistema.",
        },
    ];

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
            const { data: orgSettings, error: orgSettingsError } = await supabase
                .from("organizations")
                .select("delivery_without_route_mode")
                .eq("id", organizationId)
                .maybeSingle();

            if (orgSettingsError) {
                console.warn("Could not load delivery route policy, fallback to enabled mode", orgSettingsError);
            }

            const canUseWithoutRouteMode = orgSettings?.delivery_without_route_mode !== false;
            setAllowWithoutRouteMode(canUseWithoutRouteMode);

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
            setWithoutRouteMode(false);
            setRouteModeBlocked(false);

            if (!routeData) {
                if (!canUseWithoutRouteMode) {
                    setOrders([]);
                    setRouteModeBlocked(true);
                    setLoading(false);
                    return;
                }

                // Modo sin rutas: cargar pedidos del repartidor o pedidos operables de delivery
                const runSafeQuery = async (queryPromise: Promise<any>) => {
                    try {
                        const res = await queryPromise;
                        if (!res || typeof res !== "object") {
                            return {
                                data: null,
                                error: { message: "Respuesta invalida de Supabase" },
                            };
                        }
                        return {
                            data: "data" in res ? res.data : null,
                            error: "error" in res ? res.error : null,
                        };
                    } catch (queryError: any) {
                        return {
                            data: null,
                            error: queryError || { message: "Error desconocido en consulta" },
                        };
                    }
                };

                let fallbackRows: any[] = [];

                const assignedToDriverQuery = await runSafeQuery(
                    supabase
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
                            order_payments(
                                id,
                                amount,
                                method
                            )
                        `)
                        .eq("organization_id", organizationId)
                        .eq("assigned_to", profile?.id)
                        .not("delivery_status", "eq", "delivered")
                        .order("created_at", { ascending: true })
                );

                if (!assignedToDriverQuery.error) {
                    fallbackRows = Array.isArray(assignedToDriverQuery.data) ? assignedToDriverQuery.data : [];
                }

                if (assignedToDriverQuery.error || fallbackRows.length === 0) {
                    const lifecycleFallbackQuery = await runSafeQuery(
                        supabase
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
                                order_payments(
                                    id,
                                    amount,
                                    method
                                )
                            `)
                            .eq("organization_id", organizationId)
                            .in("lifecycle_status", ["assigned", "in_delivery", "rescheduled", "confirmed"])
                            .order("created_at", { ascending: true })
                    );

                    if (!lifecycleFallbackQuery.error) {
                        fallbackRows = Array.isArray(lifecycleFallbackQuery.data) ? lifecycleFallbackQuery.data : [];
                    }
                }

                if (fallbackRows.length === 0) {
                    const legacyFallbackQuery = await runSafeQuery(
                        supabase
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
                                order_payments(
                                    id,
                                    amount,
                                    method
                                )
                            `)
                            .eq("organization_id", organizationId)
                            .in("delivery_status", ["assigned_to_route", "out_for_delivery", "in_delivery", "ready", "confirmed"])
                            .order("created_at", { ascending: true })
                    );

                    if (legacyFallbackQuery.error) {
                        throw legacyFallbackQuery.error;
                    }

                    fallbackRows = Array.isArray(legacyFallbackQuery.data) ? legacyFallbackQuery.data : [];
                }

                setWithoutRouteMode(true);
                setOrders(fallbackRows);
                setLoading(false);
                return;
            }

            // Traer pedidos de mi ruta con fallback progresivo para esquemas legacy
            let ordersData: any[] | null = null;
            let ordersError: any = null;

            const runSafeQuery = async (queryPromise: Promise<any>) => {
                try {
                    const res = await queryPromise;
                    if (!res || typeof res !== "object") {
                        return {
                            data: null,
                            error: { message: "Respuesta invalida de Supabase" },
                        };
                    }
                    return {
                        data: "data" in res ? res.data : null,
                        error: "error" in res ? res.error : null,
                    };
                } catch (queryError: any) {
                    return {
                        data: null,
                        error: queryError || { message: "Error desconocido en consulta" },
                    };
                }
            };

            const fullQuery = await runSafeQuery(
                supabase
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
                        order_payments(
                            id,
                            amount,
                            method
                        )
                    `)
                    .eq("assigned_route_id", routeData.id)
                    .order("created_at", { ascending: true })
            );

            ordersData = fullQuery.data;
            ordersError = fullQuery.error;

            if (ordersError) {
                console.warn("Full delivery orders query failed, trying fallback without route_stops", {
                    message: ordersError?.message || null,
                    code: ordersError?.code || null,
                    details: ordersError?.details || null,
                    hint: ordersError?.hint || null,
                });

                const relationFallbackQuery = await runSafeQuery(
                    supabase
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
                            )
                        `)
                        .eq("assigned_route_id", routeData.id)
                        .order("created_at", { ascending: true })
                );

                ordersData = relationFallbackQuery.data;
                ordersError = relationFallbackQuery.error;
            }

            if (ordersError) {
                console.warn("Relation fallback failed, trying basic orders query", {
                    message: ordersError?.message || null,
                    code: ordersError?.code || null,
                    details: ordersError?.details || null,
                    hint: ordersError?.hint || null,
                });

                const basicQuery = await runSafeQuery(
                    supabase
                        .from("orders")
                        .select("*")
                        .eq("assigned_route_id", routeData.id)
                        .order("created_at", { ascending: true })
                );

                if (basicQuery.error) throw basicQuery.error;

                const baseRows = Array.isArray(basicQuery.data) ? basicQuery.data : [];
                const customerIds = Array.from(new Set(baseRows.map((row: any) => row.customer_id).filter(Boolean)));
                const orderIds = baseRows.map((row: any) => row.id).filter(Boolean);

                const [customersRes, itemsRes, paymentsRes, stopsRes] = await Promise.all([
                    customerIds.length > 0
                        ? supabase
                            .from("customers")
                            .select("id, name, phone, address, zone")
                            .in("id", customerIds)
                        : Promise.resolve({ data: [], error: null } as any),
                    orderIds.length > 0
                        ? supabase
                            .from("order_items")
                            .select("id, order_id, product_name, quantity, unit_price, total")
                            .in("order_id", orderIds)
                        : Promise.resolve({ data: [], error: null } as any),
                    orderIds.length > 0
                        ? supabase
                            .from("order_payments")
                            .select("id, order_id, amount, method")
                            .in("order_id", orderIds)
                        : Promise.resolve({ data: [], error: null } as any),
                    orderIds.length > 0
                        ? supabase
                            .from("route_stops")
                            .select("id, order_id, stop_order, visit_status")
                            .eq("route_id", routeData.id)
                            .in("order_id", orderIds)
                        : Promise.resolve({ data: [], error: null } as any),
                ]);

                if (customersRes.error || itemsRes.error || paymentsRes.error || stopsRes.error) {
                    throw customersRes.error || itemsRes.error || paymentsRes.error || stopsRes.error;
                }

                const customersById = new Map((customersRes.data || []).map((c: any) => [c.id, c]));
                const itemsByOrderId = new Map<string, any[]>();
                const paymentsByOrderId = new Map<string, any[]>();
                const stopsByOrderId = new Map<string, any[]>();

                for (const item of itemsRes.data || []) {
                    const list = itemsByOrderId.get(item.order_id) || [];
                    list.push(item);
                    itemsByOrderId.set(item.order_id, list);
                }

                for (const payment of paymentsRes.data || []) {
                    const list = paymentsByOrderId.get(payment.order_id) || [];
                    list.push(payment);
                    paymentsByOrderId.set(payment.order_id, list);
                }

                for (const stop of stopsRes.data || []) {
                    const list = stopsByOrderId.get(stop.order_id) || [];
                    list.push(stop);
                    stopsByOrderId.set(stop.order_id, list);
                }

                ordersData = baseRows.map((row: any) => ({
                    ...row,
                    customer: row.customer_id ? customersById.get(row.customer_id) || null : null,
                    order_items: itemsByOrderId.get(row.id) || [],
                    order_payments: paymentsByOrderId.get(row.id) || [],
                    route_stops: stopsByOrderId.get(row.id) || [],
                }));
            }

            setOrders(ordersData || []);
        } catch (error: any) {
            console.error("Error fetching orders:", {
                message: error?.message || "unknown",
                code: error?.code || "unknown",
                details: error?.details || null,
                hint: error?.hint || null,
                type: typeof error,
            });
            toast.error("Error al cargar pedidos");
        } finally {
            setLoading(false);
        }
    };

    const openDeliverDialog = (order: any) => {
        setDeliveryOrder(order);
        setPaymentAmount(String(Number(order.total || 0)));
        setPaymentMethod(order.payment_method || "cash");
        setDeliveryConfirmed(false);
    };

    const closeDeliverDialog = () => {
        if (submittingDelivery) return;
        setDeliveryOrder(null);
        setPaymentAmount("");
        setPaymentMethod("cash");
        setDeliveryConfirmed(false);
    };

    const getPaymentMethodLabel = (method?: string) => {
        if (!method) return "Sin definir";

        const normalized = method.toLowerCase();
        const labels: Record<string, string> = {
            cash: "Efectivo",
            transfer: "Transferencia",
            card: "Tarjeta",
            mixed: "Mixto",
            fiado: "Fiado",
            credit: "Cuenta Corriente",
            current_account: "Cuenta Corriente",
            cuenta_corriente: "Cuenta Corriente",
        };

        return labels[normalized] || method;
    };

    const handleMarkDelivered = async () => {
        if (!deliveryOrder) return;

        const amount = Number(paymentAmount || 0);
        const totalAmount = Number(deliveryOrder.total || 0);
        const normalizedMethod = String(paymentMethod || "").toLowerCase();
        const allowsPendingBalance = ["fiado", "credit", "current_account", "cuenta_corriente"].includes(normalizedMethod);
        const pendingAmount = Math.max(0, totalAmount - amount);
        const paymentAuditNote = `Metodo=${getPaymentMethodLabel(paymentMethod)}; Cobrado=${amount}; Total=${totalAmount}; Saldo=${pendingAmount}`;

        if (Number.isNaN(amount) || amount < 0) {
            toast.error("Monto inválido");
            return;
        }

        if (!allowsPendingBalance && amount < totalAmount) {
            toast.error("Para este método debes cobrar el total del pedido");
            return;
        }

        if (!deliveryConfirmed) {
            toast.error("Confirma la entrega antes de continuar");
            return;
        }

        setSubmittingDelivery(true);
        try {
            const { error: methodError } = await supabase
                .from("orders")
                .update({ payment_method: paymentMethod })
                .eq("id", deliveryOrder.id)
                .eq("organization_id", organizationId);

            if (methodError) throw methodError;

            if (amount > 0) {
                const { data: paymentData, error: paymentError } = await supabase.rpc("register_order_payment", {
                    p_org_id: organizationId,
                    p_order_id: deliveryOrder.id,
                    p_method: paymentMethod,
                    p_amount: amount,
                    p_reference: null,
                    p_notes: `Cobro registrado al entregar. ${paymentAuditNote}`,
                });

                if (paymentError) throw paymentError;
                if (paymentData?.success === false) throw new Error(paymentData?.error || "No se pudo registrar el cobro");
            }

            const { data, error } = await supabase.rpc("set_order_status", {
                p_org_id: organizationId,
                p_order_id: deliveryOrder.id,
                p_new_status: "delivered",
                p_notes: `Entregado por repartidor. ${paymentAuditNote}`,
            });

            if (error) throw error;
            if (data?.success === false) throw new Error(data?.error || "No se pudo marcar como entregado");

            if (activeRoute?.id) {
                await supabase
                    .from("route_stops")
                    .update({
                        visit_status: "visited",
                        visited_at: new Date().toISOString(),
                        visit_notes: `Entrega registrada. Metodo=${getPaymentMethodLabel(paymentMethod)}; Cobrado=${amount}`,
                    })
                    .eq("order_id", deliveryOrder.id)
                    .eq("route_id", activeRoute.id);
            }

            toast.success(amount > 0 ? "Pedido entregado y cobro registrado" : "Pedido marcado como entregado");
            closeDeliverDialog();
            fetchMyOrders();
        } catch (error: any) {
            console.error("Error:", error);
            toast.error("Error al actualizar pedido");
        } finally {
            setSubmittingDelivery(false);
        }
    };

    const handleMarkNotHome = async (orderId: string) => {
        try {
            const { data, error } = await supabase.rpc("mark_order_incident", {
                p_org_id: organizationId,
                p_order_id: orderId,
                p_incident: "not_home",
                p_notes: "Cliente no estaba en casa",
            });

            if (error) throw error;
            if (data?.success === false) throw new Error(data?.error || "No se pudo registrar incidencia");

            if (activeRoute?.id) {
                await supabase
                    .from("route_stops")
                    .update({
                        visit_status: "not_home",
                        visited_at: new Date().toISOString(),
                        visit_notes: "Cliente no estaba en casa",
                    })
                    .eq("order_id", orderId)
                    .eq("route_id", activeRoute.id);
            }

            toast.success("Marcado como no disponible");
            fetchMyOrders();
        } catch (error: any) {
            console.error("Error:", error);
            toast.error("Error al actualizar pedido");
        }
    };

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            assigned: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
            in_delivery: "bg-purple-500/10 text-purple-400 border-purple-500/20",
            not_delivered: "bg-red-500/10 text-red-400 border-red-500/20",
            rescheduled: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
            assigned_to_route: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
            out_for_delivery: "bg-purple-500/10 text-purple-400 border-purple-500/20",
            delivered: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
            cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
        };
        
        const labels: Record<string, string> = {
            assigned: "Asignado",
            in_delivery: "En Camino",
            not_delivered: "No Entregado",
            rescheduled: "Reprogramado",
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

    const getOrderPaymentSummary = (order: any) => {
        const payments = Array.isArray(order?.order_payments) ? order.order_payments : [];
        const methods: string[] = Array.from(
            new Set(
                payments
                    .map((p: any) => String(p.method || p.payment_method || "").toLowerCase())
                    .filter(Boolean)
            )
        );

        if (methods.length > 1) return "Mixto";
        if (methods.length === 1) return getPaymentMethodLabel(methods[0]);
        return getPaymentMethodLabel(order?.payment_method);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-950">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    const getCurrentStatus = (order: any) => order.lifecycle_status || order.delivery_status || "pending";
    const pendingOrders = orders.filter((o) => !["delivered", "cancelled", "not_delivered"].includes(getCurrentStatus(o)));
    const completedOrders = orders.filter((o) => getCurrentStatus(o) === "delivered");
    const recentCompleted = completedOrders
        .slice()
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 8);

    const deliveryTotalAmount = Number(deliveryOrder?.total || 0);
    const currentPaymentAmount = Number(paymentAmount || 0);
    const currentMethod = String(paymentMethod || "").toLowerCase();
    const currentMethodAllowsPending = ["fiado", "credit", "current_account", "cuenta_corriente"].includes(currentMethod);
    const pendingAmount = Math.max(0, deliveryTotalAmount - currentPaymentAmount);
    const fullPaymentRequiredAndMissing = !currentMethodAllowsPending && currentPaymentAmount < deliveryTotalAmount;

    return (
        <div className="min-h-screen bg-slate-950 pb-20">
            {/* Header */}
            <div className="sticky top-0 z-20 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 p-4">
                <div className="max-w-2xl mx-auto">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-xl font-bold text-white">Operación de Entrega</h1>
                            <p className="text-sm text-slate-400">
                                {activeRoute?.name || (routeModeBlocked ? "Esperando ruta activa" : "Modo sin rutas")}
                            </p>
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

            {/* Quick Guide */}
            <div className="max-w-2xl mx-auto px-4">
                <Card className="p-4 bg-blue-500/10 border-blue-500/20">
                    <h2 className="text-sm font-semibold text-blue-300 mb-3">Guia rapida de entregas</h2>
                    {!allowWithoutRouteMode && (
                        <p className="text-xs text-blue-100/80 mb-3">
                            Política activa: se requiere ruta asignada para operar pedidos en esta pantalla.
                        </p>
                    )}
                    {withoutRouteMode && (
                        <p className="text-xs text-blue-100/80 mb-3">
                            Modo sin rutas activo: se muestran pedidos operables sin depender de una ruta asignada.
                        </p>
                    )}
                    <div className="space-y-2">
                        {deliveryFlow.map((step) => (
                            <div key={step.title}>
                                <p className="text-sm text-white font-medium">{step.title}</p>
                                <p className="text-xs text-blue-100/80">{step.description}</p>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

            {/* Orders List */}
            <div className="max-w-2xl mx-auto p-4 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Pendientes por entregar</h2>
                    <span className="text-xs text-slate-400">{pendingOrders.length} pedidos</span>
                </div>

                {pendingOrders.length === 0 ? (
                    <Card className="p-12 text-center bg-slate-900 border-slate-800">
                        <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-emerald-500" />
                        <h3 className="text-lg font-semibold text-white mb-2">
                            ¡Todos los pedidos entregados!
                        </h3>
                        <p className="text-slate-400">
                            {routeModeBlocked
                                ? "No hay ruta activa asignada. Pide a un administrador que te asigne una ruta para continuar."
                                : "Has completado todos los pedidos de tu ruta"}
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
                                {getStatusBadge(getCurrentStatus(order))}
                            </div>

                            {targetOrderId === order.id && (
                                <div className="mb-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2 text-xs text-emerald-300">
                                    Pedido seleccionado desde la ruta
                                </div>
                            )}

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

                            {!["delivered", "cancelled", "not_delivered"].includes(getCurrentStatus(order)) && (
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
                                        onClick={() => openDeliverDialog(order)}
                                    >
                                        <CheckCircle2 className="h-4 w-4 mr-1.5" />
                                        Entregar + Cobrar
                                    </Button>
                                </div>
                            )}
                        </Card>
                    ))
                )}

                <div className="pt-2 border-t border-slate-800" />

                <div className="flex items-center justify-between">
                    <h2 className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Entregas realizadas</h2>
                    <Link href="/delivery/history">
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10">
                            Ver historial
                        </Button>
                    </Link>
                </div>

                {recentCompleted.length === 0 ? (
                    <Card className="p-5 bg-slate-900 border-slate-800">
                        <p className="text-sm text-slate-400 text-center">Aún no hay entregas realizadas en esta ruta.</p>
                    </Card>
                ) : (
                    <div className="space-y-2">
                        {recentCompleted.map((order) => (
                            <Card key={`done-${order.id}`} className="p-3 bg-slate-900/70 border-slate-800">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-white truncate">{order.customer?.name || "Cliente sin nombre"}</p>
                                        <p className="text-xs text-slate-500">
                                            Entregado {format(new Date(order.created_at), "dd MMM, HH:mm", { locale: es })}
                                        </p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="font-mono text-sm font-semibold text-emerald-400">${order.total.toLocaleString()}</p>
                                        <div className="flex flex-col items-end gap-1">
                                            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">Entregado</Badge>
                                            <Badge variant="outline" className="border-slate-700 text-slate-300 text-[10px]">
                                                {getOrderPaymentSummary(order)}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            <Dialog open={!!deliveryOrder} onOpenChange={(open) => !open && closeDeliverDialog()}>
                <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-md">
                    <DialogHeader>
                        <DialogTitle>Confirmar entrega y cobro</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                            <p className="text-sm text-slate-300 font-medium">{deliveryOrder?.customer?.name || "Cliente"}</p>
                            <p className="text-xs text-slate-500">Total pedido: ${Number(deliveryOrder?.total || 0).toLocaleString()}</p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="payment-amount" className="text-slate-300">Monto cobrado</Label>
                            <Input
                                id="payment-amount"
                                type="number"
                                min="0"
                                step="0.01"
                                value={paymentAmount}
                                onChange={(e) => setPaymentAmount(e.target.value)}
                                className="bg-slate-950 border-slate-700"
                            />
                            <p className="text-xs text-slate-500">
                                {currentMethodAllowsPending
                                    ? "Fiado/Cuenta Corriente: puedes dejar saldo pendiente."
                                    : "Este método requiere cobrar el total del pedido."}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-slate-300">Método elegido por cliente</Label>
                            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                                <SelectTrigger className="bg-slate-950 border-slate-700">
                                    <SelectValue placeholder="Seleccionar método" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="cash">Efectivo</SelectItem>
                                    <SelectItem value="transfer">Transferencia</SelectItem>
                                    <SelectItem value="card">Tarjeta</SelectItem>
                                    <SelectItem value="mixed">Mixto</SelectItem>
                                    <SelectItem value="fiado">Fiado</SelectItem>
                                    <SelectItem value="credit">Cuenta Corriente</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
                            <p className="text-slate-200">Método: <span className="font-semibold text-emerald-300">{getPaymentMethodLabel(paymentMethod)}</span></p>
                            <p className="text-slate-200">Cobro: <span className="font-semibold text-emerald-300">${Number(paymentAmount || 0).toLocaleString()}</span></p>
                            <p className="text-slate-200">Saldo: <span className="font-semibold text-emerald-300">${pendingAmount.toLocaleString()}</span></p>
                        </div>

                        {fullPaymentRequiredAndMissing && (
                            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                                Para confirmar entrega con este método debes cobrar el total (${deliveryTotalAmount.toLocaleString()}).
                            </div>
                        )}

                        <div className="flex items-start gap-2 rounded-lg border border-slate-700 p-3">
                            <Checkbox
                                id="confirm-delivery"
                                checked={deliveryConfirmed}
                                onCheckedChange={(checked) => setDeliveryConfirmed(checked === true)}
                            />
                            <Label htmlFor="confirm-delivery" className="text-sm text-slate-300 cursor-pointer">
                                Confirmo que el pedido fue entregado y el método de pago es correcto.
                            </Label>
                        </div>

                        <div className="flex gap-2 justify-end pt-2">
                            <Button variant="outline" className="border-slate-700" onClick={closeDeliverDialog} disabled={submittingDelivery}>
                                Cancelar
                            </Button>
                            <Button className="bg-emerald-600 hover:bg-emerald-500" onClick={handleMarkDelivered} disabled={submittingDelivery || !deliveryConfirmed || fullPaymentRequiredAndMissing}>
                                {submittingDelivery && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                Confirmar entrega
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
