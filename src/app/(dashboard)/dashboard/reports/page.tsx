'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { usePermissions } from '@/hooks/usePermissions';
import { AccessDenied } from '@/components/Protected';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Loader2, DollarSign, ShoppingCart, TrendingUp, Banknote, CreditCard, Building } from 'lucide-react';

interface TopProduct {
    product_name: string;
    total_quantity: number;
    total_revenue: number;
}

interface DailySales {
    date: string;
    total: number;
    count: number;
}

type Period = 'today' | 'week' | 'month' | 'year';

export default function ReportsPage() {
    const { organizationId, isLoading: orgLoading } = useOrganization();
    const { canView } = usePermissions();
    const [period, setPeriod] = useState<Period>('month');
    const [isLoading, setIsLoading] = useState(true);
    const [stats, setStats] = useState({
        totalRevenue: 0,
        totalSales: 0,
        averageTicket: 0,
        topProducts: [] as TopProduct[],
        dailySales: [] as DailySales[],
        paymentMethods: {} as Record<string, number>,
    });

    const supabase = createClient();

    const getDateRange = (p: Period) => {
        const now = new Date();
        let start: Date;

        switch (p) {
            case 'today':
                start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                break;
            case 'week':
                start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'month':
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case 'year':
                start = new Date(now.getFullYear(), 0, 1);
                break;
        }

        return start.toISOString();
    };

    const fetchReports = useCallback(async () => {
        if (!organizationId) return;
        setIsLoading(true);

        const startDate = getDateRange(period);

        const { data: sales } = await supabase
            .from('sales')
            .select('id, total, created_at, payment_method')
            .eq('organization_id', organizationId)
            .eq('status', 'completed')
            .gte('created_at', startDate)
            .order('created_at', { ascending: false });

        if (!sales || sales.length === 0) {
            setStats({
                totalRevenue: 0,
                totalSales: 0,
                averageTicket: 0,
                topProducts: [],
                dailySales: [],
                paymentMethods: {},
            });
            setIsLoading(false);
            return;
        }

        const totalRevenue = sales.reduce((sum, s) => sum + Number(s.total), 0);
        const totalSales = sales.length;
        const averageTicket = totalRevenue / totalSales;

        const paymentMethods: Record<string, number> = {};
        sales.forEach((s) => {
            paymentMethods[s.payment_method] = (paymentMethods[s.payment_method] || 0) + Number(s.total);
        });

        const dailyMap: Record<string, { total: number; count: number }> = {};
        sales.forEach((s) => {
            const date = s.created_at.split('T')[0];
            if (!dailyMap[date]) dailyMap[date] = { total: 0, count: 0 };
            dailyMap[date].total += Number(s.total);
            dailyMap[date].count += 1;
        });
        const dailySales = Object.entries(dailyMap)
            .map(([date, data]) => ({ date, ...data }))
            .sort((a, b) => a.date.localeCompare(b.date));

        const saleIds = sales.map((s) => s.id);
        const { data: saleItems } = await supabase
            .from('sale_items')
            .select('product_name, quantity, total')
            .in('sale_id', saleIds);

        const productMap: Record<string, { quantity: number; revenue: number }> = {};
        saleItems?.forEach((item) => {
            if (!productMap[item.product_name]) {
                productMap[item.product_name] = { quantity: 0, revenue: 0 };
            }
            productMap[item.product_name].quantity += item.quantity;
            productMap[item.product_name].revenue += Number(item.total);
        });

        const topProducts = Object.entries(productMap)
            .map(([name, data]) => ({
                product_name: name,
                total_quantity: data.quantity,
                total_revenue: data.revenue,
            }))
            .sort((a, b) => b.total_revenue - a.total_revenue)
            .slice(0, 10);

        setStats({
            totalRevenue,
            totalSales,
            averageTicket,
            topProducts,
            dailySales,
            paymentMethods,
        });

        setIsLoading(false);
    }, [organizationId, period, supabase]);

    useEffect(() => {
        if (organizationId) fetchReports();
    }, [organizationId, fetchReports]);

    const periodLabels: Record<Period, string> = {
        today: 'Hoy',
        week: 'Semana',
        month: 'Mes',
        year: 'Año',
    };

    const paymentLabels: Record<string, string> = {
        cash: 'Efectivo',
        card: 'Tarjeta',
        transfer: 'Transferencia',
    };

    const paymentIcons: Record<string, typeof Banknote> = {
        cash: Banknote,
        card: CreditCard,
        transfer: Building,
    };

    if (orgLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!canView('reports')) {
        return <AccessDenied />;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Reportes</h1>
                    <p className="text-muted-foreground">Análisis de ventas y rendimiento</p>
                </div>

                {/* Period Selector */}
                <div className="flex gap-1 bg-muted p-1 rounded-lg">
                    {(Object.keys(periodLabels) as Period[]).map((p) => (
                        <Button
                            key={p}
                            variant={period === p ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setPeriod(p)}
                        >
                            {periodLabels[p]}
                        </Button>
                    ))}
                </div>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : (
                <>
                    {/* Key Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card className="bg-gradient-to-br from-green-500 to-emerald-600 text-white border-0">
                            <CardContent className="p-6">
                                <div className="flex items-center gap-3 mb-2">
                                    <DollarSign className="h-5 w-5 opacity-70" />
                                    <span className="text-green-100 text-sm">Ingresos Totales</span>
                                </div>
                                <p className="text-3xl font-bold">${stats.totalRevenue.toFixed(2)}</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white border-0">
                            <CardContent className="p-6">
                                <div className="flex items-center gap-3 mb-2">
                                    <ShoppingCart className="h-5 w-5 opacity-70" />
                                    <span className="text-blue-100 text-sm">Ventas Realizadas</span>
                                </div>
                                <p className="text-3xl font-bold">{stats.totalSales}</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-gradient-to-br from-purple-500 to-pink-600 text-white border-0">
                            <CardContent className="p-6">
                                <div className="flex items-center gap-3 mb-2">
                                    <TrendingUp className="h-5 w-5 opacity-70" />
                                    <span className="text-purple-100 text-sm">Ticket Promedio</span>
                                </div>
                                <p className="text-3xl font-bold">${stats.averageTicket.toFixed(2)}</p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Sales Chart */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Ventas por Día</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {stats.dailySales.length === 0 ? (
                                    <p className="text-muted-foreground text-center py-8">No hay datos de ventas</p>
                                ) : (
                                    <div className="space-y-3">
                                        {stats.dailySales.slice(-7).map((day) => {
                                            const maxTotal = Math.max(...stats.dailySales.map((d) => d.total));
                                            const width = maxTotal > 0 ? (day.total / maxTotal) * 100 : 0;
                                            return (
                                                <div key={day.date} className="flex items-center gap-4">
                                                    <span className="w-24 text-sm text-muted-foreground">
                                                        {new Date(day.date + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' })}
                                                    </span>
                                                    <div className="flex-1 bg-muted rounded-full h-6 overflow-hidden">
                                                        <div
                                                            className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full rounded-full flex items-center justify-end pr-2"
                                                            style={{ width: `${Math.max(width, 10)}%` }}
                                                        >
                                                            <span className="text-xs text-white font-medium">${day.total.toFixed(0)}</span>
                                                        </div>
                                                    </div>
                                                    <span className="text-xs text-muted-foreground w-16">{day.count} ventas</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Payment Methods */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Métodos de Pago</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {Object.keys(stats.paymentMethods).length === 0 ? (
                                    <p className="text-muted-foreground text-center py-8">No hay datos</p>
                                ) : (
                                    <div className="space-y-4">
                                        {Object.entries(stats.paymentMethods).map(([method, amount]) => {
                                            const percentage = stats.totalRevenue > 0 ? (amount / stats.totalRevenue) * 100 : 0;
                                            const Icon = paymentIcons[method] || Banknote;
                                            return (
                                                <div key={method}>
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-sm font-medium flex items-center gap-2">
                                                            <Icon className="h-4 w-4" />
                                                            {paymentLabels[method] || method}
                                                        </span>
                                                        <span className="text-sm text-muted-foreground">
                                                            ${amount.toFixed(2)} ({percentage.toFixed(0)}%)
                                                        </span>
                                                    </div>
                                                    <div className="bg-muted rounded-full h-3 overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full ${method === 'cash' ? 'bg-green-500' :
                                                                method === 'card' ? 'bg-blue-500' : 'bg-purple-500'
                                                                }`}
                                                            style={{ width: `${percentage}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Top Products */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Productos Más Vendidos</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-12">#</TableHead>
                                        <TableHead>Producto</TableHead>
                                        <TableHead className="text-right">Cantidad</TableHead>
                                        <TableHead className="text-right">Ingresos</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {stats.topProducts.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                                No hay productos vendidos en este período
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        stats.topProducts.map((product, index) => (
                                            <TableRow key={product.product_name}>
                                                <TableCell>
                                                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${index === 0 ? 'bg-yellow-100 text-yellow-700' :
                                                        index === 1 ? 'bg-muted' :
                                                            index === 2 ? 'bg-orange-100 text-orange-700' : 'bg-muted/50'
                                                        }`}>
                                                        {index + 1}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="font-medium">{product.product_name}</TableCell>
                                                <TableCell className="text-right text-muted-foreground">{product.total_quantity} unidades</TableCell>
                                                <TableCell className="text-right font-semibold text-green-600">
                                                    ${product.total_revenue.toFixed(2)}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}
