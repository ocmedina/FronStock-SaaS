import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
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
import { Loader2, FileText, Globe } from "lucide-react";
import { CreateInvoiceData, INVOICE_TYPES, InvoiceType } from "./types";
import { createClient } from "@/lib/supabase/client";

interface CreateInvoiceModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    organizationId: string;
}

export function CreateInvoiceModal({
    open,
    onOpenChange,
    onSuccess,
    organizationId,
}: CreateInvoiceModalProps) {
    const [loading, setLoading] = useState(false);
    const [sales, setSales] = useState<any[]>([]);
    const [selectedSaleId, setSelectedSaleId] = useState("");
    const [invoiceType, setInvoiceType] = useState<InvoiceType>("B"); // Default to Consumidor Final
    const [withArca, setWithArca] = useState(false);
    const [cuit, setCuit] = useState("");

    const supabase = createClient();

    // Fetch pending sales when modal opens
    useEffect(() => {
        if (open && organizationId) {
            fetchPendingSales();
        }
    }, [open, organizationId]);

    const fetchPendingSales = async () => {
        // Only fetch sales that don't have an invoice yet
        // This requires a left join or a not exists query, 
        // for simplicity we'll fetch recent sales and filter in client or use a more complex query
        // Ideally: select * from sales where id not in (select sale_id from invoices)

        // For MVP: Fetch last 50 sales
        const { data: salesData } = await supabase
            .from("sales")
            .select("*, customers(name, tax_id)")
            .eq("organization_id", organizationId)
            .eq("status", "completed")
            .order("created_at", { ascending: false })
            .limit(50);

        // Filter out sales that already have an invoice
        const { data: invoices } = await supabase
            .from("invoices")
            .select("sale_id")
            .eq("organization_id", organizationId);

        const invoicedSaleIds = new Set(invoices?.map(i => i.sale_id) || []);

        if (salesData) {
            const pending = salesData.filter(s => !invoicedSaleIds.has(s.id));
            setSales(pending);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSaleId) return;

        setLoading(true);

        try {
            const selectedSale = sales.find(s => s.id === selectedSaleId);

            // Simulate invoice number generation (e.g. get max and increment)
            const invoiceNumber = `0001-${Math.floor(Math.random() * 1000000).toString().padStart(8, '0')}`;

            const invoiceData: any = {
                organization_id: organizationId,
                sale_id: selectedSaleId,
                customer_id: selectedSale.customer_id,
                invoice_number: invoiceNumber,
                type: invoiceType,
                total: selectedSale.total,
                status: 'issued',
                afip_status: withArca ? 'pending' : 'pending', // Both pending initially if simulated
            };

            if (withArca) {
                // Simulate ARCA process
                // In a real app, this would call a server-side action to contact AFIP via WSFE
                invoiceData.cae = "SimulatedCAE123456789";
                invoiceData.cae_expiration = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(); // 10 days
                invoiceData.afip_status = 'authorised';
            }

            const { error } = await supabase.from("invoices").insert(invoiceData);

            if (error) throw error;

            onSuccess();
            onOpenChange(false);

            // Reset form
            setSelectedSaleId("");
            setWithArca(false);
            setCuit("");

        } catch (error) {
            console.error("Error creating invoice:", error);
            alert("Error al crear la factura");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        Nueva Factura
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label>Venta a Facturar</Label>
                        <Select value={selectedSaleId} onValueChange={setSelectedSaleId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccione una venta..." />
                            </SelectTrigger>
                            <SelectContent>
                                {sales.length === 0 ? (
                                    <SelectItem value="none" disabled>No hay ventas pendientes</SelectItem>
                                ) : (
                                    sales.map((sale) => (
                                        <SelectItem key={sale.id} value={sale.id}>
                                            {new Date(sale.created_at).toLocaleDateString()} - ${sale.total}
                                            {sale.customers?.name ? ` (${sale.customers.name})` : ' (Consumidor Final)'}
                                        </SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Tipo de Factura</Label>
                            <Select value={invoiceType} onValueChange={(v: InvoiceType) => setInvoiceType(v)}>
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

                        <div className="space-y-2">
                            <Label>CUIT {invoiceType !== 'B' && '*'}</Label>
                            <Input
                                value={cuit}
                                onChange={(e) => setCuit(e.target.value)}
                                placeholder="20-12345678-9"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl border">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${withArca ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                                <Globe className="h-5 w-5" />
                            </div>
                            <div>
                                <Label className="text-base cursor-pointer" htmlFor="arca-mode">Facturar con ARCA</Label>
                                <p className="text-xs text-muted-foreground">Generar CAE electrónico (AFIP)</p>
                            </div>
                        </div>
                        <Switch
                            id="arca-mode"
                            checked={withArca}
                            onCheckedChange={setWithArca}
                        />
                    </div>

                    <div className="flex justify-end pt-2 gap-2">
                        <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
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
