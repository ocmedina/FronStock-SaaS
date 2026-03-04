"use client";

import { useState } from "react";
import { Loader2, Truck, DollarSign, Wallet, CreditCard, Clock, MapPin, Receipt, AlertCircle, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { ensureOpenCashSession } from "@/lib/cash-session";
import { toast } from "sonner";
import { nanoid } from "nanoid";

interface OrderSummaryProps {
    items: { product: any, quantity: number }[];
    customer: any | null;
    onReset: () => void;
    onClose?: () => void; // Optional for closing modal
    onSuccess?: (saleId: string) => void; // Optional callback for navigation
}

export function OrderSummary({ items, customer, onReset, onClose, onSuccess }: OrderSummaryProps) {
    const { organizationId } = useOrganization();
    const [loading, setLoading] = useState(false);

    // Checkout State
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'credit'>('cash');
    const [deliveryNotes, setDeliveryNotes] = useState("");
    const [estimatedMins, setEstimatedMins] = useState(30);
    const [deliveryFee, setDeliveryFee] = useState(0);
    const [paymentAmount, setPaymentAmount] = useState("");

    const subtotal = items.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);
    const total = subtotal + Number(deliveryFee);
    const change = paymentAmount && Number(paymentAmount) >= total ? Number(paymentAmount) - total : 0;

    const supabase = createClient();

    const handleConfirmOrder = async () => {
        if (!customer) {
            toast.error("Debes seleccionar un cliente antes de confirmar el pedido.");
            if (onClose) onClose();
            return;
        }

        setLoading(true);
        try {
            const clientReference = `online_order_${Date.now()}_${nanoid(8)}`;
            const saleItems = items.map(item => ({
                product_id: item.product.id,
                product_name: item.product.name,
                quantity: item.quantity,
                unit_price: item.product.price
            }));

            const payload = {
                p_org_id: organizationId,
                p_customer_id: customer.id,
                p_payment_method: paymentMethod,
                p_items: saleItems,
                p_delivery_address: customer.address,
                p_delivery_notes: deliveryNotes,
                p_estimated_mins: estimatedMins,
                p_delivery_fee: deliveryFee,
                p_discount: 0,
                p_payment_amount: paymentAmount ? Number(paymentAmount) : null,
                p_client_reference: clientReference,
            };

            const hasOpenSession = await ensureOpenCashSession(supabase, organizationId);
            if (!hasOpenSession) {
                return;
            }

            let { data, error } = await supabase.rpc('create_order', payload);

            const shouldTryLegacy = !!error && (
                error.code === 'PGRST202' ||
                error.code === '42883' ||
                error.message?.toLowerCase().includes('function') ||
                error.message?.includes('p_client_reference')
            );

            if (shouldTryLegacy) {
                const { p_client_reference, ...legacyPayload } = payload;
                const legacyResult = await supabase.rpc('create_order', legacyPayload);
                data = legacyResult.data;
                error = legacyResult.error;
            }

            if (error) {
                console.error("Order Creation Error Details:", error);
                throw error;
            }

            if (!data.success) {
                console.error("Order Creation Logic Error:", data.error);
                throw new Error(data.error || "Error desconocido al crear el pedido");
            }

            const orderId = data.order_id;

            toast.success("Pedido enviado a cocina!");
            onReset();
            setPaymentAmount("");
            setDeliveryNotes("");

            // Call onSuccess if provided, passing the new order ID
            if (onSuccess) onSuccess(orderId);

            if (onClose) onClose();

        } catch (e: any) {
            console.error(e);
            toast.error("Error: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-slate-950/50">
            <div className="flex-1 overflow-y-auto space-y-6 p-1">
                {/* Customer Card */}
                <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
                    <h3 className="text-xs font-bold text-slate-500 uppercase mb-3">Cliente</h3>
                    {customer ? (
                        <div className="flex items-start gap-3">
                            <div className="mt-1">
                                <p className="font-bold text-white text-lg">{customer.name}</p>
                                <div className="flex items-center gap-2 text-slate-400 text-sm mt-0.5">
                                    <MapPin className="h-3.5 w-3.5 text-emerald-500" />
                                    {customer.address || "Sin dirección"}
                                </div>
                                {customer.phone && (
                                    <div className="flex items-center gap-2 text-slate-400 text-sm">
                                        <Phone className="h-3.5 w-3.5 text-emerald-500" />
                                        {customer.phone}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3 text-amber-500 bg-amber-500/10 p-3 rounded-lg border border-amber-500/20">
                            <AlertCircle className="h-5 w-5" />
                            <p className="font-medium text-sm">Selecciona un cliente</p>
                        </div>
                    )}
                </div>

                {/* Items List */}
                <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
                    <h3 className="text-xs font-bold text-slate-500 uppercase mb-3">Detalle</h3>
                    {items.length === 0 ? (
                        <p className="text-sm text-slate-500 text-center py-4 italic">Carrito vacío</p>
                    ) : (
                        items.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center py-2 border-b border-slate-800/50 last:border-0">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-emerald-500 w-6">{item.quantity}x</span>
                                    <span className="text-slate-300 text-sm truncate max-w-[150px]">{item.product.name}</span>
                                </div>
                                <span className="text-white font-medium">${(item.product.price * item.quantity).toLocaleString()}</span>
                            </div>
                        ))
                    )}
                    <div className="mt-4 pt-3 border-t border-slate-700 flex justify-between items-center">
                        <span className="text-slate-400">Total</span>
                        <span className="text-2xl font-bold text-emerald-400">${total.toLocaleString()}</span>
                    </div>
                </div>

                {/* Options */}
                <div className="space-y-4">
                    <div>
                        <h3 className="text-xs font-bold text-slate-500 uppercase mb-2">Método de Pago</h3>
                        <div className="grid grid-cols-3 gap-2">
                            <Button
                                variant="outline"
                                onClick={() => setPaymentMethod('cash')}
                                className={`h-10 text-xs border-slate-700 ${paymentMethod === 'cash' ? 'bg-emerald-600 text-white border-transparent' : 'bg-slate-900 text-slate-400'}`}
                            >
                                Efectivo
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => setPaymentMethod('transfer')}
                                className={`h-10 text-xs border-slate-700 ${paymentMethod === 'transfer' ? 'bg-emerald-600 text-white border-transparent' : 'bg-slate-900 text-slate-400'}`}
                            >
                                Transf.
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => setPaymentMethod('credit')}
                                className={`h-10 text-xs border-slate-700 ${paymentMethod === 'credit' ? 'bg-orange-600 text-white border-transparent' : 'bg-slate-900 text-slate-400'}`}
                            >
                                Fiado
                            </Button>
                        </div>

                        {paymentMethod === 'cash' && (
                            <div className="mt-3 bg-slate-900 p-3 rounded-xl border border-slate-800">
                                <label className="text-xs text-slate-400 mb-1 block">Pago con:</label>
                                <div className="flex gap-2">
                                    <Input
                                        type="number"
                                        className="bg-black/20 border-slate-700 text-white h-9"
                                        placeholder="$0"
                                        value={paymentAmount}
                                        onChange={e => setPaymentAmount(e.target.value)}
                                    />
                                    <div className="min-w-[80px] flex flex-col justify-center items-end px-2 bg-black/20 rounded border border-slate-700">
                                        <span className="text-[9px] text-slate-500 uppercase">Vuelto</span>
                                        <span className={`font-bold text-sm ${change < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                            ${change.toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div>
                        <h3 className="text-xs font-bold text-slate-500 uppercase mb-2">Demora (Min)</h3>
                        <div className="flex gap-2">
                            {[15, 30, 45, 60].map(mins => (
                                <Button
                                    key={mins}
                                    variant="outline"
                                    onClick={() => setEstimatedMins(mins)}
                                    className={`flex-1 h-9 text-xs border-slate-700 ${estimatedMins === mins ? 'bg-slate-100 text-slate-900' : 'bg-slate-900 text-slate-400'}`}
                                >
                                    {mins}m
                                </Button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <h3 className="text-xs font-bold text-slate-500 uppercase mb-2">Notas</h3>
                        <Textarea
                            value={deliveryNotes}
                            onChange={e => setDeliveryNotes(e.target.value)}
                            className="bg-slate-900 border-slate-800 text-white min-h-[60px] text-sm"
                            placeholder="Notas de entrega..."
                        />
                    </div>
                </div>
            </div>

            <div className="pt-4 mt-auto">
                <Button
                    size="lg"
                    className="w-full h-12 text-lg font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl shadow-emerald-900/30 rounded-xl disabled:opacity-50"
                    onClick={handleConfirmOrder}
                    disabled={loading || items.length === 0}
                >
                    {loading ? <Loader2 className="animate-spin mr-2" /> : <Receipt className="mr-2" />}
                    Confirmar Pedido
                </Button>
            </div>
        </div>
    );
}
