"use client";

import { PDFDownloadLink } from "@react-pdf/renderer";
import { Button } from "@/components/ui/button";
import { Receipt, Loader2 } from "lucide-react";
import { InvoicePDF } from "@/components/invoices/InvoicePDF";
import { useOrganization } from "@/contexts/OrganizationContext";

interface DownloadOrderInvoiceButtonProps {
    order: any;
    items: any[];
    invoiceType?: "A" | "B" | "C";
    className?: string;
    compact?: boolean;
}

export function DownloadOrderInvoiceButton({
    order,
    items,
    invoiceType = "C",
    className,
    compact,
}: DownloadOrderInvoiceButtonProps) {
    const { organization } = useOrganization();

    // Build an Invoice-compatible object from the order
    const invoiceData = {
        id: order.id,
        organization_id: order.organization_id || "",
        sale_id: null,
        customer_id: order.customer?.id || null,
        invoice_number: order.id.slice(0, 8).toUpperCase(),
        type: invoiceType,
        total: order.total,
        status: "issued" as const,
        cae: null,
        cae_expiration: null,
        afip_status: "pending" as const,
        afip_error: null,
        created_at: order.created_at,
        customer: order.customer
            ? { id: order.customer.id, name: order.customer.name, cuit: order.customer.cuit || null }
            : null,
        order: {
            id: order.id,
            created_at: order.created_at,
            order_items: items.map((item) => ({
                product_name: item.product_name,
                quantity: item.quantity,
                unit_price: item.unit_price ?? 0,
                total: (item.unit_price ?? 0) * item.quantity,
            })),
        },
    };

    const fileName = `factura-${invoiceType}-${order.id.slice(0, 8)}.pdf`;

    return (
        <div className={className}>
            <PDFDownloadLink
                document={<InvoicePDF invoice={invoiceData as any} organization={organization} />}
                fileName={fileName}
            >
                {({ loading }) => (
                    <Button
                        variant={compact ? "ghost" : "outline"}
                        size="sm"
                        className={
                            compact
                                ? "h-8 w-8 p-0 text-blue-400 hover:bg-blue-500/10"
                                : "w-full bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                        }
                        disabled={loading}
                        title={`Descargar Factura ${invoiceType}`}
                    >
                        {loading ? (
                            <Loader2 className={`h-4 w-4 animate-spin ${!compact && "mr-2"}`} />
                        ) : (
                            <Receipt className={`h-4 w-4 text-blue-400 ${!compact && "mr-2"}`} />
                        )}
                        {!compact && !loading && `Factura ${invoiceType}`}
                        {!compact && loading && "Generando..."}
                    </Button>
                )}
            </PDFDownloadLink>
        </div>
    );
}
