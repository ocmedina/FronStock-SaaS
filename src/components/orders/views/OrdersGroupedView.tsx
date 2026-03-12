import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Check } from "lucide-react";
import { getOrderStatus } from "@/lib/orders/filters";

interface OrdersGroupedViewProps {
    orders: any[];
    onViewDetails: (id: string) => void;
}

export function OrdersGroupedView({ orders, onViewDetails }: OrdersGroupedViewProps) {
    const groupedOrders = Object.values(
        orders.reduce((acc, order) => {
            const customerId = order.customer?.id || "sin-cliente";
            if (!acc[customerId]) {
                acc[customerId] = {
                    customer: order.customer,
                    orders: [],
                    total: 0,
                };
            }
            acc[customerId].orders.push(order);
            acc[customerId].total += order.total;
            return acc;
        }, {} as Record<string, any>)
    );

    return (
        <div className="space-y-4">
            {groupedOrders.map((group: any) => (
                <Card key={group.customer?.id || "sin-cliente"} className="bg-card border p-4">
                    <div className="flex items-center justify-between mb-4 pb-3 border-b">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <User className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-foreground">
                                    {group.customer?.name || "Sin cliente"}
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    {group.orders.length} pedidos
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                                ${group.total.toLocaleString()}
                            </div>
                            <div className="text-xs text-muted-foreground">Total</div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {group.orders.map((order: any) => (
                            <div
                                key={order.id}
                                className="border rounded-lg p-3 hover:border-primary/50 transition-colors cursor-pointer"
                                onClick={() => onViewDetails(order.id)}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <Badge className="text-xs">
                                            {getOrderStatus(order) === "delivered"
                                                ? <><Check className="h-3 w-3 inline mr-0.5" />Completado</>
                                                : "En proceso"}
                                        </Badge>
                                        {order.is_offline_pending && (
                                            <Badge variant="secondary" className="text-[10px]">
                                                Pendiente offline
                                            </Badge>
                                        )}
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                        #{order.id.slice(0, 6)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground">
                                        {order.order_items?.length || 0} items
                                    </span>
                                    <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                                        ${order.total.toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            ))}
        </div>
    );
}
