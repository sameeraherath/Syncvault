import { err, ok, type Result } from '@syncvault/shared';
import {
  DEFAULT_KDF,
  derivePasswordKek,
  deriveRcloneConfigPass,
  deriveVaultKey,
  formatRecoveryKey,
  keyCheck,
  keyCheckMatches,
  newRecoverySecret,
  newSalt,
  parseRecoveryKey,
  unwrapKey,
  wrapKey,
  type KdfParams,
} from './crypto.js';
import { readVaultFile, vaultFileExists, writeVaultFile, type VaultFile } from './store.js';

export type VaultState = 'none' | 'locked' | 'unlocked';

export interface VaultOptions {
  filePath: string;
  kdf?: KdfParams;
  /** Delay after a failed unlock/recover, to slow down guessing through the UI. */
  failDelayMs?: number;
}

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * The vault key lives only in this object's memory, from unlock until lock(). Operations run one at a
 * time so two concurrent unlock/create calls can't race on vault.json.
 */
export class Vault {
  #key: Buffer | null = null;
  #queue: Promise<unknown> = Promise.resolve();
  readonly #file: string;
  readonly #kdf: KdfParams;
  readonly #failDelayMs: number;

  constructor(opts: VaultOptions) {
    this.#file = opts.filePath;
    this.#kdf = opts.kdf ?? DEFAULT_KDF;
    this.#failDelayMs = opts.failDelayMs ?? 1000;
  }

  get isUnlocked(): boolean {
    return this.#key !== null;
  }

  async state(): Promise<VaultState> {
    if (this.#key) return 'unlocked';
    return (await vaultFileExists(this.#file)) ? 'locked' : 'none';
  }

  /** Creates a new vault and leaves it unlocked. Never replaces an existing vault.json. */
  create(password: string): Promise<Result<{ recoveryKey: string }, 'exists'>> {
    return this.#run(async () => {
      if (await vaultFileExists(this.#file)) return err('exists' as const);
      const secret = newRecoverySecret();
      const key = deriveVaultKey(secret);
      const written = await this.#writeWithPassword(key, password, false);
      if (!written.ok) {
        secret.fill(0);
        key.fill(0);
        return written;
      }
      const recoveryKey = formatRecoveryKey(secret);
      secret.fill(0);
      this.#setKey(key);
      return ok({ recoveryKey });
    });
  }

  unlock(password: string): Promise<Result<void, 'wrongPassword' | 'noVault' | 'corrupt'>> {
    return this.#run(async () => {
      const file = await readVaultFile(this.#file);
      if (!file.ok)
        return err(file.error === 'missing' ? ('noVault' as const) : ('corrupt' as const));
      const { kdf } = file.value;
      const kek = await derivePasswordKek(password, Buffer.from(kdf.salt, 'base64'), kdf);
      const key = unwrapKey(kek, file.value.password);
      kek.fill(0);
      if (!key || !keyCheckMatches(key, file.value.keyCheck)) {
        key?.fill(0);
        await delay(this.#failDelayMs);
        return err('wrongPassword' as const);
      }
      this.#setKey(key);
      return ok(undefined);
    });
  }

  /**
   * Unlocks with the recovery key and sets a new master password. Works without vault.json too
   * (new machine): the recovery key alone rebuilds the vault key.
   */
  recover(
    recoveryKey: string,
    newPassword: string,
  ): Promise<Result<void, 'invalidKey' | 'wrongKey' | 'corrupt'>> {
    return this.#run(async () => {
      const parsed = parseRecoveryKey(recoveryKey);
      if (!parsed.ok) {
        await delay(this.#failDelayMs);
        return err('invalidKey' as const);
      }
      const key = deriveVaultKey(parsed.secret);
      parsed.secret.fill(0);

      const existing = await readVaultFile(this.#file);
      if (!existing.ok && existing.error === 'corrupt') {
        // Don't overwrite a file we can't read — it may be the user's only copy. Ask them to move it.
        key.fill(0);
        return err('corrupt' as const);
      }
      if (existing.ok && !keyCheckMatches(key, existing.value.keyCheck)) {
        key.fill(0);
        await delay(this.#failDelayMs);
        return err('wrongKey' as const);
      }
      const written = await this.#writeWithPassword(key, newPassword, existing.ok);
      if (!written.ok) {
        // vault.json appeared between read and write; don't replace it.
        key.fill(0);
        return err('wrongKey' as const);
      }
      this.#setKey(key);
      return ok(undefined);
    });
  }

  /** Zeroes the key. Safe to call when already locked. */
  lock(): void {
    this.#key?.fill(0);
    this.#key = null;
  }

  /** The rclone config password, or null while locked. */
  rcloneConfigPass(): string | null {
    return this.#key ? deriveRcloneConfigPass(this.#key) : null;
  }

  #setKey(key: Buffer): void {
    this.#key?.fill(0);
    this.#key = key;
  }

  async #writeWithPassword(
    key: Buffer,
    password: string,
    overwrite: boolean,
  ): Promise<Result<void, 'exists'>> {
    const salt = newSalt();
    const kek = await derivePasswordKek(password, salt, this.#kdf);
    const data: VaultFile = {
      version: 1,
      kdf: { alg: 'argon2id', ...this.#kdf, salt: salt.toString('base64') },
      password: wrapKey(kek, key),
      keyCheck: keyCheck(key),
    };
    kek.fill(0);
    return writeVaultFile(this.#file, data, { overwrite });
  }

  #run<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.#queue.then(fn, fn);
    this.#queue = next.catch(() => undefined);
    return next;
  }
}
