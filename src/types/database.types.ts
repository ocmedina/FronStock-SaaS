// Tipos de base de datos para FrontStock SaaS
// Adaptados a la estructura existente en Supabase

export interface Organization {
  id: string;
  name: string;
  plan_type: string;
  created_at: string;
  address?: string | null;
  cuit?: string | null;
  logo_url?: string | null;
  tax_condition?: string | null;
  activity_start_date?: string | null;
  gross_income_number?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface Profile {
  id: string; // Referencia a auth.users.id
  organization_id: string | null;
  full_name: string | null;
  role: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  organization_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  service_type: "counter" | "delivery" | "both"; // Tipo de servicio
  visit_day: number | null; // 0=Domingo, 1=Lunes...
  route_order: number | null;
  // Campos B2B
  business_type: string | null; // 'kiosco', 'restaurant', etc
  tax_id: string | null; // CUIT
  balance: number; // Cuenta corriente (positivo = debe, negativo = a favor)
  credit_limit: number;
  payment_terms: string; // 'contado', '7_dias', '15_dias', '30_dias'
  price_list: string; // 'default', 'mayorista', 'minorista'
  zone: string | null; // 'norte', 'sur', etc
  is_active: boolean;
  contact_person: string | null;
  business_hours: string | null;
  notes: string | null;
  last_visit_date: string | null;
  preferred_visit_time: string | null; // Format: "09:00"
  created_at: string;
  cuit?: string | null; // Alias de tax_id para compatibilidad
}

export type UserRole = 'owner' | 'admin' | 'manager' | 'employee';

// Base interface para entidades con tenant
export interface TenantEntity {
  id: string;
  organization_id: string;
  created_at: string;
}

export interface Product extends TenantEntity {
  name: string;
  sku: string | null;
  barcode: string | null;
  stock: number;
  price: number; // Precio de venta (minorista)
  cost_price: number | null; // Precio de costo
  wholesale_price: number | null; // Precio mayorista
  min_stock: number | null; // Stock mínimo para alertas
  is_combo: boolean; // Si es un combo/promo
  description: string | null;
  plu: string | null;
}

// Tipos para inserción (sin campos auto-generados)
export type OrganizationInsert = Omit<Organization, 'id' | 'created_at'>;
export type ProductInsert = Omit<Product, 'id' | 'created_at'>;

// Tipos para actualización
export type OrganizationUpdate = Partial<Omit<Organization, 'id' | 'created_at'>>;
export type ProductUpdate = Partial<Omit<Product, 'id' | 'organization_id' | 'created_at'>>;

// Extender en el futuro con más entidades:
// Customer, Supplier, Sale, etc.
