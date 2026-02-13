"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Loader2, Building2, User, MapPin, CreditCard, Calendar } from "lucide-react";
import type { Customer } from "@/types/database.types";

interface CustomerFormProps {
  customer?: Customer | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function CustomerForm({ customer, onSuccess, onCancel }: CustomerFormProps) {
  const { organizationId } = useOrganization();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [isBusiness, setIsBusiness] = useState(!!customer?.business_type);

  // Form state
  const [formData, setFormData] = useState({
    name: customer?.name || "",
    email: customer?.email || "",
    phone: customer?.phone || "",
    address: customer?.address || "",
    city: customer?.city || "",
    zone: customer?.zone || "",
    lat: customer?.lat || null,
    lng: customer?.lng || null,
    // Service type
    service_type: customer?.service_type || "both",
    // B2B fields
    business_type: customer?.business_type || "",
    tax_id: customer?.tax_id || "",
    credit_limit: customer?.credit_limit || 0,
    payment_terms: customer?.payment_terms || "contado",
    price_list: customer?.price_list || "default",
    contact_person: customer?.contact_person || "",
    business_hours: customer?.business_hours || "",
    notes: customer?.notes || "",
    preferred_visit_time: customer?.preferred_visit_time || "",
    // Route
    visit_day: customer?.visit_day ?? null,
    route_order: customer?.route_order ?? null,
  });

  const businessTypes = [
    { value: "kiosco", label: "Kiosco" },
    { value: "almacen", label: "Almacén" },
    { value: "supermercado", label: "Supermercado" },
    { value: "restaurant", label: "Restaurant" },
    { value: "bar", label: "Bar/Café" },
    { value: "panaderia", label: "Panadería" },
    { value: "carniceria", label: "Carnicería" },
    { value: "verduleria", label: "Verdulería" },
    { value: "farmacia", label: "Farmacia" },
    { value: "otro", label: "Otro" },
  ];

  const paymentTermsOptions = [
    { value: "contado", label: "Contado (efectivo/inmediato)" },
    { value: "7_dias", label: "7 días" },
    { value: "15_dias", label: "15 días" },
    { value: "30_dias", label: "30 días" },
    { value: "60_dias", label: "60 días" },
  ];

  const priceListOptions = [
    { value: "default", label: "Lista Default" },
    { value: "mayorista", label: "Mayorista" },
    { value: "minorista", label: "Minorista" },
    { value: "especial", label: "Precio Especial" },
  ];

  const weekDays = [
    { value: 0, label: "Domingo" },
    { value: 1, label: "Lunes" },
    { value: 2, label: "Martes" },
    { value: 3, label: "Miércoles" },
    { value: 4, label: "Jueves" },
    { value: 5, label: "Viernes" },
    { value: 6, label: "Sábado" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId) return;

    setLoading(true);

    try {
      const dataToSave: any = {
        organization_id: organizationId,
        name: formData.name.trim(),
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
        address: formData.address.trim() || null,
        city: formData.city.trim() || null,
        zone: formData.zone.trim() || null,
        lat: formData.lat,
        lng: formData.lng,
        service_type: formData.service_type,
        visit_day: formData.visit_day,
        route_order: formData.route_order,
        is_active: true,
      };

      // Campos B2B (solo si es negocio)
      if (isBusiness) {
        dataToSave.business_type = formData.business_type || null;
        dataToSave.tax_id = formData.tax_id.trim() || null;
        dataToSave.credit_limit = Number(formData.credit_limit) || 0;
        dataToSave.payment_terms = formData.payment_terms;
        dataToSave.price_list = formData.price_list;
        dataToSave.contact_person = formData.contact_person.trim() || null;
        dataToSave.business_hours = formData.business_hours.trim() || null;
        dataToSave.notes = formData.notes.trim() || null;
        dataToSave.preferred_visit_time = formData.preferred_visit_time || null;
      } else {
        // Si no es negocio, limpiar campos B2B
        dataToSave.business_type = null;
        dataToSave.tax_id = null;
        dataToSave.credit_limit = 0;
        dataToSave.payment_terms = "contado";
        dataToSave.price_list = "default";
        dataToSave.contact_person = null;
        dataToSave.business_hours = null;
        dataToSave.notes = null;
        dataToSave.preferred_visit_time = null;
      }

      let error;

      if (customer?.id) {
        // Update
        const result = await supabase
          .from("customers")
          .update(dataToSave)
          .eq("id", customer.id);
        error = result.error;
      } else {
        // Insert
        const result = await supabase.from("customers").insert([dataToSave]);
        error = result.error;
      }

      if (error) throw error;

      toast.success(customer ? "Cliente actualizado" : "Cliente creado");
      onSuccess();
    } catch (error: any) {
      console.error("Error saving customer:", error);
      toast.error("Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Toggle Persona/Negocio */}
      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-3">
          {isBusiness ? (
            <Building2 className="h-5 w-5 text-blue-500" />
          ) : (
            <User className="h-5 w-5 text-gray-500" />
          )}
          <div>
            <Label className="text-base font-semibold">
              {isBusiness ? "Cliente Comercial (B2B)" : "Cliente Persona (B2C)"}
            </Label>
            <p className="text-sm text-muted-foreground">
              {isBusiness
                ? "Negocio con cuenta corriente, crédito y lista de precios"
                : "Cliente final que paga en efectivo"}
            </p>
          </div>
        </div>
        <Switch checked={isBusiness} onCheckedChange={setIsBusiness} />
      </div>

      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="basic">Datos Básicos</TabsTrigger>
          <TabsTrigger value="business" disabled={!isBusiness}>
            Datos Comerciales
          </TabsTrigger>
          <TabsTrigger value="route">Ruta</TabsTrigger>
        </TabsList>

        {/* Tab: Datos Básicos */}
        <TabsContent value="basic" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="name">
                Nombre <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={isBusiness ? "Nombre del negocio" : "Nombre completo"}
                required
              />
            </div>

            <div>
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="11 2345-6789"
              />
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@ejemplo.com"
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="address">
                <MapPin className="h-3 w-3 inline mr-1" />
                Dirección
              </Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Calle 123, Ciudad"
              />
            </div>

            <div>
              <Label htmlFor="city">Ciudad</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="Buenos Aires"
              />
            </div>

            <div>
              <Label htmlFor="zone">Zona</Label>
              <Input
                id="zone"
                value={formData.zone}
                onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                placeholder="Norte, Sur, Centro..."
              />
            </div>
          </div>
        </TabsContent>

        {/* Tab: Datos Comerciales (solo B2B) */}
        <TabsContent value="business" className="space-y-4 mt-4">
          {isBusiness && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="business_type">Tipo de Negocio</Label>
                  <Select
                    value={formData.business_type}
                    onValueChange={(value) =>
                      setFormData({ ...formData, business_type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {businessTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="tax_id">CUIT</Label>
                  <Input
                    id="tax_id"
                    value={formData.tax_id}
                    onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                    placeholder="20-12345678-9"
                  />
                </div>

                <div>
                  <Label htmlFor="contact_person">Persona de Contacto</Label>
                  <Input
                    id="contact_person"
                    value={formData.contact_person}
                    onChange={(e) =>
                      setFormData({ ...formData, contact_person: e.target.value })
                    }
                    placeholder="Juan Pérez"
                  />
                </div>

                <div>
                  <Label htmlFor="business_hours">Horarios</Label>
                  <Input
                    id="business_hours"
                    value={formData.business_hours}
                    onChange={(e) =>
                      setFormData({ ...formData, business_hours: e.target.value })
                    }
                    placeholder="Lun-Vie 9-18hs"
                  />
                </div>

                <div>
                  <Label htmlFor="payment_terms">
                    <CreditCard className="h-3 w-3 inline mr-1" />
                    Condición de Pago
                  </Label>
                  <Select
                    value={formData.payment_terms}
                    onValueChange={(value) =>
                      setFormData({ ...formData, payment_terms: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentTermsOptions.map((term) => (
                        <SelectItem key={term.value} value={term.value}>
                          {term.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="credit_limit">Límite de Crédito ($)</Label>
                  <Input
                    id="credit_limit"
                    type="number"
                    min="0"
                    step="100"
                    value={formData.credit_limit}
                    onChange={(e) =>
                      setFormData({ ...formData, credit_limit: Number(e.target.value) })
                    }
                    placeholder="0"
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="price_list">Lista de Precios</Label>
                  <Select
                    value={formData.price_list}
                    onValueChange={(value) =>
                      setFormData({ ...formData, price_list: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {priceListOptions.map((list) => (
                        <SelectItem key={list.value} value={list.value}>
                          {list.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2">
                  <Label htmlFor="notes">Notas / Observaciones</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Información adicional del cliente..."
                    rows={3}
                  />
                </div>
              </div>
            </>
          )}
        </TabsContent>

        {/* Tab: Ruta */}
        <TabsContent value="route" className="space-y-4 mt-4">
          <Card>
            <CardContent className="pt-6">
              {/* Tipo de Servicio */}
              <div className="mb-6 p-4 bg-muted/30 rounded-lg">
                <Label className="text-base font-semibold mb-3 block">
                  <MapPin className="h-4 w-4 inline mr-2" />
                  Tipo de Servicio
                </Label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, service_type: "counter" })}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      formData.service_type === "counter"
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="text-center">
                      <div className="text-2xl mb-1">🏪</div>
                      <div className="font-semibold">Solo Mostrador</div>
                      <div className="text-xs text-muted-foreground">Viene al local</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, service_type: "delivery" })}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      formData.service_type === "delivery"
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="text-center">
                      <div className="text-2xl mb-1">🚚</div>
                      <div className="font-semibold">Solo Reparto</div>
                      <div className="text-xs text-muted-foreground">Visita en ruta</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, service_type: "both" })}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      formData.service_type === "both"
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="text-center">
                      <div className="text-2xl mb-1">🏪🚚</div>
                      <div className="font-semibold">Ambos</div>
                      <div className="text-xs text-muted-foreground">Flexible</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Campos de Ruta (solo si incluye delivery) */}
              {(formData.service_type === "delivery" || formData.service_type === "both") && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="visit_day">
                    <Calendar className="h-3 w-3 inline mr-1" />
                    Día de Visita
                  </Label>
                  <Select
                    value={formData.visit_day?.toString() || "none"}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        visit_day: value && value !== "none" ? Number(value) : null,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sin día asignado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin día</SelectItem>
                      {weekDays.map((day) => (
                        <SelectItem key={day.value} value={day.value.toString()}>
                          {day.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="route_order">Orden en la Ruta</Label>
                  <Input
                    id="route_order"
                    type="number"
                    min="1"
                    value={formData.route_order || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        route_order: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    placeholder="1, 2, 3..."
                  />
                </div>

                {isBusiness && (
                  <div className="col-span-2">
                    <Label htmlFor="preferred_visit_time">Hora Preferida de Visita</Label>
                    <Input
                      id="preferred_visit_time"
                      type="time"
                      value={formData.preferred_visit_time}
                      onChange={(e) =>
                        setFormData({ ...formData, preferred_visit_time: e.target.value })
                      }
                    />
                  </div>
                )}
              </div>
              )}

              {(formData.service_type === "counter") && (
                <div className="text-center text-muted-foreground py-8">
                  <MapPin className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Cliente de mostrador: no requiere configuración de ruta</p>
                </div>
              )}

              {(formData.service_type === "delivery" || formData.service_type === "both") && (
              <p className="text-sm text-muted-foreground mt-4">
                💡 El día y orden determinan en qué momento el preventista visitará este
                cliente durante su recorrido.
              </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {customer ? "Actualizar" : "Crear"} Cliente
        </Button>
      </div>
    </form>
  );
}
