"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
    Clock,
    Truck,
    CheckCircle,
    DollarSign,
    FileText,
    AlertCircle,
} from "lucide-react";

interface PurchaseOrder {
    id: string;
    status: string;
    total: number;
    created_at: string;
}

interface SupplierInvoice {
    id: string;
    payment_status: string;
    total: number;
    paid_amount: number;
}

interface PurchaseStatsProps {
    orders: PurchaseOrder[];
    invoices?: SupplierInvoice[];
}

export function PurchaseStats({ orders, invoices = [] }: PurchaseStatsProps) {
    const stats = useMemo(() => {
        const pending = orders.filter((o) => o.status === "pending").length;
        const ordered = orders.filter((o) => o.status === "ordered").length;
        const received = orders.filter((o) => o.status === "received").length;

        const totalSpent = orders
            .filter((o) => o.status === "received")
            .reduce((sum, o) => sum + Number(o.total), 0);

        const pendingTotal = orders
            .filter((o) => o.status === "pending" || o.status === "ordered")
            .reduce((sum, o) => sum + Number(o.total), 0);

        const invoicesPending = invoices.filter(
            (i) => i.payment_status === "pending"
        ).length;

        const invoicesPartial = invoices.filter(
            (i) => i.payment_status === "partial"
        ).length;

        const totalOwed = invoices
            .filter((i) => i.payment_status !== "paid")
            .reduce((sum, i) => sum + (Number(i.total) - Number(i.paid_amount)), 0);

        return {
            pending,
            ordered,
            received,
            totalSpent,
            pendingTotal,
            invoicesPending,
            invoicesPartial,
            totalOwed,
        };
    }, [orders, invoices]);

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Órdenes Pendientes */}
            <Card className="bg-gradient-to-br from-amber-500 to-orange-500 text-white border-0 shadow-lg shadow-amber-500/20">
                <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-amber-100 text-sm">Pendientes</p>
                            <p className="text-2xl font-bold mt-1">{stats.pending}</p>
                        </div>
                        <Clock className="h-8 w-8 opacity-50" />
                    </div>
                </CardContent>
            </Card>

            {/* En Camino */}
            <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 shadow-lg shadow-blue-500/20">
                <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-blue-100 text-sm">En Camino</p>
                            <p className="text-2xl font-bold mt-1">{stats.ordered}</p>
                        </div>
                        <Truck className="h-8 w-8 opacity-50" />
                    </div>
                </CardContent>
            </Card>

            {/* Recibidas */}
            <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-0 shadow-lg shadow-emerald-500/20">
                <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-emerald-100 text-sm">Recibidas</p>
                            <p className="text-2xl font-bold mt-1">{stats.received}</p>
                        </div>
                        <CheckCircle className="h-8 w-8 opacity-50" />
                    </div>
                </CardContent>
            </Card>

            {/* Total Invertido */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-muted-foreground text-sm">Total Invertido</p>
                            <p className="text-2xl font-bold mt-1">
                                ${stats.totalSpent.toLocaleString("es-AR")}
                            </p>
                        </div>
                        <DollarSign className="h-8 w-8 text-muted-foreground/30" />
                    </div>
                </CardContent>
            </Card>

            {/* Facturas Pendientes de Pago */}
            {invoices.length > 0 && (
                <>
                    <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0 shadow-lg shadow-purple-500/20">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-purple-100 text-sm">Facturas Pendientes</p>
                                    <p className="text-2xl font-bold mt-1">
                                        {stats.invoicesPending + stats.invoicesPartial}
                                    </p>
                                </div>
                                <FileText className="h-8 w-8 opacity-50" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white border-0 shadow-lg shadow-red-500/20">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-red-100 text-sm">Total Adeudado</p>
                                    <p className="text-2xl font-bold mt-1">
                                        ${stats.totalOwed.toLocaleString("es-AR")}
                                    </p>
                                </div>
                                <AlertCircle className="h-8 w-8 opacity-50" />
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}
