import test from 'node:test';
import assert from 'node:assert/strict';
import { transformRow } from './transformRow';
import type { MappingDefinition, TransformContext } from './types';

function makeContext(mapping: MappingDefinition): TransformContext {
  return {
    table: 'customers',
    sourceSystem: 'legacy_pos',
    rowIndex: 0,
    mapping,
    config: {
      batchSize: 100,
      tolerantMode: true,
      sourceSystemFallback: 'legacy_pos',
      identityColumns: {
        legacyId: 'legacy_id',
        sourceSystem: 'source_system',
        id: 'id',
      },
      importOrderFallback: [],
    },
  };
}

test('transformRow converts types and injects traceability columns', () => {
  const mapping: MappingDefinition = {
    bySourceTable: {
      customers: [
        {
          sourceTable: 'customers',
          sourceField: 'id',
          targetTable: 'customers',
          targetField: 'legacy_id',
          dataType: 'string',
          required: true,
        },
        {
          sourceTable: 'customers',
          sourceField: 'balance',
          targetTable: 'customers',
          targetField: 'balance',
          dataType: 'decimal',
          required: false,
        },
        {
          sourceTable: 'customers',
          sourceField: 'is_active',
          targetTable: 'customers',
          targetField: 'is_active',
          dataType: 'boolean',
          required: false,
        },
      ],
    },
    byTargetTable: {},
  };

  const output = transformRow(
    {
      id: 'CUST-1',
      balance: '1200.50',
      is_active: 'true',
    },
    makeContext(mapping)
  );

  assert.equal(output.legacy_id, 'CUST-1');
  assert.equal(output.source_system, 'legacy_pos');
  assert.equal(output.balance, 1200.5);
  assert.equal(output.is_active, true);
});

test('transformRow validates enum values', () => {
  const mapping: MappingDefinition = {
    bySourceTable: {
      customers: [
        {
          sourceTable: 'customers',
          sourceField: 'id',
          targetTable: 'customers',
          targetField: 'legacy_id',
          dataType: 'string',
          required: true,
        },
        {
          sourceTable: 'customers',
          sourceField: 'state',
          targetTable: 'customers',
          targetField: 'state',
          dataType: 'enum',
          enumValues: ['active', 'inactive'],
          required: true,
        },
      ],
    },
    byTargetTable: {},
  };

  assert.throws(() =>
    transformRow(
      {
        id: 'CUST-2',
        state: 'archived',
      },
      makeContext(mapping)
    )
  );
});
