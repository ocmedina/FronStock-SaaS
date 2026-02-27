export type ImportTableName =
  | 'settings'
  | 'profiles'
  | 'brands'
  | 'categories'
  | 'suppliers'
  | 'customers'
  | 'products'
  | 'purchases'
  | 'purchase_items'
  | 'supplier_payments'
  | 'orders'
  | 'order_items'
  | 'sales'
  | 'sale_items'
  | 'payments'
  | 'stock_movements'
  | 'expenses'
  | 'cash_movements'
  | 'daily_reports'
  | 'invoices';

export const SUPPORTED_TABLES: ImportTableName[] = [
  'settings',
  'profiles',
  'brands',
  'categories',
  'suppliers',
  'customers',
  'products',
  'purchases',
  'purchase_items',
  'supplier_payments',
  'orders',
  'order_items',
  'sales',
  'sale_items',
  'payments',
  'stock_movements',
  'expenses',
  'cash_movements',
  'daily_reports',
  'invoices',
];

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface StructuredLog {
  ts: string;
  level: LogLevel;
  event: string;
  context?: Record<string, unknown>;
}

export interface RowError {
  table: string;
  rowIndex: number;
  legacyId?: string;
  error: string;
  code?: string;
  payload?: Record<string, unknown>;
}

export interface TableResult {
  table: string;
  sourceRows: number;
  processedRows: number;
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
  durationMs: number;
  rowErrors: RowError[];
  totals: Record<string, number>;
}

export interface IntegrityCheck {
  name: string;
  expected: number;
  actual: number;
  passed: boolean;
  delta: number;
  details?: string;
}

export interface ImportResult {
  sourceSystem: string;
  bundlePath: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
  tablesProcessed: number;
  tableResults: TableResult[];
  validations: IntegrityCheck[];
  errors: RowError[];
  metadata: {
    importOrder: string[];
    availableTables: string[];
    tolerantMode: boolean;
    batchSize: number;
  };
}

export interface LegacyBundle {
  bundlePath: string;
  tableData: Record<string, Array<Record<string, unknown>>>;
  availableTables: string[];
  mappingCsvPath?: string;
  integritySummary?: Record<string, unknown>;
  importOrder: string[];
  exportReport?: Record<string, unknown>;
  sourceSystem: string;
}

export type TransformDataType =
  | 'string'
  | 'uuid'
  | 'decimal'
  | 'integer'
  | 'boolean'
  | 'datetime_tz'
  | 'enum'
  | 'json'
  | 'raw';

export interface MappingRule {
  sourceTable: string;
  sourceField: string;
  targetTable: string;
  targetField: string;
  dataType: TransformDataType;
  required: boolean;
  defaultValue?: string;
  enumValues?: string[];
  relationTable?: string;
}

export interface MappingDefinition {
  bySourceTable: Record<string, MappingRule[]>;
  byTargetTable: Record<string, MappingRule[]>;
}

export interface ImportConfig {
  batchSize: number;
  tolerantMode: boolean;
  sourceSystemFallback: string;
  identityColumns: {
    legacyId: string;
    sourceSystem: string;
    id: string;
  };
  importOrderFallback: string[];
}

export interface TransformContext {
  table: string;
  sourceSystem: string;
  rowIndex: number;
  mapping: MappingDefinition;
  config: ImportConfig;
}

export interface RelationDictionary {
  set: (table: string, legacyId: string, newId: string) => void;
  get: (table: string, legacyId: string) => string | undefined;
}

export interface UpsertBatchInput {
  table: string;
  rows: Array<Record<string, unknown>>;
  config: ImportConfig;
}

export interface UpsertBatchResult {
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: RowError[];
  relationPairs: Array<{ table: string; legacyId: string; newId: string }>;
}
