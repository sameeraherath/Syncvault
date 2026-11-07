/**
 * Minimal logger. Writes to stderr only (stdout is reserved for the ready signal).
 * NEVER pass secrets, tokens, passwords, keys or full user-content paths at info level.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface Logger {
  debug(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
}

export const createLogger = (
  scope: string,
  minLevel: LogLevel = 'info',
  write: (line: string) => void = (line) => process.stderr.write(line + '\n'),
): Logger => {
  const log =
    (level: LogLevel) =>
    (msg: string, fields?: Record<string, unknown>): void => {
      if (ORDER[level] < ORDER[minLevel]) return;
      const suffix = fields ? ' ' + JSON.stringify(fields) : '';
      write(`${new Date().toISOString()} ${level.toUpperCase()} [${scope}] ${msg}${suffix}`);
    };
  return { debug: log('debug'), info: log('info'), warn: log('warn'), error: log('error') };
};

export const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e));
