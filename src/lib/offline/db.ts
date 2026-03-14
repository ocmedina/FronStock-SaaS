import Dexie, { Table } from 'dexie';

// Tipos para las tablas offline
export interface OfflineProduct {
  id: string;
  name: string;
  sku?: string;
  barcode?: string;
  plu?: string;
  price: number;
  wholesale_price?: number;
  stock: number;
  organization_id: string;
  last_synced: number;
}

export interface OfflineCustomer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  organization_id: string;
  last_synced: number;
}

export interface PendingSale {
  local_id: string; // ID temporal local
  organization_id: string;
  customer_id?: string;
  customer_name?: string;
  service_type: 'counter' | 'delivery';
  payment_method: string;
  items: {
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    discount: number;
    subtotal: number;
  }[];
  subtotal: number;
  discount: number;
  total: number;
  status: 'pending_sync' | 'syncing' | 'synced' | 'error';
  error_message?: string;
  created_at: number;
  synced_at?: number;
  retry_count: number;
}

export interface OfflineInvoice {
  id: string;
  organization_id: string;
  sale_id: string;
  customer_id?: string;
  invoice_number: string;
  type: string;
  total: number;
  status: string;
  cae?: string;
  cae_expiration?: string;
  afip_status?: string;
  afip_error?: string;
  created_at: string;
  customer?: {
    id: string;
    name: string;
    cuit?: string;
  };
  last_synced: number;
}

export interface OfflineOrder {
  id: string;
  organization_id: string;
  customer_id?: string | null;
  service_type?: string | null;
  status: string;
  total: number;
  created_at: string;
  customer?: any;
  order_items?: any[];
  routes?: any;
  last_synced: number;
}

export interface PendingOrder {
  local_id: string;
  organization_id: string;
  payload: {
    p_org_id: string;
    p_customer_id: string;
    p_payment_method: string;
    p_items: {
      product_id: string;
      product_name: string;
      quantity: number;
      unit_price: number;
    }[];
    p_delivery_address?: string | null;
    p_delivery_notes?: string | null;
    p_estimated_mins?: number;
    p_delivery_fee?: number;
    p_discount?: number;
    p_payment_amount?: number | null;
    p_client_reference?: string;
  };
  status: 'pending_sync' | 'syncing' | 'synced' | 'error';
  error_message?: string;
  created_at: number;
  synced_at?: number;
  retry_count: number;
}

export interface SyncLog {
  id?: number;
  type: 'sale' | 'product' | 'customer' | 'invoice' | 'order';
  action: 'upload' | 'download';
  status: 'success' | 'error';
  message?: string;
  timestamp: number;
}

// Database class
export class OfflineDB extends Dexie {
  products!: Table<OfflineProduct, string>;
  customers!: Table<OfflineCustomer, string>;
  pendingSales!: Table<PendingSale, string>;
  invoices!: Table<OfflineInvoice, string>;
  orders!: Table<OfflineOrder, string>;
  pendingOrders!: Table<PendingOrder, string>;
  syncLogs!: Table<SyncLog, number>;

  constructor() {
    super('FrontStockOfflineDB');
    
    // Version 1: Initial schema
    this.version(1).stores({
      products: 'id, organization_id, name, barcode, last_synced',
      customers: 'id, organization_id, name, last_synced',
      pendingSales: 'local_id, organization_id, status, created_at',
      syncLogs: '++id, type, status, timestamp'
    });

    // Version 2: Add plu and sku indexes for products
    this.version(2).stores({
      products: 'id, organization_id, name, barcode, plu, sku, last_synced',
      customers: 'id, organization_id, name, last_synced',
      pendingSales: 'local_id, organization_id, status, created_at',
      syncLogs: '++id, type, status, timestamp'
    });

    // Version 3: Add invoices table
    this.version(3).stores({
      products: 'id, organization_id, name, barcode, plu, sku, last_synced',
      customers: 'id, organization_id, name, last_synced',
      pendingSales: 'local_id, organization_id, status, created_at',
      invoices: 'id, organization_id, invoice_number, status, last_synced',
      syncLogs: '++id, type, status, timestamp'
    });

    // Version 4: Add orders table
    this.version(4).stores({
      products: 'id, organization_id, name, barcode, plu, sku, last_synced',
      customers: 'id, organization_id, name, last_synced',
      pendingSales: 'local_id, organization_id, status, created_at',
      invoices: 'id, organization_id, invoice_number, status, last_synced',
      orders: 'id, organization_id, status, created_at, last_synced',
      syncLogs: '++id, type, status, timestamp'
    });

    // Version 5: Add pending orders queue
    this.version(5).stores({
      products: 'id, organization_id, name, barcode, plu, sku, last_synced',
      customers: 'id, organization_id, name, last_synced',
      pendingSales: 'local_id, organization_id, status, created_at',
      invoices: 'id, organization_id, invoice_number, status, last_synced',
      orders: 'id, organization_id, status, created_at, last_synced',
      pendingOrders: 'local_id, organization_id, status, created_at',
      syncLogs: '++id, type, status, timestamp'
    });
  }
}

// Singleton instance
export const offlineDB = new OfflineDB();

export async function clearOfflineOrganizationData(organizationId: string): Promise<void> {
  if (!organizationId) return;

  await offlineDB.transaction(
    'rw',
    offlineDB.products,
    offlineDB.customers,
    offlineDB.pendingSales,
    offlineDB.invoices,
    offlineDB.orders,
    offlineDB.pendingOrders,
    async () => {
      await Promise.all([
        offlineDB.products.where('organization_id').equals(organizationId).delete(),
        offlineDB.customers.where('organization_id').equals(organizationId).delete(),
        offlineDB.pendingSales.where('organization_id').equals(organizationId).delete(),
        offlineDB.invoices.where('organization_id').equals(organizationId).delete(),
        offlineDB.orders.where('organization_id').equals(organizationId).delete(),
        offlineDB.pendingOrders.where('organization_id').equals(organizationId).delete(),
      ]);
    }
  );
}
