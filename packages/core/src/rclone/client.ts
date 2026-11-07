import { z } from 'zod';
import { err, ok, type Result } from '@syncvault/shared';

/** Typed client for the rclone rc HTTP API (https://rclone.org/rc/). */

export interface RcloneClientOptions {
  /** e.g. http://127.0.0.1:53682 — must be loopback. */
  baseUrl: string;
  user: string;
  pass: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export type RcloneErrorCode = 'invalid_method' | 'http' | 'network' | 'timeout' | 'bad_response';

export interface RcloneError {
  code: RcloneErrorCode;
  message: string;
  status?: number;
}

export const coreVersionSchema = z.object({
  version: z.string(),
  decomposed: z.array(z.number()).optional(),
  os: z.string().optional(),
  arch: z.string().optional(),
  goVersion: z.string().optional(),
});
export type RcloneCoreVersion = z.infer<typeof coreVersionSchema>;

/** rc method names look like `core/version`, `sync/bisync`, `operations/list`. */
const RC_METHOD_RE = /^[a-z]+(\/[a-zA-Z0-9]+)+$/;

const LOOPBACK_RE = /^http:\/\/127\.0\.0\.1:\d{1,5}$/;

export class RcloneClient {
  readonly #baseUrl: string;
  readonly #authHeader: string;
  readonly #fetch: typeof fetch;
  readonly #timeoutMs: number;

  constructor(opts: RcloneClientOptions) {
    if (!LOOPBACK_RE.test(opts.baseUrl)) {
      throw new Error('rclone rc must listen on 127.0.0.1');
    }
    this.#baseUrl = opts.baseUrl;
    this.#authHeader =
      'Basic ' + Buffer.from(`${opts.user}:${opts.pass}`, 'utf8').toString('base64');
    this.#fetch = opts.fetchImpl ?? fetch;
    this.#timeoutMs = opts.timeoutMs ?? 30_000;
  }

  async call<S extends z.ZodType>(
    method: string,
    params: Record<string, unknown>,
    schema: S,
  ): Promise<Result<z.output<S>, RcloneError>> {
    if (!RC_METHOD_RE.test(method)) {
      return err({ code: 'invalid_method', message: `Invalid rc method: ${method}` });
    }
    let res: Response;
    try {
      res = await this.#fetch(`${this.#baseUrl}/${method}`, {
        method: 'POST',
        headers: { Authorization: this.#authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
        signal: AbortSignal.timeout(this.#timeoutMs),
      });
    } catch (e) {
      const timeout = e instanceof Error && e.name === 'TimeoutError';
      return err({
        code: timeout ? 'timeout' : 'network',
        message: e instanceof Error ? e.message : String(e),
      });
    }
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = undefined;
    }
    if (!res.ok) {
      const message =
        typeof body === 'object' && body !== null && 'error' in body
          ? String((body as { error: unknown }).error)
          : `HTTP ${res.status}`;
      return err({ code: 'http', status: res.status, message });
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) return err({ code: 'bad_response', message: 'Unexpected rc response' });
    return ok(parsed.data);
  }

  noop(): Promise<Result<unknown, RcloneError>> {
    return this.call('rc/noop', {}, z.unknown());
  }

  version(): Promise<Result<RcloneCoreVersion, RcloneError>> {
    return this.call('core/version', {}, coreVersionSchema);
  }

  /** Asks rclone to exit. The connection may drop before a response arrives. */
  quit(): Promise<Result<unknown, RcloneError>> {
    return this.call('core/quit', {}, z.unknown());
  }
}
