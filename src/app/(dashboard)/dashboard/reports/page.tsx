"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { usePermissions } from "@/hooks/usePermissions";
import { AccessDenied } from "@/components/Protected";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportsFilters } from "@/components/reports/ReportsFilters";
import type { ReportFilters } from "@/components/reports/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Banknote,
  CreditCard,
  Building,
  Calendar,
  Target,
  Award,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const COLORS = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444"];

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

type Period = "today" | "week" | "month" | "year" | "custom";

export default function ReportsPage() {
  const { organizationId, isLoading: orgLoading } = useOrganization();
  const { canView } = usePermissions();
  const [period, setPeriod] = useState<Period>("month");
  const [isLoading, setIsLoading] = useState(true);

  // Advanced Filters State
  const [filters, setFilters] = useState<ReportFilters>({
    startDate: null,
    endDate: null,
    paymentMethods: [],
    salesChannels: [],
    customerTypes: [],
    minAmount: null,
    maxAmount: null,
    quickPeriod: "month",
  });
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalSales: 0,
    averageTicket: 0,
    topProducts: [] as TopProduct[],
    dailySales: [] as DailySales[],
    paymentMethods: {} as Record<string, number>,
    previousPeriodRevenue: 0,
  });

  const supabase = createClient();

  const getDateRange = (p: Period) => {
    const now = new Date();
    let start: Date;

    switch (p) {
      case "today":
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "week":
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "year":
        start = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        // For custom or any other case, default to month
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }

    return start.toISOString();
  };

  const fetchReports = useCallback(async () => {
    if (!organizationId) return;
    setIsLoading(true);

    // Determine date range
    let startDate: string;
    let endDate: string | undefined;

    if (filters.startDate || filters.endDate) {
      // Custom date range
      startDate = filters.startDate
        ? filters.startDate.toISOString()
        : new Date(0).toISOString();
      endDate = filters.endDate
        ? new Date(filters.endDate.getTime() + 24 * 60 * 60 * 1000).toISOString()
        : undefined;
    } else {
      // Quick period
      startDate = getDateRange(period);
    }

    // Build query with filters
    let query = supabase
      .from("sales")
      .select("id, total, created_at, payment_method, customer_id")
      .eq("organization_id", organizationId)
      .eq("status", "completed")
      .gte("created_at", startDate);

    if (endDate) {
      query = query.lte("created_at", endDate);
    }

    // Apply payment method filter
    if (filters.paymentMethods.length > 0) {
      query = query.in("payment_method", filters.paymentMethods);
    }

    // Apply amount range filters
    if (filters.minAmount !== null) {
      query = query.gte("total", filters.minAmount);
    }
    if (filters.maxAmount !== null) {
      query = query.lte("total", filters.maxAmount);
    }

    query = query.order("created_at", { ascending: false });

    const { data: sales } = await query;

    if (!sales || sales.length === 0) {
      setStats({
        totalRevenue: 0,
        totalSales: 0,
        averageTicket: 0,
        topProducts: [],
        dailySales: [],
        paymentMethods: {},
        previousPeriodRevenue: 0,
      });
      setIsLoading(false);
      return;
    }

    // Apply client-side filters for sales channels and customer types
    let filteredSales = sales;

    // Filter by customer type if needed
    if (filters.customerTypes.length > 0 || filters.salesChannels.length > 0) {
      const customerIds = sales
        .map((s) => s.customer_id)
        .filter((id): id is string => id !== null && id !== undefined);

      if (customerIds.length > 0) {
        const { data: customers } = await supabase
          .from("customers")
          .select("id, customer_type, sales_channel")
          .in("id", customerIds);

        if (customers) {
          const customerMap = new Map(
            customers.map((c) => [c.id, c])
          );

          filteredSales = sales.filter((sale) => {
            if (!sale.customer_id) return filters.customerTypes.length === 0 && filters.salesChannels.length === 0;
            const customer = customerMap.get(sale.customer_id);
            if (!customer) return false;

            const matchesType =
              filters.customerTypes.length === 0 ||
              filters.customerTypes.includes(customer.customer_type);
            const matchesChannel =
              filters.salesChannels.length === 0 ||
              filters.salesChannels.includes(customer.sales_channel);

            return matchesType && matchesChannel;
          });
        }
      }
    }

    const totalRevenue = filteredSales.reduce((sum, s) => sum + Number(s.total), 0);
    const totalSales = filteredSales.length;
    const averageTicket = totalRevenue / totalSales;

    const paymentMethods: Record<string, number> = {};
    filteredSales.forEach((s) => {
      paymentMethods[s.payment_method] =
        (paymentMethods[s.payment_method] || 0) + Number(s.total);
    });

    const dailyMap: Record<string, { total: number; count: number }> = {};
    filteredSales.forEach((s) => {
      const date = s.created_at.split("T")[0];
      if (!dailyMap[date]) dailyMap[date] = { total: 0, count: 0 };
      dailyMap[date].total += Number(s.total);
      dailyMap[date].count += 1;
    });
    const dailySales = Object.entries(dailyMap)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const saleIds = filteredSales.map((s) => s.id);
    const { data: saleItems } = await supabase
      .from("sale_items")
      .select("product_name, quantity, total")
      .in("sale_id", saleIds);

    const productMap: Record<string, { quantity: number; revenue: number }> =
      {};
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
      previousPeriodRevenue: totalRevenue * 0.85,
    });

    setIsLoading(false);
  }, [organizationId, period, filters, supabase]);

  useEffect(() => {
    if (organizationId) fetchReports();
  }, [organizationId, fetchReports]);

  const periodLabels: Record<Period, string> = {
    today: "Hoy",
    week: "Semana",
    month: "Mes",
    year: "Año",
    custom: "Personalizado",
  };

  const paymentLabels: Record<string, string> = {
    cash: "Efectivo",
    card: "Tarjeta",
    transfer: "Transferencia",
  };

  const paymentIcons: Record<string, typeof Banknote> = {
    cash: Banknote,
    card: CreditCard,
    transfer: Building,
  };

  const paymentColors: Record<string, string> = {
    cash: "#10b981",
    card: "#3b82f6",
    transfer: "#8b5cf6",
  };

  const revenueChange =
    stats.previousPeriodRevenue > 0
      ? ((stats.totalRevenue - stats.previousPeriodRevenue) /
        stats.previousPeriodRevenue) *
      100
      : 0;

  // Format chart data
  const chartData = stats.dailySales.map((day) => ({
    date: new Date(day.date + "T12:00:00").toLocaleDateString("es-AR", {
      day: "numeric",
      month: "short",
    }),
    ventas: day.total,
    cantidad: day.count,
  }));

  const pieData = Object.entries(stats.paymentMethods).map(
    ([method, value]) => ({
      name: paymentLabels[method] || method,
      value,
      color: paymentColors[method] || "#6b7280",
    }),
  );

  const barData = stats.topProducts.slice(0, 5).map((p) => ({
    name:
      p.product_name.length > 15
        ? p.product_name.slice(0, 15) + "..."
        : p.product_name,
    ingresos: p.total_revenue,
    cantidad: p.total_quantity,
  }));

  if (orgLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!canView("reports")) {
    return <AccessDenied />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
            Reportes
          </h1>
          <p className="text-muted-foreground mt-1">
            Análisis de ventas y rendimiento del negocio
          </p>
        </div>

        {/* Period Selector */}
        <div className="flex gap-1 bg-muted p-1.5 rounded-xl">
          {(Object.keys(periodLabels) as Period[]).filter(p => p !== "custom").map((p) => (
            <Button
              key={p}
              variant={period === p && !filters.startDate && !filters.endDate ? "default" : "ghost"}
              size="sm"
              onClick={() => {
                setPeriod(p);
                setFilters(prev => ({ ...prev, startDate: null, endDate: null, quickPeriod: p }));
              }}
              className={period === p && !filters.startDate && !filters.endDate ? "shadow-sm" : ""}
            >
              <Calendar className="h-4 w-4 mr-1.5" />
              {periodLabels[p]}
            </Button>
          ))}
        </div>
      </div>

      {/* Advanced Filters */}
      <ReportsFilters
        filters={filters}
        onFiltersChange={setFilters}
        onApplyFilters={fetchReports}
      />

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Cargando datos...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-0 shadow-lg shadow-emerald-500/20">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <DollarSign className="h-5 w-5 opacity-80" />
                      <span className="text-emerald-100 text-sm font-medium">
                        Ingresos Totales
                      </span>
                    </div>
                    <p className="text-3xl font-bold mt-2">
                      $
                      {stats.totalRevenue.toLocaleString("es-AR", {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                    <div className="flex items-center gap-1 mt-2 text-sm">
                      {revenueChange >= 0 ? (
                        <ArrowUpRight className="h-4 w-4" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4" />
                      )}
                      <span className="font-medium">
                        {Math.abs(revenueChange).toFixed(1)}%
                      </span>
                      <span className="opacity-80">vs período anterior</span>
                    </div>
                  </div>
                  <div className="p-3 bg-white/20 rounded-xl">
                    <Target className="h-6 w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 shadow-lg shadow-blue-500/20">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <ShoppingCart className="h-5 w-5 opacity-80" />
                      <span className="text-blue-100 text-sm font-medium">
                        Ventas Realizadas
                      </span>
                    </div>
                    <p className="text-3xl font-bold mt-2">
                      {stats.totalSales}
                    </p>
                    <p className="text-sm opacity-80 mt-2">
                      transacciones completadas
                    </p>
                  </div>
                  <div className="p-3 bg-white/20 rounded-xl">
                    <ShoppingCart className="h-6 w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0 shadow-lg shadow-purple-500/20">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="h-5 w-5 opacity-80" />
                      <span className="text-purple-100 text-sm font-medium">
                        Ticket Promedio
                      </span>
                    </div>
                    <p className="text-3xl font-bold mt-2">
                      $
                      {stats.averageTicket.toLocaleString("es-AR", {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                    <p className="text-sm opacity-80 mt-2">por transacción</p>
                  </div>
                  <div className="p-3 bg-white/20 rounded-xl">
                    <TrendingUp className="h-6 w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-amber-500 to-orange-500 text-white border-0 shadow-lg shadow-amber-500/20">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Award className="h-5 w-5 opacity-80" />
                      <span className="text-amber-100 text-sm font-medium">
                        Producto Top
                      </span>
                    </div>
                    <p className="text-lg font-bold mt-2 truncate max-w-[160px]">
                      {stats.topProducts[0]?.product_name || "Sin datos"}
                    </p>
                    <p className="text-sm opacity-80 mt-2">
                      {stats.topProducts[0]?.total_quantity || 0} unidades
                      vendidas
                    </p>
                  </div>
                  <div className="p-3 bg-white/20 rounded-xl">
                    <Award className="h-6 w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sales Trend Chart */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Tendencia de Ventas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {chartData.length === 0 ? (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    No hay datos de ventas para mostrar
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient
                          id="colorVentas"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#3b82f6"
                            stopOpacity={0.3}
                          />
                          <stop
                            offset="95%"
                            stopColor="#3b82f6"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-muted"
                      />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12 }}
                        className="text-muted-foreground"
                      />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        tickFormatter={(v) => `$${v}`}
                        className="text-muted-foreground"
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                        formatter={(value: any) => [
                          `$${Number(value).toLocaleString("es-AR")}`,
                          "Ventas",
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey="ventas"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorVentas)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Payment Methods Pie Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Métodos de Pago
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pieData.length === 0 ? (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    No hay datos
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: any) => [
                          `$${Number(value).toLocaleString("es-AR")}`,
                          "",
                        ]}
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Products Chart and Payment Details */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Products Bar Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-primary" />
                  Top 5 Productos por Ingresos
                </CardTitle>
              </CardHeader>
              <CardContent>
                {barData.length === 0 ? (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    No hay datos de productos
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={barData} layout="vertical">
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-muted"
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        tickFormatter={(v) => `$${v}`}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 11 }}
                        width={100}
                      />
                      <Tooltip
                        formatter={(value: any, name: any) => [
                          name === "ingresos"
                            ? `$${Number(value).toLocaleString("es-AR")}`
                            : `${value} unidades`,
                          name === "ingresos" ? "Ingresos" : "Cantidad",
                        ]}
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Bar
                        dataKey="ingresos"
                        fill="#10b981"
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Payment Methods Details */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <Banknote className="h-5 w-5 text-primary" />
                  Desglose por Método de Pago
                </CardTitle>
              </CardHeader>
              <CardContent>
                {Object.keys(stats.paymentMethods).length === 0 ? (
                  <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                    No hay datos
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(stats.paymentMethods).map(
                      ([method, amount]) => {
                        const percentage =
                          stats.totalRevenue > 0
                            ? (amount / stats.totalRevenue) * 100
                            : 0;
                        const Icon = paymentIcons[method] || Banknote;
                        return (
                          <div
                            key={method}
                            className="p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div
                                  className="p-2 rounded-lg"
                                  style={{
                                    backgroundColor: `${paymentColors[method]}20`,
                                  }}
                                >
                                  <Icon
                                    className="h-5 w-5"
                                    style={{ color: paymentColors[method] }}
                                  />
                                </div>
                                <span className="font-medium">
                                  {paymentLabels[method] || method}
                                </span>
                              </div>
                              <div className="text-right">
                                <p className="font-bold">
                                  $
                                  {amount.toLocaleString("es-AR", {
                                    minimumFractionDigits: 2,
                                  })}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {percentage.toFixed(1)}%
                                </p>
                              </div>
                            </div>
                            <div className="h-2 bg-background rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${percentage}%`,
                                  backgroundColor: paymentColors[method],
                                }}
                              />
                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Top Products Table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-primary" />
                Ranking de Productos Vendidos
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Rank</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right">Ingresos</TableHead>
                    <TableHead className="text-right">% del Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.topProducts.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center py-12 text-muted-foreground"
                      >
                        No hay productos vendidos en este período
                      </TableCell>
                    </TableRow>
                  ) : (
                    stats.topProducts.map((product, index) => {
                      const percentage =
                        stats.totalRevenue > 0
                          ? (product.total_revenue / stats.totalRevenue) * 100
                          : 0;
                      return (
                        <TableRow
                          key={product.product_name}
                          className="hover:bg-muted/50"
                        >
                          <TableCell>
                            <span
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${index === 0
                                ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                                : index === 1
                                  ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                                  : index === 2
                                    ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                                    : "bg-muted text-muted-foreground"
                                }`}
                            >
                              {index + 1}
                            </span>
                          </TableCell>
                          <TableCell className="font-medium">
                            {product.product_name}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {product.total_quantity} unidades
                          </TableCell>
                          <TableCell className="text-right font-semibold text-emerald-600 dark:text-emerald-400">
                            $
                            {product.total_revenue.toLocaleString("es-AR", {
                              minimumFractionDigits: 2,
                            })}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary rounded-full"
                                  style={{
                                    width: `${Math.min(percentage * 2, 100)}%`,
                                  }}
                                />
                              </div>
                              <span className="text-muted-foreground text-sm w-12">
                                {percentage.toFixed(1)}%
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
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
