"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    Truck, MapPin, User, LogOut, Clock,
    CheckCircle2, Package, ChevronRight,
    Phone, Plus, Loader2, RefreshCw, Calendar, Route, AlertTriangle,
    Navigation, XCircle, MessageCircle, RotateCcw, DollarSign, Bell,
    TrendingUp, Banknote
} from "lucide-react";
import { DownloadRemitoButton } from "@/components/orders/DownloadRemitoButton";
import { Button } from "@/components/ui/button";
import { useOrganization } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { formatDistanceToNow, isToday, differenceInMinutes } from "date-fns";
import { es } from "date-fns/locale";
import { DeliveryBottomNav } from "@/components/delivery/DeliveryBottomNav";
import { SwipeableOrderCard } from "@/components/delivery/SwipeableOrderCard";
import { ShiftControl } from "@/components/delivery/ShiftControl";
import { OrderDetailsModal } from "@/components/delivery/OrderDetailsModal";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { updateOrderStatus } from "@/actions/delivery";
import { getDeliveryPaymentLabel } from "@/lib/utils/delivery";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type DeliveryOrder = {
    id: string;
    lifecycle_status?: string;
    customer: { name: string; address: string; phone: string } | null;
    total: number;
    delivery_status: string;
    payment_status: string;
    payment_method: string;
    created_at: string;
    out_for_delivery_at?: string | null;  // ← timestamp real de salida
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
    const router = useRouter();
    const { profile, organization } = useOrganization();
    const [orders, setOrders] = useState<DeliveryOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<TabId>("pending");
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [zoneFilter, setZoneFilter] = useState<string | null>(null);
    const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set());
    const [now, setNow] = useState(new Date());
    const [showSummary, setShowSummary] = useState(false);
    const prevOrderIds = useRef<Set<string>>(new Set());
    const supabase = useMemo(() => createClient(), []);

    // ─── CONFIRM DIALOG STATE ──────────────────────────────────────────────────
    const [confirmDialog, setConfirmDialog] = useState<{
        open: boolean;
        title: string;
        description: string;
        onConfirm: () => void;
    }>({ open: false, title: '', description: '', onConfirm: () => {} });

    const openConfirm = useCallback((title: string, description: string, onConfirm: () => void) => {
        setConfirmDialog({ open: true, title, description, onConfirm });
    }, []);

    // ─── LIVE CLOCK (para el timer en camino) ──────────────────────────────────
    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 30_000);
        return () => clearInterval(interval);
    }, []);

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
            if (data) {
                const incoming = data as any[];
                // Detect brand-new orders for the "new" badge
                const incomingIds = new Set(incoming.map((o: any) => o.id));
                if (prevOrderIds.current.size > 0) {
                    const fresh = incoming.filter((o: any) => !prevOrderIds.current.has(o.id));
                    if (fresh.length > 0) {
                        setNewOrderIds(prev => new Set([...prev, ...fresh.map((o: any) => o.id)]));
                        toast('🔔 Nuevo pedido recibido', { description: fresh[0]?.customer?.name || '', duration: 4000 });
                    }
                }
                prevOrderIds.current = incomingIds;
                setOrders(incoming);
            }
        } catch (e: any) {
            // PostgrestError no extiende Error, por eso aparece como {} en console.error
            const msg = e?.message || e?.error_description || JSON.stringify(e) || 'Error desconocido';
            const code = e?.code ? ` [${e.code}]` : '';
            console.error(`Error fetching orders${code}:`, msg, e?.details || '');
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
            // ★ Server action — no RPC directo desde el cliente
            const result = await updateOrderStatus({ orderId, newStatus });
            if (!result.success) throw new Error(result.error);
            toast.success(newStatus === "in_delivery" ? "¡En camino! 🚚" : "Estado actualizado");
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

    // Zone filter
    const allZones = Array.from(new Set(
        pendingOrders.map(o => o.customer?.address?.split(',').pop()?.trim()).filter(Boolean)
    )) as string[];
    const filteredPending = zoneFilter
        ? pendingOrders.filter(o => o.customer?.address?.includes(zoneFilter))
        : pendingOrders;

    // Turno summary
    const totalCashExpected = [...pendingOrders, ...inDeliveryOrders]
        .filter(o => ['cash', 'efectivo'].includes((o.payment_method || '').toLowerCase()))
        .reduce((s, o) => s + (o.total || 0), 0);
    const totalDeliveredAmount = deliveredTodayOrders.reduce((s, o) => s + (o.total || 0), 0);
    const totalPendingAmount = pendingOrders.reduce((s, o) => s + (o.total || 0), 0);

    const tabData: Record<TabId, { label: string; orders: DeliveryOrder[]; count: number }> = {
        pending: { label: "Pendientes", orders: filteredPending, count: pendingOrders.length },
        in_delivery: { label: "En Camino", orders: inDeliveryOrders, count: inDeliveryOrders.length },
        delivered: { label: "Entregados hoy", orders: deliveredTodayOrders, count: deliveredTodayOrders.length },
    };

    const visibleOrders = tabData[activeTab].orders;

    // ─── RENDER ────────────────────────────────────────────────────────────────
    return (
        <div className="relative min-h-screen overflow-hidden bg-slate-950 pb-24">
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute -top-28 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl" />
                <div className="absolute right-0 top-1/3 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(148,163,184,0.12),transparent_55%)]" />
            </div>

            <div className="relative mx-auto w-full max-w-2xl">

                {/* ── HEADER ────────────────────────────────────────────────── */}
                <div className="sticky top-0 z-20 border-b border-slate-800/40 bg-slate-950/70 px-4 pt-4 pb-3 backdrop-blur-xl">
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

                        {/* Right: shift + summary + logout */}
                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                onClick={() => setShowSummary(s => !s)}
                                className={cn(
                                    "h-8 px-2.5 rounded-full border flex items-center gap-1.5 text-[11px] font-bold transition-colors",
                                    showSummary
                                        ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
                                        : "border-slate-700 bg-slate-900/70 text-slate-400 hover:text-white"
                                )}
                                title="Resumen de turno"
                            >
                                <TrendingUp className="h-3.5 w-3.5" />
                                <span>Turno</span>
                            </button>
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
                            <span className="text-[11px] font-bold text-cyan-300">
                                {deliveredTodayOrders.length}
                                <span className="text-slate-600 font-normal"> / {totalActive} entregas</span>
                            </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 transition-all duration-700 ease-out"
                                style={{ width: `${progressPct}%` }}
                            />
                        </div>
                    </div>

                    {/* ── TABS ─────────────────────────────────────────────── */}
                    <div className="mt-3 flex gap-1 rounded-2xl border border-slate-700/60 bg-slate-900/70 p-1">
                        {(Object.entries(tabData) as [TabId, typeof tabData[TabId]][]).map(([id, tab]) => (
                            <button
                                key={id}
                                onClick={() => setActiveTab(id)}
                                className={cn(
                                    "flex-1 rounded-xl px-1 py-2 text-[11px] font-bold transition-all duration-200 flex items-center justify-center gap-1.5 border",
                                    activeTab === id
                                        ? id === "pending"
                                            ? "border-amber-400/30 bg-amber-500/15 text-amber-100 shadow-[0_0_16px_rgba(251,191,36,0.15)]"
                                            : id === "in_delivery"
                                                ? "border-cyan-400/30 bg-cyan-500/15 text-cyan-100 shadow-[0_0_16px_rgba(6,182,212,0.15)]"
                                                : "border-emerald-400/30 bg-emerald-500/15 text-emerald-100 shadow-[0_0_16px_rgba(16,185,129,0.12)]"
                                        : "border-transparent text-slate-500 hover:text-slate-300"
                                )}
                            >
                                <span>{tab.label}</span>
                                {tab.count > 0 && (
                                    <span className={cn(
                                        "inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[10px] font-black",
                                        activeTab === id
                                            ? id === "pending" ? "bg-amber-500 text-slate-950"
                                                : id === "in_delivery" ? "bg-cyan-500 text-slate-950"
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

                {/* ── TURNO SUMMARY PANEL ────────────────────────────────── */}
                {showSummary && (
                    <div className="mx-4 mt-2 mb-0 overflow-hidden rounded-3xl border border-slate-700/60 bg-slate-900/85 shadow-[0_12px_30px_rgba(2,6,23,0.35)]">
                        <div className="grid grid-cols-3 divide-x divide-slate-800">
                            <div className="p-3 text-center">
                                <p className="text-[10px] text-slate-500 uppercase tracking-wide font-medium">Entregado hoy</p>
                                <p className="text-base font-black text-emerald-400 mt-0.5">${totalDeliveredAmount.toLocaleString()}</p>
                                <p className="text-[10px] text-slate-600">{deliveredTodayOrders.length} pedidos</p>
                            </div>
                            <div className="p-3 text-center">
                                <p className="text-[10px] text-slate-500 uppercase tracking-wide font-medium">Pendiente</p>
                                <p className="text-base font-black text-amber-400 mt-0.5">${totalPendingAmount.toLocaleString()}</p>
                                <p className="text-[10px] text-slate-600">{pendingOrders.length} pedidos</p>
                            </div>
                            <div className="p-3 text-center">
                                <p className="text-[10px] text-slate-500 uppercase tracking-wide font-medium">Efectivo esperado</p>
                                    <p className="text-base font-black text-cyan-300 mt-0.5">${totalCashExpected.toLocaleString()}</p>
                                <p className="text-[10px] text-slate-600">en caja</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── CONTENT ───────────────────────────────────────────────── */}
                    <div className="space-y-3 px-4 py-3">

                    {/* Refresh indicator */}
                    {refreshing && (
                        <div className="flex items-center justify-center gap-2 py-1 text-[11px] text-slate-500">
                            <RefreshCw className="h-3 w-3 animate-spin" />
                            Actualizando...
                        </div>
                    )}

                    {/* Zone filter chips — solo en pendientes */}
                    {activeTab === "pending" && allZones.length > 1 && (
                        <div className="flex gap-2 flex-wrap pb-1">
                            <button
                                onClick={() => setZoneFilter(null)}
                                className={cn(
                                    "h-7 px-3 rounded-full text-[11px] font-semibold border transition-colors",
                                    !zoneFilter
                                        ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-100"
                                        : "border-slate-800 bg-slate-900 text-slate-500 hover:text-slate-300"
                                )}
                            >
                                Todas
                            </button>
                            {allZones.map(zone => (
                                <button
                                    key={zone}
                                    onClick={() => setZoneFilter(zoneFilter === zone ? null : zone)}
                                    className={cn(
                                        "h-7 px-3 rounded-full text-[11px] font-semibold border transition-colors flex items-center gap-1",
                                        zoneFilter === zone
                                            ? "border-cyan-500 bg-cyan-600 text-white"
                                            : "border-slate-800 bg-slate-900 text-slate-400 hover:text-white"
                                    )}
                                >
                                    <MapPin className="h-2.5 w-2.5" />
                                    {zone}
                                </button>
                            ))}
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
                                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-cyan-500/10">
                                        <Truck className="h-8 w-8 text-cyan-300" />
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
                            const paymentLabel = getDeliveryPaymentLabel(order.payment_method);
                            const itemCount = order.order_items?.length ?? 0;
                            const isPaid = order.payment_status === "paid";
                            const isRescheduled = status === "rescheduled";
                            const hasRoute = !!order.assigned_route_id;
                            const isNew = newOrderIds.has(order.id);
                            const timerStart = order.out_for_delivery_at || order.created_at;
                            const elapsedMins = activeTab === "in_delivery"
                                ? differenceInMinutes(now, new Date(timerStart))
                                : 0;
                            // If order is actively out for delivery, use the new Swipeable Premium Component!
                            if (activeTab === "in_delivery") {
                                return (
                                    <SwipeableOrderCard
                                        key={order.id}
                                        order={order}
                                        onSwipeRight={(id) => router.push(`/delivery/orders?orderId=${id}`)}
                                        onViewDetails={(id) => { setSelectedOrderId(id); setDetailsOpen(true); }}
                                    >
                                        <div className="flex flex-wrap gap-2">
                                            {/* Mapa */}
                                            {order.customer?.address && (
                                                <a
                                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.customer.address)}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-colors text-[11px] font-semibold"
                                                >
                                                    <Navigation className="h-3 w-3" />
                                                    Mapa
                                                </a>
                                            )}

                                            {/* WhatsApp */}
                                            {order.customer?.phone && (
                                                <a
                                                    href={`https://wa.me/${order.customer.phone.replace(/\D/g, '')}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 transition-colors text-[11px] font-semibold"
                                                >
                                                    <MessageCircle className="h-3 w-3" />
                                                    WhatsApp
                                                </a>
                                            )}
                                        </div>
                                    </SwipeableOrderCard>
                                );
                            }

                            return (
                                <div
                                    key={order.id}
                                    className={cn(
                                        "bg-slate-900 border rounded-2xl overflow-hidden transition-all",
                                        isNew && "ring-2 ring-blue-500/60",
                                        isRescheduled
                                            ? "border-yellow-500/40"
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
                                                    <Route className="h-3 w-3 text-cyan-300" />
                                                    <span className="text-[11px] font-semibold text-cyan-300">Con ruta asignada</span>
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
                                            {/* Elapsed timer for in_delivery */}

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
                                                    className="h-10 flex-1 rounded-xl bg-cyan-600 text-sm font-bold text-white hover:bg-cyan-500"
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

                                        {/* ── SECONDARY ACTIONS ───────────────────── */}
                                        {activeTab !== "delivered" && (
                                            <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-slate-800/60">
                                                {/* Mapa */}
                                                {order.customer?.address && (
                                                    <a
                                                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.customer.address)}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-colors text-[11px] font-semibold"
                                                    >
                                                        <Navigation className="h-3 w-3" />
                                                        Mapa
                                                    </a>
                                                )}

                                                {/* WhatsApp */}
                                                {order.customer?.phone && (
                                                    <a
                                                        href={`https://wa.me/${order.customer.phone.replace(/\D/g, '')}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 transition-colors text-[11px] font-semibold"
                                                    >
                                                        <MessageCircle className="h-3 w-3" />
                                                        WhatsApp
                                                    </a>
                                                )}

                                                {/* Remito */}
                                                <DownloadRemitoButton
                                                    order={{ ...order, order_items: order.order_items || [] }}
                                                    compact
                                                    className=""
                                                />

                                                {/* Reprogramar — solo pendientes */}
                                                {activeTab === "pending" && (
                                                    <button
                                                        className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 hover:bg-yellow-500/20 transition-colors text-[11px] font-semibold"
                                                        onClick={() =>
                                                            openConfirm(
                                                                'Reprogramar pedido',
                                                                `¿Reprogramar el pedido de ${order.customer?.name || 'este cliente'}? Quedará marcado para una próxima visita.`,
                                                                () => handleUpdateStatus(order.id, 'rescheduled')
                                                            )
                                                        }
                                                        disabled={isUpdating}
                                                    >
                                                        <RotateCcw className="h-3 w-3" />
                                                        Reprogramar
                                                    </button>
                                                )}

                                                {/* Cancelar — solo pendientes */}
                                                {activeTab === "pending" && (
                                                    <button
                                                        className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors text-[11px] font-semibold ml-auto"
                                                        onClick={() =>
                                                            openConfirm(
                                                                'Cancelar pedido',
                                                                `¿Cancelar el pedido de ${order.customer?.name || 'este cliente'}? Esta acción no se puede deshacer.`,
                                                                () => handleUpdateStatus(order.id, 'cancelled')
                                                            )
                                                        }
                                                        disabled={isUpdating}
                                                    >
                                                        <XCircle className="h-3 w-3" />
                                                        Cancelar
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
            <OrderDetailsModal
                orderId={selectedOrderId}
                open={detailsOpen}
                onOpenChange={setDetailsOpen}
                onSuccess={() => fetchOrders(true)}
            />

            {/* ── CONFIRM DIALOG ────────────────────────────────────────────── */}
            <AlertDialog
                open={confirmDialog.open}
                onOpenChange={(open) => setConfirmDialog((d) => ({ ...d, open }))}
            >
                <AlertDialogContent className="bg-slate-900 border-slate-700 text-white">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-white">{confirmDialog.title}</AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-400">
                            {confirmDialog.description}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="border-slate-700 text-slate-300 hover:bg-slate-800">
                            Cancelar
                        </AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-600 hover:bg-red-500 text-white"
                            onClick={() => {
                                confirmDialog.onConfirm();
                                setConfirmDialog((d) => ({ ...d, open: false }));
                            }}
                        >
                            Confirmar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
