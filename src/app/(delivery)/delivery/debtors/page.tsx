"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { User, Phone, MapPin, DollarSign, ArrowLeft, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShiftControl } from "@/components/delivery/ShiftControl";

export default function DebtorsPage() {
    const { organizationId } = useOrganization();
    const [debtors, setDebtors] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedDebtor, setSelectedDebtor] = useState<any>(null);
    const supabase = createClient();

    useEffect(() => {
        if (organizationId) fetchDebtors();
    }, [organizationId]);

    useEffect(() => {
        if (!organizationId) return;

        const channel = supabase
            .channel(`delivery-debtors-${organizationId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'orders', filter: `organization_id=eq.${organizationId}` },
                () => fetchDebtors()
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'order_payments', filter: `organization_id=eq.${organizationId}` },
                () => fetchDebtors()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [organizationId]);

    const fetchDebtors = async () => {
        setLoading(true);
        try {
            const { data: customers, error: customersError } = await supabase
                .from('customers')
                .select('*')
                .eq('organization_id', organizationId);

            if (customersError) throw customersError;

            const { data: pendingOrders, error: ordersError } = await supabase
                .from('orders')
                .select('id, customer_id, total, created_at, payment_status, payment_method')
                .eq('organization_id', organizationId)
                .in('payment_status', ['pending', 'partial']);

            if (ordersError) throw ordersError;

            const orderIds = (pendingOrders || []).map((order: any) => order.id);

            let paymentsByOrderId = new Map<string, number>();
            if (orderIds.length > 0) {
                const { data: paymentsData, error: paymentsError } = await supabase
                    .from('order_payments')
                    .select('order_id, amount')
                    .eq('organization_id', organizationId)
                    .in('order_id', orderIds);

                if (paymentsError) throw paymentsError;

                paymentsByOrderId = (paymentsData || []).reduce((acc: Map<string, number>, payment: any) => {
                    acc.set(payment.order_id, (acc.get(payment.order_id) || 0) + Number(payment.amount || 0));
                    return acc;
                }, new Map<string, number>());
            }

            const customerById = new Map((customers || []).map((customer: any) => [customer.id, customer]));
            const debtByCustomer = new Map<string, any>();

            for (const order of pendingOrders || []) {
                if (!order.customer_id) continue;

                const alreadyPaid = paymentsByOrderId.get(order.id) || 0;
                const pendingAmount = Math.max(0, Number(order.total || 0) - alreadyPaid);
                if (pendingAmount <= 0) continue;

                const customer = customerById.get(order.customer_id);
                if (!customer) continue;

                const debtor = debtByCustomer.get(order.customer_id) || {
                    ...customer,
                    totalDebt: 0,
                    pendingSales: [],
                };

                debtor.totalDebt += pendingAmount;
                debtor.pendingSales.push({
                    id: order.id,
                    total: Number(order.total || 0),
                    pendingAmount,
                    created_at: order.created_at,
                    source: 'orders',
                });

                debtByCustomer.set(order.customer_id, debtor);
            }

            let debtorsList = Array.from(debtByCustomer.values())
                .filter((debtor: any) => debtor.totalDebt > 0)
                .sort((a: any, b: any) => b.totalDebt - a.totalDebt);

            if (debtorsList.length === 0) {
                const { data: legacyCustomers, error: legacyError } = await supabase
                    .from('customers')
                    .select('*, sales(*)')
                    .eq('organization_id', organizationId)
                    .eq('sales.payment_status', 'pending');

                if (!legacyError) {
                    debtorsList = (legacyCustomers || [])
                        .map((c: any) => {
                            const pendingSales = c.sales.filter((s: any) => s.payment_status === 'pending');
                            const totalDebt = pendingSales.reduce((acc: number, s: any) => acc + s.total, 0);
                            return { ...c, totalDebt, pendingSales };
                        })
                        .filter((c: any) => c.totalDebt > 0)
                        .sort((a: any, b: any) => b.totalDebt - a.totalDebt);
                }
            }

            setDebtors(debtorsList);
        } catch (e) {
            console.error(e);
            toast.error("Error al cargar deudores");
        } finally {
            setLoading(false);
        }
    };

    const handleMarkAsPaid = async (saleId: string, amount: number, source: 'orders' | 'sales' = 'orders') => {
        try {
            if (source === 'orders') {
                const { data, error } = await supabase.rpc('register_order_payment', {
                    p_org_id: organizationId,
                    p_order_id: saleId,
                    p_method: 'cash',
                    p_amount: amount,
                    p_reference: null,
                    p_notes: 'Pago registrado desde módulo de deudores',
                });

                if (error) throw error;
                if (data?.success === false) throw new Error(data?.error || 'No se pudo registrar pago');
            } else {
                const { error } = await supabase
                    .from('sales')
                    .update({ payment_status: 'paid' })
                    .eq('id', saleId);

                if (error) throw error;
            }

            toast.success(`Pedido saldado ($${amount})`);
            await fetchDebtors();

        } catch (e: any) {
            toast.error("Error al actualizar pago");
        }
    };

    const filteredDebtors = debtors.filter(d =>
        d.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-slate-950 pb-20">
            {/* Header */}
            <div className="sticky top-0 bg-slate-950/90 backdrop-blur z-20 border-b border-slate-800 p-4">
                <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2">
                        <Link href="/delivery">
                            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
                                <ArrowLeft className="h-6 w-6" />
                            </Button>
                        </Link>
                        <h1 className="text-xl font-bold text-white">Deudores</h1>
                    </div>
                    <ShiftControl />
                </div>
                <Input
                    placeholder="Buscar deudor..."
                    className="bg-slate-900 border-slate-800 text-white rounded-xl"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>

            {/* List */}
            <div className="p-4 space-y-3">
                {loading ? (
                    <div className="text-slate-500 text-center py-8">Cargando...</div>
                ) : filteredDebtors.length === 0 ? (
                    <div className="text-slate-500 text-center py-8">No hay deudores pendientes</div>
                ) : (
                    filteredDebtors.map(debtor => (
                        <div
                            key={debtor.id}
                            onClick={() => setSelectedDebtor(debtor)}
                            className="bg-slate-900 rounded-xl p-4 border border-slate-800 active:scale-[0.98] transition-all cursor-pointer"
                        >
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 border border-red-500/20">
                                        <User className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white">{debtor.name}</h3>
                                        <div className="flex items-center gap-2 text-sm text-slate-400">
                                            <Phone className="h-3 w-3" />
                                            {debtor.phone || "Sin tel"}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="block text-2xl font-bold text-red-400">
                                        ${debtor.totalDebt.toLocaleString()}
                                    </span>
                                    <span className="text-xs text-slate-500 font-medium">
                                        {debtor.pendingSales.length} pedidos pendientes
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Debtor Details / Pay Modal */}
            <Dialog open={!!selectedDebtor} onOpenChange={(open) => !open && setSelectedDebtor(null)}>
                <DialogContent className="bg-slate-950 border-slate-800 text-white max-w-sm rounded-xl">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold">
                            {selectedDebtor?.name}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="py-4">
                        <div className="mb-4 p-4 bg-red-500/5 rounded-xl border border-red-500/10 text-center">
                            <span className="text-sm text-red-300 uppercase block mb-1">Deuda Total</span>
                            <span className="text-3xl font-bold text-red-500">${selectedDebtor?.totalDebt.toLocaleString()}</span>
                        </div>

                        <h3 className="text-sm font-bold text-slate-400 mb-3 uppercase">Pedidos Pendientes</h3>
                        <div className="space-y-2 max-h-[300px] overflow-y-auto">
                            {selectedDebtor?.pendingSales.map((sale: any) => (
                                <div key={sale.id} className="flex justify-between items-center p-3 bg-slate-900 rounded-lg border border-slate-800">
                                    <div>
                                        <span className="block font-bold text-white">${(sale.pendingAmount || sale.total).toLocaleString()}</span>
                                        <span className="text-xs text-slate-500">{new Date(sale.created_at).toLocaleDateString()}</span>
                                    </div>
                                    <Button
                                        size="sm"
                                        className="h-8 bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
                                        onClick={() => handleMarkAsPaid(sale.id, sale.pendingAmount || sale.total, sale.source || 'sales')}
                                    >
                                        <CheckCircle className="h-3 w-3 mr-1.5" />
                                        Saldar
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
