import { describe, expect, it, vi } from 'vitest';
import { RpcErrorCode } from '@syncvault/shared';
import { createLogger } from '../log.js';
import { dispatchMessage, tokensEqual, type RpcHandlers } from './dispatcher.js';

const TOKEN = 'a'.repeat(64);
const logger = createLogger('test', 'error', () => {});

const handlers: RpcHandlers = {
  'status.get': vi.fn(() => ({
    appVersion: '0.1.0',
    coreVersion: '0.1.0',
    platform: 'linux',
    arch: 'x64',
    rclone: { state: 'starting' as const },
    database: { state: 'ready' as const, schemaVersion: 1 },
  })),
  'history.list': vi.fn(() => ({ entries: [] })),
  'core.shutdown': vi.fn(() => ({ ok: true as const })),
};

const msg = (method: string, params?: unknown, id = 1): string =>
  JSON.stringify({ jsonrpc: '2.0', id, method, ...(params === undefined ? {} : { params }) });

describe('dispatchMessage', () => {
  it('rejects any method before authentication and closes the connection', async () => {
    const state = { authenticated: false };
    const out = await dispatchMessage(msg('status.get'), state, TOKEN, handlers, logger);
    expect(out.close).toBe(true);
    expect(out.response).toMatchObject({ error: { code: RpcErrorCode.Unauthorized } });
    expect(handlers['status.get']).not.toHaveBeenCalled();
  });

  it('rejects a wrong token', async () => {
    const state = { authenticated: false };
    const out = await dispatchMessage(
      msg('auth.hello', { token: 'b'.repeat(64) }),
      state,
      TOKEN,
      handlers,
      logger,
    );
    expect(out.close).toBe(true);
    expect(state.authenticated).toBe(false);
  });

  it('authenticates and then dispatches status.get', async () => {
    const state = { authenticated: false };
    const auth = await dispatchMessage(
      msg('auth.hello', { token: TOKEN }),
      state,
      TOKEN,
      handlers,
      logger,
    );
    expect(auth.response).toMatchObject({ result: { ok: true } });
    expect(state.authenticated).toBe(true);

    const out = await dispatchMessage(
      msg('status.get', undefined, 2),
      state,
      TOKEN,
      handlers,
      logger,
    );
    expect(out.response).toMatchObject({ id: 2, result: { appVersion: '0.1.0' } });
  });

  it('returns InvalidParams for unexpected params and MethodNotFound for unknown methods', async () => {
    const state = { authenticated: true };
    const bad = await dispatchMessage(msg('status.get', { x: 1 }), state, TOKEN, handlers, logger);
    expect(bad.response).toMatchObject({ error: { code: RpcErrorCode.InvalidParams } });
    const unknown = await dispatchMessage(msg('files.deleteAll'), state, TOKEN, handlers, logger);
    expect(unknown.response).toMatchObject({ error: { code: RpcErrorCode.MethodNotFound } });
  });

  it('returns ParseError for invalid JSON', async () => {
    const out = await dispatchMessage('{nope', { authenticated: true }, TOKEN, handlers, logger);
    expect(out.response).toMatchObject({ id: null, error: { code: RpcErrorCode.ParseError } });
  });

  it('compares tokens in constant time regardless of length', () => {
    expect(tokensEqual(TOKEN, TOKEN)).toBe(true);
    expect(tokensEqual('short', TOKEN)).toBe(false);
  });
});
