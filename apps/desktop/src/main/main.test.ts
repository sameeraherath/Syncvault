import { describe, expect, it } from 'vitest';
import { RpcErrorCode } from '@syncvault/shared';
import { isAllowedExternalUrl, validateRendererRpc } from './validate.js';
import { restartDelayMs } from './core/backoff.js';
import { coreSocketPath } from './core/socket-path.js';
import { gnomeExtensionsShowTray } from './tray-support.js';

describe('validateRendererRpc', () => {
  it('allows status.get with no params', () => {
    expect(validateRendererRpc('status.get', undefined)).toEqual({
      ok: true,
      value: { method: 'status.get', params: undefined },
    });
  });

  it('blocks methods the renderer must not call', () => {
    for (const m of ['auth.hello', 'core.shutdown', 'nope', 42]) {
      const r = validateRendererRpc(m, undefined);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe(RpcErrorCode.MethodNotFound);
    }
  });

  it('rejects unexpected params', () => {
    const r = validateRendererRpc('status.get', { path: '/etc' });
    expect(r.ok).toBe(false);
  });
});

describe('isAllowedExternalUrl', () => {
  it.each([
    ['https://getsyncvault.com/docs', true],
    ['https://github.com/syncvault', true],
    ['http://getsyncvault.com', false],
    ['https://evil.com', false],
    ['https://getsyncvault.com.evil.com', false],
    ['https://user:pw@github.com', false],
    ['file:///etc/passwd', false],
    ['javascript:alert(1)', false],
    [42, false],
  ])('%s → %s', (url, expected) => {
    expect(isAllowedExternalUrl(url)).toBe(expected);
  });
});

describe('restartDelayMs', () => {
  it('backs off exponentially and caps at 30s', () => {
    expect([1, 2, 3, 4, 5, 6, 10].map(restartDelayMs)).toEqual([
      1000, 2000, 4000, 8000, 16000, 30000, 30000,
    ]);
  });
});

describe('coreSocketPath', () => {
  const base = { appDataDir: '/home/u/.config/Syncvault', randomHex: 'abc123' };

  it('uses XDG_RUNTIME_DIR on Linux', () => {
    expect(
      coreSocketPath({ ...base, platform: 'linux', env: { XDG_RUNTIME_DIR: '/run/user/1000' } }),
    ).toBe('/run/user/1000/syncvault/core.sock');
  });

  it('falls back to the app data dir', () => {
    expect(coreSocketPath({ ...base, platform: 'linux', env: {} })).toBe(
      '/home/u/.config/Syncvault/run/core.sock',
    );
    expect(
      coreSocketPath({ ...base, platform: 'linux', env: { XDG_RUNTIME_DIR: 'relative' } }),
    ).toBe('/home/u/.config/Syncvault/run/core.sock');
  });

  it('uses a random named pipe on Windows', () => {
    expect(coreSocketPath({ ...base, platform: 'win32', env: {} })).toBe(
      '\\\\.\\pipe\\syncvault-abc123',
    );
  });
});

describe('gnomeExtensionsShowTray', () => {
  it('detects AppIndicator extensions', () => {
    expect(gnomeExtensionsShowTray('ubuntu-appindicators@ubuntu.com\nding@rastersoft.com')).toBe(
      true,
    );
    expect(gnomeExtensionsShowTray('appindicatorsupport@rgcjonas.gmail.com')).toBe(true);
    expect(gnomeExtensionsShowTray('dash-to-dock@micxgx.gmail.com')).toBe(false);
  });
});
