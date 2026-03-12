"use client";

import React, { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  MapPin,
  User,
  Calendar,
  PlayCircle,
  CheckCircle,
  Loader2,
  Edit,
  Trash2,
  Route,
  Copy,
  Send,
  ChevronDown,
  ChevronRight,
  Phone,
  Filter,
  Lightbulb,
} from "lucide-react";
import { toast } from "sonner";

export default function RoutesManagementPage() {
  const { organizationId } = useOrganization();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const supabase = createClient();

  const [routes, setRoutes] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [ordersByRoute, setOrdersByRoute] = useState<Record<string, { total: number; delivered: number }>>({});
  const [ordersPool, setOrdersPool] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingOrdersRouteId, setSendingOrdersRouteId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingRoute, setEditingRoute] = useState<any | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<any | null>(null);
  const [expandedRouteId, setExpandedRouteId] = useState<string | null>(null);
  const [routeStatusFilter, setRouteStatusFilter] = useState<string>("active");
  const [routeDateFilter, setRouteDateFilter] = useState<string>("all");

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    zone: "",
    visit_day: "",
    driver_id: "",
    notes: "",
  });

  const weekDays = [
    { value: "0", label: "Domingo" },
    { value: "1", label: "Lunes" },
    { value: "2", label: "Martes" },
    { value: "3", label: "Miércoles" },
    { value: "4", label: "Jueves" },
    { value: "5", label: "Viernes" },
    { value: "6", label: "Sábado" },
  ];

  const fetchData = async () => {
    if (!organizationId) return;
    setLoading(true);

    const [routesRes, driversRes, ordersRes] = await Promise.all([
      supabase
        .from("routes")
        .select(`
          *,
          driver:profiles!routes_driver_id_fkey(id, full_name),
          route_stops(id, visit_status, customer_id, order_id, stop_order, address_snapshot, customer:customers(id, name, phone, address))
        `)
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("organization_id", organizationId)
        .in("role", ["owner", "admin", "manager", "employee", "delivery"])
        .order("full_name"),
      supabase
        .from("orders")
        .select("id, customer_id, assigned_route_id, lifecycle_status, delivery_status")
        .eq("organization_id", organizationId),
    ]);

    if (routesRes.data) setRoutes(routesRes.data);
    if (driversRes.data) setDrivers(driversRes.data);
    if (ordersRes.data) {
      setOrdersPool(ordersRes.data || []);
      const grouped = (ordersRes.data || []).reduce((acc: Record<string, { total: number; delivered: number }>, order: any) => {
        const routeId = order.assigned_route_id;
        if (!routeId) return acc;
        const status = order.lifecycle_status || order.delivery_status;
        if (!acc[routeId]) acc[routeId] = { total: 0, delivered: 0 };
        acc[routeId].total += 1;
        if (status === "delivered") acc[routeId].delivered += 1;
        return acc;
      }, {});
      setOrdersByRoute(grouped);
    } else {
      setOrdersPool([]);
      setOrdersByRoute({});
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [organizationId]);

  // Filtered routes
  const filteredRoutes = useMemo(() => {
    let filtered = [...routes];

    if (routeStatusFilter !== "all") {
      if (routeStatusFilter === "active") {
        filtered = filtered.filter((r) => ["planned", "in_progress"].includes(r.status));
      } else {
        filtered = filtered.filter((r) => r.status === routeStatusFilter);
      }
    }

    if (routeDateFilter !== "all") {
      const now = new Date();
      let cutoff: Date;
      if (routeDateFilter === "today") {
        cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (routeDateFilter === "week") {
        cutoff = new Date(now);
        cutoff.setDate(cutoff.getDate() - 7);
      } else {
        cutoff = new Date(now);
        cutoff.setDate(cutoff.getDate() - 30);
      }
      filtered = filtered.filter((r) => new Date(r.created_at) >= cutoff);
    }

    return filtered;
  }, [routes, routeStatusFilter, routeDateFilter]);

  const handleEditRoute = (route: any) => {
    setEditingRoute(route);
    setFormData({
      name: route.name || "",
      zone: route.zone || "",
      visit_day: route.visit_day?.toString() || "",
      driver_id: route.driver_id || "",
      notes: route.notes || "",
    });
    setShowModal(true);
  };

  const handleSaveEditRoute = async () => {
    if (!canEdit("delivery") || !editingRoute || !organizationId) return;

    if (!formData.name || !formData.visit_day) {
      toast.error("Completa los campos obligatorios");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("routes")
        .update({
          name: formData.name,
          zone: formData.zone || null,
          visit_day: parseInt(formData.visit_day),
          driver_id: formData.driver_id && formData.driver_id !== "none" ? formData.driver_id : null,
          notes: formData.notes || null,
        })
        .eq("id", editingRoute.id)
        .eq("organization_id", organizationId);

      if (error) throw error;

      toast.success("Ruta actualizada");
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast.error("Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoute = async () => {
    if (!canCreate("delivery")) {
      toast.error("No tienes permisos para crear rutas");
      return;
    }

    if (!organizationId || !formData.name || !formData.visit_day) {
      toast.error("Completa los campos obligatorios");
      return;
    }

    setLoading(true);

    try {
      const { createDeliveryRoute } = await import("@/actions/delivery");
      const result = await createDeliveryRoute({
        name: formData.name,
        zone: formData.zone,
        visit_day: parseInt(formData.visit_day),
        driver_id: formData.driver_id && formData.driver_id !== "none" ? formData.driver_id : null,
      });

      if (result.error) throw new Error(result.error);

      toast.success("Ruta creada con clientes asignados");
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast.error("Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStartRoute = async (routeId: string) => {
    if (!canEdit("delivery")) {
      toast.error("No tienes permisos para iniciar rutas");
      return;
    }

    try {
      const { startDeliveryRoute } = await import("@/actions/delivery");
      const result = await startDeliveryRoute(routeId);
      if (result.error) throw new Error(result.error);

      toast.success("Ruta iniciada");
      fetchData();
    } catch (error: any) {
      toast.error("Error: " + error.message);
    }
  };

  const handleCompleteRoute = async (routeId: string) => {
    if (!canEdit("delivery")) {
      toast.error("No tienes permisos para completar rutas");
      return;
    }

    try {
      const { completeDeliveryRoute } = await import("@/actions/delivery");
      const result = await completeDeliveryRoute(routeId);
      if (result.error) throw new Error(result.error);

      toast.success("Ruta completada");
      fetchData();
    } catch (error: any) {
      toast.error("Error: " + error.message);
    }
  };

  const handleDeleteRoute = async (routeId: string) => {
    if (!canDelete("delivery")) {
      toast.error("No tienes permisos para eliminar rutas");
      return;
    }

    if (!confirm("¿Eliminar esta ruta?")) return;

    try {
      const { deleteDeliveryRoute } = await import("@/actions/delivery");
      const result = await deleteDeliveryRoute(routeId);
      if (result.error) throw new Error(result.error);

      toast.success("Ruta eliminada");
      fetchData();
    } catch (error: any) {
      toast.error("Error: " + error.message);
    }
  };

  const handleReuseRoute = async (route: any) => {
    if (!canCreate("delivery")) {
      toast.error("No tienes permisos para reutilizar rutas");
      return;
    }

    try {
      const { reuseDeliveryRoute } = await import("@/actions/delivery");
      const result = await reuseDeliveryRoute({ routeId: route.id });
      if (result.error) throw new Error(result.error);

      toast.success("Ruta reutilizada y guardada como nueva");
      fetchData();
    } catch (error: any) {
      toast.error("Error: " + error.message);
    }
  };

  const getAssignableOrderIdsForRoute = (route: any) => {
    const customerIds = new Set(
      (route.route_stops || [])
        .map((stop: any) => stop.customer_id)
        .filter(Boolean)
    );

    if (customerIds.size === 0) return [] as string[];

    return (ordersPool || [])
      .filter((order: any) => {
        if (!order?.id || !order?.customer_id) return false;
        if (!customerIds.has(order.customer_id)) return false;
        if (order.assigned_route_id) return false;

        const lifecycle = (order.lifecycle_status || "").toLowerCase();
        const delivery = (order.delivery_status || "").toLowerCase();

        const terminalLifecycle = ["delivered", "cancelled", "not_delivered"].includes(lifecycle);
        const terminalDelivery = ["delivered", "cancelled"].includes(delivery);
        if (terminalLifecycle || terminalDelivery) return false;

        const eligibleLifecycle = ["confirmed", "assigned"].includes(lifecycle);
        const eligibleDelivery = ["confirmed", "preparing", "packed"].includes(delivery);
        return eligibleLifecycle || eligibleDelivery;
      })
      .map((order: any) => order.id);
  };

  const handleSendOrdersToRoute = async (route: any) => {
    if (!canEdit("delivery")) {
      toast.error("No tienes permisos para asignar pedidos");
      return;
    }

    const orderIds = getAssignableOrderIdsForRoute(route);
    if (orderIds.length === 0) {
      toast.message("No hay pedidos pendientes para los clientes de esta ruta");
      return;
    }

    setSendingOrdersRouteId(route.id);
    try {
      let rpcResult = await supabase.rpc("assign_orders_to_route", {
        p_org_id: organizationId,
        p_order_ids: orderIds,
        p_route_id: route.id,
      });

      if (rpcResult.error && /p_org_id|function assign_orders_to_route\(uuid\[\], uuid\)/i.test(rpcResult.error.message || "")) {
        rpcResult = await supabase.rpc("assign_orders_to_route", {
          p_order_ids: orderIds,
          p_route_id: route.id,
        });
      }

      const { data, error } = rpcResult;
      if (error) throw error;

      if (data?.success) {
        toast.success(`${data.assigned_count} pedido(s) enviado(s) a la ruta`);
        fetchData();
      } else {
        toast.error(data?.error || "No se pudieron enviar pedidos a la ruta");
      }
    } catch (error: any) {
      toast.error("Error: " + error.message);
    } finally {
      setSendingOrdersRouteId(null);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      zone: "",
      visit_day: "",
      driver_id: "",
      notes: "",
    });
    setSelectedRoute(null);
    setEditingRoute(null);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      planned: { label: "Planificada", className: "bg-blue-500/10 text-blue-500" },
      in_progress: { label: "En Progreso", className: "bg-yellow-500/10 text-yellow-500" },
      completed: { label: "Completada", className: "bg-green-500/10 text-green-500" },
      cancelled: { label: "Cancelada", className: "bg-red-500/10 text-red-500" },
    };
    const variant = variants[status] || variants.planned;
    return (
      <Badge variant="outline" className={variant.className}>
        {variant.label}
      </Badge>
    );
  };

  const getNextStep = (status: string) => {
    if (status === "planned") {
      return {
        title: "Iniciar ruta",
        description: "Empieza el recorrido para habilitar entregas.",
      };
    }

    if (status === "in_progress") {
      return {
        title: "Completar ruta",
        description: "Finaliza cuando termines todas las paradas.",
      };
    }

    if (status === "completed") {
      return {
        title: "Ruta finalizada",
        description: "No requiere acción.",
      };
    }

    return {
      title: "Revisar estado",
      description: "Confirma si corresponde reactivar o rehacer.",
    };
  };

  // Stats (from all routes, not filtered)
  const stats = {
    total: routes.length,
    active: routes.filter((r) => r.status === "in_progress").length,
    completed: routes.filter((r) => r.status === "completed").length,
    planned: routes.filter((r) => r.status === "planned").length,
  };

  return (
    <div className="space-y-6 p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestión de Rutas</h1>
          <p className="text-muted-foreground mt-1">Planifica y asigna rutas de reparto</p>
        </div>
        {canCreate("delivery") && (
          <Button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Nueva Ruta
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Rutas</CardTitle>
            <Route className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Planificadas</CardTitle>
            <Calendar className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.planned}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En Progreso</CardTitle>
            <PlayCircle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completadas</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Filter className="h-3 w-3" /> Estado
            </span>
            {[
              { value: "all", label: "Todas" },
              { value: "active", label: "Activas" },
              { value: "planned", label: "Planificadas" },
              { value: "in_progress", label: "En progreso" },
              { value: "completed", label: "Completadas" },
            ].map((opt) => (
              <Button
                key={opt.value}
                variant={routeStatusFilter === opt.value ? "default" : "outline"}
                size="sm"
                onClick={() => setRouteStatusFilter(opt.value)}
                className={routeStatusFilter === opt.value ? "bg-emerald-600 hover:bg-emerald-500 text-white" : ""}
              >
                {opt.label}
              </Button>
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <span className="text-xs text-muted-foreground">Fecha</span>
            {[
              { value: "all", label: "Todo" },
              { value: "today", label: "Hoy" },
              { value: "week", label: "7 días" },
              { value: "month", label: "30 días" },
            ].map((opt) => (
              <Button
                key={opt.value}
                variant={routeDateFilter === opt.value ? "default" : "outline"}
                size="sm"
                onClick={() => setRouteDateFilter(opt.value)}
                className={routeDateFilter === opt.value ? "bg-emerald-600 hover:bg-emerald-500 text-white" : ""}
              >
                {opt.label}
              </Button>
            ))}
          </div>
          <div className="text-sm text-muted-foreground ml-auto">
            {filteredRoutes.length} de {routes.length} rutas
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cómo funciona Rutas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3 text-sm">
            <div className="rounded-lg border p-3">
              <p className="font-medium">1) Crea la ruta</p>
              <p className="text-muted-foreground mt-1">
                Define nombre, día, zona y repartidor opcional.
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="font-medium">2) Inicia el recorrido</p>
              <p className="text-muted-foreground mt-1">
                Al iniciar, el chofer ya puede trabajar paradas y pedidos.
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="font-medium">3) Completa al finalizar</p>
              <p className="text-muted-foreground mt-1">
                Cierra la ruta cuando termine la jornada de entregas.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Estados:</span>
            {getStatusBadge("planned")}
            {getStatusBadge("in_progress")}
            {getStatusBadge("completed")}
            {getStatusBadge("cancelled")}
          </div>
        </CardContent>
      </Card>

      {/* Routes Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Ruta</TableHead>
              <TableHead>Repartidor</TableHead>
              <TableHead>Día</TableHead>
              <TableHead>Paradas</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Qué sigue</TableHead>
              <TableHead>Más info</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : filteredRoutes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                  {routes.length === 0 ? "No hay rutas creadas. Crea tu primera ruta para comenzar." : "No hay rutas que coincidan con los filtros."}
                </TableCell>
              </TableRow>
            ) : (
              filteredRoutes.map((route) => {
                const completedStops = route.route_stops?.filter(
                  (s: any) => s.visit_status === "visited"
                ).length || 0;
                const pendingStops = route.route_stops?.filter(
                  (s: any) => s.visit_status === "pending"
                ).length || 0;
                const notCompletedStops = route.route_stops?.filter(
                  (s: any) => ["not_home", "closed", "skipped"].includes(s.visit_status)
                ).length || 0;
                const totalStops = route.route_stops?.length || 0;
                const routeOrders = ordersByRoute[route.id] || { total: 0, delivered: 0 };
                const progressPct = totalStops > 0 ? Math.round((completedStops / totalStops) * 100) : 0;
                const assignableOrderCount = getAssignableOrderIdsForRoute(route).length;

                const isExpanded = expandedRouteId === route.id;
                const sortedStops = [...(route.route_stops || [])].sort((a: any, b: any) => (a.stop_order || 0) - (b.stop_order || 0));

                return (
                  <React.Fragment key={route.id}>
                  <TableRow className="cursor-pointer" onClick={() => setExpandedRouteId(isExpanded ? null : route.id)}>
                    <TableCell className="w-8 px-2">
                      {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{route.name}</div>
                        {route.zone && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <MapPin className="h-3 w-3" />
                            {route.zone}
                          </div>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                      {route.driver ? (
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {route.driver.full_name}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Sin asignar</span>
                      )}
                    </TableCell>

                    <TableCell>
                      {route.visit_day !== null ? (
                        <Badge variant="outline">
                          {weekDays.find((d) => d.value === route.visit_day.toString())?.label}
                        </Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {completedStops}/{totalStops}
                        </span>
                        {totalStops > 0 && (
                          <div className="w-16 bg-slate-200 dark:bg-slate-800 rounded-full h-2">
                            <div
                              className="bg-green-500 h-2 rounded-full"
                              style={{
                                width: `${(completedStops / totalStops) * 100}%`,
                              }}
                            />
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Pedidos: {routeOrders.delivered}/{routeOrders.total} entregados
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Pendientes para enviar: {assignableOrderCount}
                      </div>
                    </TableCell>

                    <TableCell>{getStatusBadge(route.status)}</TableCell>

                    <TableCell>
                      <div className="min-w-[220px]">
                        <p className="text-sm font-medium">{getNextStep(route.status).title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {getNextStep(route.status).description}
                        </p>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="min-w-[240px] space-y-1 text-xs">
                        <div className="text-muted-foreground">
                          Creada: {new Date(route.created_at).toLocaleDateString()}
                        </div>
                        <div className="text-muted-foreground">
                          Progreso: <span className="font-medium text-foreground">{progressPct}%</span>
                        </div>
                        <div className="text-muted-foreground">
                          Pendientes: {pendingStops} · Incidencias: {notCompletedStops}
                        </div>
                        {route.started_at && (
                          <div className="text-muted-foreground">
                            Inicio: {new Date(route.started_at).toLocaleString()}
                          </div>
                        )}
                        {route.completed_at && (
                          <div className="text-muted-foreground">
                            Fin: {new Date(route.completed_at).toLocaleString()}
                          </div>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-2 flex-wrap">
                        {canEdit("delivery") && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditRoute(route)}
                            title="Editar ruta"
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                        )}
                        {canEdit("delivery") && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSendOrdersToRoute(route)}
                            disabled={sendingOrdersRouteId === route.id || assignableOrderCount === 0}
                            title="Enviar pedidos pendientes de los clientes de esta ruta"
                          >
                            {sendingOrdersRouteId === route.id ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <Send className="h-4 w-4 mr-1" />
                            )}
                            Enviar pedidos
                          </Button>
                        )}
                        {canCreate("delivery") && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReuseRoute(route)}
                            title="Reutilizar esta ruta guardada"
                          >
                            <Copy className="h-4 w-4 mr-1" />
                            Reutilizar
                          </Button>
                        )}
                        {route.status === "planned" && canEdit("delivery") && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStartRoute(route.id)}
                          >
                            <PlayCircle className="h-4 w-4 mr-1" />
                            Iniciar
                          </Button>
                        )}
                        {route.status === "in_progress" && canEdit("delivery") && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCompleteRoute(route.id)}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Completar
                          </Button>
                        )}
                        {canDelete("delivery") && route.status === "planned" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteRoute(route.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>

                  {/* Expanded detail row */}
                  {isExpanded && (
                    <TableRow>
                      <TableCell colSpan={9} className="bg-muted/30 p-0">
                        <div className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold text-sm">
                              Paradas de la ruta ({sortedStops.length})
                            </h4>
                            {route.notes && (
                              <span className="text-xs text-muted-foreground">
                                Notas: {route.notes}
                              </span>
                            )}
                          </div>
                          {sortedStops.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              Esta ruta no tiene paradas asignadas.
                            </p>
                          ) : (
                            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                              {sortedStops.map((stop: any, idx: number) => {
                                const customer = stop.customer;
                                const visitStatusLabels: Record<string, { label: string; className: string }> = {
                                  pending: { label: "Pendiente", className: "bg-yellow-500/10 text-yellow-600" },
                                  visited: { label: "Visitado", className: "bg-green-500/10 text-green-600" },
                                  not_home: { label: "No estaba", className: "bg-orange-500/10 text-orange-600" },
                                  closed: { label: "Cerrado", className: "bg-red-500/10 text-red-600" },
                                  skipped: { label: "Saltado", className: "bg-gray-500/10 text-gray-600" },
                                };
                                const vs = visitStatusLabels[stop.visit_status] || visitStatusLabels.pending;

                                return (
                                  <div key={stop.id} className="rounded-lg border bg-card p-3 space-y-1">
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-medium text-muted-foreground">
                                        #{idx + 1}
                                      </span>
                                      <Badge variant="outline" className={vs.className + " text-[10px]"}>
                                        {vs.label}
                                      </Badge>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                      <span className="text-sm font-medium truncate">
                                        {customer?.name || "Sin cliente"}
                                      </span>
                                    </div>
                                    {(customer?.address || stop.address_snapshot) && (
                                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <MapPin className="h-3 w-3 shrink-0" />
                                        <span className="truncate">{customer?.address || stop.address_snapshot}</span>
                                      </div>
                                    )}
                                    {customer?.phone && (
                                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Phone className="h-3 w-3 shrink-0" />
                                        <span>{customer.phone}</span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  </React.Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Create/Edit Route Dialog */}
      <Dialog open={showModal} onOpenChange={(open) => { if (!open) { setShowModal(false); resetForm(); } else setShowModal(true); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingRoute ? "Editar Ruta" : "Nueva Ruta"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="name">
                Nombre de la Ruta <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: Ruta Zona Norte - Lunes"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="zone">Zona</Label>
                <Input
                  id="zone"
                  value={formData.zone}
                  onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                  placeholder="Norte, Sur, Centro..."
                />
              </div>

              <div>
                <Label htmlFor="visit_day">
                  Día de Visita <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.visit_day}
                  onValueChange={(value) => setFormData({ ...formData, visit_day: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar día" />
                  </SelectTrigger>
                  <SelectContent>
                    {weekDays.map((day) => (
                      <SelectItem key={day.value} value={day.value}>
                        {day.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="driver_id">Repartidor</Label>
              <Select
                value={formData.driver_id}
                onValueChange={(value) => setFormData({ ...formData, driver_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin asignar</SelectItem>
                  {drivers.map((driver) => (
                    <SelectItem key={driver.id} value={driver.id}>
                      {driver.full_name} ({driver.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="notes">Notas (Opcional)</Label>
              <Input
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Observaciones sobre la ruta..."
              />
            </div>

            {!editingRoute && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 text-sm">
              <p className="text-blue-700 dark:text-blue-300">
                <Lightbulb className="h-4 w-4 inline mr-1" /><strong>Nota:</strong> Esta ruta se creará automáticamente con todos los clientes
                que coincidan con la zona y día seleccionados. Puedes editarla después para
                agregar o quitar paradas.
              </p>
            </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowModal(false);
                resetForm();
              }}
            >
              Cancelar
            </Button>
            {editingRoute ? (
              <Button onClick={handleSaveEditRoute} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar Cambios
              </Button>
            ) : (
              <Button onClick={handleCreateRoute} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Crear Ruta
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
