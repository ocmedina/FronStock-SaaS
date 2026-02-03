"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { CheckCircle, DollarSign, CreditCard, Smartphone, Wallet } from "lucide-react";
import { toast } from "sonner";

interface DeliveryConfirmationModalProps {
    orderId: string | null;
    orderTotal: number;
    currentPaymentMethod: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

export function DeliveryConfirmationModal({
    orderId,
    orderTotal,
    currentPaymentMethod,
    open,
    onOpenChange,
    onSuccess
}: DeliveryConfirmationModalProps) {
    const [paymentMethod, setPaymentMethod] = useState(currentPaymentMethod || "cash");
    const [paymentAmount, setPaymentAmount] = useState(orderTotal);
    const [loading, setLoading] = useState(false);
    const supabase = createClient();

    const handleConfirmDelivery = async () => {
        if (!orderId) return;

        setLoading(true);
        try {
            // Determine payment status based on amount
            const isPaid = paymentAmount >= orderTotal;

            const { error } = await supabase
                .from('orders')
                .update({
                    delivery_status: 'delivered',
                    payment_method: paymentMethod,
                    payment_amount: paymentAmount,
                    payment_status: isPaid ? 'paid' : 'pending',
                    delivered_at: new Date().toISOString()
                })
                .eq('id', orderId);

            if (error) throw error;

            const statusMsg = isPaid
                ? "Pedido entregado y pagado"
                : `Pedido entregado - Pendiente: $${(orderTotal - paymentAmount).toLocaleString()}`;

            toast.success(statusMsg);
            onOpenChange(false);
            if (onSuccess) onSuccess();
        } catch (e: any) {
            toast.error("Error: " + e.message);
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
                    {/* Total */}
                    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
                        <p className="text-slate-400 text-sm mb-1">Total del Pedido</p>
                        <p className="text-2xl font-bold text-emerald-400 font-mono">
                            ${orderTotal.toLocaleString()}
                        </p>
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
                                            ? 'border-emerald-500 bg-emerald-500/10'
                                            : 'border-slate-700 bg-slate-900 hover:border-slate-600'
                                            }`}
                                    >
                                        <Icon className={`h-5 w-5 mx-auto mb-1 ${paymentMethod === method.value ? 'text-emerald-400' : method.color
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
                            Monto Recibido
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
                        {paymentAmount < orderTotal && (
                            <p className="text-amber-400 text-xs flex items-center gap-1">
                                ⚠️ Pago parcial - Quedará pendiente: ${(orderTotal - paymentAmount).toLocaleString()}
                            </p>
                        )}
                        {paymentAmount >= orderTotal && (
                            <p className="text-emerald-400 text-xs flex items-center gap-1">
                                ✓ Pedido pagado completamente
                            </p>
                        )}
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
                        disabled={loading}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white"
                    >
                        {loading ? (
                            <>
                                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                                Confirmando...
                            </>
                        ) : (
                            <>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Confirmar Entrega
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
