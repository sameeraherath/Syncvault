import { useEffect, useState } from 'react';
import type { Account } from '@syncvault/shared';
import { Card, EmptyState, PrimaryButton } from '../components/Page';
import { t } from '../i18n';
import { CloudIcon } from './icons';
import type { FilesSource } from './source';

type Load =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'ready'; accounts: Account[] };

/**
 * Linked accounts shown as "drives". The parent remounts this component (via `key`) when the
 * data source changes, so it always starts in the loading state.
 */
export const DriveList = (props: {
  source: FilesSource;
  /** False while the real core is not connected yet (demo data is always ready). */
  ready: boolean;
  onOpen: (account: Account) => void;
  onAddAccount: () => void;
}): React.JSX.Element => {
  const { source, ready } = props;
  const [load, setLoad] = useState<Load>({ state: 'loading' });

  useEffect(() => {
    if (!ready) return;
    let live = true;
    void source.listAccounts().then((res) => {
      if (!live) return;
      setLoad(
        res.ok ? { state: 'ready', accounts: res.value } : { state: 'error', message: res.error },
      );
    });
    return () => {
      live = false;
    };
  }, [source, ready]);

  if (load.state === 'loading') {
    return (
      <Card>
        <p className="text-text-muted dark:text-white/70">{t('pages.files.loading')}</p>
      </Card>
    );
  }
  if (load.state === 'error') {
    return (
      <p role="alert" className="rounded-md bg-error-bg p-3 text-sm text-error-text">
        {t('pages.files.loadError', { message: load.message })}
      </p>
    );
  }
  if (load.accounts.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4">
        <EmptyState text={t('pages.files.empty')} />
        <PrimaryButton onClick={props.onAddAccount}>{t('pages.files.addAccount')}</PrimaryButton>
      </div>
    );
  }
  return (
    <ul
      aria-label={t('pages.files.drivesLabel')}
      className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-4"
    >
      {load.accounts.map((account) => (
        <li key={account.id}>
          <button
            type="button"
            onClick={() => props.onOpen(account)}
            className="flex min-h-touch w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left hover:border-primary hover:bg-primary-light dark:border-ink-raised dark:bg-ink-raised dark:hover:border-primary-bright dark:hover:bg-ink"
          >
            <CloudIcon />
            <span className="flex flex-col">
              <span className="font-semibold">
                {t(`pages.files.providers.${account.provider}`)}
              </span>
              <span className="text-sm text-text-muted dark:text-white/70">
                {account.displayName}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
};
