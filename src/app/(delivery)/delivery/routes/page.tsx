"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, MapPin, Navigation, Phone, CheckCircle, Circle, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOrganization } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";

export default function RoutesPage() {
    const { organizationId } = useOrganization();
    const [customers, setCustomers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        if (!organizationId) return;

        const fetchRoute = async () => {
            setLoading(true);
            // Simulate fetching customers for "today's route"
            // Ideally filtering by visit_day = current day of week
            const { data } = await supabase
                .from('customers')
                .select('*')
                .eq('organization_id', organizationId)
                .order('route_order', { ascending: true })
                .order('name', { ascending: true })
                .limit(20);

            if (data) {
                // Mock statuses for demo
                const enriched = data.map((c, i) => ({
                    ...c,
                    status: i < 3 ? 'visited' : i === 3 ? 'next' : 'pending',
                    distance: `${(Math.random() * 5).toFixed(1)} km`
                }));
                setCustomers(enriched);
            }
            setLoading(false);
        };

        fetchRoute();
    }, [organizationId, supabase]);

    return (
        <div className="flex flex-col h-screen bg-slate-950">
            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-slate-800 bg-slate-950 sticky top-0 z-10">
                <Link href="/delivery">
                    <Button variant="ghost" size="icon" className="text-slate-400">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <h1 className="text-lg font-bold text-white">Ruta #12 - Zona Norte</h1>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loading ? (
                    <div className="text-slate-500 text-center py-10">Cargando ruta...</div>
                ) : (
                    customers.map((customer) => (
                        <div
                            key={customer.id}
                            className={`
                                relative p-4 rounded-xl border 
                                ${customer.status === 'next'
                                    ? 'bg-blue-900/20 border-blue-500/50 shadow-lg shadow-blue-500/10'
                                    : 'bg-slate-900 border-slate-800'
                                }
                            `}
                        >
                            {customer.status === 'next' && (
                                <div className="absolute -top-3 left-4 bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                    PRÓXIMA PARADA
                                </div>
                            )}

                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h3 className="font-bold text-white text-lg">{customer.name}</h3>
                                    <p className="text-slate-400 text-sm flex items-center gap-1">
                                        <MapPin className="h-3 w-3" />
                                        {customer.address || "Sin dirección"}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <Badge
                                        variant="outline"
                                        className={`
                                            ${customer.status === 'visited' ? 'bg-green-500/10 text-green-500 border-green-500/30' : ''}
                                            ${customer.status === 'pending' || customer.status === 'next' ? 'bg-slate-800 text-slate-400 border-slate-700' : ''}
                                        `}
                                    >
                                        {customer.status === 'visited' ? 'Visitado' : customer.distance}
                                    </Badge>
                                </div>
                            </div>

                            <div className="flex gap-2 mt-4">
                                <Button className="flex-1 bg-white/10 hover:bg-white/20 text-white border-0" size="sm">
                                    <Navigation className="h-4 w-4 mr-2" />
                                    Ir
                                </Button>
                                <Button className="flex-1 bg-white/10 hover:bg-white/20 text-white border-0" size="sm">
                                    <Phone className="h-4 w-4 mr-2" />
                                    Llamar
                                </Button>
                                <Link href={`/delivery/order?customerId=${customer.id}`} className="flex-1">
                                    <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white border-0" size="sm">
                                        <CheckCircle className="h-4 w-4 mr-2" />
                                        Pedido
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
