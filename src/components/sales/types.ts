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
}

export interface CartItem {
    product: Product;
    quantity: number;
    discount: number;
}

export type PaymentMethod = "cash" | "card" | "transfer" | "credit";

export interface SaleTab {
    id: string;
    name: string;
    cart: CartItem[];
    customerId: string | null;
    paymentMethod: PaymentMethod;
}

export const paymentMethods = [
    { value: "cash" as const, label: "Efectivo", iconName: "Banknote" },
    { value: "card" as const, label: "Tarjeta", iconName: "CreditCard" },
    { value: "transfer" as const, label: "Transferencia", iconName: "Building" },
    { value: "credit" as const, label: "Fiado", iconName: "User" },
];
