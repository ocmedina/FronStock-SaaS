"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useOfflineOrders } from "@/hooks/useOfflineOrders";
import { offlineDB } from "@/lib/offline/db";
import { ensureOpenCashSession, shouldRequireOpenCashSession } from "@/lib/cash-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, User, MapPin, Phone, Package, Trash2, Save, Keyboard, ChevronLeft, ChevronRight, CheckCircle2, Truck, CircleDollarSign } from "lucide-react";
import { toast } from "sonner";
import { nanoid } from "nanoid";

interface OrderItem {
    product_id: string;
    product_name: string;
    unit_price: number;
    quantity: number;
    stock: number;
}

interface NewOrderFormProps {
    onSuccess?: (orderId: string) => void;
    redirectAfterCreate?: boolean;
    className?: string;
    mode?: "default" | "delivery";
}

type QuickCustomer = {
    id: string;
    name: string;
    phone?: string | null;
    address?: string | null;
};

type QuickProduct = {
    id: string;
    name: string;
    price: number;
    stock: number;
};

const RECENT_CUSTOMERS_KEY = "delivery_recent_customers";
const RECENT_PRODUCTS_KEY = "delivery_recent_products";
const DELIVERY_FEE_PRESETS = [
    { id: "free", label: "Sin costo", value: 0 },
    { id: "flat", label: "Tarifa fija", value: 1500 },
    { id: "zone", label: "Tarifa por zona", value: 2500 },
] as const;

