
import { PDFDownloadLink } from "@react-pdf/renderer";
import { Button } from "@/components/ui/button";
import { FileText, Loader2 } from "lucide-react";
import { InvoicePDF } from "@/components/invoices/InvoicePDF";
import { useOrganization } from "@/contexts/OrganizationContext";

interface ViewInvoiceButtonProps {
    invoice: any;
    className?: string;
    compact?: boolean;
    order?: any;
}

export function ViewInvoiceButton({ invoice, className, compact, order }: ViewInvoiceButtonProps) {
    const { organization } = useOrganization();

    // If no invoice, render nothing or placeholder (controlled by parent)
    if (!invoice) return null;

    // Enrich invoice with order data if available
    const invoiceWithOrder = order ? { ...invoice, order } : invoice;

    return (
        <div className={className}>
            <PDFDownloadLink
                document={
                    <InvoicePDF
                        invoice={invoiceWithOrder}
                        organization={organization}
                    />
                }
                fileName={`factura-${invoice.invoice_number}.pdf`}
            >
                {({ loading }) => (
                    <Button
                        variant={compact ? "ghost" : "outline"}
                        size="sm"
                        className={compact ? "h-8 w-8 p-0 text-emerald-400 hover:bg-emerald-500/10" : "w-full border-slate-700 text-slate-300 hover:bg-slate-800"}
                        disabled={loading}
                        title="Ver Factura"
                    >
                        {loading ? (
                            <Loader2 className={`h-4 w-4 animate-spin ${!compact && "mr-2"}`} />
                        ) : (
                            <FileText className={`h-4 w-4 text-emerald-400 ${!compact && "mr-2"}`} />
                        )}
                        {!compact && !loading && "Ver Factura"}
                        {!compact && loading && "Cargando..."}
                    </Button>
                )}
            </PDFDownloadLink>
        </div>
    );
}
