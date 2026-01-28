
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, X } from "lucide-react";
import { SaleTab } from "./types";
import { useRef } from "react";

interface TicketViewProps {
    open: boolean;
    onClose: () => void;
    saleData: {
        date: Date;
        id: string; // Sale ID
        saleNumber?: number; // Sequential Number
        items: any[];
        total: number;
        subtotal: number;
        discount: number;
        surcharge: number;
        payments: any[];
        customer?: { name: string; type: string };
        organization?: { name: string; address?: string; phone?: string; };
    } | null;
}

export function TicketView({ open, onClose, saleData }: TicketViewProps) {
    const componentRef = useRef<HTMLDivElement>(null);

    const handlePrint = () => {
        if (!componentRef.current) return;

        const content = componentRef.current.innerHTML;
        const printWindow = window.open('', '', 'height=600,width=400');

        if (printWindow) {
            printWindow.document.write('<html><head><title>Ticket de Venta</title>');
            printWindow.document.write('<style>');
            printWindow.document.write(`
                body { font-family: 'Courier New', monospace; font-size: 12px; margin: 0; padding: 10px; width: 80mm; }
                .text-center { text-align: center; }
                .text-right { text-align: right; }
                .font-bold { font-weight: bold; }
                .border-b { border-bottom: 1px dashed black; margin: 5px 0; }
                .flex { display: flex; justify-content: space-between; }
                .text-xs { font-size: 10px; }
                .my-2 { margin: 10px 0; }
                table { width: 100%; border-collapse: collapse; margin-top: 5px; }
                th { text-align: left; border-bottom: 1px solid black; }
                td { padding: 2px 0; }
                @media print {
                    @page { margin: 0; size: 80mm auto; }
                    body { margin: 0; padding: 5px; }
                }
            `);
            printWindow.document.write('</style></head><body>');
            printWindow.document.write(content);
            printWindow.document.write('</body></html>');
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 250);
        }
    };

    if (!saleData) return null;

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-[400px]">
                <DialogHeader>
                    <DialogTitle>Imprimir Ticket</DialogTitle>
                </DialogHeader>

                <div className="bg-white text-black p-4 border rounded-md max-h-[60vh] overflow-y-auto">
                    <div ref={componentRef} className="text-xs space-y-2">
                        {/* ENCABEZADO */}
                        <div className="text-center mb-2">
                            <div className="font-bold uppercase text-sm mb-1">{saleData.organization?.name || "MI NEGOCIO"}</div>
                            {saleData.organization?.address && <div>{saleData.organization.address}</div>}
                            {saleData.organization?.phone && <div>Tel: {saleData.organization.phone}</div>}
                            <div className="border-b"></div>
                        </div>

                        {/* INFO VENTA */}
                        <div className="space-y-1">
                            <div className="flex">
                                <span>Fecha:</span>
                                <span>{saleData.date.toLocaleString()}</span>
                            </div>
                            <div className="flex font-bold">
                                <span>Ticket:</span>
                                <span>
                                    {saleData.saleNumber
                                        ? `#${saleData.saleNumber.toString().padStart(5, '0')}`
                                        : `#${saleData.id.slice(0, 8)}`}
                                </span>
                            </div>
                            {saleData.customer && (
                                <div className="flex">
                                    <span>Cliente:</span>
                                    <span className="uppercase text-right max-w-[150px]">{saleData.customer.name}</span>
                                </div>
                            )}
                        </div>

                        <div className="border-b"></div>

                        {/* ITEMS */}
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-dashed border-black">
                                    <th className="text-left py-1 w-[40px]">Cant</th>
                                    <th className="text-left py-1">Producto</th>
                                    <th className="text-right py-1">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {saleData.items.map((item: any, i: number) => (
                                    <tr key={i}>
                                        <td valign="top" className="py-1 text-center">{item.quantity}</td>
                                        <td valign="top" className="py-1">{item.product_name || item.product.name}</td>
                                        <td valign="top" className="text-right py-1">${((item.total || (item.product.price * item.quantity))).toLocaleString("es-AR")}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div className="border-b border-dashed border-black my-2"></div>

                        {/* TOTALES */}
                        <div className="space-y-1 text-right">
                            <div className="flex justify-between">
                                <span>Subtotal:</span>
                                <span>${saleData.subtotal.toLocaleString("es-AR")}</span>
                            </div>
                            {saleData.discount > 0 && (
                                <div className="flex justify-between font-bold text-black/70">
                                    <span>Descuento:</span>
                                    <span>-${saleData.discount.toLocaleString("es-AR")}</span>
                                </div>
                            )}
                            {saleData.surcharge > 0 && (
                                <div className="flex justify-between font-bold text-black/70">
                                    <span>Recargo:</span>
                                    <span>+${saleData.surcharge.toLocaleString("es-AR")}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-sm font-bold mt-2 pt-1 border-t border-black">
                                <span>TOTAL:</span>
                                <span>${saleData.total.toLocaleString("es-AR")}</span>
                            </div>
                        </div>

                        {/* PAGOS */}
                        <div className="mt-4 pt-2 border-t border-dashed border-black">
                            <div className="font-bold mb-1 uppercase text-[10px]">Forma de Pago</div>
                            {saleData.payments.map((p: any, i: number) => {
                                const methodMap: Record<string, string> = {
                                    cash: "Efectivo",
                                    card: "Tarjeta",
                                    transfer: "Transferencia",
                                    credit: "Cta. Cte.",
                                    mixed: "Mixto"
                                };
                                return (
                                    <div key={i} className="flex justify-between text-[11px]">
                                        <span>{methodMap[p.method] || p.method}:</span>
                                        <span>${p.amount.toLocaleString("es-AR")}</span>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="text-center mt-4">
                            ¡Gracias por su compra!
                        </div>
                    </div>
                </div>

                <DialogFooter className="sm:justify-between gap-2">
                    <Button variant="outline" onClick={onClose}>
                        Cerrar
                    </Button>
                    <Button onClick={handlePrint} className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2">
                        <Printer className="h-4 w-4" /> Imprimir
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
