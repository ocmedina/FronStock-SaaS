import fs from 'node:fs/promises';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { log } from './logger';
import type { ImportConfig, LegacyBundle } from './types';

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonFile(
  filePath: string,
  options?: { tolerant?: boolean }
): Promise<Record<string, unknown> | undefined> {
  if (!(await fileExists(filePath))) {
    return undefined;
  }

  const content = await fs.readFile(filePath, 'utf-8');
  const trimmed = content.trim();

  if (!trimmed) {
    if (options?.tolerant) {
      log('warn', 'bundle.json.empty', { filePath });
      return undefined;
    }
    throw new Error(`JSON vacío en archivo: ${filePath}`);
  }

  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (options?.tolerant) {
      log('warn', 'bundle.json.invalid', { filePath, error: message });
      return undefined;
    }
    throw new Error(`JSON inválido en archivo ${filePath}: ${message}`);
  }
}

function parseCsvLikeFile(filePath: string): Array<Record<string, unknown>> {
  const workbook = XLSX.readFile(filePath, { raw: false, cellDates: false });
  const firstSheet = workbook.SheetNames[0];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[firstSheet], {
    defval: null,
  });
}

function parseXlsxSheets(filePath: string): Record<string, Array<Record<string, unknown>>> {
  const workbook = XLSX.readFile(filePath, { raw: false, cellDates: false });
  const bySheet: Record<string, Array<Record<string, unknown>>> = {};

  for (const sheetName of workbook.SheetNames) {
    bySheet[sheetName] = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], {
      defval: null,
    });
  }

  return bySheet;
}

async function listTableFilesByDir(
  dirPath: string,
  extension: '.csv' | '.json'
): Promise<Record<string, string>> {
  if (!(await fileExists(dirPath))) {
    return {};
  }

  const entries = await fs.readdir(dirPath);
  const byTable: Record<string, string> = {};

  for (const entry of entries) {
    if (!entry.toLowerCase().endsWith(extension)) {
      continue;
    }

    const table = path.basename(entry, extension);
    byTable[table] = path.join(dirPath, entry);
  }

  return byTable;
}

async function listTableFilesAtRoot(
  bundlePath: string,
  extension: '.csv' | '.json'
): Promise<Record<string, string>> {
  const entries = await fs.readdir(bundlePath);
  const excluded = new Set([
    `mapping_template${extension}`,
    `integrity_summary${extension}`,
    `export_report${extension}`,
  ]);

  const byTable: Record<string, string> = {};
  for (const entry of entries) {
    if (!entry.toLowerCase().endsWith(extension)) {
      continue;
    }

    if (excluded.has(entry.toLowerCase())) {
      continue;
    }

    const table = path.basename(entry, extension);
    byTable[table] = path.join(bundlePath, entry);
  }

  return byTable;
}

async function loadImportOrder(bundlePath: string, config: ImportConfig): Promise<string[]> {
  const importOrderPath = path.join(bundlePath, 'import_order.txt');
  if (!(await fileExists(importOrderPath))) {
    return config.importOrderFallback;
  }

  const raw = await fs.readFile(importOrderPath, 'utf-8');
  const lines = raw
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));

  const normalized = lines
    .map((line) => line.replace(/\.(csv|json|xlsx)$/i, ''))
    .map((line) => line.toLowerCase())
    .filter(Boolean);

  return normalized.length > 0 ? normalized : config.importOrderFallback;
}

function detectSourceSystem(
  exportReport: Record<string, unknown> | undefined,
  config: ImportConfig
): string {
  const candidates = [
    exportReport?.source_system,
    exportReport?.sourceSystem,
    exportReport?.system,
    exportReport?.origin,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return config.sourceSystemFallback;
}

export async function loadBundle(bundlePath: string, config: ImportConfig): Promise<LegacyBundle> {
  const absolutePath = path.resolve(bundlePath);
  if (!(await fileExists(absolutePath))) {
    throw new Error(`Bundle path does not exist: ${absolutePath}`);
  }

  const csvDir = path.join(absolutePath, 'csv');
  const jsonDir = path.join(absolutePath, 'json');
  const csvFilesFromDir = await listTableFilesByDir(csvDir, '.csv');
  const jsonFilesFromDir = await listTableFilesByDir(jsonDir, '.json');
  const csvFilesFromRoot = await listTableFilesAtRoot(absolutePath, '.csv');
  const jsonFilesFromRoot = await listTableFilesAtRoot(absolutePath, '.json');

  const csvFiles = { ...csvFilesFromRoot, ...csvFilesFromDir };
  const jsonFiles = { ...jsonFilesFromRoot, ...jsonFilesFromDir };

  const tableData: Record<string, Array<Record<string, unknown>>> = {};

  const allTablesXlsxPath = path.join(absolutePath, 'all_tables.xlsx');
  const xlsxData = (await fileExists(allTablesXlsxPath)) ? parseXlsxSheets(allTablesXlsxPath) : {};

  const tableNames = new Set<string>([
    ...Object.keys(csvFiles),
    ...Object.keys(jsonFiles),
    ...Object.keys(xlsxData),
  ]);

  for (const table of tableNames) {
    if (csvFiles[table]) {
      tableData[table] = parseCsvLikeFile(csvFiles[table]);
      continue;
    }

    if (jsonFiles[table]) {
      const jsonContent = await readJsonFile(jsonFiles[table], { tolerant: true });
      if (Array.isArray(jsonContent)) {
        tableData[table] = jsonContent as Array<Record<string, unknown>>;
      } else {
        const rows = (jsonContent?.rows ?? jsonContent?.data) as unknown;
        tableData[table] = Array.isArray(rows) ? (rows as Array<Record<string, unknown>>) : [];
      }
      continue;
    }

    if (xlsxData[table]) {
      tableData[table] = xlsxData[table];
    }
  }

  const mappingCsvPath = path.join(absolutePath, 'mapping_template.csv');
  const integritySummary = await readJsonFile(path.join(absolutePath, 'integrity_summary.json'), {
    tolerant: true,
  });
  const exportReport = await readJsonFile(path.join(absolutePath, 'export_report.json'), {
    tolerant: true,
  });
  const importOrder = await loadImportOrder(absolutePath, config);

  const sourceSystem = detectSourceSystem(exportReport, config);
  const availableTables = Object.keys(tableData);

  log('info', 'bundle.loaded', {
    bundlePath: absolutePath,
    availableTables,
    hasMapping: await fileExists(mappingCsvPath),
    hasIntegritySummary: Boolean(integritySummary),
    sourceSystem,
  });

  return {
    bundlePath: absolutePath,
    tableData,
    availableTables,
    mappingCsvPath: (await fileExists(mappingCsvPath)) ? mappingCsvPath : undefined,
    integritySummary,
    importOrder,
    exportReport,
    sourceSystem,
  };
}
