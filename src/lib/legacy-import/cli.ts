import path from 'node:path';
import process from 'node:process';
import { importLegacyBundle } from './importLegacyBundle';

function parseArgs(argv: string[]) {
  const args = new Map<string, string>();

  for (let index = 0; index < argv.length; index++) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;

    const key = token.slice(2);
    const value = argv[index + 1] && !argv[index + 1].startsWith('--') ? argv[index + 1] : 'true';
    args.set(key, value);

    if (value !== 'true') {
      index += 1;
    }
  }

  return args;
}

function printUsage() {
  console.log('Usage: node import-legacy --bundle ./exports/system_export_xxx');
}

export async function runCli(argv: string[] = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const bundle = args.get('bundle');

  if (!bundle) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const bundlePath = path.resolve(bundle);

  try {
    const result = await importLegacyBundle(bundlePath);
    console.log(
      JSON.stringify(
        {
          status: result.failed > 0 ? 'completed_with_errors' : 'completed',
          bundlePath: result.bundlePath,
          durationMs: result.durationMs,
          inserted: result.inserted,
          updated: result.updated,
          skipped: result.skipped,
          failed: result.failed,
          tablesProcessed: result.tablesProcessed,
          validations: result.validations,
        },
        null,
        2
      )
    );

    process.exitCode = result.failed > 0 ? 2 : 0;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      JSON.stringify(
        {
          status: 'failed',
          error: message,
        },
        null,
        2
      )
    );
    process.exitCode = 1;
  }
}

if (process.argv[1]?.endsWith('/cli.ts') || process.argv[1]?.endsWith('\\cli.ts')) {
  runCli();
}
