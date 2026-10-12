"use client";

import { useEffect, useState } from "react";
import { getDeveloperOrganizationData, getDeveloperOrganizations, updateDeveloperOrganization, updateDeveloperPermission } from "@/actions/developer-console";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { MODULES, moduleLabels, roleLabels, type Role } from "@/lib/permissions";

interface Organization {
  id: string;
  name: string;
  plan_type: string;
  created_at: string;
  cash_session_policy: string | null;
  cash_session_scope: string | null;
  require_permissions_password: boolean | null;
}

interface Permission {
  organization_id: string;
  role: string;
  module: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

const roles: Role[] = ["owner", "admin", "manager", "employee", "delivery", "billing", "viewer"];

export function DeveloperConsole() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [organizationForm, setOrganizationForm] = useState<Organization | null>(null);

  useEffect(() => {
    void (async () => {
      const result = await getDeveloperOrganizations();
      if (result.error) toast.error(result.error);
      else {
        setOrganizations(result.organizations || []);
        setSelectedId(result.organizations?.[0]?.id || "");
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const organization = organizations.find((item) => item.id === selectedId) || null;
    // Synchronize the selected organization with the detail editor.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrganizationForm(organization);
    void (async () => {
      const result = await getDeveloperOrganizationData(selectedId);
      if (result.error) toast.error(result.error);
      else setPermissions(result.permissions || []);
    })();
  }, [selectedId, organizations]);

  const saveOrganization = async () => {
    if (!organizationForm) return;
    setSaving(true);
    const result = await updateDeveloperOrganization({
      organizationId: organizationForm.id,
      name: organizationForm.name,
      planType: organizationForm.plan_type,
      cashSessionPolicy: organizationForm.cash_session_policy || "cash_only",
      cashSessionScope: organizationForm.cash_session_scope || "all_users",
      requirePermissionsPassword: organizationForm.require_permissions_password || false,
    });
    if (result.error) toast.error(result.error);
    else {
      setOrganizations((current) => current.map((item) => item.id === organizationForm.id ? organizationForm : item));
      toast.success("Configuración guardada");
    }
    setSaving(false);
  };

  const updatePermission = async (permission: Permission, field: keyof Pick<Permission, "can_view" | "can_create" | "can_edit" | "can_delete">, value: boolean) => {
    const updated = { ...permission, [field]: value };
    setPermissions((current) => {
      const exists = current.some((item) => item.role === permission.role && item.module === permission.module);
      return exists
        ? current.map((item) => item.role === permission.role && item.module === permission.module ? updated : item)
        : [...current, updated];
    });
    const result = await updateDeveloperPermission(updated);
    if (result.error) {
      toast.error(result.error);
      setPermissions((current) => current.map((item) => item.role === permission.role && item.module === permission.module ? permission : item));
    } else if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("developer-permissions-updated", {
        detail: { organizationId: updated.organization_id },
      }));
    }
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2"><ShieldCheck className="h-7 w-7 text-primary" /><h1 className="text-3xl font-bold">Panel del desarrollador</h1></div>
        <p className="mt-1 text-muted-foreground">Administración global de organizaciones, configuraciones y permisos.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Organización</CardTitle><CardDescription>Seleccioná el tenant que querés administrar.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger><SelectValue placeholder="Seleccionar organización" /></SelectTrigger>
            <SelectContent>{organizations.map((organization) => <SelectItem key={organization.id} value={organization.id}>{organization.name}</SelectItem>)}</SelectContent>
          </Select>
          {organizationForm && <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2"><Label>Nombre</Label><Input value={organizationForm.name} onChange={(event) => setOrganizationForm({ ...organizationForm, name: event.target.value })} /></div>
            <div className="space-y-2"><Label>Plan</Label><Input value={organizationForm.plan_type} onChange={(event) => setOrganizationForm({ ...organizationForm, plan_type: event.target.value })} /></div>
            <div className="space-y-2"><Label>Política de caja</Label><Select value={organizationForm.cash_session_policy || "cash_only"} onValueChange={(value) => setOrganizationForm({ ...organizationForm, cash_session_policy: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="always">Siempre</SelectItem><SelectItem value="cash_only">Solo efectivo</SelectItem><SelectItem value="off">Desactivada</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Alcance de caja</Label><Select value={organizationForm.cash_session_scope || "all_users"} onValueChange={(value) => setOrganizationForm({ ...organizationForm, cash_session_scope: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all_users">Todos los usuarios</SelectItem><SelectItem value="assigned_users">Usuarios asignados</SelectItem></SelectContent></Select></div>
            <label className="flex items-center gap-3"><Switch checked={organizationForm.require_permissions_password || false} onCheckedChange={(value) => setOrganizationForm({ ...organizationForm, require_permissions_password: value })} /><span className="text-sm">Requerir contraseña para permisos</span></label>
          </div>}
          <Button onClick={() => void saveOrganization()} disabled={!organizationForm || saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar configuración</Button>
        </CardContent>
      </Card>
      {organizationForm && <Card><CardHeader><CardTitle>Permisos globales del tenant</CardTitle><CardDescription>Configurá los permisos de cada rol para esta organización.</CardDescription></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Rol / módulo</th><th className="p-2">Ver</th><th className="p-2">Crear</th><th className="p-2">Editar</th><th className="p-2">Eliminar</th></tr></thead><tbody>{roles.flatMap((role) => MODULES.map((module) => { const permission = permissions.find((item) => item.role === role && item.module === module) || { organization_id: organizationForm.id, role, module, can_view: false, can_create: false, can_edit: false, can_delete: false }; return <tr key={`${role}-${module}`} className="border-b"><td className="p-2"><Badge variant="outline">{roleLabels[role]}</Badge><span className="ml-2">{moduleLabels[module]}</span></td>{(["can_view", "can_create", "can_edit", "can_delete"] as const).map((field) => <td className="p-2" key={field}><Switch checked={permission[field]} onCheckedChange={(value) => void updatePermission(permission, field, value)} /></td>)}</tr>; }))}</tbody></table></div></CardContent></Card>}
    </div>
  );
}
