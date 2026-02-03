"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, FileText, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { createClient } from "@/lib/supabase/client";
import { CreateSupplierInvoiceData } from "./types";

interface SupplierInvoiceModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    organizationId: string;
    purchaseOrderId?: string;
    supplierId?: string;
}

export function SupplierInvoiceModal({
    open,
    onOpenChange,
    onSuccess,
    organizationId,
    purchaseOrderId,
    supplierId,
}: SupplierInvoiceModalProps) {
    const [loading, setLoading] = useState(false);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);

    const [formData, setFormData] = useState({
        supplier_id: supplierId || "",
        purchase_order_id: purchaseOrderId || "",
        invoice_number: "",
        invoice_date: new Date(),
        due_date: undefined as Date | undefined,
        subtotal: 0,
        tax_amount: 0,
        other_taxes: 0,
        notes: "",
    });

    const supabase = createClient();

    useEffect(() => {
        if (open && organizationId) {
            fetchData();
        }
    }, [open, organizationId]);

    const fetchData = async () => {
        // Fetch suppliers
        const { data: suppliersData } = await supabase
            .from("suppliers")
            .select("id, name")
            .eq("organization_id", organizationId)
            .order("name");

        if (suppliersData) {
            setSuppliers(suppliersData);
        }

        // Fetch purchase orders
        const { data: ordersData } = await supabase
            .from("purchase_orders")
            .select("id, order_number, supplier_id, total")
            .eq("organization_id", organizationId)
            .in("status", ["pending", "ordered"])
            .order("created_at", { ascending: false });

        if (ordersData) {
            setPurchaseOrders(ordersData);
        }
    };

    const handlePurchaseOrderChange = (orderId: string) => {
        setFormData({ ...formData, purchase_order_id: orderId });

        // Auto-fill supplier and amount if PO is selected
        const order = purchaseOrders.find((o) => o.id === orderId);
        if (order) {
            setFormData({
                ...formData,
                purchase_order_id: orderId,
                supplier_id: order.supplier_id,
                subtotal: order.total,
            });
        }
    };

    const calculateTotal = () => {
        return formData.subtotal + formData.tax_amount + formData.other_taxes;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const invoiceData: any = {
                organization_id: organizationId,
                supplier_id: formData.supplier_id,
                purchase_order_id: formData.purchase_order_id || null,
                invoice_number: formData.invoice_number,
                invoice_date: format(formData.invoice_date, "yyyy-MM-dd"),
                due_date: formData.due_date
                    ? format(formData.due_date, "yyyy-MM-dd")
                    : null,
                subtotal: formData.subtotal,
                tax_amount: formData.tax_amount,
                other_taxes: formData.other_taxes,
                total: calculateTotal(),
                payment_status: "pending",
                paid_amount: 0,
                notes: formData.notes || null,
            };

            const { error } = await supabase
                .from("supplier_invoices")
                .insert(invoiceData);

            if (error) throw error;

            onSuccess();
            onOpenChange(false);
            resetForm();
        } catch (error) {
            console.error("Error creating supplier invoice:", error);
            alert("Error al crear la factura del proveedor");
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({
            supplier_id: "",
            purchase_order_id: "",
            invoice_number: "",
            invoice_date: new Date(),
            due_date: undefined,
            subtotal: 0,
            tax_amount: 0,
            other_taxes: 0,
            notes: "",
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        Registrar Factura de Proveedor
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-2">
                    {/* Orden de Compra (opcional) */}
                    <div className="space-y-2">
                        <Label>Orden de Compra (opcional)</Label>
                        <Select
                            value={formData.purchase_order_id || undefined}
                            onValueChange={handlePurchaseOrderChange}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Sin orden de compra asociada" />
                            </SelectTrigger>
                            <SelectContent>
                                {purchaseOrders.map((order) => (
                                    <SelectItem key={order.id} value={order.id}>
                                        {order.order_number} - ${order.total}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Proveedor */}
                    <div className="space-y-2">
                        <Label>
                            Proveedor <span className="text-red-500">*</span>
                        </Label>
                        <Select
                            value={formData.supplier_id}
                            onValueChange={(v) =>
                                setFormData({ ...formData, supplier_id: v })
                            }
                            required
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccionar proveedor" />
                            </SelectTrigger>
                            <SelectContent>
                                {suppliers.map((supplier) => (
                                    <SelectItem key={supplier.id} value={supplier.id}>
                                        {supplier.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Número de Factura */}
                    <div className="space-y-2">
                        <Label>
                            Número de Factura <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            value={formData.invoice_number}
                            onChange={(e) =>
                                setFormData({ ...formData, invoice_number: e.target.value })
                            }
                            placeholder="0001-00012345"
                            required
                        />
                    </div>

                    {/* Fechas */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>
                                Fecha de Emisión <span className="text-red-500">*</span>
                            </Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className="w-full justify-start text-left font-normal"
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {format(formData.invoice_date, "PPP", { locale: es })}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                        mode="single"
                                        selected={formData.invoice_date}
                                        onSelect={(date) =>
                                            date && setFormData({ ...formData, invoice_date: date })
                                        }
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="space-y-2">
                            <Label>Fecha de Vencimiento</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className="w-full justify-start text-left font-normal"
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {formData.due_date ? (
                                            format(formData.due_date, "PPP", { locale: es })
                                        ) : (
                                            <span>Seleccionar fecha</span>
                                        )}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                        mode="single"
                                        selected={formData.due_date}
                                        onSelect={(date) =>
                                            setFormData({ ...formData, due_date: date })
                                        }
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>

                    {/* Montos */}
                    <div className="space-y-3">
                        <div className="space-y-2">
                            <Label>
                                Subtotal <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={formData.subtotal}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        subtotal: parseFloat(e.target.value) || 0,
                                    })
                                }
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>IVA / Impuestos</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.tax_amount}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            tax_amount: parseFloat(e.target.value) || 0,
                                        })
                                    }
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Otros Impuestos</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.other_taxes}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            other_taxes: parseFloat(e.target.value) || 0,
                                        })
                                    }
                                />
                            </div>
                        </div>

                        <div className="p-4 bg-muted/50 rounded-lg">
                            <div className="flex justify-between items-center">
                                <span className="font-semibold">Total:</span>
                                <span className="text-2xl font-bold text-primary">
                                    ${calculateTotal().toLocaleString("es-AR", {
                                        minimumFractionDigits: 2,
                                    })}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Notas */}
                    <div className="space-y-2">
                        <Label>Notas</Label>
                        <Textarea
                            value={formData.notes}
                            onChange={(e) =>
                                setFormData({ ...formData, notes: e.target.value })
                            }
                            placeholder="Observaciones adicionales..."
                            rows={3}
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-2 pt-4">
                        <Button
                            variant="outline"
                            type="button"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading || !formData.supplier_id || !formData.invoice_number}
                        >
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Registrar Factura
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
