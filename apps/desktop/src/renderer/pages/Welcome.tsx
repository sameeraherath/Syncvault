import { useState } from 'react';
import { Card } from '../components/Page';
import type { PageId } from '../components/Sidebar';
import { t } from '../i18n';
import { DoneStep } from '../onboarding/DoneStep';
import {
  COUNTED_STEPS,
  nextStep,
  prevStep,
  stepNumber,
  type OnboardingStep,
} from '../onboarding/flow';
import { IntroStep } from '../onboarding/IntroStep';
import { createVault } from '../onboarding/mockVault';
import { PasswordStep } from '../onboarding/PasswordStep';
import { RecoveryKeyStep } from '../onboarding/RecoveryKeyStep';

// First-run onboarding: intro → master password → recovery key → done.
// TODO(ui): show Welcome automatically on first run only (needs a core 'vault.status' RPC).
export const WelcomePage = (props: { onNavigate: (id: PageId) => void }): React.JSX.Element => {
  const [step, setStep] = useState<OnboardingStep>('intro');
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const createWithPassword = async (password: string): Promise<void> => {
    setBusy(true);
    setSubmitError(null);
    const res = await createVault(password);
    setBusy(false);
    if (!res.ok) {
      setSubmitError(
        t('pages.welcome.password.errors.createFailed', { message: res.error.message }),
      );
      return;
    }
    setRecoveryKey(res.value.recoveryKey);
    setStep(nextStep);
  };

  const finish = (): void => {
    setRecoveryKey(null); // don't keep the key in memory longer than needed
    setStep(nextStep);
  };

  const current = stepNumber(step);

  return (
    <Card className="mx-auto max-w-xl">
      {current !== null && (
        <p className="mb-4 text-sm text-text-muted dark:text-white/70">
          {t('pages.welcome.stepOf', { current, total: COUNTED_STEPS.length })}
        </p>
      )}
      {step === 'intro' && <IntroStep onStart={() => setStep(nextStep)} />}
      {step === 'password' && (
        <PasswordStep
          onBack={() => setStep(prevStep)}
          onSubmit={(pw) => void createWithPassword(pw)}
          busy={busy}
          submitError={submitError}
        />
      )}
      {step === 'recoveryKey' && recoveryKey !== null && (
        <RecoveryKeyStep recoveryKey={recoveryKey} onContinue={finish} />
      )}
      {step === 'done' && <DoneStep onAddAccount={() => props.onNavigate('accounts')} />}
    </Card>
  );
};
