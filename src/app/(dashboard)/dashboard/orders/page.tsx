"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Plus, Search, Filter, Truck, CheckCircle, Clock, AlertCircle, ChefHat, MapPin, Phone, DollarSign, Calendar, LayoutGrid, LayoutList, ArrowUpDown, X, User, Edit, ListPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { format, formatDistanceToNow, startOfDay, endOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { OrderDetailsModal } from "@/components/delivery/OrderDetailsModal";
import { DeliveryConfirmationModal } from "@/components/delivery/DeliveryConfirmationModal";
import { EditOrderModal } from "@/components/orders/EditOrderModal";
import { DownloadRemitoButton } from "@/components/orders/DownloadRemitoButton";
import { ViewInvoiceButton } from "@/components/orders/ViewInvoiceButton";
import { CreateInvoiceModal } from "@/components/invoices/CreateInvoiceModal";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type ViewMode = "grid" | "list" | "expanded";
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
    const [deliveryConfirmOpen, setDeliveryConfirmOpen] = useState(false);
    const [orderToDeliver, setOrderToDeliver] = useState<any>(null);
    const [editOpen, setEditOpen] = useState(false);
    const [orderToEdit, setOrderToEdit] = useState<any>(null);
    const [viewMode, setViewMode] = useState<ViewMode>("grid");
    const [sortField, setSortField] = useState<SortField>("created_at");
    const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
    const [showFilters, setShowFilters] = useState(false);
    const [createInvoiceOpen, setCreateInvoiceOpen] = useState(false);
    const [orderForInvoice, setOrderForInvoice] = useState<any>(null);

    const handleCreateInvoice = (order: any) => {
        setOrderForInvoice(order);
        setCreateInvoiceOpen(true);
    };

    // Persist viewMode
    useEffect(() => {
        const savedView = localStorage.getItem("ordersViewMode");
        if (savedView && (savedView === "grid" || savedView === "list" || savedView === "expanded")) {
            setViewMode(savedView as ViewMode);
        }
    }, []);

    const handleViewModeChange = (mode: ViewMode) => {
        setViewMode(mode);
        localStorage.setItem("ordersViewMode", mode);
    };

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
            .select('*, customer:customers(name, phone, address, cuit), order_items(*), invoices(*)')
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

    const handleEditOrder = (order: any) => {
        setOrderToEdit(order);
        setEditOpen(true);
    };

    const handleUpdateStatus = async (orderId: string, newStatus: string) => {
        // If marking as delivered, open confirmation modal
        if (newStatus === 'delivered') {
            const order = orders.find(o => o.id === orderId);
            if (order) {
                setOrderToDeliver(order);
                setDeliveryConfirmOpen(true);
            }
            return;
        }

        // For other status updates, proceed normally
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

    const getPaymentMethodBadge = (method: string) => {
        const styles: Record<string, string> = {
            cash: "bg-green-500/10 text-green-400 border-green-500/20",
            card: "bg-blue-500/10 text-blue-400 border-blue-500/20",
            transfer: "bg-purple-500/10 text-purple-400 border-purple-500/20",
            credit: "bg-orange-500/10 text-orange-400 border-orange-500/20"
        };

        const labels: Record<string, string> = {
            cash: "Efectivo",
            card: "Tarjeta",
            transfer: "Transferencia",
            credit: "Cuenta Cte."
        };

        return (
            <Badge className={`${styles[method] || styles.cash} border text-xs`}>
                {labels[method] || method}
            </Badge>
        );
    };

    const getPaymentStatusBadge = (status: string | null, paymentAmount: number | null, total: number) => {
        const isPaid = status === 'paid' || (paymentAmount !== null && paymentAmount >= total);
        const isPartial = paymentAmount !== null && paymentAmount > 0 && paymentAmount < total;

        if (isPaid) {
            return (
                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 border text-xs">
                    Pagado
                </Badge>
            );
        } else if (isPartial) {
            return (
                <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 border text-xs">
                    Parcial ${paymentAmount.toLocaleString()}
                </Badge>
            );
        } else {
            return (
                <Badge className="bg-red-500/10 text-red-400 border-red-500/20 border text-xs">
                    Pendiente
                </Badge>
            );
        }
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
                            onClick={() => handleViewModeChange('grid')}
                        >
                            <LayoutGrid className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            className={`border-slate-800 ${viewMode === 'list' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}
                            onClick={() => handleViewModeChange('list')}
                        >
                            <LayoutList className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            className={`border-slate-800 ${viewMode === 'expanded' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}
                            onClick={() => handleViewModeChange('expanded')}
                        >
                            <ListPlus className="h-4 w-4" />
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
            ) : (
                <>
                    {viewMode === "grid" && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {filteredOrders.map((order) => (
                                <div key={order.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-3 hover:border-slate-700 transition-colors">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="font-medium text-white text-lg">{order.customer?.name || "Cliente Ocasional"}</h3>
                                            <p className="text-slate-500 text-sm">#{order.id.slice(0, 8)}</p>
                                        </div>
                                        {getStatusBadge(order.delivery_status || 'pending')}
                                    </div>

                                    <div className="flex items-center justify-between py-2 border-y border-slate-800">
                                        <div className="flex items-center gap-2 text-slate-300">
                                            <DollarSign className="h-4 w-4 text-emerald-500" />
                                            <span className="font-semibold text-lg">${order.total.toLocaleString()}</span>
                                        </div>
                                        <div className="text-right text-xs text-slate-500">
                                            {order.order_items?.length || 0} items
                                        </div>
                                    </div>

                                    <div className="space-y-2 text-sm">
                                        {order.delivery_status !== 'delivered' && order.delivery_status !== 'cancelled' && (
                                            <div className="flex items-start gap-2">
                                                <Clock className="h-4 w-4 text-slate-500 mt-0.5 shrink-0" />
                                                <span className="text-amber-400 font-medium">
                                                    Entrega est: {order.estimated_mins} min
                                                </span>
                                            </div>
                                        )}
                                        {order.delivery_address && (
                                            <div className="flex items-start gap-2">
                                                <MapPin className="h-3.5 w-3.5 text-slate-500 mt-0.5 shrink-0" />
                                                <span className="line-clamp-2">{order.customer?.address || order.delivery_address}</span>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {getPaymentMethodBadge(order.payment_method)}
                                            {getPaymentStatusBadge(order.payment_status, order.payment_amount, order.total)}
                                        </div>
                                        <div className="flex items-center gap-2 text-slate-500 text-xs">
                                            <Calendar className="h-3.5 w-3.5" />
                                            <span>{formatDistanceToNow(new Date(order.created_at), { addSuffix: true, locale: es })}</span>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 mb-2 items-center">
                                        {/* Remito */}
                                        <div className="flex-1">
                                            <DownloadRemitoButton order={order} className="w-full" />
                                        </div>
                                        {/* Factura */}
                                        <div className="flex-1">
                                            {order.invoices && order.invoices.length > 0 ? (
                                                <ViewInvoiceButton invoice={order.invoices[0]} order={order} className="w-full" />
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="w-full border-slate-700 text-slate-300 hover:bg-slate-800"
                                                    onClick={() => handleCreateInvoice(order)}
                                                >
                                                    <DollarSign className="h-3.5 w-3.5 mr-1 text-slate-400" />
                                                    Facturar
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="border-blue-700 text-blue-400 hover:bg-blue-500/10"
                                            onClick={() => handleEditOrder(order)}
                                        >
                                            <Edit className="h-3.5 w-3.5 mr-1" />
                                            Editar
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="border-slate-700 text-slate-300 hover:bg-slate-800"
                                            onClick={() => handleViewDetails(order.id)}
                                        >
                                            Ver Detalles
                                        </Button>
                                    </div>

                                    <div className="flex gap-2 mt-2">
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
                                                className="flex-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20"
                                                onClick={() => handleUpdateStatus(order.id, 'ready')}
                                            >
                                                <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                                Listo
                                            </Button>
                                        )}
                                        {order.delivery_status === 'ready' && (
                                            <Button
                                                size="sm"
                                                className="flex-1 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20"
                                                onClick={() => handleUpdateStatus(order.id, 'out_for_delivery')}
                                            >
                                                <Truck className="h-3.5 w-3.5 mr-1" />
                                                Enviar
                                            </Button>
                                        )}
                                        {order.delivery_status === 'out_for_delivery' && (
                                            <Button
                                                size="sm"
                                                className="flex-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20"
                                                onClick={() => handleUpdateStatus(order.id, 'delivered')}
                                            >
                                                <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                                Entregar
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {viewMode === "list" && (
                        <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-slate-900 border-b border-slate-800">
                                        <tr>
                                            <th className="text-left p-4 text-slate-400 font-medium text-sm">Cliente</th>
                                            <th className="text-left p-4 text-slate-400 font-medium text-sm">Estado</th>
                                            <th className="text-left p-4 text-slate-400 font-medium text-sm">Monto</th>
                                            <th className="text-left p-4 text-slate-400 font-medium text-sm">Pago</th>
                                            <th className="text-left p-4 text-slate-400 font-medium text-sm">Estado Pago</th>
                                            <th className="text-left p-4 text-slate-400 font-medium text-sm">Fecha</th>
                                            <th className="text-right p-4 text-slate-400 font-medium text-sm">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800">
                                        {filteredOrders.map((order) => (
                                            <tr key={order.id} className="border-b border-slate-800/50 hover:bg-slate-800/50">
                                                <td className="p-4 font-medium text-white">
                                                    {order.customer?.name || "Cliente Ocasional"}
                                                </td>
                                                <td className="p-4">
                                                    {getStatusBadge(order.delivery_status || 'pending')}
                                                </td>
                                                <td className="p-4 font-mono text-emerald-400">
                                                    ${order.total.toLocaleString()}
                                                </td>
                                                <td className="p-4">
                                                    {getPaymentMethodBadge(order.payment_method)}
                                                </td>
                                                <td className="p-4">
                                                    {getPaymentStatusBadge(order.payment_status, order.payment_amount, order.total)}
                                                </td>
                                                <td className="p-4 text-slate-400 text-sm">
                                                    {format(new Date(order.created_at), "dd/MM/yyyy HH:mm", { locale: es })}
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex justify-end gap-2 items-center">
                                                        {/* Documentos */}
                                                        <div className="flex gap-1 mr-2 border-r border-slate-800 pr-2">
                                                            <DownloadRemitoButton order={order} className="w-8" compact={true} />

                                                            {order.invoices && order.invoices.length > 0 ? (
                                                                <ViewInvoiceButton invoice={order.invoices[0]} order={order} className="w-8" compact={true} />
                                                            ) : (
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    className="h-8 w-8 p-0 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10"
                                                                    title="Generar Factura"
                                                                    onClick={() => handleCreateInvoice(order)}
                                                                >
                                                                    <DollarSign className="h-4 w-4" />
                                                                </Button>
                                                            )}
                                                        </div>

                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-8 w-8 p-0 text-blue-400 hover:bg-blue-500/10"
                                                            onClick={() => handleEditOrder(order)}
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="text-slate-300 hover:bg-slate-800"
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

                    {viewMode === "expanded" && (
                        <div className="space-y-4">
                            {filteredOrders.map((order) => (
                                <div key={order.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-slate-700 transition-colors">
                                    {/* Header */}
                                    <div className="p-4 border-b border-slate-800 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-slate-900/50">
                                        <div className="flex gap-4 items-center">
                                            <div className="h-12 w-12 bg-slate-800 rounded-full flex items-center justify-center text-slate-400">
                                                <User className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-white text-lg">{order.customer?.name || "Cliente Ocasional"}</h3>
                                                <div className="flex items-center gap-2 text-slate-500 text-sm">
                                                    <Clock className="h-3.5 w-3.5" />
                                                    <span>{formatDistanceToNow(new Date(order.created_at), { addSuffix: true, locale: es })}</span>
                                                    <span>•</span>
                                                    <span>#{order.id.slice(0, 8)}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-2">
                                            <div className="flex gap-2">
                                                {getStatusBadge(order.delivery_status || 'pending')}
                                                {getPaymentStatusBadge(order.payment_status, order.payment_amount, order.total)}
                                            </div>
                                            {order.delivery_status !== 'delivered' && (
                                                <span className="text-amber-400 text-sm font-medium">
                                                    Entrega est: {order.estimated_mins} min
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
                                        {/* Order Items */}
                                        <div className="lg:col-span-2 space-y-3">
                                            <h4 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Productos</h4>
                                            <div className="bg-slate-950/50 rounded-lg p-3 space-y-2">
                                                {order.order_items?.map((item: any) => (
                                                    <div key={item.id} className="flex justify-between items-center text-sm border-b border-slate-800/50 last:border-0 pb-2 last:pb-0">
                                                        <div className="flex items-center gap-3">
                                                            <span className="bg-slate-800 text-white w-6 h-6 rounded flex items-center justify-center text-xs font-bold">
                                                                {item.quantity}
                                                            </span>
                                                            <span className="text-slate-200">{item.product_name}</span>
                                                        </div>
                                                        <span className="text-slate-400 font-mono">${(item.total).toLocaleString()}</span>
                                                    </div>
                                                ))}
                                                {!order.order_items?.length && (
                                                    <p className="text-slate-500 text-sm italic">Sin productos registrados</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Details & Actions */}
                                        <div className="space-y-4">
                                            <div>
                                                <h4 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Detalles de Entrega</h4>
                                                <div className="bg-slate-950/50 rounded-lg p-3 space-y-2 text-sm">
                                                    {order.customer?.address && (
                                                        <div className="flex gap-2 text-slate-300">
                                                            <MapPin className="h-4 w-4 text-slate-500 shrink-0" />
                                                            <span>{order.customer.address}</span>
                                                        </div>
                                                    )}
                                                    {order.delivery_notes && (
                                                        <div className="flex gap-2 text-amber-300/80 bg-amber-900/20 p-2 rounded">
                                                            <AlertCircle className="h-4 w-4 shrink-0" />
                                                            <span className="italic">"{order.delivery_notes}"</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div>
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-slate-400">Total</span>
                                                    <span className="text-emerald-400 font-bold text-xl">${order.total.toLocaleString()}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-sm text-slate-500">
                                                    <span>MétodoPago</span>
                                                    <span className="text-slate-300 capitalize">{order.payment_method === 'credit' ? 'Cuenta Cte.' : order.payment_method}</span>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2">
                                                <Button
                                                    variant="outline"
                                                    className="border-blue-700 text-blue-400 hover:bg-blue-500/10"
                                                    onClick={() => handleEditOrder(order)}
                                                >
                                                    <Edit className="h-4 w-4 mr-2" />
                                                    Editar
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    className="border-slate-700 text-slate-300"
                                                    onClick={() => handleViewDetails(order.id)}
                                                >
                                                    Detalles
                                                </Button>

                                                {/* Documentación */}
                                                <DownloadRemitoButton order={order} className="col-span-1" />

                                                {order.invoices && order.invoices.length > 0 ? (
                                                    <ViewInvoiceButton invoice={order.invoices[0]} order={order} className="col-span-1" />
                                                ) : (
                                                    <Button
                                                        variant="outline"
                                                        className="col-span-1 border-slate-700 text-slate-300 hover:bg-slate-800"
                                                        onClick={() => handleCreateInvoice(order)}
                                                    >
                                                        <DollarSign className="h-4 w-4 mr-2 text-slate-400" />
                                                        Facturar
                                                    </Button>
                                                )}

                                                {/* Status Actions */}
                                                <div className="col-span-2 pt-2 border-t border-slate-800/50 mt-2">
                                                    {order.delivery_status === 'pending' && (
                                                        <Button
                                                            className="w-full bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 border border-orange-500/20"
                                                            onClick={() => handleUpdateStatus(order.id, 'preparing')}
                                                        >
                                                            <ChefHat className="h-4 w-4 mr-2" />
                                                            Enviar a Cocina
                                                        </Button>
                                                    )}
                                                    {order.delivery_status === 'preparing' && (
                                                        <Button
                                                            className="w-full bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20"
                                                            onClick={() => handleUpdateStatus(order.id, 'ready')}
                                                        >
                                                            <CheckCircle className="h-4 w-4 mr-2" />
                                                            Marcar Listo
                                                        </Button>
                                                    )}
                                                    {order.delivery_status === 'ready' && (
                                                        <Button
                                                            className="w-full bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20"
                                                            onClick={() => handleUpdateStatus(order.id, 'out_for_delivery')}
                                                        >
                                                            <Truck className="h-4 w-4 mr-2" />
                                                            Enviar Reparto
                                                        </Button>
                                                    )}
                                                    {order.delivery_status === 'out_for_delivery' && (
                                                        <Button
                                                            className="w-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20"
                                                            onClick={() => handleUpdateStatus(order.id, 'delivered')}
                                                        >
                                                            <CheckCircle className="h-4 w-4 mr-2" />
                                                            Confirmar Entrega
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}


            <OrderDetailsModal
                orderId={selectedOrderId}
                open={detailsOpen}
                onOpenChange={setDetailsOpen}
            />

            <DeliveryConfirmationModal
                orderId={orderToDeliver?.id || null}
                orderTotal={orderToDeliver?.total || 0}
                currentPaymentMethod={orderToDeliver?.payment_method || "cash"}
                open={deliveryConfirmOpen}
                onOpenChange={setDeliveryConfirmOpen}
                onSuccess={fetchOrders}
            />

            <EditOrderModal
                orderId={orderToEdit?.id || null}
                orderData={orderToEdit}
                open={editOpen}
                onOpenChange={setEditOpen}
                onSuccess={fetchOrders}
            />

            {createInvoiceOpen && (
                <CreateInvoiceModal
                    open={createInvoiceOpen}
                    onOpenChange={setCreateInvoiceOpen}
                    organizationId={organizationId || ""}
                    onSuccess={() => {
                        fetchOrders();
                        setCreateInvoiceOpen(false);
                    }}
                    preselectedOrder={orderForInvoice}
                />
            )}
        </div>
    );
}
