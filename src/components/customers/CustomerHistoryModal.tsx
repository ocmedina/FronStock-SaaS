import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { AlertTriangle, DollarSign } from "lucide-react";
import { Customer, AccountMovement, CustomerSale } from "./types";
import { useState } from "react";

interface CustomerHistoryModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    customer: Customer | null;
    movements: AccountMovement[];
    sales: CustomerSale[];
    onRegisterPayment: () => void;
}

export function CustomerHistoryModal({
    open,
    onOpenChange,
    customer,
    movements,
    sales,
    onRegisterPayment,
}: CustomerHistoryModalProps) {
    const [activeTab, setActiveTab] = useState<"movements" | "sales">("movements");

    const getDueStatus = (sale: CustomerSale) => {
        if (sale.payment_status !== "pending" || !sale.credit_due_date) {
            return null;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const dueDate = new Date(`${sale.credit_due_date}T00:00:00`);
        const millisPerDay = 1000 * 60 * 60 * 24;
        const daysDiff = Math.round((dueDate.getTime() - today.getTime()) / millisPerDay);

        return {
            dueDate,
            daysDiff,
            isOverdue: daysDiff < 0,
        };
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[65vw] max-w-[80vw] w-full max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <DialogTitle className="text-xl">Cuenta Corriente</DialogTitle>
                            <p className="text-muted-foreground">{customer?.name}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-muted-foreground">Saldo Pendiente</p>
                            <p
                                className={`text-2xl font-bold ${customer && customer.balance > 0
                                    ? "text-rose-500"
                                    : "text-emerald-500"
                                    }`}
                            >
                                ${customer?.balance.toLocaleString()}
                            </p>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex gap-2 border-b">
                    <Button
                        variant={activeTab === "movements" ? "default" : "ghost"}
                        onClick={() => setActiveTab("movements")}
                        className="rounded-b-none"
                    >
                        Movimientos
                    </Button>
                    <Button
                        variant={activeTab === "sales" ? "default" : "ghost"}
                        onClick={() => setActiveTab("sales")}
                        className="rounded-b-none"
                    >
                        Historial Compras
                    </Button>
                </div>

                <div className="py-4">
                    {activeTab === "movements" ? (
                        <div className="space-y-4">
                            <div className="flex justify-end">
                                <Button onClick={onRegisterPayment}>
                                    <DollarSign className="mr-2 h-4 w-4" /> Registrar Pago
                                </Button>
                            </div>

                            <div className="border rounded-lg overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Fecha</TableHead>
                                            <TableHead>Tipo</TableHead>
                                            <TableHead>Descripción</TableHead>
                                            <TableHead className="text-right">Monto</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {movements.length === 0 ? (
                                            <TableRow>
                                                <TableCell
                                                    colSpan={4}
                                                    className="text-center text-muted-foreground py-8"
                                                >
                                                    No hay movimientos
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            movements.map((mov) => (
                                                <TableRow key={mov.id}>
                                                    <TableCell>
                                                        {new Date(mov.created_at).toLocaleDateString()}
                                                    </TableCell>
                                                    <TableCell>
                                                        {mov.type === "charge" ? (
                                                            <Badge
                                                                variant="outline"
                                                                className="text-rose-500 border-rose-200 bg-rose-50"
                                                            >
                                                                Cargo
                                                            </Badge>
                                                        ) : (
                                                            <Badge
                                                                variant="outline"
                                                                className="text-emerald-500 border-emerald-200 bg-emerald-50"
                                                            >
                                                                Pago
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>{mov.description}</TableCell>
                                                    <TableCell className="text-right font-medium">
                                                        ${mov.amount.toLocaleString()}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="border rounded-lg overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Fecha</TableHead>
                                            <TableHead>Estado</TableHead>
                                            <TableHead>Vencimiento</TableHead>
                                            <TableHead className="text-right">Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {sales.length === 0 ? (
                                            <TableRow>
                                                <TableCell
                                                    colSpan={4}
                                                    className="text-center text-muted-foreground py-8"
                                                >
                                                    No hay compras registradas
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            sales.map((sale) => {
                                                const dueStatus = getDueStatus(sale);

                                                return (
                                                <TableRow key={sale.id}>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span>
                                                                {new Date(sale.created_at).toLocaleDateString()}
                                                            </span>
                                                            <span className="text-xs text-muted-foreground">
                                                                {sale.sale_items?.length || 0} productos
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="secondary">
                                                            {sale.payment_status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        {sale.payment_status !== "pending" ? (
                                                            <span className="text-xs text-muted-foreground">No aplica</span>
                                                        ) : !dueStatus ? (
                                                            <Badge variant="outline">Sin fecha</Badge>
                                                        ) : dueStatus.isOverdue ? (
                                                            <Badge
                                                                variant="destructive"
                                                                className="inline-flex items-center gap-1"
                                                            >
                                                                <AlertTriangle className="h-3 w-3" />
                                                                Vencido {Math.abs(dueStatus.daysDiff)}d
                                                            </Badge>
                                                        ) : dueStatus.daysDiff === 0 ? (
                                                            <Badge variant="outline" className="border-amber-500 text-amber-700">
                                                                Vence hoy
                                                            </Badge>
                                                        ) : (
                                                            <div className="flex flex-col">
                                                                <span className="text-xs font-medium">
                                                                    {dueStatus.dueDate.toLocaleDateString()}
                                                                </span>
                                                                <span className="text-xs text-muted-foreground">
                                                                    {dueStatus.daysDiff} días
                                                                </span>
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right font-bold">
                                                        ${sale.total.toLocaleString()}
                                                    </TableCell>
                                                </TableRow>
                                            )})
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
