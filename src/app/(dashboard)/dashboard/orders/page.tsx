"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Plus, Search, Filter, Truck, CheckCircle, Clock, AlertCircle, ChefHat, MapPin, Phone, DollarSign, Calendar, LayoutGrid, LayoutList, ArrowUpDown, X, User, Edit, ListPlus, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { format, formatDistanceToNow, startOfDay, differenceInMinutes } from "date-fns";
import { es } from "date-fns/locale";
import { OrderDetailsModal } from "@/components/delivery/OrderDetailsModal";
import { DeliveryConfirmationModal } from "@/components/delivery/DeliveryConfirmationModal";
import { EditOrderModal } from "@/components/orders/EditOrderModal";
import { DownloadRemitoButton } from "@/components/orders/DownloadRemitoButton";
import { ViewInvoiceButton } from "@/components/orders/ViewInvoiceButton";
import { CreateInvoiceModal } from "@/components/invoices/CreateInvoiceModal";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

type ViewMode = "grid" | "list";
type SortField = "created_at" | "total" | "customer" | "status";
type SortOrder = "asc" | "desc";

export default function DashboardOrdersPage() {
    const { organizationId } = useOrganization();
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("active"); // Show only active orders by default
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

    // State for collapsible groups (expanded by default for better UX)
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

    // State for bulk actions
    const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());

    const toggleGroup = (groupKey: string) => {
        setExpandedGroups(prev => ({
            ...prev,
            [groupKey]: !prev[groupKey]
        }));
    };

    const toggleOrderSelection = (orderId: string) => {
        setSelectedOrders(prev => {
            const newSet = new Set(prev);
            if (newSet.has(orderId)) {
                newSet.delete(orderId);
            } else {
                newSet.add(orderId);
            }
            return newSet;
        });
    };

    const selectAllInGroup = (groupOrders: any[]) => {
        setSelectedOrders(prev => {
            const newSet = new Set(prev);
            groupOrders.forEach(order => newSet.add(order.id));
            return newSet;
        });
    };

    const deselectAllInGroup = (groupOrders: any[]) => {
        setSelectedOrders(prev => {
            const newSet = new Set(prev);
            groupOrders.forEach(order => newSet.delete(order.id));
            return newSet;
        });
    };

    // Helper to format item summary
    const getOrderSummary = (items: any[]) => {
        if (!items || items.length === 0) return "Sin items";
        return items.map(i => `${i.quantity}x ${i.product_name}`).join(", ");
    };

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

    // Filter label mappings for chips
    const statusLabels: Record<string, string> = {
        active: "Activos",
        all: "Todos",
        pending: "Pendientes",
        preparing: "En Cocina",
        ready: "Listos",
        out_for_delivery: "En Camino",
        delivered: "Entregados",
        cancelled: "Cancelados"
    };

    const paymentLabels: Record<string, string> = {
        all: "Todos",
        cash: "Efectivo",
        card: "Tarjeta",
        transfer: "Transferencia",
        credit: "Cuenta Corriente"
    };

    const dateLabels: Record<string, string> = {
        all: "Todas",
        today: "Hoy",
        yesterday: "Ayer",
        week: "Esta Semana",
        month: "Este Mes"
    };

    // Urgency indicator based on time and status
    const getUrgencyIndicator = (createdAt: string, status: string) => {
        const minutesAgo = differenceInMinutes(new Date(), new Date(createdAt));

        if (status === 'pending' && minutesAgo > 30) {
            return (
                <Badge className="animate-pulse bg-red-500/20 text-red-400 border-red-500/30 text-xs">
                    ¡Urgente! {minutesAgo}min
                </Badge>
            );
        }
        if (status === 'preparing' && minutesAgo > 45) {
            return (
                <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs">
                    Revisar {minutesAgo}min
                </Badge>
            );
        }
        if (status === 'ready' && minutesAgo > 20) {
            return (
                <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">
                    Listo hace {minutesAgo}min
                </Badge>
            );
        }
        return null;
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
        if (statusFilter === "active") {
            // Show only active orders (exclude delivered and cancelled)
            filtered = filtered.filter(o =>
                o.delivery_status !== 'delivered' && o.delivery_status !== 'cancelled'
            );
        } else if (statusFilter !== "all") {
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

    // Grouping Logic for Grid View
    const groupedOrders = filteredOrders.reduce((acc, order) => {
        const customerId = order.customer?.id || order.customer?.name || 'guest'; // specific fallback
        const key = `${customerId}-${order.customer?.name}`; // composite key to be safe

        if (!acc[key]) {
            acc[key] = {
                key,
                customerId,
                customerName: order.customer?.name || "Cliente Ocasional",
                customerAddress: order.customer?.address || order.delivery_address || "",
                orders: [],
                totalAmount: 0,
                lastCreatedAt: order.created_at
            };
        }

        acc[key].orders.push(order);
        acc[key].totalAmount += order.total;
        if (new Date(order.created_at) > new Date(acc[key].lastCreatedAt)) {
            acc[key].lastCreatedAt = order.created_at;
        }

        return acc;
    }, {} as Record<string, any>);

    const sortedGroups = Object.values(groupedOrders).sort((a: any, b: any) =>
        new Date(b.lastCreatedAt).getTime() - new Date(a.lastCreatedAt).getTime()
    );

    // Initialize expanded groups when sortedGroups changes (expand all by default)
    useEffect(() => {
        const initialExpanded: Record<string, boolean> = {};
        sortedGroups.forEach((group: any) => {
            if (!(group.key in expandedGroups)) {
                initialExpanded[group.key] = true; // Expand by default
            }
        });
        if (Object.keys(initialExpanded).length > 0) {
            setExpandedGroups(prev => ({ ...prev, ...initialExpanded }));
        }
    }, [sortedGroups.length]);

    const handleDeliverGroup = (groupOrders: any[]) => {
        setOrderToDeliver(groupOrders);
        setDeliveryConfirmOpen(true);
    };

    const handleMarkGroupReady = async (groupOrders: any[]) => {
        try {
            const orderIds = groupOrders.map(o => o.id);
            const { error } = await supabase
                .from('orders')
                .update({ delivery_status: 'ready' })
                .in('id', orderIds);

            if (error) throw error;
            toast.success(`${groupOrders.length} pedidos marcados como listos`);
            fetchOrders();
        } catch (error: any) {
            toast.error('Error al actualizar pedidos: ' + error.message);
        }
    };

    const handleBulkDeliver = async (orderIds: string[]) => {
        try {
            const ordersToDeliver = orders.filter(o => orderIds.includes(o.id));
            setOrderToDeliver(ordersToDeliver);
            setDeliveryConfirmOpen(true);
        } catch (error: any) {
            toast.error('Error: ' + error.message);
        }
    };

    const handleBulkStatusChange = async (orderIds: string[], status: string) => {
        try {
            const { error } = await supabase
                .from('orders')
                .update({ delivery_status: status })
                .in('id', orderIds);

            if (error) throw error;
            toast.success(`${orderIds.length} pedidos actualizados`);
            setSelectedOrders(new Set());
            fetchOrders();
        } catch (error: any) {
            toast.error('Error al actualizar pedidos: ' + error.message);
        }
    };

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
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">Pedidos</h1>
                    <p className="text-slate-400 mt-1">Gestiona todos los pedidos de delivery</p>
                </div>
                <Link href="/dashboard/orders/new" className="w-full sm:w-auto">
                    <Button className="bg-emerald-600 hover:bg-emerald-500 w-full sm:w-auto">
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
                                <option value="active">Activos</option>
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

            {/* Active Filter Chips */}
            {(statusFilter !== 'active' || paymentFilter !== 'all' || dateFilter !== 'all') && (
                <div className="flex gap-2 flex-wrap">
                    {statusFilter !== 'active' && (
                        <Badge
                            variant="secondary"
                            className="gap-2 px-3 py-1.5 bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-800"
                        >
                            <span className="text-xs">Estado: <span className="font-semibold">{statusLabels[statusFilter]}</span></span>
                            <X
                                className="h-3 w-3 cursor-pointer hover:text-red-400 transition-colors"
                                onClick={() => setStatusFilter('active')}
                            />
                        </Badge>
                    )}
                    {paymentFilter !== 'all' && (
                        <Badge
                            variant="secondary"
                            className="gap-2 px-3 py-1.5 bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-800"
                        >
                            <span className="text-xs">Pago: <span className="font-semibold">{paymentLabels[paymentFilter]}</span></span>
                            <X
                                className="h-3 w-3 cursor-pointer hover:text-red-400 transition-colors"
                                onClick={() => setPaymentFilter('all')}
                            />
                        </Badge>
                    )}
                    {dateFilter !== 'all' && (
                        <Badge
                            variant="secondary"
                            className="gap-2 px-3 py-1.5 bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-800"
                        >
                            <span className="text-xs">Fecha: <span className="font-semibold">{dateLabels[dateFilter]}</span></span>
                            <X
                                className="h-3 w-3 cursor-pointer hover:text-red-400 transition-colors"
                                onClick={() => setDateFilter('all')}
                            />
                        </Badge>
                    )}
                </div>
            )}

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
                            {sortedGroups.map((group: any) => (
                                <div key={group.key} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-slate-700 transition-colors shadow-sm">
                                    {/* Group Header */}
                                    <div className="p-4 bg-slate-900/50 border-b border-slate-800">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                <User className="h-4 w-4 text-emerald-500" />
                                                <h3 className="font-bold text-white text-base truncate max-w-[150px]" title={group.customerName}>
                                                    {group.customerName}
                                                </h3>
                                            </div>
                                            <Badge variant="outline" className="text-xs border-slate-700 text-slate-300">
                                                {group.orders.length} pedidos
                                            </Badge>
                                        </div>

                                        <div className="flex justify-between items-end">
                                            <div className="flex items-start gap-1.5 text-slate-500 text-xs mt-1 max-w-[70%]">
                                                <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
                                                <span className="line-clamp-2 leading-tight">
                                                    {group.customerAddress || "Sin dirección"}
                                                </span>
                                            </div>
                                            <div className="text-right">
                                                <span className="block text-xl font-mono font-bold text-emerald-400">
                                                    ${group.totalAmount.toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Mini List of Orders */}
                                    <div className="p-2 gap-2 flex flex-col bg-slate-950/20 max-h-[300px] overflow-y-auto custom-scrollbar">
                                        {group.orders.map((order: any, index: number) => (
                                            <div key={order.id} className="bg-slate-900 border border-slate-800 rounded-lg p-3 hover:border-slate-700 transition-colors relative overflow-hidden shrink-0">
                                                {/* Numbering Badge */}
                                                <div className="absolute top-0 right-0 bg-slate-800 text-[10px] text-slate-400 px-2 py-0.5 rounded-bl-lg font-mono border-b border-l border-slate-700">
                                                    #{group.orders.length - index}
                                                </div>

                                                <div className="flex justify-between items-start mb-2 pr-6">
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            {getStatusBadge(order.delivery_status || 'pending')}
                                                            {getUrgencyIndicator(order.created_at, order.delivery_status || 'pending')}
                                                            <span className="text-[10px] text-slate-500 font-mono">#{order.id.slice(0, 4)}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                                            <Clock className="h-3 w-3" />
                                                            <span>{formatDistanceToNow(new Date(order.created_at), { addSuffix: true, locale: es })}</span>
                                                        </div>
                                                    </div>
                                                    <span className="font-mono font-medium text-white text-sm">
                                                        ${order.total.toLocaleString()}
                                                    </span>
                                                </div>

                                                {/* Item Summary */}
                                                <div className="mb-2 text-[10px] text-slate-300 bg-slate-950/50 p-1.5 rounded border border-slate-800/50">
                                                    {getOrderSummary(order.order_items)}
                                                </div>

                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-6 px-2 text-[10px] text-slate-400 hover:text-white hover:bg-slate-800"
                                                        onClick={() => handleViewDetails(order.id)}
                                                    >
                                                        Ver Detalles
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Footer Actions */}
                                    <div className="p-3 bg-slate-900 border-t border-slate-800 flex gap-2">
                                        <Button
                                            className="flex-1 bg-emerald-600/90 hover:bg-emerald-500 text-white h-9 text-xs"
                                            onClick={() => handleDeliverGroup(group.orders)}
                                        >
                                            <DollarSign className="h-3.5 w-3.5 mr-1.5" />
                                            Cobrar / Entregar
                                        </Button>
                                    </div>
                                </div >
                            ))
                            }
                        </div >
                    )}

                    {
                        viewMode === "list" && (
                            <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-slate-900 border-b border-slate-800">
                                            <tr>
                                                <th className="text-left p-4 text-slate-400 font-medium text-sm w-[30%]">Detalles del Pedido</th>
                                                <th className="text-left p-4 text-slate-400 font-medium text-sm">Estado</th>
                                                <th className="text-left p-4 text-slate-400 font-medium text-sm">Monto</th>
                                                <th className="text-left p-4 text-slate-400 font-medium text-sm hidden md:table-cell">Pago</th>
                                                <th className="text-left p-4 text-slate-400 font-medium text-sm hidden md:table-cell">Estado Pago</th>
                                                <th className="text-left p-4 text-slate-400 font-medium text-sm hidden md:table-cell">Fecha</th>
                                                <th className="text-right p-4 text-slate-400 font-medium text-sm">Acciones</th>
                                            </tr>
                                        </thead>
                                        {sortedGroups.map((group: any) => (
                                            <tbody key={group.key} className="border-b-4 border-slate-950/50">
                                                {/* Group Header */}
                                                <tr
                                                    className="bg-slate-900/80 border-b border-slate-800 hover:bg-slate-800 transition-colors"
                                                >
                                                    <td colSpan={7} className="p-3 px-4">
                                                        <div className="flex justify-between items-center gap-4">
                                                            <div className="flex items-center gap-3 flex-1">
                                                                <div
                                                                    className="text-slate-500 cursor-pointer hover:text-slate-300"
                                                                    onClick={() => toggleGroup(group.key)}
                                                                >
                                                                    {expandedGroups[group.key] ? (
                                                                        <ChevronDown className="h-5 w-5" />
                                                                    ) : (
                                                                        <ChevronRight className="h-5 w-5" />
                                                                    )}
                                                                </div>
                                                                <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 text-xs">
                                                                    <User className="h-4 w-4" />
                                                                </div>
                                                                <div className="flex-1">
                                                                    <span className="font-bold text-white text-sm block">{group.customerName}</span>
                                                                    <span className="text-xs text-slate-500 block flex items-center gap-1">
                                                                        <MapPin className="h-3 w-3" /> {group.customerAddress || "Retira en local"}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <Badge variant="outline" className="text-xs border-slate-700 text-slate-400">
                                                                    {group.orders.length} pedidos
                                                                </Badge>
                                                                <span className="font-mono text-emerald-400 font-bold">
                                                                    ${group.totalAmount.toLocaleString()}
                                                                </span>
                                                                {/* Quick Action Buttons */}
                                                                <div className="flex gap-2">
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        className="h-8 px-3 text-xs border-emerald-700/50 text-emerald-400 hover:bg-emerald-500/10"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleMarkGroupReady(group.orders);
                                                                        }}
                                                                    >
                                                                        <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                                                        Marcar Listos
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-500"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleDeliverGroup(group.orders);
                                                                        }}
                                                                    >
                                                                        <Truck className="h-3.5 w-3.5 mr-1" />
                                                                        Entregar Todo
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>

                                                {/* Orders - ONLY show if expanded */}
                                                {expandedGroups[group.key] && group.orders.map((order: any, index: number) => (
                                                    <tr key={order.id} className="border-b border-slate-800/30 hover:bg-slate-800/30 bg-slate-950/20">
                                                        <td className="p-4 pl-6 border-l-4 border-transparent hover:border-emerald-500/30 transition-colors">
                                                            <div className="flex items-center gap-3">
                                                                <Checkbox
                                                                    checked={selectedOrders.has(order.id)}
                                                                    onCheckedChange={() => toggleOrderSelection(order.id)}
                                                                    className="border-slate-600"
                                                                />
                                                                <div className="flex flex-col gap-1">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="bg-slate-800 text-slate-300 text-[10px] px-1.5 py-0.5 rounded border border-slate-700">
                                                                            #{group.orders.length - index}
                                                                        </span>
                                                                        <span className="text-xs text-slate-500 font-mono">ID: {order.id.slice(0, 4)}</span>
                                                                    </div>
                                                                    <span className="text-xs text-slate-300 italic">
                                                                        {getOrderSummary(order.order_items)}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="p-4">
                                                            <div className="flex flex-col gap-1.5">
                                                                {getStatusBadge(order.delivery_status || 'pending')}
                                                                {getUrgencyIndicator(order.created_at, order.delivery_status || 'pending')}
                                                            </div>
                                                        </td>
                                                        <td className="p-4 font-mono text-emerald-400 text-sm">
                                                            ${order.total.toLocaleString()}
                                                        </td>
                                                        <td className="p-4 hidden md:table-cell">
                                                            {getPaymentMethodBadge(order.payment_method)}
                                                        </td>
                                                        <td className="p-4 hidden md:table-cell">
                                                            {getPaymentStatusBadge(order.payment_status, order.payment_amount, order.total)}
                                                        </td>
                                                        <td className="p-4 text-slate-400 text-xs hidden md:table-cell">
                                                            {format(new Date(order.created_at), "dd/MM HH:mm", { locale: es })}
                                                        </td>
                                                        <td className="p-4">
                                                            <div className="flex justify-end gap-2 items-center">
                                                                <DownloadRemitoButton order={order} className="w-8 h-8" compact={true} />

                                                                <Link href={`/dashboard/orders/edit/${order.id}`}>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        className="h-8 w-8 p-0 text-blue-400 hover:bg-blue-500/10"
                                                                    >
                                                                        <Edit className="h-4 w-4" />
                                                                    </Button>
                                                                </Link>

                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    className="text-slate-300 hover:bg-slate-800 h-8 px-2 text-xs"
                                                                    onClick={() => handleViewDetails(order.id)}
                                                                >
                                                                    Ver
                                                                </Button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        ))}
                                    </table>
                                </div>
                            </div>
                        )
                    }
                </>
            )}


            <OrderDetailsModal
                orderId={selectedOrderId}
                open={detailsOpen}
                onOpenChange={setDetailsOpen}
                onSuccess={fetchOrders}
            />

            <DeliveryConfirmationModal
                // Adapted for multiple orders
                orders={Array.isArray(orderToDeliver) ? orderToDeliver : (orderToDeliver ? [orderToDeliver] : [])}
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

            {
                createInvoiceOpen && (
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
                )
            }

            {/* Floating Bulk Action Bar */}
            {selectedOrders.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4">
                    <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-4 min-w-[500px]">
                        <div className="flex items-center justify-between gap-6">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                                    <CheckCircle className="h-5 w-5 text-emerald-500" />
                                </div>
                                <div>
                                    <p className="text-white font-semibold text-sm">
                                        {selectedOrders.size} {selectedOrders.size === 1 ? 'pedido seleccionado' : 'pedidos seleccionados'}
                                    </p>
                                    <p className="text-slate-400 text-xs">Selecciona una acción para aplicar</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-slate-700 text-slate-300 hover:bg-slate-800"
                                    onClick={() => handleBulkStatusChange(Array.from(selectedOrders), 'ready')}
                                >
                                    <CheckCircle className="h-4 w-4 mr-1.5" />
                                    Marcar Listos
                                </Button>
                                <Button
                                    size="sm"
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white"
                                    onClick={() => handleBulkDeliver(Array.from(selectedOrders))}
                                >
                                    <Truck className="h-4 w-4 mr-1.5" />
                                    Entregar
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-slate-400 hover:text-white hover:bg-slate-800"
                                    onClick={() => setSelectedOrders(new Set())}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}
