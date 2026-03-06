"use client";

import { pdf } from "@react-pdf/renderer";
import { Button } from "@/components/ui/button";
import { FileText, Loader2 } from "lucide-react";
import { PurchaseOrderPDF } from "./PurchaseOrderPDF";
import { useOrganization } from "@/contexts/OrganizationContext";
import { fetchLogoBase64 } from "@/hooks/useImageToBase64";
import { useState, useCallback } from "react";

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
    const [loading, setLoading] = useState(false);

    const handleDownload = useCallback(async () => {
        setLoading(true);
        try {
            const logoBase64 = await fetchLogoBase64(organization?.logo_url);
            const blob = await pdf(
                <PurchaseOrderPDF order={order} organization={organization} logoBase64={logoBase64} />
            ).toBlob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `orden-compra-${order.order_number || order.id.slice(0, 8)}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error generando PDF:', error);
        } finally {
            setLoading(false);
        }
    }, [order, organization]);

    return (
        <Button
            variant={variant}
            size={size}
            className={className}
            disabled={loading}
            title="Descargar PDF"
            onClick={handleDownload}
        >
            {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
                <FileText className="h-4 w-4" />
            )}
            {size !== "icon" && !loading && <span className="ml-2">PDF</span>}
            {size !== "icon" && loading && <span className="ml-2">Generando...</span>}
        </Button>
    );
}
