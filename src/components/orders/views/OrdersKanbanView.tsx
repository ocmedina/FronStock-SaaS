import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DndContext, DragOverlay, useDroppable, closestCenter } from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { STATUS_COLUMNS } from "@/lib/orders/constants";
import { DraggableOrderCard } from "../cards/DraggableOrderCard";

interface OrdersKanbanViewProps {
    orders: any[];
    sensors: any;
    activeId: string | null;
    onDragStart: (event: any) => void;
    onDragEnd: (event: any) => void;
    onViewDetails: (id: string) => void;
    onCreateInvoice: (order: any) => void;
    onDeliverOrder: (order: any) => void;
    getServiceTypeBadge: (type: string) => React.ReactElement;
    getUrgencyBadge: (createdAt: string, status: string) => React.ReactElement | null;
}

function DroppableColumn({
    id,
    children,
    className,
}: {
    id: string;
    children: React.ReactNode;
    className?: string;
}) {
    const { setNodeRef, isOver } = useDroppable({
        id: id,
    });

    return (
        <div 
            ref={setNodeRef} 
            className={`${className} transition-all ${isOver ? 'ring-2 ring-primary bg-primary/5 rounded-lg' : ''}`}
        >
            {children}
        </div>
    );
}

export function OrdersKanbanView({
    orders,
    sensors,
    activeId,
    onDragStart,
    onDragEnd,
    onViewDetails,
    onCreateInvoice,
    onDeliverOrder,
    getServiceTypeBadge,
    getUrgencyBadge,
}: OrdersKanbanViewProps) {
    const getOrdersByStatus = (statuses: string[]) => {
        return orders.filter((o) =>
            statuses.includes(o.delivery_status || "pending")
        );
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
        >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {STATUS_COLUMNS.map((column) => {
                    const columnOrders = getOrdersByStatus(column.statuses);
                    const ColumnIcon = column.icon;

                    return (
                        <DroppableColumn key={column.id} id={column.id} className="flex flex-col">
                            <Card
                                className={`bg-gradient-to-br ${column.gradient} ${column.border} border-2 p-3 mb-3`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <ColumnIcon className={`h-4 w-4 ${column.text}`} />
                                        <span className={`font-semibold text-sm ${column.text}`}>
                                            {column.label}
                                        </span>
                                    </div>
                                    <Badge className={`${column.text} bg-background/30 border-0`}>
                                        {columnOrders.length}
                                    </Badge>
                                </div>
                            </Card>

                            <div className="flex-1 space-y-3 overflow-y-auto max-h-[calc(100vh-450px)] pr-2">
                                {columnOrders.length === 0 ? (
                                    <Card className="bg-card/50 border border-dashed p-6">
                                        <p className="text-muted-foreground text-xs text-center">
                                            Sin pedidos
                                        </p>
                                    </Card>
                                ) : (
                                    columnOrders.map((order) => (
                                        <DraggableOrderCard
                                            key={order.id}
                                            order={order}
                                            column={column}
                                            onViewDetails={onViewDetails}
                                            onCreateInvoice={onCreateInvoice}
                                            onDeliverOrder={onDeliverOrder}
                                            getServiceTypeBadge={getServiceTypeBadge}
                                            getUrgencyBadge={getUrgencyBadge}
                                        />
                                    ))
                                )}
                            </div>
                        </DroppableColumn>
                    );
                })}
            </div>
            <DragOverlay>
                {activeId ? (
                    <Card className="bg-card border shadow-2xl p-3 opacity-90">
                        <div className="flex items-center gap-2">
                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-semibold">Moviendo pedido...</span>
                        </div>
                    </Card>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}
