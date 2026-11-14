"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { usePermissions } from "@/hooks/usePermissions";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Search,
    Calendar,
    ChevronLeft,
    ChevronRight,
    Eye,
    Ban,
    Receipt,
    FileText,
    CreditCard,
    Banknote,
    ArrowUpRight,
    User,
    ShoppingBag,
    Loader2,
    ScrollText
} from "lucide-react";
import { pdf } from "@react-pdf/renderer";
import { DeliveryNotePDF } from "@/components/sales/DeliveryNotePDF";
import { TicketPDF } from "@/components/sales/TicketPDF";
import { InvoicePDF } from "@/components/invoices/InvoicePDF";
import { fetchLogoBase64 } from "@/hooks/useImageToBase64";
import { getPlanDetails } from "@/config/plans";
import { toast } from "sonner";

interface Sale {
    id: string;
    customer_id: string | null;
    total: number;
    payment_method: string;
    status: string;
    payment_status?: string | null;
    channel?: string | null;
    delivery_status?: string | null;
    cancelled_at?: string | null;
    cancellation_reason?: string | null;
    created_at: string;
    customer?: { name: string; cuit?: string } | null;
    invoices?: { id: string; invoice_number: string; type: string }[];
}

interface SaleItem {
    id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    total: number;
}

export default function SalesHistoryPage() {
    const { organizationId, isLoading: orgLoading, organization } = useOrganization();
    const { canDelete } = usePermissions();
    const [sales, setSales] = useState<Sale[]>([]);
    const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
    const [saleToVoid, setSaleToVoid] = useState<Sale | null>(null);
    const [voidReason, setVoidReason] = useState("");
    const [isVoiding, setIsVoiding] = useState(false);
    const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [pdfLoading, setPdfLoading] = useState<string | null>(null);

    // Filtros
    const [dateFilter, setDateFilter] = useState<"today" | "week" | "month" | "all">("today");
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const supabase = useMemo(() => createClient(), []);

    // Reset page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [dateFilter, searchQuery, statusFilter]);

    const fetchSales = useCallback(async () => {
        if (!organizationId) return;
        setIsLoading(true);

        let query = supabase
            .from("sales")
            .select("*, customer:customers(name)")
            .eq("organization_id", organizationId)
            .order("created_at", { ascending: false });

        const { data: orgPlanData } = await supabase
            .from("organizations")
            .select("plan_type")
            .eq("id", organizationId)
            .maybeSingle();

        const planType = String(orgPlanData?.plan_type || "free");
        const planMonths = getPlanDetails(planType).limits.salesHistoryMonths;
        if (Number.isFinite(planMonths)) {
            const minDate = new Date();
            minDate.setMonth(minDate.getMonth() - Number(planMonths));
            query = query.gte("created_at", minDate.toISOString());
        }

        // Apply date filter (Backend filtering for Date)
        const now = new Date();
        if (dateFilter === "today") {
            const startOfDay = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate(),
            ).toISOString();
            query = query.gte("created_at", startOfDay);
        } else if (dateFilter === "week") {
            const startOfWeek = new Date(
                now.getTime() - 7 * 24 * 60 * 60 * 1000,
            ).toISOString();
            query = query.gte("created_at", startOfWeek);
        } else if (dateFilter === "month") {
            const startOfMonth = new Date(
                now.getFullYear(),
                now.getMonth(),
                1,
            ).toISOString();
            query = query.gte("created_at", startOfMonth);
        }

        const { data, error } = await query;
        if (error) {
            console.error("Error loading sales", error);
        }
        if (data) setSales(data);
        setIsLoading(false);
    }, [organizationId, dateFilter, supabase]);

    useEffect(() => {
        if (organizationId) fetchSales();
    }, [organizationId, fetchSales]);

    const viewSaleDetails = async (sale: Sale) => {
        setSaleItems([]); // Clear previous items to avoid stale data in PDF
        setSelectedSale(sale);

        const { data, error } = await supabase
            .from("sale_items")
            .select("*")
            .eq("sale_id", sale.id);

        if (error) {
            console.error("Error fetching items:", error);
            return;
        }

        if (data) setSaleItems(data);
    };

    const handleVoidSale = async () => {
        if (!saleToVoid) return;

        const reason = voidReason.trim();
        if (reason.length < 3) {
            toast.error("Ingresá un motivo de al menos 3 caracteres");
            return;
        }

        setIsVoiding(true);
        try {
            const { voidSaleFromHistory } = await import("@/actions/sales");
            const result = await voidSaleFromHistory(saleToVoid.id, reason);

            if (result.error) {
                toast.error(result.error);
                return;
            }

            if (result.alreadyCancelled) {
                await fetchSales();
                setSaleToVoid(null);
                setVoidReason("");
                toast.success("La venta ya estaba anulada");
                return;
            }

            setSales((current) => current.map((sale) =>
                sale.id === saleToVoid.id
                    ? {
                        ...sale,
                        status: "cancelled",
                        payment_status: "cancelled",
                        delivery_status: sale.channel === "delivery" ? "cancelled" : sale.delivery_status,
                        cancelled_at: new Date().toISOString(),
                        cancellation_reason: reason,
                    }
                    : sale
            ));
            setSelectedSale((current) =>
                current?.id === saleToVoid.id
                    ? {
                        ...current,
                        status: "cancelled",
                        payment_status: "cancelled",
                        delivery_status: current.channel === "delivery" ? "cancelled" : current.delivery_status,
                        cancelled_at: new Date().toISOString(),
                        cancellation_reason: reason,
                    }
                    : current
            );
            setSaleToVoid(null);
            setVoidReason("");
            toast.success("Venta anulada correctamente");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "No se pudo anular la venta");
        } finally {
            setIsVoiding(false);
        }
    };

    // Filter Logic (Client Side for Search)
    const filteredSales = sales.filter(sale => {
        const matchesSearch =
            (sale.customer?.name?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
            sale.id.slice(0, 8).includes(searchQuery.toLowerCase());

        const matchesStatus = statusFilter === "all" || sale.status === statusFilter; // status is usually 'completed'

        return matchesSearch && matchesStatus;
    });

    // Pagination Logic
    const totalPages = Math.ceil(filteredSales.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedSales = filteredSales.slice(startIndex, startIndex + itemsPerPage);

    // Las anulaciones permanecen visibles en el historial, pero no suman a ventas ni caja.
    const completedSales = filteredSales.filter((sale) => sale.status === "completed");
    const totalRevenue = completedSales.reduce((sum, sale) => sum + Number(sale.total), 0);
    const averageTicket = completedSales.length > 0 ? totalRevenue / completedSales.length : 0;
    const totalTransactions = completedSales.length;

    const formatDate = (date: string) => {
        return new Date(date).toLocaleString("es-AR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const getPaymentMethodLabel = (method: string) => {
        switch (method) {
            case 'cash': return { label: 'Efectivo', icon: Banknote, color: 'text-emerald-500' };
            case 'card': return { label: 'Tarjeta', icon: CreditCard, color: 'text-blue-500' };
            case 'transfer': return { label: 'Transferencia', icon: ArrowUpRight, color: 'text-purple-500' };
            case 'credit': return { label: 'Cta. Corriente', icon: FileText, color: 'text-amber-500' };
            default: return { label: method, icon: Banknote, color: 'text-muted-foreground' };
        }
    };

    // Prepare Invoice Object for PDF (Transformation)
    const getInvoiceForPDF = (sale: Sale) => {
        if (!sale.invoices || sale.invoices.length === 0) return null;
        const inv = sale.invoices[0];

        // Transform to match Invoice interface expected by InvoicePDF
        return {
            ...inv,
            customer: sale.customer,
            sale: {
                sale_items: saleItems.map(item => ({
                    ...item,
                    product: { name: item.product_name }
                })),
                total: sale.total,
                created_at: sale.created_at
            }
        } as any; // Cast as any because simplified for PDF
    };

    if (orgLoading || isLoading && sales.length === 0) {
        return (
            <div className="flex items-center justify-center h-[50vh]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6 p-4 md:p-6 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Historial de Ventas</h1>
                    <p className="text-muted-foreground">Registro de transacciones y detalles.</p>
                </div>
            </div>

            {/* KPIs Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border bg-card/50 backdrop-blur-sm text-card-foreground shadow-sm">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Ventas Totales</p>
                            <h3 className="text-2xl font-bold mt-1">${totalRevenue.toLocaleString("es-AR")}</h3>
                        </div>
                        <div className="p-2 bg-emerald-500/10 rounded-lg">
                            <DollarIcon className="h-5 w-5 text-emerald-500" />
                        </div>
                    </div>
                </div>
                <div className="p-4 rounded-xl border bg-card/50 backdrop-blur-sm text-card-foreground shadow-sm">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Transacciones</p>
                            <h3 className="text-2xl font-bold mt-1">{totalTransactions}</h3>
                        </div>
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <Receipt className="h-5 w-5 text-primary" />
                        </div>
                    </div>
                </div>
                <div className="p-4 rounded-xl border bg-card/50 backdrop-blur-sm text-card-foreground shadow-sm">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Ticket Promedio</p>
                            <h3 className="text-2xl font-bold mt-1">${averageTicket.toLocaleString("es-AR", { maximumFractionDigits: 0 })}</h3>
                        </div>
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                            <ShoppingBag className="h-5 w-5 text-blue-500" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-card/50 p-3 rounded-xl border">
                <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto no-scrollbar">
                    <Button
                        variant={dateFilter === 'today' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setDateFilter('today')}
                        className="whitespace-nowrap"
                    >
                        Hoy
                    </Button>
                    <Button
                        variant={dateFilter === 'week' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setDateFilter('week')}
                        className="whitespace-nowrap"
                    >
                        Esta Semana
                    </Button>
                    <Button
                        variant={dateFilter === 'month' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setDateFilter('month')}
                        className="whitespace-nowrap"
                    >
                        Este Mes
                    </Button>
                    <Button
                        variant={dateFilter === 'all' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setDateFilter('all')}
                        className="whitespace-nowrap"
                    >
                        Todo
                    </Button>
                </div>

                <div className="relative w-full max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar cliente..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 bg-background"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="rounded-lg border bg-card/50 backdrop-blur-sm shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Origen</TableHead>
                            <TableHead>Pago</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><div className="h-4 w-24 bg-muted animate-pulse rounded" /></TableCell>
                                    <TableCell><div className="h-4 w-32 bg-muted animate-pulse rounded" /></TableCell>
                                    <TableCell><div className="h-4 w-20 bg-muted animate-pulse rounded" /></TableCell>
                                    <TableCell><div className="h-4 w-20 bg-muted animate-pulse rounded" /></TableCell>
                                    <TableCell><div className="h-4 w-16 bg-muted animate-pulse rounded" /></TableCell>
                                    <TableCell className="text-right"><div className="h-4 w-16 bg-muted animate-pulse rounded ml-auto" /></TableCell>
                                    <TableCell className="text-right"><div className="h-8 w-8 bg-muted animate-pulse rounded ml-auto" /></TableCell>
                                </TableRow>
                            ))
                        ) : paginatedSales.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                                    No se encontraron ventas para este período
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedSales.map((sale) => {
                                const { label, icon: Icon, color } = getPaymentMethodLabel(sale.payment_method);
                                return (
                                    <TableRow key={sale.id} className="hover:bg-muted/50 transition-colors">
                                        <TableCell className="font-medium whitespace-nowrap">
                                            <div className="flex flex-col">
                                                <span>{new Date(sale.created_at).toLocaleDateString()}</span>
                                                <span className="text-xs text-muted-foreground">{new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {sale.customer ? (
                                                <div className="flex items-center gap-2">
                                                    <User className="h-4 w-4 text-muted-foreground" />
                                                    <span>{sale.customer.name}</span>
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground italic">Consumidor Final</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={sale.channel === 'offline' ? 'border-amber-500/30 text-amber-600' : 'border-emerald-500/30 text-emerald-600'}>
                                                {sale.channel === 'offline' ? 'Offline' : 'Online'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className={`flex items-center gap-2 text-sm ${color}`}>
                                                <Icon className="h-4 w-4" />
                                                <span>{label}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={sale.status === 'completed' ? 'default' : 'secondary'}
                                                className={sale.status === 'completed' ? 'bg-emerald-500 hover:bg-emerald-600' : sale.status === 'cancelled' ? 'border border-destructive/30 text-destructive' : ''}
                                            >
                                                {sale.status === 'completed' ? 'Completada' : sale.status === 'cancelled' ? 'Anulada' : sale.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-bold text-base">
                                            ${sale.total.toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button variant="ghost" size="icon" onClick={() => viewSaleDetails(sale)} aria-label="Ver detalle" title="Ver detalle">
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                                {canDelete("sales") && sale.status === "completed" && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-destructive hover:text-destructive"
                                                        onClick={() => {
                                                            setSaleToVoid(sale);
                                                            setVoidReason("");
                                                        }}
                                                        aria-label="Anular venta"
                                                        title="Anular venta"
                                                    >
                                                        <Ban className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination Controls */}
            {filteredSales.length > 0 && (
                <div className="flex items-center justify-between border-t pt-4 px-2">
                    <div className="text-sm text-muted-foreground">
                        Mostrando {startIndex + 1} a {Math.min(startIndex + itemsPerPage, filteredSales.length)} de {filteredSales.length} ventas
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="h-8"
                        >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Anterior
                        </Button>
                        <div className="text-sm font-medium min-w-[3rem] text-center">
                            {currentPage} / {totalPages}
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="h-8"
                        >
                            Siguiente
                            <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Sale Details Modal */}
            <Dialog open={!!selectedSale} onOpenChange={(open) => !open && setSelectedSale(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Receipt className="h-5 w-5 text-primary" />
                            Detalle de Venta
                        </DialogTitle>
                    </DialogHeader>

                    {selectedSale && (
                        <div className="space-y-6">
                            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Fecha:</span>
                                    <span className="font-medium">{formatDate(selectedSale.created_at)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Cliente:</span>
                                    <span className="font-medium">{selectedSale.customer?.name || 'Consumidor Final'}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Método Pago:</span>
                                    <span className="font-medium capitalize">{getPaymentMethodLabel(selectedSale.payment_method).label}</span>
                                </div>
                            </div>

                            {selectedSale.status === "cancelled" && (
                                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                                    <p className="font-semibold text-destructive">Venta anulada</p>
                                    {selectedSale.cancelled_at && (
                                        <p className="mt-1 text-muted-foreground">{formatDate(selectedSale.cancelled_at)}</p>
                                    )}
                                    <p className="mt-2"><span className="font-medium">Motivo:</span> {selectedSale.cancellation_reason || "No informado"}</p>
                                    <p className="mt-2 text-muted-foreground">El reintegro de efectivo, tarjeta o transferencia se gestiona por fuera de FrontStock.</p>
                                </div>
                            )}

                            <div className="space-y-3">
                                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Productos</h4>
                                <div className="divide-y border rounded-md max-h-[200px] overflow-y-auto">
                                    {saleItems.map(item => (
                                        <div key={item.id} className="p-3 flex justify-between items-center text-sm">
                                            <div>
                                                <p className="font-medium">{item.product_name}</p>
                                                <p className="text-xs text-muted-foreground">{item.quantity} x ${item.unit_price}</p>
                                            </div>
                                            <span className="font-medium">${item.total}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex justify-between items-center pt-4 border-t">
                                <span className="text-lg font-bold">{selectedSale.status === "cancelled" ? "Total de la venta" : "Total Pagado"}</span>
                                <span className="text-2xl font-bold text-primary">${selectedSale.total.toLocaleString()}</span>
                            </div>

                            <div className="flex gap-2 justify-end pt-2 print:hidden">
                                {/* Ticket Thermal Button */}
                                {saleItems.length > 0 ? (
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={pdfLoading === 'ticket'}
                                            title="Formato Ticket 80mm"
                                            onClick={async () => {
                                                setPdfLoading('ticket');
                                                try {
                                                    const logoBase64 = await fetchLogoBase64(organization?.logo_url);
                                                    const blob = await pdf(
                                                        <TicketPDF sale={selectedSale} items={saleItems} organization={organization} logoBase64={logoBase64} />
                                                    ).toBlob();
                                                    const url = URL.createObjectURL(blob);
                                                    const a = document.createElement('a');
                                                    a.href = url;
                                                    a.download = `ticket-${selectedSale.id.slice(0, 8)}.pdf`;
                                                    a.click();
                                                    URL.revokeObjectURL(url);
                                                } catch (error) {
                                                    console.error('Error generando ticket PDF:', error);
                                                } finally {
                                                    setPdfLoading(null);
                                                }
                                            }}
                                        >
                                            <ScrollText className="h-4 w-4 mr-2" />
                                            {pdfLoading === 'ticket' ? "Generando..." : "Ticket"}
                                        </Button>

                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            disabled={pdfLoading === 'remito'}
                                            title="Formato A4"
                                            onClick={async () => {
                                                setPdfLoading('remito');
                                                try {
                                                    const logoBase64 = await fetchLogoBase64(organization?.logo_url);
                                                    const blob = await pdf(
                                                        <DeliveryNotePDF sale={selectedSale} items={saleItems} organization={organization} logoBase64={logoBase64} />
                                                    ).toBlob();
                                                    const url = URL.createObjectURL(blob);
                                                    const a = document.createElement('a');
                                                    a.href = url;
                                                    a.download = `remito-${selectedSale.id.slice(0, 8)}.pdf`;
                                                    a.click();
                                                    URL.revokeObjectURL(url);
                                                } catch (error) {
                                                    console.error('Error generando remito PDF:', error);
                                                } finally {
                                                    setPdfLoading(null);
                                                }
                                            }}
                                        >
                                            {pdfLoading === 'remito' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                ) : (
                                    <Button variant="outline" size="sm" disabled>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Cargando...
                                    </Button>
                                )}

                                {/* Invoice Button */}
                                {selectedSale.invoices && selectedSale.invoices.length > 0 ? (
                                    <Button
                                        size="sm"
                                        disabled={pdfLoading === 'invoice'}
                                        className="bg-emerald-600 hover:bg-emerald-700"
                                        onClick={async () => {
                                            setPdfLoading('invoice');
                                            try {
                                                const currentInvoice = selectedSale.invoices?.[0];
                                                if (!currentInvoice) {
                                                    return;
                                                }

                                                const logoBase64 = await fetchLogoBase64(organization?.logo_url);
                                                const pdfBlob = await pdf(
                                                    <InvoicePDF invoice={getInvoiceForPDF(selectedSale)!} organization={organization} logoBase64={logoBase64} />
                                                ).toBlob();
                                                const url = URL.createObjectURL(pdfBlob);
                                                const a = document.createElement('a');
                                                a.href = url;
                                                a.download = `factura-${currentInvoice.type}-${currentInvoice.invoice_number}.pdf`;
                                                a.click();
                                                URL.revokeObjectURL(url);
                                            } catch (error) {
                                                console.error('Error generando PDF:', error);
                                            } finally {
                                                setPdfLoading(null);
                                            }
                                        }}
                                    >
                                        <Receipt className="h-4 w-4 mr-2" />
                                        {pdfLoading === 'invoice' ? "..." : "Fiscal"}
                                    </Button>
                                ) : (
                                    <Button size="sm" variant="secondary" className="opacity-50 cursor-not-allowed">
                                        <Receipt className="h-4 w-4 mr-2" />
                                        Fiscal Pendiente
                                    </Button>
                                )}

                                <Button onClick={() => setSelectedSale(null)} variant="ghost" size="sm">
                                    Cerrar
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <AlertDialog
                open={Boolean(saleToVoid)}
                onOpenChange={(open) => {
                    if (!open && !isVoiding) {
                        setSaleToVoid(null);
                        setVoidReason("");
                    }
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Anular venta</AlertDialogTitle>
                        <AlertDialogDescription>
                            La venta quedará anulada, el stock se restituirá y se revertirá el saldo de cuenta corriente. El reintegro de efectivo, tarjeta o transferencia debe gestionarse por fuera de FrontStock. Las ventas con factura o vinculadas a una ruta requieren su flujo correspondiente.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-2">
                        <label htmlFor="void-sale-reason" className="text-sm font-medium">Motivo de anulación</label>
                        <Textarea
                            id="void-sale-reason"
                            value={voidReason}
                            onChange={(event) => setVoidReason(event.target.value)}
                            placeholder="Ej.: carga duplicada, devolución de mercadería…"
                            maxLength={300}
                            rows={3}
                            disabled={isVoiding}
                            aria-required="true"
                        />
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isVoiding}>Volver</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            disabled={isVoiding || voidReason.trim().length < 3}
                            onClick={(event) => {
                                event.preventDefault();
                                void handleVoidSale();
                            }}
                        >
                            {isVoiding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {isVoiding ? "Anulando…" : "Anular venta"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

// Helper icon component since DollarSign is named different in lucide imports sometimes or to handle custom usage
function DollarIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <line x1="12" x2="12" y1="2" y2="22" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
    )
}
