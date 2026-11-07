import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline';
import {
  CORE_READY_LINE,
  CoreEnv,
  RpcErrorCode,
  err,
  ok,
  rpcMethods,
  type CoreState,
  type Result,
  type RpcErrorObject,
  type RpcMethodName,
  type RpcResult,
} from '@syncvault/shared';
import { errorMessage, log } from '../log.js';
import { CORE_STABLE_AFTER_MS, MAX_CORE_RESTARTS, restartDelayMs } from './backoff.js';
import { CoreRpcClient } from './rpc-client.js';
import { coreSocketPath } from './socket-path.js';

const READY_TIMEOUT_MS = 15_000;
const SHUTDOWN_TIMEOUT_MS = 12_000;

export interface CoreSupervisorOptions {
  coreScript: string;
  rcloneBinary: string;
  appDataDir: string;
  appVersion: string;
}

/**
 * Spawns the core (Electron binary + ELECTRON_RUN_AS_NODE=1), connects over JSON-RPC,
 * restarts it with backoff if it crashes, and stops it cleanly on quit.
 */
export class CoreSupervisor {
  #child: ChildProcess | null = null;
  #client: CoreRpcClient | null = null;
  #state: CoreState = { state: 'stopped' };
  #listeners = new Set<(s: CoreState) => void>();
  #stopping = false;
  #attempt = 0;
  #startedAt = 0;
  #restartTimer: NodeJS.Timeout | null = null;
  readonly #opts: CoreSupervisorOptions;

  constructor(opts: CoreSupervisorOptions) {
    this.#opts = opts;
  }

  get state(): CoreState {
    return this.#state;
  }

  onState(listener: (s: CoreState) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #setState(state: CoreState): void {
    this.#state = state;
    for (const l of this.#listeners) l(state);
  }

  async start(): Promise<void> {
    this.#stopping = false;
    this.#setState({ state: 'starting' });
    const res = await this.#spawnAndConnect();
    if (res.ok) {
      this.#setState({ state: 'connected' });
      log.info('core connected');
    } else {
      log.error(`core start failed: ${res.error}`);
      this.#killChild();
      this.#scheduleRestart(res.error);
    }
  }

  async #spawnAndConnect(): Promise<Result<void, string>> {
    const token = randomBytes(32).toString('hex');
    const socketPath = coreSocketPath({
      platform: process.platform,
      env: process.env,
      appDataDir: this.#opts.appDataDir,
      randomHex: randomBytes(16).toString('hex'),
    });

    const child = spawn(process.execPath, [this.#opts.coreScript], {
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        [CoreEnv.RpcPath]: socketPath,
        [CoreEnv.RpcToken]: token,
        [CoreEnv.AppDataDir]: this.#opts.appDataDir,
        [CoreEnv.RcloneBinary]: this.#opts.rcloneBinary,
        [CoreEnv.AppVersion]: this.#opts.appVersion,
      },
      // stdin stays open: if main dies, the core sees EOF and shuts down.
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    this.#child = child;
    this.#startedAt = Date.now();

    child.stderr?.on('data', (d: Buffer) => process.stderr.write(d));
    child.on('exit', (code, signal) => this.#onExit(child, code, signal));

    const ready = await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), READY_TIMEOUT_MS);
      const rl = createInterface({ input: child.stdout! });
      rl.on('line', (line) => {
        if (line.trim() === CORE_READY_LINE) {
          clearTimeout(timer);
          resolve(true);
        }
      });
      child.once('exit', () => {
        clearTimeout(timer);
        resolve(false);
      });
    });
    if (!ready) return err('core did not become ready');

    const client = new CoreRpcClient();
    const conn = await client.connect(socketPath, token);
    if (!conn.ok) return err(`could not connect to core: ${conn.error.message}`);
    this.#client = client;
    return ok(undefined);
  }

  #onExit(child: ChildProcess, code: number | null, signal: NodeJS.Signals | null): void {
    if (child !== this.#child) return;
    this.#child = null;
    this.#client?.close();
    this.#client = null;
    if (this.#stopping) return;
    const reason = `core exited unexpectedly (${code ?? signal})`;
    log.error(reason);
    if (Date.now() - this.#startedAt > CORE_STABLE_AFTER_MS) this.#attempt = 0;
    this.#scheduleRestart(reason);
  }

  #scheduleRestart(message: string): void {
    if (this.#stopping || this.#restartTimer) return;
    this.#attempt += 1;
    if (this.#attempt > MAX_CORE_RESTARTS) {
      this.#setState({ state: 'failed', message });
      return;
    }
    this.#setState({
      state: 'restarting',
      attempt: this.#attempt,
      maxAttempts: MAX_CORE_RESTARTS,
      message,
    });
    this.#restartTimer = setTimeout(() => {
      this.#restartTimer = null;
      void this.start();
    }, restartDelayMs(this.#attempt));
  }

  /** Calls a core method and validates the result against the shared schema. */
  async call<M extends RpcMethodName>(
    method: M,
    params?: unknown,
  ): Promise<Result<RpcResult<M>, RpcErrorObject>> {
    if (!this.#client) {
      return err({ code: RpcErrorCode.CoreUnavailable, message: 'Core service is not connected' });
    }
    const res = await this.#client.call(method, params);
    if (!res.ok) return res;
    const parsed = rpcMethods[method].result.safeParse(res.value);
    if (!parsed.success) {
      return err({ code: RpcErrorCode.InternalError, message: 'Invalid response from core' });
    }
    return ok(parsed.data as RpcResult<M>);
  }

  /** Graceful stop: core.shutdown (core stops rclone) → wait → SIGKILL as last resort. */
  async stop(): Promise<void> {
    this.#stopping = true;
    if (this.#restartTimer) clearTimeout(this.#restartTimer);
    this.#restartTimer = null;
    const child = this.#child;
    if (!child) {
      this.#setState({ state: 'stopped' });
      return;
    }
    const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()));
    if (this.#client) {
      await this.#client.call('core.shutdown').catch(() => undefined);
    } else {
      child.stdin?.end();
    }
    const timedOut = await Promise.race([
      exited.then(() => false),
      new Promise<boolean>((r) => setTimeout(() => r(true), SHUTDOWN_TIMEOUT_MS)),
    ]);
    if (timedOut) {
      log.warn('core did not exit in time; killing');
      this.#killChild();
    }
    this.#client?.close();
    this.#client = null;
    this.#child = null;
    this.#setState({ state: 'stopped' });
  }

  #killChild(): void {
    try {
      this.#child?.kill('SIGKILL');
    } catch (e) {
      log.warn(`kill failed: ${errorMessage(e)}`);
    }
  }
}
