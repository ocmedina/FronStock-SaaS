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
import {
    Search, User, MapPin, Phone, Package, Trash2, Save,
    ChevronLeft, ChevronRight, CheckCircle2, Plus, Minus,
    Banknote, CreditCard, ArrowRightLeft, BookUser, Loader2,
    Clock, Truck, StickyNote,
} from "lucide-react";
import { toast } from "sonner";
import { nanoid } from "nanoid";
import { cn } from "@/lib/utils";

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

const STEPS = [
    { id: 1, label: "Cliente", short: "1" },
    { id: 2, label: "Productos", short: "2" },
    { id: 3, label: "Entrega", short: "3" },
    { id: 4, label: "Confirmar", short: "4" },
];

const PAYMENT_OPTIONS = [
    { value: "cash", label: "Efectivo", icon: Banknote },
    { value: "transfer", label: "Transferencia", icon: ArrowRightLeft },
    { value: "card", label: "Tarjeta", icon: CreditCard },
    { value: "credit", label: "Cta. Cte.", icon: BookUser },
];

export function NewOrderForm({ onSuccess, redirectAfterCreate = true, className = "" }: NewOrderFormProps) {
    const router = useRouter();
    const { organizationId, organization, profile } = useOrganization();
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
    const subtotal = items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
    const discountAmount =
        discountType === "percentage"
            ? (subtotal * discountValue) / 100
            : discountType === "fixed"
            ? discountValue
            : 0;
    const total = subtotal - discountAmount + deliveryFee;
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

    // ─── SEARCH PRODUCTS ──────────────────────────────────────────────────────
    useEffect(() => {
        if (searchTerm.length >= 2) searchProducts();
        else setProducts([]);
    }, [searchTerm]);

    const searchProducts = async () => {
        if (!organizationId) { setProducts([]); return; }
        const queryText = searchTerm.trim().toLowerCase();
        if (!queryText) { setProducts([]); return; }

        const loadFromCache = async () => {
            const cached = await offlineDB.products.where("organization_id").equals(organizationId).toArray();
            setProducts(
                cached.filter((p: any) => p.stock > 0 && (p.name || "").toLowerCase().includes(queryText))
                    .slice(0, 10)
                    .map((p: any) => ({ id: p.id, name: p.name, price: p.price, stock: p.stock }))
            );
        };

        if (!isOnline) { await loadFromCache(); return; }
        try {
            const { data } = await supabase.from("products").select("id, name, price, stock")
                .eq("organization_id", organizationId).ilike("name", `%${searchTerm}%`).gt("stock", 0).limit(10);
            if (data) { setProducts(data); return; }
        } catch { await loadFromCache(); }
        await loadFromCache();
    };

    // ─── SEARCH CUSTOMERS ─────────────────────────────────────────────────────
    useEffect(() => {
        if (customerSearch.length >= 2) searchCustomers();
        else setCustomers([]);
    }, [customerSearch]);

    const searchCustomers = async () => {
        if (!organizationId) { setCustomers([]); return; }
        const queryText = customerSearch.trim().toLowerCase();
        if (!queryText) { setCustomers([]); return; }

        const loadFromCache = async () => {
            const cached = await offlineDB.customers.where("organization_id").equals(organizationId).toArray();
            setCustomers(
                cached.filter((c: any) => {
                    const text = (c.name || "").toLowerCase() + " " + (c.phone || "").toLowerCase();
                    const serviceType = c.service_type || "";
                    return text.includes(queryText) && (serviceType === "delivery" || serviceType === "both");
                }).slice(0, 10)
            );
        };

        if (!isOnline) { await loadFromCache(); return; }
        try {
            const { data } = await supabase.from("customers").select("*")
                .eq("organization_id", organizationId)
                .or(`name.ilike.%${customerSearch}%,phone.ilike.%${customerSearch}%`).limit(10);
            if (data) {
                setCustomers(data.filter((c: any) => c.service_type === "delivery" || c.service_type === "both"));
                return;
            }
        } catch { await loadFromCache(); }
        await loadFromCache();
    };

    // ─── ACTIONS ──────────────────────────────────────────────────────────────
    const addProduct = (product: any) => {
        const existing = items.find((i) => i.product_id === product.id);
        if (existing) {
            updateQuantity(product.id, existing.quantity + 1);
        } else {
            setItems([...items, { product_id: product.id, product_name: product.name, unit_price: product.price, quantity: 1, stock: product.stock }]);
        }
        setSearchTerm(""); setProducts([]); setShowProductSearch(false);
    };

    const updateQuantity = (productId: string, newQuantity: number) => {
        const item = items.find((i) => i.product_id === productId);
        if (!item) return;
        if (newQuantity <= 0) { removeItem(productId); return; }
        if (newQuantity > item.stock) { toast.error(`Stock disponible: ${item.stock}`); return; }
        setItems(items.map((i) => i.product_id === productId ? { ...i, quantity: newQuantity } : i));
    };

    const removeItem = (productId: string) => setItems(items.filter((i) => i.product_id !== productId));

    const selectCustomer = (cust: any) => {
        setCustomer(cust); setCustomerSearch(""); setCustomers([]); setShowCustomerSearch(false);
    };

    const handleReset = () => {
        setCustomer(null); setItems([]); setDeliveryFee(0); setEstimatedMins(30);
        setDeliveryNotes(""); setPaymentMethod("cash"); setDiscountType("none");
        setDiscountValue(0); setCurrentStep(1);
        toast.success("Formulario limpiado");
        customerSearchRef.current?.focus();
    };

    const validateCurrentStep = () => {
        if (currentStep === 1 && !customer) { toast.error("Seleccioná un cliente para continuar"); return false; }
        if (currentStep === 2 && items.length === 0) { toast.error("Agregá al menos un producto"); return false; }
        return true;
    };

    const goToNextStep = () => { if (!validateCurrentStep()) return; setCurrentStep((p) => Math.min(p + 1, 4)); };
    const goToPrevStep = () => setCurrentStep((p) => Math.max(p - 1, 1));

    // Keyboard shortcuts
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); if (customer && items.length > 0 && !loading) handleSubmit(); }
            if ((e.ctrlKey || e.metaKey) && e.key === "k") { e.preventDefault(); customerSearchRef.current?.focus(); }
            if ((e.ctrlKey || e.metaKey) && e.key === "p") { e.preventDefault(); productSearchRef.current?.focus(); }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [customer, items, loading]);

    const handleCustomerKeyDown = (e: React.KeyboardEvent) => {
        if (!showCustomerSearch || customers.length === 0) return;
        if (e.key === "ArrowDown") { e.preventDefault(); setSelectedCustomerIndex((p) => Math.min(p + 1, customers.length - 1)); }
        else if (e.key === "ArrowUp") { e.preventDefault(); setSelectedCustomerIndex((p) => Math.max(p - 1, 0)); }
        else if (e.key === "Enter" && customers[selectedCustomerIndex]) { e.preventDefault(); selectCustomer(customers[selectedCustomerIndex]); }
        else if (e.key === "Escape") setShowCustomerSearch(false);
    };

    const handleProductKeyDown = (e: React.KeyboardEvent) => {
        if (!showProductSearch || products.length === 0) return;
        if (e.key === "ArrowDown") { e.preventDefault(); setSelectedProductIndex((p) => Math.min(p + 1, products.length - 1)); }
        else if (e.key === "ArrowUp") { e.preventDefault(); setSelectedProductIndex((p) => Math.max(p - 1, 0)); }
        else if (e.key === "Enter" && products[selectedProductIndex]) { e.preventDefault(); addProduct(products[selectedProductIndex]); }
        else if (e.key === "Escape") setShowProductSearch(false);
    };

    useEffect(() => setSelectedCustomerIndex(0), [customers]);
    useEffect(() => setSelectedProductIndex(0), [products]);

    // ─── SUBMIT ───────────────────────────────────────────────────────────────
    const handleSubmit = async () => {
        if (!customer) { toast.error("Seleccioná un cliente"); return; }
        if (items.length === 0) { toast.error("Agregá al menos un producto"); return; }
        setLoading(true);
        try {
            const clientReference = `online_order_${Date.now()}_${nanoid(8)}`;
            const payload = {
                p_org_id: organizationId,
                p_customer_id: customer.id,
                p_payment_method: paymentMethod,
                p_items: items.map((i) => ({ product_id: i.product_id, product_name: i.product_name, quantity: i.quantity, unit_price: i.unit_price })),
                p_delivery_address: customer.address,
                p_delivery_notes: deliveryNotes,
                p_estimated_mins: estimatedMins,
                p_delivery_fee: deliveryFee,
                p_discount: discountAmount,
                p_payment_amount: null,
                p_client_reference: clientReference,
            };

            if (!isOnline) {
                const localOrderId = await saveOrderOffline(payload as any);
                toast.success("Pedido guardado offline. Se sincronizará al reconectar.");
                if (onSuccess) onSuccess(localOrderId);
                handleReset();
                if (redirectAfterCreate) router.push("/dashboard/orders");
                return;
            }

            const requiresOpenSession = shouldRequireOpenCashSession({ organization, profile, paymentMethods: [paymentMethod] });
            if (requiresOpenSession) {
                const hasOpenSession = await ensureOpenCashSession(supabase, organizationId);
                if (!hasOpenSession) return;
            }

            let { data, error } = await supabase.rpc("create_order", payload);
            const shouldTryLegacy = !!error && (error.code === "PGRST202" || error.code === "42883" || error.message?.toLowerCase().includes("function") || error.message?.includes("p_client_reference"));
            if (shouldTryLegacy) {
                const { p_client_reference, ...legacyPayload } = payload;
                const legacyResult = await supabase.rpc("create_order", legacyPayload);
                data = legacyResult.data; error = legacyResult.error;
            }
            if (error) throw error;
            if (!data.success) throw new Error(data.error || "Error al crear pedido");

            toast.success("¡Pedido creado! 🎉");
            if (onSuccess) onSuccess(data.order_id);
            handleReset();
            if (redirectAfterCreate) router.push("/dashboard/orders");
        } catch (e: any) {
            toast.error("Error: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    // ─── RENDER ───────────────────────────────────────────────────────────────
    return (
        <div className={cn("flex flex-col gap-0", className)}>

            {/* ── STEP INDICATOR ──────────────────────────────────────────── */}
            <div className="px-1 mb-5">
                <div className="flex items-center gap-0">
                    {STEPS.map((step, idx) => {
                        const isDone = currentStep > step.id;
                        const isActive = currentStep === step.id;
                        return (
                            <div key={step.id} className="flex items-center flex-1 last:flex-none">
                                <button
                                    type="button"
                                    disabled={step.id > currentStep}
                                    onClick={() => { if (step.id <= currentStep) setCurrentStep(step.id); }}
                                    className="flex flex-col items-center gap-1 group"
                                >
                                    <div className={cn(
                                        "h-8 w-8 rounded-full flex items-center justify-center text-xs font-black transition-all",
                                        isDone ? "bg-emerald-500 text-slate-950"
                                            : isActive ? "bg-indigo-500 text-white ring-4 ring-indigo-500/20"
                                                : "bg-slate-800 text-slate-500"
                                    )}>
                                        {isDone ? <CheckCircle2 className="h-4 w-4" /> : step.short}
                                    </div>
                                    <span className={cn(
                                        "text-[10px] font-semibold hidden sm:block",
                                        isActive ? "text-white" : isDone ? "text-emerald-400" : "text-slate-600"
                                    )}>
                                        {step.label}
                                    </span>
                                </button>
                                {idx < STEPS.length - 1 && (
                                    <div className={cn(
                                        "flex-1 h-0.5 mx-1 transition-all",
                                        currentStep > step.id ? "bg-emerald-500" : "bg-slate-800"
                                    )} />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── STEP 1: CLIENTE ─────────────────────────────────────────── */}
            {currentStep === 1 && (
                <div className="space-y-4">
                    <div>
                        <h2 className="text-base font-bold text-white mb-1">¿A quién le entregamos?</h2>
                        <p className="text-xs text-slate-500">Buscá el cliente por nombre o teléfono</p>
                    </div>

                    {!customer ? (
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
                            <input
                                ref={customerSearchRef}
                                placeholder="Nombre o teléfono..."
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                                value={customerSearch}
                                onChange={(e) => { setCustomerSearch(e.target.value); setShowCustomerSearch(true); }}
                                onFocus={() => setShowCustomerSearch(true)}
                                onKeyDown={handleCustomerKeyDown}
                                autoComplete="off"
                            />
                            {showCustomerSearch && customers.length > 0 && (
                                <ul className="absolute z-20 w-full mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-56 overflow-y-auto">
                                    {customers.map((cust, idx) => (
                                        <li
                                            key={cust.id}
                                            className={cn(
                                                "px-4 py-3 cursor-pointer border-b border-slate-800 last:border-0 transition-colors",
                                                idx === selectedCustomerIndex ? "bg-indigo-600/30" : "hover:bg-slate-800"
                                            )}
                                            onClick={() => selectCustomer(cust)}
                                        >
                                            <p className="text-white font-semibold text-sm">{cust.name}</p>
                                            <div className="flex gap-3 mt-0.5">
                                                {cust.phone && <span className="text-slate-400 text-xs">{cust.phone}</span>}
                                                {cust.address && <span className="text-slate-500 text-xs truncate">{cust.address}</span>}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    ) : (
                        <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-2xl p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3 min-w-0">
                                    <div className="h-10 w-10 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0">
                                        <User className="h-5 w-5 text-indigo-400" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-bold text-white text-sm">{customer.name}</p>
                                        {customer.phone && (
                                            <p className="text-slate-400 text-xs flex items-center gap-1 mt-0.5">
                                                <Phone className="h-3 w-3" />{customer.phone}
                                            </p>
                                        )}
                                        {customer.address && (
                                            <p className="text-slate-400 text-xs flex items-center gap-1 mt-0.5 truncate">
                                                <MapPin className="h-3 w-3 shrink-0" />{customer.address}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={() => setCustomer(null)}
                                    className="text-xs text-slate-500 hover:text-slate-200 transition-colors shrink-0 pt-1"
                                >
                                    Cambiar
                                </button>
                            </div>
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={goToNextStep}
                        className="w-full h-12 bg-indigo-600 hover:bg-indigo-500 active:scale-[.98] text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-all mt-2"
                    >
                        Continuar
                        <ChevronRight className="h-5 w-5" />
                    </button>
                </div>
            )}

            {/* ── STEP 2: PRODUCTOS ───────────────────────────────────────── */}
            {currentStep === 2 && (
                <div className="space-y-4">
                    <div>
                        <h2 className="text-base font-bold text-white mb-1">¿Qué lleva el pedido?</h2>
                        <p className="text-xs text-slate-500">Buscá y agregá los productos</p>
                    </div>

                    {/* Product search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
                        <input
                            ref={productSearchRef}
                            placeholder="Buscar producto..."
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setShowProductSearch(true); }}
                            onFocus={() => setShowProductSearch(true)}
                            onKeyDown={handleProductKeyDown}
                            autoComplete="off"
                        />
                        {showProductSearch && products.length > 0 && (
                            <ul className="absolute z-20 w-full mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-56 overflow-y-auto">
                                {products.map((prod, idx) => (
                                    <li
                                        key={prod.id}
                                        className={cn(
                                            "px-4 py-3 cursor-pointer border-b border-slate-800 last:border-0 flex items-center justify-between transition-colors",
                                            idx === selectedProductIndex ? "bg-indigo-600/30" : "hover:bg-slate-800"
                                        )}
                                        onClick={() => addProduct(prod)}
                                    >
                                        <div>
                                            <p className="text-white font-semibold text-sm">{prod.name}</p>
                                            <p className="text-slate-500 text-xs">Stock: {prod.stock}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono font-bold text-emerald-400 text-sm">
                                                ${prod.price.toLocaleString()}
                                            </span>
                                            <div className="h-6 w-6 rounded-full bg-indigo-500/20 flex items-center justify-center">
                                                <Plus className="h-3 w-3 text-indigo-400" />
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* Items list */}
                    {items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 bg-slate-900/50 border border-dashed border-slate-700 rounded-2xl">
                            <Package className="h-10 w-10 text-slate-700 mb-2" />
                            <p className="text-slate-500 text-sm">Sin productos aún</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {items.map((item) => (
                                <div key={item.product_id} className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center gap-3">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white font-semibold text-sm truncate">{item.product_name}</p>
                                        <p className="text-slate-500 text-xs font-mono">${item.unit_price.toLocaleString()} c/u</p>
                                    </div>
                                    {/* Quantity controls */}
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                                            className="h-7 w-7 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 transition-colors"
                                        >
                                            <Minus className="h-3.5 w-3.5" />
                                        </button>
                                        <span className="text-white font-bold text-sm w-5 text-center">{item.quantity}</span>
                                        <button
                                            onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                                            className="h-7 w-7 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 transition-colors"
                                        >
                                            <Plus className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                    {/* Subtotal */}
                                    <p className="font-mono font-bold text-emerald-400 text-sm w-16 text-right shrink-0">
                                        ${(item.unit_price * item.quantity).toLocaleString()}
                                    </p>
                                    {/* Remove */}
                                    <button
                                        onClick={() => removeItem(item.product_id)}
                                        className="text-slate-600 hover:text-red-400 transition-colors shrink-0"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            ))}

                            {/* Subtotal bar */}
                            <div className="flex items-center justify-between px-3 py-2 bg-slate-800/60 rounded-xl">
                                <span className="text-slate-400 text-xs">{totalItems} ítem{totalItems !== 1 ? "s" : ""}</span>
                                <span className="font-mono font-bold text-white text-sm">Subtotal: ${subtotal.toLocaleString()}</span>
                            </div>
                        </div>
                    )}

                    <div className="flex gap-2 pt-1">
                        <button
                            type="button"
                            onClick={goToPrevStep}
                            className="h-12 px-4 rounded-2xl border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 flex items-center gap-1 transition-colors"
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </button>
                        <button
                            type="button"
                            onClick={goToNextStep}
                            className="flex-1 h-12 bg-indigo-600 hover:bg-indigo-500 active:scale-[.98] text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-all"
                        >
                            Continuar
                            <ChevronRight className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            )}

            {/* ── STEP 3: ENTREGA ─────────────────────────────────────────── */}
            {currentStep === 3 && (
                <div className="space-y-4">
                    <div>
                        <h2 className="text-base font-bold text-white mb-1">Detalles de entrega</h2>
                        <p className="text-xs text-slate-500">Tiempo estimado, costo y notas</p>
                    </div>

                    {/* Delivery address recap */}
                    {customer?.address && (
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-start gap-3">
                            <MapPin className="h-4 w-4 text-indigo-400 mt-0.5 shrink-0" />
                            <div>
                                <p className="text-xs text-slate-500 mb-0.5">Dirección de entrega</p>
                                <p className="text-white text-sm font-medium">{customer.address}</p>
                            </div>
                        </div>
                    )}

                    {/* Time + Fee */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                            <label className="text-xs text-slate-500 mb-2 flex items-center gap-1 block">
                                <Clock className="h-3 w-3" />
                                Tiempo estimado (min)
                            </label>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setEstimatedMins(Math.max(5, estimatedMins - 5))}
                                    className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 hover:bg-slate-700 transition-colors">
                                    <Minus className="h-3.5 w-3.5" />
                                </button>
                                <span className="flex-1 text-center text-white font-bold text-lg font-mono">{estimatedMins}</span>
                                <button onClick={() => setEstimatedMins(estimatedMins + 5)}
                                    className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 hover:bg-slate-700 transition-colors">
                                    <Plus className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </div>
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                            <label className="text-xs text-slate-500 mb-2 flex items-center gap-1 block">
                                <Truck className="h-3 w-3" />
                                Costo envío ($)
                            </label>
                            <input
                                type="number"
                                min="0"
                                value={deliveryFee || ""}
                                onChange={(e) => setDeliveryFee(parseFloat(e.target.value) || 0)}
                                placeholder="0"
                                className="w-full bg-transparent text-white font-bold text-lg font-mono text-center focus:outline-none placeholder-slate-700"
                            />
                        </div>
                    </div>

                    {/* Delivery notes */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                        <label className="text-xs text-slate-500 mb-2 flex items-center gap-1 block">
                            <StickyNote className="h-3 w-3" />
                            Notas de entrega
                        </label>
                        <textarea
                            rows={2}
                            value={deliveryNotes}
                            onChange={(e) => setDeliveryNotes(e.target.value)}
                            placeholder="Timbre roto, llamar antes, dejar en puerta..."
                            className="w-full bg-transparent text-white text-sm resize-none focus:outline-none placeholder-slate-600"
                        />
                    </div>

                    <div className="flex gap-2 pt-1">
                        <button
                            type="button"
                            onClick={goToPrevStep}
                            className="h-12 px-4 rounded-2xl border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 flex items-center gap-1 transition-colors"
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </button>
                        <button
                            type="button"
                            onClick={goToNextStep}
                            className="flex-1 h-12 bg-indigo-600 hover:bg-indigo-500 active:scale-[.98] text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-all"
                        >
                            Continuar
                            <ChevronRight className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            )}

            {/* ── STEP 4: PAGO Y CONFIRMACIÓN ─────────────────────────────── */}
            {currentStep === 4 && (
                <div className="space-y-4">
                    <div>
                        <h2 className="text-base font-bold text-white mb-1">Confirmar pedido</h2>
                        <p className="text-xs text-slate-500">Revisá el resumen y elegí el método de pago</p>
                    </div>

                    {/* Summary card */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                        {/* Customer + address */}
                        <div className="p-4 border-b border-slate-800 flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0">
                                <User className="h-4 w-4 text-indigo-400" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-white font-bold text-sm">{customer?.name}</p>
                                {customer?.address && <p className="text-slate-500 text-xs truncate">{customer.address}</p>}
                            </div>
                        </div>

                        {/* Items */}
                        <div className="px-4 py-3 space-y-1.5 border-b border-slate-800">
                            {items.map((item) => (
                                <div key={item.product_id} className="flex items-center justify-between text-sm">
                                    <span className="text-slate-300">{item.quantity}× {item.product_name}</span>
                                    <span className="font-mono text-slate-300">${(item.unit_price * item.quantity).toLocaleString()}</span>
                                </div>
                            ))}
                        </div>

                        {/* Totals */}
                        <div className="px-4 py-3 space-y-2">
                            <div className="flex justify-between text-sm text-slate-500">
                                <span>Subtotal</span>
                                <span className="font-mono">${subtotal.toLocaleString()}</span>
                            </div>
                            {deliveryFee > 0 && (
                                <div className="flex justify-between text-sm text-slate-500">
                                    <span>Envío</span>
                                    <span className="font-mono">+${deliveryFee.toLocaleString()}</span>
                                </div>
                            )}
                            {/* Discount */}
                            <div className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                    <span className="text-slate-500">Descuento</span>
                                    <select
                                        className="bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-2 py-0.5 text-xs focus:outline-none"
                                        value={discountType}
                                        onChange={(e) => { setDiscountType(e.target.value as any); setDiscountValue(0); }}
                                    >
                                        <option value="none">Sin descuento</option>
                                        <option value="percentage">% Porcentaje</option>
                                        <option value="fixed">$ Monto fijo</option>
                                    </select>
                                </div>
                                {discountType !== "none" && (
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            min="0"
                                            placeholder={discountType === "percentage" ? "%" : "$"}
                                            value={discountValue || ""}
                                            onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                                            className="w-16 bg-slate-800 border border-slate-700 text-white rounded-lg px-2 py-1 text-xs text-right focus:outline-none focus:border-indigo-500"
                                        />
                                        {discountAmount > 0 && (
                                            <span className="text-red-400 font-mono text-xs">-${discountAmount.toLocaleString()}</span>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="flex justify-between text-base font-black text-white border-t border-slate-700 pt-2 mt-1">
                                <span>Total</span>
                                <span className="font-mono text-emerald-400">${total.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    {/* Payment method */}
                    <div>
                        <p className="text-xs text-slate-500 mb-2">Método de pago</p>
                        <div className="grid grid-cols-4 gap-2">
                            {PAYMENT_OPTIONS.map(({ value, label, icon: Icon }) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => setPaymentMethod(value)}
                                    className={cn(
                                        "flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-bold transition-all",
                                        paymentMethod === value
                                            ? "bg-indigo-500/20 border-indigo-500 text-indigo-300"
                                            : "bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-600"
                                    )}
                                >
                                    <Icon className="h-4 w-4" />
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-1">
                        <button
                            type="button"
                            onClick={goToPrevStep}
                            disabled={loading}
                            className="h-12 px-4 rounded-2xl border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 flex items-center gap-1 transition-colors disabled:opacity-50"
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={loading || !customer || items.length === 0}
                            className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-500 active:scale-[.98] text-white font-black rounded-2xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <><Loader2 className="h-5 w-5 animate-spin" /> Creando...</>
                            ) : (
                                <><CheckCircle2 className="h-5 w-5" /> Confirmar Pedido</>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
