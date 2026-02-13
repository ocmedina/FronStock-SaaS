'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { CheckCircle, Loader2, Package, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PurchaseOrder {
    id: string;
    order_number: string | null;
    supplier: { name: string } | null;
    status: string;
    total: number;
}

interface OrderItem {
    id: string;
    product_id: string;
    product_name: string;
    quantity: number;
    received_quantity: number;
    unit_cost: number;
}

interface ReceiveItem {
    product_id: string;
    product_name: string;
    ordered_quantity: number;
    previously_received: number;
    received_quantity: number;
}

interface ReceivePurchaseOrderModalProps {
    order: PurchaseOrder | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

export function ReceivePurchaseOrderModal({
    order,
    open,
    onOpenChange,
    onSuccess,
}: ReceivePurchaseOrderModalProps) {
    const [items, setItems] = useState<ReceiveItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [receiveType, setReceiveType] = useState<'full' | 'partial'>('full');

    const supabase = createClient();

    useEffect(() => {
        if (open && order) {
            fetchOrderItems();
        }
    }, [open, order]);

    const fetchOrderItems = async () => {
        if (!order) return;
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
            .from('purchase_order_items')
            .select('*')
            .eq('purchase_order_id', order.id);

        if (fetchError) {
            setError('Error al cargar los items de la orden');
            setLoading(false);
            return;
        }

        if (data) {
            const receiveItems: ReceiveItem[] = data.map((item: OrderItem) => ({
                product_id: item.product_id,
                product_name: item.product_name,
                ordered_quantity: item.quantity,
                previously_received: item.received_quantity || 0,
                received_quantity: item.quantity - (item.received_quantity || 0), // Default to pending quantity
            }));
            setItems(receiveItems);
        }

        setLoading(false);
    };

    const updateReceivedQuantity = (productId: string, quantity: number) => {
        setItems(prev =>
            prev.map(item =>
                item.product_id === productId
                    ? { ...item, received_quantity: Math.max(0, quantity) }
                    : item
            )
        );
    };

    const fillAllQuantities = () => {
        setItems(prev =>
            prev.map(item => ({
                ...item,
                received_quantity: item.ordered_quantity - item.previously_received,
            }))
        );
    };

    const handleReceive = async () => {
        if (!order) return;

        // Validar que haya al menos un item con cantidad > 0
        const itemsToReceive = items.filter(item => item.received_quantity > 0);
        
        if (itemsToReceive.length === 0) {
            setError('Debes ingresar al menos una cantidad a recibir');
            return;
        }

        setSaving(true);
        setError(null);

        try {
            // Preparar datos para la función RPC
            const receiveData = itemsToReceive.map(item => ({
                product_id: item.product_id,
                received_quantity: item.previously_received + item.received_quantity,
            }));

            // Determinar si es recepción completa o parcial
            const isFullReceive = items.every(
                item => 
                    item.previously_received + item.received_quantity >= item.ordered_quantity
            );

            // Llamar a la función RPC correspondiente
            const functionName = isFullReceive 
                ? 'receive_purchase_order' 
                : 'partial_receive_purchase_order';

            const { data, error: rpcError } = await supabase.rpc(functionName, {
                p_purchase_order_id: order.id,
                p_items: receiveData,
            });

            if (rpcError) {
                throw new Error(rpcError.message);
            }

            if (data && !data.success) {
                throw new Error(data.error || 'Error al recibir la orden');
            }

            // Éxito
            onOpenChange(false);
            onSuccess?.();
        } catch (err: any) {
            setError(err.message || 'Error al procesar la recepción');
        } finally {
            setSaving(false);
        }
    };

    const getPendingQuantity = (item: ReceiveItem) => {
        return item.ordered_quantity - item.previously_received;
    };

    const getTotalReceiving = () => {
        return items.reduce((sum, item) => sum + item.received_quantity, 0);
    };

    if (!order) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        Recibir Orden de Compra
                    </DialogTitle>
                    <DialogDescription>
                        <div className="space-y-1">
                            <p>Orden: <strong>{order.order_number}</strong></p>
                            <p>Proveedor: <strong>{order.supplier?.name}</strong></p>
                        </div>
                    </DialogDescription>
                </DialogHeader>

                {error && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <>
                        <div className="space-y-4">
                            {/* Botón para llenar todas las cantidades */}
                            <div className="flex justify-end">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={fillAllQuantities}
                                >
                                    Recibir Todo
                                </Button>
                            </div>

                            {/* Tabla de items */}
                            <div className="border rounded-lg overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Producto</TableHead>
                                            <TableHead className="text-center">Ordenado</TableHead>
                                            <TableHead className="text-center">Recibido Anteriormente</TableHead>
                                            <TableHead className="text-center">Pendiente</TableHead>
                                            <TableHead className="text-center">Recibir Ahora</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {items.map((item) => {
                                            const pending = getPendingQuantity(item);
                                            return (
                                                <TableRow key={item.product_id}>
                                                    <TableCell className="font-medium">
                                                        {item.product_name}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        {item.ordered_quantity}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        {item.previously_received > 0 ? (
                                                            <Badge variant="secondary">
                                                                {item.previously_received}
                                                            </Badge>
                                                        ) : (
                                                            <span className="text-muted-foreground">0</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Badge
                                                            variant={pending > 0 ? 'default' : 'secondary'}
                                                        >
                                                            {pending}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            max={pending}
                                                            value={item.received_quantity}
                                                            onChange={(e) =>
                                                                updateReceivedQuantity(
                                                                    item.product_id,
                                                                    parseInt(e.target.value) || 0
                                                                )
                                                            }
                                                            className="w-24 text-center mx-auto"
                                                        />
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Resumen */}
                            <div className="bg-muted/50 p-4 rounded-lg">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium">
                                        Total de unidades a recibir:
                                    </span>
                                    <Badge variant="default" className="text-lg px-3 py-1">
                                        {getTotalReceiving()}
                                    </Badge>
                                </div>
                            </div>

                            {/* Advertencia */}
                            <Alert>
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>
                                    Al confirmar la recepción, se actualizará automáticamente el stock de los productos y se registrará el movimiento en el inventario.
                                </AlertDescription>
                            </Alert>
                        </div>
                    </>
                )}

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={saving}
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleReceive}
                        disabled={saving || loading || getTotalReceiving() === 0}
                    >
                        {saving ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Procesando...
                            </>
                        ) : (
                            <>
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Confirmar Recepción
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
