"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { Edit, DollarSign, CreditCard, Smartphone, Wallet, Trash2, Plus, Minus, X, Search } from "lucide-react";
import { toast } from "sonner";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface OrderItem {
    id: string;
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    total: number;
}

interface EditOrderModalProps {
    orderId: string | null;
    orderData: any;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

export function EditOrderModal({
    orderId,
    orderData,
    open,
    onOpenChange,
    onSuccess
}: EditOrderModalProps) {
    const [items, setItems] = useState<OrderItem[]>([]);
    const [originalItems, setOriginalItems] = useState<OrderItem[]>([]);
    const [paymentMethod, setPaymentMethod] = useState(orderData?.payment_method || "cash");
    const [paymentAmount, setPaymentAmount] = useState(orderData?.payment_amount || 0);
    const [loading, setLoading] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [products, setProducts] = useState<any[]>([]);
    const [productSearch, setProductSearch] = useState("");
    const [showProductSearch, setShowProductSearch] = useState(false);
    const supabase = createClient();

    useEffect(() => {
        if (open && orderId) {
            fetchOrderItems();
            fetchProducts();
        }
        if (orderData) {
            setPaymentMethod(orderData.payment_method || "cash");
            setPaymentAmount(orderData.payment_amount || 0);
        }
    }, [open, orderId, orderData]);

    const fetchOrderItems = async () => {
        if (!orderId) return;

        const { data, error } = await supabase
            .from('order_items')
            .select('*')
            .eq('order_id', orderId);

        if (!error && data) {
            setItems(data);
            setOriginalItems(data); // Store original items
        }
    };

    const fetchProducts = async () => {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('organization_id', orderData?.organization_id)
            .order('name');

        if (!error && data) {
            setProducts(data);
        }
    };

    const calculateSubtotal = () => {
        return items.reduce((sum, item) => sum + item.total, 0);
    };

    const calculateTotal = () => {
        const subtotal = calculateSubtotal();
        const deliveryFee = orderData?.delivery_fee || 0;
        const discount = orderData?.discount || 0;
        return subtotal + deliveryFee - discount;
    };

    const handleQuantityChange = (itemId: string, newQuantity: number) => {
        if (newQuantity < 1) return;

        setItems(items.map(item => {
            if (item.id === itemId) {
                const newTotal = item.unit_price * newQuantity;
                return { ...item, quantity: newQuantity, total: newTotal };
            }
            return item;
        }));
    };

    const handleRemoveItem = (itemId: string) => {
        setItems(items.filter(item => item.id !== itemId));
    };

    const handleAddProduct = (product: any) => {
        // Check if product already exists
        const existingItem = items.find(item => item.product_id === product.id);

        if (existingItem) {
            handleQuantityChange(existingItem.id, existingItem.quantity + 1);
        } else {
            const newItem: OrderItem = {
                id: `temp-${Date.now()}`,
                product_id: product.id,
                product_name: product.name,
                quantity: 1,
                unit_price: product.price,
                total: product.price
            };
            setItems([...items, newItem]);
        }

        setProductSearch("");
        setShowProductSearch(false);
    };

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.sku?.toLowerCase().includes(productSearch.toLowerCase())
    );

