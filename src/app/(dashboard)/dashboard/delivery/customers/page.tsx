"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Plus,
  Search,
  Building2,
  User,
  MapPin,
  CreditCard,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Edit,
  Trash2,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import type { Customer } from "@/types/database.types";
import CustomerForm from "@/components/delivery/CustomerForm";

export default function CustomersPage() {
  const { organizationId } = useOrganization();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [pendingOrdersDebtByCustomer, setPendingOrdersDebtByCustomer] = useState<Record<string, number>>({});
  const [pendingOrderDetailsByCustomer, setPendingOrderDetailsByCustomer] = useState<Record<string, Array<{ id: string; total: number; paid: number; pending: number; created_at: string; payment_status: string; client_reference?: string | null }>>>({});
  const [paidOrderDetailsByCustomer, setPaidOrderDetailsByCustomer] = useState<Record<string, Array<{ id: string; total: number; paid: number; pending: number; created_at: string; payment_status: string; client_reference?: string | null }>>>({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedCustomerForOrders, setSelectedCustomerForOrders] = useState<Customer | null>(null);
  const [showOrdersModal, setShowOrdersModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "business" | "person">("all");
  const [filterDebt, setFilterDebt] = useState<"all" | "debt" | "ok">("all");

  const supabase = createClient();

  const formatOrderDate = (value: string | null | undefined) => {
    if (!value) return "Fecha no disponible";
    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) return "Fecha inválida";
    return parsedDate.toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getFriendlyOrderCode = (order: { id: string; client_reference?: string | null }) => {
    const fromReference = order.client_reference?.match(/(\d{6,})/);
    if (fromReference?.[1]) {
      return `PED-${fromReference[1].slice(-6)}`;
    }

    const hexBase = (order.id || '').replace(/-/g, '').slice(0, 8);
    const parsed = parseInt(hexBase || '0', 16);
    const numeric = Number.isNaN(parsed) ? 0 : parsed % 1000000;
    return `PED-${numeric.toString().padStart(6, '0')}`;
  };

  const fetchCustomers = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("organization_id", organizationId)
      .in("service_type", ["delivery", "both"])
      .order("name");

    if (error) {
      console.error("Error fetching customers:", error);
      toast.error("Error al cargar clientes");
    } else {
      setCustomers(data || []);

      const { data: pendingOrders, error: ordersError } = await supabase
        .from('orders')
        .select('id, customer_id, total, payment_amount, payment_status, payment_method, delivery_status, lifecycle_status, created_at, client_reference')
        .eq('organization_id', organizationId)
        .in('payment_status', ['pending', 'partial']);

      if (ordersError) {
        console.error("Error fetching pending orders:", ordersError);
        setPendingOrdersDebtByCustomer({});
        setPendingOrderDetailsByCustomer({});
        setPaidOrderDetailsByCustomer({});
        setFilteredCustomers(data || []);
      } else {
        const orderIds = (pendingOrders || []).map((order: any) => order.id);
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

        const debtMap: Record<string, number> = {};
        const orderDetailsMap: Record<string, Array<{ id: string; total: number; paid: number; pending: number; created_at: string; payment_status: string; client_reference?: string | null }>> = {};
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
          if (!orderDetailsMap[order.customer_id]) {
            orderDetailsMap[order.customer_id] = [];
          }
          orderDetailsMap[order.customer_id].push({
            id: order.id,
            total,
            paid,
            pending,
            created_at: order.created_at,
            payment_status: order.payment_status,
            client_reference: order.client_reference,
          });
        });

        Object.keys(orderDetailsMap).forEach((customerId) => {
          orderDetailsMap[customerId].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        });

        setPendingOrdersDebtByCustomer(debtMap);
        setPendingOrderDetailsByCustomer(orderDetailsMap);

        const { data: paidOrders, error: paidOrdersError } = await supabase
          .from('orders')
          .select('id, customer_id, total, payment_status, delivery_status, created_at, client_reference')
          .eq('organization_id', organizationId)
          .eq('payment_status', 'paid');

        if (paidOrdersError) {
          console.error("Error fetching paid orders:", paidOrdersError);
          setPaidOrderDetailsByCustomer({});
        } else {
          const paidMap: Record<string, Array<{ id: string; total: number; paid: number; pending: number; created_at: string; payment_status: string; client_reference?: string | null }>> = {};

          (paidOrders || []).forEach((order: any) => {
            if (!order.customer_id) return;
            const normalizedDeliveryStatus = String(order.delivery_status || '').toLowerCase();
            if (excludedDeliveryStatus.has(normalizedDeliveryStatus)) return;

            if (!paidMap[order.customer_id]) {
              paidMap[order.customer_id] = [];
            }

            const total = Number(order.total || 0);
            paidMap[order.customer_id].push({
              id: order.id,
              total,
              paid: total,
              pending: 0,
              created_at: order.created_at,
              payment_status: 'paid',
              client_reference: order.client_reference,
            });
          });

          Object.keys(paidMap).forEach((customerId) => {
            paidMap[customerId].sort(
              (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
          });

          setPaidOrderDetailsByCustomer(paidMap);
        }

        setFilteredCustomers(data || []);
      }
    }

    setLoading(false);
  }, [organizationId, supabase]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Filtros
  useEffect(() => {
    const customersWithEffectiveDebt = customers.map((customer) => {
      const pendingOrdersDebt = pendingOrdersDebtByCustomer[customer.id] || 0;
      const balanceDebt = customer.balance > 0 ? customer.balance : 0;
      const effectiveDebt = Math.max(balanceDebt, pendingOrdersDebt);

      return {
        ...customer,
        effectiveDebt,
      };
    });

    let filtered = [...(customersWithEffectiveDebt as (Customer & { effectiveDebt: number })[])];

    // Filtro de búsqueda
    if (searchTerm) {
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.phone?.includes(searchTerm) ||
          c.tax_id?.includes(searchTerm)
      );
    }

    // Filtro por tipo
    if (filterType === "business") {
      filtered = filtered.filter((c) => c.business_type !== null);
    } else if (filterType === "person") {
      filtered = filtered.filter((c) => c.business_type === null);
    }

    // Filtro por deuda
    if (filterDebt === "debt") {
      filtered = filtered.filter((c) => c.effectiveDebt > 0);
    } else if (filterDebt === "ok") {
      filtered = filtered.filter((c) => c.effectiveDebt <= 0);
    }

    setFilteredCustomers(filtered as Customer[]);
  }, [searchTerm, filterType, filterDebt, customers, pendingOrdersDebtByCustomer]);

  const handleDelete = async (id: string) => {
    if (!canDelete("delivery")) {
      toast.error("No tienes permisos para eliminar clientes");
      return;
    }

    if (!confirm("¿Eliminar este cliente?")) return;

    const { deleteDeliveryCustomer } = await import("@/actions/delivery");
    const result = await deleteDeliveryCustomer(id);

    if (result.error) {
      toast.error("Error al eliminar: " + result.error);
    } else {
      toast.success("Cliente eliminado");
      fetchCustomers();
    }
  };

  // Estadísticas
  const stats = {
    total: customers.length,
    business: customers.filter((c) => c.business_type !== null).length,
    withDebt: customers.filter((c) => Math.max(c.balance > 0 ? c.balance : 0, pendingOrdersDebtByCustomer[c.id] || 0) > 0).length,
    totalDebt: customers.reduce((sum, c) => sum + Math.max(c.balance > 0 ? c.balance : 0, pendingOrdersDebtByCustomer[c.id] || 0), 0),
  };

  return (
    <div className="space-y-6 p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground mt-1">
            Gestión de clientes comerciales y consumidores finales
          </p>
        </div>
        {canCreate("delivery") && (
          <Button
            onClick={() => {
              setSelectedCustomer(null);
              setShowModal(true);
            }}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Nuevo Cliente
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clientes</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Negocios B2B</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.business}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Con Deuda</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.withDebt}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deuda Total</CardTitle>
            <CreditCard className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              ${stats.totalDebt.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, teléfono o CUIT..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="business"><Building2 className="h-4 w-4 inline mr-1" />Negocios</SelectItem>
                <SelectItem value="person"><User className="h-4 w-4 inline mr-1" />Personas</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterDebt} onValueChange={(v: any) => setFilterDebt(v)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="debt"><AlertTriangle className="h-4 w-4 inline mr-1" />Con Deuda</SelectItem>
                <SelectItem value="ok"><CheckCircle className="h-4 w-4 inline mr-1" />Al Día</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead>Ubicación</TableHead>
              <TableHead>Balance</TableHead>
              <TableHead>Ruta</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : filteredCustomers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No se encontraron clientes
                </TableCell>
              </TableRow>
            ) : (
              filteredCustomers.map((customer) => {
                const pendingOrdersDebt = pendingOrdersDebtByCustomer[customer.id] || 0;
                const balanceDebt = customer.balance > 0 ? customer.balance : 0;
                const effectiveDebt = Math.max(balanceDebt, pendingOrdersDebt);

                return (
                <TableRow key={customer.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {customer.business_type ? (
                        <Building2 className="h-4 w-4 text-blue-500" />
                      ) : (
                        <User className="h-4 w-4 text-gray-500" />
                      )}
                      <div>
                        <div className="font-medium">{customer.name}</div>
                        {customer.business_type && (
                          <Badge variant="outline" className="text-xs mt-1">
                            {customer.business_type}
                          </Badge>
                        )}
                        {customer.tax_id && (
                          <div className="text-xs text-muted-foreground">
                            CUIT: {customer.tax_id}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="text-sm">
                      {customer.phone && <div><Smartphone className="h-3 w-3 inline mr-1" />{customer.phone}</div>}
                      {customer.email && (
                        <div className="text-muted-foreground">{customer.email}</div>
                      )}
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-start gap-1 text-sm">
                      <MapPin className="h-3 w-3 mt-0.5 text-muted-foreground flex-shrink-0" />
                      <span className="line-clamp-2">{customer.address || "-"}</span>
                    </div>
                    {customer.zone && (
                      <Badge variant="secondary" className="text-xs mt-1">
                        {customer.zone}
                      </Badge>
                    )}
                  </TableCell>

                  <TableCell>
                    {effectiveDebt > 0 ? (
                      <div>
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Debe ${effectiveDebt.toLocaleString()}
                        </Badge>
                        {pendingOrdersDebt > 0 && (
                          <div className="mt-1 space-y-1">
                            <div className="text-xs text-muted-foreground">
                              Incluye ${pendingOrdersDebt.toLocaleString()} de pedidos
                            </div>
                          </div>
                        )}
                        {customer.credit_limit > 0 && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Límite: ${customer.credit_limit.toLocaleString()}
                          </div>
                        )}
                      </div>
                    ) : customer.balance < 0 ? (
                      <Badge variant="secondary" className="gap-1">
                        <CheckCircle className="h-3 w-3" />A favor ${Math.abs(customer.balance).toLocaleString()}
                      </Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">Al día</span>
                    )}
                  </TableCell>

                  <TableCell>
                    {customer.visit_day !== null && (
                      <Badge variant="outline">
                        {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][customer.visit_day]}
                        {customer.route_order && ` (#${customer.route_order})`}
                      </Badge>
                    )}
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => {
                          setSelectedCustomerForOrders(customer);
                          setShowOrdersModal(true);
                        }}
                      >
                        Ver pedidos
                      </Button>
                      {canEdit("delivery") && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedCustomer(customer);
                            setShowModal(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                      {canDelete("delivery") && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(customer.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )})
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Modal con Formulario */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedCustomer ? "Editar Cliente" : "Nuevo Cliente"}
            </DialogTitle>
          </DialogHeader>
          <CustomerForm
            customer={selectedCustomer}
            onSuccess={() => {
              setShowModal(false);
              fetchCustomers();
            }}
            onCancel={() => setShowModal(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showOrdersModal} onOpenChange={setShowOrdersModal}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Pedidos del cliente · {selectedCustomerForOrders?.name || "Cliente"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {(() => {
              const customerOrders = selectedCustomerForOrders
                ? [
                    ...(pendingOrderDetailsByCustomer[selectedCustomerForOrders.id] || []),
                    ...(paidOrderDetailsByCustomer[selectedCustomerForOrders.id] || []),
                  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                : [];

              return customerOrders.length > 0 ? (
                customerOrders.map((order) => (
                <div key={order.id} className="rounded-lg border p-3 bg-muted/20">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">Pedido {getFriendlyOrderCode(order)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatOrderDate(order.created_at)}
                      </p>
                    </div>
                    <Badge variant={order.payment_status === "paid" ? "default" : order.payment_status === "partial" ? "secondary" : "destructive"}>
                      {order.payment_status === "paid" ? "Pagado" : order.payment_status === "partial" ? "Parcial" : "Pendiente"}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Total</p>
                      <p className="font-mono">${order.total.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Pagado</p>
                      <p className="font-mono">${order.paid.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Saldo</p>
                      <p className={`font-mono font-semibold ${order.pending > 0 ? "text-red-600" : "text-emerald-600"}`}>${order.pending.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              ))
              ) : (
                <p className="text-sm text-muted-foreground">No hay pedidos para este cliente.</p>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
