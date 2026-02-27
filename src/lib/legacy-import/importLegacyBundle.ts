import { performance } from 'node:perf_hooks';
import { buildReport } from './buildReport';
import { getImportConfig } from './config';
import { loadBundle } from './loadBundle';
import { log } from './logger';
import { parseMapping } from './parseMapping';
import { createRelationDictionary, resolveRelations } from './resolveRelations';
import { transformRow } from './transformRow';
import { upsertBatch } from './upsertBatch';
import { validateIntegrity } from './validateIntegrity';
import type { ImportResult, RowError, TableResult } from './types';

const ORG_SCOPED_TABLES = new Set<string>([
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
]);

function chunkRows<T>(rows: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}

function aggregateNumericTotals(
  table: string,
  rows: Array<Record<string, unknown>>
): Record<string, number> {
  const totals: Record<string, number> = {};

  for (const row of rows) {
    for (const [field, value] of Object.entries(row)) {
      if (field.startsWith('__meta_')) {
        continue;
      }

      if (typeof value === 'number' && Number.isFinite(value)) {
        const key = `${table}.${field}`;
        totals[key] = (totals[key] || 0) + value;
      }
    }
  }

  return totals;
}

function enforceOrganizationScope(
  table: string,
  row: Record<string, unknown>,
  enforceOrganizationId?: string
): Record<string, unknown> {
  if (!enforceOrganizationId) {
    return row;
  }

  if (ORG_SCOPED_TABLES.has(table) || Object.prototype.hasOwnProperty.call(row, 'organization_id')) {
    return {
      ...row,
      organization_id: enforceOrganizationId,
    };
  }

  return row;
}

export async function importLegacyBundle(
  bundlePath: string,
  options?: { enforceOrganizationId?: string }
): Promise<ImportResult> {
  const startedAt = new Date();
  const startedClock = performance.now();
  const config = getImportConfig();

  const bundle = await loadBundle(bundlePath, config);
  const mapping = await parseMapping(bundle.mappingCsvPath);
  const relationDictionary = createRelationDictionary();

  const tableResults: TableResult[] = [];
  const globalErrors: RowError[] = [];

  const availableByNormalized = new Map<string, string>(
    bundle.availableTables.map((table) => [table.toLowerCase(), table])
  );

  const orderedTables = bundle.importOrder
    .map((tableName) => availableByNormalized.get(String(tableName).toLowerCase()) || '')
    .filter(Boolean);

  if (orderedTables.length === 0) {
    const fallbackOrdered = config.importOrderFallback
      .map((tableName) => availableByNormalized.get(tableName.toLowerCase()) || '')
      .filter(Boolean);

    const extras = bundle.availableTables.filter((table) => !fallbackOrdered.includes(table));
    orderedTables.push(...fallbackOrdered, ...extras);
  }

  log('info', 'import.start', {
    bundlePath: bundle.bundlePath,
    sourceSystem: bundle.sourceSystem,
    orderedTables,
    batchSize: config.batchSize,
    tolerantMode: config.tolerantMode,
  });

  for (const table of orderedTables) {
    const tableStart = performance.now();
    const sourceRows = bundle.tableData[table] || [];

    const transformedRows: Array<Record<string, unknown>> = [];
    const tableErrors: RowError[] = [];

    for (let rowIndex = 0; rowIndex < sourceRows.length; rowIndex++) {
      const sourceRow = sourceRows[rowIndex];

      try {
        const transformed = transformRow(sourceRow, {
          table,
          sourceSystem: bundle.sourceSystem,
          rowIndex,
          mapping,
          config,
        });

        const withRelations = resolveRelations(table, transformed, mapping, relationDictionary);
        const scoped = enforceOrganizationScope(table, withRelations, options?.enforceOrganizationId);
        transformedRows.push(scoped);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        const rowError: RowError = {
          table,
          rowIndex,
          legacyId: String(sourceRow[config.identityColumns.legacyId] ?? sourceRow.id ?? ''),
          error: message,
          payload: sourceRow,
        };

        tableErrors.push(rowError);
        globalErrors.push(rowError);

        if (!config.tolerantMode) {
          throw error;
        }
      }
    }

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let failed = tableErrors.length;

    const batches = chunkRows(transformedRows, config.batchSize);

    for (const batch of batches) {
      try {
        const batchResult = await upsertBatch({
          table,
          rows: batch,
          config,
        });

        inserted += batchResult.inserted;
        updated += batchResult.updated;
        skipped += batchResult.skipped;
        failed += batchResult.failed;

        if (batchResult.errors.length > 0) {
          tableErrors.push(...batchResult.errors);
          globalErrors.push(...batchResult.errors);
        }

        for (const pair of batchResult.relationPairs) {
          relationDictionary.set(pair.table, pair.legacyId, pair.newId);
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);

        const batchErrors: RowError[] = batch.map((row, localIndex) => ({
          table,
          rowIndex: Number(row.__meta_rowIndex ?? localIndex),
          legacyId: String(row.__meta_legacyId ?? ''),
          error: message,
          payload: row,
        }));

        tableErrors.push(...batchErrors);
        globalErrors.push(...batchErrors);
        failed += batch.length;

        if (!config.tolerantMode) {
          throw error;
        }
      }
    }

    const tableDurationMs = Math.round(performance.now() - tableStart);
    const tableTotals = aggregateNumericTotals(table, transformedRows);

    const tableResult: TableResult = {
      table,
      sourceRows: sourceRows.length,
      processedRows: transformedRows.length,
      inserted,
      updated,
      skipped,
      failed,
      durationMs: tableDurationMs,
      rowErrors: tableErrors,
      totals: tableTotals,
    };

    tableResults.push(tableResult);

    log('info', 'import.table.completed', {
      table,
      sourceRows: sourceRows.length,
      processedRows: transformedRows.length,
      inserted,
      updated,
      skipped,
      failed,
      durationMs: tableDurationMs,
    });
  }

  const validations = validateIntegrity(tableResults, bundle.integritySummary);
  const finishedAt = new Date();

  const report = buildReport({
    sourceSystem: bundle.sourceSystem,
    bundlePath: bundle.bundlePath,
    startedAt,
    finishedAt,
    tableResults,
    validations,
    errors: globalErrors,
    importOrder: orderedTables,
    availableTables: bundle.availableTables,
    tolerantMode: config.tolerantMode,
    batchSize: config.batchSize,
  });

  log('info', 'import.completed', {
    durationMs: Math.round(performance.now() - startedClock),
    inserted: report.inserted,
    updated: report.updated,
    skipped: report.skipped,
    failed: report.failed,
    validationsPassed: report.validations.filter((item) => item.passed).length,
    validationsTotal: report.validations.length,
  });

  return report;
}
