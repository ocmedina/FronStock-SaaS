import {
    Banknote,
    CreditCard,
    Building,
    User,
    CheckCircle2,
    AlertCircle,
    Loader2,
    Receipt,
    Search,
    Plus,
    Trash2,
    Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Customer, SaleTab, PaymentMethod, paymentMethods, Payment } from "./types";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface POSPaymentPanelProps {
    activeTab: SaleTab;
    customers: Customer[];
    subtotal: number;
    total: number;
    onCustomerChange: (id: string) => void;
    onAddPayment: (payment: Payment) => void;
    onRemovePayment: (index: number) => void;
    onSetPayments: (payments: Payment[]) => void;
    onProcessSale: () => void;
    processing: boolean;
    discount?: number;
    surcharge?: number;
    onUpdateDiscount: (val: number) => void;
    onUpdateSurcharge: (val: number) => void;
    // Supplier Payment Props
    suppliers?: any[]; // We'll need to pass this
    onSupplierPaymentChange?: (payment: { supplierId: string, amount: number } | null) => void;
}

const methodIcons: Record<string, any> = {
    Banknote,
    CreditCard,
    Building,
    User,
    Wallet,
};

export function POSPaymentPanel({
    activeTab,
    customers,
    subtotal,
    total,
    onCustomerChange,
    onAddPayment,
    onRemovePayment,
    onSetPayments,
    onProcessSale,
    processing,
    discount = 0,
    surcharge = 0,
    onUpdateDiscount,
    onUpdateSurcharge,
    suppliers = [],
    onSupplierPaymentChange
}: POSPaymentPanelProps) {
    // Local state
    const [mode, setMode] = useState<"simple" | "mixed">("simple");
    const [selectedSimpleMethod, setSelectedSimpleMethod] = useState<PaymentMethod>("cash");

    // Supplier Payment State
    const [supplierPayment, setSupplierPayment] = useState<{ supplierId: string, amount: string } | null>(null);

    // For Credit Down Payment
    const [downPayment, setDownPayment] = useState<string>("");

    // For mixed mode builder
    const [amount, setAmount] = useState<string>("");
    const [method, setMethod] = useState<PaymentMethod>("cash");

    // Initialize mode based on current payments
    useEffect(() => {
        if (activeTab.payments && activeTab.payments.length > 1) {
            setMode("mixed");
        } else if (activeTab.payments && activeTab.payments.length === 1) {
            // Check if matches the total (approx)
            if (Math.abs(activeTab.payments[0].amount - total) < 0.01) {
                setMode("simple");
                setSelectedSimpleMethod(activeTab.payments[0].method);
            } else {
                setMode("mixed");
            }
        }
    }, [activeTab.payments, total]);

    // Handle Simple Mode Selection
    const handleSimpleMethodSelect = (method: PaymentMethod) => {
        if (method === "credit" && !activeTab.customerId) {
            alert("Debe seleccionar un cliente para pagos a crédito (fiado).");
            return;
        }

        setSelectedSimpleMethod(method);
        setMode("simple");

        // Reset down payment when switching methods
        setDownPayment("");

        // Use parent prop to set full payment directly
        onSetPayments([{ method, amount: total }]);
    };

    // Handle Down Payment Change (for Credit)
    const handleDownPaymentChange = (val: string) => {
        setDownPayment(val);
        const dpAmount = parseFloat(val);

        if (!isNaN(dpAmount) && dpAmount > 0) {
            // Logic: Set payments to [Cash: dp, Credit: total - dp]
            // Wait, if we use onSetPayments here, it might flicker UI or change mode?
            // No, as long as we stay in "Simple - Credit" visual state.
            // But my "Initialize mode" useEffect might detect 2 payments and switch to Mixed?
            // YES. The useEffect checking `activeTab.payments` will switch it to Mixed if I set 2 payments.

            // Solution: Don't update parent state immediately for Down Payment?
            // OR: Update useEffect to NOT switch to mixed if we are currently editing Down Payment?
            // Better: Let the user enter the amount, and only update parent state 
            // when they blur or maybe just update parent but keep UI in "Simple Credit" via a flag?

            // Actually, for "Simple Credit with Down Payment", it effectively IS a mixed payment.
            // But the user wants the UI to look "Simple".
            // If I update `onSetPayments` with 2 payments, the useEffect will fire and set Mode to Mixed.
            // I need to prevent that.

            // Let's modify the useEffect to only set mode if we are NOT currently interacting?
            // Or better: The useEffect should only run on Mount or major external changes?
            // It runs on `activeTab.payments`.

            // Plan: Update the payments immediately. 
            // MODIFY useEffect to respect "Simple Credit with Down Payment" as a valid "Simple" state?
            // Or easier: Just disable the auto-switch effect if we are interacting.

            // Let's try to be smart:
            // If payments = [Cash, Credit] AND we are in "Simple" mode with "Credit" selected, 
            // AND the amounts match Total, then KEEP Simple mode.

            const rest = total - dpAmount;
            if (rest > 0) {
                onSetPayments([
                    { method: "cash", amount: dpAmount },
                    { method: "credit", amount: rest }
                ]);
            } else {
                // If down payment >= total, it's just Cash
                onSetPayments([{ method: "cash", amount: total }]);
                setSelectedSimpleMethod("cash");
                setDownPayment("");
            }
        } else {
            // Revert to full credit
            onSetPayments([{ method: "credit", amount: total }]);
        }
    };

    // REVISED USE EFFECT to prevent jumping to Mixed
    useEffect(() => {
        if (!activeTab.payments) return;

        if (activeTab.payments.length > 1) {
            // Check if it's the specific case of Credit + Cash (Down Payment)
            const methods = activeTab.payments.map(p => p.method);
            if (methods.includes("credit") && methods.includes("cash") && methods.length === 2 && mode === "simple" && selectedSimpleMethod === "credit") {
                // It's our special case, don't switch to Mixed
                return;
            }
            // Otherwise, switch to mixed
            setMode("mixed");
        } else if (activeTab.payments.length === 1) {
            if (Math.abs(activeTab.payments[0].amount - total) < 0.01) {
                setMode("simple");
                setSelectedSimpleMethod(activeTab.payments[0].method);
            } else {
                setMode("mixed");
            }
        }
    }, [activeTab.payments, total]);
    // Note: removed `mode` and `selectedSimpleMethod` from deps to avoid loop? 
    // No, I need them to check the special case. 
    // Let's rely on the previous logic but add the exception.

    // Sort customers: "Consumidor Final" first, then alphabetical
    const sortedCustomers = [...customers].sort((a, b) => {
        if (a.name === "Consumidor Final") return -1;
        if (b.name === "Consumidor Final") return 1;
        return a.name.localeCompare(b.name);
    });

    // Calculate totals
    const totalPaid = (activeTab.payments || []).reduce((sum, p) => sum + p.amount, 0);
    const remaining = total - totalPaid;

    // Auto-fill amount with remaining when remaining changes
    useEffect(() => {
        if (remaining > 0) {
            setAmount(remaining.toFixed(2));
        } else {
            setAmount("");
        }
    }, [remaining, total]);

    // AUTO-SYNC: When Total changes (e.g. discount), update the Simple Payment amount
    // preventing the UI from switching to "Mixed" due to mismatch.
    useEffect(() => {
        if (mode === "simple" && activeTab.payments?.length === 1) {
            const currentPayment = activeTab.payments[0];
            // If the amount doesn't match the new total, update it!
            if (Math.abs(currentPayment.amount - total) > 0.01) {
                // We don't want to trigger this if we are in the middle of editing a down payment?
                // Down payment case has 2 payments, so length === 2. This block handles length === 1.
                // So safe for standard Simple Cash/Card/etc.
                onSetPayments([{ method: currentPayment.method, amount: total }]);
            }
        }
    }, [total, mode, activeTab.payments, onSetPayments]);

    const handleAddPaymentInternal = () => {
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) return;

        if (method === "credit" && !activeTab.customerId) {
            alert("Debe seleccionar un cliente para pagos a crédito (fiado).");
            return;
        }

        onAddPayment({ method, amount: numAmount });
        setMethod("cash");
    };

    const handleSwitchToMixed = () => {
        setMode("mixed");
        // Clear existing "Simple" payments to start fresh? 
        // Or keep them as starting point? Keep them.
    };

    const isFullyPaid = remaining <= 0.01;

    return (
        <div className="w-full lg:w-[450px] flex flex-col bg-card lg:border-l border-border shadow-2xl z-10">
            <div className="flex-1 p-4 md:p-6 space-y-4 md:space-y-6 overflow-y-auto">

                {/* 1. SELECCIÓN DE CLIENTE */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                            <User className="h-4 w-4" /> Cliente
                        </h3>
                        {activeTab.customerId && (
                            <span className="text-[10px] text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                Seleccionado
                            </span>
                        )}
                    </div>
                    <Select
                        value={activeTab.customerId || "default"}
                        onValueChange={(val) => onCustomerChange(val)}
                    >
                        <SelectTrigger className="w-full h-10 bg-background border-input text-foreground focus:ring-emerald-500/50">
                            <SelectValue placeholder="Seleccionar cliente" />
                        </SelectTrigger>
                        <SelectContent>
                            <div className="p-2 sticky top-0 bg-popover z-10 pb-2 border-b mb-2">
                                <div className="relative">
                                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <input
                                        className="w-full bg-background border border-input rounded-md py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 placeholder:text-muted-foreground text-foreground"
                                        placeholder="Filtrar clientes..."
                                        onKeyDown={(e) => e.stopPropagation()}
                                    />
                                </div>
                            </div>
                            {sortedCustomers.map((customer) => (
                                <SelectItem
                                    key={customer.id}
                                    value={customer.id}
                                    className="cursor-pointer"
                                >
                                    <div className="flex flex-col">
                                        <span className="font-medium">{customer.name}</span>
                                        <span className="text-xs text-muted-foreground capitalize">
                                            {customer.customer_type === 'wholesale' ? 'Mayorista' : 'Minorista'}
                                        </span>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="h-px bg-border" />

                {/* 2. MÉTODOS DE PAGO (GRID PRINCIPAL) */}
                <div className="space-y-4">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                        <Wallet className="h-4 w-4" /> Forma de Pago
                    </h3>
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                        {paymentMethods.map((m) => {
                            const Icon = methodIcons[m.iconName];
                            // Is active if mode is simple AND method matches
                            const isActive = mode === "simple" && selectedSimpleMethod === m.value;

                            return (
                                <button
                                    key={m.value}
                                    onClick={() => handleSimpleMethodSelect(m.value)}
                                    className={cn(
                                        "flex flex-col items-center justify-center gap-2 p-3 md:p-4 rounded-xl border-2 transition-all duration-200 min-h-[80px] md:min-h-[90px]",
                                        isActive
                                            ? "bg-emerald-500/10 border-emerald-500 text-emerald-500 shadow-md"
                                            : "bg-background border-transparent text-muted-foreground hover:bg-muted hover:border-border hover:text-foreground"
                                    )}
                                >
                                    <Icon className={cn("h-5 w-5 md:h-6 md:w-6", isActive && "animate-bounce")} />
                                    <span className="text-xs font-medium text-center">{m.label}</span>
                                </button>
                            );
                        })}

                        {/* BOTÓN MIXTO */}
                        <button
                            onClick={handleSwitchToMixed}
                            className={cn(
                                "flex flex-col items-center justify-center gap-2 p-3 md:p-4 rounded-xl border-2 transition-all duration-200 min-h-[80px] md:min-h-[90px]",
                                mode === "mixed"
                                    ? "bg-blue-500/10 border-blue-500 text-blue-500 shadow-md"
                                    : "bg-background border-transparent text-muted-foreground hover:bg-muted hover:border-border hover:text-foreground"
                            )}
                        >
                            <Wallet className={cn("h-5 w-5 md:h-6 md:w-6", mode === "mixed" && "animate-pulse")} />
                            <span className="text-xs font-medium text-center">Mixto</span>
                        </button>
                    </div>

                    {/* INPUT DE ENTREGA PARA FIADO (SOLO EN MODO SIMPLE + CRÉDITO) */}
                    {mode === "simple" && selectedSimpleMethod === "credit" && (
                        <div className="pt-2 animate-in fade-in slide-in-from-top-2">
                            <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-lg space-y-2">
                                <label className="text-xs font-medium text-muted-foreground flex items-center justify-between">
                                    <span>¿Entrega inicial? (Opcional)</span>
                                    {downPayment && <span className="text-emerald-600 font-bold">- ${parseFloat(downPayment || "0").toLocaleString()}</span>}
                                </label>
                                <div className="flex gap-2 items-center">
                                    <div className="relative flex-1">
                                        <span className="absolute left-3 top-2.5 text-muted-foreground text-xs">$</span>
                                        <Input
                                            type="number"
                                            className="pl-6 h-9 text-sm bg-background"
                                            placeholder="0.00"
                                            value={downPayment}
                                            onChange={(e) => handleDownPaymentChange(e.target.value)}
                                        />
                                    </div>
                                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                                        Resto a Cuenta:
                                        <span className="font-bold text-foreground ml-1">
                                            ${Math.max(0, total - (parseFloat(downPayment) || 0)).toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 3. DETALLES DE PAGO (SOLO EN MODO MIXTO) */}
                {mode === "mixed" && (
                    <div className="space-y-4 pt-4 border-t border-dashed animate-in fade-in slide-in-from-top-4 duration-300">
                        <div className="flex justify-between items-end">
                            <span className="text-sm font-medium text-muted-foreground">Pagos Agregados</span>
                            <div className="text-right">
                                <span className={cn(
                                    "text-sm font-bold",
                                    remaining > 0.01 ? "text-amber-500" : "text-emerald-500"
                                )}>
                                    Restante: ${Math.max(0, remaining).toLocaleString("es-AR")}
                                </span>
                            </div>
                        </div>

                        {/* Lista */}
                        <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
                            {activeTab.payments.length === 0 && (
                                <p className="text-center text-xs text-muted-foreground italic py-2">
                                    Agrega pagos para completar el total
                                </p>
                            )}
                            {activeTab.payments.map((payment, index) => {
                                const Icon = methodIcons[paymentMethods.find(m => m.value === payment.method)?.iconName || "Banknote"];
                                return (
                                    <div key={index} className="flex items-center justify-between p-2 rounded bg-muted/50 border border-border text-xs">
                                        <div className="flex items-center gap-2">
                                            <Icon className="h-3 w-3 text-muted-foreground" />
                                            <span className="capitalize">{paymentMethods.find(m => m.value === payment.method)?.label}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono font-medium">${payment.amount.toLocaleString()}</span>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-destructive hover:text-destructive"
                                                onClick={() => onRemovePayment(index)}
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Builder */}
                        {remaining > 0.01 && (
                            <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                    {paymentMethods.map((m) => {
                                        const Icon = methodIcons[m.iconName];
                                        const isSelected = method === m.value;
                                        return (
                                            <button
                                                key={m.value}
                                                onClick={() => setMethod(m.value)}
                                                className={cn(
                                                    "flex items-center gap-2 p-2 rounded-md border text-xs transition-all",
                                                    isSelected
                                                        ? "bg-primary text-primary-foreground border-primary"
                                                        : "bg-background hover:bg-muted"
                                                )}
                                            >
                                                <Icon className="h-3 w-3" />
                                                {m.label}
                                            </button>
                                        )
                                    })}
                                </div>
                                <div className="flex gap-2">
                                    <Input
                                        type="number"
                                        className="h-9 text-sm"
                                        placeholder="Monto"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleAddPaymentInternal();
                                        }}
                                    />
                                    <Button size="sm" onClick={handleAddPaymentInternal} disabled={!amount || parseFloat(amount) <= 0}>
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* AREA DE CONFIRMACION */}
            <div className="p-4 md:p-6 bg-card/50 backdrop-blur-sm border-t border-border">
                {/* Descuentos y Recargos */}
                <div className="flex gap-2 mb-4">
                    <div className="flex-1">
                        <label className="text-[10px] text-muted-foreground uppercase font-bold">Descuento ($)</label>
                        <div className="relative">
                            <input
                                type="number"
                                className="w-full bg-background border border-input rounded px-2 py-2 md:py-1 text-sm text-right focus:outline-none focus:border-primary h-10 md:h-auto"
                                placeholder="0.00"
                                value={discount > 0 ? discount : ""}
                                onChange={(e) => onUpdateDiscount(parseFloat(e.target.value) || 0)}
                            />
                        </div>
                    </div>
                    <div className="flex-1">
                        <label className="text-[10px] text-muted-foreground uppercase font-bold">Recargo ($)</label>
                        <div className="relative">
                            <input
                                type="number"
                                className="w-full bg-background border border-input rounded px-2 py-2 md:py-1 text-sm text-right focus:outline-none focus:border-primary h-10 md:h-auto"
                                placeholder="0.00"
                                value={surcharge > 0 ? surcharge : ""}
                                onChange={(e) => onUpdateSurcharge(parseFloat(e.target.value) || 0)}
                            />
                        </div>
                    </div>
                </div>

                <div className="flex justify-between text-muted-foreground mb-4 text-sm">
                    <span>Total Venta</span>
                    <span className="text-foreground font-bold">${total.toLocaleString("es-AR")}</span>
                </div>

                <Button
                    className={cn(
                        "w-full h-12 md:h-14 text-base md:text-lg font-bold shadow-xl transition-all duration-300 relative overflow-hidden group",
                        (!isFullyPaid && mode === "mixed")
                            ? "bg-muted text-muted-foreground cursor-not-allowed"
                            : "bg-emerald-600 hover:bg-emerald-500 hover:shadow-emerald-500/25 hover:-translate-y-0.5 text-white"
                    )}
                    disabled={(!isFullyPaid && mode === "mixed") || activeTab.cart.length === 0 || processing}
                    onClick={onProcessSale}
                >
                    {processing ? (
                        <div className="flex items-center gap-2">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span>Procesando...</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <Receipt className="h-5 w-5" />
                            <span>Confirmar {mode === "simple" ? `(${paymentMethods.find(m => m.value === selectedSimpleMethod)?.label})` : "Mixto"}</span>
                        </div>
                    )}
                </Button>

                {mode === "mixed" && !isFullyPaid && (
                    <div className="mt-3 flex items-center justify-center gap-2 text-amber-500/80 text-xs bg-amber-500/10 py-2 rounded-lg">
                        <AlertCircle className="h-3 w-3" />
                        <span>Completa el pago para confirmar</span>
                    </div>
                )}

                {/* SUPPLIER PAYMENT SECTION */}
                <div className="mt-4 pt-4 border-t border-dashed">
                    <h4 className="text-xs font-bold uppercase text-muted-foreground mb-2 flex items-center gap-2">
                        <Building className="h-4 w-4" /> Pago a Proveedor (Opcional)
                    </h4>
                    <div className="space-y-2">
                        <Select
                            value={supplierPayment?.supplierId || "none"}
                            onValueChange={(val) => {
                                const newSupplierId = val === "none" ? "" : val;
                                const newPayment = { ...supplierPayment, supplierId: newSupplierId, amount: supplierPayment?.amount || "" };
                                setSupplierPayment(newPayment);

                                // Notify parent
                                if (onSupplierPaymentChange) {
                                    if (newSupplierId && parseFloat(newPayment.amount) > 0) {
                                        onSupplierPaymentChange({ supplierId: newSupplierId, amount: parseFloat(newPayment.amount) });
                                    } else {
                                        onSupplierPaymentChange(null);
                                    }
                                }
                            }}
                        >
                            <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Seleccionar Proveedor..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">-- Ninguno --</SelectItem>
                                {suppliers.map(s => (
                                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {supplierPayment?.supplierId && (
                            <div className="flex gap-2 items-center animate-in fade-in slide-in-from-top-1">
                                <span className="text-xs text-muted-foreground">Monto:</span>
                                <div className="relative flex-1">
                                    <span className="absolute left-2 top-1.5 text-xs">$</span>
                                    <Input
                                        type="number"
                                        className="h-7 text-xs pl-5"
                                        placeholder="0.00"
                                        value={supplierPayment.amount}
                                        onChange={(e) => {
                                            const newAmount = e.target.value;
                                            const newPayment = { ...supplierPayment!, amount: newAmount };
                                            setSupplierPayment(newPayment);

                                            // Notify parent
                                            if (onSupplierPaymentChange) {
                                                if (newPayment.supplierId && parseFloat(newAmount) > 0) {
                                                    onSupplierPaymentChange({ supplierId: newPayment.supplierId, amount: parseFloat(newAmount) });
                                                } else {
                                                    onSupplierPaymentChange(null);
                                                }
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
