"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
    Truck, ShoppingCart, MapPin, User, LogOut, Clock,
    CheckCircle2, Package, AlertCircle, Wallet, ChevronRight,
    Phone, Plus, Loader2, RefreshCw, Calendar, Route, AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOrganization } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { formatDistanceToNow, isToday } from "date-fns";
import { es } from "date-fns/locale";
import { ShiftControl } from "@/components/delivery/ShiftControl";
import { OrderDetailsModal } from "@/components/delivery/OrderDetailsModal";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type DeliveryOrder = {
    id: string;
    lifecycle_status?: string;
    customer: { name: string; address: string; phone: string } | null;
    total: number;
    delivery_status: string;
    payment_status: string;
    payment_method: string;
    created_at: string;
    assigned_route_id?: string | null;
    order_items?: { quantity: number; product_name: string }[];
};

type TabId = "pending" | "in_delivery" | "delivered";

function getStatus(order: DeliveryOrder): string {
    if (order.lifecycle_status) return order.lifecycle_status;
    if (order.delivery_status === "out_for_delivery") return "in_delivery";
    if (order.delivery_status === "cancelled") return "not_delivered";
    return order.delivery_status || "assigned";
}

const STATUS_LABELS: Record<string, string> = {
    draft: "Borrador",
    confirmed: "Confirmado",
    assigned: "Asignado",
    in_delivery: "En Reparto",
    delivered: "Entregado",
    not_delivered: "No Entregado",
    rescheduled: "Reprogramado",
    cancelled: "Cancelado",
};

const PAYMENT_LABELS: Record<string, string> = {
    cash: "Efectivo",
    transfer: "Transferencia",
    card: "Tarjeta",
    mixed: "Mixto",
    fiado: "Fiado",
    credit: "Cta. Cte.",
    current_account: "Cta. Cte.",
    cuenta_corriente: "Cta. Cte.",
};

// ─── PENDING STATUSES ─────────────────────────────────────────────────────────
const PENDING_STATUSES = ["confirmed", "assigned", "rescheduled"];

