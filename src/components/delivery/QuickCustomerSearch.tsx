
"use client";

import { useState, useEffect } from "react";
import { Search, Plus, MapPin, Phone, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface QuickCustomerSearchProps {
    onSelect: (customer: any) => void;
}

export function QuickCustomerSearch({ onSelect }: QuickCustomerSearchProps) {
    const { organizationId } = useOrganization();
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    // New Customer Form State
    const [newName, setNewName] = useState("");
    const [newPhone, setNewPhone] = useState("");
    const [newAddress, setNewAddress] = useState("");

    const supabase = createClient();

    // Debounced search
    useEffect(() => {
        if (!query.trim() || !organizationId) {
            setResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            setLoading(true);
            const { data } = await supabase
                .from('customers')
                .select('*, sales(total, payment_status)')
                .eq('organization_id', organizationId)
                .in('sales_channel', ['delivery', 'general']) // Filter channels
                .or(`name.ilike.%${query}%,phone.ilike.%${query}%,address.ilike.%${query}%`)
                .limit(5);

            // Calculate Balance locally (sum of pending sales)
            // Note: In a real app, use a View or RPC for performance.
            const resultsWithBalance = (data || []).map((c: any) => {
                const debt = c.sales
                    ?.filter((s: any) => s.payment_status === 'pending')
                    .reduce((sum: number, s: any) => sum + s.total, 0) || 0;
                return { ...c, balance: debt };
            });

            setResults(resultsWithBalance);
            setLoading(false);
        }, 300);

        return () => clearTimeout(timer);
    }, [query, organizationId, supabase]);

    const handleCreateCustomer = async () => {
        if (!newName || !newAddress) {
            toast.error("Nombre y dirección son requeridos");
            return;
        }

        try {
            const { data, error } = await supabase
                .from('customers')
                .insert([{
                    organization_id: organizationId,
                    name: newName,
                    phone: newPhone,
                    address: newAddress,
                    city: 'Local', // Default city
                    sales_channel: 'delivery', // Default to Delivery
                }])
                .select()
                .single();

            if (error) throw error;

            toast.success("Cliente creado");
            onSelect(data);
            setIsCreateOpen(false);
            setNewName(""); setNewPhone(""); setNewAddress("");
        } catch (e: any) {
            toast.error("Error al crear cliente");
        }
    };

    return (
        <div className="space-y-4">
            <div className="relative">
                <Search className="absolute left-4 top-4 h-5 w-5 text-slate-400" />
                <Input
                    className="pl-12 h-14 text-lg bg-slate-900 border-slate-700 rounded-xl focus:ring-emerald-500/50"
                    placeholder="Buscar cliente (Nombre, Tel, Dire...)"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    autoFocus
                />
            </div>

            <div className="space-y-2">
                {results.map(customer => (
                    <button
                        key={customer.id}
                        onClick={() => onSelect(customer)}
                        className="w-full text-left p-4 bg-slate-800/50 border border-slate-700/50 rounded-xl hover:bg-emerald-900/10 hover:border-emerald-500/50 transition-all active:scale-[0.98] group"
                    >
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="font-bold text-slate-200 group-hover:text-emerald-400">{customer.name}</h3>
                                {customer.phone && (
                                    <div className="flex items-center gap-1.5 text-slate-400 text-sm mt-1">
                                        <Phone className="h-3 w-3" />
                                        <span>{customer.phone}</span>
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col items-end gap-1">
                                {customer.balance > 0 && (
                                    <span className="text-xs font-bold text-red-500 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">
                                        Deuda: ${customer.balance.toLocaleString()}
                                    </span>
                                )}
                                {customer.address && (
                                    <div className="bg-slate-900/50 px-3 py-1.5 rounded-lg border border-slate-700/50 text-right max-w-[150px]">
                                        <div className="flex items-center justify-end gap-1.5 text-emerald-500 text-xs font-medium mb-0.5">
                                            <MapPin className="h-3 w-3" />
                                            Dirección
                                        </div>
                                        <span className="text-xs text-slate-300 leading-tight block truncate">
                                            {customer.address}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </button>
                ))}

                {query.length > 2 && results.length === 0 && !loading && (
                    <div className="text-center p-8 bg-slate-900/30 rounded-xl border border-dashed border-slate-800">
                        <p className="text-slate-500 mb-4">No se encontraron clientes</p>
                        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                            <DialogTrigger asChild>
                                <Button size="lg" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20">
                                    <Plus className="mr-2 h-5 w-5" />
                                    Crear Nuevo Cliente
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-slate-950 border-slate-800 text-white sm:max-w-md w-[95vw] rounded-xl top-[20%]">
                                <div className="space-y-4 pt-4">
                                    <h2 className="text-lg font-bold flex items-center gap-2">
                                        <User className="h-5 w-5 text-emerald-500" />
                                        Nuevo Cliente
                                    </h2>

                                    <div className="space-y-3">
                                        <div>
                                            <Label>Nombre Completo</Label>
                                            <Input
                                                value={newName}
                                                onChange={e => setNewName(e.target.value)}
                                                className="bg-slate-900 border-slate-800 h-10 mt-1"
                                                placeholder="Ej: Juan Perez"
                                            />
                                        </div>
                                        <div>
                                            <Label>Teléfono / WhatsApp</Label>
                                            <Input
                                                value={newPhone}
                                                onChange={e => setNewPhone(e.target.value)}
                                                className="bg-slate-900 border-slate-800 h-10 mt-1"
                                                placeholder="Ej: 11 1234 5678"
                                            />
                                        </div>
                                        <div>
                                            <Label>Dirección de Entrega</Label>
                                            <Input
                                                value={newAddress}
                                                onChange={e => setNewAddress(e.target.value)}
                                                className="bg-slate-900 border-slate-800 h-10 mt-1"
                                                placeholder="Calle, Altura, Piso, Depto..."
                                            />
                                        </div>
                                    </div>

                                    <Button
                                        className="w-full bg-emerald-600 hover:bg-emerald-500 h-12 text-lg font-bold mt-2"
                                        onClick={handleCreateCustomer}
                                    >
                                        Guardar y Continuar
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                )}
            </div>
        </div >
    );
}
