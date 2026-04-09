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
import { useState, useEffect } from "react";
import { Organization } from "@/types/database.types";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface InvoiceDetailModalProps {
    invoice: Invoice | null;
    onClose: () => void;
    organization?: Organization | null;
}

/**
 * Converts any image source (data URL or HTTP URL) to a PNG data URL via canvas.
 * Ensures compatibility with react-pdf which only supports PNG/JPEG.
 */
async function convertImageToPNG(logoUrl: string | null | undefined): Promise<string | null> {
    if (!logoUrl) return null;

    let dataUrl: string;

    try {
        if (logoUrl.startsWith('data:')) {
            dataUrl = logoUrl;
        } else {
            const res = await fetch(`/api/logo-base64?url=${encodeURIComponent(logoUrl)}`);
            if (!res.ok) {
                console.error('[Logo PDF] Proxy fetch failed:', res.status);
                return null;
            }
            const json = await res.json();
            dataUrl = json.base64;
        }
    } catch (e) {
        console.error('[Logo PDF] Error fetching logo:', e);
        return null;
    }

    return new Promise((resolve) => {
        const img = new window.Image();
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                const MAX_PX = 300;
                const scale = Math.min(1, MAX_PX / Math.max(img.naturalWidth, img.naturalHeight, 1));
                canvas.width = Math.round(img.naturalWidth * scale);
                canvas.height = Math.round(img.naturalHeight * scale);
                const ctx = canvas.getContext('2d');
                if (!ctx) { resolve(null); return; }
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/png'));
            } catch (e) {
                console.error('[Logo PDF] Canvas conversion failed:', e);
                resolve(null);
            }
        };
        img.onerror = (e) => {
            console.error('[Logo PDF] Image load failed:', e);
            resolve(null);
        };
        img.src = dataUrl;
    });
}

