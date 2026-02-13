"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, MapPin, Navigation, Phone, CheckCircle, XCircle, Clock, Package, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOrganization } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";

type RouteStop = {
    id: string;
    stop_order: number;
    visit_status: 'pending' | 'visited' | 'not_home' | 'closed' | 'skipped';
    visited_at: string | null;
    sale_id: string | null;
    customer: {
        id: string;
        name: string;
        address: string | null;
        phone: string | null;
        business_type: string | null;
        balance: number;
        credit_limit: number;
    };
};

export default function RoutesPage() {
    const { organizationId, profile } = useOrganization();
    const [activeRoute, setActiveRoute] = useState<any>(null);
    const [routeStops, setRouteStops] = useState<RouteStop[]>([]);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    const fetchActiveRoute = async () => {
        if (!organizationId || !profile?.id) return;
        
        setLoading(true);
        try {
            // Buscar ruta activa del repartidor
            const { data: route, error: routeError } = await supabase
                .from('routes')
                .select('*')
                .eq('organization_id', organizationId)
                .eq('driver_id', profile.id)
                .in('status', ['planned', 'in_progress'])
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (routeError && routeError.code !== 'PGRST116') {
                console.error("Error fetching route:", routeError);
            }

            if (!route) {
                setActiveRoute(null);
                setRouteStops([]);
                setLoading(false);
                return;
            }

            setActiveRoute(route);

            // Cargar paradas de la ruta con datos del cliente
            const { data: stops, error: stopsError } = await supabase
                .from('route_stops')
                .select(`
                    id,
                    stop_order,
                    visit_status,
                    visited_at,
                    sale_id,
                    customer:customers(
                        id,
                        name,
                        address,
                        phone,
                        business_type,
                        balance,
                        credit_limit
                    )
                `)
                .eq('route_id', route.id)
                .order('stop_order', { ascending: true });

            if (stopsError) {
                console.error("Error fetching stops:", stopsError);
                toast.error("Error al cargar paradas");
            } else {
                setRouteStops(stops as any || []);
            }
        } catch (e) {
            console.error("Error:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchActiveRoute();
    }, [organizationId, profile?.id]);

    const startRoute = async () => {
        if (!activeRoute?.id) return;

        const { error } = await supabase.rpc('start_route', {
            p_route_id: activeRoute.id
        });

        if (error) {
            toast.error("Error al iniciar ruta: " + error.message);
        } else {
            toast.success("Ruta iniciada");
            fetchActiveRoute();
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'visited': return <CheckCircle className="h-4 w-4 text-green-500" />;
            case 'not_home': return <Clock className="h-4 w-4 text-orange-500" />;
            case 'closed': return <XCircle className="h-4 w-4 text-red-500" />;
            case 'skipped': return <XCircle className="h-4 w-4 text-gray-500" />;
            default: return <MapPin className="h-4 w-4 text-slate-400" />;
        }
    };

    const getStatusLabel = (status: string) => {
        const labels: Record<string, string> = {
            pending: 'Pendiente',
            visited: 'Visitado',
            not_home: 'No estaba',
            closed: 'Cerrado',
            skipped: 'Saltado'
        };
        return labels[status] || status;
    };

    // Encontrar próxima parada
    const nextStop = routeStops.find(s => s.visit_status === 'pending');

    if (loading) {
        return (
            <div className="flex flex-col h-screen bg-slate-950 items-center justify-center">
                <p className="text-slate-400">Cargando ruta...</p>
            </div>
        );
    }

    if (!activeRoute) {
        return (
            <div className="flex flex-col h-screen bg-slate-950">
                <div className="flex items-center gap-3 p-4 border-b border-slate-800 bg-slate-950 sticky top-0 z-10">
                    <Link href="/delivery">
                        <Button variant="ghost" size="icon" className="text-slate-400">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <h1 className="text-lg font-bold text-white">Mi Ruta</h1>
                </div>
                <div className="flex-1 flex items-center justify-center p-4">
                    <Card className="bg-slate-900 border-slate-800 p-8 text-center max-w-md">
                        <Package className="h-16 w-16 text-slate-600 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-white mb-2">Sin ruta asignada</h2>
                        <p className="text-slate-400 mb-4">
                            No tienes una ruta activa para hoy. Contacta al administrador para que te asigne una ruta.
                        </p>
                        <Link href="/delivery">
                            <Button variant="outline" className="border-slate-700 text-slate-300">
                                Volver al inicio
                            </Button>
                        </Link>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-slate-950">
            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-slate-800 bg-slate-950 sticky top-0 z-10">
                <Link href="/delivery">
                    <Button variant="ghost" size="icon" className="text-slate-400">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <div className="flex-1">
                    <h1 className="text-lg font-bold text-white">{activeRoute.name}</h1>
                    <p className="text-xs text-slate-400">Zona: {activeRoute.zone || 'N/A'}</p>
                </div>
                <Badge variant={activeRoute.status === 'in_progress' ? 'default' : 'secondary'}>
                    {activeRoute.status === 'planned' ? 'Planificada' : 
                     activeRoute.status === 'in_progress' ? 'En Progreso' : 
                     'Completada'}
                </Badge>
            </div>

            {/* Progress */}
            <div className="p-4 bg-slate-900/50 border-b border-slate-800">
                <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-400">Progreso</span>
                    <span className="text-white font-medium">
                        {routeStops.filter(s => s.visit_status === 'visited').length} / {routeStops.length} paradas
                    </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2">
                    <div 
                        className="bg-emerald-500 h-2 rounded-full transition-all"
                        style={{ 
                            width: `${(routeStops.filter(s => s.visit_status === 'visited').length / routeStops.length) * 100}%` 
                        }}
                    />
                </div>

                {activeRoute.status === 'planned' && (
                    <Button onClick={startRoute} className="w-full mt-4 bg-blue-600 hover:bg-blue-700">
                        Iniciar Ruta
                    </Button>
                )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {routeStops.length === 0 ? (
                    <div className="text-slate-500 text-center py-10">No hay paradas en esta ruta</div>
                ) : (
                    routeStops.map((stop) => {
                        const isNext = nextStop?.id === stop.id;
                        const customer = stop.customer;

                        return (
                            <div
                                key={stop.id}
                                className={`
                                    relative p-4 rounded-xl border transition-all
                                    ${isNext
                                        ? 'bg-blue-900/20 border-blue-500/50 shadow-lg shadow-blue-500/10 scale-[1.02]'
                                        : stop.visit_status === 'visited'
                                        ? 'bg-slate-900/50 border-slate-800 opacity-60'
                                        : 'bg-slate-900 border-slate-800'
                                    }
                                `}
                            >
                                {isNext && (
                                    <div className="absolute -top-3 left-4 bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                        PRÓXIMA PARADA
                                    </div>
                                )}

                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-start gap-3">
                                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-800 text-slate-400 text-sm font-bold">
                                            {stop.stop_order}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white text-lg">{customer.name}</h3>
                                            {customer.business_type && (
                                                <Badge variant="outline" className="text-xs mt-1 border-slate-700">
                                                    {customer.business_type}
                                                </Badge>
                                            )}
                                            <p className="text-slate-400 text-sm flex items-center gap-1 mt-1">
                                                <MapPin className="h-3 w-3" />
                                                {customer.address || "Sin dirección"}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {getStatusIcon(stop.visit_status)}
                                        <span className="text-xs text-slate-400">{getStatusLabel(stop.visit_status)}</span>
                                    </div>
                                </div>

                                {/* Customer Info */}
                                {customer.balance < 0 && (
                                    <div className="flex items-center gap-2 mb-3 p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                                        <AlertTriangle className="h-4 w-4 text-red-500" />
                                        <span className="text-sm text-red-400">
                                            Debe: ${Math.abs(customer.balance).toLocaleString()}
                                        </span>
                                        <span className="text-xs text-slate-500 ml-auto">
                                            Límite: ${customer.credit_limit.toLocaleString()}
                                        </span>
                                    </div>
                                )}

                                {/* Actions */}
                                {stop.visit_status === 'pending' && (
                                    <div className="flex gap-2 mt-3">
                                        {customer.phone && (
                                            <Button 
                                                className="flex-1 bg-slate-800 hover:bg-slate-700 text-white border-0" 
                                                size="sm"
                                                onClick={() => window.open(`tel:${customer.phone}`)}
                                            >
                                                <Phone className="h-4 w-4 mr-2" />
                                                Llamar
                                            </Button>
                                        )}
                                        {customer.address && (
                                            <Button 
                                                className="flex-1 bg-slate-800 hover:bg-slate-700 text-white border-0" 
                                                size="sm"
                                                onClick={() => {
                                                    const addr = encodeURIComponent(customer.address || '');
                                                    window.open(`https://www.google.com/maps/search/?api=1&query=${addr}`, '_blank');
                                                }}
                                            >
                                                <Navigation className="h-4 w-4 mr-2" />
                                                Ir
                                            </Button>
                                        )}
                                        <Link 
                                            href={`/delivery/sale?routeStopId=${stop.id}&customerId=${customer.id}`} 
                                            className="flex-1"
                                        >
                                            <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white border-0" size="sm">
                                                <CheckCircle className="h-4 w-4 mr-2" />
                                                Vender
                                            </Button>
                                        </Link>
                                    </div>
                                )}

                                {stop.visit_status === 'visited' && stop.sale_id && (
                                    <div className="mt-3 p-2 bg-green-500/10 border border-green-500/20 rounded-lg text-center">
                                        <span className="text-sm text-green-400">✓ Venta realizada</span>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
