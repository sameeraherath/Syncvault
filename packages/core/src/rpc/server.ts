import { chmod, mkdir, rm } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { RPC_MAX_MESSAGE_BYTES } from '@syncvault/shared';
import type { Logger } from '../log.js';
import { dispatchMessage, type ConnectionState, type RpcHandlers } from './dispatcher.js';

const AUTH_TIMEOUT_MS = 5_000;

export interface RpcServerOptions {
  /** Unix socket path, or `\\.\pipe\…` on Windows. */
  path: string;
  token: string;
  handlers: RpcHandlers;
  logger: Logger;
}

export interface RpcServer {
  close(): Promise<void>;
}

const isWindowsPipe = (p: string): boolean => p.startsWith('\\\\.\\pipe\\');

/**
 * Prepares the socket location: private directory (0700) and removal of a stale socket left
 * by a crash. Safe because the single-instance lock guarantees no other live core uses it.
 */
const prepareSocketPath = async (socketPath: string): Promise<void> => {
  if (isWindowsPipe(socketPath)) return;
  await mkdir(path.dirname(socketPath), { recursive: true, mode: 0o700 });
  await chmod(path.dirname(socketPath), 0o700);
  await rm(socketPath, { force: true });
};

export const startRpcServer = async (opts: RpcServerOptions): Promise<RpcServer> => {
  const { logger } = opts;
  await prepareSocketPath(opts.path);

  const sockets = new Set<net.Socket>();

  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.setEncoding('utf8');
    const state: ConnectionState = { authenticated: false };
    let buffer = '';
    let queue: Promise<void> = Promise.resolve();

    const authTimer = setTimeout(() => {
      if (!state.authenticated) socket.destroy();
    }, AUTH_TIMEOUT_MS);

    const handleLine = async (line: string): Promise<void> => {
      if (line.trim() === '' || socket.destroyed) return;
      const out = await dispatchMessage(line, state, opts.token, opts.handlers, logger);
      if (out.response && !socket.destroyed) socket.write(JSON.stringify(out.response) + '\n');
      if (out.close) socket.end();
    };

    socket.on('data', (chunk: string) => {
      buffer += chunk;
      if (Buffer.byteLength(buffer, 'utf8') > RPC_MAX_MESSAGE_BYTES) {
        logger.warn('RPC message too large; closing connection');
        socket.destroy();
        return;
      }
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        // Process sequentially so responses keep request order.
        queue = queue.then(() => handleLine(line));
      }
    });
    socket.on('error', () => socket.destroy());
    socket.on('close', () => {
      clearTimeout(authTimer);
      sockets.delete(socket);
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(opts.path, () => {
      server.off('error', reject);
      resolve();
    });
  });
  if (!isWindowsPipe(opts.path)) await chmod(opts.path, 0o600);
  logger.info('RPC server listening');

  return {
    close: async () => {
      for (const s of sockets) s.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      if (!isWindowsPipe(opts.path)) await rm(opts.path, { force: true });
    },
  };
};
