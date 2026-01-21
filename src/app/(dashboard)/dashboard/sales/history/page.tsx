'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';

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
    const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('today');

    const supabase = createClient();

    const fetchSales = useCallback(async () => {
        if (!organizationId) return;
        setIsLoading(true);

        let query = supabase
            .from('sales')
            .select('*, customer:customers(name)')
            .eq('organization_id', organizationId)
            .order('created_at', { ascending: false });

        // Apply date filter
        const now = new Date();
        if (dateFilter === 'today') {
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
            query = query.gte('created_at', startOfDay);
        } else if (dateFilter === 'week') {
            const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
            query = query.gte('created_at', startOfWeek);
        } else if (dateFilter === 'month') {
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
            query = query.gte('created_at', startOfMonth);
        }

        const { data } = await query;
        if (data) setSales(data);
        setIsLoading(false);
    }, [organizationId, dateFilter, supabase]);

    useEffect(() => {
        if (organizationId) fetchSales();
    }, [organizationId, fetchSales]);

    const viewSaleDetails = async (sale: Sale) => {
        setSelectedSale(sale);
        const { data } = await supabase
            .from('sale_items')
            .select('*')
            .eq('sale_id', sale.id);
        if (data) setSaleItems(data);
    };

    const totalSales = sales.reduce((sum, s) => sum + Number(s.total), 0);

    const formatDate = (date: string) => {
        return new Date(date).toLocaleString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const paymentMethodLabels: Record<string, string> = {
        cash: '💵 Efectivo',
        card: '💳 Tarjeta',
        transfer: '🏦 Transfer',
    };

    if (orgLoading || isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Historial de Ventas</h1>
                    <p className="text-slate-500">{sales.length} ventas • Total: ${totalSales.toFixed(2)}</p>
                </div>
                <a
                    href="/dashboard/sales"
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                >
                    <span>+</span> Nueva Venta
                </a>
            </div>

            {/* Filters */}
            <div className="flex gap-2">
                {(['today', 'week', 'month', 'all'] as const).map((filter) => (
                    <button
                        key={filter}
                        onClick={() => setDateFilter(filter)}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${dateFilter === filter
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                    >
                        {filter === 'today' ? 'Hoy' : filter === 'week' ? 'Semana' : filter === 'month' ? 'Mes' : 'Todas'}
                    </button>
                ))}
            </div>

            {/* Sales Table */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Fecha</th>
                            <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Cliente</th>
                            <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Método</th>
                            <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600">Total</th>
                            <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {sales.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                    No hay ventas en este período
                                </td>
                            </tr>
                        ) : (
                            sales.map((sale) => (
                                <tr key={sale.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-4 text-slate-600 text-sm">{formatDate(sale.created_at)}</td>
                                    <td className="px-6 py-4 text-slate-800">{sale.customer?.name || 'Cliente general'}</td>
                                    <td className="px-6 py-4 text-sm">{paymentMethodLabels[sale.payment_method] || sale.payment_method}</td>
                                    <td className="px-6 py-4 text-right font-semibold text-slate-800">${Number(sale.total).toFixed(2)}</td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => viewSaleDetails(sale)}
                                            className="text-blue-600 hover:text-blue-800"
                                        >
                                            Ver detalle
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Sale Detail Modal */}
            {selectedSale && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
                        <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                            <h2 className="text-xl font-semibold text-slate-800">Detalle de Venta</h2>
                            <button onClick={() => setSelectedSale(null)} className="text-slate-400 hover:text-slate-600">✕</button>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                                <div>
                                    <span className="text-slate-500">Fecha:</span>
                                    <p className="font-medium">{formatDate(selectedSale.created_at)}</p>
                                </div>
                                <div>
                                    <span className="text-slate-500">Cliente:</span>
                                    <p className="font-medium">{selectedSale.customer?.name || 'Cliente general'}</p>
                                </div>
                                <div>
                                    <span className="text-slate-500">Método de pago:</span>
                                    <p className="font-medium">{paymentMethodLabels[selectedSale.payment_method]}</p>
                                </div>
                                <div>
                                    <span className="text-slate-500">Total:</span>
                                    <p className="font-bold text-lg text-green-600">${Number(selectedSale.total).toFixed(2)}</p>
                                </div>
                            </div>

                            <h3 className="font-semibold text-slate-800 mb-3">Productos</h3>
                            <div className="space-y-2">
                                {saleItems.map((item) => (
                                    <div key={item.id} className="flex justify-between py-2 border-b border-slate-100">
                                        <div>
                                            <span className="font-medium">{item.product_name}</span>
                                            <span className="text-slate-500 text-sm ml-2">x{item.quantity}</span>
                                        </div>
                                        <span className="font-medium">${Number(item.total).toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="p-6 bg-slate-50 rounded-b-xl">
                            <button
                                onClick={() => setSelectedSale(null)}
                                className="w-full py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
