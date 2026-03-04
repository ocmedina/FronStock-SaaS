"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Customer, AccountMovement, CustomerSale } from "./types";
import { CustomerKPIs } from "./CustomerKPIs";
import { CustomerFilters } from "./CustomerFilters";
import { CustomerTable } from "./CustomerTable";
import { CustomerFormModal } from "./CustomerFormModal";
import { CustomerHistoryModal } from "./CustomerHistoryModal";
import { CustomerPaymentModal } from "./CustomerPaymentModal";

interface CustomersViewProps {
    initialShowDebtorsOnly?: boolean;
    hideDebtorsToggle?: boolean;
}

export function CustomersView({
    initialShowDebtorsOnly = false,
    hideDebtorsToggle = false
}: CustomersViewProps) {
    const { organizationId, isLoading: orgLoading } = useOrganization();
    const { canCreate, canEdit, canDelete } = usePermissions();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [pendingOrdersDebtByCustomer, setPendingOrdersDebtByCustomer] = useState<Record<string, number>>({});
    const [isLoading, setIsLoading] = useState(true);

    // UI States
    const [showModal, setShowModal] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);

    // Selection States
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [selectedCustomerForHistory, setSelectedCustomerForHistory] = useState<Customer | null>(null);

    // Data States for Modals
    const [movements, setMovements] = useState<AccountMovement[]>([]);
    const [customerSales, setCustomerSales] = useState<CustomerSale[]>([]);

    const [saving, setSaving] = useState(false);

    // Filters & Pagination
    const [searchQuery, setSearchQuery] = useState("");
    const [showDebtorsOnly, setShowDebtorsOnly] = useState(initialShowDebtorsOnly);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const supabase = createClient();

    const fetchCustomers = useCallback(async () => {
        if (!organizationId) return;

        const { data, error } = await supabase
            .from("customers")
            .select("*")
            .eq("organization_id", organizationId)
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Error fetching customers:", error);
        } else {
            setCustomers(data || []);

            const { data: pendingOrders, error: ordersError } = await supabase
                .from('orders')
                .select('id, customer_id, total, payment_amount, payment_status, payment_method, delivery_status, lifecycle_status')
                .eq('organization_id', organizationId)
                .in('payment_status', ['pending', 'partial']);

            if (ordersError) {
                console.error("Error fetching pending orders debt:", ordersError);
                setPendingOrdersDebtByCustomer({});
            } else {
                const orderIds = (pendingOrders || []).map((o: any) => o.id);
                const paidByOrder = new Map<string, number>();

                if (orderIds.length > 0) {
                    const { data: payments, error: paymentsError } = await supabase
                        .from('order_payments')
                        .select('order_id, amount')
                        .eq('organization_id', organizationId)
                        .in('order_id', orderIds);

                    if (paymentsError) {
                        console.error("Error fetching order payments:", paymentsError);
                    } else {
                        (payments || []).forEach((payment: any) => {
                            paidByOrder.set(
                                payment.order_id,
                                (paidByOrder.get(payment.order_id) || 0) + Number(payment.amount || 0)
                            );
                        });
                    }
                }

                const creditMethods = new Set(['credit', 'current_account', 'cuenta_corriente', 'fiado']);
                const excludedDeliveryStatus = new Set(['cancelled', 'not_delivered', 'returned']);

                const getNormalizedOrderStatus = (order: any) => {
                    const lifecycle = String(order.lifecycle_status || '').toLowerCase();
                    if (lifecycle) return lifecycle;

                    const legacy = String(order.delivery_status || '').toLowerCase();
                    if (legacy === 'out_for_delivery') return 'in_delivery';
                    if (legacy === 'assigned_to_route') return 'assigned';
                    if (legacy === 'cancelled') return 'not_delivered';
                    return legacy || 'draft';
                };

                const debtMap: Record<string, number> = {};
                (pendingOrders || []).forEach((order: any) => {
                    if (!order.customer_id) return;
                    const normalizedMethod = String(order.payment_method || '').toLowerCase();
                    const normalizedDeliveryStatus = String(order.delivery_status || '').toLowerCase();
                    const normalizedOrderStatus = getNormalizedOrderStatus(order);
                    if (excludedDeliveryStatus.has(normalizedDeliveryStatus) || normalizedOrderStatus === 'not_delivered' || normalizedOrderStatus === 'cancelled') return;

                    const isCreditOrder = creditMethods.has(normalizedMethod);
                    const isDeliveredWithPendingPayment = normalizedOrderStatus === 'delivered';
                    if (!isCreditOrder && !isDeliveredWithPendingPayment) return;

                    const total = Number(order.total || 0);
                    const paidFromMovements = paidByOrder.get(order.id) || 0;
                    const paidFromOrder = Number(order.payment_amount || 0);
                    const paid = Math.max(paidFromMovements, paidFromOrder);
                    const pending = Math.max(0, total - paid);
                    if (pending <= 0) return;
                    debtMap[order.customer_id] = (debtMap[order.customer_id] || 0) + pending;
                });

                setPendingOrdersDebtByCustomer(debtMap);
            }
        }
        setIsLoading(false);
    }, [organizationId, supabase]);

    const customersWithEffectiveDebt = useMemo(() => {
        return customers.map((customer) => {
            const pendingOrdersDebt = pendingOrdersDebtByCustomer[customer.id] || 0;
            const effectiveBalance = customer.balance > 0 ? customer.balance : pendingOrdersDebt;
            return {
                ...customer,
                balance: effectiveBalance,
            };
        });
    }, [customers, pendingOrdersDebtByCustomer]);

    useEffect(() => {
        if (organizationId) {
            setIsLoading(true);
            fetchCustomers();
        }
    }, [organizationId, fetchCustomers]);

    const [selectedChannel, setSelectedChannel] = useState<"all" | "delivery" | "counter" | "both">("all");

    // Reset pagination on filter change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, showDebtorsOnly, selectedChannel]);

    // Filter Logic
    const filteredCustomers = customersWithEffectiveDebt.filter((c) => {
        const matchesSearch =
            c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.phone?.includes(searchQuery);

        // If toggle is hidden, we force "showDebtorsOnly" behavior (assuming hidden means strict mode)
        const effectiveShowDebtors = hideDebtorsToggle ? true : showDebtorsOnly;
        const matchesDebt = effectiveShowDebtors ? c.balance > 0 : true;

        // Channel filter
        const matchesChannel = selectedChannel === "all" || c.service_type === selectedChannel;

        return matchesSearch && matchesDebt && matchesChannel;
    });

    // Pagination Logic
    const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedCustomers = filteredCustomers.slice(startIndex, endIndex);

    // Stats Logic
    const stats = useMemo(() => {
        return {
            totalDebt: customersWithEffectiveDebt.reduce((acc, c) => acc + (c.balance > 0 ? c.balance : 0), 0),
            customersWithDebt: customersWithEffectiveDebt.filter((c) => c.balance > 0).length,
            totalCustomers: customersWithEffectiveDebt.length
        };
    }, [customersWithEffectiveDebt]);

    // Actions
    const handleSave = async (formData: any) => {
        if (editingCustomer && !canEdit("customers")) {
            toast.error("No tienes permisos para editar clientes");
            return;
        }

        if (!editingCustomer && !canCreate("customers")) {
            toast.error("No tienes permisos para crear clientes");
            return;
        }

        setSaving(true);
        try {
            if (editingCustomer) {
                await supabase
                    .from("customers")
                    .update(formData)
                    .eq("id", editingCustomer.id);
            } else {
                await supabase.from("customers").insert({
                    organization_id: organizationId!,
                    ...formData,
                    balance: 0,
                });
            }
            setShowModal(false);
            setEditingCustomer(null);
            fetchCustomers();
        } catch (error) {
            console.error("Error saving customer:", error);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!canDelete("customers")) {
            toast.error("No tienes permisos para eliminar clientes");
            return;
        }

        if (!confirm("¿Estás seguro? Esta acción no se puede deshacer.")) return;
        try {
            await supabase.from("customers").delete().eq("id", id);
            fetchCustomers();
        } catch (error) {
            console.error("Error deleting customer:", error);
        }
    };

    const handleViewHistory = async (customer: Customer) => {
        setSelectedCustomerForHistory(customer);
        setShowHistoryModal(true);
        setMovements([]);
        setCustomerSales([]);

        // Fetch Movements
        const { data: movementsData } = await supabase
            .from("customer_account_movements")
            .select("*")
            .eq("customer_id", customer.id)
            .order("created_at", { ascending: false });

        if (movementsData) setMovements(movementsData);

        // Fetch Sales
        const { data: salesData } = await supabase
            .from("sales")
            .select("*, sale_items(*)")
            .eq("customer_id", customer.id)
            .order("created_at", { ascending: false });

        if (salesData) setCustomerSales(salesData);
    };

    const handlePayment = async (amountStr: string, description: string) => {
        if (!canEdit("customers")) {
            toast.error("No tienes permisos para registrar pagos");
            return;
        }

        if (!selectedCustomerForHistory || !amountStr) return;

        setSaving(true);
        const amount = parseFloat(amountStr);

        try {
            // 1. Update Balance
            const newBalance = (selectedCustomerForHistory.balance || 0) - amount;

            await supabase
                .from("customers")
                .update({ balance: newBalance })
                .eq("id", selectedCustomerForHistory.id);

            // 2. Register Movement
            await supabase.from("customer_account_movements").insert({
                customer_id: selectedCustomerForHistory.id,
                type: "payment",
                amount: amount,
                description: description || "Pago a cuenta",
            });

            // 3. Update local state
            setShowPaymentModal(false);
            fetchCustomers(); // Refresh list

            // Update the current history modal view
            handleViewHistory({
                ...selectedCustomerForHistory,
                balance: newBalance
            });

        } catch (error) {
            console.error("Payment error:", error);
        } finally {
            setSaving(false);
        }
    };

    if (orgLoading || (isLoading && customers.length === 0)) {
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
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                        {initialShowDebtorsOnly ? "Deudores" : "Clientes"}
                    </h1>
                    <p className="text-muted-foreground">
                        {initialShowDebtorsOnly
                            ? "Gestión de clientes con saldo pendiente."
                            : "Gestión de clientes y cuentas corrientes."}
                    </p>
                </div>
                {canCreate("customers") && (
                    <Button
                        onClick={() => {
                            setEditingCustomer(null);
                            setShowModal(true);
                        }}
                        className="shadow-lg shadow-primary/20"
                    >
                        <Plus className="mr-2 h-4 w-4" /> Nuevo Cliente
                    </Button>
                )}
            </div>

            <CustomerKPIs stats={stats} />

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <CustomerFilters
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    showDebtorsOnly={showDebtorsOnly}
                    setShowDebtorsOnly={setShowDebtorsOnly}
                    hideDebtorsToggle={hideDebtorsToggle}
                />
                <div className="flex items-center bg-muted p-1 rounded-lg">
                    <button
                        onClick={() => setSelectedChannel("all")}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${selectedChannel === 'all' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                            }`}
                    >
                        Todos
                    </button>
                    <button
                        onClick={() => setSelectedChannel("delivery")}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${selectedChannel === 'delivery' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                            }`}
                    >
                        Reparto
                    </button>
                    <button
                        onClick={() => setSelectedChannel("counter")}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${selectedChannel === 'counter' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                            }`}
                    >
                        Mostrador
                    </button>
                    <button
                        onClick={() => setSelectedChannel("both")}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${selectedChannel === 'both' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                            }`}
                    >
                        Ambos
                    </button>
                </div>
            </div>

            <CustomerTable
                customers={paginatedCustomers}
                totalCustomers={filteredCustomers.length}
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                onEdit={(customer) => {
                    setEditingCustomer(customer);
                    setShowModal(true);
                }}
                onDelete={handleDelete}
                onViewHistory={handleViewHistory}
                startIndex={startIndex}
                endIndex={endIndex}
                canEdit={canEdit("customers")}
                canDelete={canDelete("customers")}
            />

            <CustomerFormModal
                open={showModal}
                onOpenChange={setShowModal}
                onSubmit={handleSave}
                editingCustomer={editingCustomer}
                saving={saving}
            />

            <CustomerHistoryModal
                open={showHistoryModal}
                onOpenChange={setShowHistoryModal}
                customer={selectedCustomerForHistory}
                movements={movements}
                sales={customerSales}
                onRegisterPayment={() => setShowPaymentModal(true)}
            />

            <CustomerPaymentModal
                open={showPaymentModal}
                onOpenChange={setShowPaymentModal}
                onSubmit={handlePayment}
                saving={saving}
            />
        </div>
    );
}
