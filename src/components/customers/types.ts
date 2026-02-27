export interface Customer {
    id: string;
    organization_id: string;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    reference: string | null;
    cuit: string | null;
    balance: number;
    customer_type: "retail" | "wholesale";
    service_type: "counter" | "delivery" | "both";
    credit_limit?: number;
    payment_terms?: string;
    created_at: string;
}

export interface AccountMovement {
    id: string;
    customer_id: string;
    type: "charge" | "payment";
    amount: number;
    description: string | null;
    sale_id: string | null;
    created_at: string;
}

export interface SaleItem {
    id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    total: number;
}

export interface CustomerSale {
    id: string;
    total: number;
    payment_method: string;
    payment_status: string;
    credit_due_date?: string | null;
    created_at: string;
    sale_items: SaleItem[];
}
