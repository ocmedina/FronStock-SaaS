"use client";

import { useCallback, useEffect, useState } from "react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { usePermissions } from "@/hooks/usePermissions";
import { AccessDenied } from "@/components/Protected";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Pencil, Plus, WalletCards } from "lucide-react";
import { toast } from "sonner";

interface CashRegister {
  id: string;
  name: string;
  code: string | null;
  is_active: boolean;
}

export default function CashRegistersPage() {
  const { organizationId, profile, isLoading: organizationLoading } = useOrganization();
  const { canView, canCreate, canEdit } = usePermissions();
  const supabase = createClient();
  const [registers, setRegisters] = useState<CashRegister[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingRegister, setEditingRegister] = useState<CashRegister | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  const canManage = ["owner", "admin", "manager"].includes(profile?.role || "");

  const fetchRegisters = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("cash_registers")
      .select("id, name, code, is_active")
      .eq("organization_id", organizationId)
      .order("name");

    if (error) toast.error(`No se pudieron cargar las cajas: ${error.message}`);
    else setRegisters(data || []);
    setLoading(false);
  }, [organizationId, supabase]);

  useEffect(() => {
    // Initial loading synchronizes the server-backed list with this screen.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchRegisters();
  }, [fetchRegisters]);

  const openCreate = () => {
    setEditingRegister(null);
    setName("");
    setCode("");
    setDialogOpen(true);
  };

  const openEdit = (register: CashRegister) => {
    setEditingRegister(register);
    setName(register.name);
    setCode(register.code || "");
    setDialogOpen(true);
  };

  const saveRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!organizationId || !name.trim()) {
      toast.error("Ingresá un nombre para la caja");
      return;
    }

    setSaving(true);
    const { error } = await supabase.rpc("manage_cash_register", {
      p_org_id: organizationId,
      p_action: editingRegister ? "update" : "create",
      p_register_id: editingRegister?.id || null,
      p_name: name.trim(),
      p_code: code.trim() || null,
      p_is_active: editingRegister?.is_active ?? true,
    });

    if (error) {
      toast.error(`No se pudo guardar la caja: ${error.message}`);
    } else {
      toast.success(editingRegister ? "Caja actualizada" : "Caja creada");
      setDialogOpen(false);
      await fetchRegisters();
    }
    setSaving(false);
  };

  const toggleRegister = async (register: CashRegister, active: boolean) => {
    if (!organizationId) return;
    const { error } = await supabase.rpc("manage_cash_register", {
      p_org_id: organizationId,
      p_action: "set_active",
      p_register_id: register.id,
      p_name: register.name,
      p_code: register.code,
      p_is_active: active,
    });

    if (error) toast.error(`No se pudo actualizar el estado: ${error.message}`);
    else {
      toast.success(active ? "Caja activada" : "Caja desactivada");
      await fetchRegisters();
    }
  };

  if (organizationLoading || loading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!canView("settings") || !canManage) return <AccessDenied />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold">Cajas</h1>
          <p className="mt-1 text-muted-foreground">Creá y administrá las cajas disponibles para tus vendedores.</p>
        </div>
        {canCreate("settings") && (
          <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Nueva caja</Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><WalletCards className="h-5 w-5" />Cajas de la organización</CardTitle>
          <CardDescription>Las cajas activas aparecen al abrir una sesión y al asignarlas a usuarios.</CardDescription>
        </CardHeader>
        <CardContent>
          {registers.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Todavía no hay cajas configuradas.</p>
          ) : (
            <div className="divide-y">
              {registers.map((register) => (
                <div key={register.id} className="flex items-center justify-between gap-4 py-4">
                  <div>
                    <p className="font-medium">{register.name}</p>
                    <p className="text-sm text-muted-foreground">{register.code || "Sin código"}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={register.is_active ? "default" : "secondary"}>
                      {register.is_active ? "Activa" : "Inactiva"}
                    </Badge>
                    {canEdit("settings") && (
                      <>
                        <Switch checked={register.is_active} onCheckedChange={(active) => void toggleRegister(register, active)} />
                        <Button variant="outline" size="sm" onClick={() => openEdit(register)}>
                          <Pencil className="mr-2 h-4 w-4" />Editar
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <form onSubmit={saveRegister}>
            <DialogHeader>
              <DialogTitle>{editingRegister ? "Editar caja" : "Nueva caja"}</DialogTitle>
              <DialogDescription>Definí un nombre identificable y, opcionalmente, un código interno.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label htmlFor="cash-register-name" className="text-sm font-medium">Nombre</label>
                <Input id="cash-register-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Caja Mostrador" maxLength={80} />
              </div>
              <div className="space-y-2">
                <label htmlFor="cash-register-code" className="text-sm font-medium">Código (opcional)</label>
                <Input id="cash-register-code" value={code} onChange={(event) => setCode(event.target.value)} placeholder="MOSTRADOR" maxLength={30} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