export default function DeliveryHomePage() {
    const { profile, organization } = useOrganization();
    const [orders, setOrders] = useState<DeliveryOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<TabId>("pending");
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const supabase = createClient();

    // ─── DATA ──────────────────────────────────────────────────────────────────
    const fetchOrders = async (silent = false) => {
        if (!organization?.id) return;
        if (!silent) setLoading(true);
        else setRefreshing(true);

        try {
            const { data, error } = await supabase
                .from("orders")
                .select(`
                    id, total, status, lifecycle_status, assigned_route_id,
                    delivery_status, payment_status, payment_method, created_at,
                    customer:customers(name, address, phone),
                    order_items(quantity, product_name)
                `)
                .eq("organization_id", organization.id)
                .order("created_at", { ascending: false })
                .limit(50);

            if (error) throw error;
            if (data) setOrders(data as any[]);
        } catch (e) {
            console.error("Error fetching orders", e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        if (!organization?.id) return;
        fetchOrders();
        const channel = supabase
            .channel("delivery-updates")
            .on("postgres_changes", {
                event: "*",
                schema: "public",
                table: "orders",
                filter: `organization_id=eq.${organization.id}`,
            }, () => fetchOrders(true))
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [organization?.id]);

    // ─── STATUS UPDATE ─────────────────────────────────────────────────────────
    const handleUpdateStatus = async (orderId: string, newStatus: string) => {
        setUpdatingId(orderId);
        try {
            const { data, error } = await supabase.rpc("set_order_status", {
                p_org_id: organization?.id,
                p_order_id: orderId,
                p_new_status: newStatus,
                p_notes: "Actualizado desde panel de reparto",
            });
            if (error) throw error;
            if (data?.success === false) throw new Error(data?.error || "No se pudo actualizar estado");
            toast.success(newStatus === "in_delivery" ? "¡En camino! 🚚" : "Estado actualizado");
            // Optimistic: switch to in_delivery tab
            if (newStatus === "in_delivery") setActiveTab("in_delivery");
            await fetchOrders(true);
        } catch (e: any) {
            toast.error("Error: " + e.message);
        } finally {
            setUpdatingId(null);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.href = "/login";
    };

    // ─── DERIVED DATA ──────────────────────────────────────────────────────────
    const pendingOrders = orders
        .filter((o) => PENDING_STATUSES.includes(getStatus(o)))
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    const inDeliveryOrders = orders
        .filter((o) => getStatus(o) === "in_delivery")
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    const deliveredTodayOrders = orders
        .filter((o) => getStatus(o) === "delivered" && isToday(new Date(o.created_at)))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const totalActive = pendingOrders.length + inDeliveryOrders.length + deliveredTodayOrders.length;
    const progressPct = totalActive > 0 ? Math.round((deliveredTodayOrders.length / totalActive) * 100) : 0;

    const tabData: Record<TabId, { label: string; orders: DeliveryOrder[]; count: number }> = {
        pending: { label: "Pendientes", orders: pendingOrders, count: pendingOrders.length },
        in_delivery: { label: "En Camino", orders: inDeliveryOrders, count: inDeliveryOrders.length },
        delivered: { label: "Entregados hoy", orders: deliveredTodayOrders, count: deliveredTodayOrders.length },
    };

    const visibleOrders = tabData[activeTab].orders;

    // ─── RENDER ────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-slate-950 pb-24">
            <div className="mx-auto w-full max-w-lg">

                {/* ── HEADER ────────────────────────────────────────────────── */}
                <div className="sticky top-0 z-20 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/60 px-4 pt-4 pb-3">
                    <div className="flex items-center justify-between gap-3">
                        {/* Left: org + user */}
                        <div className="min-w-0">
                            <h1 className="text-base font-extrabold text-white leading-tight truncate">
                                {organization?.name || "Reparto"}
                            </h1>
                            <p className="text-[11px] text-slate-500 font-medium truncate">
                                {profile?.full_name || "Repartidor"}
                            </p>
                        </div>

                        {/* Right: shift + avatar */}
                        <div className="flex items-center gap-2 shrink-0">
                            <ShiftControl />
                            <button
                                onClick={handleLogout}
                                className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-red-400 hover:border-red-500/40 transition-colors"
                            >
                                <LogOut className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* ── PROGRESS BAR ─────────────────────────────────────── */}
                    <div className="mt-3">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] text-slate-500 font-medium uppercase tracking-wide">
                                Progreso del día
                            </span>
                            <span className="text-[11px] font-bold text-emerald-400">
                                {deliveredTodayOrders.length}
                                <span className="text-slate-600 font-normal"> / {totalActive} entregas</span>
                            </span>
                        </div>
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 rounded-full transition-all duration-700 ease-out"
                                style={{ width: `${progressPct}%` }}
                            />
                        </div>
                    </div>

                    {/* ── TABS ─────────────────────────────────────────────── */}
                    <div className="flex gap-1 mt-3 bg-slate-900/60 rounded-xl p-1">
                        {(Object.entries(tabData) as [TabId, typeof tabData[TabId]][]).map(([id, tab]) => (
                            <button
                                key={id}
                                onClick={() => setActiveTab(id)}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-1.5 py-2 px-1 rounded-lg text-[11px] font-bold transition-all duration-200",
                                    activeTab === id
                                        ? "bg-slate-800 text-white shadow-sm"
                                        : "text-slate-500 hover:text-slate-300"
                                )}
                            >
                                <span>{tab.label}</span>
                                {tab.count > 0 && (
                                    <span className={cn(
                                        "inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[10px] font-black",
                                        activeTab === id
                                            ? id === "pending" ? "bg-amber-500 text-slate-950"
                                                : id === "in_delivery" ? "bg-purple-500 text-white"
                                                    : "bg-emerald-500 text-slate-950"
                                            : "bg-slate-700 text-slate-300"
                                    )}>
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── CONTENT ───────────────────────────────────────────────── */}
                <div className="px-4 py-3 space-y-3">

                    {/* Refresh indicator */}
                    {refreshing && (
                        <div className="flex items-center justify-center gap-2 py-1 text-[11px] text-slate-500">
                            <RefreshCw className="h-3 w-3 animate-spin" />
                            Actualizando...
                        </div>
                    )}

                    {/* Loading skeleton */}
                    {loading ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 animate-pulse">
                                    <div className="flex justify-between mb-3">
                                        <div className="space-y-2">
                                            <div className="h-4 w-36 bg-slate-800 rounded" />
                                            <div className="h-3 w-24 bg-slate-800 rounded" />
                                        </div>
                                        <div className="h-6 w-16 bg-slate-800 rounded" />
                                    </div>
                                    <div className="h-9 bg-slate-800 rounded-xl" />
                                </div>
                            ))}
                        </div>
                    ) : visibleOrders.length === 0 ? (
                        /* Empty state */
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            {activeTab === "pending" && (
                                <>
                                    <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
                                        <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                                    </div>
                                    <p className="text-white font-semibold text-base">Sin pedidos pendientes</p>
                                    <p className="text-slate-500 text-sm mt-1">Todo al día 🎉</p>
                                </>
                            )}
                            {activeTab === "in_delivery" && (
                                <>
                                    <div className="h-16 w-16 rounded-full bg-purple-500/10 flex items-center justify-center mb-4">
                                        <Truck className="h-8 w-8 text-purple-400" />
                                    </div>
                                    <p className="text-white font-semibold text-base">Ninguno en camino</p>
                                    <p className="text-slate-500 text-sm mt-1">Asigná pedidos desde Pendientes</p>
                                </>
                            )}
                            {activeTab === "delivered" && (
                                <>
                                    <div className="h-16 w-16 rounded-full bg-slate-800 flex items-center justify-center mb-4">
                                        <Package className="h-8 w-8 text-slate-600" />
                                    </div>
                                    <p className="text-white font-semibold text-base">Sin entregas hoy</p>
                                    <p className="text-slate-500 text-sm mt-1">Las entregas completadas aparecerán aquí</p>
                                </>
                            )}
                        </div>
                    ) : (
                        /* Order cards */
                        visibleOrders.map((order) => {
                            const status = getStatus(order);
                            const isUpdating = updatingId === order.id;
                            const paymentLabel = PAYMENT_LABELS[order.payment_method?.toLowerCase()] ?? order.payment_method;
                            const itemCount = order.order_items?.length ?? 0;
                            const isPaid = order.payment_status === "paid";
                            const isRescheduled = status === "rescheduled";
                            const hasRoute = !!order.assigned_route_id;

                            return (
                                <div
                                    key={order.id}
                                    className={cn(
                                        "bg-slate-900 border rounded-2xl overflow-hidden transition-all",
                                        isRescheduled
                                            ? "border-yellow-500/40"
                                            : activeTab === "in_delivery"
                                                ? "border-purple-500/30"
                                                : activeTab === "delivered"
                                                    ? "border-emerald-500/20"
                                                    : hasRoute
                                                        ? "border-slate-700"
                                                        : "border-amber-500/30"
                                    )}
                                >
                                    {/* Rescheduled banner */}
                                    {isRescheduled && (
                                        <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-1.5 flex items-center gap-2">
                                            <Calendar className="h-3 w-3 text-yellow-400" />
                                            <span className="text-[11px] font-bold text-yellow-400 uppercase tracking-wide">Reprogramado</span>
                                        </div>
                                    )}

                                    {/* Route banner */}
                                    {!isRescheduled && (
                                        <div className={cn(
                                            "px-4 py-1.5 flex items-center gap-2 border-b",
                                            hasRoute
                                                ? "bg-indigo-500/5 border-indigo-500/10"
                                                : "bg-amber-500/5 border-amber-500/15"
                                        )}>
                                            {hasRoute ? (
                                                <>
                                                    <Route className="h-3 w-3 text-indigo-400" />
                                                    <span className="text-[11px] font-semibold text-indigo-400">Con ruta asignada</span>
                                                </>
                                            ) : (
                                                <>
                                                    <AlertTriangle className="h-3 w-3 text-amber-400" />
                                                    <span className="text-[11px] font-semibold text-amber-400">Sin ruta asignada</span>
                                                </>
                                            )}
                                        </div>
                                    )}

                                    <div className="p-4">
                                        {/* Customer + total */}
                                        <div className="flex items-start justify-between gap-3 mb-3">
                                            <div className="min-w-0">
                                                <p className="font-bold text-white text-sm leading-tight truncate">
                                                    {order.customer?.name || "Cliente sin nombre"}
                                                </p>
                                                {order.customer?.address && (
                                                    <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1 min-w-0">
                                                        <MapPin className="h-3 w-3 shrink-0 text-slate-500" />
                                                        <span className="truncate">{order.customer.address}</span>
                                                    </p>
                                                )}
                                                <p className="text-[11px] text-slate-600 mt-1">
                                                    {formatDistanceToNow(new Date(order.created_at), { addSuffix: true, locale: es })}
                                                </p>
                                            </div>

                                            <div className="text-right shrink-0">
                                                <p className="font-black text-white font-mono text-base leading-tight">
                                                    ${order.total.toLocaleString()}
                                                </p>
                                                <p className="text-[11px] text-slate-500 mt-0.5">{paymentLabel}</p>
                                                <span className={cn(
                                                    "inline-block text-[10px] font-bold px-2 py-0.5 rounded mt-1",
                                                    isPaid
                                                        ? "bg-emerald-500/15 text-emerald-400"
                                                        : "bg-red-500/15 text-red-400"
                                                )}>
                                                    {isPaid ? "Pagado" : "Pendiente"}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Meta row */}
                                        <div className="flex items-center gap-2 mb-3 text-[11px] text-slate-500">
                                            <Package className="h-3 w-3" />
                                            <span>{itemCount} ítem{itemCount !== 1 ? "s" : ""}</span>
                                            {order.customer?.phone && (
                                                <>
                                                    <span className="text-slate-700">•</span>
                                                    <a
                                                        href={`tel:${order.customer.phone}`}
                                                        className="flex items-center gap-1 text-slate-500 hover:text-emerald-400 transition-colors"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <Phone className="h-3 w-3" />
                                                        {order.customer.phone}
                                                    </a>
                                                </>
                                            )}
                                        </div>

                                        {/* ── PRIMARY CTA ─────────────────────────────── */}
                                        <div className="flex gap-2">
                                            {/* PENDING → start delivery */}
                                            {activeTab === "pending" && (
                                                <Button
                                                    className="flex-1 h-10 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm rounded-xl"
                                                    onClick={() => handleUpdateStatus(order.id, "in_delivery")}
                                                    disabled={isUpdating}
                                                >
                                                    {isUpdating
                                                        ? <Loader2 className="h-4 w-4 animate-spin" />
                                                        : <><Truck className="h-4 w-4 mr-1.5" /> Salir a entregar</>
                                                    }
                                                </Button>
                                            )}

                                            {/* IN DELIVERY → confirm delivery */}
                                            {activeTab === "in_delivery" && (
                                                <Link href={`/delivery/orders?orderId=${order.id}`} className="flex-1">
                                                    <Button
                                                        className="w-full h-10 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl"
                                                        disabled={isUpdating}
                                                    >
                                                        <CheckCircle2 className="h-4 w-4 mr-1.5" />
                                                        Entregar + Cobrar
                                                    </Button>
                                                </Link>
                                            )}

                                            {/* DELIVERED → just view */}
                                            {activeTab === "delivered" && (
                                                <div className="flex items-center gap-1.5 flex-1">
                                                    <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2 flex-1">
                                                        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                                                        <span className="text-emerald-400 font-bold text-xs">Entregado</span>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Secondary: View details */}
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className="h-10 w-10 rounded-xl border-slate-700 text-slate-400 hover:text-white shrink-0"
                                                onClick={() => { setSelectedOrderId(order.id); setDetailsOpen(true); }}
                                            >
                                                <ChevronRight className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* ── FAB: Tomar Pedido ─────────────────────────────────────────── */}
            <Link href="/delivery/order">
                <button className="fixed bottom-20 right-4 z-40 flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-sm px-5 py-3.5 rounded-2xl shadow-lg shadow-emerald-500/30 transition-all duration-150">
                    <Plus className="h-5 w-5" />
                    Tomar Pedido
                </button>
            </Link>

            {/* ── BOTTOM NAV ────────────────────────────────────────────────── */}
            <div className="fixed bottom-0 left-0 right-0 bg-slate-950/95 backdrop-blur-sm border-t border-slate-800/80 h-16 flex items-center justify-around px-2 z-50">
                <NavItem href="/delivery" icon={<Package className="h-5 w-5" />} label="Pedidos" active />
                <NavItem href="/delivery/debtors" icon={<User className="h-5 w-5" />} label="Deudores" />
                <NavItem href="/delivery/history" icon={<Clock className="h-5 w-5" />} label="Historial" />
            </div>

            <OrderDetailsModal
                orderId={selectedOrderId}
                open={detailsOpen}
                onOpenChange={setDetailsOpen}
                onSuccess={() => fetchOrders(true)}
            />
        </div>
    );
}

function NavItem({ href, icon, label, active }: { href: string; icon: React.ReactNode; label: string; active?: boolean }) {
    return (
        <Link
            href={href}
            className={cn(
                "flex flex-col items-center gap-1 min-w-12 transition-colors",
                active ? "text-emerald-400" : "text-slate-500 hover:text-slate-200"
            )}
        >
            {icon}
            <span className="text-[10px] font-semibold">{label}</span>
        </Link>
    );
}
