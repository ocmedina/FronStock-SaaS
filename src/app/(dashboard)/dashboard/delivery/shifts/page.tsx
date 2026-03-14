"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Loader2, Wallet, User, Clock, CheckCircle2, AlertCircle, Truck } from "lucide-react";
import { toast } from "sonner";

type CashSessionPolicy = "always" | "cash_only" | "off";
type CashSessionScope = "all_users" | "assigned_users";

interface SecurityUserOption {
    id: string;
    full_name: string | null;
    role: string | null;
}

export default function AdminShiftsPage() {
    const { organization, organizationId, profile, refetch } = useOrganization();
    const [shifts, setShifts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'active' | 'closed'>('all');
    const [cashSessionPolicy, setCashSessionPolicy] = useState<CashSessionPolicy>("cash_only");
    const [cashSessionScope, setCashSessionScope] = useState<CashSessionScope>("all_users");
    const [cashSessionAssignedUserIds, setCashSessionAssignedUserIds] = useState<string[]>([]);
    const [securityUsers, setSecurityUsers] = useState<SecurityUserOption[]>([]);
    const [deliveryWithoutRouteMode, setDeliveryWithoutRouteMode] = useState(true);
    const [savingPolicies, setSavingPolicies] = useState(false);
    const supabase = createClient();
    const canConfigurePolicies = profile?.role === "owner" || profile?.role === "admin";

    useEffect(() => {
        setCashSessionPolicy((organization?.cash_session_policy as CashSessionPolicy) || "cash_only");
        setCashSessionScope((organization?.cash_session_scope as CashSessionScope) || "all_users");
        setCashSessionAssignedUserIds(
            Array.isArray(organization?.cash_session_assigned_user_ids)
                ? organization.cash_session_assigned_user_ids
                : []
        );
        setDeliveryWithoutRouteMode(organization?.delivery_without_route_mode !== false);
    }, [organization]);

    useEffect(() => {
        const loadOrganizationUsers = async () => {
            if (!organizationId || !canConfigurePolicies) {
                setSecurityUsers([]);
                return;
            }

            const { data, error } = await supabase
                .from("profiles")
                .select("id, full_name, role")
                .eq("organization_id", organizationId)
                .order("full_name", { ascending: true });

            if (error) {
                toast.error(`No se pudieron cargar usuarios: ${error.message}`);
                return;
            }

            setSecurityUsers((data || []) as SecurityUserOption[]);
        };

        loadOrganizationUsers().catch((error: any) => {
            toast.error(error?.message || "No se pudieron cargar usuarios");
        });
    }, [organizationId, canConfigurePolicies, supabase]);

    const handleToggleCashSessionAssignedUser = (userId: string, checked: boolean) => {
        setCashSessionAssignedUserIds((prev) => {
            if (checked) {
                if (prev.includes(userId)) return prev;
                return [...prev, userId];
            }
            return prev.filter((id) => id !== userId);
        });
    };

    const handleSavePolicies = async () => {
        if (!organizationId || !canConfigurePolicies || savingPolicies) return;

        setSavingPolicies(true);
        try {
            const { error } = await supabase
                .from("organizations")
                .update({
                    cash_session_policy: cashSessionPolicy,
                    cash_session_scope: cashSessionScope,
                    cash_session_assigned_user_ids:
                        cashSessionScope === "assigned_users" ? cashSessionAssignedUserIds : [],
                    delivery_without_route_mode: deliveryWithoutRouteMode,
                })
                .eq("id", organizationId);

            if (error) throw error;

            toast.success("Configuración de caja/recorrido guardada");
            await refetch();
        } catch (e: any) {
            toast.error(e?.message || "No se pudo guardar la configuración");
        } finally {
            setSavingPolicies(false);
        }
    };

    const fetchShifts = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('delivery_shifts')
                .select(`
                    *,
                    driver:profiles(full_name)
                `)
                .eq('organization_id', organizationId)
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
        if (organizationId) {
            fetchShifts();
        }
    }, [organizationId, filter]);

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

            {canConfigurePolicies ? (
                <section className="space-y-3 border-t pt-6">
                    <div className="space-y-1">
                        <h2 className="text-lg font-semibold tracking-tight">Configuración de Caja / Recorrido</h2>
                        <p className="text-sm text-muted-foreground">
                            Esta sección impacta la operación de pedidos y reparto.
                        </p>
                    </div>

                    <Card className="border-primary/20">
                        <CardHeader>
                            <CardTitle className="text-base md:text-lg">Política de apertura de caja</CardTitle>
                            <CardDescription>
                                Define cuándo exigir caja abierta y si aplica a todos o solo a empleados seleccionados.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-2 md:grid-cols-3">
                                <Button
                                    type="button"
                                    variant={cashSessionPolicy === "always" ? "default" : "outline"}
                                    onClick={() => setCashSessionPolicy("always")}
                                >
                                    Exigir siempre
                                </Button>
                                <Button
                                    type="button"
                                    variant={cashSessionPolicy === "cash_only" ? "default" : "outline"}
                                    onClick={() => setCashSessionPolicy("cash_only")}
                                >
                                    Solo pagos en efectivo
                                </Button>
                                <Button
                                    type="button"
                                    variant={cashSessionPolicy === "off" ? "default" : "outline"}
                                    onClick={() => setCashSessionPolicy("off")}
                                >
                                    Desactivada
                                </Button>
                            </div>

                            <div className="grid gap-2 md:grid-cols-2">
                                <Button
                                    type="button"
                                    variant={cashSessionScope === "all_users" ? "default" : "outline"}
                                    onClick={() => setCashSessionScope("all_users")}
                                >
                                    Aplicar a todos
                                </Button>
                                <Button
                                    type="button"
                                    variant={cashSessionScope === "assigned_users" ? "default" : "outline"}
                                    onClick={() => setCashSessionScope("assigned_users")}
                                >
                                    Solo empleados asignados
                                </Button>
                            </div>

                            {cashSessionScope === "assigned_users" ? (
                                <div className="space-y-2 rounded-md border p-3 max-h-48 overflow-auto">
                                    {securityUsers.length === 0 ? (
                                        <p className="text-xs text-muted-foreground">No hay usuarios para asignar.</p>
                                    ) : (
                                        securityUsers.map((user) => {
                                            const checked = cashSessionAssignedUserIds.includes(user.id);
                                            return (
                                                <label
                                                    key={user.id}
                                                    className="flex items-center justify-between gap-3 py-1"
                                                >
                                                    <span className="text-sm">
                                                        {user.full_name || "Sin nombre"}
                                                        <span className="text-xs text-muted-foreground ml-2 capitalize">
                                                            {user.role || "usuario"}
                                                        </span>
                                                    </span>
                                                    <Checkbox
                                                        checked={checked}
                                                        onCheckedChange={(value) => handleToggleCashSessionAssignedUser(user.id, Boolean(value))}
                                                    />
                                                </label>
                                            );
                                        })
                                    )}
                                </div>
                            ) : null}
                        </CardContent>
                    </Card>

                    <Card className="border-primary/20">
                        <CardHeader>
                            <CardTitle className="text-base md:text-lg">Política de recorrido en pedidos</CardTitle>
                            <CardDescription>
                                Controla si el repartidor puede operar pedidos sin tener una ruta activa asignada.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="grid gap-2 md:grid-cols-2">
                                <Button
                                    type="button"
                                    variant={deliveryWithoutRouteMode ? "default" : "outline"}
                                    onClick={() => setDeliveryWithoutRouteMode(true)}
                                >
                                    Permitir modo sin ruta
                                </Button>
                                <Button
                                    type="button"
                                    variant={!deliveryWithoutRouteMode ? "default" : "outline"}
                                    onClick={() => setDeliveryWithoutRouteMode(false)}
                                >
                                    Exigir ruta activa
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Si se exige ruta activa, la app de entregas no mostrará pedidos hasta que el chofer tenga una ruta en estado planificada o en curso.
                            </p>
                            <div className="flex justify-end">
                                <Button
                                    type="button"
                                    onClick={handleSavePolicies}
                                    disabled={savingPolicies}
                                    className="w-full md:w-auto"
                                >
                                    {savingPolicies ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Guardar configuración
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </section>
            ) : null}
        </div>
    );
}
