'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Clock, Trash2, Play, FileText } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import type { SuspendedSale } from '@/hooks/useSuspendedSales';
import { cn } from '@/lib/utils';

interface SuspendedSalesPanelProps {
    suspendedSales: SuspendedSale[];
    onResume: (id: string) => void;
    onDelete: (id: string) => void;
}

export function SuspendedSalesPanel({
    suspendedSales,
    onResume,
    onDelete,
}: SuspendedSalesPanelProps) {
    const [selectedSale, setSelectedSale] = useState<SuspendedSale | null>(null);

    if (suspendedSales.length === 0) {
        return (
            <Card className="h-full">
                <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Ventas Suspendidas
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                        <Clock className="h-12 w-12 mx-auto mb-2 opacity-20" />
                        <p className="text-sm">No hay ventas suspendidas</p>
                        <p className="text-xs mt-1">Presiona F8 para suspender una venta</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <>
            <Card className="h-full">
                <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Ventas Suspendidas
                        <Badge variant="secondary" className="ml-auto">
                            {suspendedSales.length}
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
                    {suspendedSales.map((sale) => {
                        const itemCount = sale.tab.cart.length;
                        const total = sale.tab.cart.reduce(
                            (sum, item) => sum + item.product.price * item.quantity,
                            0
                        );

                        return (
                            <div
                                key={sale.id}
                                className={cn(
                                    'p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer',
                                    'group'
                                )}
                                onClick={() => setSelectedSale(sale)}
                            >
                                <div className="flex items-start justify-between gap-2 mb-2">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">
                                            {sale.tab.name}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {formatDistanceToNow(sale.timestamp, {
                                                addSuffix: true,
                                                locale: es,
                                            })}
                                        </p>
                                    </div>
                                    <Badge variant="outline" className="shrink-0">
                                        {itemCount} items
                                    </Badge>
                                </div>

                                {sale.note && (
                                    <p className="text-xs text-muted-foreground mb-2 line-clamp-1">
                                        <FileText className="h-3 w-3 inline mr-1" />{sale.note}
                                    </p>
                                )}

                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-sm font-bold">
                                        ${total.toLocaleString('es-AR')}
                                    </span>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 w-7 p-0"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onResume(sale.id);
                                            }}
                                        >
                                            <Play className="h-3 w-3" />
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDelete(sale.id);
                                            }}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </CardContent>
            </Card>

            {/* Detail Dialog */}
            <Dialog open={!!selectedSale} onOpenChange={() => setSelectedSale(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Detalle de Venta Suspendida</DialogTitle>
                        <DialogDescription>
                            {selectedSale && formatDistanceToNow(selectedSale.timestamp, {
                                addSuffix: true,
                                locale: es,
                            })}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedSale && (
                        <div className="space-y-4">
                            {selectedSale.note && (
                                <div>
                                    <Label>Nota</Label>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        {selectedSale.note}
                                    </p>
                                </div>
                            )}

                            <div>
                                <Label>Productos ({selectedSale.tab.cart.length})</Label>
                                <div className="mt-2 space-y-2 max-h-[200px] overflow-y-auto">
                                    {selectedSale.tab.cart.map((item, idx) => (
                                        <div
                                            key={idx}
                                            className="flex items-center justify-between text-sm p-2 rounded bg-muted"
                                        >
                                            <span className="flex-1 truncate">
                                                {item.product.name}
                                            </span>
                                            <span className="text-muted-foreground mx-2">
                                                x{item.quantity}
                                            </span>
                                            <span className="font-medium">
                                                ${(item.product.price * item.quantity).toLocaleString()}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-2 border-t">
                                <div className="flex justify-between text-lg font-bold">
                                    <span>Total:</span>
                                    <span>
                                        $
                                        {selectedSale.tab.cart
                                            .reduce(
                                                (sum, item) => sum + item.product.price * item.quantity,
                                                0
                                            )
                                            .toLocaleString('es-AR')}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setSelectedSale(null)}
                        >
                            Cerrar
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => {
                                if (selectedSale) {
                                    onDelete(selectedSale.id);
                                    setSelectedSale(null);
                                }
                            }}
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Eliminar
                        </Button>
                        <Button
                            onClick={() => {
                                if (selectedSale) {
                                    onResume(selectedSale.id);
                                    setSelectedSale(null);
                                }
                            }}
                        >
                            <Play className="h-4 w-4 mr-2" />
                            Recuperar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
