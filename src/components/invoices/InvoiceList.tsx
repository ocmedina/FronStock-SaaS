import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, FileText, Download } from "lucide-react";
import { Invoice } from "./types";

interface InvoiceListProps {
    invoices: Invoice[];
    onView: (invoice: Invoice) => void;
}

export function InvoiceList({ invoices, onView }: InvoiceListProps) {
    return (
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Número</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>AFIP / ARCA</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {invoices.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                No hay facturas registradas
                            </TableCell>
                        </TableRow>
                    ) : (
                        invoices.map((invoice) => (
                            <TableRow key={invoice.id} className="hover:bg-muted/50">
                                <TableCell className="font-medium font-mono">
                                    {invoice.type}-{invoice.invoice_number}
                                </TableCell>
                                <TableCell>
                                    {new Date(invoice.created_at).toLocaleDateString("es-AR")}
                                </TableCell>
                                <TableCell>
                                    {invoice.customer?.name || "Consumidor Final"}
                                </TableCell>
                                <TableCell className="font-bold">
                                    ${Number(invoice.total).toLocaleString("es-AR")}
                                </TableCell>
                                <TableCell>
                                    <Badge variant={invoice.status === 'annulled' ? 'destructive' : 'outline'}>
                                        {invoice.status === 'issued' ? 'Emitida' : 'Anulada'}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    {invoice.afip_status === 'authorised' ? (
                                        <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-200 border-green-200">
                                            Autorizada
                                        </Badge>
                                    ) : invoice.afip_status === 'pending' ? (
                                        <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-200">
                                            Pendiente
                                        </Badge>
                                    ) : (
                                        <span className="text-xs text-muted-foreground">-</span>
                                    )}
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <Button variant="ghost" size="icon" onClick={() => onView(invoice)}>
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon">
                                            <Download className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
