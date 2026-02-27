import type { LogLevel, StructuredLog } from './types';

const levelOrder: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const minLevel = (process.env.LEGACY_IMPORT_LOG_LEVEL as LogLevel | undefined) ?? 'info';

export function log(level: LogLevel, event: string, context?: Record<string, unknown>) {
  if (levelOrder[level] < levelOrder[minLevel]) {
    return;
  }

  const entry: StructuredLog = {
    ts: new Date().toISOString(),
    level,
    event,
    context,
  };

  const line = JSON.stringify(entry);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}
