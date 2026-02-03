
import { PDFDownloadLink } from "@react-pdf/renderer";
import { Button } from "@/components/ui/button";
import { FileText, Loader2 } from "lucide-react";
import { DeliveryNotePDF } from "@/components/sales/DeliveryNotePDF";
import { useOrganization } from "@/contexts/OrganizationContext";

interface DownloadRemitoButtonProps {
    order: any;
    className?: string; // Allow styling overrides
    compact?: boolean;
}

export function DownloadRemitoButton({ order, className, compact }: DownloadRemitoButtonProps) {
    const { organization } = useOrganization();

    // Map order to Sale/Items structure expected by DeliveryNotePDF
    const saleData = {
        id: order.id,
        created_at: order.created_at,
        customer: order.customer,
        total: order.total
    };

    const itemsData = order.order_items || [];

    return (
        <div className={className}>
            <PDFDownloadLink
                document={
                    <DeliveryNotePDF
                        sale={saleData}
                        items={itemsData}
                        organization={organization}
                    />
                }
                fileName={`remito-${order.id.slice(0, 8)}.pdf`}
            >
                {({ loading, error }) => (
                    <Button
                        variant={compact ? "ghost" : "outline"}
                        size="sm"
                        className={compact ? "h-8 w-8 p-0 text-purple-400 hover:bg-purple-500/10" : "w-full border-slate-700 text-slate-300 hover:bg-slate-800"}
                        disabled={loading}
                        title="Descargar Remito"
                    >
                        {loading ? (
                            <Loader2 className={`h-4 w-4 animate-spin ${!compact && "mr-2"}`} />
                        ) : (
                            <FileText className={`h-4 w-4 text-purple-400 ${!compact && "mr-2"}`} />
                        )}
                        {!compact && !loading && "Remito"}
                        {!compact && loading && "Generando..."}
                    </Button>
                )}
            </PDFDownloadLink>
        </div>
    );
}