export function InvoiceDetailModal({
    invoice,
    onClose,
    organization,
}: InvoiceDetailModalProps) {
    const [pdfLoading, setPdfLoading] = useState(false);
    const [showIva, setShowIva] = useState(invoice?.type === 'A');

    useEffect(() => {
        if (invoice) {
            setShowIva(invoice.type === 'A');
        }
    }, [invoice]);

    if (!invoice) return null;

    const handleDownloadPDF = async () => {
        setPdfLoading(true);
        try {
            const logoPng = await convertImageToPNG(organization?.logo_url);
            const blob = await pdf(
                <InvoicePDF
                    invoice={invoice}
                    organization={organization}
                    logoBase64={logoPng}
                    showIva={showIva}
                />
            ).toBlob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `factura-${invoice.type}-${invoice.invoice_number}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('[InvoiceDetailModal] Error generating PDF:', error);
        } finally {
            setPdfLoading(false);
        }
    };

    return (
        <Dialog open={!!invoice} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl w-full mx-2 sm:mx-auto max-h-[90vh] overflow-y-auto p-0">

                {/* ── Modal Title ── */}
                <DialogHeader className="px-6 pt-5 pb-0">
                    <DialogTitle className="flex items-center gap-2 text-base">
                        <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                        Detalle de Factura
                    </DialogTitle>
                </DialogHeader>

                {/* ── Invoice Document ── */}
                <div className="bg-white text-gray-900 mx-4 mb-4 mt-3 rounded-xl shadow-sm border border-gray-200 text-sm overflow-hidden" id="invoice-preview">

                    {/* Header: 3 columns — company | type box | invoice info */}
                    <div className="grid grid-cols-[1fr_auto_1fr] gap-3 p-5 border-b border-gray-200 items-start">

                        {/* LEFT: Logo + Company Info */}
                        <div className="min-w-0">
                            {organization?.logo_url && (
                                <img
                                    src={organization.logo_url}
                                    alt="Logo"
                                    className="h-14 w-auto object-contain mb-2 max-w-[160px]"
                                />
                            )}
                            <h2 className="text-sm font-bold leading-tight text-gray-900">
                                {organization?.name || "Organización"}
                            </h2>
                            <div className="text-xs text-gray-500 space-y-0.5 mt-1">
                                {organization?.address && <p>{organization.address}</p>}
                                {organization?.city && <p>{organization.city}</p>}
                                {organization?.tax_condition && <p>{organization.tax_condition}</p>}
                            </div>
                        </div>

                        {/* CENTER: Invoice Type Box */}
                        <div className="flex items-start justify-center pt-1">
                            <div className="border-2 border-gray-800 w-16 h-16 flex flex-col items-center justify-center rounded bg-gray-50 flex-shrink-0">
                                <span className="text-2xl font-black leading-none text-gray-900">{invoice.type}</span>
                                <span className="text-[9px] text-gray-500 mt-0.5 font-medium">COD. 011</span>
                            </div>
                        </div>

                        {/* RIGHT: Invoice Details */}
                        <div className="text-right min-w-0">
                            <p className="text-base font-black text-gray-900 uppercase tracking-wide">FACTURA</p>
                            <p className="font-mono text-sm font-bold text-gray-800 mt-0.5 break-all">
                                N° {invoice.invoice_number}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                                Fecha: {new Date(invoice.created_at).toLocaleDateString("es-AR")}
                            </p>
                            {organization?.cuit && (
                                <p className="text-xs text-gray-500">CUIT: {organization.cuit}</p>
                            )}
                            {organization?.gross_income_number && (
                                <p className="text-xs text-gray-500">IIBB: {organization.gross_income_number}</p>
                            )}
                            {organization?.activity_start_date && (
                                <p className="text-xs text-gray-500">
                                    Inicio: {new Date(organization.activity_start_date).toLocaleDateString("es-AR")}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* ── Client Info ── */}
                    <div className="mx-5 my-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                            <div>
                                <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold mb-0.5">Cliente</p>
                                <p className="font-semibold text-gray-900 text-sm">{invoice.customer?.name || "Consumidor Final"}</p>
                            </div>
                            <div>
                                <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold mb-0.5">CUIT / DNI</p>
                                <p className="text-gray-700 text-sm">{invoice.customer?.cuit || "-"}</p>
                            </div>
                            <div>
                                <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold mb-0.5">Condición IVA</p>
                                <p className="text-gray-700 text-sm">Consumidor Final</p>
                            </div>
                            <div>
                                <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold mb-0.5">Condición de Venta</p>
                                <p className="text-gray-700 text-sm">Contado</p>
                            </div>
                        </div>
                    </div>

                    {/* ── Items Table ── */}
                    <div className="px-5">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b-2 border-gray-800">
                                    <th className="text-left py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">Descripción</th>
                                    <th className="text-right py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide w-14">Cant.</th>
                                    <th className="text-right py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide w-24">P. Unit</th>
                                    <th className="text-right py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide w-24">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {invoice.sale?.sale_items && invoice.sale.sale_items.length > 0 ? (
                                    invoice.sale.sale_items.map((item, index) => (
                                        <tr key={index}>
                                            <td className="py-2.5 text-gray-800">{item.product?.name || "Producto sin nombre"}</td>
                                            <td className="text-right py-2.5 text-gray-700">{item.quantity}</td>
                                            <td className="text-right py-2.5 text-gray-700">${Number(item.unit_price).toLocaleString("es-AR")}</td>
                                            <td className="text-right py-2.5 font-semibold text-gray-900">${Number(item.total).toLocaleString("es-AR")}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td className="py-2.5 text-gray-800">Venta #{invoice.sale_id?.split('-')[0]}</td>
                                        <td className="text-right py-2.5 text-gray-700">1</td>
                                        <td className="text-right py-2.5 text-gray-700">${Number(invoice.total).toLocaleString("es-AR")}</td>
                                        <td className="text-right py-2.5 font-semibold text-gray-900">${Number(invoice.total).toLocaleString("es-AR")}</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* ── Totals ── */}
                    <div className="px-5 mt-4 mb-5 flex justify-end">
                        <div className="w-full max-w-[260px]">
                            {showIva && (
                                <>
                                    <div className="flex justify-between text-xs text-gray-500 py-1.5 border-t border-gray-100">
                                        <span>Subtotal</span>
                                        <span>${(Number(invoice.total) / 1.21).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-gray-500 py-1.5">
                                        <span>IVA (21%)</span>
                                        <span>${(Number(invoice.total) - Number(invoice.total) / 1.21).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                </>
                            )}
                            <div className="flex justify-between items-center font-bold text-base py-2 border-t-2 border-gray-800">
                                <span>TOTAL</span>
                                <span>${Number(invoice.total).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                    </div>

                    {/* ── Footer / CAE ── */}
                    <div className="border-t border-gray-200 px-5 py-3">
                        {invoice.cae ? (
                            <div className="flex flex-wrap justify-between items-center gap-3">
                                <div className="text-xs text-gray-600 space-y-0.5">
                                    <p><span className="font-semibold">CAE:</span> {invoice.cae}</p>
                                    <p><span className="font-semibold">Vto. CAE:</span> {new Date(invoice.cae_expiration!).toLocaleDateString("es-AR")}</p>
                                </div>
                                <div className="bg-gray-200 w-16 h-16 flex items-center justify-center text-[9px] text-center text-gray-500 rounded">
                                    QR AFIP
                                </div>
                            </div>
                        ) : (
                            <p className="text-center text-[11px] text-gray-400 italic py-0.5">
                                Documento no válido como factura fiscal (Vista Previa)
                            </p>
                        )}
                    </div>
                </div>

                {/* ── Bottom Actions ── */}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-3 px-4 pb-4">
                    <div className="flex items-center gap-2 order-2 sm:order-1">
                        <Switch id="show-iva" checked={showIva} onCheckedChange={setShowIva} />
                        <Label htmlFor="show-iva" className="text-sm cursor-pointer select-none">
                            Discriminar IVA (21%)
                        </Label>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto order-1 sm:order-2">
                        <Button variant="outline" onClick={onClose} className="flex-1 sm:flex-none">
                            Cerrar
                        </Button>
                        <Button variant="outline" onClick={() => window.print()} className="flex-1 sm:flex-none">
                            <Printer className="mr-1.5 h-4 w-4" />
                            Imprimir
                        </Button>
                        <Button onClick={handleDownloadPDF} disabled={pdfLoading} className="flex-1 sm:flex-none">
                            {pdfLoading
                                ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                                : <Download className="mr-1.5 h-4 w-4" />
                            }
                            {pdfLoading ? "Generando..." : "Descargar PDF"}
                        </Button>
                    </div>
                </div>

            </DialogContent>
        </Dialog>
    );
}
