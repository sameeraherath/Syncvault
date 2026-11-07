/** Main-process logger (stderr). Never log secrets, tokens or full user-content paths. */
export const log = {
  info: (msg: string): void => void process.stderr.write(`INFO [main] ${msg}\n`),
  warn: (msg: string): void => void process.stderr.write(`WARN [main] ${msg}\n`),
  error: (msg: string): void => void process.stderr.write(`ERROR [main] ${msg}\n`),
};

export const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e));
