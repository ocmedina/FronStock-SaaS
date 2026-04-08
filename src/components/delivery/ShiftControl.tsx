"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Wallet, RefreshCw, CheckCircle2, AlertCircle, PlayCircle, StopCircle } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface ShiftControlProps {
    className?: string;
}

export function ShiftControl({ className }: ShiftControlProps) {
    const { organization, profile } = useOrganization();
    const [loading, setLoading] = useState(true);
    const [activeShift, setActiveShift] = useState<any>(null);
    const [initialCash, setInitialCash] = useState("");
    const [returnedCash, setReturnedCash] = useState("");
    const [open, setOpen] = useState(false);
    const supabase = useMemo(() => createClient(), []);

    const fetchActiveShift = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('delivery_shifts')
                .select('*')
                .eq('driver_id', profile?.id)
                .eq('status', 'active')
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error("Error fetching shift:", error);
            }
            setActiveShift(data);
        } catch (e) {
            console.error("Error:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open && profile?.id) {
            fetchActiveShift();
        }
    }, [open, profile?.id]);

    const handleStartShift = async () => {
        const cashValue = parseFloat(initialCash);
        if (!initialCash || isNaN(cashValue) || cashValue < 0) {
            return toast.error("Ingresa un monto inicial válido mayor o igual a cero");
        }

        setLoading(true);
        try {
            const { error } = await supabase
                .from('delivery_shifts')
                .insert({
                    organization_id: organization?.id,
                    driver_id: profile?.id,
                    initial_cash: parseFloat(initialCash),
                    status: 'active'
                });

            if (error) throw error;

            toast.success("Turno iniciado correctamente");
            fetchActiveShift();
            setInitialCash("");
        } catch (e: any) {
            toast.error("Error al iniciar turno: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleEndShift = async () => {
        const cashValue = parseFloat(returnedCash);
        if (!returnedCash || isNaN(cashValue) || cashValue < 0) {
            return toast.error("Ingresa un monto válido mayor o igual a cero");
        }

        setLoading(true);
        try {
            const { error } = await supabase
                .from('delivery_shifts')
                .update({
                    end_time: new Date().toISOString(),
                    returned_cash: parseFloat(returnedCash),
                    status: 'closed'
                })
                .eq('id', activeShift.id);

            if (error) throw error;

            toast.success("Turno cerrado correctamente");
            setActiveShift(null);
            setReturnedCash("");
            setOpen(false);
        } catch (e: any) {
            toast.error("Error al cerrar turno: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button variant="outline" size="sm" className={`gap-2 ${className} ${activeShift ? 'border-emerald-500/50 text-emerald-500 bg-emerald-500/10' : 'border-slate-700 text-slate-400'}`}>
                    <Wallet className="h-4 w-4" />
                    {loading ? "..." : (activeShift ? "En Ruta" : "Iniciar")}
                </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[auto] max-h-[90vh] bg-slate-950 border-t border-slate-800 rounded-t-[2rem] p-6">
                <SheetHeader className="mb-6">
                    <SheetTitle className="text-white text-xl font-bold flex items-center gap-2">
                        <Wallet className="text-emerald-500" />
                        Control de Recorrido
                    </SheetTitle>
                </SheetHeader>

                {loading ? (
                    <div className="flex justify-center py-10">
                        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                    </div>
                ) : !activeShift ? (
                    <div className="space-y-6 pb-10">
                        <div className="bg-slate-900/50 p-4 rounded-xl border border-dashed border-slate-800 text-center">
                            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-3">
                                <PlayCircle className="h-6 w-6 text-slate-400" />
                            </div>
                            <h3 className="text-white font-medium mb-1">Iniciar Hoja de Ruta</h3>
                            <p className="text-sm text-slate-500">Registra tu fondo de cambio para comenzar.</p>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-slate-400">Base de Cambio ($)</Label>
                                <Input
                                    type="number"
                                    placeholder="0.00"
                                    value={initialCash}
                                    onChange={(e) => setInitialCash(e.target.value)}
                                    className="bg-slate-900 border-slate-800 text-white text-lg h-12"
                                />
                            </div>

                            <Button
                                className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-lg"
                                onClick={handleStartShift}
                            >
                                Iniciar Recorrido
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6 pb-10">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                                <span className="text-xs text-slate-500 uppercase font-bold block mb-1">Inicio</span>
                                <span className="text-white font-mono">
                                    {format(new Date(activeShift.start_time), 'HH:mm')} hs
                                </span>
                            </div>
                            <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                                <span className="text-xs text-slate-500 uppercase font-bold block mb-1">Base</span>
                                <span className="text-emerald-400 font-mono font-bold">
                                    ${activeShift.initial_cash}
                                </span>
                            </div>
                        </div>

                        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-slate-400">Total Cobrado (Est.)</span>
                                <span className="text-white font-bold text-lg">
                                    ${activeShift.collected_cash || 0}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                Suma de pedidos cobrados en efectivo
                            </p>
                        </div>

                        <div className="border-t border-slate-800 pt-6">
                            <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                                <StopCircle className="text-red-500 h-5 w-5" />
                                Cerrar Turno
                            </h3>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-slate-400">Dinero a Rendir ($)</Label>
                                    <Input
                                        type="number"
                                        placeholder="Total billetes en mano..."
                                        value={returnedCash}
                                        onChange={(e) => setReturnedCash(e.target.value)}
                                        className="bg-slate-900 border-slate-800 text-white text-lg h-12"
                                    />
                                    <p className="text-xs text-slate-500">
                                        Debería ser aprox: ${(Number(activeShift.initial_cash) + Number(activeShift.collected_cash || 0))}
                                    </p>
                                </div>

                                <Button
                                    variant="destructive"
                                    className="w-full h-12 text-lg font-bold"
                                    onClick={handleEndShift}
                                >
                                    Cerrar y Rendir
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}
