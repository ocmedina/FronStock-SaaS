'use server';

import { requireOrganizationPermission } from '@/actions/_permissions';
import { createClient } from '@/lib/supabase/server';

type DeliveryCustomerInput = {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  zone?: string | null;
  lat?: number | null;
  lng?: number | null;
  service_type?: string;
  visit_day?: number | null;
  route_order?: number | null;
  business_type?: string | null;
  tax_id?: string | null;
  credit_limit?: number;
  payment_terms?: string;
  price_list?: string;
  contact_person?: string | null;
  business_hours?: string | null;
  notes?: string | null;
  preferred_visit_time?: string | null;
  is_active?: boolean;
};

export async function saveDeliveryCustomer(input: {
  customerId?: string;
  data: DeliveryCustomerInput;
}) {
  const guard = await requireOrganizationPermission('delivery', input.customerId ? 'edit' : 'create');
  if (!guard.allowed || !guard.organizationId) {
    return { error: guard.error || 'No autorizado' };
  }

  const supabase = await createClient();

  const payload = {
    ...input.data,
    organization_id: guard.organizationId,
  };

  if (input.customerId) {
    const { error } = await supabase
      .from('customers')
      .update(payload)
      .eq('id', input.customerId)
      .eq('organization_id', guard.organizationId);

    if (error) return { error: error.message || 'No se pudo actualizar cliente' };
  } else {
    const { error } = await supabase.from('customers').insert([payload]);
    if (error) return { error: error.message || 'No se pudo crear cliente' };
  }

  return { success: true };
}

export async function deleteDeliveryCustomer(customerId: string) {
  const guard = await requireOrganizationPermission('delivery', 'delete');
  if (!guard.allowed || !guard.organizationId) {
    return { error: guard.error || 'No autorizado' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', customerId)
    .eq('organization_id', guard.organizationId);

  if (error) {
    return { error: error.message || 'No se pudo eliminar cliente' };
  }

  return { success: true };
}

export async function createDeliveryRoute(input: {
  name: string;
  zone?: string;
  visit_day: number;
  driver_id?: string | null;
}) {
  const guard = await requireOrganizationPermission('delivery', 'create');
  if (!guard.allowed || !guard.organizationId) {
    return { error: guard.error || 'No autorizado' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('create_route_from_customers', {
    p_org_id: guard.organizationId,
    p_route_name: input.name,
    p_zone: input.zone || null,
    p_visit_day: input.visit_day,
    p_driver_id: input.driver_id || null,
  });

  if (error) {
    return { error: error.message || 'No se pudo crear la ruta' };
  }

  return { success: true };
}

export async function startDeliveryRoute(routeId: string) {
  const guard = await requireOrganizationPermission('delivery', 'edit');
  if (!guard.allowed || !guard.organizationId) {
    return { error: guard.error || 'No autorizado' };
  }

  const supabase = await createClient();
  const { data: route, error: routeError } = await supabase
    .from('routes')
    .select('id')
    .eq('id', routeId)
    .eq('organization_id', guard.organizationId)
    .single();

  if (routeError || !route) {
    return { error: 'Ruta no encontrada' };
  }

  const { error } = await supabase.rpc('start_route', { p_route_id: routeId });
  if (error) return { error: error.message || 'No se pudo iniciar la ruta' };

  return { success: true };
}

export async function completeDeliveryRoute(routeId: string) {
  const guard = await requireOrganizationPermission('delivery', 'edit');
  if (!guard.allowed || !guard.organizationId) {
    return { error: guard.error || 'No autorizado' };
  }

  const supabase = await createClient();
  const { data: route, error: routeError } = await supabase
    .from('routes')
    .select('id')
    .eq('id', routeId)
    .eq('organization_id', guard.organizationId)
    .single();

  if (routeError || !route) {
    return { error: 'Ruta no encontrada' };
  }

  const { error } = await supabase.rpc('complete_route', { p_route_id: routeId });
  if (error) return { error: error.message || 'No se pudo completar la ruta' };

  return { success: true };
}

export async function deleteDeliveryRoute(routeId: string) {
  const guard = await requireOrganizationPermission('delivery', 'delete');
  if (!guard.allowed || !guard.organizationId) {
    return { error: guard.error || 'No autorizado' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('routes')
    .delete()
    .eq('id', routeId)
    .eq('organization_id', guard.organizationId);

  if (error) {
    return { error: error.message || 'No se pudo eliminar la ruta' };
  }

  return { success: true };
}

export async function reuseDeliveryRoute(input: {
  routeId: string;
  name?: string;
  visit_day?: number | null;
  driver_id?: string | null;
}) {
  const guard = await requireOrganizationPermission('delivery', 'create');
  if (!guard.allowed || !guard.organizationId) {
    return { error: guard.error || 'No autorizado' };
  }

  const supabase = await createClient();

  const { data: sourceRoute, error: sourceRouteError } = await supabase
    .from('routes')
    .select('id, name, zone, visit_day, driver_id, notes')
    .eq('id', input.routeId)
    .eq('organization_id', guard.organizationId)
    .single();

  if (sourceRouteError || !sourceRoute) {
    return { error: 'Ruta base no encontrada' };
  }

  const { data: sourceStops, error: sourceStopsError } = await supabase
    .from('route_stops')
    .select('customer_id, stop_order, estimated_arrival, estimated_duration_mins, address_snapshot, lat_snapshot, lng_snapshot, internal_notes')
    .eq('route_id', sourceRoute.id)
    .order('stop_order', { ascending: true });

  if (sourceStopsError) {
    return { error: sourceStopsError.message || 'No se pudieron leer las paradas de la ruta' };
  }

  const routeName = input.name?.trim().length
    ? input.name.trim()
    : `${sourceRoute.name} (reutilizada)`;

  const { data: newRoute, error: newRouteError } = await supabase
    .from('routes')
    .insert({
      organization_id: guard.organizationId,
      name: routeName,
      zone: sourceRoute.zone,
      visit_day: input.visit_day ?? sourceRoute.visit_day,
      driver_id: input.driver_id ?? sourceRoute.driver_id,
      notes: sourceRoute.notes,
      status: 'planned',
      total_stops: sourceStops?.length || 0,
      started_at: null,
      completed_at: null,
    })
    .select('id')
    .single();

  if (newRouteError || !newRoute) {
    return { error: newRouteError?.message || 'No se pudo crear la ruta reutilizada' };
  }

  if (sourceStops && sourceStops.length > 0) {
    const payload = sourceStops.map((stop) => ({
      route_id: newRoute.id,
      customer_id: stop.customer_id,
      stop_order: stop.stop_order,
      estimated_arrival: stop.estimated_arrival,
      estimated_duration_mins: stop.estimated_duration_mins,
      address_snapshot: stop.address_snapshot,
      lat_snapshot: stop.lat_snapshot,
      lng_snapshot: stop.lng_snapshot,
      internal_notes: stop.internal_notes,
      visit_status: 'pending',
      visited_at: null,
      sale_id: null,
      visit_notes: null,
    }));

    const { error: insertStopsError } = await supabase
      .from('route_stops')
      .insert(payload);

    if (insertStopsError) {
      await supabase.from('routes').delete().eq('id', newRoute.id);
      return { error: insertStopsError.message || 'No se pudieron clonar las paradas de la ruta' };
    }
  }

  return { success: true, routeId: newRoute.id };
}
