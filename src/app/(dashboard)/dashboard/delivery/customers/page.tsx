"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Search,
  Building2,
  User,
  MapPin,
  CreditCard,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Edit,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { Customer } from "@/types/database.types";
import CustomerForm from "@/components/delivery/CustomerForm";

export default function CustomersPage() {
  const { organizationId } = useOrganization();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "business" | "person">("all");
  const [filterDebt, setFilterDebt] = useState<"all" | "debt" | "ok">("all");

  const supabase = createClient();

  const fetchCustomers = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("organization_id", organizationId)
      .order("name");

    if (error) {
      console.error("Error fetching customers:", error);
      toast.error("Error al cargar clientes");
    } else {
      setCustomers(data || []);
      setFilteredCustomers(data || []);
    }

    setLoading(false);
  }, [organizationId, supabase]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Filtros
  useEffect(() => {
    let filtered = [...customers];

    // Filtro de búsqueda
    if (searchTerm) {
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.phone?.includes(searchTerm) ||
          c.tax_id?.includes(searchTerm)
      );
    }

    // Filtro por tipo
    if (filterType === "business") {
      filtered = filtered.filter((c) => c.business_type !== null);
    } else if (filterType === "person") {
      filtered = filtered.filter((c) => c.business_type === null);
    }

    // Filtro por deuda
    if (filterDebt === "debt") {
      filtered = filtered.filter((c) => c.balance < 0);
    } else if (filterDebt === "ok") {
      filtered = filtered.filter((c) => c.balance >= 0);
    }

    setFilteredCustomers(filtered);
  }, [searchTerm, filterType, filterDebt, customers]);

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este cliente?")) return;

    const { error } = await supabase.from("customers").delete().eq("id", id);

    if (error) {
      toast.error("Error al eliminar: " + error.message);
    } else {
      toast.success("Cliente eliminado");
      fetchCustomers();
    }
  };

  // Estadísticas
  const stats = {
    total: customers.length,
    business: customers.filter((c) => c.business_type !== null).length,
    withDebt: customers.filter((c) => c.balance < 0).length,
    totalDebt: customers.reduce((sum, c) => sum + Math.min(0, c.balance), 0),
  };

  return (
    <div className="space-y-6 p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground mt-1">
            Gestión de clientes comerciales y consumidores finales
          </p>
        </div>
        {canCreate("sales") && (
          <Button
            onClick={() => {
              setSelectedCustomer(null);
              setShowModal(true);
            }}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Nuevo Cliente
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clientes</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Negocios B2B</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.business}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Con Deuda</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.withDebt}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deuda Total</CardTitle>
            <CreditCard className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              ${Math.abs(stats.totalDebt).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, teléfono o CUIT..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="business">🏢 Negocios</SelectItem>
                <SelectItem value="person">👤 Personas</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterDebt} onValueChange={(v: any) => setFilterDebt(v)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="debt">⚠️ Con Deuda</SelectItem>
                <SelectItem value="ok">✅ Al Día</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead>Ubicación</TableHead>
              <TableHead>Balance</TableHead>
              <TableHead>Ruta</TableHead>
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
            ) : filteredCustomers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No se encontraron clientes
                </TableCell>
              </TableRow>
            ) : (
              filteredCustomers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {customer.business_type ? (
                        <Building2 className="h-4 w-4 text-blue-500" />
                      ) : (
                        <User className="h-4 w-4 text-gray-500" />
                      )}
                      <div>
                        <div className="font-medium">{customer.name}</div>
                        {customer.business_type && (
                          <Badge variant="outline" className="text-xs mt-1">
                            {customer.business_type}
                          </Badge>
                        )}
                        {customer.tax_id && (
                          <div className="text-xs text-muted-foreground">
                            CUIT: {customer.tax_id}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="text-sm">
                      {customer.phone && <div>📱 {customer.phone}</div>}
                      {customer.email && (
                        <div className="text-muted-foreground">{customer.email}</div>
                      )}
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-start gap-1 text-sm">
                      <MapPin className="h-3 w-3 mt-0.5 text-muted-foreground flex-shrink-0" />
                      <span className="line-clamp-2">{customer.address || "-"}</span>
                    </div>
                    {customer.zone && (
                      <Badge variant="secondary" className="text-xs mt-1">
                        {customer.zone}
                      </Badge>
                    )}
                  </TableCell>

                  <TableCell>
                    {customer.balance < 0 ? (
                      <div>
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Debe ${Math.abs(customer.balance).toLocaleString()}
                        </Badge>
                        {customer.credit_limit > 0 && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Límite: ${customer.credit_limit.toLocaleString()}
                          </div>
                        )}
                      </div>
                    ) : customer.balance > 0 ? (
                      <Badge variant="secondary" className="gap-1">
                        <CheckCircle className="h-3 w-3" />A favor ${customer.balance}
                      </Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">Al día</span>
                    )}
                  </TableCell>

                  <TableCell>
                    {customer.visit_day !== null && (
                      <Badge variant="outline">
                        {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][customer.visit_day]}
                        {customer.route_order && ` (#${customer.route_order})`}
                      </Badge>
                    )}
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {canEdit("sales") && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedCustomer(customer);
                            setShowModal(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                      {canDelete("sales") && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(customer.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Modal con Formulario */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedCustomer ? "Editar Cliente" : "Nuevo Cliente"}
            </DialogTitle>
          </DialogHeader>
          <CustomerForm
            customer={selectedCustomer}
            onSuccess={() => {
              setShowModal(false);
              fetchCustomers();
            }}
            onCancel={() => setShowModal(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
