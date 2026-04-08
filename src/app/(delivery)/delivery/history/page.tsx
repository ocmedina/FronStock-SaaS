"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { ArrowLeft, Clock, DollarSign, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { OrderDetailsModal } from "@/components/delivery/OrderDetailsModal";
import { Badge } from "@/components/ui/badge";
import { ShiftControl } from "@/components/delivery/ShiftControl";
import { getOrderPaymentSummary } from "@/lib/utils/delivery";

export default function HistoryPage() {
    const { organizationId } = useOrganization();
    const [mounted, setMounted] = useState(false);
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterDays, setFilterDays] = useState(30); // 1 = today, 7 = week, 30 = month
    const [statusFilter, setStatusFilter] = useState<"delivered" | "all" | "not_delivered" | "cancelled">("all");
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);

    const supabase = useMemo(() => createClient(), []);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (organizationId) fetchHistory();
    }, [organizationId, filterDays, statusFilter]);

    useEffect(() => {
        if (!organizationId) return;

        const channel = supabase
            .channel(`delivery-history-${organizationId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'orders', filter: `organization_id=eq.${organizationId}` },
                () => fetchHistory()
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'order_payments', filter: `organization_id=eq.${organizationId}` },
                () => fetchHistory()
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'sales', filter: `organization_id=eq.${organizationId}` },
                () => fetchHistory()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [organizationId, filterDays, statusFilter]);

    const fetchHistory = async () => {
        setLoading(true);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - filterDays);

        try {
            const normalizeStatus = (rawStatus?: string) => {
                const status = String(rawStatus || '').toLowerCase();
                if (['delivered', 'completed', 'entregado', 'done'].includes(status)) return 'delivered';
                if (['not_delivered', 'not_home', 'failed', 'returned', 'no_entregado'].includes(status)) return 'not_delivered';
                if (['cancelled', 'canceled', 'rejected'].includes(status)) return 'cancelled';
                if (['rescheduled', 'reprogramado'].includes(status)) return 'rescheduled';
                return status || 'pending';
            };

            const { data: ordersData, error: ordersError } = await supabase
                .from('orders')
                .select('id, created_at, total, payment_method, payment_status, delivery_status, lifecycle_status, customer:customers(name)')
                .eq('organization_id', organizationId)
                .gte('created_at', startDate.toISOString())
                .order('created_at', { ascending: false });

            const isAllowedStatus = (status: string) => {
                if (statusFilter === 'all') return true;
                return status === statusFilter;
            };

            let mappedOrders = ((ordersError ? [] : ordersData) || [])
                .map((order: any) => ({
                    ...order,
                    source: 'orders',
                    ui_status: normalizeStatus(order.lifecycle_status || order.delivery_status),
                    order_payments: [],
                }))
                .filter((order: any) => isAllowedStatus(order.ui_status));

            if (mappedOrders.length > 0) {
                const orderIds = mappedOrders.map((order: any) => order.id);
                const { data: paymentsData, error: paymentsError } = await supabase
                    .from('order_payments')
                    .select('order_id, payment_method, amount')
                    .eq('organization_id', organizationId)
                    .in('order_id', orderIds);

                if (!paymentsError && paymentsData) {
                    const paymentsByOrderId = paymentsData.reduce((acc: Record<string, any[]>, payment: any) => {
                        if (!acc[payment.order_id]) acc[payment.order_id] = [];
                        acc[payment.order_id].push(payment);
                        return acc;
                    }, {});

                    mappedOrders = mappedOrders.map((order: any) => ({
                        ...order,
                        order_payments: paymentsByOrderId[order.id] || [],
                    }));
                }
            }

            if (ordersError) {
                console.warn('Orders history query failed, using legacy fallback');
            }

            if (mappedOrders.length > 0) {
                setOrders(mappedOrders);
                return;
            }

            const { data: legacySales, error: legacyError } = await supabase
                .from('sales')
                .select('id, created_at, total, payment_method, payment_status, delivery_status, customer:customers(name)')
                .eq('organization_id', organizationId)
                .gte('created_at', startDate.toISOString())
                .order('created_at', { ascending: false });

            let salesRows: any[] = (legacySales as any[]) || [];
            if (legacyError) {
                console.warn('Legacy sales query with customer join failed, trying basic query');
                const { data: basicSales, error: basicSalesError } = await supabase
                    .from('sales')
                    .select('id, created_at, total, payment_method, payment_status, delivery_status')
                    .eq('organization_id', organizationId)
                    .gte('created_at', startDate.toISOString())
                    .order('created_at', { ascending: false });

                if (basicSalesError) {
                    console.warn('Legacy sales basic query failed');
                    setOrders([]);
                    return;
                }

                salesRows = basicSales || [];
            }

            const mappedLegacy = salesRows.map((sale: any) => ({
                ...sale,
                source: 'sales',
                ui_status: normalizeStatus(sale.delivery_status),
            }));

            const filteredLegacy = mappedLegacy.filter((sale: any) => {
                return isAllowedStatus(sale.ui_status);
            });

            setOrders(filteredLegacy);
        } catch (error) {
            console.error('Error fetching history');
            setOrders([]);
        } finally {
            setLoading(false);
        }
    };

    const handleViewDetails = (id: string) => {
        setSelectedOrderId(id);
        setDetailsOpen(true);
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'delivered': return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Entregado</Badge>;
            case 'cancelled': return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">Cancelado</Badge>;
            case 'not_delivered': return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">No Entregado</Badge>;
            case 'rescheduled': return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Reprogramado</Badge>;
            case 'pending': return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">Pendiente</Badge>;
            default: return <Badge variant="outline" className="text-slate-400">{status}</Badge>;
        }
    };

    const totalAmount = orders.reduce((sum, order) => sum + Number(order?.total || 0), 0);
    const deliveredCount = orders.filter((order) => order?.ui_status === 'delivered').length;
    const cancelledCount = orders.filter((order) => order?.ui_status === 'cancelled').length;

    if (!mounted) {
        return (
            <div className="min-h-screen bg-slate-950 pb-24">
                <div className="p-4 text-center text-slate-500">Cargando...</div>
            </div>
        );
    }

    return (
        <div className="relative min-h-screen overflow-hidden bg-slate-950 pb-24">
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl" />
                <div className="absolute right-0 top-1/3 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(148,163,184,0.12),transparent_55%)]" />
            </div>

            <div className="relative mx-auto w-full max-w-3xl">
                <div className="sticky top-0 z-20 border-b border-slate-800/40 bg-slate-950/70 p-4 backdrop-blur-xl">
                    <div className="mb-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <Link href="/delivery">
                                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
                                    <ArrowLeft className="h-6 w-6" />
                                </Button>
                            </Link>
                            <div>
                                <h1 className="text-xl font-bold text-white">Historial</h1>
                                <p className="text-xs text-slate-500">Seguimiento de entregas y cobros</p>
                            </div>
                        </div>
                        <ShiftControl />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-xl border border-slate-700/60 bg-slate-900/70 p-2.5">
                            <p className="text-[10px] uppercase tracking-wide text-slate-500">Registros</p>
                            <p className="mt-1 flex items-center gap-1 text-sm font-bold text-white">
                                <Package className="h-3.5 w-3.5 text-cyan-300" />
                                {orders.length}
                            </p>
                        </div>
                        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5">
                            <p className="text-[10px] uppercase tracking-wide text-emerald-300/80">Entregadas</p>
                            <p className="mt-1 flex items-center gap-1 text-sm font-bold text-emerald-300">
                                <Clock className="h-3.5 w-3.5" />
                                {deliveredCount}
                            </p>
                        </div>
                        <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-2.5">
                            <p className="text-[10px] uppercase tracking-wide text-cyan-200/80">Total</p>
                            <p className="mt-1 flex items-center gap-1 text-sm font-bold text-cyan-200">
                                <DollarSign className="h-3.5 w-3.5" />
                                {totalAmount.toLocaleString()}
                            </p>
                        </div>
                    </div>

                    <div className="mt-3 rounded-2xl border border-slate-700/60 bg-slate-900/70 p-1">
                        <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1">
                            {[
                                { label: 'Hoy', days: 1 },
                                { label: '7 Días', days: 7 },
                                { label: '30 Días', days: 30 }
                            ].map((f) => (
                                <Button
                                    key={f.days}
                                    variant="outline"
                                    onClick={() => setFilterDays(f.days)}
                                    className={`h-8 rounded-full border text-xs ${filterDays === f.days
                                        ? 'border-cyan-500 bg-cyan-600 text-white'
                                        : 'border-slate-700 bg-slate-900 text-slate-400'
                                        }`}
                                >
                                    {f.label}
                                </Button>
                            ))}
                        </div>

                        <div className="scrollbar-hide flex gap-2 overflow-x-auto">
                            {[
                                { label: 'Entregadas', value: 'delivered' as const },
                                { label: 'Todas', value: 'all' as const },
                                { label: 'No Entregadas', value: 'not_delivered' as const },
                                { label: 'Canceladas', value: 'cancelled' as const },
                            ].map((s) => (
                                <Button
                                    key={s.value}
                                    variant="outline"
                                    onClick={() => setStatusFilter(s.value)}
                                    className={`h-8 rounded-full border text-xs ${statusFilter === s.value
                                        ? 'border-emerald-500 bg-emerald-600 text-white'
                                        : 'border-slate-700 bg-slate-900 text-slate-400'
                                        }`}
                                >
                                    {s.label}
                                </Button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="space-y-3 p-4">
                    {loading ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="animate-pulse rounded-2xl border border-slate-800 bg-slate-900 p-4">
                                    <div className="mb-2 h-4 w-36 rounded bg-slate-800" />
                                    <div className="mb-3 h-3 w-24 rounded bg-slate-800" />
                                    <div className="h-6 w-24 rounded bg-slate-800" />
                                </div>
                            ))}
                        </div>
                    ) : orders.length === 0 ? (
                        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 py-12 text-center text-slate-500">
                            No hay pedidos para el filtro actual ({statusFilter === 'all' ? 'todos los estados' : statusFilter}) en {filterDays} días
                        </div>
                    ) : (
                        orders.map((order) => (
                            <div
                                key={order.id}
                                onClick={() => handleViewDetails(order.id)}
                                className="cursor-pointer rounded-2xl border border-slate-700/60 bg-slate-900/85 p-4 shadow-[0_12px_24px_rgba(2,6,23,0.22)] transition-all active:scale-[0.98]"
                            >
                                <div className="mb-2 flex items-start justify-between">
                                    <div>
                                        <h3 className="text-sm font-bold text-white">
                                            {order.customer?.name || "Cliente Mostrador"}
                                        </h3>
                                        <span className="text-xs text-slate-500">
                                            {format(new Date(order.created_at), "dd MMM, HH:mm", { locale: es })}
                                        </span>
                                    </div>
                                    <span className="font-mono text-base font-bold text-emerald-300">
                                        ${Number(order.total || 0).toLocaleString()}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    {getStatusBadge(order.ui_status || 'pending')}
                                    <Badge variant="outline" className="border-slate-700 text-[10px] text-slate-300">
                                        {getOrderPaymentSummary(order)}
                                    </Badge>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <OrderDetailsModal
                orderId={selectedOrderId}
                open={detailsOpen}
                onOpenChange={setDetailsOpen}
            />
        </div>
    );
}
