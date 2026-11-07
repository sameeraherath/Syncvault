import net from 'node:net';
import {
  JSONRPC_VERSION,
  RPC_MAX_MESSAGE_BYTES,
  RpcErrorCode,
  err,
  ok,
  rpcResponseSchema,
  type Result,
  type RpcErrorObject,
  type RpcMethodName,
} from '@syncvault/shared';

const CALL_TIMEOUT_MS = 10_000;

interface Pending {
  resolve: (r: Result<unknown, RpcErrorObject>) => void;
  timer: NodeJS.Timeout;
}

/** JSON-RPC 2.0 client over a Unix socket / named pipe (newline-delimited JSON). */
export class CoreRpcClient {
  #socket: net.Socket | null = null;
  #nextId = 1;
  #pending = new Map<number, Pending>();
  #buffer = '';
  #onClose: (() => void) | null = null;

  /** Connects and authenticates with the per-start token. */
  async connect(socketPath: string, token: string): Promise<Result<void, RpcErrorObject>> {
    const socket = await new Promise<net.Socket | Error>((resolve) => {
      const s = net.createConnection(socketPath);
      s.once('connect', () => resolve(s));
      s.once('error', (e) => resolve(e));
    });
    if (socket instanceof Error) {
      return err({ code: RpcErrorCode.CoreUnavailable, message: socket.message });
    }
    this.#socket = socket;
    socket.setEncoding('utf8');
    socket.on('data', (chunk: string) => this.#onData(chunk));
    socket.on('error', () => socket.destroy());
    socket.on('close', () => {
      this.#socket = null;
      this.#failAll('Connection to core closed');
      this.#onClose?.();
    });

    const auth = await this.call('auth.hello', { token });
    return auth.ok ? ok(undefined) : err(auth.error);
  }

  onClose(listener: () => void): void {
    this.#onClose = listener;
  }

  call(method: RpcMethodName, params?: unknown): Promise<Result<unknown, RpcErrorObject>> {
    const socket = this.#socket;
    if (!socket) {
      return Promise.resolve(
        err({ code: RpcErrorCode.CoreUnavailable, message: 'Core not connected' }),
      );
    }
    const id = this.#nextId++;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        resolve(err({ code: RpcErrorCode.Timeout, message: `${method} timed out` }));
      }, CALL_TIMEOUT_MS);
      this.#pending.set(id, { resolve, timer });
      const msg = {
        jsonrpc: JSONRPC_VERSION,
        id,
        method,
        ...(params === undefined ? {} : { params }),
      };
      socket.write(JSON.stringify(msg) + '\n');
    });
  }

  close(): void {
    this.#onClose = null;
    this.#socket?.destroy();
    this.#socket = null;
  }

  #onData(chunk: string): void {
    this.#buffer += chunk;
    if (this.#buffer.length > RPC_MAX_MESSAGE_BYTES) {
      this.#socket?.destroy();
      return;
    }
    const lines = this.#buffer.split(/\r?\n/);
    this.#buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      let json: unknown;
      try {
        json = JSON.parse(line);
      } catch {
        continue;
      }
      const res = rpcResponseSchema.safeParse(json);
      if (!res.success || typeof res.data.id !== 'number') continue;
      const pending = this.#pending.get(res.data.id);
      if (!pending) continue;
      this.#pending.delete(res.data.id);
      clearTimeout(pending.timer);
      pending.resolve('error' in res.data ? err(res.data.error) : ok(res.data.result));
    }
  }

  #failAll(message: string): void {
    for (const [id, p] of this.#pending) {
      clearTimeout(p.timer);
      p.resolve(err({ code: RpcErrorCode.CoreUnavailable, message }));
      this.#pending.delete(id);
    }
  }
}
