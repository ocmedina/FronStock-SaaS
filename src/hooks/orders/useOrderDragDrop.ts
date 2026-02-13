import { useState } from "react";
import { DragEndEvent, DragStartEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { STATUS_COLUMNS } from "@/lib/orders/constants";

export const useOrderDragDrop = (
    orders: any[],
    setOrders: React.Dispatch<React.SetStateAction<any[]>>,
    refetch: () => void
) => {
    const supabase = createClient();
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

        const newStatus = targetColumn.statuses[0];

        const order = orders.find((o) => o.id === orderId);
        if (!order || order.delivery_status === newStatus) return;

        // Actualización optimista
        setOrders((prev) =>
            prev.map((o) => (o.id === orderId ? { ...o, delivery_status: newStatus } : o))
        );

        try {
            const { error } = await supabase
                .from("orders")
                .update({ delivery_status: newStatus })
                .eq("id", orderId);

            if (error) throw error;

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
