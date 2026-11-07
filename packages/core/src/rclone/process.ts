import { spawn, type ChildProcess } from 'node:child_process';
import { access, chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { err, ok, type RcloneStatus, type Result } from '@syncvault/shared';
import { errorMessage, type Logger } from '../log.js';
import { buildRcdLaunch, generateRcCredentials } from './args.js';
import { RcloneClient } from './client.js';

const READY_TIMEOUT_MS = 15_000;
const STOP_TIMEOUT_MS = 5_000;

export interface RcloneProcessOptions {
  binaryPath: string;
  appDataDir: string;
  logger: Logger;
}

/** Asks the OS for a free loopback port. Small race window; start() retries on failure. */
const findFreePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      srv.close(() =>
        typeof addr === 'object' && addr ? resolve(addr.port) : reject(new Error('no port')),
      );
    });
  });

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export class RcloneProcess {
  #child: ChildProcess | null = null;
  #client: RcloneClient | null = null;
  #status: RcloneStatus = { state: 'stopped' };
  readonly #opts: RcloneProcessOptions;
  readonly #rcloneDir: string;
  readonly #pidFile: string;

  constructor(opts: RcloneProcessOptions) {
    this.#opts = opts;
    this.#rcloneDir = path.join(opts.appDataDir, 'rclone');
    this.#pidFile = path.join(this.#rcloneDir, 'rclone.pid');
  }

  get status(): RcloneStatus {
    return this.#status;
  }

  get client(): RcloneClient | null {
    return this.#client;
  }

  async start(): Promise<Result<RcloneStatus, string>> {
    const { logger, binaryPath } = this.#opts;
    this.#status = { state: 'starting' };

    try {
      await access(binaryPath, fsConstants.X_OK);
    } catch {
      this.#status = {
        state: 'missing',
        message: 'rclone binary not found. Run `pnpm fetch:rclone`.',
      };
      return err(this.#status.message);
    }

    await this.#prepareDirs();
    await this.#killStale();

    for (let attempt = 1; attempt <= 3; attempt++) {
      const res = await this.#launch();
      if (res.ok) return res;
      logger.warn('rclone start attempt failed', { attempt, error: res.error });
      await this.stop();
    }
    this.#status = { state: 'error', message: 'rclone failed to start' };
    return err(this.#status.message);
  }

  async #prepareDirs(): Promise<void> {
    await mkdir(this.#rcloneDir, { recursive: true, mode: 0o700 });
    await mkdir(path.join(this.#rcloneDir, 'cache'), { recursive: true, mode: 0o700 });
    const configPath = path.join(this.#rcloneDir, 'rclone.conf');
    // Empty Syncvault-only config. TODO(security): must be encrypted before any remote is added.
    await writeFile(configPath, '', { flag: 'a', mode: 0o600 });
    if (process.platform !== 'win32') await chmod(configPath, 0o600);
  }

  /** Kills an rclone left behind by a hard crash of a previous core. */
  async #killStale(): Promise<void> {
    let pid: number;
    try {
      pid = Number.parseInt(await readFile(this.#pidFile, 'utf8'), 10);
    } catch {
      return;
    }
    if (!Number.isInteger(pid) || pid <= 1) return;
    if (process.platform === 'linux') {
      try {
        const cmdline = await readFile(`/proc/${pid}/cmdline`, 'utf8');
        const argv = cmdline.split('\0');
        const isOurs =
          path.basename(argv[0] ?? '').startsWith('rclone') &&
          argv.includes('rcd') &&
          argv.some((a) => a.startsWith('--config=') && a.includes(this.#rcloneDir));
        if (isOurs) {
          process.kill(pid, 'SIGTERM');
          this.#opts.logger.warn('killed stale rclone from previous run');
        }
      } catch {
        // process gone
      }
    }
    // TODO(cross-platform): verify + kill stale rclone on Windows/macOS.
    await rm(this.#pidFile, { force: true });
  }

  async #launch(): Promise<Result<RcloneStatus, string>> {
    const { logger, binaryPath } = this.#opts;
    const port = await findFreePort();
    const { user, pass } = generateRcCredentials();
    const launch = buildRcdLaunch({
      port,
      configPath: path.join(this.#rcloneDir, 'rclone.conf'),
      cacheDir: path.join(this.#rcloneDir, 'cache'),
      user,
      pass,
      baseEnv: process.env,
    });

    const child = spawn(binaryPath, launch.args, {
      env: launch.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    this.#child = child;
    child.stdout?.on('data', (d: Buffer) =>
      logger.debug('rclone stdout', { line: d.toString().trim() }),
    );
    child.stderr?.on('data', (d: Buffer) => logger.info('rclone: ' + d.toString().trim()));
    child.on('exit', (code, signal) => {
      if (this.#child === child) {
        this.#child = null;
        this.#client = null;
        if (this.#status.state === 'running') {
          this.#status = { state: 'error', message: `rclone exited (${code ?? signal})` };
          logger.error('rclone exited unexpectedly', { code, signal });
          // TODO(sync): restart rclone with backoff once jobs depend on it.
        }
      }
    });
    if (child.pid) await writeFile(this.#pidFile, String(child.pid), { mode: 0o600 });

    const client = new RcloneClient({
      baseUrl: `http://127.0.0.1:${port}`,
      user,
      pass,
      timeoutMs: 5_000,
    });
    const deadline = Date.now() + READY_TIMEOUT_MS;
    while (Date.now() < deadline) {
      if (child.exitCode !== null || child.signalCode !== null)
        return err('rclone exited during startup');
      const res = await client.noop();
      if (res.ok) break;
      if (res.error.code === 'http' && res.error.status === 401)
        return err('rclone rejected credentials');
      await delay(150);
    }
    const version = await client.version();
    if (!version.ok) return err(`core/version failed: ${version.error.message}`);

    this.#client = client;
    this.#status = { state: 'running', version: version.value.version };
    logger.info('rclone running', { version: version.value.version });
    return ok(this.#status);
  }

  /** Stops rclone: core/quit → SIGTERM → SIGKILL. Never leaves an rclone process behind. */
  async stop(): Promise<void> {
    const child = this.#child;
    const client = this.#client;
    this.#status = { state: 'stopped' };
    this.#client = null;
    if (!child || child.exitCode !== null || child.signalCode !== null) {
      this.#child = null;
      await rm(this.#pidFile, { force: true });
      return;
    }
    const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()));
    const waitExit = (ms: number): Promise<boolean> =>
      Promise.race([exited.then(() => true), delay(ms).then(() => false)]);

    if (client) await client.quit().catch(() => undefined);
    if (!(await waitExit(STOP_TIMEOUT_MS))) {
      child.kill('SIGTERM');
      if (!(await waitExit(STOP_TIMEOUT_MS))) {
        child.kill('SIGKILL');
        await waitExit(STOP_TIMEOUT_MS);
      }
    }
    this.#child = null;
    await rm(this.#pidFile, { force: true }).catch((e: unknown) =>
      this.#opts.logger.warn('could not remove rclone pid file', { error: errorMessage(e) }),
    );
  }
}
