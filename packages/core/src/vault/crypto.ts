import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { argon2idAsync } from '@noble/hashes/argon2.js';

/**
 * Vault key handling. Proven primitives only: Argon2id (@noble/hashes — Electron's Node has no
 * Argon2 because it is built on BoringSSL), AES-256-GCM, HKDF-SHA256 and HMAC-SHA256 (node:crypto).
 *
 * Key hierarchy (see docs/ARCHITECTURE.md):
 *   recoverySecret (16 random bytes, shown to the user as the recovery key)
 *     └─ vaultKey = HKDF(recoverySecret)            — the root key; memory only
 *          ├─ rclone config password = HKDF(vaultKey)
 *          └─ (later) per-folder crypt keys = HKDF(vaultKey, folder salt)
 *   passwordKEK = Argon2id(master password) wraps vaultKey in vault.json.
 *
 * Because everything derives from the recovery secret, the recovery key alone can rebuild every key
 * on a new machine, even if vault.json is lost.
 */

export interface KdfParams {
  /** Memory cost in KiB. */
  m: number;
  /** Iterations. */
  t: number;
  /** Parallelism. */
  p: number;
}

/** ~1.7 s on a 2017 laptop. Well above OWASP's minimum (19 MiB, t=2). Stored per vault, so it can be raised later. */
export const DEFAULT_KDF: KdfParams = { m: 64 * 1024, t: 2, p: 1 };

export const KEY_BYTES = 32;
export const RECOVERY_SECRET_BYTES = 16;
const SALT_BYTES = 16;
const IV_BYTES = 12;

const INFO_VAULT_KEY = 'syncvault/vault-key/v1';
const INFO_RCLONE_CONFIG = 'syncvault/rclone-config/v1';
const KEY_CHECK_LABEL = 'syncvault/key-check/v1';
export const WRAP_AAD = 'syncvault/vault/v1';

export interface WrappedKey {
  iv: string;
  ct: string;
  tag: string;
}

const hkdf = (ikm: Buffer, info: string): Buffer =>
  Buffer.from(hkdfSync('sha256', ikm, Buffer.alloc(0), info, KEY_BYTES));

export const newRecoverySecret = (): Buffer => randomBytes(RECOVERY_SECRET_BYTES);
export const newSalt = (): Buffer => randomBytes(SALT_BYTES);

export const deriveVaultKey = (recoverySecret: Buffer): Buffer => {
  if (recoverySecret.length !== RECOVERY_SECRET_BYTES) throw new Error('bad recovery secret');
  return hkdf(recoverySecret, INFO_VAULT_KEY);
};

/** NFC so the same password typed via different input methods (e.g. Sinhala, Tamil) gives the same key. */
export const derivePasswordKek = async (
  password: string,
  salt: Buffer,
  params: KdfParams,
): Promise<Buffer> => {
  const out = await argon2idAsync(password.normalize('NFC'), salt, {
    m: params.m,
    t: params.t,
    p: params.p,
    dkLen: KEY_BYTES,
  });
  return Buffer.from(out.buffer, out.byteOffset, out.byteLength);
};

export const wrapKey = (kek: Buffer, key: Buffer): WrappedKey => {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', kek, iv);
  cipher.setAAD(Buffer.from(WRAP_AAD, 'utf8'));
  const ct = Buffer.concat([cipher.update(key), cipher.final()]);
  return {
    iv: iv.toString('base64'),
    ct: ct.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  };
};

/** Returns null when the KEK is wrong or the data was tampered with (GCM tag check). */
export const unwrapKey = (kek: Buffer, wrapped: WrappedKey): Buffer | null => {
  try {
    const decipher = createDecipheriv('aes-256-gcm', kek, Buffer.from(wrapped.iv, 'base64'));
    decipher.setAAD(Buffer.from(WRAP_AAD, 'utf8'));
    decipher.setAuthTag(Buffer.from(wrapped.tag, 'base64'));
    const key = Buffer.concat([
      decipher.update(Buffer.from(wrapped.ct, 'base64')),
      decipher.final(),
    ]);
    if (key.length !== KEY_BYTES) {
      key.fill(0);
      return null;
    }
    return key;
  } catch {
    return null;
  }
};

/** Lets recovery tell "wrong recovery key" apart without storing anything that reveals the key. */
export const keyCheck = (vaultKey: Buffer): string =>
  createHmac('sha256', vaultKey).update(KEY_CHECK_LABEL).digest('base64');

export const keyCheckMatches = (vaultKey: Buffer, expected: string): boolean => {
  const a = Buffer.from(keyCheck(vaultKey), 'base64');
  const b = Buffer.from(expected, 'base64');
  return a.length === b.length && timingSafeEqual(a, b);
};

/** rclone config password. Goes to rclone via env only — never argv, never disk. */
export const deriveRcloneConfigPass = (vaultKey: Buffer): string => {
  const k = hkdf(vaultKey, INFO_RCLONE_CONFIG);
  const out = k.toString('base64url');
  k.fill(0);
  return out;
};

// ── Recovery key text format ───────────────────────────────────────────────────────────────
// 16 bytes → 26 Crockford base32 chars + 2 check chars = 28 chars, shown as 7 groups of 4.
// Parsing is forgiving: case-insensitive, dashes/spaces ignored, O→0 and I/L→1.

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const DATA_CHARS = 26;
const CHECK_CHARS = 2;

const checkChars = (secret: Buffer): string => {
  const h = createHash('sha256').update(secret).digest();
  const first = h[0] ?? 0;
  const second = h[1] ?? 0;
  const bits = (first << 2) | (second >> 6); // 10 bits
  return (ALPHABET[(bits >> 5) & 31] ?? '0') + (ALPHABET[bits & 31] ?? '0');
};

export const formatRecoveryKey = (secret: Buffer): string => {
  if (secret.length !== RECOVERY_SECRET_BYTES) throw new Error('bad recovery secret');
  let n = BigInt('0x' + secret.toString('hex'));
  let data = '';
  for (let i = 0; i < DATA_CHARS; i++) {
    data = (ALPHABET[Number(n & 31n)] ?? '0') + data;
    n >>= 5n;
  }
  const all = data + checkChars(secret);
  return all.match(/.{4}/g)?.join('-') ?? all;
};

export type RecoveryKeyParseError = 'invalidFormat' | 'checksum';

export const parseRecoveryKey = (
  text: string,
): { ok: true; secret: Buffer } | { ok: false; error: RecoveryKeyParseError } => {
  const clean = text.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  if (clean.length !== DATA_CHARS + CHECK_CHARS) return { ok: false, error: 'invalidFormat' };
  let n = 0n;
  for (const ch of clean.slice(0, DATA_CHARS)) {
    const v = ALPHABET.indexOf(ch);
    if (v < 0) return { ok: false, error: 'invalidFormat' };
    n = (n << 5n) | BigInt(v);
  }
  if (n >> 128n !== 0n) return { ok: false, error: 'invalidFormat' };
  if (!/^[0-9A-Z]+$/.test(clean.slice(DATA_CHARS))) return { ok: false, error: 'invalidFormat' };
  const secret = Buffer.from(n.toString(16).padStart(RECOVERY_SECRET_BYTES * 2, '0'), 'hex');
  if (checkChars(secret) !== clean.slice(DATA_CHARS)) {
    secret.fill(0);
    return { ok: false, error: 'checksum' };
  }
  return { ok: true, secret };
};
