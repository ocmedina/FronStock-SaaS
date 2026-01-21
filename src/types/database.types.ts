// Tipos de base de datos para FrontStock SaaS
// Adaptados a la estructura existente en Supabase

export interface Organization {
  id: string;
  name: string;
  plan_type: string;
  created_at: string;
}

export interface Profile {
  id: string; // Referencia a auth.users.id
  organization_id: string | null;
  full_name: string | null;
  role: string;
  updated_at: string;
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
  description: string | null;
}

// Tipos para inserción (sin campos auto-generados)
export type OrganizationInsert = Omit<Organization, 'id' | 'created_at'>;
export type ProductInsert = Omit<Product, 'id' | 'created_at'>;

// Tipos para actualización
export type OrganizationUpdate = Partial<Omit<Organization, 'id' | 'created_at'>>;
export type ProductUpdate = Partial<Omit<Product, 'id' | 'organization_id' | 'created_at'>>;

// Extender en el futuro con más entidades:
// Customer, Supplier, Sale, etc.
