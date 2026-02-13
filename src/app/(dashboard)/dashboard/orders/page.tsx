"use client";

import { useState, useEffect } from "react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Button } from "@/components/ui/button";
import { Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { ViewMode } from "@/lib/orders/constants";
import { filterOrders } from "@/lib/orders/filters";
import { getServiceTypeBadge, getStatusBadge, getUrgencyBadge } from "@/lib/orders/helpers";
import { useOrdersData } from "@/hooks/orders/useOrdersData";
import { useOrderDragDrop } from "@/hooks/orders/useOrderDragDrop";
import { OrderStats } from "@/components/orders/OrderStats";
import { OrderFilters } from "@/components/orders/OrderFilters";
import { OrderViewSelector } from "@/components/orders/OrderViewSelector";
import { OrdersKanbanView } from "@/components/orders/views/OrdersKanbanView";
import { OrdersListView } from "@/components/orders/views/OrdersListView";
import { OrdersGroupedView } from "@/components/orders/views/OrdersGroupedView";
import { OrdersCompactView } from "@/components/orders/views/OrdersCompactView";
import { OrderDetailsModal } from "@/components/delivery/OrderDetailsModal";
import { DeliveryConfirmationModal } from "@/components/delivery/DeliveryConfirmationModal";
import { CreateInvoiceModal } from "@/components/invoices/CreateInvoiceModal";
import { AssignToRouteModal } from "@/components/orders/AssignToRouteModal";

export default function OrdersPage() {
    const { organizationId } = useOrganization();

    // Filters
    const [searchTerm, setSearchTerm] = useState("");
    const [serviceTypeFilter, setServiceTypeFilter] = useState<string>("all");
    const [dateFilter, setDateFilter] = useState<string>("today");
    const [viewMode, setViewMode] = useState<ViewMode>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('orders-view-mode');
            return (saved as ViewMode) || "list";
        }
        return "list";
    });

    // Data
    const { orders, loading, stats, refetch, setOrders } = useOrdersData(
        organizationId,
        dateFilter
    );

    // Drag & Drop
    const { activeId, sensors, handleDragStart, handleDragEnd } = useOrderDragDrop(
        orders,
        setOrders,
        refetch
    );

    // Modals
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [deliveryConfirmOpen, setDeliveryConfirmOpen] = useState(false);
    const [orderToDeliver, setOrderToDeliver] = useState<any>(null);
    const [createInvoiceOpen, setCreateInvoiceOpen] = useState(false);
    const [orderForInvoice, setOrderForInvoice] = useState<any>(null);
    const [assignToRouteOpen, setAssignToRouteOpen] = useState(false);
    const [selectedOrders, setSelectedOrders] = useState<string[]>([]);

    // Guardar vista seleccionada en localStorage
    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('orders-view-mode', viewMode);
        }
    }, [viewMode]);

    const handleViewDetails = (orderId: string) => {
        setSelectedOrderId(orderId);
        setDetailsOpen(true);
    };

    const handleDeliverOrder = (order: any) => {
        setOrderToDeliver(order);
        setDeliveryConfirmOpen(true);
    };

    const handleCreateInvoice = (order: any) => {
        setOrderForInvoice(order);
        setCreateInvoiceOpen(true);
    };

    const filteredOrders = filterOrders(orders, searchTerm, serviceTypeFilter);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground mb-1">
                        Gestión de Pedidos
                    </h1>
                    <p className="text-muted-foreground">
                        Administra tus pedidos con diferentes vistas
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <OrderViewSelector viewMode={viewMode} setViewMode={setViewMode} />
                    <Link href="/dashboard/orders/new">
                        <Button className="bg-emerald-600 hover:bg-emerald-500 text-white">
                            <Plus className="h-4 w-4 mr-2" />
                            Nuevo Pedido
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Stats */}
            <OrderStats stats={stats} />

            {/* Filters */}
            <OrderFilters
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                serviceTypeFilter={serviceTypeFilter}
                setServiceTypeFilter={setServiceTypeFilter}
                dateFilter={dateFilter}
                setDateFilter={setDateFilter}
            />

            {/* Views */}
            {viewMode === "list" && (
                <OrdersListView
                    orders={filteredOrders}
                    onViewDetails={handleViewDetails}
                    getStatusBadge={getStatusBadge}
                    getServiceTypeBadge={getServiceTypeBadge}
                />
            )}

            {viewMode === "kanban" && (
                <OrdersKanbanView
                    orders={filteredOrders}
                    sensors={sensors}
                    activeId={activeId}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onViewDetails={handleViewDetails}
                    onCreateInvoice={handleCreateInvoice}
                    onDeliverOrder={handleDeliverOrder}
                    getServiceTypeBadge={getServiceTypeBadge}
                    getUrgencyBadge={getUrgencyBadge}
                />
            )}

            {viewMode === "grouped" && (
                <OrdersGroupedView
                    orders={filteredOrders}
                    onViewDetails={handleViewDetails}
                />
            )}

            {viewMode === "compact" && (
                <OrdersCompactView
                    orders={filteredOrders}
                    onViewDetails={handleViewDetails}
                    getServiceTypeBadge={getServiceTypeBadge}
                />
            )}

            {/* Modals */}
            <OrderDetailsModal
                orderId={selectedOrderId}
                open={detailsOpen}
                onOpenChange={setDetailsOpen}
                onSuccess={refetch}
            />

            <DeliveryConfirmationModal
                orders={orderToDeliver ? [orderToDeliver] : []}
                open={deliveryConfirmOpen}
                onOpenChange={setDeliveryConfirmOpen}
                onSuccess={refetch}
            />

            {createInvoiceOpen && (
                <CreateInvoiceModal
                    open={createInvoiceOpen}
                    onOpenChange={setCreateInvoiceOpen}
                    organizationId={organizationId || ""}
                    onSuccess={() => {
                        refetch();
                        setCreateInvoiceOpen(false);
                    }}
                    preselectedOrder={orderForInvoice}
                />
            )}

            <AssignToRouteModal
                open={assignToRouteOpen}
                onOpenChange={setAssignToRouteOpen}
                orderIds={selectedOrders}
                onSuccess={() => {
                    refetch();
                    setSelectedOrders([]);
                }}
            />
        </div>
    );
}
