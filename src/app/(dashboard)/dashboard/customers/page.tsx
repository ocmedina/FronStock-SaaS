"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Loader2,
  UserPlus,
  Users,
  UserCheck,
  Calendar,
  Mail,
  Phone,
  MapPin,
  User,
} from "lucide-react";

interface Customer {
  id: string;
  organization_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  created_at: string;
}

export default function CustomersPage() {
  const { organizationId, isLoading: orgLoading } = useOrganization();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
  });
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const supabase = createClient();

  const fetchCustomers = async () => {
    if (!organizationId) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("organization_id", organizationId)
      .order("name");

    if (!error && data) {
      setCustomers(data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (organizationId) {
      fetchCustomers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId) return;

    setSaving(true);

    const customerData = {
      name: formData.name,
      email: formData.email || null,
      phone: formData.phone || null,
      address: formData.address || null,
    };

    if (editingCustomer) {
      await supabase
        .from("customers")
        .update(customerData)
        .eq("id", editingCustomer.id);
    } else {
      await supabase
        .from("customers")
        .insert({ ...customerData, organization_id: organizationId });
    }

    setSaving(false);
    setShowModal(false);
    setEditingCustomer(null);
    setFormData({ name: "", email: "", phone: "", address: "" });
    fetchCustomers();
  };

  const handleDelete = async (id: string) => {
    if (confirm("¿Estás seguro de eliminar este cliente?")) {
      await supabase.from("customers").delete().eq("id", id);
      fetchCustomers();
    }
  };

  const openEditModal = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      email: customer.email || "",
      phone: customer.phone || "",
      address: customer.address || "",
    });
    setShowModal(true);
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone?.includes(searchQuery),
  );

  // Calcular estadísticas
  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const newThisMonth = customers.filter(
      (c) => new Date(c.created_at) >= thisMonth,
    ).length;
    const newLastMonth = customers.filter((c) => {
      const date = new Date(c.created_at);
      return date >= lastMonth && date < thisMonth;
    }).length;

    const withEmail = customers.filter((c) => c.email).length;
    const withPhone = customers.filter((c) => c.phone).length;

    return { newThisMonth, newLastMonth, withEmail, withPhone };
  }, [customers]);

  // Función para obtener iniciales del avatar
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Colores para avatares basados en el nombre
  const getAvatarColor = (name: string) => {
    const colors = [
      "bg-blue-500",
      "bg-purple-500",
      "bg-emerald-500",
      "bg-amber-500",
      "bg-rose-500",
      "bg-cyan-500",
      "bg-indigo-500",
      "bg-pink-500",
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  if (orgLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
            Clientes
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestiona tu cartera de clientes
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingCustomer(null);
            setFormData({ name: "", email: "", phone: "", address: "" });
            setShowModal(true);
          }}
          className="shadow-lg shadow-primary/20"
        >
          <UserPlus className="h-4 w-4" /> Nuevo Cliente
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 shadow-lg shadow-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">Total Clientes</p>
                <p className="text-2xl font-bold mt-1">{customers.length}</p>
              </div>
              <Users className="h-8 w-8 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-0 shadow-lg shadow-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-100 text-sm">Nuevos este mes</p>
                <p className="text-2xl font-bold mt-1">{stats.newThisMonth}</p>
              </div>
              <UserCheck className="h-8 w-8 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Con Email</p>
                <p className="text-2xl font-bold mt-1">{stats.withEmail}</p>
              </div>
              <Mail className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Con Teléfono</p>
                <p className="text-2xl font-bold mt-1">{stats.withPhone}</p>
              </div>
              <Phone className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, email o teléfono..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <User className="h-4 w-4" />
          {filteredCustomers.length} resultado
          {filteredCustomers.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Customers Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead className="hidden md:table-cell">
                  Dirección
                </TableHead>
                <TableHead className="hidden sm:table-cell">
                  Registrado
                </TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-4 rounded-full bg-muted">
                        <Users className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">
                          {searchQuery
                            ? "No se encontraron clientes"
                            : "No hay clientes registrados"}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {searchQuery
                            ? "Intenta con otro término de búsqueda"
                            : "¡Registra tu primer cliente!"}
                        </p>
                      </div>
                      {!searchQuery && (
                        <Button
                          onClick={() => {
                            setEditingCustomer(null);
                            setFormData({
                              name: "",
                              email: "",
                              phone: "",
                              address: "",
                            });
                            setShowModal(true);
                          }}
                          variant="outline"
                          className="mt-2"
                        >
                          <UserPlus className="h-4 w-4" /> Agregar Cliente
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredCustomers.map((customer) => (
                  <TableRow key={customer.id} className="hover:bg-muted/50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-full ${getAvatarColor(customer.name)} flex items-center justify-center text-white font-semibold text-sm shadow-sm`}
                        >
                          {getInitials(customer.name)}
                        </div>
                        <span className="font-medium">{customer.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {customer.email && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Mail className="h-3.5 w-3.5" />
                            <span className="truncate max-w-[150px]">
                              {customer.email}
                            </span>
                          </div>
                        )}
                        {customer.phone && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Phone className="h-3.5 w-3.5" />
                            {customer.phone}
                          </div>
                        )}
                        {!customer.email && !customer.phone && (
                          <span className="text-sm text-muted-foreground">
                            Sin contacto
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {customer.address ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                          <span className="truncate max-w-[200px]">
                            {customer.address}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(customer.created_at).toLocaleDateString(
                          "es-AR",
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openEditModal(customer)}
                          className="hover:bg-primary/10 hover:text-primary"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleDelete(customer.id)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal */}
      <Dialog
        open={showModal}
        onOpenChange={() => {
          setShowModal(false);
          setEditingCustomer(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingCustomer ? (
                <>
                  <Pencil className="h-5 w-5 text-primary" />
                  Editar Cliente
                </>
              ) : (
                <>
                  <UserPlus className="h-5 w-5 text-primary" />
                  Nuevo Cliente
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                Nombre
              </label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Nombre completo"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  Email
                </label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="email@ejemplo.com"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  Teléfono
                </label>
                <Input
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  placeholder="+54 11 1234-5678"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                Dirección
              </label>
              <textarea
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
                rows={2}
                placeholder="Calle, número, ciudad..."
                className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowModal(false);
                  setEditingCustomer(null);
                }}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving} className="flex-1">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving
                  ? "Guardando..."
                  : editingCustomer
                    ? "Actualizar"
                    : "Crear Cliente"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
