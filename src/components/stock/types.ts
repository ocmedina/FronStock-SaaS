import { ArrowDownLeft, ArrowUpRight, RefreshCw } from "lucide-react";

export interface Product {
    id: string;
    name: string;
    stock: number;
}

export interface StockMovement {
    id: string;
    product_id: string;
    product_name: string;
    movement_type: string;
    quantity: number;
    previous_stock: number;
    new_stock: number;
    reason: string | null;
    reference_type: string | null;
    notes: string | null;
    created_at: string;
}

export const MOVEMENT_TYPES = {
    entry: {
        label: "Entrada",
        variant: "default" as const,
        icon: ArrowDownLeft,
        color: "text-emerald-600 dark:text-emerald-400",
        bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
    },
    exit: {
        label: "Salida",
        variant: "destructive" as const,
        icon: ArrowUpRight,
        color: "text-red-600 dark:text-red-400",
        bgColor: "bg-red-100 dark:bg-red-900/30",
    },
    adjustment: {
        label: "Ajuste",
        variant: "secondary" as const,
        icon: RefreshCw,
        color: "text-blue-600 dark:text-blue-400",
        bgColor: "bg-blue-100 dark:bg-blue-900/30",
    },
};

export const REASONS: Record<string, string> = {
    sale: "Venta",
    purchase: "Compra",
    adjustment: "Ajuste de inventario",
    damaged: "Producto dañado",
    lost: "Pérdida",
    returned: "Devolución",
    correction: "Corrección",
    initial: "Stock inicial",
    other: "Otro",
};
