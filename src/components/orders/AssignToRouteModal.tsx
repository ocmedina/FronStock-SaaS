"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, MapPin, User, Calendar, CheckCircle2, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface AssignToRouteModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    orderIds: string[];
    onSuccess: () => void;
}

export function AssignToRouteModal({
    open,
    onOpenChange,
    orderIds,
    onSuccess,
}: AssignToRouteModalProps) {
    const { organizationId } = useOrganization();
    const supabase = createClient();
    const [loading, setLoading] = useState(false);
    const [routes, setRoutes] = useState<any[]>([]);
    const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
    const [assigning, setAssigning] = useState(false);

    useEffect(() => {
        if (open && organizationId) {
            fetchRoutes();
        }
    }, [open, organizationId]);

    const fetchRoutes = async () => {
        setLoading(true);
        try {
            // Traer rutas activas (planned o in_progress) del día
            const { data, error } = await supabase
                .from("routes")
                .select(`
                    *,
                    driver:profiles!routes_driver_id_fkey(full_name),
                    route_stops(id, customer:customers(name))
                `)
                .eq("organization_id", organizationId)
                .in("status", ["planned", "in_progress"])
                .order("created_at", { ascending: false });

            if (error) throw error;
            setRoutes(data || []);
        } catch (error: any) {
            console.error("Error fetching routes:", error);
            toast.error("Error al cargar rutas");
        } finally {
            setLoading(false);
        }
    };

    const handleAssign = async () => {
        if (!selectedRoute) {
            toast.error("Selecciona una ruta");
            return;
        }

        setAssigning(true);
        try {
            const { data, error } = await supabase.rpc("assign_orders_to_route", {
                p_order_ids: orderIds,
                p_route_id: selectedRoute,
            });

            if (error) throw error;

            if (data?.success) {
                toast.success(
                    `${data.assigned_count} pedido(s) asignado(s) a la ruta`
                );
                onSuccess();
                onOpenChange(false);
            } else {
                toast.error(data?.error || "Error al asignar pedidos");
            }
        } catch (error: any) {
            console.error("Error assigning orders:", error);
            toast.error("Error: " + error.message);
        } finally {
            setAssigning(false);
        }
    };

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            planned: "bg-blue-500/10 text-blue-400 border-blue-500/20",
            in_progress: "bg-purple-500/10 text-purple-400 border-purple-500/20",
            completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        };

        const labels: Record<string, string> = {
            planned: "Planificada",
            in_progress: "En Progreso",
            completed: "Completada",
        };

        return (
            <Badge
                className={`${styles[status] || styles.planned} border text-xs`}
            >
                {labels[status] || status}
            </Badge>
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-blue-500" />
                        Asignar {orderIds.length} Pedido(s) a Ruta
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                        Selecciona una ruta activa para asignar los pedidos seleccionados
                    </p>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto space-y-3 py-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : routes.length === 0 ? (
                        <div className="text-center py-12">
                            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">
                                No hay rutas activas disponibles
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">
                                Crea una ruta nueva desde la sección de Rutas
                            </p>
                        </div>
                    ) : (
                        routes.map((route) => (
                            <button
                                key={route.id}
                                onClick={() => setSelectedRoute(route.id)}
                                className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                                    selectedRoute === route.id
                                        ? "border-blue-500 bg-blue-500/10"
                                        : "border-slate-700 bg-slate-900/50 hover:border-slate-600"
                                }`}
                            >
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-semibold text-white">
                                                {route.name}
                                            </h3>
                                            {getStatusBadge(route.status)}
                                        </div>
                                        <div className="flex items-center gap-4 text-sm text-slate-400">
                                            {route.driver && (
                                                <span className="flex items-center gap-1">
                                                    <User className="h-3 w-3" />
                                                    {route.driver.full_name}
                                                </span>
                                            )}
                                            {route.date && (
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="h-3 w-3" />
                                                    {format(
                                                        new Date(route.date),
                                                        "d MMM yyyy",
                                                        { locale: es }
                                                    )}
                                                </span>
                                            )}
                                            {route.zone && (
                                                <span className="flex items-center gap-1">
                                                    <MapPin className="h-3 w-3" />
                                                    {route.zone}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {selectedRoute === route.id && (
                                        <CheckCircle2 className="h-5 w-5 text-blue-500" />
                                    )}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                    <span>
                                        {route.route_stops?.length || 0} paradas
                                    </span>
                                </div>
                            </button>
                        ))
                    )}
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={assigning}
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleAssign}
                        disabled={!selectedRoute || assigning}
                        className="bg-blue-600 hover:bg-blue-500"
                    >
                        {assigning && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Asignar a Ruta
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
