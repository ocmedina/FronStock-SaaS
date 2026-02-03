export interface SupplierInvoice {
    id: string;
    organization_id: string;
    purchase_order_id: string | null;
    supplier_id: string;
    supplier?: {
        name: string;
    };
    purchase_order?: {
        order_number: string;
    };

    invoice_number: string;
    invoice_date: string;
    due_date: string | null;

    subtotal: number;
    tax_amount: number;
    other_taxes: number;
    total: number;

    payment_status: "pending" | "partial" | "paid";
    paid_amount: number;

    file_url: string | null;
    notes: string | null;

    created_at: string;
    updated_at: string;
}

export interface SupplierPayment {
    id: string;
    organization_id: string;
    supplier_invoice_id: string;
    supplier_id: string;

    payment_date: string;
    amount: number;
    payment_method: string;
    reference: string | null;

    receipt_url: string | null;
    notes: string | null;

    created_at: string;
    created_by: string | null;
}

export interface CreateSupplierInvoiceData {
    purchase_order_id?: string;
    supplier_id: string;
    invoice_number: string;
    invoice_date: string;
    due_date?: string;
    subtotal: number;
    tax_amount: number;
    other_taxes: number;
    total: number;
    notes?: string;
}

export interface CreateSupplierPaymentData {
    supplier_invoice_id: string;
    supplier_id: string;
    payment_date: string;
    amount: number;
    payment_method: string;
    reference?: string;
    notes?: string;
}
