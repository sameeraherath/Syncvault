import { useId, useState, type FormEvent } from 'react';
import { AuthLayout } from '../components/AuthLayout';
import { PrimaryButton, SecondaryButton, inputClass } from '../components/Page';
import { t } from '../i18n';
import { MIN_PASSWORD_LENGTH, validatePassword } from '../onboarding/flow';
import { StepHeading } from '../onboarding/StepParts';

/**
 * Shown while a vault exists but is locked (every app start, after "Lock now", after a core restart).
 * Passwords and the recovery key live only in this component's state and are never logged.
 */
export const UnlockPage = (props: { onUnlocked: () => void }): React.JSX.Element => {
  const [mode, setMode] = useState<'password' | 'recover'>('password');
  return (
    <AuthLayout>
      {mode === 'password' ? (
        <PasswordForm onUnlocked={props.onUnlocked} onForgot={() => setMode('recover')} />
      ) : (
        <RecoverForm onUnlocked={props.onUnlocked} onBack={() => setMode('password')} />
      )}
    </AuthLayout>
  );
};

const ErrorText = (props: { id: string; text: string | null }): React.JSX.Element | null =>
  props.text ? (
    <p
      id={props.id}
      role="alert"
      className="mt-3 rounded-md bg-error-bg p-3 text-sm text-error-text"
    >
      {props.text}
    </p>
  ) : null;

const ShowToggle = (props: {
  checked: boolean;
  onChange: (v: boolean) => void;
}): React.JSX.Element => (
  <label className="mt-2 flex min-h-touch cursor-pointer items-center gap-2 text-sm">
    <input
      type="checkbox"
      checked={props.checked}
      onChange={(e) => props.onChange(e.target.checked)}
      className="size-4"
    />
    {t('pages.unlock.show')}
  </label>
);

const PasswordForm = (props: {
  onUnlocked: () => void;
  onForgot: () => void;
}): React.JSX.Element => {
  const id = useId();
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (password === '' || busy) return;
    setBusy(true);
    setError(null);
    const res = await window.syncvault.rpc('vault.unlock', { password });
    setBusy(false);
    if (res.ok && res.value.ok) {
      setPassword('');
      props.onUnlocked();
      return;
    }
    setError(
      res.ok && !res.value.ok
        ? t(`pages.unlock.errors.${res.value.reason}`)
        : t('pages.unlock.errors.failed'),
    );
  };

  return (
    <form onSubmit={(e) => void submit(e)} noValidate>
      <StepHeading>{t('pages.unlock.title')}</StepHeading>
      <p className="mb-4 text-text-muted dark:text-white/70">{t('pages.unlock.body')}</p>
      <label htmlFor={`${id}-pw`} className="mb-1 block text-sm font-medium">
        {t('pages.unlock.label')}
      </label>
      <input
        id={`${id}-pw`}
        type={visible ? 'text' : 'password'}
        autoComplete="current-password"
        autoFocus
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        aria-invalid={error !== null}
        aria-describedby={error ? `${id}-err` : undefined}
        className={inputClass}
      />
      <ShowToggle checked={visible} onChange={setVisible} />
      <ErrorText id={`${id}-err`} text={error} />
      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <SecondaryButton onClick={props.onForgot} disabled={busy}>
          {t('pages.unlock.forgot')}
        </SecondaryButton>
        <PrimaryButton type="submit" disabled={busy || password === ''}>
          {busy ? t('pages.unlock.busy') : t('pages.unlock.submit')}
        </PrimaryButton>
      </div>
    </form>
  );
};

const RecoverForm = (props: { onUnlocked: () => void; onBack: () => void }): React.JSX.Element => {
  const id = useId();
  const [recoveryKey, setRecoveryKey] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (busy) return;
    if (recoveryKey.trim() === '') {
      setError(t('pages.unlock.recover.errors.invalidKey'));
      return;
    }
    const valid = validatePassword(password, confirm);
    if (!valid.ok) {
      setError(t(`pages.welcome.password.errors.${valid.error}`, { min: MIN_PASSWORD_LENGTH }));
      return;
    }
    setBusy(true);
    setError(null);
    const res = await window.syncvault.rpc('vault.recover', {
      recoveryKey,
      newPassword: password,
    });
    setBusy(false);
    if (res.ok && res.value.ok) {
      setRecoveryKey('');
      setPassword('');
      setConfirm('');
      props.onUnlocked();
      return;
    }
    setError(
      res.ok && !res.value.ok
        ? t(`pages.unlock.recover.errors.${res.value.reason}`)
        : t('pages.unlock.recover.errors.failed'),
    );
  };

  const type = visible ? 'text' : 'password';
  return (
    <form onSubmit={(e) => void submit(e)} noValidate>
      <StepHeading>{t('pages.unlock.recover.title')}</StepHeading>
      <p className="mb-4 text-text-muted dark:text-white/70">{t('pages.unlock.recover.body')}</p>

      <label htmlFor={`${id}-key`} className="mb-1 block text-sm font-medium">
        {t('pages.unlock.recover.keyLabel')}
      </label>
      <input
        id={`${id}-key`}
        type="text"
        autoComplete="off"
        spellCheck={false}
        value={recoveryKey}
        onChange={(e) => setRecoveryKey(e.target.value)}
        className={`${inputClass} mb-4 font-mono`}
      />

      <label htmlFor={`${id}-pw`} className="mb-1 block text-sm font-medium">
        {t('pages.unlock.recover.newPasswordLabel')}
      </label>
      <input
        id={`${id}-pw`}
        type={type}
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        aria-describedby={`${id}-hint`}
        className={inputClass}
      />
      <p id={`${id}-hint`} className="mb-4 mt-1 text-sm text-text-muted dark:text-white/70">
        {t('pages.welcome.password.hint', { min: MIN_PASSWORD_LENGTH })}
      </p>

      <label htmlFor={`${id}-confirm`} className="mb-1 block text-sm font-medium">
        {t('pages.unlock.recover.confirmLabel')}
      </label>
      <input
        id={`${id}-confirm`}
        type={type}
        autoComplete="new-password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        className={inputClass}
      />
      <ShowToggle checked={visible} onChange={setVisible} />
      <ErrorText id={`${id}-err`} text={error} />

      <div className="mt-6 flex justify-between">
        <SecondaryButton onClick={props.onBack} disabled={busy}>
          {t('pages.unlock.recover.back')}
        </SecondaryButton>
        <PrimaryButton type="submit" disabled={busy}>
          {busy ? t('pages.unlock.busy') : t('pages.unlock.recover.submit')}
        </PrimaryButton>
      </div>
    </form>
  );
};
