import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    User,
    MoreVertical,
    Eye,
    Edit,
    FileText,
    CheckCircle,
    MapPin,
    Phone,
    Package,
    Clock,
    GripVertical,
} from "lucide-react";
import Link from "next/link";
import { useDraggable } from "@dnd-kit/core";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { getOrderStatus } from "@/lib/orders/filters";

interface DraggableOrderCardProps {
    order: any;
    column: any;
    onViewDetails: (id: string) => void;
    onCreateInvoice: (order: any) => void;
    onDeliverOrder: (order: any) => void;
    onAssignToRoute: (order: any) => void;
    getServiceTypeBadge: (type: string) => React.ReactElement;
    getUrgencyBadge: (createdAt: string, status: string) => React.ReactElement | null;
}

export function DraggableOrderCard({
    order,
    column,
    onViewDetails,
    onCreateInvoice,
    onDeliverOrder,
    onAssignToRoute,
    getServiceTypeBadge,
    getUrgencyBadge,
}: DraggableOrderCardProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        isDragging,
    } = useDraggable({
        id: order.id,
        data: {
            type: "order",
            order,
        },
    });

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 1000 : undefined,
    } : {
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <Card
            ref={setNodeRef}
            style={style}
            className={`bg-card border hover:border-primary/50 transition-all p-3 cursor-pointer group ${isDragging ? 'cursor-grabbing shadow-2xl' : ''}`}
            onClick={() => onViewDetails(order.id)}
        >
            <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <div
                        {...attributes}
                        {...listeners}
                        className="cursor-grab active:cursor-grabbing touch-none p-1 -m-1 hover:bg-muted/50 rounded transition-colors"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <GripVertical className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                            <User className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            <span className="text-foreground text-sm font-semibold truncate">
                                {order.customer?.name || "Sin cliente"}
                            </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                            #{order.id.slice(0, 8)}
                        </div>
                    </div>
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger
                        asChild
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                        >
                            <MoreVertical className="h-3 w-3" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem
                            onClick={(e) => {
                                e.stopPropagation();
                                onViewDetails(order.id);
                            }}
                            className="cursor-pointer"
                        >
                            <Eye className="h-3 w-3 mr-2" />
                            Ver detalles
                        </DropdownMenuItem>
                        {!order.is_offline_pending && (
                            <Link href={`/dashboard/orders/edit/${order.id}`}>
                                <DropdownMenuItem className="cursor-pointer">
                                    <Edit className="h-3 w-3 mr-2" />
                                    Editar
                                </DropdownMenuItem>
                            </Link>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={(e) => {
                                e.stopPropagation();
                                onCreateInvoice(order);
                            }}
                            className="text-blue-600 dark:text-blue-400 cursor-pointer"
                        >
                            <FileText className="h-3 w-3 mr-2" />
                            Crear factura
                        </DropdownMenuItem>
                        {!order.is_offline_pending && !["delivered", "cancelled", "not_delivered"].includes(getOrderStatus(order)) && (
                            <DropdownMenuItem
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onAssignToRoute(order);
                                }}
                                className="text-indigo-600 dark:text-indigo-400 cursor-pointer"
                            >
                                <MapPin className="h-3 w-3 mr-2" />
                                Asignar a ruta
                            </DropdownMenuItem>
                        )}
                        {column.id !== "delivered" && (
                            <DropdownMenuItem
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDeliverOrder(order);
                                }}
                                className="text-emerald-600 dark:text-emerald-400 cursor-pointer"
                            >
                                <CheckCircle className="h-3 w-3 mr-2" />
                                Marcar entregado
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                {getServiceTypeBadge(order.service_type)}
                {order.is_offline_pending && (
                    <Badge variant="secondary" className="text-[10px]">
                        Pendiente offline
                    </Badge>
                )}
                {getUrgencyBadge(order.created_at, getOrderStatus(order))}
            </div>

            {order.customer?.address && (
                <div className="flex items-start gap-1.5 text-[10px] text-muted-foreground mb-2">
                    <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
                    <span className="line-clamp-1">{order.customer.address}</span>
                </div>
            )}

            {order.customer?.phone && (
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-2">
                    <Phone className="h-3 w-3" />
                    <span>{order.customer.phone}</span>
                </div>
            )}

            <div className="text-[10px] text-muted-foreground mb-2">
                <Package className="h-3 w-3 inline mr-1" />
                {order.order_items?.length || 0} productos
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
                <div className="text-xs text-muted-foreground">
                    <Clock className="h-3 w-3 inline mr-1" />
                    {formatDistanceToNow(new Date(order.created_at), {
                        addSuffix: true,
                        locale: es,
                    })}
                </div>
                <div className="text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    ${order.total.toLocaleString()}
                </div>
            </div>
        </Card>
    );
}
