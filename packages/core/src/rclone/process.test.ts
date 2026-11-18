import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { platformKey, rcloneExecutableName } from '@syncvault/shared';
import { createLogger } from '../log.js';
import { ENCRYPTED_CONFIG_HEADER } from './args.js';
import { RcloneProcess } from './process.js';

/** Integration tests against the real rclone binary. Skipped until `pnpm fetch:rclone` has run. */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const key = platformKey(process.platform, process.arch);
const binary = key
  ? path.join(repoRoot, 'resources', 'rclone', key, rcloneExecutableName(process.platform))
  : '';
const hasRclone = binary !== '' && existsSync(binary);

const logger = createLogger('test', 'error', () => {});
const PASS = 'test-config-pass-0123456789';

const setup = async (): Promise<{ appData: string; proc: RcloneProcess }> => {
  // A space in the path checks the --password-command quoting.
  const appData = await mkdtemp(path.join(os.tmpdir(), 'sv rclone '));
  const helperScript = path.join(appData, 'password-helper.mjs');
  await writeFile(
    helperScript,
    "process.stdout.write(process.env['SYNCVAULT_RCLONE_NEW_PASS'] ?? '');\n",
  );
  const proc = new RcloneProcess({ binaryPath: binary, appDataDir: appData, logger, helperScript });
  return { appData, proc };
};

describe.skipIf(!hasRclone)('RcloneProcess with an encrypted config', () => {
  let running: RcloneProcess | null = null;
  afterEach(async () => {
    await running?.stop();
    running = null;
  });

  it('encrypts a new, empty config and starts with it', async () => {
    const { appData, proc } = await setup();
    running = proc;
    const res = await proc.start(PASS);
    expect(res.ok).toBe(true);
    const text = await readFile(path.join(appData, 'rclone', 'rclone.conf'), 'utf8');
    expect(text.startsWith(ENCRYPTED_CONFIG_HEADER)).toBe(true);
    expect(text).not.toContain(PASS);
  }, 30_000);

  it('starts again with the same password', async () => {
    const { proc } = await setup();
    running = proc;
    expect((await proc.start(PASS)).ok).toBe(true);
    await proc.stop();
    expect((await proc.start(PASS)).ok).toBe(true);
  }, 30_000);

  it('refuses a plain-text config that has content', async () => {
    const { appData, proc } = await setup();
    running = proc;
    await mkdir(path.join(appData, 'rclone'), { recursive: true });
    const conf = path.join(appData, 'rclone', 'rclone.conf');
    await writeFile(conf, '[old]\ntype = local\n');
    const res = await proc.start(PASS);
    expect(res).toEqual({ ok: false, error: 'rclone config is not encrypted' });
    expect(proc.status.state).toBe('error');
    // Left untouched for the user to inspect.
    expect(await readFile(conf, 'utf8')).toBe('[old]\ntype = local\n');
  }, 30_000);
});
