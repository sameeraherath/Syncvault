import path from 'node:path';
import {
  CORE_READY_LINE,
  rpcMethods,
  type DatabaseStatus,
  type StatusGetResult,
} from '@syncvault/shared';
import { readCoreConfig } from './env.js';
import { createLogger, errorMessage } from './log.js';
import { openDatabase, type Database } from './db/database.js';
import { listAccounts } from './db/accounts.js';
import { listHistory } from './db/history.js';
import { listFiles } from './files/list.js';
import { RcloneProcess } from './rclone/process.js';
import { startRpcServer, type RpcServer } from './rpc/server.js';

/**
 * Syncvault core service. Spawned by Electron main with ELECTRON_RUN_AS_NODE=1.
 * stdout: only the ready line. stderr: logs. stdin: EOF means main is gone → shut down.
 */
const main = async (): Promise<void> => {
  // Everything the core creates (DB, WAL, rclone config, pid file) is private to the user.
  process.umask(0o077);
  const config = readCoreConfig();
  const logger = createLogger('core', config.logLevel);
  logger.info('starting', { version: __CORE_VERSION__, platform: process.platform });

  let db: Database | null = null;
  let database: DatabaseStatus;
  try {
    const opened = openDatabase(path.join(config.appDataDir, 'syncvault.db'));
    db = opened.db;
    database = { state: 'ready', schemaVersion: opened.schemaVersion };
  } catch (e) {
    logger.error('database failed to open', { error: errorMessage(e) });
    database = { state: 'error', message: errorMessage(e) };
  }

  const rclone = new RcloneProcess({
    binaryPath: config.rcloneBinary,
    appDataDir: config.appDataDir,
    logger: createLogger('rclone', config.logLevel),
  });

  let rpc: RpcServer | null = null;
  let shuttingDown = false;
  const shutdown = async (code = 0): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('shutting down');
    await rclone
      .stop()
      .catch((e: unknown) => logger.error('rclone stop failed', { error: errorMessage(e) }));
    await rpc?.close().catch(() => undefined);
    db?.close();
    process.exit(code);
  };

  rpc = await startRpcServer({
    path: config.rpcPath,
    token: config.rpcToken,
    logger,
    handlers: {
      'status.get': (): StatusGetResult => ({
        appVersion: config.appVersion,
        coreVersion: __CORE_VERSION__,
        platform: process.platform,
        arch: process.arch,
        rclone: rclone.status,
        database,
      }),
      'history.list': (params) => {
        // Throwing here is fine: the dispatcher turns it into an InternalError response,
        // and the status card already shows why the database is unavailable.
        if (!db) throw new Error('database unavailable');
        const limit = rpcMethods['history.list'].params.parse(params)?.limit;
        return { entries: listHistory(db, limit) };
      },
      'accounts.list': () => {
        if (!db) throw new Error('database unavailable');
        return { accounts: listAccounts(db) };
      },
      'files.list': (params) => {
        if (!db) throw new Error('database unavailable');
        return listFiles(
          { db, rclone: rclone.client },
          rpcMethods['files.list'].params.parse(params),
        );
      },
      'core.shutdown': () => {
        setImmediate(() => void shutdown(0));
        return { ok: true as const };
      },
    },
  });

  process.stdout.write(CORE_READY_LINE + '\n');

  // If main dies (even SIGKILL), our stdin pipe closes → stop rclone and exit.
  process.stdin.resume();
  process.stdin.on('end', () => void shutdown(0));
  process.on('SIGTERM', () => void shutdown(0));
  process.on('SIGINT', () => void shutdown(0));

  void rclone.start().then((res) => {
    if (!res.ok) logger.warn('rclone not running', { reason: res.error });
  });
};

main().catch((e: unknown) => {
  process.stderr.write(`FATAL [core] ${errorMessage(e)}\n`);
  process.exit(1);
});
