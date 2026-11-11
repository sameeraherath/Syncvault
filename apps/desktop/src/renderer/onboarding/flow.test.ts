import { describe, expect, it } from 'vitest';
import { MIN_PASSWORD_LENGTH, nextStep, prevStep, stepNumber, validatePassword } from './flow';

describe('onboarding steps', () => {
  it('moves forward through every step and stops at done', () => {
    expect(nextStep('intro')).toBe('password');
    expect(nextStep('password')).toBe('recoveryKey');
    expect(nextStep('recoveryKey')).toBe('done');
    expect(nextStep('done')).toBe('done');
  });

  it('moves back and stops at intro', () => {
    expect(prevStep('recoveryKey')).toBe('password');
    expect(prevStep('password')).toBe('intro');
    expect(prevStep('intro')).toBe('intro');
  });

  it('numbers the counted steps and not the done screen', () => {
    expect(stepNumber('intro')).toBe(1);
    expect(stepNumber('password')).toBe(2);
    expect(stepNumber('recoveryKey')).toBe(3);
    expect(stepNumber('done')).toBeNull();
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
