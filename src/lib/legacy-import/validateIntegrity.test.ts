import test from 'node:test';
import assert from 'node:assert/strict';
import { validateIntegrity } from './validateIntegrity';
import type { TableResult } from './types';

function tableResult(partial: Partial<TableResult>): TableResult {
  return {
    table: partial.table || 'customers',
    sourceRows: partial.sourceRows ?? 0,
    processedRows: partial.processedRows ?? 0,
    inserted: partial.inserted ?? 0,
    updated: partial.updated ?? 0,
    skipped: partial.skipped ?? 0,
    failed: partial.failed ?? 0,
    durationMs: partial.durationMs ?? 0,
    rowErrors: partial.rowErrors ?? [],
    totals: partial.totals ?? {},
  };
}

test('validateIntegrity compares table counts and totals', () => {
  const results: TableResult[] = [
    tableResult({
      table: 'customers',
      inserted: 10,
      updated: 2,
      totals: { 'customers.balance': 1500 },
    }),
    tableResult({
      table: 'sales',
      inserted: 5,
      updated: 0,
      totals: { 'sales.total': 12000 },
    }),
    tableResult({
      table: 'supplier_payments',
      inserted: 2,
      totals: { 'supplier_payments.amount': 800 },
    }),
  ];

  const checks = validateIntegrity(results, {
    tables: {
      customers: { count: 12 },
      sales: { count: 5 },
    },
    totals: {
      sales_total: 12000,
      payments_total: 800,
    },
  });

  const failed = checks.filter((c) => !c.passed);
  assert.equal(failed.length, 0);
});