    const handleSave = async () => {
        if (!orderId) return;

        setLoading(true);
        try {
            const newTotal = calculateTotal();
            const isPaid = paymentAmount >= newTotal;

            // Calculate stock adjustments using stored original items
            const stockAdjustments = new Map<string, number>();

            // Return stock from original items
            originalItems.forEach(origItem => {
                const currentQty = stockAdjustments.get(origItem.product_id) || 0;
                stockAdjustments.set(origItem.product_id, currentQty + origItem.quantity);
            });

            // Subtract stock for new items
            items.forEach(newItem => {
                const currentQty = stockAdjustments.get(newItem.product_id) || 0;
                stockAdjustments.set(newItem.product_id, currentQty - newItem.quantity);
            });

            // Apply stock adjustments
            for (const [productId, adjustment] of stockAdjustments.entries()) {
                if (adjustment !== 0) {
                    // Get current stock
                    const { data: product, error: getError } = await supabase
                        .from('products')
                        .select('stock')
                        .eq('id', productId)
                        .single();

                    if (getError) throw getError;

                    // Update with new stock
                    const { error: updateError } = await supabase
                        .from('products')
                        .update({ stock: (product.stock || 0) + adjustment })
                        .eq('id', productId);

                    if (updateError) throw updateError;
                }
            }

            // Update order
            const { error: orderError } = await supabase
                .from('orders')
                .update({
                    subtotal: calculateSubtotal(),
                    total: newTotal,
                    payment_method: paymentMethod,
                    payment_amount: paymentAmount,
                    payment_status: isPaid ? 'paid' : 'pending'
                })
                .eq('id', orderId);

            if (orderError) throw orderError;

            // Delete all existing items
            const { error: deleteError } = await supabase
                .from('order_items')
                .delete()
                .eq('order_id', orderId);

            if (deleteError) throw deleteError;

            // Insert updated items
            const itemsToInsert = items.map(item => ({
                order_id: orderId,
                product_id: item.product_id,
                product_name: item.product_name,
                quantity: item.quantity,
                unit_price: item.unit_price,
                total: item.total
            }));

            const { error: insertError } = await supabase
                .from('order_items')
                .insert(itemsToInsert);

            if (insertError) throw insertError;

            toast.success("Pedido actualizado correctamente");
            onOpenChange(false);
            if (onSuccess) onSuccess();
        } catch (e: any) {
            toast.error("Error: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!orderId) return;

        setLoading(true);
        try {
            const { error } = await supabase
                .from('orders')
                .delete()
                .eq('id', orderId);

            if (error) throw error;

            toast.success("Pedido eliminado correctamente");
            setShowDeleteDialog(false);
            onOpenChange(false);
            if (onSuccess) onSuccess();
        } catch (e: any) {
            toast.error("Error al eliminar: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const paymentMethods = [
        { value: "cash", label: "Efectivo", icon: DollarSign, color: "text-green-400" },
        { value: "card", label: "Tarjeta", icon: CreditCard, color: "text-blue-400" },
        { value: "transfer", label: "Transferencia", icon: Smartphone, color: "text-purple-400" },
        { value: "credit", label: "Cuenta Cte.", icon: Wallet, color: "text-orange-400" }
    ];

    if (!orderData) return null;

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="bg-slate-950 border-slate-800 text-white max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            <Edit className="h-6 w-6 text-blue-500" />
                            Editar Pedido
                        </DialogTitle>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto space-y-6 py-4">
                        {/* Customer Info */}
                        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
                            <p className="text-slate-400 text-sm mb-1">Cliente</p>
                            <p className="text-white font-medium">{orderData.customer?.name || "Sin cliente"}</p>
                        </div>

                        {/* Products Section */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label className="text-slate-300">Productos</Label>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-emerald-700 text-emerald-400"
                                    onClick={() => setShowProductSearch(!showProductSearch)}
                                >
                                    <Plus className="h-4 w-4 mr-1" />
                                    Agregar
                                </Button>
                            </div>

                            {/* Product Search */}
                            {showProductSearch && (
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                                    <Input
                                        placeholder="Buscar producto..."
                                        className="pl-9 bg-slate-900 border-slate-700 text-white"
                                        value={productSearch}
                                        onChange={(e) => setProductSearch(e.target.value)}
                                        autoFocus
                                    />
                                    {productSearch && filteredProducts.length > 0 && (
                                        <div className="absolute z-10 w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg max-h-48 overflow-y-auto">
                                            {filteredProducts.slice(0, 5).map(product => (
                                                <button
                                                    key={product.id}
                                                    className="w-full px-3 py-2 text-left hover:bg-slate-800 flex justify-between items-center"
                                                    onClick={() => handleAddProduct(product)}
                                                >
                                                    <span className="text-white">{product.name}</span>
                                                    <span className="text-emerald-400 font-mono">${product.price}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Items List */}
                            <div className="space-y-2">
                                {items.length === 0 ? (
                                    <p className="text-slate-500 text-center py-4">No hay productos</p>
                                ) : (
                                    items.map(item => (
                                        <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex-1">
                                                    <p className="text-white font-medium">{item.product_name}</p>
                                                    <p className="text-slate-400 text-sm">${item.unit_price.toLocaleString()} c/u</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-8 w-8 p-0 border-slate-700"
                                                        onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                                                    >
                                                        <Minus className="h-3 w-3" />
                                                    </Button>
                                                    <span className="w-8 text-center text-white font-mono">{item.quantity}</span>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-8 w-8 p-0 border-slate-700"
                                                        onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                                                    >
                                                        <Plus className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-emerald-400 font-mono font-bold">${item.total.toLocaleString()}</p>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-8 w-8 p-0 text-red-400 hover:bg-red-500/10"
                                                    onClick={() => handleRemoveItem(item.id)}
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Totals */}
                            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-400">Subtotal</span>
                                    <span className="text-white font-mono">${calculateSubtotal().toLocaleString()}</span>
                                </div>
                                {orderData.delivery_fee > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-400">Envío</span>
                                        <span className="text-white font-mono">${orderData.delivery_fee.toLocaleString()}</span>
                                    </div>
                                )}
                                {orderData.discount > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-400">Descuento</span>
                                        <span className="text-red-400 font-mono">-${orderData.discount.toLocaleString()}</span>
                                    </div>
                                )}
                                <div className="flex justify-between pt-2 border-t border-slate-700">
                                    <span className="text-white font-semibold">Total</span>
                                    <span className="text-emerald-400 font-mono font-bold text-lg">${calculateTotal().toLocaleString()}</span>
                                </div>
                            </div>
                        </div>

                        {/* Payment Method Selection */}
                        <div className="space-y-3">
                            <Label className="text-slate-300">Método de Pago</Label>
                            <div className="grid grid-cols-2 gap-2">
                                {paymentMethods.map((method) => {
                                    const Icon = method.icon;
                                    return (
                                        <button
                                            key={method.value}
                                            type="button"
                                            onClick={() => setPaymentMethod(method.value)}
                                            className={`p-3 rounded-lg border-2 transition-all ${paymentMethod === method.value
                                                ? 'border-blue-500 bg-blue-500/10'
                                                : 'border-slate-700 bg-slate-900 hover:border-slate-600'
                                                }`}
                                        >
                                            <Icon className={`h-5 w-5 mx-auto mb-1 ${paymentMethod === method.value ? 'text-blue-400' : method.color
                                                }`} />
                                            <p className={`text-xs font-medium ${paymentMethod === method.value ? 'text-white' : 'text-slate-400'
                                                }`}>
                                                {method.label}
                                            </p>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Payment Amount */}
                        <div className="space-y-2">
                            <Label htmlFor="payment-amount" className="text-slate-300">
                                Monto Pagado
                            </Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                                <Input
                                    id="payment-amount"
                                    type="number"
                                    className="pl-7 bg-slate-900 border-slate-700 text-white"
                                    value={paymentAmount}
                                    onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                                    min="0"
                                    step="0.01"
                                />
                            </div>
                            {paymentAmount < calculateTotal() && paymentAmount > 0 && (
                                <p className="text-amber-400 text-xs">
                                    ⚠️ Pago parcial - Pendiente: ${(calculateTotal() - paymentAmount).toLocaleString()}
                                </p>
                            )}
                            {paymentAmount >= calculateTotal() && (
                                <p className="text-emerald-400 text-xs">
                                    ✓ Pedido pagado completamente
                                </p>
                            )}
                        </div>
                    </div>

                    <DialogFooter className="gap-2 flex-col sm:flex-row border-t border-slate-800 pt-4">
                        <Button
                            variant="outline"
                            onClick={() => setShowDeleteDialog(true)}
                            disabled={loading}
                            className="border-red-700 text-red-400 hover:bg-red-500/10 w-full sm:w-auto"
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Eliminar
                        </Button>
                        <div className="flex gap-2 flex-1">
                            <Button
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                disabled={loading}
                                className="border-slate-700 text-slate-300 flex-1"
                            >
                                Cancelar
                            </Button>
                            <Button
                                onClick={handleSave}
                                disabled={loading || items.length === 0}
                                className="bg-blue-600 hover:bg-blue-500 text-white flex-1"
                            >
                                {loading ? "Guardando..." : "Guardar Cambios"}
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent className="bg-slate-950 border-slate-800 text-white">
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar pedido?</AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-400">
                            Esta acción no se puede deshacer. El pedido y todos sus items serán eliminados permanentemente.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="bg-slate-900 border-slate-700 text-white hover:bg-slate-800">
                            Cancelar
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={loading}
                            className="bg-red-600 hover:bg-red-500 text-white"
                        >
                            {loading ? "Eliminando..." : "Eliminar"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
