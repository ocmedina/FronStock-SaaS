import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { User, Eye, Edit, MapPin, CheckSquare } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { getOrderStatus } from "@/lib/orders/filters";
import { DownloadRemitoButton } from "@/components/orders/DownloadRemitoButton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface OrdersListViewProps {
    orders: any[];
    onViewDetails: (id: string) => void;
    onAssignToRoute: (order: any) => void;
    onChangeStatus: (orderId: string, status: string) => void;
    onBulkChangeStatus?: (orderIds: string[], status: string) => void;
    onBulkAssignToRoute?: (orderIds: string[]) => void;
    getStatusBadge: (status: string) => React.ReactElement;
    getServiceTypeBadge: (type: string) => React.ReactElement;
}

export function OrdersListView({
    orders,
    onViewDetails,
    onAssignToRoute,
    onChangeStatus,
    onBulkChangeStatus,
    onBulkAssignToRoute,
    getStatusBadge,
    getServiceTypeBadge,
}: OrdersListViewProps) {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const toggleSelect = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        if (selectedIds.size === orders.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(orders.map((o) => o.id)));
        }
    };

    const clearSelection = () => setSelectedIds(new Set());

    const handleBulkStatus = (status: string) => {
        if (onBulkChangeStatus && selectedIds.size > 0) {
            onBulkChangeStatus(Array.from(selectedIds), status);
            clearSelection();
        }
    };

    const handleBulkAssign = () => {
        if (onBulkAssignToRoute && selectedIds.size > 0) {
            onBulkAssignToRoute(Array.from(selectedIds));
            clearSelection();
        }
    };
    const statusOptions = [
        { value: "assigned", label: "Asignado" },
        { value: "in_delivery", label: "En reparto" },
        { value: "delivered", label: "Entregado" },
        { value: "not_delivered", label: "No entregado" },
    ];

    const getPaymentBadge = (paymentStatus?: string) => {
        const normalized = String(paymentStatus || "pending").toLowerCase();

        if (normalized === "paid") {
            return (
                <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                    Pagado
                </span>
            );
        }

        if (normalized === "partial") {
            return (
                <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                    Parcial
                </span>
            );
        }

        return (
            <span className="inline-flex items-center rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-600 dark:text-red-400">
                Pendiente
            </span>
        );
    };

    return (
        <Card className="bg-card border">
            {/* Bulk actions toolbar */}
            {selectedIds.size > 0 && (
                <div className="flex items-center gap-3 p-3 bg-emerald-500/10 border-b flex-wrap">
                    <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                        {selectedIds.size} seleccionado{selectedIds.size > 1 ? "s" : ""}
                    </span>
                    <Select onValueChange={handleBulkStatus}>
                        <SelectTrigger className="h-8 w-[180px] text-xs">
                            <SelectValue placeholder="Cambiar estado" />
                        </SelectTrigger>
                        <SelectContent>
                            {statusOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" onClick={handleBulkAssign} className="h-8">
                        <MapPin className="h-3 w-3 mr-1" />
                        Asignar a ruta
                    </Button>
                    <Button variant="ghost" size="sm" onClick={clearSelection} className="h-8 ml-auto">
                        Deseleccionar
                    </Button>
                </div>
            )}
            <div className="md:hidden divide-y">
                {orders.length === 0 && (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                        No hay pedidos para mostrar
                    </div>
                )}
                {orders.map((order) => {
                    const currentStatus = getOrderStatus(order);

                    return (
                    <div key={order.id} className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                                <Checkbox
                                    checked={selectedIds.has(order.id)}
                                    onCheckedChange={() => toggleSelect(order.id)}
                                />
                                <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <User className="h-4 w-4 text-muted-foreground" />
                                    <div className="font-medium text-sm truncate">
                                        {order.customer?.name || "Sin cliente"}
                                    </div>
                                </div>
                                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                                    <span>#{order.id.slice(0, 8)}</span>
                                    {order.is_offline_pending && (
                                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                                            Pendiente offline
                                        </span>
                                    )}
                                </div>
                                </div>
                            </div>
                            <div className="font-mono font-semibold text-emerald-600 dark:text-emerald-400 text-sm shrink-0">
                                ${order.total.toLocaleString()}
                            </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                            {getStatusBadge(getOrderStatus(order))}
                            {getPaymentBadge(order.payment_status)}
                            {getServiceTypeBadge(order.service_type)}
                        </div>

                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{order.order_items?.length || 0} ítems</span>
                            <span>
                                {formatDistanceToNow(new Date(order.created_at), {
                                    addSuffix: true,
                                    locale: es,
                                })}
                            </span>
                        </div>

                        {!order.is_offline_pending && (
                            <Select
                                value={currentStatus}
                                onValueChange={(value) => {
                                    if (value !== currentStatus) {
                                        onChangeStatus(order.id, value);
                                    }
                                }}
                            >
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Cambiar estado" />
                                </SelectTrigger>
                                <SelectContent>
                                    {statusOptions.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}

                        <div className="grid grid-cols-3 gap-2">
                            {!order.is_offline_pending && !["delivered", "cancelled", "not_delivered"].includes(getOrderStatus(order)) && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onAssignToRoute(order)}
                                    className="h-8"
                                    title="Asignar a ruta"
                                >
                                    <MapPin className="h-4 w-4" />
                                </Button>
                            )}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onViewDetails(order.id)}
                                className="h-8"
                            >
                                <Eye className="h-4 w-4" />
                            </Button>
                            <DownloadRemitoButton order={order} compact className="h-8" />
                            {!order.is_offline_pending && (
                                <Link href={`/dashboard/orders/edit/${order.id}`}>
                                    <Button variant="outline" size="sm" className="h-8 w-full">
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                </Link>
                            )}
                        </div>
                    </div>
                )})}
            </div>

            <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-muted/50 border-b">
                        <tr>
                            <th className="p-3 w-10">
                                <Checkbox
                                    checked={selectedIds.size === orders.length && orders.length > 0}
                                    onCheckedChange={toggleAll}
                                />
                            </th>
                            <th className="text-left p-3 text-sm font-medium">Cliente</th>
                            <th className="text-left p-3 text-sm font-medium">Estado</th>
                            <th className="text-left p-3 text-sm font-medium">Pago</th>
                            <th className="text-left p-3 text-sm font-medium">Tipo</th>
                            <th className="text-left p-3 text-sm font-medium">Items</th>
                            <th className="text-left p-3 text-sm font-medium">Total</th>
                            <th className="text-left p-3 text-sm font-medium">Fecha</th>
                            <th className="text-right p-3 text-sm font-medium">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {orders.map((order) => (
                            (() => {
                                const currentStatus = getOrderStatus(order);
                                return (
                            <tr
                                key={order.id}
                                className={`border-b hover:bg-muted/30 transition-colors ${selectedIds.has(order.id) ? "bg-emerald-500/5" : ""}`}
                            >
                                <td className="p-3">
                                    <Checkbox
                                        checked={selectedIds.has(order.id)}
                                        onCheckedChange={() => toggleSelect(order.id)}
                                    />
                                </td>
                                <td className="p-3">
                                    <div className="flex items-center gap-2">
                                        <User className="h-4 w-4 text-muted-foreground" />
                                        <div>
                                            <div className="font-medium text-sm">
                                                {order.customer?.name || "Sin cliente"}
                                            </div>
                                            <div className="text-xs text-muted-foreground flex items-center gap-2">
                                                <span>#{order.id.slice(0, 8)}</span>
                                                {order.is_offline_pending && (
                                                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                                                        Pendiente offline
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-3">{getStatusBadge(getOrderStatus(order))}</td>
                                <td className="p-3">{getPaymentBadge(order.payment_status)}</td>
                                <td className="p-3">{getServiceTypeBadge(order.service_type)}</td>
                                <td className="p-3 text-sm">
                                    {order.order_items?.length || 0}
                                </td>
                                <td className="p-3 font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                                    ${order.total.toLocaleString()}
                                </td>
                                <td className="p-3 text-xs text-muted-foreground">
                                    {formatDistanceToNow(new Date(order.created_at), {
                                        addSuffix: true,
                                        locale: es,
                                    })}
                                </td>
                                <td className="p-3">
                                    <div className="flex justify-end gap-2 items-center">
                                        {!order.is_offline_pending && (
                                            <Select
                                                value={currentStatus}
                                                onValueChange={(value) => {
                                                    if (value !== currentStatus) {
                                                        onChangeStatus(order.id, value);
                                                    }
                                                }}
                                            >
                                                <SelectTrigger className="h-8 w-[150px] text-xs">
                                                    <SelectValue placeholder="Estado" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {statusOptions.map((option) => (
                                                        <SelectItem key={option.value} value={option.value}>
                                                            {option.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                        {!order.is_offline_pending && !["delivered", "cancelled", "not_delivered"].includes(getOrderStatus(order)) && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => onAssignToRoute(order)}
                                                className="h-8"
                                                title="Asignar a ruta"
                                            >
                                                <MapPin className="h-4 w-4" />
                                            </Button>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => onViewDetails(order.id)}
                                            className="h-8"
                                        >
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                        <DownloadRemitoButton order={order} compact className="h-8" />
                                        {!order.is_offline_pending && (
                                            <Link href={`/dashboard/orders/edit/${order.id}`}>
                                                <Button variant="ghost" size="sm" className="h-8">
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                            </Link>
                                        )}
                                    </div>
                                </td>
                            </tr>
                                );
                            })()
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
    );
}
