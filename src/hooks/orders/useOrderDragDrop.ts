import { useState } from "react";
import { DragEndEvent, DragStartEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { STATUS_COLUMNS } from "@/lib/orders/constants";
import { getOrderStatus } from "@/lib/orders/filters";
import { useOrganization } from "@/contexts/OrganizationContext";

export const useOrderDragDrop = (
    orders: any[],
    setOrders: React.Dispatch<React.SetStateAction<any[]>>,
    refetch: () => void
) => {
    const supabase = createClient();
    const { organizationId } = useOrganization();
    const [activeId, setActiveId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        })
    );

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over) return;

        const orderId = active.id as string;
        const newColumnId = over.id as string;

        const targetColumn = STATUS_COLUMNS.find((col) => col.id === newColumnId);
        if (!targetColumn) return;

        const lifecycleByColumn: Record<string, string> = {
            pending: "draft",
            confirmed: "confirmed",
            preparing: "confirmed",
            ready: "assigned",
            shipping: "in_delivery",
            delivered: "delivered",
        };

        const newStatus = lifecycleByColumn[targetColumn.id] || "confirmed";

        const order = orders.find((o) => o.id === orderId);
        if (!order || getOrderStatus(order) === newStatus) return;

        // Actualización optimista
        setOrders((prev) =>
            prev.map((o) =>
                o.id === orderId
                    ? { ...o, lifecycle_status: newStatus, ui_status: newStatus }
                    : o
            )
        );

        try {
            const { data, error } = await supabase.rpc("set_order_status", {
                p_org_id: organizationId,
                p_order_id: orderId,
                p_new_status: newStatus,
                p_notes: "Actualizado desde tablero de pedidos",
            });

            if (error) throw error;
            if (data?.success === false) throw new Error(data?.error || "No se pudo actualizar");

            toast.success(`Pedido movido a ${targetColumn.label}`);
        } catch (error: any) {
            console.error("Error updating order status:", error);
            toast.error("Error al actualizar el estado");
            refetch();
        }
    };

    return {
        activeId,
        sensors,
        handleDragStart,
        handleDragEnd,
    };
};
