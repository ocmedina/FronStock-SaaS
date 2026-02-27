"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
    SearchBar,
    ProductGrid,
    Cart,
    PaymentPanel,
    QuickActions,
    StatusBar,
} from "@/components/sales/v2";
import { POSProductModal } from "@/components/sales/POSProductModal";
import { useSuspendedSales } from "@/hooks/useSuspendedSales";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import type { Product, Customer, CartItem } from "@/components/sales/types";

export default function POSPageV2() {
    const { organizationId, isLoading: orgLoading } = useOrganization();
    const [products, setProducts] = useState<Product[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);

    // Cart State
    const [cart, setCart] = useState<CartItem[]>([]);
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
    const [discount, setDiscount] = useState(0);
    const [surcharge, setSurcharge] = useState(0);

    // UI State
    const [showCatalog, setShowCatalog] = useState(false);
    const [showSuspended, setShowSuspended] = useState(false);

    // Suspended Sales
    const { suspendedSales, suspendSale, resumeSale, deleteSuspendedSale } = useSuspendedSales();

    const supabase = createClient();
    const searchRef = useRef<HTMLInputElement>(null);

    // Fetch Data
    const fetchData = useCallback(async () => {
        if (!organizationId) return;
        setIsLoading(true);

        const [productsRes, customersRes] = await Promise.all([
            supabase
                .from("products")
                .select("id, name, sku, barcode, plu, price, wholesale_price, stock")
                .eq("organization_id", organizationId)
                .gt("stock", 0)
                .order("name"),
            supabase
                .from("customers")
                .select("id, name, customer_type, service_type")
                .eq("organization_id", organizationId)
                .order("name"),
        ]);

        if (productsRes.data) setProducts(productsRes.data as Product[]);
        if (customersRes.data) {
            const counterCustomers = customersRes.data.filter(
                (c) => c.service_type === "counter" || c.service_type === "both"
            );
            setCustomers(counterCustomers);
            // Auto-select "Consumidor Final"
            const finalConsumer = counterCustomers.find((c) => c.name === "Consumidor Final");
            if (finalConsumer && !selectedCustomerId) {
                setSelectedCustomerId(finalConsumer.id);
            }
        }

        setIsLoading(false);
    }, [organizationId, supabase, selectedCustomerId]);

    useEffect(() => {
        if (organizationId) fetchData();
    }, [organizationId, fetchData]);

    // Cart Management
    const addToCart = (product: Product) => {
        const currentCustomer = customers.find((c) => c.id === selectedCustomerId);
        const isWholesale = currentCustomer?.customer_type === "wholesale";
        const productPrice = isWholesale ? product.wholesale_price || product.price : product.price;

        const existing = cart.find((item) => item.product.id === product.id);
        let newCart: CartItem[];

        if (existing) {
            if (existing.quantity < product.stock) {
                newCart = cart.map((item) =>
                    item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
                );
            } else {
                toast.error("Stock insuficiente");
                return;
            }
        } else {
            newCart = [
                ...cart,
                {
                    product: { ...product, price: productPrice },
                    quantity: 1,
                    discount: 0,
                },
            ];
        }

        setCart(newCart);
        toast.success(`${product.name} agregado`);
    };

    const updateQuantity = (productId: string, quantity: number) => {
        if (quantity <= 0) {
            setCart(cart.filter((item) => item.product.id !== productId));
        } else {
            const item = cart.find((i) => i.product.id === productId);
            if (item && quantity > item.product.stock) {
                toast.error("Stock insuficiente");
                return;
            }
            setCart(cart.map((item) => (item.product.id === productId ? { ...item, quantity } : item)));
        }
    };

    const removeFromCart = (productId: string) => {
        setCart(cart.filter((item) => item.product.id !== productId));
    };

    const clearCart = () => {
        setCart([]);
        setDiscount(0);
        setSurcharge(0);
    };

    // Customer Change
    const handleCustomerChange = (customerId: string | null) => {
        if (customerId === "default") customerId = null;

        const customer = customers.find((c) => c.id === customerId);
        const isWholesale = customer?.customer_type === "wholesale";

        const updatedCart = cart.map((item) => {
            const basePrice = isWholesale
                ? item.product.wholesale_price || item.product.price
                : item.product.price;

            return {
                ...item,
                product: {
                    ...item.product,
                    price: basePrice,
                },
            };
        });

        setSelectedCustomerId(customerId);
        setCart(updatedCart);
    };

    // Process Sale
    const processSale = async () => {
        if (cart.length === 0 || !organizationId) {
            toast.error("El carrito está vacío");
            return;
        }

        setIsProcessing(true);

        try {
            const items = cart.map((item) => ({
                product_id: item.product.id,
                product_name: item.product.name || "Sin nombre",
                quantity: item.quantity,
                unit_price: item.product.price ?? 0,
            }));

            const { data, error } = await supabase.rpc("process_sale", {
                p_org_id: organizationId,
                p_customer_id: selectedCustomerId || null,
                p_payments: [{ method: "cash", amount: total }],
                p_items: items,
                p_discount: discount || 0,
                p_surcharge: surcharge || 0,
            });

            if (error) throw error;

            const result = data as {
                success: boolean;
                sale_id?: string;
                sale_number?: number;
                error?: string;
                total?: number;
            };

            if (!result.success) {
                throw new Error(result.error || "Error al procesar la venta");
            }

            toast.success(`¡Venta #${result.sale_number} procesada exitosamente!`, {
                description: `Total: $${total.toLocaleString("es-AR")}`,
            });

            clearCart();
            fetchData();
        } catch (error: any) {
            console.error("Error processing sale:", error);
            toast.error(`Error: ${error.message || "Error desconocido"}`);
        } finally {
            setIsProcessing(false);
        }
    };

    // Suspend Sale
    const handleSuspendSale = () => {
        if (cart.length === 0) {
            toast.error("El carrito está vacío");
            return;
        }

        suspendSale({
            id: Date.now().toString(),
            name: `Venta ${Date.now()}`,
            cart,
            customerId: selectedCustomerId,
            payments: [],
            discount,
            surcharge,
        });

        clearCart();
        toast.success("Venta suspendida");
    };

    // Resume Sale
    const handleResumeSale = (id: string) => {
        const sale = resumeSale(id);
        if (sale) {
            setCart(sale.cart);
            setSelectedCustomerId(sale.customerId);
            setDiscount(sale.discount || 0);
            setSurcharge(sale.surcharge || 0);
            setShowSuspended(false);
            toast.success("Venta recuperada");
        }
    };

    // Keyboard Shortcuts
    useKeyboardShortcuts({
        shortcuts: [
            { key: "F1", description: "Buscar", action: () => searchRef.current?.focus() },
            { key: "F3", description: "Catálogo", action: () => setShowCatalog(true) },
            { key: "F8", description: "Suspender", action: handleSuspendSale, enabled: cart.length > 0 },
            {
                key: "F9",
                description: "Recuperar",
                action: () => setShowSuspended(true),
                enabled: suspendedSales.length > 0,
            },
            { key: "F12", description: "Cobrar", action: processSale, enabled: cart.length > 0 },
            {
                key: "Escape",
                description: "Limpiar",
                action: () => {
                    setShowCatalog(false);
                    setShowSuspended(false);
                },
            },
        ],
    });

    // Calculations
    const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const total = Math.max(0, subtotal - discount + surcharge);

    if (orgLoading || isLoading) {
        return (
            <div className="flex items-center justify-center h-[80vh]">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[100dvh] md:h-[100vh] -m-3 md:-m-6 bg-background">
            {/* Header */}
            <div className="h-16 border-b border-border bg-background px-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold">🏪 FrontStock POS</h1>
                    <span className="text-sm text-muted-foreground">v2.0</span>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex flex-1 min-h-0">
                {/* Left Column - Products */}
                <div className="flex-1 flex flex-col min-h-0 border-r border-border p-6 space-y-6">
                    <SearchBar products={products} onProductSelect={addToCart} />
                    <ProductGrid products={products} onProductSelect={addToCart} />
                </div>

                {/* Right Column - Cart & Payment */}
                <div className="w-[480px] flex flex-col min-h-0">
                    <div className="flex-1 min-h-0">
                        <Cart
                            items={cart}
                            onUpdateQuantity={updateQuantity}
                            onRemove={removeFromCart}
                            onClear={clearCart}
                            subtotal={subtotal}
                            totalItems={totalItems}
                        />
                    </div>
                    <div className="h-[500px] border-t border-border">
                        <PaymentPanel
                            customers={customers}
                            selectedCustomerId={selectedCustomerId}
                            subtotal={subtotal}
                            discount={discount}
                            surcharge={surcharge}
                            total={total}
                            onCustomerChange={handleCustomerChange}
                            onProcessSale={processSale}
                            processing={isProcessing}
                        />
                    </div>
                </div>
            </div>

            {/* Status Bar */}
            <StatusBar />

            {/* Quick Actions */}
            <QuickActions
                suspendedCount={suspendedSales.length}
                onSuspendedClick={() => setShowSuspended(true)}
                onCatalogClick={() => setShowCatalog(true)}
            />

            {/* Modals */}
            <POSProductModal
                open={showCatalog}
                onClose={() => setShowCatalog(false)}
                products={products}
                onSelect={addToCart}
            />
        </div>
    );
}
