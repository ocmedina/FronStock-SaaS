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
import {
    MapPin,
    Mail,
    Phone,
    History,
    Pencil,
    Trash2,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";
import { Customer } from "./types";

interface CustomerTableProps {
    customers: Customer[];
    totalCustomers: number;
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    onEdit: (customer: Customer) => void;
    onDelete: (id: string) => void;
    onViewHistory: (customer: Customer) => void;
    startIndex: number;
    endIndex: number;
}

export function CustomerTable({
    customers,
    totalCustomers,
    currentPage,
    totalPages,
    onPageChange,
    onEdit,
    onDelete,
    onViewHistory,
    startIndex,
    endIndex,
}: CustomerTableProps) {
    return (
        <>
            <div className="rounded-lg border bg-card/50 backdrop-blur-sm shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <Table className="min-w-[700px]">
                        <TableHeader>
                            <TableRow>
                                <TableHead>Cliente</TableHead>
                                <TableHead>Contacto</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead className="text-right">Saldo Pendiente</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {customers.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={5}
                                        className="text-center py-12 text-muted-foreground"
                                    >
                                        No se encontraron clientes.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                customers.map((customer) => (
                                    <TableRow key={customer.id} className="hover:bg-muted/50">
                                        <TableCell>
                                            <div className="font-medium">{customer.name}</div>
                                            {customer.address && (
                                                <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                                    <MapPin className="h-3 w-3" /> {customer.address}
                                                </div>
                                            )}
                                            {customer.reference && (
                                                <div className="text-xs text-blue-600/80 dark:text-blue-400 flex items-center gap-1 mt-0.5 italic">
                                                    <MapPin className="h-3 w-3" /> Ref: {customer.reference}
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-1">
                                                {customer.email && (
                                                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                                                        <Mail className="h-3 w-3" /> {customer.email}
                                                    </div>
                                                )}
                                                {customer.phone && (
                                                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                                                        <Phone className="h-3 w-3" /> {customer.phone}
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={
                                                    customer.customer_type === "wholesale"
                                                        ? "secondary"
                                                        : "outline"
                                                }
                                            >
                                                {customer.customer_type === "wholesale"
                                                    ? "Mayorista"
                                                    : "Minorista"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div
                                                className={`font-bold ${customer.balance > 0
                                                        ? "text-rose-500"
                                                        : "text-emerald-600"
                                                    }`}
                                            >
                                                ${customer.balance.toLocaleString()}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => onViewHistory(customer)}
                                                    title="Ver Cuenta"
                                                >
                                                    <History className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => onEdit(customer)}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="text-destructive hover:text-destructive"
                                                    onClick={() => onDelete(customer.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Pagination Controls */}
            {customers.length > 0 && (
                <div className="flex items-center justify-between border-t pt-4 px-2">
                    <div className="text-sm text-muted-foreground">
                        Mostrando {startIndex + 1} a {Math.min(endIndex, totalCustomers)} de{" "}
                        {totalCustomers} clientes
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                            disabled={currentPage === 1}
                            className="h-8"
                        >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Anterior
                        </Button>
                        <div className="text-sm font-medium min-w-[3rem] text-center">
                            {currentPage} / {totalPages}
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                onPageChange(Math.min(totalPages, currentPage + 1))
                            }
                            disabled={currentPage === totalPages}
                            className="h-8"
                        >
                            Siguiente
                            <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                    </div>
                </div>
            )}
        </>
    );
}
