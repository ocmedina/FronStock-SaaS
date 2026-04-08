// Types for POS/Sales components

export interface Product {
    id: string;
    name: string;
    sku: string | null;
    barcode: string | null;
    plu: string | null;
    price: number;
    wholesale_price: number | null;
    stock: number;
}

export interface Customer {
    id: string;
    name: string;
    customer_type: "retail" | "wholesale";
    service_type?: "counter" | "delivery" | "both"; // Tipo de servicio preferido
    // B2B fields
    business_type?: string | null;
    balance?: number;
    credit_limit?: number;
    phone?: string | null;
    address?: string | null;
}

export interface CartItem {
    product: Product;
    quantity: number;
    unitPrice: number;
    customPrice?: boolean;
    discount: number;
}

export type PaymentMethod = "cash" | "card" | "transfer" | "credit";

export interface Payment {
    method: PaymentMethod;
    amount: number;
}

export interface SaleTab {
    id: string;
    name: string;
    cart: CartItem[];
    customerId: string | null;
    payments: Payment[];
    discount?: number;
    surcharge?: number;
}

export const paymentMethods = [
    { value: "cash" as const, label: "Efectivo", iconName: "Banknote" },
    { value: "card" as const, label: "Tarjeta", iconName: "CreditCard" },
    { value: "transfer" as const, label: "Transferencia", iconName: "Building" },
    { value: "credit" as const, label: "Fiado", iconName: "User" },
];
