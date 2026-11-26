import { mkdtemp, readdir, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readVaultFile, writeVaultFile, type VaultFile } from './store.js';

const sample: VaultFile = {
  version: 1,
  kdf: { alg: 'argon2id', m: 64, t: 1, p: 1, salt: 'AAAAAAAAAAAAAAAAAAAAAA==' },
  password: { iv: 'AAAAAAAAAAAAAAAA', ct: 'AAAA', tag: 'AAAAAAAAAAAAAAAAAAAAAA==' },
  keyCheck: 'AAAA',
};

const tmpDir = (): Promise<string> => mkdtemp(path.join(os.tmpdir(), 'sv-vault-'));

describe('vault.json store', () => {
  it('writes and reads back, leaving no temp files', async () => {
    const dir = await tmpDir();
    const file = path.join(dir, 'vault.json');
    expect((await writeVaultFile(file, sample, { overwrite: false })).ok).toBe(true);
    expect(await readVaultFile(file)).toEqual({ ok: true, value: sample });
    expect(await readdir(dir)).toEqual(['vault.json']);
  });

  it.skipIf(process.platform === 'win32')('is private to the user (0600)', async () => {
    const file = path.join(await tmpDir(), 'vault.json');
    await writeVaultFile(file, sample, { overwrite: false });
    expect((await stat(file)).mode & 0o777).toBe(0o600);
  });

  it('never replaces an existing vault unless asked', async () => {
    const dir = await tmpDir();
    const file = path.join(dir, 'vault.json');
    await writeVaultFile(file, sample, { overwrite: false });
    const other = { ...sample, keyCheck: 'BBBB' };
    expect(await writeVaultFile(file, other, { overwrite: false })).toEqual({
      ok: false,
      error: 'exists',
    });
    expect(await readVaultFile(file)).toEqual({ ok: true, value: sample });
    expect(await readdir(dir)).toEqual(['vault.json']);

    expect((await writeVaultFile(file, other, { overwrite: true })).ok).toBe(true);
    expect(await readVaultFile(file)).toEqual({ ok: true, value: other });
  });

  it('reports a missing file', async () => {
    expect(await readVaultFile(path.join(await tmpDir(), 'nope.json'))).toEqual({
      ok: false,
      error: 'missing',
    });
  });

  it.each([['not json'], ['{}'], [JSON.stringify({ ...sample, version: 2 })]])(
    'reports a corrupt file: %s',
    async (content) => {
      const file = path.join(await tmpDir(), 'vault.json');
      await writeFile(file, content);
      expect(await readVaultFile(file)).toEqual({ ok: false, error: 'corrupt' });
    },
  );
});
