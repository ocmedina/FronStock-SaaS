"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    ArrowLeft,
    Plus,
    Minus,
    Trash2,
    ShoppingCart,
    CreditCard,
    CheckCircle,
    Loader2,
    AlertTriangle,
    FileText,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { toast } from "sonner";

type Product = {
    id: string;
    name: string;
    price: number;
    stock: number;
    barcode: string | null;
};

type CartItem = {
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
};

function RouteSaleContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { organizationId } = useOrganization();
    const supabase = createClient();

    const routeStopId = searchParams.get("routeStopId");
    const customerId = searchParams.get("customerId");

    const [customer, setCustomer] = useState<any>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    
    const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "transfer">("cash");
    const [paymentStatus, setPaymentStatus] = useState<"paid" | "pending">("paid");
    const [searchTerm, setSearchTerm] = useState("");
    const [visitNotes, setVisitNotes] = useState("");

    // Signature
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasSignature, setHasSignature] = useState(false);

    useEffect(() => {
        if (!organizationId || !customerId) return;

        const fetchData = async () => {
            setLoading(true);

            // Cargar cliente
            const { data: customerData } = await supabase
                .from("customers")
                .select("*")
                .eq("id", customerId)
                .single();

            if (customerData) {
                setCustomer(customerData);
                // Si es negocio con crédito, permitir fiado por defecto
                if (customerData.credit_limit > 0) {
                    setPaymentStatus("pending");
                }
            }

            // Cargar productos
            const { data: productsData } = await supabase
                .from("products")
                .select("id, name, price, stock, barcode")
                .eq("organization_id", organizationId)
                .eq("is_active", true)
                .gt("stock", 0)
                .order("name");

            if (productsData) {
                setProducts(productsData);
            }

            setLoading(false);
        };

        fetchData();
    }, [organizationId, customerId]);

    // Signature handlers
    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        setIsDrawing(true);
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
        const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

        const ctx = canvas.getContext("2d");
        if (ctx) {
            ctx.beginPath();
            ctx.moveTo(x, y);
        }
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
        const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

        const ctx = canvas.getContext("2d");
        if (ctx) {
            ctx.lineTo(x, y);
            ctx.stroke();
        }
        setHasSignature(true);
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const clearSignature = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        setHasSignature(false);
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (ctx) {
            ctx.lineWidth = 2;
            ctx.lineCap = "round";
            ctx.strokeStyle = "#000";
        }
    }, []);

    const addToCart = (product: Product) => {
        const existing = cart.find((item) => item.product_id === product.id);
        if (existing) {
            if (existing.quantity >= product.stock) {
                toast.error(`Stock máximo: ${product.stock}`);
                return;
            }
            setCart(
                cart.map((item) =>
                    item.product_id === product.id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                )
            );
        } else {
            setCart([
                ...cart,
                {
                    product_id: product.id,
                    product_name: product.name,
                    quantity: 1,
                    unit_price: product.price,
                },
            ]);
        }
    };

    const updateQuantity = (productId: string, delta: number) => {
        const product = products.find((p) => p.id === productId);
        if (!product) return;

        setCart(
            cart
                .map((item) => {
                    if (item.product_id === productId) {
                        const newQty = item.quantity + delta;
                        if (newQty <= 0) return null;
                        if (newQty > product.stock) {
                            toast.error(`Stock máximo: ${product.stock}`);
                            return item;
                        }
                        return { ...item, quantity: newQty };
                    }
                    return item;
                })
                .filter(Boolean) as CartItem[]
        );
    };

    const removeFromCart = (productId: string) => {
        setCart(cart.filter((item) => item.product_id !== productId));
    };

    const subtotal = cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
    const total = subtotal;

    const filteredProducts = products.filter(
        (p) =>
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.barcode?.includes(searchTerm)
    );

    const handleConfirmSale = () => {
        if (cart.length === 0) {
            toast.error("Agregá productos al carrito");
            return;
        }
        setShowConfirm(true);
    };

    const processSale = async () => {
        if (!organizationId || !customerId) return;

        setProcessing(true);

        try {
            // Obtener firma en base64
            let signatureData = null;
            if (hasSignature && canvasRef.current) {
                signatureData = canvasRef.current.toDataURL("image/png");
            }

            // Llamar a la función RPC
            const { data, error } = await supabase.rpc("process_route_sale", {
                p_org_id: organizationId,
                p_customer_id: customerId,
                p_items: cart,
                p_route_id: null, // Se puede obtener del route_stop si es necesario
                p_route_stop_id: routeStopId,
                p_payment_method: paymentMethod,
                p_payment_status: paymentStatus,
                p_discount: 0,
                p_signature_url: null, // TODO: subir a storage si se necesita
                p_visit_notes: visitNotes || null,
                p_latitude: null, // TODO: obtener GPS
                p_longitude: null,
            });

            if (error) throw error;

            if (!data.success) {
                toast.error(data.error || "Error al procesar venta");
                setProcessing(false);
                return;
            }

            toast.success("Venta registrada exitosamente");
            
            // Redirigir a la ruta
            setTimeout(() => {
                router.push("/delivery/routes");
            }, 1000);
        } catch (err: any) {
            console.error("Error processing sale:", err);
            toast.error("Error: " + err.message);
            setProcessing(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-950">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        );
    }

    if (!customer) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
                <Card className="bg-slate-900 border-slate-800 p-6 text-center">
                    <p className="text-slate-400">Cliente no encontrado</p>
                    <Link href="/delivery/routes" className="mt-4 inline-block">
                        <Button variant="outline">Volver</Button>
                    </Link>
                </Card>
            </div>
        );
    }

    const availableCredit = customer.credit_limit + customer.balance;

    return (
        <div className="min-h-screen flex flex-col bg-slate-950">
            {/* Header */}
            <div className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur border-b border-slate-800 px-4 py-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/delivery/routes">
                            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-lg font-bold text-white">{customer.name}</h1>
                            {customer.business_type && (
                                <Badge variant="outline" className="text-xs border-slate-700">
                                    {customer.business_type}
                                </Badge>
                            )}
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-2xl font-bold text-white">${total.toLocaleString()}</div>
                        <div className="text-xs text-slate-400">{cart.length} items</div>
                    </div>
                </div>

                {/* Customer Info */}
                {customer.balance < 0 && (
                    <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                        <span className="text-sm text-red-400">
                            Debe: ${Math.abs(customer.balance).toLocaleString()}
                        </span>
                        {customer.credit_limit > 0 && (
                            <span className="text-xs text-slate-500 ml-auto">
                                Crédito disponible: ${availableCredit.toLocaleString()}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 pb-24">
                <Tabs defaultValue="products" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-4">
                        <TabsTrigger value="products">Productos</TabsTrigger>
                        <TabsTrigger value="cart">
                            Carrito {cart.length > 0 && `(${cart.length})`}
                        </TabsTrigger>
                    </TabsList>

                    {/* Products Tab */}
                    <TabsContent value="products" className="space-y-3">
                        <Input
                            placeholder="Buscar por nombre o código de barras..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-slate-900 border-slate-800"
                        />

                        {filteredProducts.map((product) => (
                            <Card
                                key={product.id}
                                className="bg-slate-900 border-slate-800 p-4 cursor-pointer hover:bg-slate-800 transition"
                                onClick={() => addToCart(product)}
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <h3 className="font-medium text-white">{product.name}</h3>
                                        <p className="text-sm text-slate-400">Stock: {product.stock}</p>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-lg font-bold text-emerald-400">
                                            ${product.price}
                                        </div>
                                        <Button size="sm" className="mt-2">
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        ))}

                        {filteredProducts.length === 0 && (
                            <div className="text-center text-slate-500 py-10">
                                No se encontraron productos
                            </div>
                        )}
                    </TabsContent>

                    {/* Cart Tab */}
                    <TabsContent value="cart" className="space-y-3">
                        {cart.length === 0 ? (
                            <div className="text-center text-slate-500 py-10">
                                <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                <p>Carrito vacío</p>
                            </div>
                        ) : (
                            cart.map((item) => (
                                <Card key={item.product_id} className="bg-slate-900 border-slate-800 p-4">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex-1">
                                            <h3 className="font-medium text-white">{item.product_name}</h3>
                                            <p className="text-sm text-slate-400">${item.unit_price} c/u</p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removeFromCart(item.product_id)}
                                            className="text-red-500 hover:text-red-400"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Button
                                                size="icon"
                                                variant="outline"
                                                onClick={() => updateQuantity(item.product_id, -1)}
                                                className="h-8 w-8"
                                            >
                                                <Minus className="h-4 w-4" />
                                            </Button>
                                            <span className="text-lg font-bold text-white w-12 text-center">
                                                {item.quantity}
                                            </span>
                                            <Button
                                                size="icon"
                                                variant="outline"
                                                onClick={() => updateQuantity(item.product_id, 1)}
                                                className="h-8 w-8"
                                            >
                                                <Plus className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        <div className="text-lg font-bold text-white">
                                            ${(item.unit_price * item.quantity).toLocaleString()}
                                        </div>
                                    </div>
                                </Card>
                            ))
                        )}
                    </TabsContent>
                </Tabs>
            </div>

            {/* Bottom Bar */}
            {cart.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-slate-400">Total:</span>
                        <span className="text-2xl font-bold text-white">${total.toLocaleString()}</span>
                    </div>

                    <Button
                        onClick={handleConfirmSale}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 text-lg"
                    >
                        <CheckCircle className="h-5 w-5 mr-2" />
                        Confirmar Venta
                    </Button>
                </div>
            )}

            {/* Confirmation Dialog */}
            <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
                <DialogContent className="bg-slate-900 border-slate-800 max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-white">Confirmar Venta</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        {/* Payment Method */}
                        <div>
                            <Label className="text-slate-400">Método de Pago</Label>
                            <Select value={paymentMethod} onValueChange={(v: any) => setPaymentMethod(v)}>
                                <SelectTrigger className="bg-slate-800 border-slate-700">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="cash">Efectivo</SelectItem>
                                    <SelectItem value="card">Tarjeta</SelectItem>
                                    <SelectItem value="transfer">Transferencia</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Payment Status */}
                        {customer.credit_limit > 0 && (
                            <div>
                                <Label className="text-slate-400">Estado de Pago</Label>
                                <Select value={paymentStatus} onValueChange={(v: any) => setPaymentStatus(v)}>
                                    <SelectTrigger className="bg-slate-800 border-slate-700">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="paid">Pagado (Contado)</SelectItem>
                                        <SelectItem value="pending">Fiado (Cuenta Corriente)</SelectItem>
                                    </SelectContent>
                                </Select>
                                {paymentStatus === "pending" && (
                                    <p className="text-xs text-slate-500 mt-1">
                                        Se agregará ${total.toLocaleString()} a la cuenta corriente
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Notes */}
                        <div>
                            <Label className="text-slate-400">Notas de Visita (Opcional)</Label>
                            <Input
                                value={visitNotes}
                                onChange={(e) => setVisitNotes(e.target.value)}
                                placeholder="Ej: Cliente pidió más stock para próxima semana"
                                className="bg-slate-800 border-slate-700"
                            />
                        </div>

                        {/* Signature */}
                        <div>
                            <Label className="text-slate-400 mb-2 block">Firma del Cliente</Label>
                            <div className="border-2 border-dashed border-slate-700 rounded-lg overflow-hidden bg-white">
                                <canvas
                                    ref={canvasRef}
                                    width={400}
                                    height={200}
                                    onMouseDown={startDrawing}
                                    onMouseMove={draw}
                                    onMouseUp={stopDrawing}
                                    onMouseLeave={stopDrawing}
                                    onTouchStart={startDrawing}
                                    onTouchMove={draw}
                                    onTouchEnd={stopDrawing}
                                    className="w-full cursor-crosshair"
                                />
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={clearSignature}
                                className="mt-2 text-slate-400"
                            >
                                Limpiar Firma
                            </Button>
                        </div>

                        {/* Summary */}
                        <Card className="bg-slate-800 border-slate-700 p-4">
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Subtotal:</span>
                                    <span className="text-white font-medium">${subtotal.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-lg font-bold pt-2 border-t border-slate-700">
                                    <span className="text-white">Total:</span>
                                    <span className="text-emerald-400">${total.toLocaleString()}</span>
                                </div>
                            </div>
                        </Card>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setShowConfirm(false)}
                            disabled={processing}
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={processSale}
                            disabled={processing}
                            className="bg-emerald-600 hover:bg-emerald-700"
                        >
                            {processing ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Procesando...
                                </>
                            ) : (
                                <>
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Confirmar Venta
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default function RouteSalePage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-slate-950">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        }>
            <RouteSaleContent />
        </Suspense>
    );
}
