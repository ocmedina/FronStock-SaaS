"use client";

import { useState, useEffect } from "react";
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
} from "lucide-react";
import { toast } from "sonner";

export default function RoutesManagementPage() {
  const { organizationId } = useOrganization();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const supabase = createClient();

  const [routes, setRoutes] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<any | null>(null);

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

    const [routesRes, driversRes] = await Promise.all([
      supabase
        .from("routes")
        .select(`
          *,
          driver:profiles!routes_driver_id_fkey(id, full_name),
          route_stops(id, visit_status)
        `)
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("organization_id", organizationId)
        .in("role", ["admin", "driver"])
        .order("full_name"),
    ]);

    if (routesRes.data) setRoutes(routesRes.data);
    if (driversRes.data) setDrivers(driversRes.data);

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [organizationId]);

  const handleCreateRoute = async () => {
    if (!organizationId || !formData.name || !formData.visit_day) {
      toast.error("Completa los campos obligatorios");
      return;
    }

    setLoading(true);

    try {
      // Llamar a la función RPC para crear ruta con clientes
      const { data, error } = await supabase.rpc("create_route_from_customers", {
        p_org_id: organizationId,
        p_route_name: formData.name,
        p_zone: formData.zone || null,
        p_visit_day: parseInt(formData.visit_day),
        p_driver_id: formData.driver_id && formData.driver_id !== "none" ? formData.driver_id : null,
      });

      if (error) throw error;

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
    try {
      const { error } = await supabase.rpc("start_route", {
        p_route_id: routeId,
      });

      if (error) throw error;

      toast.success("Ruta iniciada");
      fetchData();
    } catch (error: any) {
      toast.error("Error: " + error.message);
    }
  };

  const handleCompleteRoute = async (routeId: string) => {
    try {
      const { error } = await supabase.rpc("complete_route", {
        p_route_id: routeId,
      });

      if (error) throw error;

      toast.success("Ruta completada");
      fetchData();
    } catch (error: any) {
      toast.error("Error: " + error.message);
    }
  };

  const handleDeleteRoute = async (routeId: string) => {
    if (!confirm("¿Eliminar esta ruta?")) return;

    try {
      const { error } = await supabase.from("routes").delete().eq("id", routeId);

      if (error) throw error;

      toast.success("Ruta eliminada");
      fetchData();
    } catch (error: any) {
      toast.error("Error: " + error.message);
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

  // Stats
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
        {canCreate("sales") && (
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

      {/* Routes Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ruta</TableHead>
              <TableHead>Repartidor</TableHead>
              <TableHead>Día</TableHead>
              <TableHead>Paradas</TableHead>
              <TableHead>Estado</TableHead>
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
            ) : routes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No hay rutas creadas. Crea tu primera ruta para comenzar.
                </TableCell>
              </TableRow>
            ) : (
              routes.map((route) => {
                const completedStops = route.route_stops?.filter(
                  (s: any) => s.visit_status === "visited"
                ).length || 0;
                const totalStops = route.route_stops?.length || 0;

                return (
                  <TableRow key={route.id}>
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
                    </TableCell>

                    <TableCell>{getStatusBadge(route.status)}</TableCell>

                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {route.status === "planned" && canEdit("sales") && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStartRoute(route.id)}
                          >
                            <PlayCircle className="h-4 w-4 mr-1" />
                            Iniciar
                          </Button>
                        )}
                        {route.status === "in_progress" && canEdit("sales") && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCompleteRoute(route.id)}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Completar
                          </Button>
                        )}
                        {canDelete("sales") && route.status === "planned" && (
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
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Create Route Dialog */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nueva Ruta</DialogTitle>
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

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 text-sm">
              <p className="text-blue-700 dark:text-blue-300">
                💡 <strong>Nota:</strong> Esta ruta se creará automáticamente con todos los clientes
                que coincidan con la zona y día seleccionados. Puedes editarla después para
                agregar o quitar paradas.
              </p>
            </div>
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
            <Button onClick={handleCreateRoute} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear Ruta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
