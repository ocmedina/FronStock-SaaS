import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, Eye, Edit } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface OrdersListViewProps {
    orders: any[];
    onViewDetails: (id: string) => void;
    getStatusBadge: (status: string) => React.ReactElement;
    getServiceTypeBadge: (type: string) => React.ReactElement;
}

export function OrdersListView({
    orders,
    onViewDetails,
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
                                            <div className="text-xs text-muted-foreground">
                                                #{order.id.slice(0, 8)}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-3">{getStatusBadge(order.delivery_status)}</td>
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
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => onViewDetails(order.id)}
                                            className="h-8"
                                        >
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                        <Link href={`/dashboard/orders/edit/${order.id}`}>
                                            <Button variant="ghost" size="sm" className="h-8">
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                        </Link>
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
