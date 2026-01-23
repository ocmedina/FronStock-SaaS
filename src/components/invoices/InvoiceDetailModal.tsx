import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Printer, Download } from "lucide-react";
import { Invoice } from "./types";

interface InvoiceDetailModalProps {
    invoice: Invoice | null;
    onClose: () => void;
    organizationName?: string;
}

export function InvoiceDetailModal({
    invoice,
    onClose,
    organizationName,
}: InvoiceDetailModalProps) {
    if (!invoice) return null;

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
                            <h2 className="text-2xl font-bold">{organizationName || "Organización"}</h2>
                            <p className="text-gray-500">Dirección de la empresa</p>
                            <p className="text-gray-500">Buenos Aires, Argentina</p>
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
                                <p>{invoice.customer?.tax_id || "-"}</p>
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
                            {/* If we had items we would map them here. For now we show a summary line based on sale total */}
                            <tr>
                                <td className="py-2">Venta #{invoice.sale_id?.split('-')[0]}</td>
                                <td className="text-right py-2">1</td>
                                <td className="text-right py-2">${Number(invoice.total).toLocaleString("es-AR")}</td>
                                <td className="text-right py-2 font-bold">${Number(invoice.total).toLocaleString("es-AR")}</td>
                            </tr>
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
                    <Button>
                        <Printer className="mr-2 h-4 w-4" />
                        Imprimir
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
