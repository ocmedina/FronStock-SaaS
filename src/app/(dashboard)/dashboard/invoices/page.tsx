"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { usePermissions } from "@/hooks/usePermissions";
import { AccessDenied } from "@/components/Protected";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, RefreshCw } from "lucide-react";
import {
    Invoice,
    InvoiceStats,
    InvoiceList,
    CreateInvoiceModal,
    InvoiceDetailModal,
} from "@/components/invoices";

export default function InvoicesPage() {
    const {
        organizationId,
        organization,
        isLoading: orgLoading,
    } = useOrganization();
    const { canView, canCreate } = usePermissions();

    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

    const supabase = createClient();

    const fetchInvoices = useCallback(async () => {
        if (!organizationId) return;
        setLoading(true);

        const { data } = await supabase
            .from("invoices")
            .select("*, customers(name, tax_id)")
            .eq("organization_id", organizationId)
            .order("created_at", { ascending: false });

        if (data) {
            setInvoices(data as unknown as Invoice[]);
        }

        setLoading(false);
    }, [organizationId, supabase]);

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
            <InvoiceStats invoices={invoices} />

            {/* Invoice List */}
            {loading ? (
                <div className="flex items-center justify-center h-32">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : (
                <InvoiceList invoices={invoices} onView={setSelectedInvoice} />
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
                organizationName={organization?.name}
            />
        </div>
    );
}
