import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Printer, Download, Loader2 } from "lucide-react";
import { Invoice } from "./types";
import { pdf } from "@react-pdf/renderer";
import { InvoicePDF } from "./InvoicePDF";
import { useState } from "react";
import { fetchLogoBase64 } from "@/hooks/useImageToBase64";

import { Organization } from "@/types/database.types";

interface InvoiceDetailModalProps {
    invoice: Invoice | null;
    onClose: () => void;
    organization?: Organization | null;
}

export function InvoiceDetailModal({
    invoice,
    onClose,
    organization,
}: InvoiceDetailModalProps) {
    const [pdfLoading, setPdfLoading] = useState(false);

    if (!invoice) return null;

    const handleDownloadPDF = async () => {
        if (!invoice) return;
        setPdfLoading(true);
        try {
            const logoBase64 = await fetchLogoBase64(organization?.logo_url);
            const blob = await pdf(
                <InvoicePDF invoice={invoice} organization={organization} logoBase64={logoBase64} />
            ).toBlob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `factura-${invoice.type}-${invoice.invoice_number}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error generando PDF:', error);
        } finally {
            setPdfLoading(false);
        }
    };

    return (
        <Dialog open={!!invoice} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        Detalle de Factura
                    </DialogTitle>
                </DialogHeader>

                <div className="bg-white text-black p-8 rounded-lg shadow-sm border text-sm" id="invoice-preview">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-8 border-b pb-4">
                        <div>
                            {organization?.logo_url && (
                                <img
                                    src={organization.logo_url}
                                    alt="Logo"
                                    className="h-20 w-auto object-contain mb-3"
                                />
                            )}
                            <h2 className="text-2xl font-bold">{organization?.name || "Organización"}</h2>
                            <div className="text-gray-500 space-y-1">
                                <p>{organization?.address || "Dirección de la empresa"}</p>
                                {organization?.city && <p>{organization.city}</p>}
                                <p>{organization?.tax_condition || "Condición IVA: Responsable Inscripto"}</p>
                                <div className="flex flex-wrap gap-4 text-xs mt-2 font-mono">
                                    <span>CUIT: {organization?.cuit || "30-00000000-0"}</span>
                                    <span>IIBB: {organization?.gross_income_number || "-"}</span>
                                    <span>Inicio: {organization?.activity_start_date ? new Date(organization.activity_start_date).toLocaleDateString("es-AR") : "-"}</span>
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="bg-gray-100 border text-center p-2 rounded mb-2 inline-block min-w-[100px]">
                                <span className="block text-2xl font-bold">{invoice.type}</span>
                                <span className="text-xs text-gray-500">COD. 011</span>
                            </div>
                            <p className="font-mono text-lg font-bold">N° {invoice.invoice_number}</p>
                            <p className="text-gray-500">Fecha: {new Date(invoice.created_at).toLocaleDateString("es-AR")}</p>
                        </div>
                    </div>

                    {/* Client Info */}
                    <div className="mb-8 p-4 bg-gray-50 rounded border">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="font-bold">Cliente:</p>
                                <p>{invoice.customer?.name || "Consumidor Final"}</p>
                            </div>
                            <div>
                                <p className="font-bold">CUIT:</p>
                                <p>{invoice.customer?.cuit || "-"}</p>
                            </div>
                            <div>
                                <p className="font-bold">Condición IVA:</p>
                                <p>Consumidor Final</p>
                            </div>
                            <div>
                                <p className="font-bold">Condición de Venta:</p>
                                <p>Contado</p>
                            </div>
                        </div>
                    </div>

                    {/* Items */}
                    <table className="w-full mb-8">
                        <thead className="border-b-2 border-black">
                            <tr>
                                <th className="text-left py-2">Descripción</th>
                                <th className="text-right py-2">Cant.</th>
                                <th className="text-right py-2">P. Unit</th>
                                <th className="text-right py-2">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {invoice.sale?.sale_items && invoice.sale.sale_items.length > 0 ? (
                                invoice.sale.sale_items.map((item, index) => (
                                    <tr key={index}>
                                        <td className="py-2">{item.product?.name || "Producto sin nombre"}</td>
                                        <td className="text-right py-2">{item.quantity}</td>
                                        <td className="text-right py-2">${Number(item.unit_price).toLocaleString("es-AR")}</td>
                                        <td className="text-right py-2 font-bold">${Number(item.total).toLocaleString("es-AR")}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td className="py-2">Venta #{invoice.sale_id?.split('-')[0]}</td>
                                    <td className="text-right py-2">1</td>
                                    <td className="text-right py-2">${Number(invoice.total).toLocaleString("es-AR")}</td>
                                    <td className="text-right py-2 font-bold">${Number(invoice.total).toLocaleString("es-AR")}</td>
                                </tr>
                            )}
                        </tbody>
                    </table>

                    {/* Totals */}
                    <div className="flex justify-end mb-8">
                        <div className="w-1/2 space-y-2">
                            <div className="flex justify-between text-lg font-bold border-t pt-2">
                                <span>Total</span>
                                <span>${Number(invoice.total).toLocaleString("es-AR")}</span>
                            </div>
                        </div>
                    </div>

                    {/* Footer / CAEA */}
                    {invoice.cae ? (
                        <div className="border-t pt-4 flex justify-between items-center">
                            <div>
                                <p className="font-bold">CAE: {invoice.cae}</p>
                                <p className="text-gray-500">Vto. CAE: {new Date(invoice.cae_expiration!).toLocaleDateString("es-AR")}</p>
                            </div>
                            <div className="text-right">
                                {/* QR Placeholder */}
                                <div className="bg-gray-200 w-24 h-24 inline-flex items-center justify-center text-xs text-center p-2">
                                    QR AFIP
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="border-t pt-4 text-center text-gray-400 italic">
                            Documento no válido como factura fiscal (Vista Previa)
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={onClose}>
                        Cerrar
                    </Button>
                    <Button variant="outline" onClick={() => window.print()}>
                        <Printer className="mr-2 h-4 w-4" />
                        Imprimir
                    </Button>
                    <Button onClick={handleDownloadPDF} disabled={pdfLoading}>
                        {pdfLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                        {pdfLoading ? "Generando..." : "Descargar PDF"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
