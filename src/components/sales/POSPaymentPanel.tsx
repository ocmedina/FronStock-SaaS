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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Customer, SaleTab, PaymentMethod, paymentMethods } from "./types";

interface POSPaymentPanelProps {
    activeTab: SaleTab;
    customers: Customer[];
    subtotal: number;
    total: number;
    onCustomerChange: (id: string) => void;
    onPaymentMethodChange: (method: PaymentMethod) => void;
    onProcessSale: () => void;
    processing: boolean;
}

const methodIcons: Record<string, any> = {
    Banknote,
    CreditCard,
    Building,
    User,
};

export function POSPaymentPanel({
    activeTab,
    customers,
    subtotal,
    total,
    onCustomerChange,
    onPaymentMethodChange,
    onProcessSale,
    processing,
}: POSPaymentPanelProps) {
    // Sort customers: "Consumidor Final" first, then alphabetical
    const sortedCustomers = [...customers].sort((a, b) => {
        if (a.name === "Consumidor Final") return -1;
        if (b.name === "Consumidor Final") return 1;
        return a.name.localeCompare(b.name);
    });

    return (
        <div className="w-full lg:w-[400px] flex flex-col bg-card border-l border-border shadow-2xl z-10">
            <div className="flex-1 p-6 space-y-8 overflow-y-auto">
                {/* Sección Cliente */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                            <User className="h-4 w-4" /> Cliente
                        </h3>
                        {activeTab.customerId && (
                            <span className="text-xs text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20">
                                Cliente Seleccionado
                            </span>
                        )}
                    </div>
                    <Select
                        value={activeTab.customerId || "default"}
                        onValueChange={(val) => onCustomerChange(val)}
                    >
                        <SelectTrigger className="w-full h-12 bg-background border-input text-foreground focus:ring-emerald-500/50">
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
                                        onChange={(e) => {
                                            // Simple filter implementation could go here or be passed as prop
                                            // For now relying on native select behavior + scroll
                                        }}
                                    />
                                </div>
                            </div>
                            {sortedCustomers.map((customer) => (
                                <SelectItem
                                    key={customer.id}
                                    value={customer.id}
                                    className="cursor-pointer focus:bg-emerald-500/10 focus:text-emerald-500"
                                >
                                    <div className="flex flex-col">
                                        <span className="font-medium">{customer.name}</span>
                                        <span className="text-xs text-muted-foreground capitalize">
                                            {customer.customer_type}
                                        </span>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Sección Método de Pago */}
                <div className="space-y-4">
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                        <CreditCard className="h-4 w-4" /> Método de Pago
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                        {paymentMethods.map((method) => {
                            const Icon = methodIcons[method.iconName];
                            const isSelected = activeTab.paymentMethod === method.value;
                            return (
                                <button
                                    key={method.value}
                                    onClick={() => onPaymentMethodChange(method.value)}
                                    className={`
                    relative flex flex-col items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all duration-200
                    ${isSelected
                                            ? "bg-emerald-500/10 border-emerald-500 text-emerald-500 shadow-lg shadow-emerald-500/10"
                                            : "bg-background border-transparent text-muted-foreground hover:bg-muted hover:border-border hover:text-foreground"
                                        }
                  `}
                                >
                                    <Icon
                                        className={`h-6 w-6 ${isSelected ? "animate-bounce" : ""}`}
                                    />
                                    <span className="text-sm font-medium">{method.label}</span>
                                    {isSelected && (
                                        <div className="absolute top-2 right-2">
                                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Resumen de Totales */}
                <div className="space-y-4 pt-4 border-t border-border">
                    <div className="space-y-2">
                        <div className="flex justify-between text-muted-foreground">
                            <span>Subtotal</span>
                            <span>${subtotal.toLocaleString("es-AR")}</span>
                        </div>
                        {/* Descuentos o impuestos podrían ir aquí */}
                        <div className="flex justify-between items-end pt-4">
                            <span className="text-lg font-medium text-foreground">Total a Pagar</span>
                            <div className="text-right">
                                <span className="block text-3xl font-bold text-emerald-500 tracking-tight">
                                    ${total.toLocaleString("es-AR")}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {activeTab.cart.length} items
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Botón de Procesar */}
            <div className="p-6 bg-card/50 backdrop-blur-sm border-t border-border">
                <Button
                    className={`w-full h-14 text-lg font-bold shadow-xl transition-all duration-300 relative overflow-hidden group
            ${activeTab.cart.length === 0
                            ? "bg-muted text-muted-foreground cursor-not-allowed"
                            : "bg-emerald-600 hover:bg-emerald-500 hover:shadow-emerald-500/25 hover:-translate-y-0.5 text-white"
                        }
          `}
                    disabled={activeTab.cart.length === 0 || processing}
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
                            <span>Confirmar Venta (F2)</span>
                        </div>
                    )}
                </Button>
                {activeTab.cart.length === 0 && (
                    <div className="mt-3 flex items-center justify-center gap-2 text-amber-500/80 text-xs bg-amber-500/10 py-2 rounded-lg">
                        <AlertCircle className="h-3 w-3" />
                        <span>Agrega productos para continuar</span>
                    </div>
                )}
            </div>
        </div>
    );
}
