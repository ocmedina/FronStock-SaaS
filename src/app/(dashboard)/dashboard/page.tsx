'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
    Package,
    AlertTriangle,
    Users,
    Tags,
    ShoppingCart,
    DollarSign,
    CreditCard,
    Plus,
    UserPlus,
    BarChart3,
    ArrowRight,
    TrendingUp,
    TrendingDown,
    Loader2,
    Clock,
} from 'lucide-react';

interface DashboardStats {
    totalProducts: number;
    lowStockProducts: number;
    totalCustomers: number;
    totalCategories: number;
    todaySales: number;
    todayRevenue: number;
    weekRevenue: number;
    monthRevenue: number;
    lastWeekRevenue: number;
}

interface RecentSale {
    id: string;
    total: number;
    created_at: string;
    payment_method: string;
    items_count: number;
}

interface TopProduct {
    name: string;
    quantity: number;
    revenue: number;
}

export default function DashboardPage() {
    const { organization, profile, isLoading: orgLoading, error } = useOrganization();
    const [stats, setStats] = useState<DashboardStats>({
        totalProducts: 0,
        lowStockProducts: 0,
        totalCustomers: 0,
        totalCategories: 0,
        todaySales: 0,
        todayRevenue: 0,
        weekRevenue: 0,
        monthRevenue: 0,
        lastWeekRevenue: 0,
    });
    const [recentSales, setRecentSales] = useState<RecentSale[]>([]);
    const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const supabase = createClient();

    useEffect(() => {
        const fetchStats = async () => {
            if (!organization?.id) return;

            setIsLoading(true);

            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

            const [
                productsRes,
                lowStockRes,
                customersRes,
                categoriesRes,
                todaySalesRes,
                weekSalesRes,
                lastWeekSalesRes,
                monthSalesRes,
                recentSalesRes,
            ] = await Promise.all([
                supabase.from('products').select('*', { count: 'exact', head: true }).eq('organization_id', organization.id),
                supabase.from('products').select('*', { count: 'exact', head: true }).eq('organization_id', organization.id).lte('stock', 10),
                supabase.from('customers').select('*', { count: 'exact', head: true }).eq('organization_id', organization.id),
                supabase.from('categories').select('*', { count: 'exact', head: true }).eq('organization_id', organization.id),
                supabase.from('sales').select('total').eq('organization_id', organization.id).eq('status', 'completed').gte('created_at', today.toISOString()),
                supabase.from('sales').select('total').eq('organization_id', organization.id).eq('status', 'completed').gte('created_at', weekAgo.toISOString()),
                supabase.from('sales').select('total').eq('organization_id', organization.id).eq('status', 'completed').gte('created_at', twoWeeksAgo.toISOString()).lt('created_at', weekAgo.toISOString()),
                supabase.from('sales').select('total').eq('organization_id', organization.id).eq('status', 'completed').gte('created_at', monthStart.toISOString()),
                supabase.from('sales').select('id, total, created_at, payment_method').eq('organization_id', organization.id).eq('status', 'completed').order('created_at', { ascending: false }).limit(5),
            ]);

            const todayRevenue = todaySalesRes.data?.reduce((sum, s) => sum + Number(s.total), 0) || 0;
            const weekRevenue = weekSalesRes.data?.reduce((sum, s) => sum + Number(s.total), 0) || 0;
            const lastWeekRevenue = lastWeekSalesRes.data?.reduce((sum, s) => sum + Number(s.total), 0) || 0;
            const monthRevenue = monthSalesRes.data?.reduce((sum, s) => sum + Number(s.total), 0) || 0;

            const salesWithItems: RecentSale[] = [];
            if (recentSalesRes.data) {
                for (const sale of recentSalesRes.data) {
                    const { count } = await supabase
                        .from('sale_items')
                        .select('*', { count: 'exact', head: true })
                        .eq('sale_id', sale.id);
                    salesWithItems.push({
                        ...sale,
                        items_count: count || 0,
                    });
                }
            }

            const { data: monthSaleIds } = await supabase
                .from('sales')
                .select('id')
                .eq('organization_id', organization.id)
                .eq('status', 'completed')
                .gte('created_at', monthStart.toISOString());

            if (monthSaleIds && monthSaleIds.length > 0) {
                const { data: saleItems } = await supabase
                    .from('sale_items')
                    .select('product_name, quantity, total')
                    .in('sale_id', monthSaleIds.map(s => s.id));

                const productMap: Record<string, { quantity: number; revenue: number }> = {};
                saleItems?.forEach((item) => {
                    if (!productMap[item.product_name]) {
                        productMap[item.product_name] = { quantity: 0, revenue: 0 };
                    }
                    productMap[item.product_name].quantity += item.quantity;
                    productMap[item.product_name].revenue += Number(item.total);
                });

                const top = Object.entries(productMap)
                    .map(([name, data]) => ({ name, ...data }))
                    .sort((a, b) => b.revenue - a.revenue)
                    .slice(0, 5);

                setTopProducts(top);
            }

            setStats({
                totalProducts: productsRes.count || 0,
                lowStockProducts: lowStockRes.count || 0,
                totalCustomers: customersRes.count || 0,
                totalCategories: categoriesRes.count || 0,
                todaySales: todaySalesRes.data?.length || 0,
                todayRevenue,
                weekRevenue,
                monthRevenue,
                lastWeekRevenue,
            });

            setRecentSales(salesWithItems);
            setIsLoading(false);
        };

        if (organization) {
            fetchStats();
        }
    }, [organization, supabase]);

    const weekChange = stats.lastWeekRevenue > 0
        ? ((stats.weekRevenue - stats.lastWeekRevenue) / stats.lastWeekRevenue) * 100
        : stats.weekRevenue > 0 ? 100 : 0;

    const paymentLabels: Record<string, string> = {
        cash: 'Efectivo',
        card: 'Tarjeta',
        transfer: 'Transfer.',
    };

    if (orgLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    if (error) {
        return (
            <Card className="border-destructive">
                <CardContent className="p-6">
                    <p className="font-medium text-destructive">Error al cargar datos</p>
                    <p className="text-sm text-muted-foreground">{error}</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Welcome Banner */}
            <div className="rounded-2xl p-8 text-primary-foreground relative overflow-hidden bg-gradient-to-r from-primary to-purple-600 dark:from-primary dark:to-purple-700">
                <div className="relative z-10">
                    <h1 className="text-3xl font-bold mb-2">
                        ¡Hola, {profile?.full_name?.split(' ')[0] || 'Usuario'}! 👋
                    </h1>
                    <p className="opacity-90 text-lg">
                        {organization?.name} • {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </p>
                </div>
                <div className="absolute right-0 top-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="absolute right-20 bottom-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2" />
            </div>

            {/* Revenue Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-emerald-500 dark:bg-emerald-600 text-white border-0">
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="opacity-80 text-sm">Hoy</p>
                                <p className="text-2xl font-bold">${stats.todayRevenue.toLocaleString('es-AR')}</p>
                                <p className="opacity-80 text-xs">{stats.todaySales} ventas</p>
                            </div>
                            <DollarSign className="h-10 w-10 opacity-50" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-blue-500 dark:bg-blue-600 text-white border-0">
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="opacity-80 text-sm">Esta Semana</p>
                                <p className="text-2xl font-bold">${stats.weekRevenue.toLocaleString('es-AR')}</p>
                                <div className="flex items-center gap-1 text-xs">
                                    {weekChange >= 0 ? (
                                        <TrendingUp className="h-3 w-3" />
                                    ) : (
                                        <TrendingDown className="h-3 w-3" />
                                    )}
                                    <span>
                                        {weekChange >= 0 ? '+' : ''}{weekChange.toFixed(0)}% vs semana pasada
                                    </span>
                                </div>
                            </div>
                            <TrendingUp className="h-10 w-10 opacity-50" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-purple-500 dark:bg-purple-600 text-white border-0">
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="opacity-80 text-sm">Este Mes</p>
                                <p className="text-2xl font-bold">${stats.monthRevenue.toLocaleString('es-AR')}</p>
                            </div>
                            <BarChart3 className="h-10 w-10 opacity-50" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-muted-foreground text-sm">Ticket Promedio</p>
                                <p className="text-2xl font-bold">
                                    ${stats.todaySales > 0 ? (stats.todayRevenue / stats.todaySales).toFixed(0) : '0'}
                                </p>
                                <p className="text-muted-foreground text-xs">hoy</p>
                            </div>
                            <ShoppingCart className="h-10 w-10 text-muted-foreground/30" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Quick Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Link href="/dashboard/products">
                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500 dark:bg-blue-500/20 dark:text-blue-400">
                                <Package className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{isLoading ? '...' : stats.totalProducts}</p>
                                <p className="text-xs text-muted-foreground">Productos</p>
                            </div>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/dashboard/stock">
                    <Card className={`hover:shadow-md transition-shadow cursor-pointer ${stats.lowStockProducts > 0 ? 'border-orange-500/50' : ''}`}>
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${stats.lowStockProducts > 0 ? 'bg-orange-500/10 text-orange-500 dark:bg-orange-500/20 dark:text-orange-400' : 'bg-muted text-muted-foreground'}`}>
                                <AlertTriangle className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{isLoading ? '...' : stats.lowStockProducts}</p>
                                <p className="text-xs text-muted-foreground">Stock Bajo</p>
                            </div>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/dashboard/customers">
                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500 dark:bg-purple-500/20 dark:text-purple-400">
                                <Users className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{isLoading ? '...' : stats.totalCustomers}</p>
                                <p className="text-xs text-muted-foreground">Clientes</p>
                            </div>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/dashboard/categories">
                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-500 dark:bg-cyan-500/20 dark:text-cyan-400">
                                <Tags className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{isLoading ? '...' : stats.totalCategories}</p>
                                <p className="text-xs text-muted-foreground">Categorías</p>
                            </div>
                        </CardContent>
                    </Card>
                </Link>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Sales */}
                <Card className="lg:col-span-2">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Clock className="h-5 w-5" /> Ventas Recientes
                        </CardTitle>
                        <Link href="/dashboard/sales/history">
                            <Button variant="ghost" size="sm">Ver todas <ArrowRight className="h-4 w-4 ml-1" /></Button>
                        </Link>
                    </CardHeader>
                    <CardContent>
                        {recentSales.length === 0 ? (
                            <p className="text-muted-foreground text-center py-8">No hay ventas recientes</p>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Hora</TableHead>
                                        <TableHead>Items</TableHead>
                                        <TableHead>Pago</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {recentSales.map((sale) => (
                                        <TableRow key={sale.id}>
                                            <TableCell className="text-muted-foreground">
                                                {new Date(sale.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                                            </TableCell>
                                            <TableCell>{sale.items_count} productos</TableCell>
                                            <TableCell>
                                                <Badge variant="secondary">
                                                    {paymentLabels[sale.payment_method] || sale.payment_method}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right font-semibold">
                                                ${Number(sale.total).toLocaleString('es-AR')}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>

                {/* Top Products */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <TrendingUp className="h-5 w-5" /> Top Productos
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">Este mes</p>
                    </CardHeader>
                    <CardContent>
                        {topProducts.length === 0 ? (
                            <p className="text-muted-foreground text-center py-8">Sin datos</p>
                        ) : (
                            <div className="space-y-3">
                                {topProducts.map((product, i) => (
                                    <div key={product.name} className="flex items-center gap-3">
                                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400' :
                                                i === 1 ? 'bg-muted' :
                                                    i === 2 ? 'bg-orange-500/20 text-orange-600 dark:text-orange-400' : 'bg-muted/50'
                                            }`}>
                                            {i + 1}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium truncate">{product.name}</p>
                                            <p className="text-xs text-muted-foreground">{product.quantity} unidades</p>
                                        </div>
                                        <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                                            ${product.revenue.toLocaleString('es-AR')}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Quick Actions */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Acciones Rápidas</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Link href="/dashboard/sales">
                            <Button className="w-full h-auto py-4 flex-col gap-2" size="lg">
                                <CreditCard className="h-6 w-6" />
                                Nueva Venta
                            </Button>
                        </Link>
                        <Link href="/dashboard/products">
                            <Button variant="outline" className="w-full h-auto py-4 flex-col gap-2" size="lg">
                                <Plus className="h-6 w-6" />
                                Nuevo Producto
                            </Button>
                        </Link>
                        <Link href="/dashboard/customers">
                            <Button variant="outline" className="w-full h-auto py-4 flex-col gap-2" size="lg">
                                <UserPlus className="h-6 w-6" />
                                Nuevo Cliente
                            </Button>
                        </Link>
                        <Link href="/dashboard/reports">
                            <Button variant="outline" className="w-full h-auto py-4 flex-col gap-2" size="lg">
                                <BarChart3 className="h-6 w-6" />
                                Ver Reportes
                            </Button>
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
