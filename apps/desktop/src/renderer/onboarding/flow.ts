import { err, ok, type Result } from '@syncvault/shared';

/** Pure onboarding logic (no React) so it can be unit-tested in Node. */

export const ONBOARDING_STEPS = ['intro', 'password', 'recoveryKey', 'done'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/** Steps that count towards "Step X of Y" (the done screen is not a step). */
export const COUNTED_STEPS = [
  'intro',
  'password',
  'recoveryKey',
] as const satisfies readonly OnboardingStep[];

export const nextStep = (step: OnboardingStep): OnboardingStep => {
  const i = ONBOARDING_STEPS.indexOf(step);
  return ONBOARDING_STEPS[Math.min(i + 1, ONBOARDING_STEPS.length - 1)] ?? step;
};

export const prevStep = (step: OnboardingStep): OnboardingStep => {
  const i = ONBOARDING_STEPS.indexOf(step);
  return ONBOARDING_STEPS[Math.max(i - 1, 0)] ?? step;
};

/** 1-based position for "Step X of Y", or null for the done screen. */
export const stepNumber = (step: OnboardingStep): number | null => {
  const i = (COUNTED_STEPS as readonly OnboardingStep[]).indexOf(step);
  return i === -1 ? null : i + 1;
};

export const MIN_PASSWORD_LENGTH = 12;

export type PasswordError = 'tooShort' | 'mismatch';

export const validatePassword = (
  password: string,
  confirm: string,
): Result<void, PasswordError> => {
  // Count code points, not UTF-16 units, so emoji / non-Latin scripts count fairly.
  if ([...password].length < MIN_PASSWORD_LENGTH) return err('tooShort');
  if (password !== confirm) return err('mismatch');
  return ok(undefined);
};
