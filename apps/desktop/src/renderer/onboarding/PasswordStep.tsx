import { useId, useState, type FormEvent } from 'react';
import { PrimaryButton, SecondaryButton } from '../components/Page';
import { t } from '../i18n';
import { MIN_PASSWORD_LENGTH, validatePassword, type PasswordError } from './flow';
import { PreviewNotice, StepHeading } from './StepParts';

const inputClass =
  'min-h-touch w-full rounded-md border border-border bg-card px-3 text-base dark:border-ink dark:bg-ink aria-[invalid=true]:border-error-text';

/**
 * The password lives only in this component's state. It is passed to `onSubmit` once
 * and is dropped when the step unmounts. Never log it.
 */
export const PasswordStep = (props: {
  onBack: () => void;
  onSubmit: (password: string) => void;
  busy: boolean;
  submitError: string | null;
}): React.JSX.Element => {
  const id = useId();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [visible, setVisible] = useState(false);
  // Only show validation errors after the first submit, not while the user is typing.
  const [error, setError] = useState<PasswordError | null>(null);

  const ids = {
    password: `${id}-password`,
    confirm: `${id}-confirm`,
    hint: `${id}-hint`,
    error: `${id}-error`,
  };

  const submit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    const res = validatePassword(password, confirm);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setError(null);
    props.onSubmit(password);
  };

  const errorText = error
    ? t(`pages.welcome.password.errors.${error}`, { min: MIN_PASSWORD_LENGTH })
    : props.submitError;
  const type = visible ? 'text' : 'password';

  return (
    <form onSubmit={submit} noValidate>
      <StepHeading>{t('pages.welcome.password.title')}</StepHeading>
      <p className="mb-4 text-text-muted dark:text-white/70">{t('pages.welcome.password.body')}</p>
      <PreviewNotice />

      <label htmlFor={ids.password} className="mb-1 block text-sm font-medium">
        {t('pages.welcome.password.label')}
      </label>
      <input
        id={ids.password}
        type={type}
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        aria-invalid={error === 'tooShort'}
        aria-describedby={error === 'tooShort' ? `${ids.hint} ${ids.error}` : ids.hint}
        className={inputClass}
      />
      <p id={ids.hint} className="mb-4 mt-1 text-sm text-text-muted dark:text-white/70">
        {t('pages.welcome.password.hint', { min: MIN_PASSWORD_LENGTH })}
      </p>

      <label htmlFor={ids.confirm} className="mb-1 block text-sm font-medium">
        {t('pages.welcome.password.confirmLabel')}
      </label>
      <input
        id={ids.confirm}
        type={type}
        autoComplete="new-password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        aria-invalid={error === 'mismatch'}
        aria-describedby={error === 'mismatch' ? ids.error : undefined}
        className={inputClass}
      />

      <label className="mt-2 flex min-h-touch cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={visible}
          onChange={(e) => setVisible(e.target.checked)}
          className="size-4"
        />
        {t('pages.welcome.password.show')}
      </label>

      {errorText && (
        <p
          id={ids.error}
          role="alert"
          className="mt-2 rounded-md bg-error-bg p-3 text-sm text-error-text"
        >
          {errorText}
        </p>
      )}

      <p className="mt-4 rounded-md bg-warning-bg p-3 text-sm text-warning-text">
        {t('pages.welcome.password.warning')}
      </p>

      <div className="mt-6 flex justify-between">
        <SecondaryButton onClick={props.onBack} disabled={props.busy}>
          {t('pages.welcome.back')}
        </SecondaryButton>
        <PrimaryButton type="submit" disabled={props.busy}>
          {t('pages.welcome.continue')}
        </PrimaryButton>
      </div>
    </form>
  );
};
