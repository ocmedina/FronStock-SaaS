import type { IntegrityCheck, TableResult } from './types';

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'));
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function extractExpectedTableCounts(summary?: Record<string, unknown>): Record<string, number> {
  if (!summary) return {};
  const tables = summary.tables;
  if (!tables || typeof tables !== 'object') return {};

  const result: Record<string, number> = {};
  for (const [table, raw] of Object.entries(tables as Record<string, unknown>)) {
    if (typeof raw === 'number') {
      result[table] = raw;
      continue;
    }

    if (raw && typeof raw === 'object') {
      const count = toNumber((raw as Record<string, unknown>).count);
      if (count != null) {
        result[table] = count;
      }
    }
  }

  return result;
}

function extractExpectedTotals(summary?: Record<string, unknown>): Record<string, number> {
  if (!summary) return {};
  const totals = summary.totals;
  if (!totals || typeof totals !== 'object') return {};

  const result: Record<string, number> = {};
  for (const [key, raw] of Object.entries(totals as Record<string, unknown>)) {
    const value = toNumber(raw);
    if (value != null) {
      result[key] = value;
    }
  }

  return result;
}

function buildActualTotals(tableResults: TableResult[]): Record<string, number> {
  const flat: Record<string, number> = {};

  for (const tableResult of tableResults) {
    for (const [key, value] of Object.entries(tableResult.totals)) {
      flat[key] = (flat[key] || 0) + value;
    }
  }

  return {
    ...flat,
    supplier_debt: flat['suppliers.current_balance'] || 0,
    stock_total: flat['products.stock'] || 0,
    sales_total: flat['sales.total'] || 0,
    payments_total:
      (flat['payments.amount'] || 0) +
      (flat['sale_payments.amount'] || 0) +
      (flat['supplier_payments.amount'] || 0),
  };
}

function buildCheck(name: string, expected: number, actual: number): IntegrityCheck {
  const delta = actual - expected;
  const passed = Math.abs(delta) < 0.01;
  return {
    name,
    expected,
    actual,
    passed,
    delta,
    details: passed ? 'OK' : `Mismatch: expected=${expected}, actual=${actual}`,
  };
}

export function validateIntegrity(
  tableResults: TableResult[],
  integritySummary?: Record<string, unknown>
): IntegrityCheck[] {
  const checks: IntegrityCheck[] = [];

  const expectedTableCounts = extractExpectedTableCounts(integritySummary);
  const expectedTotals = extractExpectedTotals(integritySummary);

  for (const [table, expectedCount] of Object.entries(expectedTableCounts)) {
    const result = tableResults.find((item) => item.table === table);
    const actualCount = result ? result.inserted + result.updated + result.skipped : 0;
    checks.push(buildCheck(`count.${table}`, expectedCount, actualCount));
  }

  const actualTotals = buildActualTotals(tableResults);
  for (const [totalName, expectedValue] of Object.entries(expectedTotals)) {
    const actualValue = actualTotals[totalName] ?? 0;
    checks.push(buildCheck(`total.${totalName}`, expectedValue, actualValue));
  }

  return checks;
}
