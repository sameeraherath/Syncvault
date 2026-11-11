import { useId, useState } from 'react';
import { PrimaryButton, SecondaryButton } from '../components/Page';
import { t } from '../i18n';
import { PreviewNotice, StepHeading } from './StepParts';

type CopyState = 'idle' | 'copied' | 'failed';

export const RecoveryKeyStep = (props: {
  recoveryKey: string;
  onContinue: () => void;
}): React.JSX.Element => {
  const id = useId();
  const [saved, setSaved] = useState(false);
  const [copy, setCopy] = useState<CopyState>('idle');

  const copyKey = (): void => {
    navigator.clipboard.writeText(props.recoveryKey).then(
      () => setCopy('copied'),
      () => setCopy('failed'),
    );
  };

  return (
    <div>
      <StepHeading>{t('pages.welcome.recoveryKey.title')}</StepHeading>
      <p className="mb-4 text-text-muted dark:text-white/70">
        {t('pages.welcome.recoveryKey.body')}
      </p>
      <PreviewNotice />

      <p id={`${id}-label`} className="mb-1 text-sm font-medium">
        {t('pages.welcome.recoveryKey.label')}
      </p>
      <div className="flex items-center gap-2">
        <p
          aria-labelledby={`${id}-label`}
          className="flex-1 select-all break-all rounded-md border border-border bg-page p-3 font-mono text-sm dark:border-ink dark:bg-ink"
        >
          {props.recoveryKey}
        </p>
        <SecondaryButton onClick={copyKey}>
          {copy === 'copied'
            ? t('pages.welcome.recoveryKey.copied')
            : t('pages.welcome.recoveryKey.copy')}
        </SecondaryButton>
      </div>
      <p aria-live="polite" className="mt-1 min-h-5 text-sm text-warning-text">
        {copy === 'failed' ? t('pages.welcome.recoveryKey.copyFailed') : ''}
      </p>

      <label className="mt-4 flex min-h-touch cursor-pointer items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={saved}
          onChange={(e) => setSaved(e.target.checked)}
          className="size-4"
        />
        {t('pages.welcome.recoveryKey.confirm')}
      </label>

      <div className="mt-6 flex justify-end">
        <PrimaryButton onClick={props.onContinue} disabled={!saved}>
          {t('pages.welcome.continue')}
        </PrimaryButton>
      </div>
    </div>
  );
};
