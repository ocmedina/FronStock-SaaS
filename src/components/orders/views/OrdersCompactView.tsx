import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface OrdersCompactViewProps {
    orders: any[];
    onViewDetails: (id: string) => void;
    getServiceTypeBadge: (type: string) => React.ReactElement;
}

export function OrdersCompactView({
    orders,
    onViewDetails,
    getServiceTypeBadge,
}: OrdersCompactViewProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {orders.map((order) => (
                <Card
                    key={order.id}
                    className="bg-card border hover:border-primary/50 transition-all cursor-pointer p-4"
                    onClick={() => onViewDetails(order.id)}
                >
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm truncate">
                                {order.customer?.name || "Sin cliente"}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                                #{order.id.slice(0, 8)}
                            </p>
                        </div>
                        {getServiceTypeBadge(order.service_type)}
                    </div>

                    <div className="space-y-2 mb-3">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Items:</span>
                            <span className="font-medium">
                                {order.order_items?.length || 0}
                            </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Estado:</span>
                            <Badge className="text-[10px]">
                                {order.delivery_status === "delivered"
                                    ? "Completado"
                                    : "En proceso"}
                            </Badge>
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t">
                        <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(order.created_at), {
                                addSuffix: true,
                                locale: es,
                            })}
                        </span>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            ${order.total.toLocaleString()}
                        </span>
                    </div>
                </Card>
            ))}
        </div>
    );
}
