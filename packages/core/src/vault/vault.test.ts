import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { Vault } from './vault.js';

const PASSWORD = 'correct horse battery';

const newVault = async (): Promise<{ vault: Vault; file: string }> => {
  const file = path.join(await mkdtemp(path.join(os.tmpdir(), 'sv-vault-')), 'vault.json');
  return { vault: new Vault({ filePath: file, kdf: { m: 64, t: 1, p: 1 }, failDelayMs: 0 }), file };
};

describe('Vault', () => {
  it('goes none → unlocked (create) → locked → unlocked', async () => {
    const { vault } = await newVault();
    expect(await vault.state()).toBe('none');
    expect(vault.rcloneConfigPass()).toBeNull();

    const created = await vault.create(PASSWORD);
    expect(created.ok).toBe(true);
    expect(await vault.state()).toBe('unlocked');
    const pass = vault.rcloneConfigPass();
    expect(pass).toMatch(/^[A-Za-z0-9_-]{43}$/);

    vault.lock();
    expect(await vault.state()).toBe('locked');
    expect(vault.rcloneConfigPass()).toBeNull();

    expect(await vault.unlock(PASSWORD)).toEqual({ ok: true, value: undefined });
    expect(vault.rcloneConfigPass()).toBe(pass);
  });

  it('never writes the key, password or recovery key to disk', async () => {
    const { vault, file } = await newVault();
    const created = await vault.create(PASSWORD);
    if (!created.ok) throw new Error('create failed');
    const disk = await readFile(file, 'utf8');
    expect(disk).not.toContain(PASSWORD);
    expect(disk).not.toContain(created.value.recoveryKey);
    expect(disk).not.toContain(vault.rcloneConfigPass() ?? '<none>');
  });

  it('refuses to create over an existing vault', async () => {
    const { vault, file } = await newVault();
    await vault.create(PASSWORD);
    const before = await readFile(file, 'utf8');
    vault.lock();
    expect(await vault.create('another password!')).toEqual({ ok: false, error: 'exists' });
    expect(await readFile(file, 'utf8')).toBe(before);
  });

  it('rejects a wrong password and stays locked', async () => {
    const { vault } = await newVault();
    await vault.create(PASSWORD);
    vault.lock();
    expect(await vault.unlock('wrong password!!')).toEqual({ ok: false, error: 'wrongPassword' });
    expect(await vault.state()).toBe('locked');
  });

  it('reports noVault and corrupt files', async () => {
    const { vault, file } = await newVault();
    expect(await vault.unlock(PASSWORD)).toEqual({ ok: false, error: 'noVault' });
    await writeFile(file, '{ broken');
    expect(await vault.unlock(PASSWORD)).toEqual({ ok: false, error: 'corrupt' });
  });

  it('recovers with the recovery key and sets a new password', async () => {
    const { vault } = await newVault();
    const created = await vault.create(PASSWORD);
    if (!created.ok) throw new Error('create failed');
    const pass = vault.rcloneConfigPass();
    vault.lock();

    expect(await vault.recover(created.value.recoveryKey, 'brand new password')).toEqual({
      ok: true,
      value: undefined,
    });
    expect(vault.rcloneConfigPass()).toBe(pass);
    vault.lock();
    expect(await vault.unlock(PASSWORD)).toEqual({ ok: false, error: 'wrongPassword' });
    expect((await vault.unlock('brand new password')).ok).toBe(true);
  });

  it('rejects a recovery key from another vault', async () => {
    const a = await newVault();
    const b = await newVault();
    await a.vault.create(PASSWORD);
    const other = await b.vault.create(PASSWORD);
    if (!other.ok) throw new Error('create failed');
    a.vault.lock();
    expect(await a.vault.recover(other.value.recoveryKey, 'brand new password')).toEqual({
      ok: false,
      error: 'wrongKey',
    });
    expect(await a.vault.recover('not-a-key', 'brand new password')).toEqual({
      ok: false,
      error: 'invalidKey',
    });
  });

  it('rebuilds the same keys from the recovery key when vault.json is lost', async () => {
    const { vault, file } = await newVault();
    const created = await vault.create(PASSWORD);
    if (!created.ok) throw new Error('create failed');
    const pass = vault.rcloneConfigPass();
    vault.lock();
    await rm(file);

    const fresh = new Vault({ filePath: file, kdf: { m: 64, t: 1, p: 1 }, failDelayMs: 0 });
    expect((await fresh.recover(created.value.recoveryKey, 'brand new password')).ok).toBe(true);
    expect(fresh.rcloneConfigPass()).toBe(pass);
    expect(await fresh.state()).toBe('unlocked');
  });

  it('does not overwrite a corrupt vault.json during recovery', async () => {
    const { vault, file } = await newVault();
    const created = await vault.create(PASSWORD);
    if (!created.ok) throw new Error('create failed');
    vault.lock();
    await writeFile(file, '{ broken');
    expect(await vault.recover(created.value.recoveryKey, 'brand new password')).toEqual({
      ok: false,
      error: 'corrupt',
    });
    expect(await readFile(file, 'utf8')).toBe('{ broken');
  });

  it('runs operations one at a time', async () => {
    const { vault } = await newVault();
    const [a, b] = await Promise.all([vault.create(PASSWORD), vault.create(PASSWORD)]);
    expect([a.ok, b.ok].sort()).toEqual([false, true]);
  });
});
