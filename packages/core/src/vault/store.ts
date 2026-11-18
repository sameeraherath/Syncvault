import { randomBytes } from 'node:crypto';
import { chmod, link, open, readFile, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { err, ok, type Result } from '@syncvault/shared';

/**
 * vault.json — holds only the password-wrapped vault key and public parameters. No plaintext key
 * material ever touches disk.
 */

const b64 = z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/);

export const vaultFileSchema = z
  .object({
    version: z.literal(1),
    kdf: z
      .object({
        alg: z.literal('argon2id'),
        m: z
          .number()
          .int()
          .min(8)
          .max(4 * 1024 * 1024),
        t: z.number().int().min(1).max(100),
        p: z.number().int().min(1).max(16),
        salt: b64,
      })
      .strict(),
    password: z.object({ iv: b64, ct: b64, tag: b64 }).strict(),
    keyCheck: b64,
  })
  .strict();
export type VaultFile = z.infer<typeof vaultFileSchema>;

export type VaultReadError = 'missing' | 'corrupt';

export const vaultFileExists = async (file: string): Promise<boolean> => {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
};

export const readVaultFile = async (file: string): Promise<Result<VaultFile, VaultReadError>> => {
  let text: string;
  try {
    text = await readFile(file, 'utf8');
  } catch (e) {
    return err((e as NodeJS.ErrnoException).code === 'ENOENT' ? 'missing' : 'corrupt');
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return err('corrupt');
  }
  const parsed = vaultFileSchema.safeParse(json);
  return parsed.success ? ok(parsed.data) : err('corrupt');
};

/**
 * Atomic write: temp file in the same directory → fsync → move into place, so a crash never
 * leaves a half-written vault.json.
 *
 * `overwrite: false` uses link(), which fails with EEXIST instead of replacing an existing vault —
 * replacing it would destroy the only wrapped copy of the key.
 */
export const writeVaultFile = async (
  file: string,
  data: VaultFile,
  opts: { overwrite: boolean },
): Promise<Result<void, 'exists'>> => {
  const tmp = path.join(path.dirname(file), `.vault-${randomBytes(6).toString('hex')}.tmp`);
  const handle = await open(tmp, 'wx', 0o600);
  try {
    await handle.writeFile(JSON.stringify(data, null, 2) + '\n', 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    if (process.platform !== 'win32') await chmod(tmp, 0o600);
    if (opts.overwrite) {
      await rename(tmp, file);
    } else {
      try {
        await link(tmp, file);
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === 'EEXIST') return err('exists');
        throw e;
      }
    }
    await syncDir(path.dirname(file));
    return ok(undefined);
  } finally {
    await rm(tmp, { force: true });
  }
};

/** Persist the directory entry too (POSIX). Not supported on Windows; ignored there. */
const syncDir = async (dir: string): Promise<void> => {
  if (process.platform === 'win32') return;
  const h = await open(dir, 'r');
  try {
    await h.sync();
  } finally {
    await h.close();
  }
};
