"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { usePermissions } from "@/hooks/usePermissions";
import { AccessDenied } from "@/components/Protected";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import {
    Invoice,
    InvoiceStats,
    InvoiceList,
    CreateInvoiceModal,
    InvoiceDetailModal,
    InvoiceFilters,
    InvoiceFilterValues,
} from "@/components/invoices";

export default function InvoicesPage() {
    const {
        organizationId,
        organization,
        isLoading: orgLoading,
    } = useOrganization();
    const { canView, canCreate } = usePermissions();

    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const [filters, setFilters] = useState<InvoiceFilterValues>({});

    const supabase = createClient();

    const fetchInvoices = useCallback(async () => {
        if (!organizationId) return;
        setLoading(true);

        const { data, error } = await supabase
            .from("invoices")
            .select("id, organization_id, sale_id, customer_id, invoice_number, type, total, status, cae, cae_expiration, afip_status, afip_error, created_at, customer:customers(id, name, cuit), sale:sales(total, created_at, sale_items(quantity, unit_price, total, product:products(name)))")
            .eq("organization_id", organizationId)
            .order("created_at", { ascending: false });

        if (error) {
            console.error("❌ Error fetching invoices:", error);
        }

        if (data) {
            const invoicesData = data as unknown as Invoice[];
            setInvoices(invoicesData);
            setFilteredInvoices(invoicesData);
        }

        setLoading(false);
    }, [organizationId, supabase]);

    const handleFilterChange = useCallback((newFilters: InvoiceFilterValues) => {
        setFilters(newFilters);

        let filtered = [...invoices];

        // Apply search filter
        if (newFilters.searchTerm) {
            filtered = filtered.filter((inv) =>
                inv.invoice_number.toLowerCase().includes(newFilters.searchTerm!.toLowerCase())
            );
        }

        // Apply type filter
        if (newFilters.type) {
            filtered = filtered.filter((inv) => inv.type === newFilters.type);
        }

        // Apply AFIP status filter
        if (newFilters.afipStatus) {
            filtered = filtered.filter((inv) => inv.afip_status === newFilters.afipStatus);
        }

        // Apply date range filter
        if (newFilters.dateFrom) {
            filtered = filtered.filter(
                (inv) => new Date(inv.created_at) >= newFilters.dateFrom!
            );
        }

        if (newFilters.dateTo) {
            filtered = filtered.filter(
                (inv) => new Date(inv.created_at) <= newFilters.dateTo!
            );
        }

        setFilteredInvoices(filtered);
    }, [invoices]);

    useEffect(() => {
        if (organizationId) {
            fetchInvoices();
        }
    }, [organizationId, fetchInvoices]);

    if (orgLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    // Reuse "sales" permission pending a specific "invoices" permission
    if (!canView("sales")) {
        return <AccessDenied />;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                        Facturación
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Gestión de comprobantes y facturas electrónicas (ARCA)
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={fetchInvoices}>
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={async () => {
                            if (window.confirm("⚠️ ¿ESTÁS SEGURO? \n\nEsto borrará TODAS las facturas de la organización y reiniciará la numeración a 0001-00000001. \n\nLas ventas volverán a estado 'pendiente de facturar'. \n\nEsta acción NO se puede deshacer.")) {
                                if (window.prompt("Escribe 'BORRAR' para confirmar") !== "BORRAR") return;

                                setLoading(true);
                                const { error } = await supabase
                                    .rpc('reset_invoices', { p_organization_id: organizationId });

                                if (error) {
                                    alert("Error al borrar facturas: " + error.message);
                                } else {
                                    alert("✅ Facturas borradas correctamente. La numeración se ha reiniciado.");
                                    fetchInvoices();
                                }
                                setLoading(false);
                            }
                        }}
                    >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Resetear Facturación
                    </Button>
                    {canCreate("sales") && (
                        <Button
                            onClick={() => setShowCreateModal(true)}
                            className="shadow-lg shadow-blue-500/20"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Nueva Factura
                        </Button>
                    )}
                </div>
            </div>

            {/* Stats */}
            <InvoiceStats invoices={filteredInvoices} />

            {/* Filters */}
            <InvoiceFilters onFilterChange={handleFilterChange} />

            {/* Invoice List */}
            {loading ? (
                <div className="flex items-center justify-center h-32">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : (
                <InvoiceList invoices={filteredInvoices} onView={setSelectedInvoice} />
            )}

            {/* Create Modal */}
            {organizationId && (
                <CreateInvoiceModal
                    open={showCreateModal}
                    onOpenChange={setShowCreateModal}
                    onSuccess={fetchInvoices}
                    organizationId={organizationId}
                />
            )}

            {/* Detail Modal */}
            <InvoiceDetailModal
                invoice={selectedInvoice}
                onClose={() => setSelectedInvoice(null)}
                organization={organization}
            />
        </div>
    );
}
