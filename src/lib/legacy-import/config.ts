import { SUPPORTED_TABLES, type ImportConfig } from './types';

export function getImportConfig(): ImportConfig {
  const batchSizeFromEnv = Number(process.env.LEGACY_IMPORT_BATCH_SIZE || 500);
  const tolerantModeFromEnv = process.env.LEGACY_IMPORT_TOLERANT;

  return {
    batchSize: Number.isFinite(batchSizeFromEnv) && batchSizeFromEnv > 0 ? batchSizeFromEnv : 500,
    tolerantMode: tolerantModeFromEnv ? tolerantModeFromEnv.toLowerCase() === 'true' : true,
    sourceSystemFallback: process.env.LEGACY_IMPORT_SOURCE_SYSTEM || 'legacy_system',
    identityColumns: {
      legacyId: process.env.LEGACY_IMPORT_LEGACY_ID_COLUMN || 'legacy_id',
      sourceSystem: process.env.LEGACY_IMPORT_SOURCE_SYSTEM_COLUMN || 'source_system',
      id: process.env.LEGACY_IMPORT_ID_COLUMN || 'id',
    },
    importOrderFallback: [...SUPPORTED_TABLES],
  };
}
