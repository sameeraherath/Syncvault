import { describe, expect, it, vi } from 'vitest';
import { RcloneClient } from './client.js';
import { buildRcdLaunch, sanitizeEnv } from './args.js';

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('RcloneClient', () => {
  it('POSTs JSON with Basic auth to the right URL', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse({ version: 'v1.76.0' }));
    const client = new RcloneClient({
      baseUrl: 'http://127.0.0.1:5572',
      user: 'sv-user',
      pass: 'p@ss:word',
      fetchImpl,
    });

    const res = await client.version();

    expect(res).toEqual({ ok: true, value: { version: 'v1.76.0' } });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('http://127.0.0.1:5572/core/version');
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe('{}');
    const headers = init?.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers.Authorization).toBe(
      'Basic ' + Buffer.from('sv-user:p@ss:word').toString('base64'),
    );
  });

  it('returns typed errors for HTTP failures', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse({ error: 'nope' }, 500));
    const client = new RcloneClient({
      baseUrl: 'http://127.0.0.1:1',
      user: 'u',
      pass: 'p',
      fetchImpl,
    });
    expect(await client.version()).toEqual({
      ok: false,
      error: { code: 'http', status: 500, message: 'nope' },
    });
  });

  it('rejects malformed method names without calling fetch', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const client = new RcloneClient({
      baseUrl: 'http://127.0.0.1:1',
      user: 'u',
      pass: 'p',
      fetchImpl,
    });
    const res = await client.call('../core/quit', {}, (await import('zod')).z.unknown());
    expect(res.ok).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('refuses non-loopback addresses', () => {
    expect(
      () => new RcloneClient({ baseUrl: 'http://0.0.0.0:5572', user: 'u', pass: 'p' }),
    ).toThrow();
  });
});

describe('buildRcdLaunch', () => {
  const launch = buildRcdLaunch({
    port: 40000,
    configPath: '/data/rclone/rclone.conf',
    cacheDir: '/data/rclone/cache',
    user: 'sv-user',
    pass: 'secret-pass',
    baseEnv: {
      PATH: '/usr/bin',
      RCLONE_CONFIG: '/home/x/.config/rclone/rclone.conf',
      SYNCVAULT_RPC_TOKEN: 't',
    },
  });

  it('never puts credentials on the command line', () => {
    expect(launch.args.join(' ')).not.toContain('secret-pass');
    expect(launch.args.join(' ')).not.toContain('sv-user');
    expect(launch.env.RCLONE_RC_USER).toBe('sv-user');
    expect(launch.env.RCLONE_RC_PASS).toBe('secret-pass');
  });

  it('binds to loopback, uses our own config, no web GUI, never --rc-no-auth', () => {
    expect(launch.args).toContain('--rc-addr=127.0.0.1:40000');
    expect(launch.args).toContain('--config=/data/rclone/rclone.conf');
    expect(launch.args.some((a) => a.startsWith('--rc-web-gui'))).toBe(false);
    expect(launch.args).not.toContain('--rc-no-auth');
  });

  it("drops the user's RCLONE_* and SYNCVAULT_* variables", () => {
    expect(launch.env.RCLONE_CONFIG).toBeUndefined();
    expect(launch.env.SYNCVAULT_RPC_TOKEN).toBeUndefined();
    expect(sanitizeEnv({ HOME: '/h', ELECTRON_RUN_AS_NODE: '1' })).toEqual({ HOME: '/h' });
  });
});
