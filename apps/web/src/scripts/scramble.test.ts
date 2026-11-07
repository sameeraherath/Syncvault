import { describe, expect, it } from 'vitest';
import { SCRAMBLE_ALPHABET, scrambleFrame } from './scramble';

describe('scrambleFrame', () => {
  const target = 'k3v9q0x7m2a1...';

  it('returns the target when finished', () => {
    expect(scrambleFrame(target, 1)).toBe(target);
    expect(scrambleFrame(target, 5)).toBe(target);
  });

  it('keeps length and punctuation while scrambling', () => {
    const frame = scrambleFrame(target, 0, () => 0);
    expect(frame).toHaveLength(target.length);
    expect(frame.endsWith('...')).toBe(true);
    expect(frame.slice(0, 12)).toBe(SCRAMBLE_ALPHABET.charAt(0).repeat(12));
  });

  it('settles characters from left to right', () => {
    const frame = scrambleFrame('abcdef', 0.5, () => 0.99);
    expect(frame.slice(0, 3)).toBe('abc');
    expect(frame.slice(3)).not.toBe('def');
  });
});

describe('randomCipher', () => {
  it('returns base32-like noise of the requested length', async () => {
    const { randomCipher } = await import('./scramble');
    const c = randomCipher(12);
    expect(c).toHaveLength(12);
    expect(c).toMatch(/^[a-z0-9]+$/);
  });
});
