"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
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
    Receipt,
    FileText,
    CreditCard,
    Banknote,
    ArrowUpRight,
    User,
    ShoppingBag,
    Loader2
} from "lucide-react";

interface Sale {
    id: string;
    customer_id: string | null;
    total: number;
    payment_method: string;
    status: string;
    created_at: string;
    customer?: { name: string } | null;
}

interface SaleItem {
    id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    total: number;
}

export default function SalesHistoryPage() {
    const { organizationId, isLoading: orgLoading } = useOrganization();
    const [sales, setSales] = useState<Sale[]>([]);
    const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
    const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Filtros
    const [dateFilter, setDateFilter] = useState<"today" | "week" | "month" | "all">("today");
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const supabase = createClient();

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
        setSelectedSale(sale);
        const { data } = await supabase
            .from("sale_items")
            .select("*")
            .eq("sale_id", sale.id);
        if (data) setSaleItems(data);
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

    // KPIs Calculation based on FILTERED sales
    const totalRevenue = filteredSales.reduce((sum, s) => sum + Number(s.total), 0);
    const averageTicket = filteredSales.length > 0 ? totalRevenue / filteredSales.length : 0;
    const totalTransactions = filteredSales.length;

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
                                    <TableCell><div className="h-4 w-16 bg-muted animate-pulse rounded" /></TableCell>
                                    <TableCell className="text-right"><div className="h-4 w-16 bg-muted animate-pulse rounded ml-auto" /></TableCell>
                                    <TableCell className="text-right"><div className="h-8 w-8 bg-muted animate-pulse rounded ml-auto" /></TableCell>
                                </TableRow>
                            ))
                        ) : paginatedSales.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
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
                                            <div className={`flex items-center gap-2 text-sm ${color}`}>
                                                <Icon className="h-4 w-4" />
                                                <span>{label}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={sale.status === 'completed' ? 'default' : 'secondary'} className={sale.status === 'completed' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}>
                                                {sale.status === 'completed' ? 'Completado' : sale.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-bold text-base">
                                            ${sale.total.toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" onClick={() => viewSaleDetails(sale)}>
                                                <Eye className="h-4 w-4" />
                                            </Button>
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
                                <span className="text-lg font-bold">Total Pagado</span>
                                <span className="text-2xl font-bold text-primary">${selectedSale.total.toLocaleString()}</span>
                            </div>

                            <div className="flex justify-end gap-2 print:hidden">
                                <Button variant="outline" onClick={() => window.print()}>
                                    Imprimir
                                </Button>
                                <Button onClick={() => setSelectedSale(null)}>
                                    Cerrar
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
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
