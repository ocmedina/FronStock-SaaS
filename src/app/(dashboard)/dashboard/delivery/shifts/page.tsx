"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Loader2, Wallet, User, Clock, CheckCircle2, AlertCircle, Truck } from "lucide-react";

export default function AdminShiftsPage() {
    const { organization } = useOrganization();
    const [shifts, setShifts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'active' | 'closed'>('all');
    const supabase = createClient();

    const fetchShifts = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('delivery_shifts')
                .select(`
                    *,
                    driver:profiles(full_name)
                `)
                .eq('organization_id', organization?.id)
                .order('start_time', { ascending: false });

            if (filter !== 'all') {
                query = query.eq('status', filter);
            }

            const { data, error } = await query;
            if (error) throw error;
            setShifts(data || []);
        } catch (e: any) {
            console.error("Error fetching shifts:", e.message || e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (organization?.id) {
            fetchShifts();
        }
    }, [organization?.id, filter]);

    return (
        <div className="p-8 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Logística y Cajas</h1>
                    <p className="text-muted-foreground">Control de recorridos y rendiciones de choferes.</p>
                </div>
                <div className="flex gap-2 bg-muted/50 p-1 rounded-lg">
                    <Button
                        variant={filter === 'all' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setFilter('all')}
                    >
                        Todos
                    </Button>
                    <Button
                        variant={filter === 'active' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setFilter('active')}
                        className={filter === 'active' ? "text-emerald-500 bg-emerald-500/10" : ""}
                    >
                        Activos
                    </Button>
                    <Button
                        variant={filter === 'closed' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setFilter('closed')}
                    >
                        Cerrados
                    </Button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Recorridos Activos</CardTitle>
                        <Truck className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {shifts.filter(s => s.status === 'active').length}
                        </div>
                        <p className="text-xs text-muted-foreground">Choferes en ruta ahora</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Dinero en Calle</CardTitle>
                        <AlertCircle className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            ${shifts
                                .filter(s => s.status === 'active')
                                .reduce((acc, curr) => acc + (Number(curr.initial_cash) + Number(curr.collected_cash || 0)), 0)
                                .toLocaleString()}
                        </div>
                        <p className="text-xs text-muted-foreground">Cambio + Cobros pendientes</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Chofer</TableHead>
                            <TableHead>Inicio</TableHead>
                            <TableHead>Fin</TableHead>
                            <TableHead className="text-right">Base</TableHead>
                            <TableHead className="text-right">Cobrado</TableHead>
                            <TableHead className="text-right">Rendido</TableHead>
                            <TableHead className="text-right">Diferencia</TableHead>
                            <TableHead className="text-center">Estado</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={8} className="h-24 text-center">
                                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                                </TableCell>
                            </TableRow>
                        ) : shifts.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                                    No se encontraron recorridos registrados.
                                </TableCell>
                            </TableRow>
                        ) : (
                            shifts.map((shift) => {
                                const totalExpected = Number(shift.initial_cash) + Number(shift.collected_cash || 0);
                                const diff = shift.status === 'closed' ? Number(shift.returned_cash) - totalExpected : 0;

                                return (
                                    <TableRow key={shift.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                                    <User className="h-4 w-4 text-slate-500" />
                                                </div>
                                                <div className="font-medium">{shift.driver?.full_name || 'Desconocido'}</div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium">
                                                    {format(new Date(shift.start_time), "HH:mm")}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {format(new Date(shift.start_time), "d MMM")}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {shift.end_time ? (
                                                <span className="font-medium">
                                                    {format(new Date(shift.end_time), "HH:mm")}
                                                </span>
                                            ) : (
                                                <Badge variant="outline" className="text-xs">En curso</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right font-mono">
                                            ${shift.initial_cash}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-emerald-600 dark:text-emerald-400">
                                            +${shift.collected_cash || 0}
                                        </TableCell>
                                        <TableCell className="text-right font-mono font-bold">
                                            {shift.returned_cash ? `$${shift.returned_cash}` : '-'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {shift.status === 'closed' && (
                                                <Badge variant={Math.abs(diff) < 10 ? 'outline' : (diff < 0 ? 'destructive' : 'default')} className={Math.abs(diff) < 10 ? "border-emerald-500 text-emerald-500" : ""}>
                                                    {diff === 0 ? 'Ok' : (diff > 0 ? `+$${diff}` : `-$${Math.abs(diff)}`)}
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant={shift.status === 'active' ? 'default' : 'secondary'} className={shift.status === 'active' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}>
                                                {shift.status === 'active' ? 'Activo' : 'Cerrado'}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </Card>
        </div>
    );
}
