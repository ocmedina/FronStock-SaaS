import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, FileText, Globe, AlertCircle } from "lucide-react";
import { CreateInvoiceData, INVOICE_TYPES, InvoiceType } from "./types";
import { createClient } from "@/lib/supabase/client";

interface CreateInvoiceModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    organizationId: string;
    preselectedOrder?: any; // Added prop
}

export function CreateInvoiceModal({
    open,
    onOpenChange,
    onSuccess,
    organizationId,
    preselectedOrder,
}: CreateInvoiceModalProps) {
    const [loading, setLoading] = useState(false);
    const [sales, setSales] = useState<any[]>([]);
    const [orders, setOrders] = useState<any[]>([]);
    const [invoiceSource, setInvoiceSource] = useState<"sale" | "order">("sale");
    const [customers, setCustomers] = useState<any[]>([]);
    const [selectedSaleId, setSelectedSaleId] = useState<string | undefined>(undefined);
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | undefined>(undefined);
    const [invoiceType, setInvoiceType] = useState<InvoiceType>("B");
    const [withArca, setWithArca] = useState(false);
    const [cuit, setCuit] = useState("");
    const [cuitError, setCuitError] = useState("");

    const supabase = createClient();

    // Fetch pending sales and customers when modal opens
    useEffect(() => {
        if (open && organizationId) {
            if (preselectedOrder) {
                // If preselected order, just setup that data
                handlePreselectedOrder();
            } else {
                fetchData();
            }
        }
    }, [open, organizationId, preselectedOrder]);

    const handlePreselectedOrder = async () => {
        // Mock a sale object from the order to make it compatible with the form
        const mockOrder = {
            id: preselectedOrder.id,
            created_at: preselectedOrder.created_at,
            total: preselectedOrder.total,
            customer_id: preselectedOrder.customer_id,
            customers: preselectedOrder.customer,
            is_order: true // Flag to identify it's an order
        };

        setInvoiceSource("order");
        setOrders([mockOrder]);
        setSelectedSaleId(mockOrder.id);

        // Fetch customers for the dropdown just in case they want to change it (though usually fixed for order)
        // or we just use the one from order
        if (preselectedOrder.customer_id) {
            // We might need to fetch this customer's CUIT if not in the order object
            const { data } = await supabase.from('customers').select('*').eq('id', preselectedOrder.customer_id).single();
            if (data) {
                setCustomers([data]);
                setSelectedCustomerId(data.id);
                if (data.cuit) setCuit(data.cuit);
            }
        } else {
            // Fetch all if no customer or clean state
            const { data } = await supabase.from("customers").select("id, name, cuit").eq("organization_id", organizationId).order("name");
            setCustomers(data || []);
        }
    };

    const fetchData = async () => {
        console.log("[FETCH] CreateInvoiceModal: Fetching data...", { organizationId, open });

        try {
            // Fetch sales
            const { data: salesData } = await supabase
                .from("sales")
                .select("id, created_at, total, customer_id, status, customers(name, cuit)")
                .eq("organization_id", organizationId)
                .eq("status", "completed")
                .order("created_at", { ascending: false })
                .limit(50);

            // Fetch orders
            const { data: ordersData } = await supabase
                .from("orders")
                .select("id, created_at, total, customer_id, lifecycle_status, delivery_status, customer:customers(name, cuit)")
                .eq("organization_id", organizationId)
                .or("lifecycle_status.in.(delivered,completed),delivery_status.in.(delivered,completed)")
                .order("created_at", { ascending: false })
                .limit(50);

            // Filter out already invoiced
            const { data: invoices } = await supabase
                .from("invoices")
                .select("sale_id, order_id")
                .eq("organization_id", organizationId);

            const invoicedSaleIds = new Set(invoices?.map((i) => i.sale_id).filter(Boolean) || []);
            const invoicedOrderIds = new Set(invoices?.map((i) => i.order_id).filter(Boolean) || []);

            if (salesData) {
                const pending = salesData.filter((s) => !invoicedSaleIds.has(s.id));
                setSales(pending);
            }

            if (ordersData) {
                const pendingOrders = ordersData.filter(o => !invoicedOrderIds.has(o.id)).map(o => ({
                    ...o,
                    customers: o.customer,
                    is_order: true
                }));
                setOrders(pendingOrders);
            }

            // Fetch customers
            const { data: customersData, error: customersError } = await supabase
                .from("customers")
                .select("id, name, cuit")
                .eq("organization_id", organizationId)
                .order("name");



            if (customersError) {
                console.error("[ERROR] Error fetching customers:", customersError);
            }

            if (customersData) {
                setCustomers(customersData);
            }
        } catch (error) {
            console.error("[ERROR] Error in fetchData:", error);
        }
    };

    // Validate CUIT format (XX-XXXXXXXX-X)
    const validateCuit = (value: string): boolean => {
        const cuitRegex = /^\d{2}-\d{8}-\d{1}$/;
        return cuitRegex.test(value);
    };

    const handleCuitChange = (value: string) => {
        setCuit(value);
        if (value && !validateCuit(value)) {
            setCuitError("Formato inválido. Use: XX-XXXXXXXX-X");
        } else {
            setCuitError("");
        }
    };

    // Auto-fill customer when item is selected
    useEffect(() => {
        if (selectedSaleId && !preselectedOrder) {
            const list = invoiceSource === "order" ? orders : sales;
            const selectedItem = list.find((s) => s.id === selectedSaleId);

            if (selectedItem?.customer_id) {
                setSelectedCustomerId(selectedItem.customer_id);

                // Also auto-fill CUIT if available
                const customer = customers.find((c) => c.id === selectedItem.customer_id);
                if (customer?.cuit) {
                    setCuit(customer.cuit);
                    setCuitError("");
                }
            } else {
                setSelectedCustomerId(undefined);
                setCuit("");
            }
        }
    }, [selectedSaleId, sales, orders, invoiceSource, customers, preselectedOrder]);

    // Auto-fill CUIT when customer is selected manually
    const handleCustomerChange = (customerId: string | undefined) => {
        setSelectedCustomerId(customerId);
        if (!customerId) {
            setCuit("");
            return;
        }
        const customer = customers.find((c) => c.id === customerId);
        if (customer?.cuit) {
            setCuit(customer.cuit);
            setCuitError("");
        } else {
            setCuit("");
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedSaleId) {
            alert("Por favor selecciona una venta");
            return;
        }

        // Validate CUIT for type A invoices
        if (invoiceType === "A" && !validateCuit(cuit)) {
            setCuitError("CUIT es requerido y debe tener formato válido para Factura A");
            return;
        }

        setLoading(true);

        try {
            const list = invoiceSource === "order" || preselectedOrder ? orders : sales;
            const selectedItem = list.find((s) => s.id === selectedSaleId);

            if (!selectedItem) {
                throw new Error("Elemento a facturar no encontrado");
            }

            // Customer logic
            const finalCustomerId = selectedCustomerId || null;
            const finalCuit = cuit || null;

            // Call Server Action
            // This handles Numbering (RPC) + AFIP (Simulation/Real) + DB Insert
            const { generateInvoiceAction } = await import('@/app/(dashboard)/dashboard/invoices/actions');

            const isOrder = selectedItem.is_order;

            const result = await generateInvoiceAction(
                organizationId,
                isOrder ? null : selectedSaleId, // saleId
                invoiceType,
                finalCustomerId,
                finalCuit,
                selectedItem.total,
                withArca,
                isOrder ? selectedSaleId : null // orderId
            );

            if (!result.success) {
                throw new Error(result.error);
            }

            alert(`Factura creada exitosamente. ${withArca ? '(Con CAE Simulado)' : ''}`);
            onSuccess();
            onOpenChange(false);

            // Reset form
            setSelectedSaleId(undefined);
            setSelectedCustomerId(undefined);
            setWithArca(false);
            setCuit("");
            setCuitError("");
        } catch (error: any) {
            console.error("Error creating invoice:", error);
            alert(`Error al crear la factura: ${error.message || "Error desconocido"}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        Nueva Factura
                    </DialogTitle>
                    <DialogDescription>
                        Selecciona un pedido o una venta para generar su comprobante correspondiente y sincronizar con AFIP.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-2">
                    {/* Switch Source */}
                    {!preselectedOrder && (
                        <div className="flex gap-2 mb-2 p-1 bg-slate-100 rounded-lg w-fit transition-colors">
                            <button
                                type="button"
                                onClick={() => { setInvoiceSource("sale"); setSelectedSaleId(undefined); }}
                                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${invoiceSource === "sale" ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700"}`}
                            >
                                Ventas
                            </button>
                            <button
                                type="button"
                                onClick={() => { setInvoiceSource("order"); setSelectedSaleId(undefined); }}
                                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${invoiceSource === "order" ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700"}`}
                            >
                                Pedidos
                            </button>
                        </div>
                    )}

                    {/* Venta a Facturar */}
                    <div className="space-y-2">
                        <Label>Elemento a Facturar</Label>
                        <Select value={selectedSaleId || undefined} onValueChange={setSelectedSaleId}>
                            <SelectTrigger>
                                <SelectValue placeholder={`Seleccione ${invoiceSource === 'order' ? 'un pedido' : 'una venta'}...`} />
                            </SelectTrigger>
                            <SelectContent>
                                {invoiceSource === "sale" ? (
                                    sales.length === 0 ? (
                                        <SelectItem value="none" disabled>
                                            No hay ventas pendientes
                                        </SelectItem>
                                    ) : (
                                        sales.map((sale) => (
                                            <SelectItem key={sale.id} value={sale.id}>
                                                {new Date(sale.created_at).toLocaleDateString()} - $
                                                {sale.total}
                                                {sale.customers?.name
                                                    ? ` (${sale.customers.name})`
                                                    : " (Consumidor Final)"}
                                            </SelectItem>
                                        ))
                                    )
                                ) : (
                                    orders.length === 0 ? (
                                        <SelectItem value="none" disabled>
                                            No hay pedidos pendientes
                                        </SelectItem>
                                    ) : (
                                        orders.map((order) => (
                                            <SelectItem key={order.id} value={order.id}>
                                                {new Date(order.created_at).toLocaleDateString()} - $
                                                {order.total}
                                                {order.customers?.name
                                                    ? ` (${order.customers.name})`
                                                    : " (Consumidor Final)"}
                                            </SelectItem>
                                        ))
                                    )
                                )}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Cliente (opcional) */}
                    <div className="space-y-2">
                        <Label>Cliente (opcional)</Label>
                        <Select
                            value={selectedCustomerId || undefined}
                            onValueChange={handleCustomerChange}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Sin cliente - Consumidor Final" />
                            </SelectTrigger>
                            <SelectContent>
                                {customers.map((customer) => (
                                    <SelectItem key={customer.id} value={customer.id}>
                                        {customer.name}
                                        {customer.cuit && ` - ${customer.cuit}`}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Tipo de Factura */}
                        <div className="space-y-2">
                            <Label>Tipo de Factura</Label>
                            <Select
                                value={invoiceType}
                                onValueChange={(v: InvoiceType) => setInvoiceType(v)}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {INVOICE_TYPES.map((type) => (
                                        <SelectItem key={type.value} value={type.value}>
                                            {type.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* CUIT */}
                        <div className="space-y-2">
                            <Label>
                                CUIT {invoiceType === "A" && <span className="text-red-500">*</span>}
                            </Label>
                            <Input
                                value={cuit}
                                onChange={(e) => handleCuitChange(e.target.value)}
                                placeholder="20-12345678-9"
                                className={cuitError ? "border-red-500" : ""}
                            />
                            {cuitError && (
                                <div className="flex items-center gap-1 text-xs text-red-500">
                                    <AlertCircle className="h-3 w-3" />
                                    {cuitError}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Facturar con ARCA */}
                    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl border">
                        <div className="flex items-center gap-3">
                            <div
                                className={`p-2 rounded-lg ${withArca
                                    ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                                    : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                                    }`}
                            >
                                <Globe className="h-5 w-5" />
                            </div>
                            <div>
                                <Label className="text-base cursor-pointer" htmlFor="arca-mode">
                                    Facturar con ARCA
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    Generar CAE electrónico (AFIP)
                                </p>
                            </div>
                        </div>
                        <Switch
                            id="arca-mode"
                            checked={withArca}
                            onCheckedChange={setWithArca}
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end pt-2 gap-2">
                        <Button
                            variant="outline"
                            type="button"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading || !selectedSaleId}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Generar Factura
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
