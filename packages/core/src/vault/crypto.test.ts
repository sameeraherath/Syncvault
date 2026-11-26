import { argon2id } from '@noble/hashes/argon2.js';
import { describe, expect, it } from 'vitest';
import {
  deriveRcloneConfigPass,
  derivePasswordKek,
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

/** Tiny params so tests are fast. Production uses DEFAULT_KDF. */
const FAST: KdfParams = { m: 64, t: 1, p: 1 };

describe('Argon2id', () => {
  it('matches the RFC 9106 §5.3 test vector', () => {
    const out = argon2id(new Uint8Array(32).fill(1), new Uint8Array(16).fill(2), {
      m: 32,
      t: 3,
      p: 4,
      dkLen: 32,
      key: new Uint8Array(8).fill(3),
      personalization: new Uint8Array(12).fill(4),
    });
    expect(Buffer.from(out).toString('hex')).toBe(
      '0d640df58d78766c08c037a34a8b53c9d01ef0452d75b65eb52520e96b01e659',
    );
  });

  it('normalises the password to NFC', async () => {
    const salt = newSalt();
    const composed = await derivePasswordKek('café-password', salt, FAST);
    const decomposed = await derivePasswordKek('café-password', salt, FAST);
    expect(composed.equals(decomposed)).toBe(true);
  });
});

describe('wrapKey / unwrapKey', () => {
  const setup = async (): Promise<{ kek: Buffer; key: Buffer }> => ({
    kek: await derivePasswordKek('correct horse battery', newSalt(), FAST),
    key: deriveVaultKey(newRecoverySecret()),
  });

  it('round-trips', async () => {
    const { kek, key } = await setup();
    expect(unwrapKey(kek, wrapKey(kek, key))?.equals(key)).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const { key } = await setup();
    const salt = newSalt();
    const right = await derivePasswordKek('right password!', salt, FAST);
    const wrong = await derivePasswordKek('wrong password!', salt, FAST);
    expect(unwrapKey(wrong, wrapKey(right, key))).toBeNull();
  });

  it.each(['iv', 'ct', 'tag'] as const)('rejects a tampered %s', async (field) => {
    const { kek, key } = await setup();
    const wrapped = wrapKey(kek, key);
    const bytes = Buffer.from(wrapped[field], 'base64');
    bytes[0] = (bytes[0] ?? 0) ^ 1;
    expect(unwrapKey(kek, { ...wrapped, [field]: bytes.toString('base64') })).toBeNull();
  });
});

describe('key derivation', () => {
  it('is deterministic from the recovery secret (works on a new machine)', () => {
    const secret = newRecoverySecret();
    const a = deriveVaultKey(secret);
    const b = deriveVaultKey(Buffer.from(secret));
    expect(a.equals(b)).toBe(true);
    expect(deriveRcloneConfigPass(a)).toBe(deriveRcloneConfigPass(b));
  });

  it('gives different keys for different purposes', () => {
    const key = deriveVaultKey(newRecoverySecret());
    expect(deriveRcloneConfigPass(key)).not.toBe(key.toString('base64url'));
  });

  it('checks the key without revealing it', () => {
    const key = deriveVaultKey(newRecoverySecret());
    const other = deriveVaultKey(newRecoverySecret());
    expect(keyCheckMatches(key, keyCheck(key))).toBe(true);
    expect(keyCheckMatches(other, keyCheck(key))).toBe(false);
  });
});

describe('recovery key format', () => {
  it('formats as 7 groups of 4 and round-trips', () => {
    const secret = newRecoverySecret();
    const text = formatRecoveryKey(secret);
    expect(text).toMatch(/^([0-9A-HJKMNP-TV-Z]{4}-){6}[0-9A-HJKMNP-TV-Z]{4}$/);
    const parsed = parseRecoveryKey(text);
    expect(parsed.ok && parsed.secret.equals(secret)).toBe(true);
  });

  it('round-trips the all-zero and all-ones secrets', () => {
    for (const fill of [0, 255]) {
      const secret = Buffer.alloc(16, fill);
      const parsed = parseRecoveryKey(formatRecoveryKey(secret));
      expect(parsed.ok && parsed.secret.equals(secret)).toBe(true);
    }
  });

  it('accepts lower case, spaces, no dashes and O/I/L look-alikes', () => {
    const secret = Buffer.from('00112233445566778899aabbccddeeff', 'hex');
    const text = formatRecoveryKey(secret);
    const messy = ` ${text.toLowerCase().replace(/-/g, ' ')} `
      .replace(/0/g, 'o')
      .replace(/1/g, 'l');
    const parsed = parseRecoveryKey(messy);
    expect(parsed.ok && parsed.secret.equals(secret)).toBe(true);
  });

  it('catches a typo with the check characters', () => {
    const text = formatRecoveryKey(newRecoverySecret());
    // Index 5 = first char of the 2nd group (index 0 only carries 3 bits, so it can overflow instead).
    const typo = text[5] === 'A' ? 'B' : 'A';
    expect(parseRecoveryKey(text.slice(0, 5) + typo + text.slice(6))).toEqual({
      ok: false,
      error: 'checksum',
    });
  });

  it('rejects wrong length and bad characters', () => {
    expect(parseRecoveryKey('ABCD-EFGH')).toEqual({ ok: false, error: 'invalidFormat' });
    expect(parseRecoveryKey('U'.repeat(28))).toEqual({ ok: false, error: 'invalidFormat' });
    // Value above 128 bits.
    expect(parseRecoveryKey('Z'.repeat(28))).toEqual({ ok: false, error: 'invalidFormat' });
  });
});
