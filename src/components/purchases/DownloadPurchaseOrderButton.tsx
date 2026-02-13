"use client";

import { PDFDownloadLink } from "@react-pdf/renderer";
import { Button } from "@/components/ui/button";
import { FileText, Loader2 } from "lucide-react";
import { PurchaseOrderPDF } from "./PurchaseOrderPDF";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useImageToBase64 } from "@/hooks/useImageToBase64";
import { useMemo } from "react";

interface DownloadPurchaseOrderButtonProps {
    order: any;
    variant?: "default" | "outline" | "ghost";
    size?: "default" | "sm" | "lg" | "icon";
    className?: string;
}

export function DownloadPurchaseOrderButton({ 
    order, 
    variant = "outline", 
    size = "sm",
    className 
}: DownloadPurchaseOrderButtonProps) {
    const { organization } = useOrganization();
    const { base64: logoBase64, loading: logoLoading } = useImageToBase64(organization?.logo_url);

    // Crear una copia de organization con el logo en base64
    const orgWithBase64Logo = useMemo(() => {
        if (!organization) return null;
        return {
            ...organization,
            logo_url: logoBase64 || organization.logo_url
        };
    }, [organization, logoBase64]);

    return (
        <PDFDownloadLink
            document={<PurchaseOrderPDF order={order} organization={orgWithBase64Logo} />}
            fileName={`orden-compra-${order.order_number || order.id.slice(0, 8)}.pdf`}
        >
            {({ loading }) => (
                <Button
                    variant={variant}
                    size={size}
                    className={className}
                    disabled={loading || logoLoading}
                    title="Descargar PDF"
                >
                    {(loading || logoLoading) ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <FileText className="h-4 w-4" />
                    )}
                    {size !== "icon" && !loading && !logoLoading && <span className="ml-2">PDF</span>}
                    {size !== "icon" && (loading || logoLoading) && <span className="ml-2">Generando...</span>}
                </Button>
            )}
        </PDFDownloadLink>
    );
}
