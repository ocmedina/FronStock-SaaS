'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Plus, Trash2, ShoppingCart, AlertTriangle, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Supplier {
    id: string;
    name: string;
}

interface Product {
    id: string;
    name: string;
    cost_price: number;
    price: number;
}

interface OrderItem {
    product_id: string;
    product_name: string;
    quantity: number;
    unit_cost: number;
}

interface CreatePurchaseOrderModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    supplier: Supplier | null;
    onSuccess?: () => void;
}

export function CreatePurchaseOrderModal({
    open,
    onOpenChange,
    supplier,
    onSuccess,
}: CreatePurchaseOrderModalProps) {
    const { organizationId } = useOrganization();
    const router = useRouter();
    const [products, setProducts] = useState<Product[]>([]);
    const [items, setItems] = useState<OrderItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [notes, setNotes] = useState('');
    const [creditValidation, setCreditValidation] = useState<{
        valid: boolean;
        warning: boolean;
        exceeded: boolean;
        message: string;
        credit_limit?: number;
        current_balance?: number;
        available_credit?: number;
    } | null>(null);

    const supabase = createClient();

    useEffect(() => {
        if (open && organizationId) {
            console.log('Fetching products for organization:', organizationId);
            fetchProducts();
        } else if (!open) {
            // Reset state when modal closes
            setItems([]);
            setNotes('');
            setCreditValidation(null);
        } else if (open && !organizationId) {
            console.warn('Modal opened but no organizationId available');
        }
    }, [open, organizationId]);

    useEffect(() => {
        if (open && !supplier) {
            onOpenChange(false);
        }
    }, [open, supplier]);

    // Validar crédito cada vez que cambie el total
    useEffect(() => {
        if (open && supplier && items.length > 0) {
            validateCreditLimit();
        } else {
            setCreditValidation(null);
        }
    }, [items, open, supplier]);

    const validateCreditLimit = async () => {
        if (!supplier) return;

        const total = calculateTotal();
        if (total === 0) {
            setCreditValidation(null);
            return;
        }

        try {
            const { data, error } = await supabase.rpc('check_supplier_credit_limit', {
                p_supplier_id: supplier.id,
                p_order_total: total,
            });

            if (error) {
                console.error('Error validating credit:', error);
                return;
            }

            if (data) {
                setCreditValidation(data);
            }
        } catch (err) {
            console.error('Error validating credit limit:', err);
        }
    };

    const fetchProducts = async () => {
        if (!organizationId) {
            console.warn('No organizationId available');
            setLoading(false);
            return;
        }
        
        setLoading(true);

        try {
            const { data, error } = await supabase
                .from('products')
                .select('id, name, cost_price, price')
                .eq('organization_id', organizationId)
                .order('name');

            if (error) {
                console.error('Error fetching products:', {
                    message: error.message,
                    details: error.details,
                    hint: error.hint,
                    code: error.code,
                    full: error
                });
                setLoading(false);
                return;
            }

            console.log('Products fetched successfully:', data?.length || 0, 'items');
            
            if (data) {
                setProducts(data);
                // Auto-add first product if exists and items is empty
                if (data.length > 0 && items.length === 0) {
                    // Use data directly instead of waiting for state update
                    const firstProduct = data[0];
                    setItems([{
                        product_id: firstProduct.id,
                        product_name: firstProduct.name,
                        quantity: 1,
                        unit_cost: firstProduct.cost_price || firstProduct.price || 0,
                    }]);
                }
            } else {
                console.log('No products data returned');
                setProducts([]);
            }
        } catch (err) {
            console.error('Exception fetching products:', err);
        } finally {
            setLoading(false);
        }
    };

    const addItem = () => {
        if (products.length === 0) {
            console.warn('Cannot add item: no products available');
            return;
        }
        const firstProduct = products[0];
        const newItem = {
            product_id: firstProduct.id,
            product_name: firstProduct.name,
            quantity: 1,
            unit_cost: firstProduct.cost_price || firstProduct.price || 0,
        };
        console.log('Adding item:', newItem);
        setItems([...items, newItem]);
    };

    const updateItem = (
        index: number,
        field: keyof OrderItem,
        value: string | number
    ) => {
        const updated = [...items];
        if (field === 'product_id') {
            const product = products.find((p) => p.id === value);
            if (product) {
                updated[index] = {
                    ...updated[index],
                    product_id: product.id,
                    product_name: product.name,
                    unit_cost: product.cost_price || product.price || 0,
                };
            }
        } else if (field === 'quantity' || field === 'unit_cost') {
            updated[index] = {
                ...updated[index],
                [field]: Number(value),
            };
        } else {
            updated[index] = {
                ...updated[index],
                [field]: value,
            } as OrderItem;
        }
        setItems(updated);
    };

    const removeItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const calculateTotal = () =>
        items.reduce((sum, item) => sum + item.quantity * item.unit_cost, 0);

    const handleSave = async () => {
        if (!organizationId || !supplier || items.length === 0) return;

        // Si excede el límite, pedir confirmación
        if (creditValidation?.exceeded) {
            const confirmed = window.confirm(
                'ADVERTENCIA: Esta orden excede el límite de crédito del proveedor.\n\n' +
                creditValidation.message + '\n\n' +
                '¿Deseas crear la orden de todas formas?'
            );
            if (!confirmed) return;
        }

        setSaving(true);

        try {
            const { createPurchaseOrder } = await import('@/actions/purchases');
            const result = await createPurchaseOrder({
                supplierId: supplier.id,
                notes: notes || null,
                items: items.map((item) => ({
                    product_id: item.product_id,
                    product_name: item.product_name,
                    quantity: item.quantity,
                    unit_cost: item.unit_cost,
                })),
            });

            if (result.error) {
                throw new Error(result.error);
            }

            // Reset form
            setItems([]);
            setNotes('');
            onOpenChange(false);
            onSuccess?.();
        } catch (err: any) {
            console.error('Error creating purchase order:', err);
            alert(err.message || 'Error al crear la orden de compra');
        } finally {
            setSaving(false);
        }
    };

    if (!supplier) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ShoppingCart className="h-5 w-5 text-primary" />
                        Nueva Orden de Compra - {supplier.name}
                    </DialogTitle>
                    <DialogDescription>
                        Agrega productos y cantidades para crear una nueva orden de compra
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Products Section */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label>Productos</Label>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={addItem}
                                    disabled={products.length === 0}
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Agregar Producto
                                </Button>
                            </div>

                            {products.length === 0 ? (
                                <div className="text-center py-8 border rounded-lg bg-muted/30">
                                    <p className="text-muted-foreground">
                                        {loading 
                                            ? 'Cargando productos...' 
                                            : 'No hay productos disponibles. Crea productos primero.'}
                                    </p>
                                </div>
                            ) : items.length === 0 ? (
                                <div className="text-center py-8 border rounded-lg bg-muted/30">
                                    <p className="text-muted-foreground">
                                        Haz clic en "Agregar Producto" para comenzar
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-96 overflow-y-auto">
                                    {items.map((item, index) => (
                                        <div
                                            key={index}
                                            className="flex gap-2 items-center p-3 rounded-lg bg-muted/50 border"
                                        >
                                            <Select
                                                value={item.product_id}
                                                onValueChange={(v) =>
                                                    updateItem(index, 'product_id', v)
                                                }
                                            >
                                                <SelectTrigger className="flex-1">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {products.map((p) => (
                                                        <SelectItem key={p.id} value={p.id}>
                                                            {p.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <div className="flex flex-col gap-1">
                                                <Label className="text-xs">Cantidad</Label>
                                                <Input
                                                    type="number"
                                                    value={item.quantity}
                                                    onChange={(e) =>
                                                        updateItem(
                                                            index,
                                                            'quantity',
                                                            parseInt(e.target.value) || 1
                                                        )
                                                    }
                                                    min="1"
                                                    className="w-20"
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <Label className="text-xs">Costo Unit.</Label>
                                                <Input
                                                    type="number"
                                                    value={item.unit_cost}
                                                    onChange={(e) =>
                                                        updateItem(
                                                            index,
                                                            'unit_cost',
                                                            parseFloat(e.target.value) || 0
                                                        )
                                                    }
                                                    step="0.01"
                                                    className="w-28"
                                                />
                                            </div>
                                            <div className="w-32 text-right">
                                                <Label className="text-xs text-muted-foreground">
                                                    Subtotal
                                                </Label>
                                                <p className="font-semibold">
                                                    $
                                                    {(item.quantity * item.unit_cost).toLocaleString(
                                                        'es-AR',
                                                        { minimumFractionDigits: 2 }
                                                    )}
                                                </p>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon-sm"
                                                onClick={() => removeItem(index)}
                                                className="text-destructive shrink-0"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {items.length > 0 && (
                                <>
                                    <div className="p-4 rounded-lg bg-primary/5 border-2 border-primary/20">
                                        <div className="flex justify-between items-center">
                                            <span className="font-medium">Total de la Orden:</span>
                                            <span className="text-2xl font-bold text-primary">
                                                $
                                                {calculateTotal().toLocaleString('es-AR', {
                                                    minimumFractionDigits: 2,
                                                })}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Credit Validation Alerts */}
                                    {creditValidation && creditValidation.exceeded && (
                                        <Alert variant="destructive">
                                            <AlertTriangle className="h-4 w-4" />
                                            <AlertDescription>
                                                <strong>Límite de crédito excedido</strong>
                                                <p className="mt-1 text-sm">{creditValidation.message}</p>
                                                {creditValidation.credit_limit && (
                                                    <div className="mt-2 text-xs space-y-1">
                                                        <p>Límite: ${creditValidation.credit_limit.toLocaleString('es-AR')}</p>
                                                        <p>Balance actual: ${creditValidation.current_balance?.toLocaleString('es-AR')}</p>
                                                        <p>Disponible: ${creditValidation.available_credit?.toLocaleString('es-AR')}</p>
                                                    </div>
                                                )}
                                            </AlertDescription>
                                        </Alert>
                                    )}

                                    {creditValidation && creditValidation.warning && !creditValidation.exceeded && (
                                        <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-900/10">
                                            <AlertCircle className="h-4 w-4 text-amber-600" />
                                            <AlertDescription className="text-amber-800 dark:text-amber-200">
                                                <strong>Advertencia de crédito</strong>
                                                <p className="mt-1 text-sm">{creditValidation.message}</p>
                                                {creditValidation.credit_limit && (
                                                    <div className="mt-2 text-xs space-y-1">
                                                        <p>Límite: ${creditValidation.credit_limit.toLocaleString('es-AR')}</p>
                                                        <p>Balance actual: ${creditValidation.current_balance?.toLocaleString('es-AR')}</p>
                                                        <p>Disponible: ${creditValidation.available_credit?.toLocaleString('es-AR')}</p>
                                                    </div>
                                                )}
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Notes */}
                        <div className="space-y-2">
                            <Label>Notas (Opcional)</Label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={3}
                                className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                                placeholder="Notas adicionales sobre la orden..."
                            />
                        </div>
                    </div>
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
                        onClick={handleSave}
                        disabled={saving || loading || items.length === 0}
                    >
                        {saving ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Creando...
                            </>
                        ) : (
                            <>
                                <ShoppingCart className="mr-2 h-4 w-4" />
                                Crear Orden
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
