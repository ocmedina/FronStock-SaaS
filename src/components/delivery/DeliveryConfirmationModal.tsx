"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { CheckCircle, DollarSign, CreditCard, Smartphone, Wallet } from "lucide-react";
import { toast } from "sonner";

export function DeliveryConfirmationModal({
    orders = [],
    open,
    onOpenChange,
    onSuccess
}: {
    orders?: any[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}) {
    const [paymentMethod, setPaymentMethod] = useState("cash");
    const [loading, setLoading] = useState(false);
    const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
    const supabase = createClient();

    // Default select all when opening with new orders
    useEffect(() => {
        if (open && orders.length > 0) {
            setSelectedOrderIds(orders.map(o => o.id));
        }
    }, [open, orders]);

    // Calculate totals based on selection
    const selectedOrders = orders.filter(o => selectedOrderIds.includes(o.id));
    const totalToPay = selectedOrders.reduce((sum, o) => sum + o.total, 0);

    const toggleOrder = (orderId: string) => {
        setSelectedOrderIds(prev =>
            prev.includes(orderId)
                ? prev.filter(id => id !== orderId)
                : [...prev, orderId]
        );
    };

    const handleConfirmDelivery = async () => {
        if (selectedOrderIds.length === 0) {
            toast.error("Debe seleccionar al menos un pedido");
            return;
        }

        setLoading(true);
        try {
            // Update all selected orders
            const updates = selectedOrderIds.map(orderId => {
                const order = orders.find(o => o.id === orderId);
                if (!order) return Promise.resolve();

                return supabase
                    .from('orders')
                    .update({
                        delivery_status: 'delivered',
                        payment_method: paymentMethod,
                        payment_amount: order.total, // Full payment assumed for now
                        payment_status: 'paid',
                        delivered_at: new Date().toISOString()
                    })
                    .eq('id', orderId);
            });

            await Promise.all(updates);

            toast.success(`${selectedOrderIds.length} pedidos marcados como entregados`);
            onOpenChange(false);
            if (onSuccess) onSuccess();
        } catch (e: any) {
            toast.error("Error: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    if (!open) return null;

    const paymentMethods = [
        { value: "cash", label: "Efectivo", icon: DollarSign, color: "text-green-400" },
        { value: "card", label: "Tarjeta", icon: CreditCard, color: "text-blue-400" },
        { value: "transfer", label: "Transferencia", icon: Smartphone, color: "text-purple-400" },
    ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-slate-950 border-slate-800 text-white max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <CheckCircle className="h-6 w-6 text-emerald-500" />
                        Confirmar Entrega
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Orders Selection List */}
                    <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                        <Label className="text-slate-300">Seleccionar Pedidos a Pagar</Label>
                        {orders.map(order => (
                            <div
                                key={order.id}
                                onClick={() => toggleOrder(order.id)}
                                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${selectedOrderIds.includes(order.id)
                                    ? "bg-emerald-950/30 border-emerald-500/50"
                                    : "bg-slate-900 border-slate-800 opacity-60"
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`h-5 w-5 rounded border flex items-center justify-center ${selectedOrderIds.includes(order.id) ? "bg-emerald-500 border-emerald-500" : "border-slate-500"}`}>
                                        {selectedOrderIds.includes(order.id) && <CheckCircle className="h-3.5 w-3.5 text-white" />}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium text-slate-200">
                                            {order.items_count || 1} ítems
                                        </span>
                                        <span className="text-[10px] text-slate-400">
                                            {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </div>
                                <span className={`font-mono font-bold ${selectedOrderIds.includes(order.id) ? "text-emerald-400" : "text-slate-500"}`}>
                                    ${order.total.toLocaleString()}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Total Summary */}
                    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex justify-between items-center">
                        <p className="text-slate-400 text-sm">Total a Cobrar</p>
                        <p className="text-2xl font-bold text-emerald-400 font-mono">
                            ${totalToPay.toLocaleString()}
                        </p>
                    </div>

                    {/* Payment Method Selection */}
                    <div className="space-y-3">
                        <Label className="text-slate-300">Método de Pago</Label>
                        <div className="grid grid-cols-3 gap-2">
                            {paymentMethods.map((method) => {
                                const Icon = method.icon;
                                return (
                                    <button
                                        key={method.value}
                                        type="button"
                                        onClick={() => setPaymentMethod(method.value)}
                                        className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center justify-center gap-1 ${paymentMethod === method.value
                                            ? 'border-emerald-500 bg-emerald-500/10'
                                            : 'border-slate-700 bg-slate-900 hover:border-slate-600'
                                            }`}
                                    >
                                        <Icon className={`h-5 w-5 ${paymentMethod === method.value ? 'text-emerald-400' : method.color}`} />
                                        <p className={`text-[10px] font-medium ${paymentMethod === method.value ? 'text-white' : 'text-slate-400'}`}>
                                            {method.label}
                                        </p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <DialogFooter className="gap-2">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={loading}
                        className="border-slate-700 text-slate-300"
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleConfirmDelivery}
                        disabled={loading || selectedOrderIds.length === 0}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white"
                    >
                        {loading ? "Procesando..." : "Confirmar Entrega"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
