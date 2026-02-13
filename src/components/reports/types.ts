// Tipos para el sistema de reportes

export interface ReportFilters {
    // Rango de fechas
    startDate: Date | null;
    endDate: Date | null;

    // Filtros de categoría
    paymentMethods: PaymentMethodFilter[];
    salesChannels: SalesChannelFilter[];
    customerTypes: CustomerTypeFilter[];

    // Rango de montos
    minAmount: number | null;
    maxAmount: number | null;

    // Período rápido (para compatibilidad)
    quickPeriod: "today" | "week" | "month" | "year" | "custom";
}

export type PaymentMethodFilter = "cash" | "card" | "transfer" | "credit";
export type SalesChannelFilter = "delivery" | "counter" | "both";
export type CustomerTypeFilter = "retail" | "wholesale";

export interface FilterOption {
    value: string;
    label: string;
    icon?: string;
}

export const paymentMethodOptions: FilterOption[] = [
    { value: "cash", label: "Efectivo", icon: "Banknote" },
    { value: "card", label: "Tarjeta", icon: "CreditCard" },
    { value: "transfer", label: "Transferencia", icon: "Building" },
    { value: "credit", label: "Fiado", icon: "User" },
];

export const salesChannelOptions: FilterOption[] = [
    { value: "delivery", label: "Reparto", icon: "Truck" },
    { value: "counter", label: "Mostrador", icon: "Store" },
    { value: "both", label: "Ambos", icon: "ShoppingBag" },
];

export const customerTypeOptions: FilterOption[] = [
    { value: "retail", label: "Minorista", icon: "User" },
    { value: "wholesale", label: "Mayorista", icon: "Users" },
];

export interface SalesData {
    id: string;
    total: number;
    created_at: string;
    payment_method: PaymentMethodFilter;
    customer_id?: string;
    status: string;
}

export interface TopProduct {
    product_name: string;
    total_quantity: number;
    total_revenue: number;
}

export interface DailySales {
    date: string;
    total: number;
    count: number;
}

export interface ReportStats {
    totalRevenue: number;
    totalSales: number;
    averageTicket: number;
    topProducts: TopProduct[];
    dailySales: DailySales[];
    paymentMethods: Record<string, number>;
    previousPeriodRevenue: number;
}
