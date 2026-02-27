import type { MappingDefinition, RelationDictionary } from './types';

class LegacyRelationDictionary implements RelationDictionary {
  private map = new Map<string, Map<string, string>>();

  set(table: string, legacyId: string, newId: string) {
    if (!this.map.has(table)) {
      this.map.set(table, new Map<string, string>());
    }

    this.map.get(table)?.set(String(legacyId), String(newId));
  }

  get(table: string, legacyId: string) {
    return this.map.get(table)?.get(String(legacyId));
  }
}

export function createRelationDictionary(): RelationDictionary {
  return new LegacyRelationDictionary();
}

export function resolveRelations(
  table: string,
  row: Record<string, unknown>,
  mapping: MappingDefinition,
  relationDictionary: RelationDictionary
): Record<string, unknown> {
  const rules = mapping.byTargetTable[table] || [];
  const nextRow = { ...row };

  for (const rule of rules) {
    if (!rule.relationTable) {
      continue;
    }

    const currentValue = nextRow[rule.targetField];
    if (currentValue == null || currentValue === '') {
      continue;
    }

    const resolved = relationDictionary.get(rule.relationTable, String(currentValue));
    if (!resolved) {
      throw new Error(
        `FK unresolved: table=${table}, field=${rule.targetField}, relationTable=${rule.relationTable}, legacyId=${String(currentValue)}`
      );
    }

    nextRow[rule.targetField] = resolved;
  }

  return nextRow;
}
