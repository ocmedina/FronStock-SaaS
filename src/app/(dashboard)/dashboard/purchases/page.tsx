"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  ShoppingBag,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  Package,
  DollarSign,
  Loader2,
  Eye,
  Trash2,
  AlertTriangle,
} from "lucide-react";

interface Supplier {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
}

interface PurchaseOrder {
  id: string;
  order_number: string | null;
  supplier_id: string;
  supplier: { name: string } | null;
  status: string;
  total: number;
  created_at: string;
  received_at: string | null;
}

interface OrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_cost: number;
}

const STATUS_LABELS: Record<
  string,
  { label: string; color: string; icon: typeof Clock }
> = {
  pending: {
    label: "Pendiente",
    color:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    icon: Clock,
  },
  ordered: {
    label: "Ordenado",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    icon: Truck,
  },
  received: {
    label: "Recibido",
    color:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    icon: CheckCircle,
  },
  cancelled: {
    label: "Cancelado",
    color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    icon: XCircle,
  },
};

export default function PurchaseOrdersPage() {
  const { organizationId, isLoading: orgLoading } = useOrganization();
  const { canCreate, canEdit } = usePermissions();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(
    null,
  );
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [formData, setFormData] = useState({ supplier_id: "", notes: "" });
  const [items, setItems] = useState<OrderItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  const supabase = createClient();

  const fetchData = useCallback(async () => {
    if (!organizationId) return;
    setIsLoading(true);

    const [ordersRes, suppliersRes, productsRes] = await Promise.all([
      supabase
        .from("purchase_orders")
        .select("*, supplier:suppliers(name)")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false }),
      supabase
        .from("suppliers")
        .select("id, name")
        .eq("organization_id", organizationId)
        .order("name"),
      supabase
        .from("products")
        .select("id, name, price")
        .eq("organization_id", organizationId)
        .order("name"),
    ]);

    if (ordersRes.data) setOrders(ordersRes.data);
    if (suppliersRes.data) setSuppliers(suppliersRes.data);
    if (productsRes.data) setProducts(productsRes.data);
    setIsLoading(false);
  }, [organizationId, supabase]);

  useEffect(() => {
    if (organizationId) fetchData();
  }, [organizationId, fetchData]);

  const handleOpenNew = () => {
    setSelectedOrder(null);
    setFormData({ supplier_id: suppliers[0]?.id || "", notes: "" });
    setItems([]);
    setShowModal(true);
  };

  const addItem = () => {
    if (products.length === 0) return;
    setItems([
      ...items,
      {
        product_id: products[0].id,
        product_name: products[0].name,
        quantity: 1,
        unit_cost: products[0].price,
      },
    ]);
  };

  const updateItem = (
    index: number,
    field: keyof OrderItem,
    value: string | number,
  ) => {
    const updated = [...items];
    if (field === "product_id") {
      const product = products.find((p) => p.id === value);
      if (product) {
        updated[index] = {
          ...updated[index],
          product_id: product.id,
          product_name: product.name,
        };
      }
    } else if (field === "quantity" || field === "unit_cost") {
      updated[index] = {
        ...updated[index],
        [field]: Number(value),
      };
    } else {
      // Fallback for other fields if any
      updated[index] = {
        ...updated[index],
        [field]: value
      } as OrderItem
    }
    setItems(updated);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const calculateTotal = () =>
    items.reduce((sum, item) => sum + item.quantity * item.unit_cost, 0);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId || items.length === 0) return;

    setSaving(true);

    // Create order
    const { data: order, error } = await supabase
      .from("purchase_orders")
      .insert({
        organization_id: organizationId,
        supplier_id: formData.supplier_id,
        order_number: `OC-${Date.now().toString().slice(-6)}`,
        status: "pending",
        total: calculateTotal(),
      })
      .select()
      .single();

    if (error || !order) {
      console.error("Error creating order:", error);
      setSaving(false);
      return;
    }

    // Create items
    const orderItemsData = items.map((item) => ({
      purchase_order_id: order.id,
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_cost: item.unit_cost,
      total: item.quantity * item.unit_cost,
    }));

    await supabase.from("purchase_order_items").insert(orderItemsData);

    setSaving(false);
    setShowModal(false);
    fetchData();
  };

  const handleViewOrder = async (order: PurchaseOrder) => {
    setSelectedOrder(order);
    const { data } = await supabase
      .from("purchase_order_items")
      .select("*")
      .eq("purchase_order_id", order.id);
    if (data) setOrderItems(data);
    setShowModal(true);
  };

  const handleReceiveOrder = async (orderId: string) => {
    if (
      !confirm(
        "¿Marcar como recibido? Se actualizará el stock de los productos.",
      )
    )
      return;

    // Get order items
    const { data: items } = await supabase
      .from("purchase_order_items")
      .select("product_id, quantity")
      .eq("purchase_order_id", orderId);

    if (!items) return;

    // Update stock for each product
    for (const item of items) {
      const { data: product } = await supabase
        .from("products")
        .select("stock")
        .eq("id", item.product_id)
        .single();

      if (product) {
        await supabase
          .from("products")
          .update({ stock: product.stock + item.quantity })
          .eq("id", item.product_id);
      }
    }

    // Mark order as received
    await supabase
      .from("purchase_orders")
      .update({ status: "received", received_at: new Date().toISOString() })
      .eq("id", orderId);

    setShowModal(false);
    setSelectedOrder(null);
    fetchData();
  };

  const filteredOrders =
    filter === "all" ? orders : orders.filter((o) => o.status === filter);

  // Calcular estadísticas
  const stats = useMemo(() => {
    const pending = orders.filter((o) => o.status === "pending").length;
    const ordered = orders.filter((o) => o.status === "ordered").length;
    const received = orders.filter((o) => o.status === "received").length;
    const totalSpent = orders
      .filter((o) => o.status === "received")
      .reduce((sum, o) => sum + Number(o.total), 0);
    const pendingTotal = orders
      .filter((o) => o.status === "pending" || o.status === "ordered")
      .reduce((sum, o) => sum + Number(o.total), 0);
    return { pending, ordered, received, totalSpent, pendingTotal };
  }, [orders]);

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
            Órdenes de Compra
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestiona las compras a proveedores
          </p>
        </div>
        {canCreate("products") && suppliers.length > 0 && (
          <Button
            onClick={handleOpenNew}
            className="shadow-lg shadow-primary/20"
          >
            <Plus className="h-4 w-4" /> Nueva Orden
          </Button>
        )}
      </div>

      {suppliers.length === 0 && (
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <p className="text-amber-700 dark:text-amber-300">
              Primero debes registrar al menos un proveedor antes de crear
              órdenes de compra.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-amber-500 to-orange-500 text-white border-0 shadow-lg shadow-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-100 text-sm">Pendientes</p>
                <p className="text-2xl font-bold mt-1">{stats.pending}</p>
              </div>
              <Clock className="h-8 w-8 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 shadow-lg shadow-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">En Camino</p>
                <p className="text-2xl font-bold mt-1">{stats.ordered}</p>
              </div>
              <Truck className="h-8 w-8 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-0 shadow-lg shadow-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-100 text-sm">Recibidas</p>
                <p className="text-2xl font-bold mt-1">{stats.received}</p>
              </div>
              <CheckCircle className="h-8 w-8 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Total Invertido</p>
                <p className="text-2xl font-bold mt-1">
                  ${stats.totalSpent.toLocaleString("es-AR")}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {["all", "pending", "ordered", "received"].map((status) => {
          const statusInfo = STATUS_LABELS[status];
          const Icon = statusInfo?.icon || ShoppingBag;
          const count =
            status === "all"
              ? orders.length
              : orders.filter((o) => o.status === status).length;
          return (
            <Button
              key={status}
              variant={filter === status ? "default" : "outline"}
              onClick={() => setFilter(status)}
              className="gap-2"
            >
              {status !== "all" && <Icon className="h-4 w-4" />}
              {status === "all" ? "Todas" : statusInfo?.label}
              <Badge variant="secondary" className="ml-1 text-xs">
                {count}
              </Badge>
            </Button>
          );
        })}
      </div>

      {/* Orders Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Orden</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-4 rounded-full bg-muted">
                        <ShoppingBag className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <p className="font-medium">No hay órdenes de compra</p>
                      <p className="text-sm text-muted-foreground">
                        Crea una nueva orden para empezar
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order) => {
                  const statusInfo =
                    STATUS_LABELS[order.status] || STATUS_LABELS.pending;
                  const StatusIcon = statusInfo.icon;
                  return (
                    <TableRow key={order.id} className="hover:bg-muted/50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <Package className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-semibold">
                              {order.order_number || order.id.slice(0, 8)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(order.created_at).toLocaleDateString(
                                "es-AR",
                                {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                },
                              )}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{order.supplier?.name || "-"}</TableCell>
                      <TableCell>
                        <Badge
                          className={`gap-1.5 ${statusInfo.color}`}
                          variant="secondary"
                        >
                          <StatusIcon className="h-3.5 w-3.5" />
                          {statusInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        $
                        {Number(order.total).toLocaleString("es-AR", {
                          minimumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewOrder(order)}
                        >
                          <Eye className="h-4 w-4" />
                          Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal: New Order */}
      <Dialog
        open={showModal && !selectedOrder}
        onOpenChange={() => setShowModal(false)}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Nueva Orden de Compra
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Proveedor</label>
              <Select
                value={formData.supplier_id}
                onValueChange={(v) =>
                  setFormData({ ...formData, supplier_id: v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar proveedor" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Productos</label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={addItem}
                >
                  <Plus className="h-4 w-4" /> Agregar
                </Button>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {items.map((item, index) => (
                  <div
                    key={index}
                    className="flex gap-2 items-center p-3 rounded-lg bg-muted/50"
                  >
                    <Select
                      value={item.product_id}
                      onValueChange={(v) => updateItem(index, "product_id", v)}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(
                          index,
                          "quantity",
                          parseInt(e.target.value) || 1,
                        )
                      }
                      min="1"
                      className="w-20"
                      placeholder="Cant."
                    />
                    <Input
                      type="number"
                      value={item.unit_cost}
                      onChange={(e) =>
                        updateItem(
                          index,
                          "unit_cost",
                          parseFloat(e.target.value) || 0,
                        )
                      }
                      step="0.01"
                      className="w-24"
                      placeholder="Costo"
                    />
                    <span className="w-24 text-right text-sm font-medium">
                      $
                      {(item.quantity * item.unit_cost).toLocaleString(
                        "es-AR",
                        { minimumFractionDigits: 2 },
                      )}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeItem(index)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              {items.length > 0 && (
                <div className="mt-4 pt-4 border-t flex justify-between items-center">
                  <span className="text-muted-foreground">
                    Total de la orden
                  </span>
                  <span className="text-2xl font-bold text-primary">
                    $
                    {calculateTotal().toLocaleString("es-AR", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4">
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
                disabled={saving || items.length === 0}
                className="flex-1"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving ? "Creando..." : "Crear Orden"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: View Order */}
      <Dialog
        open={showModal && !!selectedOrder}
        onOpenChange={() => {
          setShowModal(false);
          setSelectedOrder(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Orden {selectedOrder?.order_number}
              </DialogTitle>
              {selectedOrder && (
                <Badge
                  className={`${STATUS_LABELS[selectedOrder.status]?.color}`}
                  variant="secondary"
                >
                  {STATUS_LABELS[selectedOrder.status]?.label}
                </Badge>
              )}
            </div>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-muted/50">
              <p className="text-sm text-muted-foreground">Proveedor</p>
              <p className="font-semibold">{selectedOrder?.supplier?.name}</p>
            </div>

            <div>
              <h3 className="font-semibold mb-3">Productos</h3>
              <div className="space-y-2">
                {orderItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between py-3 border-b last:border-0"
                  >
                    <div>
                      <span className="font-medium">{item.product_name}</span>
                      <span className="text-muted-foreground text-sm ml-2">
                        x{item.quantity}
                      </span>
                    </div>
                    <span className="font-medium">
                      $
                      {(item.quantity * item.unit_cost).toLocaleString(
                        "es-AR",
                        { minimumFractionDigits: 2 },
                      )}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t flex justify-between">
                <span className="font-semibold">Total:</span>
                <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  $
                  {selectedOrder
                    ? Number(selectedOrder.total).toLocaleString("es-AR", {
                      minimumFractionDigits: 2,
                    })
                    : "0"}
                </span>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowModal(false);
                  setSelectedOrder(null);
                }}
                className="flex-1"
              >
                Cerrar
              </Button>
              {selectedOrder?.status === "pending" && canEdit("products") && (
                <Button
                  onClick={() =>
                    selectedOrder && handleReceiveOrder(selectedOrder.id)
                  }
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                >
                  <CheckCircle className="h-4 w-4" />
                  Marcar Recibido
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
