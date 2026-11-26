import { MIN_PASSWORD_LENGTH, err, ok, type Result } from '@syncvault/shared';

export { MIN_PASSWORD_LENGTH };

/** Pure onboarding logic (no React) so it can be unit-tested in Node. */

export const ONBOARDING_STEPS = ['password', 'recoveryKey', 'done'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export type StepState = 'done' | 'current' | 'upcoming';

/** Forward only: password is the first step, and once it's submitted the vault exists. */
export const nextStep = (step: OnboardingStep): OnboardingStep => {
  const i = ONBOARDING_STEPS.indexOf(step);
  return ONBOARDING_STEPS[Math.min(i + 1, ONBOARDING_STEPS.length - 1)] ?? step;
};

/** State of every step for the progress list. On the done screen, every step is done. */
export const stepStates = (
  current: OnboardingStep,
): { step: OnboardingStep; state: StepState }[] => {
  const i = ONBOARDING_STEPS.indexOf(current);
  const last = ONBOARDING_STEPS.length - 1;
  return ONBOARDING_STEPS.map((step, j) => ({
    step,
    state: j < i || (i === last && j === last) ? 'done' : j === i ? 'current' : 'upcoming',
  }));
};

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
