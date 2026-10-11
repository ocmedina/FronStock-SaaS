import { createAdminClient } from '@/lib/supabase/admin';
import type { RowError, UpsertBatchInput, UpsertBatchResult } from './types';

function extractMissingColumn(message?: string): string | null {
  if (!message) return null;

  const patterns = [
    /Could not find the '([^']+)' column/i,
    /column\s+"([^"]+)"\s+of\s+relation/i,
    /column\s+([a-zA-Z0-9_]+)\s+does not exist/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

function removeColumn(
  rows: Array<Record<string, unknown>>,
  column: string
): Array<Record<string, unknown>> {
  let changed = false;
  const nextRows = rows.map((row) => {
    if (!Object.prototype.hasOwnProperty.call(row, column)) {
      return row;
    }
    changed = true;
    const copy = { ...row };
    delete copy[column];
    return copy;
  });

  return changed ? nextRows : rows;
}

async function upsertWithColumnPruning(
  supabase: ReturnType<typeof createAdminClient>,
  table: string,
  rows: Array<Record<string, unknown>>,
  onConflict: string,
  selectFields: string
) {
  const removedColumns = new Set<string>();
  let workingRows = rows;

  while (true) {
    const response = await supabase
      .from(table)
      .upsert(workingRows, {
        onConflict,
        ignoreDuplicates: false,
      })
      .select(selectFields);

    if (!response.error) {
      return response;
    }

    const missingColumn = extractMissingColumn(response.error.message);
    if (!missingColumn || removedColumns.has(missingColumn)) {
      return response;
    }

    removedColumns.add(missingColumn);
    const prunedRows = removeColumn(workingRows, missingColumn);
    if (prunedRows === workingRows) {
      return response;
    }

    workingRows = prunedRows;
  }
}

function sanitizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (key.startsWith('__meta_')) {
      continue;
    }
    sanitized[key] = value;
  }
  return sanitized;
}

function getMeta(row: Record<string, unknown>, fallbackIndex: number) {
  return {
    rowIndex: Number(row.__meta_rowIndex ?? fallbackIndex),
    legacyId: String(row.__meta_legacyId ?? ''),
  };
}

async function findExistingLegacyKeys(
  table: string,
  rows: Array<Record<string, unknown>>,
  legacyIdColumn: string,
  sourceSystemColumn: string
): Promise<Set<string>> {
  const supabase = createAdminClient();
  const legacyIds = rows
    .map((row) => row[legacyIdColumn])
    .filter((value): value is string => typeof value === 'string' && value.trim() !== '')
    .map((value) => value.trim());

  if (legacyIds.length === 0) {
    return new Set<string>();
  }

  const sourceSystem = rows[0]?.[sourceSystemColumn];
  if (typeof sourceSystem !== 'string' || !sourceSystem) {
    return new Set<string>();
  }

  const { data, error } = await supabase
    .from(table)
    .select(`${legacyIdColumn}, ${sourceSystemColumn}`)
    .eq(sourceSystemColumn, sourceSystem)
    .in(legacyIdColumn, legacyIds);

  if (error || !data) {
    return new Set<string>();
  }

  const keys = new Set<string>();
  for (const row of data as unknown as Array<Record<string, unknown>>) {
    const legacy = String(row[legacyIdColumn] ?? '');
    const source = String(row[sourceSystemColumn] ?? '');
    keys.add(`${source}|${legacy}`);
  }

  return keys;
}

export async function upsertBatch(input: UpsertBatchInput): Promise<UpsertBatchResult> {
  const { table, rows, config } = input;

  if (rows.length === 0) {
    return {
      inserted: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
      relationPairs: [],
    };
  }

  const legacyIdColumn = config.identityColumns.legacyId;
  const sourceSystemColumn = config.identityColumns.sourceSystem;
  const idColumn = config.identityColumns.id;

  const existingKeys = await findExistingLegacyKeys(
    table,
    rows,
    legacyIdColumn,
    sourceSystemColumn
  );

  const supabase = createAdminClient();
  const sanitizedRows = rows.map(sanitizeRow);

  const relationPairs: Array<{ table: string; legacyId: string; newId: string }> = [];
  let inserted = 0;
  let updated = 0;
  const skipped = 0;
  let failed = 0;
  const errors: RowError[] = [];

  const onConflict = `${sourceSystemColumn},${legacyIdColumn}`;
  const selectFields = `${idColumn}, ${legacyIdColumn}, ${sourceSystemColumn}`;

  const upsertResponse = await upsertWithColumnPruning(
    supabase,
    table,
    sanitizedRows,
    onConflict,
    selectFields
  );

  if (!upsertResponse.error && upsertResponse.data) {
    for (const sourceRow of rows) {
      const sourceSystem = String(sourceRow[sourceSystemColumn] ?? '');
      const legacyId = String(sourceRow[legacyIdColumn] ?? '');
      const key = `${sourceSystem}|${legacyId}`;
      if (existingKeys.has(key)) {
        updated += 1;
      } else {
        inserted += 1;
      }
    }

    for (const persisted of upsertResponse.data as unknown as Array<Record<string, unknown>>) {
      const legacyId = String(persisted[legacyIdColumn] ?? '');
      const newId = String(persisted[idColumn] ?? '');
      if (legacyId && newId) {
        relationPairs.push({ table, legacyId, newId });
      }
    }

    return {
      inserted,
      updated,
      skipped,
      failed,
      errors,
      relationPairs,
    };
  }

  if (!config.tolerantMode) {
    throw new Error(upsertResponse.error?.message || `Bulk upsert failed for table=${table}`);
  }

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    const payload = sanitizeRow(row);

    const rowResponse = await upsertWithColumnPruning(
      supabase,
      table,
      [payload],
      onConflict,
      selectFields
    );

    const rowData = Array.isArray(rowResponse.data) ? rowResponse.data[0] : null;

    if (rowResponse.error || !rowData) {
      const meta = getMeta(row, index);
      failed += 1;
      errors.push({
        table,
        rowIndex: meta.rowIndex,
        legacyId: meta.legacyId,
        error: rowResponse.error?.message || 'Unknown upsert error',
        payload,
      });
      continue;
    }

    const sourceSystem = String(payload[sourceSystemColumn] ?? '');
    const legacyId = String(payload[legacyIdColumn] ?? '');
    const key = `${sourceSystem}|${legacyId}`;

    if (existingKeys.has(key)) {
      updated += 1;
    } else {
      inserted += 1;
    }

    const persistedData = rowData as unknown as Record<string, unknown>;
    const persistedLegacyId = String(persistedData[legacyIdColumn] ?? '');
    const persistedId = String(persistedData[idColumn] ?? '');
    if (persistedLegacyId && persistedId) {
      relationPairs.push({ table, legacyId: persistedLegacyId, newId: persistedId });
    }
  }

  return {
    inserted,
    updated,
    skipped,
    failed,
    errors,
    relationPairs,
  };
}
