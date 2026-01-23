export type InvoiceType = "A" | "B" | "C";
export type InvoiceStatus = "issued" | "annulled" | "error";
export type AfipStatus = "pending" | "authorised" | "rejected";

export interface CreateInvoiceData {
    sale_id: string;
    type: InvoiceType;
    customer_id?: string;
    with_arca: boolean;
    cuit?: string;
}

export interface Invoice {
    id: string;
    organization_id: string;
    sale_id: string | null;
    customer_id: string | null;
    sale?: {
        total: number;
        created_at: string;
        items?: any[];
    } | null;
    customer?: {
        name: string;
        tax_id: string | null; // CUIT
    } | null;

    invoice_number: string;
    type: InvoiceType;
    total: number;
    status: InvoiceStatus;

    // ARCA fields
    cae: string | null;
    cae_expiration: string | null;
    afip_status: AfipStatus;
    afip_error: string | null;

    created_at: string;
}

export const INVOICE_TYPES: { value: InvoiceType; label: string }[] = [
    { value: "A", label: "Factura A" },
    { value: "B", label: "Factura B" },
    { value: "C", label: "Factura C" },
];
