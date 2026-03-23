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
import { FileEdit, Loader2 } from "lucide-react";
import { INVOICE_TYPES, InvoiceType, Invoice } from "./types";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface EditInvoiceModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    invoice: Invoice | null;
    onSuccess: () => void;
    organizationId: string;
}

export function EditInvoiceModal({
    open,
    onOpenChange,
    invoice,
    onSuccess,
    organizationId,
}: EditInvoiceModalProps) {
    const [loading, setLoading] = useState(false);
    const [fetchingCustomers, setFetchingCustomers] = useState(false);
    
    const [invoiceType, setInvoiceType] = useState<InvoiceType>("B");
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>("none");
    const [createdAt, setCreatedAt] = useState<string>("");
    
    const [customers, setCustomers] = useState<any[]>([]);
    const supabase = createClient();

    // Init data when invoice is loaded
    useEffect(() => {
        if (open && invoice) {
            setInvoiceType(invoice.type as InvoiceType || "B");
            setSelectedCustomerId(invoice.customer_id || "none");
            
            // Convert to YYYY-MM-DDThh:mm format for datetime-local native input
            if (invoice.created_at) {
                const dateObj = new Date(invoice.created_at);
                const localISOTime = (new Date(dateObj.getTime() - dateObj.getTimezoneOffset() * 60000).toISOString()).slice(0, -1);
                setCreatedAt(localISOTime.substring(0, 16));
            }
        }
    }, [open, invoice]);

    // Fetch customers
    useEffect(() => {
        if (open && organizationId) {
            const fetchCustomers = async () => {
                setFetchingCustomers(true);
                const { data } = await supabase
                    .from("customers")
                    .select("id, name, cuit")
                    .eq("organization_id", organizationId)
                    .order("name");
                if (data) setCustomers(data);
                setFetchingCustomers(false);
            };
            fetchCustomers();
        }
    }, [open, organizationId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!invoice) return;

        setLoading(true);
        try {
            const dateObj = new Date(createdAt);
            
            const updates = {
                type: invoiceType,
                customer_id: selectedCustomerId === "none" ? null : selectedCustomerId,
                created_at: dateObj.toISOString()
            };

            const { error } = await supabase
                .from("invoices")
                .update(updates)
                .eq("id", invoice.id)
                .eq("organization_id", organizationId);

            if (error) throw error;

            toast.success("Comprobante actualizado correctamente.");
            onSuccess();
            onOpenChange(false);
        } catch (error: any) {
            console.error("Error updating invoice:", error);
            toast.error(`Error al actualizar: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileEdit className="h-5 w-5 text-primary" />
                        Editar Comprobante
                    </DialogTitle>
                    <DialogDescription>
                        Modifique los datos base de este comprobante.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label>Tipo de Comprobante</Label>
                        <Select value={invoiceType} onValueChange={(v) => setInvoiceType(v as InvoiceType)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccione un tipo..." />
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

                    <div className="space-y-2">
                        <Label>Cliente Asignado</Label>
                        <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId} disabled={fetchingCustomers}>
                            <SelectTrigger>
                                <SelectValue placeholder="Consumidor Final" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Consumidor Final / Sin Cliente</SelectItem>
                                {customers.map((c) => (
                                    <SelectItem key={c.id} value={c.id}>
                                        {c.name} {c.cuit ? `(${c.cuit})` : ""}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Fecha de Emisión</Label>
                        <Input
                            type="datetime-local"
                            value={createdAt}
                            onChange={(e) => setCreatedAt(e.target.value)}
                            required
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t mt-6">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Actualizar Comprobante
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
