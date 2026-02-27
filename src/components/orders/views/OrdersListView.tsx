import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, Eye, Edit, MapPin } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { getOrderStatus } from "@/lib/orders/filters";

interface OrdersListViewProps {
    orders: any[];
    onViewDetails: (id: string) => void;
    onAssignToRoute: (order: any) => void;
    getStatusBadge: (status: string) => React.ReactElement;
    getServiceTypeBadge: (type: string) => React.ReactElement;
}

export function OrdersListView({
    orders,
    onViewDetails,
    onAssignToRoute,
    getStatusBadge,
    getServiceTypeBadge,
}: OrdersListViewProps) {
    return (
        <Card className="bg-card border">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-muted/50 border-b">
                        <tr>
                            <th className="text-left p-3 text-sm font-medium">Cliente</th>
                            <th className="text-left p-3 text-sm font-medium">Estado</th>
                            <th className="text-left p-3 text-sm font-medium">Tipo</th>
                            <th className="text-left p-3 text-sm font-medium">Items</th>
                            <th className="text-left p-3 text-sm font-medium">Total</th>
                            <th className="text-left p-3 text-sm font-medium">Fecha</th>
                            <th className="text-right p-3 text-sm font-medium">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {orders.map((order) => (
                            <tr
                                key={order.id}
                                className="border-b hover:bg-muted/30 transition-colors"
                            >
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
                                    <div className="flex justify-end gap-2">
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
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
    );
}
