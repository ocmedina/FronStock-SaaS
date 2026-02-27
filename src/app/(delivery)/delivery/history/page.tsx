"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { OrderDetailsModal } from "@/components/delivery/OrderDetailsModal";
import { Badge } from "@/components/ui/badge";

export default function HistoryPage() {
    const { organizationId } = useOrganization();
    const [mounted, setMounted] = useState(false);
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterDays, setFilterDays] = useState(30); // 1 = today, 7 = week, 30 = month
    const [statusFilter, setStatusFilter] = useState<"delivered" | "all" | "not_delivered" | "cancelled">("all");
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);

    const supabase = createClient();

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

    const getPaymentMethodLabel = (method?: string) => {
        if (!method) return 'Sin definir';

        const normalized = method.toLowerCase();
        const labels: Record<string, string> = {
            cash: 'Efectivo',
            transfer: 'Transferencia',
            card: 'Tarjeta',
            mixed: 'Mixto',
            fiado: 'Fiado',
            credit: 'Cuenta Corriente',
            current_account: 'Cuenta Corriente',
            cuenta_corriente: 'Cuenta Corriente',
        };

        return labels[normalized] || method;
    };

    const getOrderPaymentSummary = (order: any) => {
        const payments = Array.isArray(order?.order_payments) ? order.order_payments : [];
        const methods: string[] = Array.from(
            new Set(
                payments
                    .map((p: any) => String(p.payment_method || '').toLowerCase())
                    .filter(Boolean)
            )
        );

        if (methods.length > 1) return 'Mixto';
        if (methods.length === 1) return getPaymentMethodLabel(methods[0]);
        return getPaymentMethodLabel(order?.payment_method);
    };

    if (!mounted) {
        return (
            <div className="min-h-screen bg-slate-950 pb-20">
                <div className="sticky top-0 bg-slate-950/90 backdrop-blur z-20 border-b border-slate-800 p-4">
                    <div className="flex items-center gap-3 mb-4">
                        <Button variant="ghost" size="icon" className="text-slate-400" disabled>
                            <ArrowLeft className="h-6 w-6" />
                        </Button>
                        <h1 className="text-xl font-bold text-white">Historial</h1>
                    </div>
                </div>
                <div className="p-4">
                    <div className="text-slate-500 text-center py-8">Cargando...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 pb-20">
            {/* Header */}
            <div className="sticky top-0 bg-slate-950/90 backdrop-blur z-20 border-b border-slate-800 p-4">
                <div className="flex items-center gap-3 mb-4">
                    <Link href="/delivery">
                        <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
                            <ArrowLeft className="h-6 w-6" />
                        </Button>
                    </Link>
                    <h1 className="text-xl font-bold text-white">Historial</h1>
                </div>

                {/* Filters */}
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {[
                        { label: 'Hoy', days: 1 },
                        { label: '7 Días', days: 7 },
                        { label: '30 Días', days: 30 }
                    ].map(f => (
                        <Button
                            key={f.days}
                            variant="outline"
                            onClick={() => setFilterDays(f.days)}
                            className={`
                                rounded-full text-xs h-8 border-slate-700
                                ${filterDays === f.days ? 'bg-emerald-600 text-white border-transparent' : 'bg-slate-900 text-slate-400'}
                            `}
                        >
                            {f.label}
                        </Button>
                    ))}
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
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
                            className={`
                                rounded-full text-xs h-8 border-slate-700
                                ${statusFilter === s.value ? 'bg-emerald-600 text-white border-transparent' : 'bg-slate-900 text-slate-400'}
                            `}
                        >
                            {s.label}
                        </Button>
                    ))}
                </div>
            </div>

            {/* List */}
            <div className="p-4 space-y-3">
                {loading ? (
                    <div className="text-slate-500 text-center py-8">Cargando...</div>
                ) : orders.length === 0 ? (
                    <div className="text-slate-500 text-center py-8">
                        No hay pedidos para el filtro actual ({statusFilter === 'all' ? 'todos los estados' : statusFilter}) en {filterDays} días
                    </div>
                ) : (
                    orders.map(order => (
                        <div
                            key={order.id}
                            onClick={() => handleViewDetails(order.id)}
                            className="bg-slate-900 rounded-xl p-4 border border-slate-800 active:scale-[0.98] transition-all cursor-pointer"
                        >
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h3 className="font-bold text-white text-sm">
                                        {order.customer?.name || "Cliente Mostrador"}
                                    </h3>
                                    <span className="text-xs text-slate-500">
                                        {format(new Date(order.created_at), "dd MMM, HH:mm", { locale: es })}
                                    </span>
                                </div>
                                <span className="font-mono font-bold text-emerald-400">
                                    ${order.total.toLocaleString()}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                {getStatusBadge(order.ui_status || 'pending')}
                                <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-300">
                                    {getOrderPaymentSummary(order)}
                                </Badge>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <OrderDetailsModal
                orderId={selectedOrderId}
                open={detailsOpen}
                onOpenChange={setDetailsOpen}
            />
        </div>
    );
}
