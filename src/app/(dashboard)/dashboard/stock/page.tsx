"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Loader2,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Package,
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart3,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface Product {
  id: string;
  name: string;
  stock: number;
}

interface StockMovement {
  id: string;
  product_id: string;
  product_name: string;
  movement_type: string;
  quantity: number;
  previous_stock: number;
  new_stock: number;
  reason: string | null;
  reference_type: string | null;
  notes: string | null;
  created_at: string;
}

const MOVEMENT_TYPES = {
  entry: {
    label: "Entrada",
    variant: "default" as const,
    icon: ArrowDownLeft,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
  },
  exit: {
    label: "Salida",
    variant: "destructive" as const,
    icon: ArrowUpRight,
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-900/30",
  },
  adjustment: {
    label: "Ajuste",
    variant: "secondary" as const,
    icon: RefreshCw,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },
};

const REASONS: Record<string, string> = {
  sale: "Venta",
  purchase: "Compra",
  adjustment: "Ajuste de inventario",
  damaged: "Producto dañado",
  lost: "Pérdida",
  returned: "Devolución",
  correction: "Corrección",
  initial: "Stock inicial",
  other: "Otro",
};

export default function StockMovementsPage() {
  const { organizationId, profile, isLoading: orgLoading } = useOrganization();
  const { canCreate } = usePermissions();
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState({ type: "all", productId: "" });
  const [formData, setFormData] = useState({
    product_id: "",
    movement_type: "entry",
    quantity: 1,
    reason: "adjustment",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const supabase = createClient();

  const fetchData = useCallback(async () => {
    if (!organizationId) return;
    setIsLoading(true);

    let query = supabase
      .from("stock_movements")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (filter.type !== "all") {
      query = query.eq("movement_type", filter.type);
    }
    if (filter.productId) {
      query = query.eq("product_id", filter.productId);
    }

    const { data: movementsData } = await query;
    if (movementsData) setMovements(movementsData);

    const { data: productsData } = await supabase
      .from("products")
      .select("id, name, stock")
      .eq("organization_id", organizationId)
      .order("name");
    if (productsData) setProducts(productsData);

    setIsLoading(false);
  }, [organizationId, filter, supabase]);

  useEffect(() => {
    if (organizationId) fetchData();
  }, [organizationId, fetchData]);

  const handleOpenModal = () => {
    if (products.length === 0) return;
    setFormData({
      product_id: products[0].id,
      movement_type: "entry",
      quantity: 1,
      reason: "adjustment",
      notes: "",
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId || !profile) return;

    setSaving(true);

    const product = products.find((p) => p.id === formData.product_id);
    if (!product) {
      setSaving(false);
      return;
    }

    const isEntry = formData.movement_type === "entry";
    const quantityChange = isEntry ? formData.quantity : -formData.quantity;
    const newStock = product.stock + quantityChange;

    if (newStock < 0) {
      alert("No hay suficiente stock para esta salida");
      setSaving(false);
      return;
    }

    await supabase.from("stock_movements").insert({
      organization_id: organizationId,
      product_id: formData.product_id,
      product_name: product.name,
      movement_type: formData.movement_type,
      quantity: quantityChange,
      previous_stock: product.stock,
      new_stock: newStock,
      reason: formData.reason,
      reference_type: "manual",
      notes: formData.notes || null,
      created_by: profile.id,
    });

    await supabase
      .from("products")
      .update({ stock: newStock })
      .eq("id", formData.product_id);

    setSaving(false);
    setShowModal(false);
    fetchData();
  };

  // Calcular estadísticas
  const stats = useMemo(() => {
    const entries = movements.filter((m) => m.movement_type === "entry").length;
    const exits = movements.filter((m) => m.movement_type === "exit").length;
    const adjustments = movements.filter(
      (m) => m.movement_type === "adjustment",
    ).length;
    const totalEntryQty = movements
      .filter((m) => m.quantity > 0)
      .reduce((sum, m) => sum + m.quantity, 0);
    const totalExitQty = movements
      .filter((m) => m.quantity < 0)
      .reduce((sum, m) => sum + Math.abs(m.quantity), 0);
    return { entries, exits, adjustments, totalEntryQty, totalExitQty };
  }, [movements]);

  // Preparar datos para el gráfico
  const chartData = useMemo(() => {
    const last7Days: Record<string, { entries: number; exits: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      last7Days[dateStr] = { entries: 0, exits: 0 };
    }

    movements.forEach((m) => {
      const dateStr = m.created_at.split("T")[0];
      if (last7Days[dateStr]) {
        if (m.quantity > 0) {
          last7Days[dateStr].entries += m.quantity;
        } else {
          last7Days[dateStr].exits += Math.abs(m.quantity);
        }
      }
    });

    return Object.entries(last7Days).map(([date, data]) => ({
      date: new Date(date).toLocaleDateString("es-AR", { weekday: "short" }),
      entradas: data.entries,
      salidas: data.exits,
    }));
  }, [movements]);

  if (orgLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
            Movimientos de Stock
          </h1>
          <p className="text-muted-foreground mt-1">
            Historial de entradas, salidas y ajustes
          </p>
        </div>
        {canCreate("products") && products.length > 0 && (
          <Button
            onClick={handleOpenModal}
            className="shadow-lg shadow-primary/20"
          >
            <Plus className="h-4 w-4" /> Nuevo Movimiento
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-0 shadow-lg shadow-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-100 text-sm">Entradas</p>
                <p className="text-2xl font-bold mt-1">
                  +{stats.totalEntryQty}
                </p>
                <p className="text-emerald-100 text-xs mt-1">
                  {stats.entries} movimientos
                </p>
              </div>
              <ArrowDownLeft className="h-8 w-8 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500 to-rose-600 text-white border-0 shadow-lg shadow-red-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-100 text-sm">Salidas</p>
                <p className="text-2xl font-bold mt-1">-{stats.totalExitQty}</p>
                <p className="text-red-100 text-xs mt-1">
                  {stats.exits} movimientos
                </p>
              </div>
              <ArrowUpRight className="h-8 w-8 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 shadow-lg shadow-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">Ajustes</p>
                <p className="text-2xl font-bold mt-1">{stats.adjustments}</p>
                <p className="text-blue-100 text-xs mt-1">correcciones</p>
              </div>
              <RefreshCw className="h-8 w-8 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Productos</p>
                <p className="text-2xl font-bold mt-1">{products.length}</p>
                <p className="text-muted-foreground text-xs mt-1">
                  en inventario
                </p>
              </div>
              <Package className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="h-5 w-5 text-primary" />
            Actividad de Stock (últimos 7 días)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorEntradas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorSalidas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <Area
                type="monotone"
                dataKey="entradas"
                stroke="#10b981"
                fill="url(#colorEntradas)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="salidas"
                stroke="#ef4444"
                fill="url(#colorSalidas)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="w-40">
          <Select
            value={filter.type}
            onValueChange={(v) => setFilter({ ...filter, type: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Todos
                </div>
              </SelectItem>
              <SelectItem value="entry">
                <div className="flex items-center gap-2">
                  <ArrowDownLeft className="h-4 w-4 text-emerald-600" />
                  Entradas
                </div>
              </SelectItem>
              <SelectItem value="exit">
                <div className="flex items-center gap-2">
                  <ArrowUpRight className="h-4 w-4 text-red-600" />
                  Salidas
                </div>
              </SelectItem>
              <SelectItem value="adjustment">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-blue-600" />
                  Ajustes
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-60">
          <Select
            value={filter.productId || "all"}
            onValueChange={(v) =>
              setFilter({ ...filter, productId: v === "all" ? "" : v })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos los productos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los productos</SelectItem>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Movements Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead>Motivo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-4 rounded-full bg-muted">
                        <Activity className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <p className="font-medium">
                        No hay movimientos registrados
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Los movimientos aparecerán aquí
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                movements.map((mov) => {
                  const typeInfo =
                    MOVEMENT_TYPES[
                      mov.movement_type as keyof typeof MOVEMENT_TYPES
                    ] || MOVEMENT_TYPES.adjustment;
                  const Icon = typeInfo.icon;
                  return (
                    <TableRow key={mov.id} className="hover:bg-muted/50">
                      <TableCell>
                        <div>
                          {new Date(mov.created_at).toLocaleDateString("es-AR")}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(mov.created_at).toLocaleTimeString(
                            "es-AR",
                            { hour: "2-digit", minute: "2-digit" },
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-primary/10">
                            <Package className="h-4 w-4 text-primary" />
                          </div>
                          <span className="font-medium">
                            {mov.product_name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={typeInfo.variant}
                          className={`gap-1.5 ${typeInfo.bgColor} ${typeInfo.color}`}
                        >
                          <Icon className="h-3.5 w-3.5" /> {typeInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={`font-semibold ${mov.quantity > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
                        >
                          {mov.quantity > 0 ? "+" : ""}
                          {mov.quantity}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-muted-foreground">
                            {mov.previous_stock}
                          </span>
                          <span className="text-muted-foreground">→</span>
                          <span className="font-semibold">{mov.new_stock}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {REASONS[mov.reason as string] || mov.reason || "-"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal */}
      <Dialog open={showModal} onOpenChange={() => setShowModal(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Activity className="h-5 w-5 text-primary" />
              </div>
              Nuevo Movimiento de Stock
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-5 pt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                Producto
              </label>
              <Select
                value={formData.product_id}
                onValueChange={(v) =>
                  setFormData({ ...formData, product_id: v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar producto..." />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <div className="flex items-center justify-between gap-4">
                        <span>{p.name}</span>
                        <Badge variant="outline" className="ml-2">
                          Stock: {p.stock}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Tipo de Movimiento
                </label>
                <Select
                  value={formData.movement_type}
                  onValueChange={(v) =>
                    setFormData({ ...formData, movement_type: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entry">
                      <div className="flex items-center gap-2">
                        <ArrowDownLeft className="h-4 w-4 text-emerald-600" />
                        Entrada
                      </div>
                    </SelectItem>
                    <SelectItem value="exit">
                      <div className="flex items-center gap-2">
                        <ArrowUpRight className="h-4 w-4 text-red-600" />
                        Salida
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Cantidad</label>
                <Input
                  type="number"
                  value={formData.quantity}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      quantity: parseInt(e.target.value) || 1,
                    })
                  }
                  min="1"
                  className="font-semibold"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Motivo</label>
              <Select
                value={formData.reason}
                onValueChange={(v) => setFormData({ ...formData, reason: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="adjustment">
                    📋 Ajuste de inventario
                  </SelectItem>
                  <SelectItem value="damaged">⚠️ Producto dañado</SelectItem>
                  <SelectItem value="lost">❌ Pérdida</SelectItem>
                  <SelectItem value="returned">↩️ Devolución</SelectItem>
                  <SelectItem value="correction">✏️ Corrección</SelectItem>
                  <SelectItem value="initial">📦 Stock inicial</SelectItem>
                  <SelectItem value="other">📝 Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Notas (opcional)</label>
              <textarea
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                rows={2}
                placeholder="Descripción adicional del movimiento..."
                className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>

            {/* Preview del movimiento */}
            {formData.product_id && (
              <div className="p-3 rounded-lg bg-muted/50 border">
                <p className="text-xs text-muted-foreground mb-1">
                  Vista previa:
                </p>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      formData.movement_type === "entry"
                        ? "default"
                        : "destructive"
                    }
                  >
                    {formData.movement_type === "entry" ? "+" : "-"}
                    {formData.quantity}
                  </Badge>
                  <span className="text-sm">
                    {products.find((p) => p.id === formData.product_id)?.name}
                  </span>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowModal(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="flex-1 shadow-lg shadow-primary/20"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving ? "Guardando..." : "Registrar Movimiento"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
