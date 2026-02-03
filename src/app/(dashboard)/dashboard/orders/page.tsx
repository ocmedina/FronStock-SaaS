"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Plus, Search, Filter, Truck, CheckCircle, Clock, AlertCircle, ChefHat, MapPin, Phone, DollarSign, Calendar, LayoutGrid, LayoutList, ArrowUpDown, X, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { format, formatDistanceToNow, startOfDay, endOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { OrderDetailsModal } from "@/components/delivery/OrderDetailsModal";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type ViewMode = "grid" | "list";
type SortField = "created_at" | "total" | "customer" | "status";
type SortOrder = "asc" | "desc";

export default function DashboardOrdersPage() {
    const { organizationId } = useOrganization();
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [paymentFilter, setPaymentFilter] = useState<string>("all");
    const [dateFilter, setDateFilter] = useState<string>("all");
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>("grid");
    const [sortField, setSortField] = useState<SortField>("created_at");
    const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
    const [showFilters, setShowFilters] = useState(false);

    // Stats
    const [stats, setStats] = useState({
        pending: 0,
        inProgress: 0,
        delivered: 0,
        totalToday: 0,
        avgDeliveryTime: 0
    });

    const supabase = createClient();

    useEffect(() => {
        if (organizationId) {
            fetchOrders();

            // Setup realtime subscription with organization filter
            const channel = supabase
                .channel('dashboard-orders-updates')
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'orders',
                    filter: `organization_id=eq.${organizationId}`
                }, () => {
                    fetchOrders();
                })
                .subscribe();

            return () => { supabase.removeChannel(channel); };
        }
    }, [organizationId]);

    const fetchOrders = async () => {
        setLoading(true);

        const { data, error } = await supabase
            .from('orders')
            .select('*, customer:customers(name, phone, address)')
            .eq('organization_id', organizationId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Error fetching orders:", error);
            toast.error("Error al cargar pedidos");
            setLoading(false);
            return;
        }

        if (data) {
            setOrders(data);

            // Calculate Stats
            const today = new Date().toISOString().split('T')[0];
            const pending = data.filter(o => o.delivery_status === 'pending').length;
            const inProgress = data.filter(o => ['preparing', 'ready', 'out_for_delivery'].includes(o.delivery_status)).length;
            const delivered = data.filter(o => o.delivery_status === 'delivered').length;
            const todayTotal = data
                .filter(o => o.created_at.startsWith(today))
                .reduce((acc, o) => acc + o.total, 0);

            setStats({ pending, inProgress, delivered, totalToday: todayTotal, avgDeliveryTime: 0 });
        }
        setLoading(false);
    };

    const handleViewDetails = (id: string) => {
        setSelectedOrderId(id);
        setDetailsOpen(true);
    };

    const handleUpdateStatus = async (orderId: string, newStatus: string) => {
        try {
            const { error } = await supabase
                .from('orders')
                .update({ delivery_status: newStatus })
                .eq('id', orderId);

            if (error) throw error;
            toast.success("Estado actualizado");
        } catch (e: any) {
            toast.error("Error: " + e.message);
        }
    };

    // Filtering and Sorting
    const getFilteredOrders = () => {
        let filtered = [...orders];

        // Search
        if (searchTerm) {
            filtered = filtered.filter(o =>
                o.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                o.customer?.phone?.includes(searchTerm) ||
                o.customer?.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                o.id.slice(0, 8).includes(searchTerm)
            );
        }

        // Status filter
        if (statusFilter !== "all") {
            filtered = filtered.filter(o => o.delivery_status === statusFilter);
        }

        // Payment filter
        if (paymentFilter !== "all") {
            filtered = filtered.filter(o => o.payment_method === paymentFilter);
        }

        // Date filter
        if (dateFilter !== "all") {
            const now = new Date();
            const today = startOfDay(now);

            filtered = filtered.filter(o => {
                const orderDate = new Date(o.created_at);
                switch (dateFilter) {
                    case "today":
                        return orderDate >= today;
                    case "yesterday":
                        const yesterday = new Date(today);
                        yesterday.setDate(yesterday.getDate() - 1);
                        return orderDate >= yesterday && orderDate < today;
                    case "week":
                        const weekAgo = new Date(today);
                        weekAgo.setDate(weekAgo.getDate() - 7);
                        return orderDate >= weekAgo;
                    case "month":
                        const monthAgo = new Date(today);
                        monthAgo.setMonth(monthAgo.getMonth() - 1);
                        return orderDate >= monthAgo;
                    default:
                        return true;
                }
            });
        }

        // Sorting
        filtered.sort((a, b) => {
            let comparison = 0;
            switch (sortField) {
                case "created_at":
                    comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                    break;
                case "total":
                    comparison = a.total - b.total;
                    break;
                case "customer":
                    comparison = (a.customer?.name || "").localeCompare(b.customer?.name || "");
                    break;
                case "status":
                    comparison = (a.delivery_status || "").localeCompare(b.delivery_status || "");
                    break;
            }
            return sortOrder === "asc" ? comparison : -comparison;
        });

        return filtered;
    };

    const filteredOrders = getFilteredOrders();

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            pending: "bg-amber-500/10 text-amber-500 border-amber-500/20",
            preparing: "bg-orange-500/10 text-orange-500 border-orange-500/20",
            ready: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
            out_for_delivery: "bg-purple-500/10 text-purple-500 border-purple-500/20",
            delivered: "bg-slate-700/50 text-slate-400 border-slate-600/20",
            cancelled: "bg-red-500/10 text-red-500 border-red-500/20"
        };

        const labels: Record<string, string> = {
            pending: "Pendiente",
            preparing: "En Cocina",
            ready: "Listo",
            out_for_delivery: "En Camino",
            delivered: "Entregado",
            cancelled: "Cancelado"
        };

        return (
            <Badge className={`${styles[status] || styles.pending} border`}>
                {labels[status] || status}
            </Badge>
        );
    };

    const clearFilters = () => {
        setStatusFilter("all");
        setPaymentFilter("all");
        setDateFilter("all");
        setSearchTerm("");
    };

    const activeFiltersCount = [statusFilter, paymentFilter, dateFilter].filter(f => f !== "all").length + (searchTerm ? 1 : 0);

    return (
        <div className="p-6 space-y-6 bg-slate-950 min-h-screen">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">Pedidos</h1>
                    <p className="text-slate-400 mt-1">Gestiona todos los pedidos de delivery</p>
                </div>
                <Link href="/dashboard/orders/new">
                    <Button className="bg-emerald-600 hover:bg-emerald-500">
                        <Plus className="mr-2 h-4 w-4" />
                        Nuevo Pedido
                    </Button>
                </Link>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                            <Clock className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-slate-400 text-sm font-medium">Pendientes</p>
                            <h3 className="text-2xl font-bold text-white">{stats.pending}</h3>
                        </div>
                    </div>
                </div>
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500">
                            <ChefHat className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-slate-400 text-sm font-medium">En Proceso</p>
                            <h3 className="text-2xl font-bold text-white">{stats.inProgress}</h3>
                        </div>
                    </div>
                </div>
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                            <CheckCircle className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-slate-400 text-sm font-medium">Entregados</p>
                            <h3 className="text-2xl font-bold text-white">{stats.delivered}</h3>
                        </div>
                    </div>
                </div>
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                            <DollarSign className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-slate-400 text-sm font-medium">Ventas Hoy</p>
                            <h3 className="text-2xl font-bold text-white">${stats.totalToday.toLocaleString()}</h3>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters and Search */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-4">
                <div className="flex flex-col md:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                        <Input
                            placeholder="Buscar por cliente, teléfono, dirección o ID..."
                            className="pl-9 bg-slate-900 border-slate-800 text-white"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Button
                        variant="outline"
                        className="border-slate-800 text-slate-400"
                        onClick={() => setShowFilters(!showFilters)}
                    >
                        <Filter className="mr-2 h-4 w-4" />
                        Filtros {activeFiltersCount > 0 && `(${activeFiltersCount})`}
                    </Button>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="icon"
                            className={`border-slate-800 ${viewMode === 'grid' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}
                            onClick={() => setViewMode('grid')}
                        >
                            <LayoutGrid className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            className={`border-slate-800 ${viewMode === 'list' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}
                            onClick={() => setViewMode('list')}
                        >
                            <LayoutList className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Advanced Filters */}
                {showFilters && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-slate-800">
                        <div>
                            <label className="text-xs text-slate-400 mb-1.5 block">Estado</label>
                            <select
                                className="w-full bg-slate-900 border border-slate-800 text-white rounded-lg px-3 py-2 text-sm"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                            >
                                <option value="all">Todos</option>
                                <option value="pending">Pendientes</option>
                                <option value="preparing">En Cocina</option>
                                <option value="ready">Listos</option>
                                <option value="out_for_delivery">En Camino</option>
                                <option value="delivered">Entregados</option>
                                <option value="cancelled">Cancelados</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 mb-1.5 block">Método de Pago</label>
                            <select
                                className="w-full bg-slate-900 border border-slate-800 text-white rounded-lg px-3 py-2 text-sm"
                                value={paymentFilter}
                                onChange={(e) => setPaymentFilter(e.target.value)}
                            >
                                <option value="all">Todos</option>
                                <option value="cash">Efectivo</option>
                                <option value="card">Tarjeta</option>
                                <option value="transfer">Transferencia</option>
                                <option value="credit">Cuenta Corriente</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 mb-1.5 block">Fecha</label>
                            <select
                                className="w-full bg-slate-900 border border-slate-800 text-white rounded-lg px-3 py-2 text-sm"
                                value={dateFilter}
                                onChange={(e) => setDateFilter(e.target.value)}
                            >
                                <option value="all">Todas</option>
                                <option value="today">Hoy</option>
                                <option value="yesterday">Ayer</option>
                                <option value="week">Última Semana</option>
                                <option value="month">Último Mes</option>
                            </select>
                        </div>
                        {activeFiltersCount > 0 && (
                            <div className="md:col-span-3 flex justify-end">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-slate-400 hover:text-white"
                                    onClick={clearFilters}
                                >
                                    <X className="h-4 w-4 mr-1" />
                                    Limpiar Filtros
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Orders Grid/List */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="text-center">
                        <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                        <p className="text-slate-400">Cargando pedidos...</p>
                    </div>
                </div>
            ) : filteredOrders.length === 0 ? (
                <div className="text-center py-20">
                    <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-slate-900 mb-4">
                        <Truck className="h-8 w-8 text-slate-600" />
                    </div>
                    <h3 className="text-slate-200 font-medium">No se encontraron pedidos</h3>
                    <p className="text-slate-500 text-sm mt-1">
                        {activeFiltersCount > 0 ? "Intenta ajustar los filtros" : "Comienza creando un nuevo pedido"}
                    </p>
                </div>
            ) : viewMode === "grid" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredOrders.map((order) => (
                        <div key={order.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors">
                            <div className="flex justify-between items-start mb-3">
                                {getStatusBadge(order.delivery_status || 'pending')}
                                <span className="font-mono font-bold text-emerald-400 text-lg">
                                    ${order.total.toLocaleString()}
                                </span>
                            </div>

                            <div className="space-y-2 mb-4">
                                <div className="flex items-center gap-2 text-white">
                                    <User className="h-4 w-4 text-slate-500" />
                                    <span className="font-medium">{order.customer?.name || "Sin cliente"}</span>
                                </div>
                                {order.customer?.phone && (
                                    <div className="flex items-center gap-2 text-slate-400 text-sm">
                                        <Phone className="h-3.5 w-3.5 text-slate-500" />
                                        <span>{order.customer.phone}</span>
                                    </div>
                                )}
                                {order.customer?.address && (
                                    <div className="flex items-start gap-2 text-slate-400 text-sm">
                                        <MapPin className="h-3.5 w-3.5 text-slate-500 mt-0.5 shrink-0" />
                                        <span className="line-clamp-2">{order.customer.address}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-2 text-slate-500 text-xs">
                                    <Calendar className="h-3.5 w-3.5" />
                                    <span>{formatDistanceToNow(new Date(order.created_at), { addSuffix: true, locale: es })}</span>
                                </div>
                            </div>

                            <div className="flex gap-2 pt-3 border-t border-slate-800">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
                                    onClick={() => handleViewDetails(order.id)}
                                >
                                    Ver Detalles
                                </Button>
                                {order.delivery_status === 'pending' && (
                                    <Button
                                        size="sm"
                                        className="flex-1 bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 border border-orange-500/20"
                                        onClick={() => handleUpdateStatus(order.id, 'preparing')}
                                    >
                                        <ChefHat className="h-3.5 w-3.5 mr-1" />
                                        A Cocina
                                    </Button>
                                )}
                                {order.delivery_status === 'preparing' && (
                                    <Button
                                        size="sm"
                                        className="flex-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20"
                                        onClick={() => handleUpdateStatus(order.id, 'ready')}
                                    >
                                        Listo
                                    </Button>
                                )}
                                {order.delivery_status === 'ready' && (
                                    <Button
                                        size="sm"
                                        className="flex-1 bg-purple-500/10 hover:bg-purple-500/20 text-purple-500 border border-purple-500/20"
                                        onClick={() => handleUpdateStatus(order.id, 'out_for_delivery')}
                                    >
                                        <Truck className="h-3.5 w-3.5 mr-1" />
                                        Enviar
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-900 border-b border-slate-800">
                                <tr>
                                    <th className="text-left p-4 text-slate-400 font-medium text-sm">Cliente</th>
                                    <th className="text-left p-4 text-slate-400 font-medium text-sm">Estado</th>
                                    <th className="text-left p-4 text-slate-400 font-medium text-sm">Monto</th>
                                    <th className="text-left p-4 text-slate-400 font-medium text-sm">Fecha</th>
                                    <th className="text-right p-4 text-slate-400 font-medium text-sm">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {filteredOrders.map((order) => (
                                    <tr key={order.id} className="hover:bg-slate-900/50 transition-colors">
                                        <td className="p-4">
                                            <div>
                                                <p className="text-white font-medium">{order.customer?.name || "Sin cliente"}</p>
                                                {order.customer?.phone && (
                                                    <p className="text-slate-400 text-sm">{order.customer.phone}</p>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            {getStatusBadge(order.delivery_status || 'pending')}
                                        </td>
                                        <td className="p-4">
                                            <span className="font-mono font-bold text-emerald-400">
                                                ${order.total.toLocaleString()}
                                            </span>
                                        </td>
                                        <td className="p-4 text-slate-400 text-sm">
                                            {format(new Date(order.created_at), "dd/MM/yyyy HH:mm", { locale: es })}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="border-slate-700 text-slate-300"
                                                    onClick={() => handleViewDetails(order.id)}
                                                >
                                                    Ver
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <OrderDetailsModal
                orderId={selectedOrderId}
                open={detailsOpen}
                onOpenChange={setDetailsOpen}
            />
        </div>
    );
}
