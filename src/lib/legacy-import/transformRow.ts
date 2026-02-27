import type { MappingRule, TransformContext } from './types';

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeEmpty(value: unknown): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string' && value.trim() === '') {
    return null;
  }

  return value;
}

function toBoolean(value: unknown): boolean | null {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return null;
  if (['1', 'true', 'yes', 'y', 'si', 'sí'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n'].includes(normalized)) return false;
  throw new Error(`Invalid boolean: ${String(value)}`);
}

function toInteger(value: unknown): number | null {
  const normalized = normalizeEmpty(value);
  if (normalized == null) return null;
  const parsed = Number.parseInt(String(normalized), 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid integer: ${String(value)}`);
  }
  return parsed;
}

function toDecimal(value: unknown): number | null {
  const normalized = normalizeEmpty(value);
  if (normalized == null) return null;
  const parsed = Number(String(normalized).replace(',', '.'));
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid decimal: ${String(value)}`);
  }
  return parsed;
}

function toDateTimeTz(value: unknown): string | null {
  const normalized = normalizeEmpty(value);
  if (normalized == null) return null;

  const raw = String(normalized).trim();
  const hasTimezone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(raw);
  const candidate = hasTimezone ? raw : `${raw}Z`;
  const date = new Date(candidate);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid datetime_tz: ${String(value)}`);
  }

  return date.toISOString();
}

function convertValue(rule: MappingRule, input: unknown): unknown {
  const baseValue = normalizeEmpty(input);
  if (baseValue == null) {
    return null;
  }

  switch (rule.dataType) {
    case 'uuid': {
      const value = String(baseValue).trim();
      if (!uuidRegex.test(value)) {
        throw new Error(`Invalid uuid: ${value}`);
      }
      return value;
    }
    case 'decimal':
      return toDecimal(baseValue);
    case 'integer':
      return toInteger(baseValue);
    case 'boolean':
      return toBoolean(baseValue);
    case 'datetime_tz':
      return toDateTimeTz(baseValue);
    case 'enum': {
      const value = String(baseValue).trim();
      if (rule.enumValues && rule.enumValues.length > 0 && !rule.enumValues.includes(value)) {
        throw new Error(
          `Invalid enum value: ${value}. Allowed=[${rule.enumValues.join(', ')}]`
        );
      }
      return value;
    }
    case 'json': {
      if (typeof baseValue === 'object') {
        return baseValue;
      }

      const strValue = String(baseValue);
      try {
        return JSON.parse(strValue);
      } catch {
        throw new Error(`Invalid json: ${strValue}`);
      }
    }
    case 'string':
      return String(baseValue);
    case 'raw':
    default:
      return baseValue;
  }
}

function detectLegacyId(
  sourceRow: Record<string, unknown>,
  mappedRow: Record<string, unknown>,
  legacyIdColumn: string
): string | null {
  const sourceCandidates = [
    mappedRow[legacyIdColumn],
    sourceRow[legacyIdColumn],
    sourceRow.legacy_id,
    sourceRow.legacyId,
    sourceRow.id,
    sourceRow.ID,
  ];

  for (const candidate of sourceCandidates) {
    if (candidate != null && String(candidate).trim()) {
      return String(candidate).trim();
    }
  }

  return null;
}

export function transformRow(
  sourceRow: Record<string, unknown>,
  context: TransformContext
): Record<string, unknown> {
  const { table, sourceSystem, mapping, config, rowIndex } = context;
  const rules = mapping.bySourceTable[table] || [];

  const transformed: Record<string, unknown> = {};

  if (rules.length === 0) {
    for (const [key, value] of Object.entries(sourceRow)) {
      transformed[key] = normalizeEmpty(value);
    }
  } else {
    for (const rule of rules) {
      const hasSourceField = Object.prototype.hasOwnProperty.call(sourceRow, rule.sourceField);
      const hasTargetField = Object.prototype.hasOwnProperty.call(sourceRow, rule.targetField);
      const rawValue = hasSourceField
        ? sourceRow[rule.sourceField]
        : hasTargetField
          ? sourceRow[rule.targetField]
          : undefined;
      const inputValue = rawValue ?? rule.defaultValue ?? null;
      const converted = convertValue(rule, inputValue);

      if (rule.required && (converted == null || converted === '')) {
        throw new Error(`Required field missing: ${rule.sourceField} -> ${rule.targetField}`);
      }

      transformed[rule.targetField] = converted;
    }
  }

  const legacyIdColumn = config.identityColumns.legacyId;
  const sourceSystemColumn = config.identityColumns.sourceSystem;

  const fallbackLegacyId = `${table}:${rowIndex}`;
  const legacyId = detectLegacyId(sourceRow, transformed, legacyIdColumn) || fallbackLegacyId;

  transformed[legacyIdColumn] = legacyId;
  transformed[sourceSystemColumn] = sourceSystem;
  transformed.__meta_rowIndex = rowIndex;
  transformed.__meta_legacyId = legacyId;

  return transformed;
}
