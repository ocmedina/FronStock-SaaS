"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { ArrowLeft, Search, Calendar, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { OrderDetailsModal } from "@/components/delivery/OrderDetailsModal";
import { Badge } from "@/components/ui/badge";

export default function HistoryPage() {
    const { organizationId } = useOrganization();
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterDays, setFilterDays] = useState(1); // 1 = today, 7 = week, 30 = month
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);

    const supabase = createClient();

    useEffect(() => {
        if (organizationId) fetchHistory();
    }, [organizationId, filterDays]);

    const fetchHistory = async () => {
        setLoading(true);
        // Calculate date range
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - filterDays);

        const { data, error } = await supabase
            .from('sales')
            .select('*, customer:customers(name)')
            .eq('organization_id', organizationId)
            .eq('channel', 'delivery') // Strict filter for delivery module
            .gte('created_at', startDate.toISOString())
            .order('created_at', { ascending: false });

        if (data) setOrders(data);
        setLoading(false);
    };

    const handleViewDetails = (id: string) => {
        setSelectedOrderId(id);
        setDetailsOpen(true);
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'delivered': return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Entregado</Badge>;
            case 'cancelled': return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">Cancelado</Badge>;
            case 'pending': return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">Pendiente</Badge>;
            default: return <Badge variant="outline" className="text-slate-400">{status}</Badge>;
        }
    };

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
            </div>

            {/* List */}
            <div className="p-4 space-y-3">
                {loading ? (
                    <div className="text-slate-500 text-center py-8">Cargando...</div>
                ) : orders.length === 0 ? (
                    <div className="text-slate-500 text-center py-8">No hay pedidos en este periodo</div>
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
                                {getStatusBadge(order.delivery_status || 'pending')}
                                <span className="text-xs text-slate-500 uppercase font-medium">
                                    {order.payment_method}
                                </span>
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
