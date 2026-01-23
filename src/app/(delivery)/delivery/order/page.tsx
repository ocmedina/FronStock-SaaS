"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Search, Plus, Minus, ShoppingCart, Trash2, Check, Loader2, MapPin, CreditCard, DollarSign, Wallet, User as UserIcon, Bike } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useOrganization } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

function OrderForm() {
    const { organizationId, profile } = useOrganization();
    const searchParams = useSearchParams();
    const router = useRouter();
    const customerId = searchParams.get('customerId');

    const [step, setStep] = useState<'customer' | 'products' | 'confirm'>('customer');
    const [customers, setCustomers] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
    const [cart, setCart] = useState<{ product: any, quantity: number }[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(false);

    // Delivery Specific State
    const [deliveryDate, setDeliveryDate] = useState<'now' | 'scheduled'>('now');
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'credit' | 'mp'>('cash');
    const [deliveryNotes, setDeliveryNotes] = useState("");
    const [deliveryAddress, setDeliveryAddress] = useState("");


    const supabase = createClient();

    // Load initial data
    useEffect(() => {
        if (!organizationId) return;

        const loadData = async () => {
            // 1. Fetch products
            const { data: prods } = await supabase
                .from('products')
                .select('*')
                .eq('organization_id', organizationId)
                .order('name');
            if (prods) setProducts(prods);

            // 2. Fetch customer if ID provided
            if (customerId) {
                const { data: cust } = await supabase
                    .from('customers')
                    .select('*')
                    .eq('id', customerId)
                    .single();

                if (cust) {
                    setSelectedCustomer(cust);
                    setDeliveryAddress(cust.address || "");
                    setStep('products');
                }
            } else {
                // Fetch all customers for selection
                const { data: custs } = await supabase
                    .from('customers')
                    .select('*')
                    .eq('organization_id', organizationId)
                    .order('name')
                    .limit(50);
                if (custs) setCustomers(custs);
            }
        };
        loadData();
    }, [organizationId, customerId, supabase]);

    // Filtered products
    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku?.includes(searchQuery)
    );

    const addToCart = (product: any) => {
        setCart(prev => {
            const existing = prev.find(item => item.product.id === product.id);
            if (existing) {
                return prev.map(item =>
                    item.product.id === product.id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            }
            return [...prev, { product, quantity: 1 }];
        });
        toast.success("Producto agregado");
    };

    const updateQuantity = (productId: string, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.product.id === productId) {
                const newQty = Math.max(0, item.quantity + delta);
                return { ...item, quantity: newQty };
            }
            return item;
        }).filter(item => item.quantity > 0));
    };

    const cartTotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

    const handleSubmitOrder = async () => {
        if (!selectedCustomer || cart.length === 0) return;
        setLoading(true);

        try {
            const items = cart.map(item => ({
                product_id: item.product.id,
                product_name: item.product.name,
                quantity: item.quantity,
                unit_price: item.product.price
            }));

            // Determine statuses based on payment method
            let paymentStatus = 'paid';
            if (paymentMethod === 'credit') paymentStatus = 'pending'; // Fiado/Cta Cte

            const { data, error } = await supabase.rpc('process_sale', {
                p_org_id: organizationId,
                p_customer_id: selectedCustomer.id,
                p_payment_method: paymentMethod,
                p_items: items,
                p_delivery_status: 'pending', // Starts as pending/confirmed
                p_payment_status: paymentStatus,
                p_assigned_to: null, // Allow assigning later
                p_delivery_address: deliveryAddress,
                p_delivery_notes: deliveryNotes
            });

            if (error) throw error;

            toast.success("Pedido registrado exitosamente");
            router.push('/delivery');

        } catch (err: any) {
            console.error(err);
            toast.error("Error al procesar pedido: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-slate-950">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950 sticky top-0 z-10">
                <div className="flex items-center gap-2">
                    {step === 'customer' ? (
                        <Link href="/delivery">
                            <Button variant="ghost" size="icon" className="text-slate-400"><ArrowLeft className="h-5 w-5" /></Button>
                        </Link>
                    ) : (
                        <Button variant="ghost" size="icon" onClick={() => setStep(step === 'confirm' ? 'products' : 'customer')} className="text-slate-400">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    )}
                    <h1 className="text-lg font-bold text-white">
                        {step === 'customer' ? 'Seleccionar Cliente' : step === 'products' ? 'Agregar Productos' : 'Confirmar Pedido'}
                    </h1>
                </div>
                {step === 'products' && (
                    <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => setStep('confirm')}
                        disabled={cart.length === 0}
                    >
                        <ShoppingCart className="h-4 w-4 mr-2" />
                        Ver ({cart.length})
                    </Button>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 pb-24">

                {/* Step 1: Customer Selection */}
                {step === 'customer' && (
                    <div className="space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                            <Input
                                placeholder="Buscar cliente por nombre o dirección..."
                                className="bg-slate-900 border-slate-800 text-white pl-9"
                                onChange={(e) => {
                                    // Local filter for demo, real implementations should debounce query
                                }}
                            />
                        </div>

                        {/* New Customer Button */}
                        <Button
                            variant="outline"
                            className="w-full border-dashed border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 h-12"
                            onClick={() => toast.info("Funcionalidad: Crear Cliente (Pendiente)")}
                        >
                            <Plus className="mr-2 h-4 w-4" /> Nuevo Cliente
                        </Button>

                        <div className="space-y-2 mt-2">
                            <h3 className="text-xs font-bold text-slate-500 uppercase">Resultados</h3>
                            {customers.map(cust => (
                                <div
                                    key={cust.id}
                                    className="p-4 bg-slate-900 border border-slate-800 rounded-xl active:scale-[0.98] transition-transform cursor-pointer flex justify-between items-center hover:border-emerald-500/50"
                                    onClick={() => {
                                        setSelectedCustomer(cust);
                                        setDeliveryAddress(cust.address || "");
                                        setStep('products');
                                    }}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-full bg-slate-800 flex items-center justify-center text-emerald-500 font-bold border border-slate-700">
                                            {cust.name.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-bold text-white">{cust.name}</p>
                                            <div className="flex items-center gap-1 text-xs text-slate-400">
                                                <MapPin className="h-3 w-3" />
                                                {cust.address || "Sin dirección registrada"}
                                            </div>
                                        </div>
                                    </div>
                                    <ArrowLeft className="h-4 w-4 text-emerald-500 rotate-180" />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Step 2: Product Selection */}
                {step === 'products' && (
                    <div className="space-y-4">
                        <div className="sticky top-0 pt-2 pb-4 bg-slate-950 z-10">
                            <div className="relative">
                                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                                <Input
                                    placeholder="Buscar productos..."
                                    className="bg-slate-900 border-slate-800 text-white pl-9"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="space-y-3">
                            {filteredProducts.map(prod => {
                                const inCart = cart.find(i => i.product.id === prod.id);
                                return (
                                    <div key={prod.id} className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between">
                                        <div className="flex-1">
                                            <p className="font-bold text-white text-sm">{prod.name}</p>
                                            <p className="text-emerald-400 font-bold text-sm">${prod.price}</p>
                                        </div>
                                        {inCart ? (
                                            <div className="flex items-center gap-3 bg-slate-800 rounded-lg p-1 border border-slate-700">
                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-white hover:text-red-400" onClick={() => updateQuantity(prod.id, -1)}>
                                                    <Minus className="h-4 w-4" />
                                                </Button>
                                                <span className="font-bold w-6 text-center text-white">{inCart.quantity}</span>
                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-white hover:text-emerald-400" onClick={() => updateQuantity(prod.id, 1)}>
                                                    <Plus className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ) : (
                                            <Button size="icon" className="h-9 w-9 bg-emerald-600 hover:bg-emerald-500 rounded-full shadow-lg shadow-emerald-900/20" onClick={() => addToCart(prod)}>
                                                <Plus className="h-5 w-5" />
                                            </Button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Step 3: Confirmation & Delivery Details */}
                {step === 'confirm' && (
                    <div className="space-y-6">
                        {/* Customer Summary */}
                        <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
                            <h3 className="text-xs font-bold text-slate-500 uppercase mb-3">Datos de Entrega</h3>
                            <div className="flex items-start gap-3 mb-4">
                                <UserIcon className="h-5 w-5 text-emerald-500 mt-0.5" />
                                <div>
                                    <p className="font-bold text-white">{selectedCustomer?.name}</p>
                                    <p className="text-sm text-slate-400">{selectedCustomer?.phone || "Sin teléfono"}</p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <Label className="text-xs text-slate-400">Dirección de Entrega</Label>
                                    <div className="flex gap-2 mt-1">
                                        <Input
                                            value={deliveryAddress}
                                            onChange={(e) => setDeliveryAddress(e.target.value)}
                                            className="bg-slate-950 border-slate-800 text-white"
                                            placeholder="Calle, número, depto..."
                                        />
                                        <Button size="icon" variant="outline" className="border-slate-800 bg-slate-900">
                                            <MapPin className="h-4 w-4 text-emerald-500" />
                                        </Button>
                                    </div>
                                </div>
                                <div>
                                    <Label className="text-xs text-slate-400">Notas para el Repartidor</Label>
                                    <Textarea
                                        value={deliveryNotes}
                                        onChange={(e) => setDeliveryNotes(e.target.value)}
                                        className="bg-slate-950 border-slate-800 text-white min-h-[60px] mt-1"
                                        placeholder="Ej: Timbre no funciona, dejar en portería..."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Payment Method */}
                        <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
                            <h3 className="text-xs font-bold text-slate-500 uppercase mb-3">Método de Pago</h3>
                            <div className="grid grid-cols-2 gap-2">
                                <Button
                                    variant={paymentMethod === 'cash' ? "default" : "outline"}
                                    onClick={() => setPaymentMethod('cash')}
                                    className={`justify-start ${paymentMethod === 'cash' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-slate-950 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'}`}
                                >
                                    <DollarSign className="mr-2 h-4 w-4" /> Efectivo
                                </Button>
                                <Button
                                    variant={paymentMethod === 'transfer' ? "default" : "outline"}
                                    onClick={() => setPaymentMethod('transfer')}
                                    className={`justify-start ${paymentMethod === 'transfer' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-slate-950 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'}`}
                                >
                                    <Wallet className="mr-2 h-4 w-4" /> Transferencia
                                </Button>
                                <Button
                                    variant={paymentMethod === 'credit' ? "default" : "outline"}
                                    onClick={() => setPaymentMethod('credit')}
                                    className={`justify-start ${paymentMethod === 'credit' ? 'bg-orange-600 hover:bg-orange-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'}`}
                                >
                                    <CreditCard className="mr-2 h-4 w-4" /> Fiado / Cta Cte
                                </Button>
                                <Button
                                    variant={paymentMethod === 'mp' ? "default" : "outline"}
                                    onClick={() => setPaymentMethod('mp')}
                                    className={`justify-start ${paymentMethod === 'mp' ? 'bg-blue-500 hover:bg-blue-400' : 'bg-slate-950 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'}`}
                                >
                                    <span className="font-bold mr-2">MP</span> MercadoPago
                                </Button>
                            </div>
                        </div>

                        {/* Order Summary */}
                        <div className="space-y-2">
                            <h3 className="text-xs font-bold text-slate-500 uppercase">Resumen del Pedido</h3>
                            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                                {cart.map((item, idx) => (
                                    <div key={item.product.id} className={`flex justify-between items-center p-3 ${idx !== cart.length - 1 ? 'border-b border-slate-800' : ''}`}>
                                        <div>
                                            <p className="text-white text-sm font-medium">{item.product.name}</p>
                                            <p className="text-xs text-slate-500">{item.quantity} x ${item.product.price}</p>
                                        </div>
                                        <p className="font-bold text-white text-sm">${item.quantity * item.product.price}</p>
                                    </div>
                                ))}
                                <div className="bg-slate-950 p-4 flex justify-between items-center border-t border-slate-800">
                                    <span className="text-slate-400">Total a Pagar</span>
                                    <span className="text-2xl font-bold text-emerald-400">${cartTotal}</span>
                                </div>
                            </div>
                        </div>

                        <Button
                            className="w-full h-14 text-lg font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-900/20 mb-8"
                            onClick={handleSubmitOrder}
                            disabled={loading}
                        >
                            {loading ? <Loader2 className="animate-spin mr-2" /> : <Bike className="mr-2" />}
                            Confirmar Pedido
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function OrderPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="animate-spin text-emerald-500" /></div>}>
            <OrderForm />
        </Suspense>
    );
}
