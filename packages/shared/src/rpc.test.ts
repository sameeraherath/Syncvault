import { describe, expect, it } from 'vitest';
import { rpcRequestSchema, rpcResponseSchema } from './rpc.js';
import {
  REMOTE_PATH_MAX_LENGTH,
  isSafeRemotePath,
  isRendererMethod,
  rpcMethods,
  statusGetResultSchema,
} from './methods.js';
import { platformKey } from './platform.js';

describe('rpcRequestSchema', () => {
  it('accepts a valid JSON-RPC 2.0 request', () => {
    const parsed = rpcRequestSchema.safeParse({ jsonrpc: '2.0', id: 1, method: 'status.get' });
    expect(parsed.success).toBe(true);
  });

  it.each([
    [{ jsonrpc: '1.0', id: 1, method: 'status.get' }],
    [{ jsonrpc: '2.0', method: 'status.get' }],
    [{ jsonrpc: '2.0', id: 1, method: '../../etc' }],
    [{ jsonrpc: '2.0', id: 1, method: 'status.get', extra: true }],
    [{ jsonrpc: '2.0', id: -1, method: 'status.get' }],
  ])('rejects malformed request %j', (input) => {
    expect(rpcRequestSchema.safeParse(input).success).toBe(false);
  });

  it('parses success and error responses', () => {
    expect(rpcResponseSchema.safeParse({ jsonrpc: '2.0', id: 1, result: {} }).success).toBe(true);
    expect(
      rpcResponseSchema.safeParse({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Parse error' },
      }).success,
    ).toBe(true);
  });
});

describe('method schemas', () => {
  it('requires a sufficiently long auth token', () => {
    expect(rpcMethods['auth.hello'].params.safeParse({ token: 'short' }).success).toBe(false);
    expect(rpcMethods['auth.hello'].params.safeParse({ token: 'x'.repeat(64) }).success).toBe(true);
  });

  it('rejects unknown params on status.get', () => {
    expect(rpcMethods['status.get'].params.safeParse({ evil: 1 }).success).toBe(false);
    expect(rpcMethods['status.get'].params.safeParse(undefined).success).toBe(true);
  });

  it('validates status.get results', () => {
    const ok = statusGetResultSchema.safeParse({
      appVersion: '0.1.0',
      coreVersion: '0.1.0',
      platform: 'linux',
      arch: 'x64',
      rclone: { state: 'running', version: 'v1.76.0' },
      database: { state: 'ready', schemaVersion: 1 },
    });
    expect(ok.success).toBe(true);
  });

  it('validates history.list params', () => {
    const params = rpcMethods['history.list'].params;
    expect(params.safeParse(undefined).success).toBe(true);
    expect(params.safeParse({}).success).toBe(true);
    expect(params.safeParse({ limit: 10 }).success).toBe(true);
    expect(params.safeParse({ limit: 0 }).success).toBe(false);
    expect(params.safeParse({ limit: 201 }).success).toBe(false);
    expect(params.safeParse({ limit: 1.5 }).success).toBe(false);
    expect(params.safeParse({ limit: 10, evil: 1 }).success).toBe(false);
  });

  it('rejects unknown history events in results', () => {
    const result = rpcMethods['history.list'].result;
    const entry = { id: 1, event: 'sync.completed', folderName: 'Work', createdAt: 1 };
    expect(result.safeParse({ entries: [entry] }).success).toBe(true);
    expect(result.safeParse({ entries: [{ ...entry, event: 'rm -rf' }] }).success).toBe(false);
  });

  it('only exposes allow-listed methods to the renderer', () => {
    expect(isRendererMethod('status.get')).toBe(true);
    expect(isRendererMethod('history.list')).toBe(true);
    expect(isRendererMethod('auth.hello')).toBe(false);
    expect(isRendererMethod('core.shutdown')).toBe(false);
  });
});

describe('platformKey', () => {
  it('maps supported platforms and rejects others', () => {
    expect(platformKey('linux', 'x64')).toBe('linux-x64');
    expect(platformKey('win32', 'x64')).toBe('win32-x64');
    expect(platformKey('freebsd', 'x64')).toBeNull();
  });
});

describe('isSafeRemotePath', () => {
  it.each([
    '',
    'Work',
    'Work/2026',
    'Taxes 2026/Q1 receipts',
    'Fotos/Ünïcödé',
    'a/b/c.txt',
    '...hidden',
  ])('accepts %j', (p) => expect(isSafeRemotePath(p)).toBe(true));

  it.each([
    ['..'],
    ['Work/../etc'],
    ['./Work'],
    ['/etc/passwd'],
    ['Work/'],
    ['Work//2026'],
    ['C:\\Windows'],
    ['Work\u0000x'],
    ['Work\nfile'],
    ['a'.repeat(REMOTE_PATH_MAX_LENGTH + 1)],
  ])('rejects %j', (p) => expect(isSafeRemotePath(p)).toBe(false));
});

describe('files.list schemas', () => {
  const params = rpcMethods['files.list'].params;

  it('requires an account id and a safe path, nothing else', () => {
    expect(params.safeParse({ accountId: 'a1', path: '' }).success).toBe(true);
    expect(params.safeParse({ accountId: 'a1', path: 'Work/2026' }).success).toBe(true);
    expect(params.safeParse({ accountId: 'a1', path: '../x' }).success).toBe(false);
    expect(params.safeParse({ accountId: '', path: '' }).success).toBe(false);
    expect(params.safeParse({ path: '' }).success).toBe(false);
    // The renderer may never choose the rclone remote itself.
    expect(params.safeParse({ accountId: 'a1', path: '', fs: '/' }).success).toBe(false);
  });

  it('accepts each result shape', () => {
    const result = rpcMethods['files.list'].result;
    expect(result.safeParse({ state: 'ok', entries: [], truncated: false }).success).toBe(true);
    expect(result.safeParse({ state: 'encrypted' }).success).toBe(true);
    expect(result.safeParse({ state: 'error', reason: 'listFailed' }).success).toBe(true);
    expect(result.safeParse({ state: 'error', reason: 'some raw message' }).success).toBe(false);
  });

  it('exposes accounts.list and files.list to the renderer', () => {
    expect(isRendererMethod('accounts.list')).toBe(true);
    expect(isRendererMethod('files.list')).toBe(true);
  });
});
