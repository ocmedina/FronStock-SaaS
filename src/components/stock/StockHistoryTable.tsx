import { Activity, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { StockMovement, MOVEMENT_TYPES, REASONS } from "./types";

interface StockHistoryTableProps {
    movements: StockMovement[];
}

export function StockHistoryTable({ movements }: StockHistoryTableProps) {
    return (
        <Card>
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Producto</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead className="text-right">Cantidad</TableHead>
                            <TableHead className="text-right">Stock</TableHead>
                            <TableHead>Motivo</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {movements.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-16">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="p-4 rounded-full bg-muted">
                                            <Activity className="h-8 w-8 text-muted-foreground" />
                                        </div>
                                        <p className="font-medium">
                                            No hay movimientos registrados
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            Los movimientos aparecerán aquí
                                        </p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            movements.map((mov) => {
                                const typeInfo =
                                    MOVEMENT_TYPES[
                                    mov.movement_type as keyof typeof MOVEMENT_TYPES
                                    ] || MOVEMENT_TYPES.adjustment;
                                const Icon = typeInfo.icon;
                                return (
                                    <TableRow key={mov.id} className="hover:bg-muted/50">
                                        <TableCell>
                                            <div>
                                                {new Date(mov.created_at).toLocaleDateString("es-AR")}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {new Date(mov.created_at).toLocaleTimeString(
                                                    "es-AR",
                                                    { hour: "2-digit", minute: "2-digit" },
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 rounded-lg bg-primary/10">
                                                    <Package className="h-4 w-4 text-primary" />
                                                </div>
                                                <span className="font-medium">
                                                    {mov.product_name}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={typeInfo.variant}
                                                className={`gap-1.5 ${typeInfo.bgColor} ${typeInfo.color}`}
                                            >
                                                <Icon className="h-3.5 w-3.5" /> {typeInfo.label}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <span
                                                className={`font-semibold ${mov.quantity > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
                                            >
                                                {mov.quantity > 0 ? "+" : ""}
                                                {mov.quantity}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <span className="text-muted-foreground">
                                                    {mov.previous_stock}
                                                </span>
                                                <span className="text-muted-foreground">→</span>
                                                <span className="font-semibold">{mov.new_stock}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {REASONS[mov.reason as string] || mov.reason || "-"}
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
