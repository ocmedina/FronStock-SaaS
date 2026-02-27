import type { ImportResult, IntegrityCheck, RowError, TableResult } from './types';

export function buildReport(input: {
  sourceSystem: string;
  bundlePath: string;
  startedAt: Date;
  finishedAt: Date;
  tableResults: TableResult[];
  validations: IntegrityCheck[];
  errors: RowError[];
  importOrder: string[];
  availableTables: string[];
  tolerantMode: boolean;
  batchSize: number;
}): ImportResult {
  const inserted = input.tableResults.reduce((sum, item) => sum + item.inserted, 0);
  const updated = input.tableResults.reduce((sum, item) => sum + item.updated, 0);
  const skipped = input.tableResults.reduce((sum, item) => sum + item.skipped, 0);
  const failed = input.tableResults.reduce((sum, item) => sum + item.failed, 0);

  return {
    sourceSystem: input.sourceSystem,
    bundlePath: input.bundlePath,
    startedAt: input.startedAt.toISOString(),
    finishedAt: input.finishedAt.toISOString(),
    durationMs: input.finishedAt.getTime() - input.startedAt.getTime(),
    inserted,
    updated,
    skipped,
    failed,
    tablesProcessed: input.tableResults.length,
    tableResults: input.tableResults,
    validations: input.validations,
    errors: input.errors,
    metadata: {
      importOrder: input.importOrder,
      availableTables: input.availableTables,
      tolerantMode: input.tolerantMode,
      batchSize: input.batchSize,
    },
  };
}