export function NewOrderForm({ onSuccess, redirectAfterCreate = true, className = "", mode = "default" }: NewOrderFormProps) {
    const router = useRouter();
    const { organizationId, organization, profile } = useOrganization();
    const { isOnline } = useOnlineStatus();
    const { saveOrderOffline } = useOfflineOrders(organizationId);
    const supabase = createClient();
    const isDeliveryMode = mode === "delivery";

    // Form State
    const [customer, setCustomer] = useState<any>(null);
    const [items, setItems] = useState<OrderItem[]>([]);
    const [deliveryFee, setDeliveryFee] = useState(0);
    const [estimatedMins, setEstimatedMins] = useState(30);
    const [deliveryNotes, setDeliveryNotes] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("cash");
    const [collectNow, setCollectNow] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState("");
    const [discountType, setDiscountType] = useState<"none" | "percentage" | "fixed">("none");
    const [discountValue, setDiscountValue] = useState(0);
    const [loading, setLoading] = useState(false);
    const [currentStep, setCurrentStep] = useState(1);
    const [showDeliverySuccess, setShowDeliverySuccess] = useState(false);
    const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);

    // Product Search
    const [searchTerm, setSearchTerm] = useState("");
    const [products, setProducts] = useState<any[]>([]);
    const [showProductSearch, setShowProductSearch] = useState(false);
    const [selectedProductIndex, setSelectedProductIndex] = useState(0);

    // Customer Search
    const [customerSearch, setCustomerSearch] = useState("");
    const [customers, setCustomers] = useState<any[]>([]);
    const [showCustomerSearch, setShowCustomerSearch] = useState(false);
    const [selectedCustomerIndex, setSelectedCustomerIndex] = useState(0);

    // Quick shortcuts for delivery mode
    const [recentCustomers, setRecentCustomers] = useState<QuickCustomer[]>([]);
    const [recentProducts, setRecentProducts] = useState<QuickProduct[]>([]);

    // Refs
    const customerSearchRef = useRef<HTMLInputElement>(null);
    const productSearchRef = useRef<HTMLInputElement>(null);

    // Calculations
    const subtotal = items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
    const discountAmount = discountType === "percentage"
        ? (subtotal * discountValue / 100)
        : discountType === "fixed"
            ? discountValue
            : 0;
    const total = subtotal - discountAmount + deliveryFee;
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    const paidAmount = isDeliveryMode && collectNow ? (parseFloat(paymentAmount) || 0) : 0;
    const pendingAmount = isDeliveryMode ? Math.max(total - paidAmount, 0) : 0;
    const changeAmount = isDeliveryMode && collectNow ? Math.max(paidAmount - total, 0) : 0;
    const steps = isDeliveryMode
        ? [
            { id: 1, title: "Pedido" },
            { id: 2, title: "Cobro" },
        ]
        : [
            { id: 1, title: "Cliente" },
            { id: 2, title: "Productos" },
            { id: 3, title: "Entrega" },
            { id: 4, title: "Pago y Confirmación" },
        ];

    const maxStep = steps.length;
    const effectivePaymentMethod = isDeliveryMode ? (collectNow ? "cash" : "credit") : paymentMethod;
    const canConfirmDeliveryOrder = !!customer && items.length > 0 && (!collectNow || paidAmount >= total);

    useEffect(() => {
        if (!isDeliveryMode) return;
        try {
            const customersRaw = localStorage.getItem(RECENT_CUSTOMERS_KEY);
            const productsRaw = localStorage.getItem(RECENT_PRODUCTS_KEY);

            const parsedCustomers = customersRaw ? JSON.parse(customersRaw) : [];
            const parsedProducts = productsRaw ? JSON.parse(productsRaw) : [];

            setRecentCustomers(Array.isArray(parsedCustomers) ? parsedCustomers : []);
            setRecentProducts(Array.isArray(parsedProducts) ? parsedProducts : []);
        } catch {
            setRecentCustomers([]);
            setRecentProducts([]);
        }
    }, [isDeliveryMode]);

    const persistRecentCustomer = (cust: any) => {
        if (!isDeliveryMode || !cust?.id) return;

        const next: QuickCustomer = {
            id: String(cust.id),
            name: String(cust.name || "Cliente"),
            phone: cust.phone || null,
            address: cust.address || null,
        };

        setRecentCustomers((prev) => {
            const deduped = [next, ...prev.filter((item) => item.id !== next.id)].slice(0, 8);
            localStorage.setItem(RECENT_CUSTOMERS_KEY, JSON.stringify(deduped));
            return deduped;
        });
    };

    const persistRecentProduct = (product: any) => {
        if (!isDeliveryMode || !product?.id) return;

        const next: QuickProduct = {
            id: String(product.id),
            name: String(product.name || "Producto"),
            price: Number(product.price || 0),
            stock: Number(product.stock || 0),
        };

        setRecentProducts((prev) => {
            const deduped = [next, ...prev.filter((item) => item.id !== next.id)].slice(0, 8);
            localStorage.setItem(RECENT_PRODUCTS_KEY, JSON.stringify(deduped));
            return deduped;
        });
    };

    // Search Products
    useEffect(() => {
        if (searchTerm.length >= 2) {
            searchProducts();
        } else {
            setProducts([]);
        }
    }, [searchTerm]);

    const searchProducts = async () => {
        if (!organizationId) {
            setProducts([]);
            return;
        }

        const queryText = searchTerm.trim().toLowerCase();
        if (!queryText) {
            setProducts([]);
            return;
        }

        const loadProductsFromOfflineCache = async () => {
            const cached = await offlineDB.products
                .where('organization_id')
                .equals(organizationId)
                .toArray();

            const filtered = cached
                .filter((p: any) => p.stock > 0)
                .filter((p: any) => (p.name || '').toLowerCase().includes(queryText))
                .slice(0, 10)
                .map((p: any) => ({
                    id: p.id,
                    name: p.name,
                    price: p.price,
                    stock: p.stock,
                }));

            setProducts(filtered);
        };

        if (!isOnline) {
            await loadProductsFromOfflineCache();
            return;
        }

        try {
            const { data } = await supabase
                .from('products')
                .select('id, name, price, stock')
                .eq('organization_id', organizationId)
                .ilike('name', `%${searchTerm}%`)
                .gt('stock', 0)
                .limit(10);

            if (data) {
                setProducts(data);
                return;
            }
        } catch {
            await loadProductsFromOfflineCache();
            return;
        }

        await loadProductsFromOfflineCache();
    };

    // Search Customers
    useEffect(() => {
        if (customerSearch.length >= 2) {
            searchCustomers();
        } else {
            setCustomers([]);
        }
    }, [customerSearch]);

    const searchCustomers = async () => {
        if (!organizationId) {
            setCustomers([]);
            return;
        }

        const queryText = customerSearch.trim().toLowerCase();
        if (!queryText) {
            setCustomers([]);
            return;
        }

        const loadCustomersFromOfflineCache = async () => {
            const cached = await offlineDB.customers
                .where('organization_id')
                .equals(organizationId)
                .toArray();

            const filtered = cached
                .filter((c: any) => {
                    const name = (c.name || '').toLowerCase();
                    const phone = (c.phone || '').toLowerCase();
                    const matchesText = name.includes(queryText) || phone.includes(queryText);
                    const serviceType = c.service_type || "";
                    const matchesChannel = serviceType === "delivery" || serviceType === "both";
                    return matchesText && matchesChannel;
                })
                .slice(0, 10);

            setCustomers(filtered);
        };

        if (!isOnline) {
            await loadCustomersFromOfflineCache();
            return;
        }

        try {
            const { data } = await supabase
                .from('customers')
                .select('*')
                .eq('organization_id', organizationId)
                .or(`name.ilike.%${customerSearch}%,phone.ilike.%${customerSearch}%`)
                .limit(10);

            if (data) {
                setCustomers(
                    data.filter((c: any) => c.service_type === "delivery" || c.service_type === "both")
                );
                return;
            }
        } catch {
            await loadCustomersFromOfflineCache();
            return;
        }

        await loadCustomersFromOfflineCache();
    };

    const addProduct = (product: any) => {
        const existing = items.find(i => i.product_id === product.id);
        if (existing) {
            updateQuantity(product.id, existing.quantity + 1);
        } else {
            setItems([...items, {
                product_id: product.id,
                product_name: product.name,
                unit_price: product.price,
                quantity: 1,
                stock: product.stock
            }]);
        }
        persistRecentProduct(product);
        setSearchTerm("");
        setProducts([]);
        setShowProductSearch(false);
    };

    const updateQuantity = (productId: string, newQuantity: number) => {
        const item = items.find(i => i.product_id === productId);
        if (!item) return;

        if (newQuantity <= 0) {
            removeItem(productId);
            return;
        }

        if (newQuantity > item.stock) {
            toast.error(`Stock disponible: ${item.stock}`);
            return;
        }

        setItems(items.map(i =>
            i.product_id === productId ? { ...i, quantity: newQuantity } : i
        ));
    };

    const removeItem = (productId: string) => {
        setItems(items.filter(i => i.product_id !== productId));
    };

    const selectCustomer = (cust: any) => {
        setCustomer(cust);
        persistRecentCustomer(cust);
        setCustomerSearch("");
        setCustomers([]);
        setShowCustomerSearch(false);
    };

    const handleReset = (showToast = true) => {
        setCustomer(null);
        setItems([]);
        setDeliveryFee(0);
        setEstimatedMins(30);
        setDeliveryNotes("");
        setPaymentMethod("cash");
        setCollectNow(false);
        setPaymentAmount("");
        setDiscountType("none");
        setDiscountValue(0);
        setCurrentStep(1);
        setShowDeliverySuccess(false);
        setCreatedOrderId(null);
        if (showToast) {
            toast.success("Formulario limpiado");
        }
        customerSearchRef.current?.focus();
    };

    const validateCurrentStep = () => {
        if (isDeliveryMode) {
            if (currentStep === 1) {
                if (!customer) {
                    toast.error("Selecciona un cliente para continuar");
                    return false;
                }

                if (items.length === 0) {
                    toast.error("Agrega al menos un producto para continuar");
                    return false;
                }
            }

            return true;
        }

        if (currentStep === 1 && !customer) {
            toast.error("Selecciona un cliente para continuar");
            return false;
        }

        if (currentStep === 2 && items.length === 0) {
            toast.error("Agrega al menos un producto para continuar");
            return false;
        }

        return true;
    };

    const goToNextStep = () => {
        if (!validateCurrentStep()) return;
        setCurrentStep((prev) => Math.min(prev + 1, maxStep));
    };

    const goToPrevStep = () => {
        setCurrentStep((prev) => Math.max(prev - 1, 1));
    };

    // Keyboard shortcuts
    useEffect(() => {
        if (isDeliveryMode) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Ctrl/Cmd + S to submit
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (customer && items.length > 0 && !loading) {
                    handleSubmit();
                }
            }
            // Ctrl/Cmd + K to focus customer search
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                customerSearchRef.current?.focus();
            }
            // Ctrl/Cmd + P to focus product search
            if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
                e.preventDefault();
                productSearchRef.current?.focus();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [customer, items, loading, isDeliveryMode]);

    // Handle keyboard navigation in customer dropdown
    const handleCustomerKeyDown = (e: React.KeyboardEvent) => {
        if (!showCustomerSearch || customers.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedCustomerIndex((prev) =>
                prev < customers.length - 1 ? prev + 1 : prev
            );
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedCustomerIndex((prev) => prev > 0 ? prev - 1 : 0);
        } else if (e.key === 'Enter' && customers[selectedCustomerIndex]) {
            e.preventDefault();
            selectCustomer(customers[selectedCustomerIndex]);
        } else if (e.key === 'Escape') {
            setShowCustomerSearch(false);
        }
    };

    // Handle keyboard navigation in product dropdown
    const handleProductKeyDown = (e: React.KeyboardEvent) => {
        if (!showProductSearch || products.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedProductIndex((prev) =>
                prev < products.length - 1 ? prev + 1 : prev
            );
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedProductIndex((prev) => prev > 0 ? prev - 1 : 0);
        } else if (e.key === 'Enter' && products[selectedProductIndex]) {
            e.preventDefault();
            addProduct(products[selectedProductIndex]);
        } else if (e.key === 'Escape') {
            setShowProductSearch(false);
        }
    };

    // Reset selected index when results change
    useEffect(() => {
        setSelectedCustomerIndex(0);
    }, [customers]);

    useEffect(() => {
        setSelectedProductIndex(0);
    }, [products]);

    const handleSubmit = async () => {
        // Validations
        if (!customer) {
            toast.error("Selecciona un cliente");
            return;
        }

        if (items.length === 0) {
            toast.error("Agrega al menos un producto");
            return;
        }

        if (isDeliveryMode && collectNow && paidAmount < total) {
            toast.error("El monto recibido no cubre el total del pedido");
            return;
        }

        setLoading(true);

        try {
            const clientReference = `online_order_${Date.now()}_${nanoid(8)}`;
            const payload = {
                p_org_id: organizationId,
                p_customer_id: customer.id,
                p_payment_method: effectivePaymentMethod,
                p_items: items.map(i => ({
                    product_id: i.product_id,
                    product_name: i.product_name,
                    quantity: i.quantity,
                    unit_price: i.unit_price
                })),
                p_delivery_address: customer.address,
                p_delivery_notes: deliveryNotes,
                p_estimated_mins: estimatedMins,
                p_delivery_fee: deliveryFee,
                p_discount: discountAmount,
                p_payment_amount: isDeliveryMode && collectNow ? paidAmount : null,
                p_client_reference: clientReference
            };

            if (!isOnline) {
                const localOrderId = await saveOrderOffline(payload as any);
                toast.success("Pedido guardado offline. Se sincronizará al reconectar.");

                if (onSuccess) {
                    onSuccess(localOrderId);
                }

                if (isDeliveryMode) {
                    setCreatedOrderId(localOrderId);
                    setShowDeliverySuccess(true);
                    return;
                }

                handleReset(false);

                if (redirectAfterCreate) {
                    router.push('/dashboard/orders');
                }

                return;
            }

            const requiresOpenSession = shouldRequireOpenCashSession({
                organization,
                profile,
                paymentMethods: [effectivePaymentMethod],
            });

            if (requiresOpenSession) {
                const hasOpenSession = await ensureOpenCashSession(supabase, organizationId);
                if (!hasOpenSession) {
                    return;
                }
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

            if (error) throw error;

            if (!data.success) {
                throw new Error(data.error || "Error al crear pedido");
            }

            toast.success("Pedido creado exitosamente");

            if (onSuccess) {
                onSuccess(data.order_id);
            }

            if (isDeliveryMode) {
                setCreatedOrderId(data.order_id ?? null);
                setShowDeliverySuccess(true);
                return;
            }

            handleReset(false);

            if (redirectAfterCreate) {
                router.push('/dashboard/orders');
            }
        } catch (e: any) {
            toast.error("Error: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    if (isDeliveryMode && showDeliverySuccess) {
        return (
            <div className={`space-y-4 ${className}`}>
                <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
                    <div className="flex items-start gap-3">
                        <CheckCircle2 className="mt-0.5 h-6 w-6 text-emerald-400" aria-hidden="true" />
                        <div>
                            <h2 className="text-lg font-semibold text-foreground">Pedido confirmado</h2>
                            <p className="mt-1 text-sm text-muted-foreground">El pedido se registró correctamente y ya está listo para seguimiento.</p>
                            {createdOrderId && (
                                <p className="mt-2 text-xs text-emerald-300">ID: {createdOrderId}</p>
                            )}
                        </div>
                    </div>
                </section>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Button
                        type="button"
                        className="h-11 bg-slate-800 text-slate-100 hover:bg-slate-700"
                        onClick={() => router.push('/delivery/orders')}
                    >
                        Ver pedidos
                    </Button>
                    <Button
                        type="button"
                        className="h-11 bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                        onClick={() => handleReset(false)}
                    >
                        Crear otro
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className={`space-y-6 ${isDeliveryMode ? "pb-24" : ""} ${className}`} role="form" aria-label="Formulario de nuevo pedido">
            {!isDeliveryMode && (
                <div className="bg-card/60 border border-border rounded-lg p-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2 mb-2">
                        <Keyboard className="h-3.5 w-3.5" />
                        <span className="font-semibold text-foreground">Atajos de teclado:</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <div><kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Ctrl+K</kbd> Buscar cliente</div>
                        <div><kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Ctrl+P</kbd> Buscar producto</div>
                        <div><kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Ctrl+S</kbd> Crear pedido</div>
                    </div>
                </div>
            )}

            <section className="bg-card border border-border rounded-xl p-4 md:p-6" aria-label="Progreso de creación">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base md:text-lg font-semibold text-foreground">
                        {isDeliveryMode ? "Toma rapida de pedido" : "Nuevo pedido guiado"}
                    </h2>
                    <span className="text-xs text-muted-foreground">Paso {currentStep} de {steps.length}</span>
                </div>
                <div className={`grid gap-2 mb-4 ${isDeliveryMode ? "grid-cols-2" : "grid-cols-2 md:grid-cols-4"}`}>
                    {steps.map((step) => {
                        const isDone = currentStep > step.id;
                        const isActive = currentStep === step.id;

                        return (
                            <button
                                key={step.id}
                                type="button"
                                onClick={() => {
                                    if (step.id <= currentStep) setCurrentStep(step.id);
                                }}
                                className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                                    isActive
                                        ? "border-emerald-500 bg-emerald-500/10"
                                        : isDone
                                            ? "border-border bg-muted/40"
                                            : "border-border bg-muted/20"
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    {isDone ? (
                                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                                    ) : (
                                        <span className={`text-xs font-semibold ${isActive ? "text-emerald-500" : "text-muted-foreground"}`}>
                                            {step.id}
                                        </span>
                                    )}
                                    <span className={`text-sm font-medium ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                                        {step.title}
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div
                        className="h-full bg-emerald-500 transition-all"
                        style={{ width: `${(currentStep / steps.length) * 100}%` }}
                    />
                </div>
            </section>

            {/* Customer Selection */}
            {currentStep === 1 && (
            <section className="bg-card border border-border rounded-xl p-4 md:p-6" aria-labelledby="customer-section">
                <h2 id="customer-section" className="text-base md:text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                    <User className="h-5 w-5 text-emerald-500" aria-hidden="true" />
                    Cliente
                </h2>
                {isDeliveryMode && (
                    <p className="mb-3 text-xs text-muted-foreground">
                        Selecciona cliente y luego carga productos para pasar al cobro.
                    </p>
                )}

                {!customer ? (
                    <div className="relative">
                        <label htmlFor="customer-search" className="sr-only">Buscar cliente</label>
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        <Input
                            id="customer-search"
                            ref={customerSearchRef}
                            placeholder="Buscar cliente por nombre o teléfono..."
                            className="pl-9"
                            value={customerSearch}
                            onChange={(e) => {
                                setCustomerSearch(e.target.value);
                                setShowCustomerSearch(true);
                            }}
                            onFocus={() => setShowCustomerSearch(true)}
                            onKeyDown={handleCustomerKeyDown}
                            aria-autocomplete="list"
                            aria-controls="customer-results"
                            aria-expanded={showCustomerSearch && customers.length > 0}
                            aria-activedescendant={showCustomerSearch && customers.length > 0 ? `customer-${selectedCustomerIndex}` : undefined}
                            autoComplete="off"
                        />
                        {showCustomerSearch && customers.length > 0 && (
                            <ul
                                id="customer-results"
                                role="listbox"
                                aria-label="Resultados de búsqueda de clientes"
                                className="absolute z-10 w-full mt-2 bg-popover border border-border rounded-lg shadow-xl max-h-60 overflow-y-auto"
                            >
                                {customers.map((cust, index) => (
                                    <li
                                        key={cust.id}
                                        id={`customer-${index}`}
                                        role="option"
                                        aria-selected={index === selectedCustomerIndex}
                                        className={`w-full text-left px-4 py-3 hover:bg-accent transition-colors border-b border-border last:border-0 cursor-pointer ${index === selectedCustomerIndex ? 'bg-accent' : ''
                                            }`}
                                        onClick={() => selectCustomer(cust)}
                                    >
                                        <p className="text-foreground font-medium">{cust.name}</p>
                                        <p className="text-muted-foreground text-sm">{cust.phone}</p>
                                        {cust.address && (
                                            <p className="text-muted-foreground text-xs mt-1">{cust.address}</p>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                ) : (
                    <div className="bg-muted/30 border border-border rounded-lg p-4" role="region" aria-label="Cliente seleccionado">
                        <div className="flex items-start justify-between">
                            <div className="space-y-2 flex-1">
                                <div className="flex items-center gap-2">
                                    <User className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                                    <span className="text-foreground font-semibold">{customer.name}</span>
                                </div>
                                {customer.phone && (
                                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                                        <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                                        <span>{customer.phone}</span>
                                    </div>
                                )}
                                {customer.address && (
                                    <div className="flex items-start gap-2 text-muted-foreground text-sm">
                                        <MapPin className="h-3.5 w-3.5 mt-0.5" aria-hidden="true" />
                                        <span>{customer.address}</span>
                                    </div>
                                )}
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setCustomer(null)}
                                aria-label="Cambiar cliente seleccionado"
                            >
                                Cambiar
                            </Button>
                        </div>
                    </div>
                )}

                {isDeliveryMode && !customer && customerSearch.length < 2 && recentCustomers.length > 0 && (
                    <div className="mt-3">
                        <p className="mb-2 text-xs font-medium text-muted-foreground">Recientes</p>
                        <div className="flex flex-wrap gap-2">
                            {recentCustomers.map((cust) => (
                                <button
                                    key={cust.id}
                                    type="button"
                                    onClick={() => selectCustomer(cust)}
                                    className="rounded-full border border-border bg-muted/30 px-3 py-1.5 text-xs text-foreground hover:bg-muted/50"
                                >
                                    {cust.name}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {!isDeliveryMode && (
                    <div className="flex justify-end mt-6">
                        <Button
                            type="button"
                            className="bg-emerald-600 hover:bg-emerald-500 text-white"
                            onClick={goToNextStep}
                        >
                            Siguiente
                            <ChevronRight className="h-4 w-4 ml-2" />
                        </Button>
                    </div>
                )}
            </section>
            )}

            {/* Products */}
            {((!isDeliveryMode && currentStep === 2) || (isDeliveryMode && currentStep === 1)) && (
            <section className="bg-card border border-border rounded-xl p-4 md:p-6" aria-labelledby="products-section">
                <h2 id="products-section" className="text-base md:text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Package className="h-5 w-5 text-emerald-500" aria-hidden="true" />
                    Productos
                </h2>
                {isDeliveryMode && (
                    <p className="mb-3 text-xs text-muted-foreground">Carga rapida: toca un producto para agregarlo y ajusta cantidades abajo.</p>
                )}

                {/* Product Search */}
                <div className="relative mb-4">
                    <label htmlFor="product-search" className="sr-only">Buscar producto</label>
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <Input
                        id="product-search"
                        ref={productSearchRef}
                        placeholder="Buscar producto..."
                        className="pl-9"
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setShowProductSearch(true);
                        }}
                        onFocus={() => setShowProductSearch(true)}
                        onKeyDown={handleProductKeyDown}
                        aria-autocomplete="list"
                        aria-controls="product-results"
                        aria-expanded={showProductSearch && products.length > 0}
                        aria-activedescendant={showProductSearch && products.length > 0 ? `product-${selectedProductIndex}` : undefined}
                        autoComplete="off"
                    />
                    {showProductSearch && products.length > 0 && (
                        <ul
                            id="product-results"
                            role="listbox"
                            aria-label="Resultados de búsqueda de productos"
                            className="absolute z-10 w-full mt-2 bg-popover border border-border rounded-lg shadow-xl max-h-60 overflow-y-auto"
                        >
                            {products.map((prod, index) => (
                                <li
                                    key={prod.id}
                                    id={`product-${index}`}
                                    role="option"
                                    aria-selected={index === selectedProductIndex}
                                    className={`w-full text-left px-4 py-3 hover:bg-accent transition-colors border-b border-border last:border-0 flex items-center justify-between cursor-pointer ${index === selectedProductIndex ? 'bg-accent' : ''
                                        }`}
                                    onClick={() => addProduct(prod)}
                                >
                                    <div>
                                        <p className="text-foreground font-medium">{prod.name}</p>
                                        <p className="text-muted-foreground text-sm">Stock: {prod.stock}</p>
                                    </div>
                                    <span className="text-emerald-400 font-mono font-semibold">
                                        ${prod.price.toLocaleString()}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {isDeliveryMode && searchTerm.length < 2 && recentProducts.length > 0 && (
                    <div className="mb-4">
                        <p className="mb-2 text-xs font-medium text-muted-foreground">Productos recientes</p>
                        <div className="flex flex-wrap gap-2">
                            {recentProducts.map((prod) => (
                                <button
                                    key={prod.id}
                                    type="button"
                                    onClick={() => addProduct(prod)}
                                    className="rounded-full border border-border bg-muted/30 px-3 py-1.5 text-xs text-foreground hover:bg-muted/50"
                                >
                                    {prod.name}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Items Table */}
                {items.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed border-border rounded-lg" role="status" aria-label="No hay productos">
                        <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" aria-hidden="true" />
                        <p className="text-muted-foreground">No hay productos agregados</p>
                        <p className="text-muted-foreground text-sm mt-1">Busca y agrega productos al pedido</p>
                    </div>
                ) : isDeliveryMode ? (
                    <div className="space-y-2">
                        {items.map((item) => (
                            <div key={item.product_id} className="rounded-lg border border-border bg-muted/20 p-3">
                                <div className="mb-2 flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-foreground">{item.product_name}</p>
                                        <p className="text-xs text-muted-foreground">Stock: {item.stock} · ${item.unit_price.toLocaleString()} c/u</p>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 w-7 p-0 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                                        onClick={() => removeItem(item.product_id)}
                                        aria-label={`Eliminar ${item.product_name} del pedido`}
                                    >
                                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                                    </Button>
                                </div>

                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-8 w-8 p-0"
                                            onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                                        >
                                            -
                                        </Button>
                                        <Input
                                            type="number"
                                            className="h-8 w-14 text-center text-sm"
                                            value={item.quantity}
                                            onChange={(e) => updateQuantity(item.product_id, parseInt(e.target.value) || 0)}
                                            min="0"
                                            max={item.stock}
                                        />
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-8 w-8 p-0"
                                            onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                                        >
                                            +
                                        </Button>
                                    </div>
                                    <span className="font-mono text-sm font-bold text-emerald-400">
                                        ${(item.unit_price * item.quantity).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="border border-border rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full" role="table" aria-label="Productos en el pedido">
                                <thead className="bg-muted/20 border-b border-border">
                                    <tr>
                                        <th scope="col" className="text-left p-3 text-muted-foreground font-medium text-sm">Producto</th>
                                        <th scope="col" className="text-right p-3 text-muted-foreground font-medium text-sm hidden md:table-cell">Precio</th>
                                        <th scope="col" className="text-center p-3 text-muted-foreground font-medium text-sm">Cant.</th>
                                        <th scope="col" className="text-right p-3 text-muted-foreground font-medium text-sm">Subtotal</th>
                                        <th scope="col" className="w-12"><span className="sr-only">Acciones</span></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {items.map((item) => (
                                        <tr key={item.product_id} className="hover:bg-muted/20">
                                            <td className="p-3">
                                                <p className="text-foreground font-medium text-sm md:text-base">{item.product_name}</p>
                                                <p className="text-muted-foreground text-xs">Stock: {item.stock}</p>
                                            </td>
                                            <td className="p-3 text-right text-muted-foreground font-mono text-sm hidden md:table-cell">
                                                ${item.unit_price.toLocaleString()}
                                            </td>
                                            <td className="p-3">
                                                <div className="flex items-center justify-center gap-1 md:gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-7 w-7 md:h-8 md:w-8 p-0 text-xs"
                                                        onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                                                        aria-label={`Disminuir cantidad de ${item.product_name}`}
                                                    >
                                                        -
                                                    </Button>
                                                    <Input
                                                        type="number"
                                                        className="w-12 md:w-16 h-7 md:h-8 text-center text-sm"
                                                        value={item.quantity}
                                                        onChange={(e) => updateQuantity(item.product_id, parseInt(e.target.value) || 0)}
                                                        aria-label={`Cantidad de ${item.product_name}`}
                                                        min="0"
                                                        max={item.stock}
                                                    />
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-7 w-7 md:h-8 md:w-8 p-0 text-xs"
                                                        onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                                                        aria-label={`Aumentar cantidad de ${item.product_name}`}
                                                    >
                                                        +
                                                    </Button>
                                                </div>
                                            </td>
                                            <td className="p-3 text-right text-emerald-400 font-mono font-semibold text-sm md:text-base">
                                                ${(item.unit_price * item.quantity).toLocaleString()}
                                            </td>
                                            <td className="p-3">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7 w-7 p-0"
                                                    onClick={() => removeItem(item.product_id)}
                                                    aria-label={`Eliminar ${item.product_name} del pedido`}
                                                >
                                                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {!isDeliveryMode && (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mt-6 gap-3">
                        <Button type="button" variant="outline" onClick={goToPrevStep}>
                            <ChevronLeft className="h-4 w-4 mr-2" />
                            Anterior
                        </Button>
                        <div className="text-xs text-muted-foreground">
                            {totalItems} producto(s) · Subtotal ${subtotal.toLocaleString()}
                        </div>
                        <Button
                            type="button"
                            className="bg-emerald-600 hover:bg-emerald-500 text-white"
                            onClick={goToNextStep}
                        >
                            Siguiente
                            <ChevronRight className="h-4 w-4 ml-2" />
                        </Button>
                    </div>
                )}
            </section>
            )}

            {/* Summary & Actions */}
            {((!isDeliveryMode && currentStep === 3) || (isDeliveryMode && currentStep === 2)) && (
            <section className="bg-card border border-border rounded-xl p-4 md:p-6" aria-labelledby="delivery-section">
                <h2 id="delivery-section" className="text-base md:text-lg font-semibold text-foreground mb-4">Entrega</h2>

                <div className="space-y-4">
                    <div className="bg-muted/30 border border-border rounded-lg p-3 text-sm">
                        <p className="text-muted-foreground">Cliente seleccionado</p>
                        <p className="text-foreground font-medium">{customer?.name || "Sin cliente"}</p>
                        <p className="text-muted-foreground text-xs mt-1">{customer?.address || "Sin dirección cargada"}</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label htmlFor="delivery-fee" className="text-xs text-muted-foreground mb-1.5 block">Envío</label>
                            <Input
                                id="delivery-fee"
                                type="number"
                                className="h-9"
                                value={deliveryFee}
                                onChange={(e) => setDeliveryFee(parseFloat(e.target.value) || 0)}
                                aria-label="Costo de envío"
                                min="0"
                            />
                        </div>
                        <div>
                            <label htmlFor="estimated-time" className="text-xs text-muted-foreground mb-1.5 block">Tiempo (min)</label>
                            <Input
                                id="estimated-time"
                                type="number"
                                className="h-9"
                                value={estimatedMins}
                                onChange={(e) => setEstimatedMins(parseInt(e.target.value) || 0)}
                                aria-label="Tiempo estimado de entrega en minutos"
                                min="0"
                            />
                        </div>
                    </div>

                    {isDeliveryMode && (
                        <div>
                            <p className="text-xs text-muted-foreground mb-1.5">Presets de envío</p>
                            <div className="flex flex-wrap gap-2">
                                {DELIVERY_FEE_PRESETS.map((preset) => (
                                    <button
                                        key={preset.id}
                                        type="button"
                                        onClick={() => setDeliveryFee(preset.value)}
                                        className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                                            deliveryFee === preset.value
                                                ? "border-emerald-500/70 bg-emerald-500/15 text-emerald-300"
                                                : "border-border bg-muted/30 text-foreground hover:bg-muted/50"
                                        }`}
                                    >
                                        {preset.label} · ${preset.value.toLocaleString()}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div>
                        <label htmlFor="delivery-notes" className="text-xs text-muted-foreground mb-1.5 block">Notas de Entrega</label>
                        <textarea
                            id="delivery-notes"
                            className="w-full bg-background border border-input rounded-lg p-3 text-foreground resize-none text-sm"
                            rows={3}
                            placeholder="Instrucciones especiales..."
                            value={deliveryNotes}
                            onChange={(e) => setDeliveryNotes(e.target.value)}
                            aria-label="Notas de entrega"
                        />
                    </div>
                </div>

                {!isDeliveryMode && (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between mt-6 gap-3">
                        <Button type="button" variant="outline" onClick={goToPrevStep}>
                            <ChevronLeft className="h-4 w-4 mr-2" />
                            Anterior
                        </Button>
                        <Button
                            type="button"
                            className="bg-emerald-600 hover:bg-emerald-500 text-white"
                            onClick={goToNextStep}
                        >
                            Siguiente
                            <ChevronRight className="h-4 w-4 ml-2" />
                        </Button>
                    </div>
                )}
            </section>
            )}

            {((!isDeliveryMode && currentStep === 4) || (isDeliveryMode && currentStep === 2)) && (
            <section className="bg-card border border-border rounded-xl p-4 md:p-6" aria-labelledby="summary-section">
                <h2 id="summary-section" className="text-base md:text-lg font-semibold text-foreground mb-4">
                    {isDeliveryMode ? "Cobro y confirmación" : "Pago y Confirmación"}
                </h2>

                <div className="space-y-3 mb-6">
                    <div className="flex justify-between text-muted-foreground">
                        <span>Subtotal</span>
                        <span className="font-mono" aria-label={`Subtotal: ${subtotal} pesos`}>${subtotal.toLocaleString()}</span>
                    </div>

                    {/* Discount Section */}
                    <div className="space-y-2 py-2 border-y border-border">
                        <div className="flex items-center justify-between gap-2">
                            <label htmlFor="discount-type" className="text-muted-foreground text-sm">Descuento</label>
                            <select
                                id="discount-type"
                                className="bg-background border border-input text-foreground rounded px-2 py-1 text-xs"
                                value={discountType}
                                onChange={(e) => {
                                    setDiscountType(e.target.value as any);
                                    setDiscountValue(0);
                                }}
                                aria-label="Tipo de descuento"
                            >
                                <option value="none">Sin descuento</option>
                                <option value="percentage">Porcentaje (%)</option>
                                <option value="fixed">Monto fijo ($)</option>
                            </select>
                        </div>
                        {discountType !== "none" && (
                            <div className="flex items-center gap-2">
                                <Input
                                    type="number"
                                    className="h-8 text-sm"
                                    placeholder={discountType === "percentage" ? "%" : "$"}
                                    value={discountValue || ""}
                                    onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                                    aria-label={`Valor del descuento en ${discountType === "percentage" ? "porcentaje" : "pesos"}`}
                                    min="0"
                                />
                                <span className="text-red-400 font-mono text-sm whitespace-nowrap" aria-label={`Descuento aplicado: ${discountAmount} pesos`}>
                                    -${discountAmount.toLocaleString()}
                                </span>
                            </div>
                        )}
                    </div>

                    {isDeliveryMode ? (
                        <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-medium text-muted-foreground">Cobro</p>
                                <span className="text-xs text-muted-foreground">Total: ${total.toLocaleString()}</span>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setCollectNow(true);
                                        if (!paymentAmount) {
                                            setPaymentAmount(String(Math.max(total, 0)));
                                        }
                                    }}
                                    className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                                        collectNow
                                            ? "border-emerald-500/70 bg-emerald-500/15 text-emerald-300"
                                            : "border-border bg-background text-foreground hover:bg-muted/30"
                                    }`}
                                >
                                    <span className="inline-flex items-center gap-1.5">
                                        <CircleDollarSign className="h-4 w-4" aria-hidden="true" />
                                        Pagado ahora
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setCollectNow(false);
                                        setPaymentAmount("");
                                    }}
                                    className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                                        !collectNow
                                            ? "border-emerald-500/70 bg-emerald-500/15 text-emerald-300"
                                            : "border-border bg-background text-foreground hover:bg-muted/30"
                                    }`}
                                >
                                    <span className="inline-flex items-center gap-1.5">
                                        <Truck className="h-4 w-4" aria-hidden="true" />
                                        Cta. corriente
                                    </span>
                                </button>
                            </div>

                            {collectNow ? (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label htmlFor="payment-amount-delivery" className="text-xs text-muted-foreground">Monto recibido</label>
                                        <button
                                            type="button"
                                            className="text-xs text-emerald-400 hover:text-emerald-300"
                                            onClick={() => setPaymentAmount(String(Math.max(total, 0)))}
                                        >
                                            Exacto
                                        </button>
                                    </div>
                                    <Input
                                        id="payment-amount-delivery"
                                        type="number"
                                        className="h-9"
                                        value={paymentAmount}
                                        onChange={(e) => setPaymentAmount(e.target.value)}
                                        min="0"
                                        aria-label="Monto recibido"
                                    />
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground">Vuelto</span>
                                        <span className="font-mono text-emerald-400">${changeAmount.toLocaleString()}</span>
                                    </div>
                                    {paidAmount < total && (
                                        <p className="text-xs text-amber-500">Faltan ${(total - paidAmount).toLocaleString()} para completar el cobro.</p>
                                    )}
                                </div>
                            ) : (
                                <p className="text-xs text-muted-foreground">Se registrará el pedido como cuenta corriente.</p>
                            )}
                        </div>
                    ) : (
                        <div>
                            <label htmlFor="payment-method" className="text-xs text-muted-foreground mb-1.5 block">Método de Pago</label>
                            <select
                                id="payment-method"
                                className="w-full bg-background border border-input text-foreground rounded-lg px-3 py-2 text-sm"
                                value={paymentMethod}
                                onChange={(e) => setPaymentMethod(e.target.value)}
                                aria-label="Método de pago"
                            >
                                <option value="cash">Efectivo</option>
                                <option value="card">Tarjeta</option>
                                <option value="transfer">Transferencia</option>
                                <option value="credit">Cuenta Corriente</option>
                            </select>
                        </div>
                    )}

                    <div className="h-px bg-border" role="separator"></div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <span>Productos: {totalItems}</span>
                        <span className="text-right">Envío: ${deliveryFee.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-foreground text-lg font-bold">
                        <span>Total</span>
                        <span className="font-mono text-emerald-400" aria-label={`Total: ${total} pesos`}>${total.toLocaleString()}</span>
                    </div>
                </div>

                {!isDeliveryMode && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <Button
                            variant="outline"
                            onClick={goToPrevStep}
                            disabled={loading}
                            aria-label="Volver al paso anterior"
                        >
                            <ChevronLeft className="h-4 w-4 mr-2" />
                            Anterior
                        </Button>
                        <Button
                            variant="outline"
                            className="sm:col-span-1"
                            onClick={() => handleReset()}
                            disabled={loading}
                            aria-label="Limpiar formulario"
                        >
                            Limpiar
                        </Button>
                        <Button
                            className="sm:col-span-1 bg-emerald-600 hover:bg-emerald-500 text-white"
                            onClick={handleSubmit}
                            disabled={loading || !customer || items.length === 0}
                            aria-label="Crear pedido"
                        >
                            {loading ? (
                                <>
                                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" aria-hidden="true"></div>
                                    Creando...
                                </>
                            ) : (
                                <>
                                    <Save className="h-4 w-4 mr-2" aria-hidden="true" />
                                    Crear Pedido
                                </>
                            )}
                        </Button>
                    </div>
                )}
            </section>
            )}

            {isDeliveryMode && !showDeliverySuccess && (
                <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-800/80 bg-slate-950/95 backdrop-blur supports-[backdrop-filter]:bg-slate-950/85">
                    <div className="mx-auto w-full max-w-3xl px-4 py-3 [padding-bottom:calc(0.75rem+env(safe-area-inset-bottom))]">
                        <div className="flex items-center justify-between text-xs text-slate-300">
                            <span>{totalItems} {totalItems === 1 ? "producto" : "productos"}</span>
                            <span className="font-mono text-base text-emerald-300">${total.toLocaleString()}</span>
                        </div>

                        {currentStep === 1 ? (
                            <div className="mt-2 grid grid-cols-2 gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="border-slate-700 bg-slate-900/60 text-slate-100 hover:bg-slate-800"
                                    onClick={() => handleReset()}
                                    disabled={loading}
                                >
                                    Limpiar
                                </Button>

                                <Button
                                    type="button"
                                    className="bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                                    onClick={goToNextStep}
                                    disabled={loading || !customer || items.length === 0}
                                >
                                    Ir a cobro
                                    <ChevronRight className="h-4 w-4 ml-2" />
                                </Button>
                            </div>
                        ) : (
                            <div className="mt-2 space-y-2">
                                <div className="flex items-center justify-between text-xs text-slate-300">
                                    <span>Saldo pendiente</span>
                                    <span className={`font-mono ${pendingAmount > 0 ? "text-amber-300" : "text-emerald-300"}`}>
                                        ${pendingAmount.toLocaleString()}
                                    </span>
                                </div>

                                <Button
                                    type="button"
                                    className="w-full bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                                    onClick={handleSubmit}
                                    disabled={loading || !canConfirmDeliveryOrder}
                                >
                                    {loading ? (
                                        <>
                                            <div className="animate-spin h-4 w-4 border-2 border-slate-900 border-t-transparent rounded-full mr-2" aria-hidden="true"></div>
                                            Procesando...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="h-4 w-4 mr-2" aria-hidden="true" />
                                            Confirmar pedido
                                        </>
                                    )}
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
