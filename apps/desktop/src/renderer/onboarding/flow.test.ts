import { describe, expect, it } from 'vitest';
import { MIN_PASSWORD_LENGTH, nextStep, stepStates, validatePassword } from './flow';

describe('onboarding steps', () => {
  it('starts at the password and moves forward to done', () => {
    expect(nextStep('password')).toBe('recoveryKey');
    expect(nextStep('recoveryKey')).toBe('done');
    expect(nextStep('done')).toBe('done');
  });

  it('marks steps done, current and upcoming', () => {
    const states = (s: Parameters<typeof stepStates>[0]): string[] =>
      stepStates(s).map((x) => x.state);
    expect(states('password')).toEqual(['current', 'upcoming', 'upcoming']);
    expect(states('recoveryKey')).toEqual(['done', 'current', 'upcoming']);
    // On the final screen everything is finished.
    expect(states('done')).toEqual(['done', 'done', 'done']);
  });
});

describe('validatePassword', () => {
  const good = 'a'.repeat(MIN_PASSWORD_LENGTH);

  it('accepts a long enough, matching password', () => {
    expect(validatePassword(good, good).ok).toBe(true);
  });

  it('rejects a password that is too short', () => {
    const short = 'a'.repeat(MIN_PASSWORD_LENGTH - 1);
    expect(validatePassword(short, short)).toEqual({ ok: false, error: 'tooShort' });
  });

  it('rejects an empty password', () => {
    expect(validatePassword('', '')).toEqual({ ok: false, error: 'tooShort' });
  });

  it('rejects a confirmation that does not match', () => {
    expect(validatePassword(good, `${good}x`)).toEqual({ ok: false, error: 'mismatch' });
  });

  it('reports tooShort before mismatch', () => {
    expect(validatePassword('abc', 'xyz')).toEqual({ ok: false, error: 'tooShort' });
  });

  it('counts characters, not UTF-16 units', () => {
    // 11 emoji = 22 UTF-16 units, but only 11 characters.
    const emoji = '🔒'.repeat(MIN_PASSWORD_LENGTH - 1);
    expect(validatePassword(emoji, emoji)).toEqual({ ok: false, error: 'tooShort' });
  });
});
