import { useState } from 'react';
import { AuthLayout } from '../components/AuthLayout';
import type { PageId } from '../components/Sidebar';
import { t } from '../i18n';
import { DoneStep } from '../onboarding/DoneStep';
import { nextStep, stepStates, type OnboardingStep } from '../onboarding/flow';
import { PasswordStep } from '../onboarding/PasswordStep';
import { RecoveryKeyStep } from '../onboarding/RecoveryKeyStep';

// First-run setup: master password → recovery key → done.
// Shown by App while no vault exists. The core creates the vault (and keeps it unlocked);
// `onFinish` tells App to re-check the vault and show the normal pages.
export const WelcomePage = (props: { onFinish: (page: PageId) => void }): React.JSX.Element => {
  const [step, setStep] = useState<OnboardingStep>('password');
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const createWithPassword = async (password: string): Promise<void> => {
    setBusy(true);
    setSubmitError(null);
    const res = await window.syncvault.rpc('vault.create', { password });
    setBusy(false);
    if (!res.ok) {
      setSubmitError(t('pages.welcome.password.errors.createFailed'));
      return;
    }
    if (!res.value.ok) {
      setSubmitError(t('pages.welcome.password.errors.exists'));
      return;
    }
    setRecoveryKey(res.value.recoveryKey);
    setStep(nextStep);
  };

  const finish = (): void => {
    setRecoveryKey(null); // don't keep the key in memory longer than needed
    setStep(nextStep);
  };

  const steps = stepStates(step).map((s) => ({ label: t(`auth.steps.${s.step}`), state: s.state }));

  return (
    <AuthLayout steps={steps}>
      {step === 'password' && (
        <PasswordStep
          onSubmit={(pw) => void createWithPassword(pw)}
          busy={busy}
          submitError={submitError}
        />
      )}
      {step === 'recoveryKey' && recoveryKey !== null && (
        <RecoveryKeyStep recoveryKey={recoveryKey} onContinue={finish} />
      )}
      {step === 'done' && <DoneStep onAddAccount={() => props.onFinish('accounts')} />}
    </AuthLayout>
  );
};
