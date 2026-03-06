
import { pdf } from "@react-pdf/renderer";
import { Button } from "@/components/ui/button";
import { FileText, Loader2 } from "lucide-react";
import { InvoicePDF } from "@/components/invoices/InvoicePDF";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useState, useCallback } from "react";
import { fetchLogoBase64 } from "@/hooks/useImageToBase64";

interface ViewInvoiceButtonProps {
    invoice: any;
    className?: string;
    compact?: boolean;
    order?: any;
}

export function ViewInvoiceButton({ invoice, className, compact, order }: ViewInvoiceButtonProps) {
    const { organization } = useOrganization();
    const [loading, setLoading] = useState(false);

    // If no invoice, render nothing or placeholder (controlled by parent)
    if (!invoice) return null;

    // Enrich invoice with order data if available
    const invoiceWithOrder = order ? { ...invoice, order } : invoice;

    const handleDownload = async () => {
        setLoading(true);
        try {
            const logoBase64 = await fetchLogoBase64(organization?.logo_url);
            const blob = await pdf(
                <InvoicePDF invoice={invoiceWithOrder} organization={organization} logoBase64={logoBase64} />
            ).toBlob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `factura-${invoice.invoice_number}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error generando PDF:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={className}>
            <Button
                variant={compact ? "ghost" : "outline"}
                size="sm"
                className={compact ? "h-8 w-8 p-0 text-emerald-400 hover:bg-emerald-500/10" : "w-full border-slate-700 text-slate-300 hover:bg-slate-800"}
                disabled={loading}
                title="Ver Factura"
                onClick={handleDownload}
            >
                {loading ? (
                    <Loader2 className={`h-4 w-4 animate-spin ${!compact && "mr-2"}`} />
                ) : (
                    <FileText className={`h-4 w-4 text-emerald-400 ${!compact && "mr-2"}`} />
                )}
                {!compact && !loading && "Ver Factura"}
                {!compact && loading && "Cargando..."}
            </Button>
        </div>
    );
}
