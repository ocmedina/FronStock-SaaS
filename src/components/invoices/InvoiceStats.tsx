import { Card, CardContent } from "@/components/ui/card";
import { FileText, DollarSign, Clock } from "lucide-react";

interface InvoiceStatsProps {
    invoices: any[];
}

export function InvoiceStats({ invoices }: InvoiceStatsProps) {
    const totalBilled = invoices.reduce(
        (acc, inv) => (inv.status !== "annulled" ? acc + Number(inv.total) : acc),
        0,
    );

    const issuedCount = invoices.filter((inv) => inv.status === "issued").length;

    // Pending ARCA authorizations
    const pendingAfip = invoices.filter(
        (inv) => inv.status !== "annulled" && inv.afip_status === "pending" && !inv.cae
    ).length;

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 shadow-lg shadow-blue-500/20">
                <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-blue-100 text-sm">Total Facturado</p>
                            <p className="text-2xl font-bold mt-1">
                                ${totalBilled.toLocaleString("es-AR")}
                            </p>
                        </div>
                        <DollarSign className="h-8 w-8 opacity-50" />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-muted-foreground text-sm">Facturas Emitidas</p>
                            <p className="text-2xl font-bold mt-1">{issuedCount}</p>
                        </div>
                        <FileText className="h-8 w-8 text-muted-foreground/30" />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-muted-foreground text-sm">Pendientes AFIP</p>
                            <p className="text-2xl font-bold mt-1">{pendingAfip}</p>
                        </div>
                        <Clock className="h-8 w-8 text-amber-500/50" />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
