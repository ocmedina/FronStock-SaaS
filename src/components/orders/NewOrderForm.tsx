"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useOfflineOrders } from "@/hooks/useOfflineOrders";
import { offlineDB } from "@/lib/offline/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, User, MapPin, Phone, Package, Trash2, Save, Keyboard, ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
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
}

export function NewOrderForm({ onSuccess, redirectAfterCreate = true, className = "" }: NewOrderFormProps) {
    const router = useRouter();
    const { organizationId } = useOrganization();
    const { isOnline } = useOnlineStatus();
    const { saveOrderOffline } = useOfflineOrders(organizationId);
    const supabase = createClient();

    // Form State
    const [customer, setCustomer] = useState<any>(null);
    const [items, setItems] = useState<OrderItem[]>([]);
    const [deliveryFee, setDeliveryFee] = useState(0);
    const [estimatedMins, setEstimatedMins] = useState(30);
    const [deliveryNotes, setDeliveryNotes] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("cash");
    const [discountType, setDiscountType] = useState<"none" | "percentage" | "fixed">("none");
    const [discountValue, setDiscountValue] = useState(0);
    const [loading, setLoading] = useState(false);
    const [currentStep, setCurrentStep] = useState(1);

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
    const steps = [
        { id: 1, title: "Cliente" },
        { id: 2, title: "Productos" },
        { id: 3, title: "Entrega" },
        { id: 4, title: "Pago y Confirmación" },
    ];

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
        setCustomerSearch("");
        setCustomers([]);
        setShowCustomerSearch(false);
    };

    const handleReset = () => {
        setCustomer(null);
        setItems([]);
        setDeliveryFee(0);
        setEstimatedMins(30);
        setDeliveryNotes("");
        setPaymentMethod("cash");
        setDiscountType("none");
        setDiscountValue(0);
        setCurrentStep(1);
        toast.success("Formulario limpiado");
        customerSearchRef.current?.focus();
    };

    const validateCurrentStep = () => {
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
        setCurrentStep((prev) => Math.min(prev + 1, 4));
    };

    const goToPrevStep = () => {
        setCurrentStep((prev) => Math.max(prev - 1, 1));
    };

    // Keyboard shortcuts
    useEffect(() => {
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
    }, [customer, items, loading]);

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

        setLoading(true);

        try {
            const clientReference = `online_order_${Date.now()}_${nanoid(8)}`;
            const payload = {
                p_org_id: organizationId,
                p_customer_id: customer.id,
                p_payment_method: paymentMethod,
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
                p_payment_amount: null,
                p_client_reference: clientReference
            };

            if (!isOnline) {
                const localOrderId = await saveOrderOffline(payload as any);
                toast.success("Pedido guardado offline. Se sincronizará al reconectar.");

                if (onSuccess) {
                    onSuccess(localOrderId);
                }

                handleReset();

                if (redirectAfterCreate) {
                    router.push('/dashboard/orders');
                }

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

            if (error) throw error;

            if (!data.success) {
                throw new Error(data.error || "Error al crear pedido");
            }

            toast.success("Pedido creado exitosamente");

            if (onSuccess) {
                onSuccess(data.order_id);
            }

            handleReset();

            if (redirectAfterCreate) {
                router.push('/dashboard/orders');
            }
        } catch (e: any) {
            toast.error("Error: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`space-y-6 ${className}`} role="form" aria-label="Formulario de nuevo pedido">
            {/* Keyboard Shortcuts Help */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-3 text-xs text-slate-400">
                <div className="flex items-center gap-2 mb-2">
                    <Keyboard className="h-3.5 w-3.5" />
                    <span className="font-semibold text-slate-300">Atajos de teclado:</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div><kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-xs">Ctrl+K</kbd> Buscar cliente</div>
                    <div><kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-xs">Ctrl+P</kbd> Buscar producto</div>
                    <div><kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-xs">Ctrl+S</kbd> Crear pedido</div>
                </div>
            </div>

            <section className="bg-slate-900 border border-slate-800 rounded-xl p-4 md:p-6" aria-label="Progreso de creación">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base md:text-lg font-semibold text-white">Nuevo pedido guiado</h2>
                    <span className="text-xs text-slate-400">Paso {currentStep} de {steps.length}</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
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
                                            ? "border-slate-700 bg-slate-950/80"
                                            : "border-slate-800 bg-slate-950/40"
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    {isDone ? (
                                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                                    ) : (
                                        <span className={`text-xs font-semibold ${isActive ? "text-emerald-400" : "text-slate-500"}`}>
                                            {step.id}
                                        </span>
                                    )}
                                    <span className={`text-sm font-medium ${isActive ? "text-white" : "text-slate-300"}`}>
                                        {step.title}
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-emerald-500 transition-all"
                        style={{ width: `${(currentStep / steps.length) * 100}%` }}
                    />
                </div>
            </section>

            {/* Customer Selection */}
            {currentStep === 1 && (
            <section className="bg-slate-900 border border-slate-800 rounded-xl p-4 md:p-6" aria-labelledby="customer-section">
                <h2 id="customer-section" className="text-base md:text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <User className="h-5 w-5 text-emerald-500" aria-hidden="true" />
                    Cliente
                </h2>

                {!customer ? (
                    <div className="relative">
                        <label htmlFor="customer-search" className="sr-only">Buscar cliente</label>
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" aria-hidden="true" />
                        <Input
                            id="customer-search"
                            ref={customerSearchRef}
                            placeholder="Buscar cliente por nombre o teléfono..."
                            className="pl-9 bg-slate-950 border-slate-700 text-white"
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
                                className="absolute z-10 w-full mt-2 bg-slate-900 border border-slate-700 rounded-lg shadow-xl max-h-60 overflow-y-auto"
                            >
                                {customers.map((cust, index) => (
                                    <li
                                        key={cust.id}
                                        id={`customer-${index}`}
                                        role="option"
                                        aria-selected={index === selectedCustomerIndex}
                                        className={`w-full text-left px-4 py-3 hover:bg-slate-800 transition-colors border-b border-slate-800 last:border-0 cursor-pointer ${index === selectedCustomerIndex ? 'bg-slate-800' : ''
                                            }`}
                                        onClick={() => selectCustomer(cust)}
                                    >
                                        <p className="text-white font-medium">{cust.name}</p>
                                        <p className="text-slate-400 text-sm">{cust.phone}</p>
                                        {cust.address && (
                                            <p className="text-slate-500 text-xs mt-1">{cust.address}</p>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                ) : (
                    <div className="bg-slate-950 border border-slate-700 rounded-lg p-4" role="region" aria-label="Cliente seleccionado">
                        <div className="flex items-start justify-between">
                            <div className="space-y-2 flex-1">
                                <div className="flex items-center gap-2">
                                    <User className="h-4 w-4 text-slate-500" aria-hidden="true" />
                                    <span className="text-white font-semibold">{customer.name}</span>
                                </div>
                                {customer.phone && (
                                    <div className="flex items-center gap-2 text-slate-400 text-sm">
                                        <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                                        <span>{customer.phone}</span>
                                    </div>
                                )}
                                {customer.address && (
                                    <div className="flex items-start gap-2 text-slate-400 text-sm">
                                        <MapPin className="h-3.5 w-3.5 mt-0.5" aria-hidden="true" />
                                        <span>{customer.address}</span>
                                    </div>
                                )}
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setCustomer(null)}
                                className="text-slate-400 hover:text-white"
                                aria-label="Cambiar cliente seleccionado"
                            >
                                Cambiar
                            </Button>
                        </div>
                    </div>
                )}

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
            </section>
            )}

            {/* Products */}
            {currentStep === 2 && (
            <section className="bg-slate-900 border border-slate-800 rounded-xl p-4 md:p-6" aria-labelledby="products-section">
                <h2 id="products-section" className="text-base md:text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Package className="h-5 w-5 text-emerald-500" aria-hidden="true" />
                    Productos
                </h2>

                {/* Product Search */}
                <div className="relative mb-4">
                    <label htmlFor="product-search" className="sr-only">Buscar producto</label>
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" aria-hidden="true" />
                    <Input
                        id="product-search"
                        ref={productSearchRef}
                        placeholder="Buscar producto..."
                        className="pl-9 bg-slate-950 border-slate-700 text-white"
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
                            className="absolute z-10 w-full mt-2 bg-slate-900 border border-slate-700 rounded-lg shadow-xl max-h-60 overflow-y-auto"
                        >
                            {products.map((prod, index) => (
                                <li
                                    key={prod.id}
                                    id={`product-${index}`}
                                    role="option"
                                    aria-selected={index === selectedProductIndex}
                                    className={`w-full text-left px-4 py-3 hover:bg-slate-800 transition-colors border-b border-slate-800 last:border-0 flex items-center justify-between cursor-pointer ${index === selectedProductIndex ? 'bg-slate-800' : ''
                                        }`}
                                    onClick={() => addProduct(prod)}
                                >
                                    <div>
                                        <p className="text-white font-medium">{prod.name}</p>
                                        <p className="text-slate-400 text-sm">Stock: {prod.stock}</p>
                                    </div>
                                    <span className="text-emerald-400 font-mono font-semibold">
                                        ${prod.price.toLocaleString()}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Items Table */}
                {items.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed border-slate-800 rounded-lg" role="status" aria-label="No hay productos">
                        <Package className="h-12 w-12 text-slate-700 mx-auto mb-3" aria-hidden="true" />
                        <p className="text-slate-500">No hay productos agregados</p>
                        <p className="text-slate-600 text-sm mt-1">Busca y agrega productos al pedido</p>
                    </div>
                ) : (
                    <div className="border border-slate-800 rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full" role="table" aria-label="Productos en el pedido">
                                <thead className="bg-slate-950 border-b border-slate-800">
                                    <tr>
                                        <th scope="col" className="text-left p-3 text-slate-400 font-medium text-sm">Producto</th>
                                        <th scope="col" className="text-right p-3 text-slate-400 font-medium text-sm hidden md:table-cell">Precio</th>
                                        <th scope="col" className="text-center p-3 text-slate-400 font-medium text-sm">Cant.</th>
                                        <th scope="col" className="text-right p-3 text-slate-400 font-medium text-sm">Subtotal</th>
                                        <th scope="col" className="w-12"><span className="sr-only">Acciones</span></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {items.map((item) => (
                                        <tr key={item.product_id} className="hover:bg-slate-950/50">
                                            <td className="p-3">
                                                <p className="text-white font-medium text-sm md:text-base">{item.product_name}</p>
                                                <p className="text-slate-500 text-xs">Stock: {item.stock}</p>
                                            </td>
                                            <td className="p-3 text-right text-slate-300 font-mono text-sm hidden md:table-cell">
                                                ${item.unit_price.toLocaleString()}
                                            </td>
                                            <td className="p-3">
                                                <div className="flex items-center justify-center gap-1 md:gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-7 w-7 md:h-8 md:w-8 p-0 border-slate-700 text-xs"
                                                        onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                                                        aria-label={`Disminuir cantidad de ${item.product_name}`}
                                                    >
                                                        -
                                                    </Button>
                                                    <Input
                                                        type="number"
                                                        className="w-12 md:w-16 h-7 md:h-8 text-center bg-slate-950 border-slate-700 text-white text-sm"
                                                        value={item.quantity}
                                                        onChange={(e) => updateQuantity(item.product_id, parseInt(e.target.value) || 0)}
                                                        aria-label={`Cantidad de ${item.product_name}`}
                                                        min="0"
                                                        max={item.stock}
                                                    />
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-7 w-7 md:h-8 md:w-8 p-0 border-slate-700 text-xs"
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

                <div className="flex items-center justify-between mt-6">
                    <Button type="button" variant="outline" className="border-slate-700 text-slate-300" onClick={goToPrevStep}>
                        <ChevronLeft className="h-4 w-4 mr-2" />
                        Anterior
                    </Button>
                    <div className="text-xs text-slate-400">
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
            </section>
            )}

            {/* Summary & Actions */}
            {currentStep === 3 && (
            <section className="bg-slate-900 border border-slate-800 rounded-xl p-4 md:p-6" aria-labelledby="delivery-section">
                <h2 id="delivery-section" className="text-base md:text-lg font-semibold text-white mb-4">Entrega</h2>

                <div className="space-y-4">
                    <div className="bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm">
                        <p className="text-slate-400">Cliente seleccionado</p>
                        <p className="text-white font-medium">{customer?.name || "Sin cliente"}</p>
                        <p className="text-slate-500 text-xs mt-1">{customer?.address || "Sin dirección cargada"}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label htmlFor="delivery-fee" className="text-xs text-slate-400 mb-1.5 block">Envío</label>
                            <Input
                                id="delivery-fee"
                                type="number"
                                className="bg-slate-950 border-slate-700 text-white h-9"
                                value={deliveryFee}
                                onChange={(e) => setDeliveryFee(parseFloat(e.target.value) || 0)}
                                aria-label="Costo de envío"
                                min="0"
                            />
                        </div>
                        <div>
                            <label htmlFor="estimated-time" className="text-xs text-slate-400 mb-1.5 block">Tiempo (min)</label>
                            <Input
                                id="estimated-time"
                                type="number"
                                className="bg-slate-950 border-slate-700 text-white h-9"
                                value={estimatedMins}
                                onChange={(e) => setEstimatedMins(parseInt(e.target.value) || 0)}
                                aria-label="Tiempo estimado de entrega en minutos"
                                min="0"
                            />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="delivery-notes" className="text-xs text-slate-400 mb-1.5 block">Notas de Entrega</label>
                        <textarea
                            id="delivery-notes"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white resize-none text-sm"
                            rows={3}
                            placeholder="Instrucciones especiales..."
                            value={deliveryNotes}
                            onChange={(e) => setDeliveryNotes(e.target.value)}
                            aria-label="Notas de entrega"
                        />
                    </div>
                </div>

                <div className="flex items-center justify-between mt-6">
                    <Button type="button" variant="outline" className="border-slate-700 text-slate-300" onClick={goToPrevStep}>
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
            </section>
            )}

            {currentStep === 4 && (
            <section className="bg-slate-900 border border-slate-800 rounded-xl p-4 md:p-6" aria-labelledby="summary-section">
                <h2 id="summary-section" className="text-base md:text-lg font-semibold text-white mb-4">Pago y Confirmación</h2>

                <div className="space-y-3 mb-6">
                    <div className="flex justify-between text-slate-400">
                        <span>Subtotal</span>
                        <span className="font-mono" aria-label={`Subtotal: ${subtotal} pesos`}>${subtotal.toLocaleString()}</span>
                    </div>

                    {/* Discount Section */}
                    <div className="space-y-2 py-2 border-y border-slate-800">
                        <div className="flex items-center justify-between gap-2">
                            <label htmlFor="discount-type" className="text-slate-400 text-sm">Descuento</label>
                            <select
                                id="discount-type"
                                className="bg-slate-950 border border-slate-700 text-white rounded px-2 py-1 text-xs"
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
                                    className="bg-slate-950 border-slate-700 text-white h-8 text-sm"
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

                    <div>
                        <label htmlFor="payment-method" className="text-xs text-slate-400 mb-1.5 block">Método de Pago</label>
                        <select
                            id="payment-method"
                            className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm"
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

                    <div className="h-px bg-slate-800" role="separator"></div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
                        <span>Productos: {totalItems}</span>
                        <span className="text-right">Envío: ${deliveryFee.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-white text-lg font-bold">
                        <span>Total</span>
                        <span className="font-mono text-emerald-400" aria-label={`Total: ${total} pesos`}>${total.toLocaleString()}</span>
                    </div>
                </div>

                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        className="border-slate-700 text-slate-300"
                        onClick={goToPrevStep}
                        disabled={loading}
                        aria-label="Volver al paso anterior"
                    >
                        <ChevronLeft className="h-4 w-4 mr-2" />
                        Anterior
                    </Button>
                    <Button
                        variant="outline"
                        className="flex-1 border-slate-700 text-slate-300"
                        onClick={handleReset}
                        disabled={loading}
                        aria-label="Limpiar formulario"
                    >
                        Limpiar
                    </Button>
                    <Button
                        className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white"
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
            </section>
            )}
        </div>
    );
}
