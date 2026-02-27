import fs from 'node:fs/promises';
import * as XLSX from 'xlsx';
import { log } from './logger';
import type { MappingDefinition, MappingRule, TransformDataType } from './types';

const HEADER_ALIASES: Record<string, string[]> = {
  sourceTable: ['source_table', 'table', 'sourceTable'],
  sourceField: ['source_field', 'source_column', 'sourceField', 'column'],
  targetTable: ['target_table', 'destination_table', 'targetTable'],
  targetField: ['target_field', 'destination_field', 'targetField'],
  dataType: ['data_type', 'type', 'dataType'],
  required: ['required', 'is_required'],
  defaultValue: ['default', 'default_value', 'defaultValue'],
  enumValues: ['enum_values', 'enum', 'allowed_values'],
  relationTable: ['relation_table', 'fk_table', 'lookup_table'],
};

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function parseBoolean(value: unknown): boolean {
  const normalized = String(value ?? '').trim().toLowerCase();
  return ['1', 'true', 'yes', 'y', 'si', 'sí'].includes(normalized);
}

function parseDataType(value: unknown): TransformDataType {
  const normalized = String(value ?? 'raw').trim().toLowerCase();
  const known: TransformDataType[] = [
    'string',
    'uuid',
    'decimal',
    'integer',
    'boolean',
    'datetime_tz',
    'enum',
    'json',
    'raw',
  ];

  return known.includes(normalized as TransformDataType)
    ? (normalized as TransformDataType)
    : 'raw';
}

function getField(record: Record<string, unknown>, aliasKey: keyof typeof HEADER_ALIASES): string {
  const aliases = HEADER_ALIASES[aliasKey];
  for (const alias of aliases) {
    const targetKey = Object.keys(record).find((key) => normalizeKey(key) === normalizeKey(alias));
    if (targetKey && record[targetKey] != null && String(record[targetKey]).trim() !== '') {
      return String(record[targetKey]).trim();
    }
  }
  return '';
}

function buildRule(record: Record<string, unknown>): MappingRule | null {
  const sourceTable = getField(record, 'sourceTable');
  const sourceField = getField(record, 'sourceField');
  const targetTable = getField(record, 'targetTable') || sourceTable;
  const targetField = getField(record, 'targetField');

  if (!sourceTable || !sourceField || !targetTable || !targetField) {
    return null;
  }

  const enumRaw = getField(record, 'enumValues');
  const enumValues = enumRaw
    ? enumRaw
        .split(/[|,]/g)
        .map((v) => v.trim())
        .filter(Boolean)
    : undefined;

  return {
    sourceTable,
    sourceField,
    targetTable,
    targetField,
    dataType: parseDataType(getField(record, 'dataType')),
    required: parseBoolean(getField(record, 'required')),
    defaultValue: getField(record, 'defaultValue') || undefined,
    enumValues,
    relationTable: getField(record, 'relationTable') || undefined,
  };
}

export async function parseMapping(mappingPath?: string): Promise<MappingDefinition> {
  const definition: MappingDefinition = {
    bySourceTable: {},
    byTargetTable: {},
  };

  if (!mappingPath) {
    log('warn', 'mapping.missing', { reason: 'mapping_template.csv not found' });
    return definition;
  }

  await fs.access(mappingPath);

  const workbook = XLSX.readFile(mappingPath, { raw: false, cellDates: false });
  const firstSheet = workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[firstSheet], {
    defval: '',
  });

  for (const record of rows) {
    const rule = buildRule(record);
    if (!rule) {
      continue;
    }

    if (!definition.bySourceTable[rule.sourceTable]) {
      definition.bySourceTable[rule.sourceTable] = [];
    }

    if (!definition.byTargetTable[rule.targetTable]) {
      definition.byTargetTable[rule.targetTable] = [];
    }

    definition.bySourceTable[rule.sourceTable].push(rule);
    definition.byTargetTable[rule.targetTable].push(rule);
  }

  log('info', 'mapping.loaded', {
    path: mappingPath,
    sourceTables: Object.keys(definition.bySourceTable).length,
    rules: Object.values(definition.bySourceTable).reduce((sum, rules) => sum + rules.length, 0),
  });

  return definition;
}
