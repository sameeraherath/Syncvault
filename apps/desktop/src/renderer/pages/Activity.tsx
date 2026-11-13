import { useCallback, useEffect, useState } from 'react';
import type { HistoryEntry } from '@syncvault/shared';
import { ActivityRow } from '../components/ActivityRow';
import { Card, EmptyState, PageHeader, PrimaryButton } from '../components/Page';
import { useCoreState } from '../hooks/useCoreState';
import { t } from '../i18n';

type Load =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'ready'; entries: HistoryEntry[] };

export const ActivityPage = (): React.JSX.Element => {
  const core = useCoreState();
  const [load, setLoad] = useState<Load>({ state: 'loading' });

  // State is only set when the response arrives (never synchronously inside the effect).
  const fetchHistory = useCallback(() => {
    void window.syncvault
      .rpc('history.list')
      .then((res) =>
        setLoad(
          res.ok
            ? { state: 'ready', entries: res.value.entries }
            : { state: 'error', message: res.error.message },
        ),
      );
  }, []);

  const refresh = (): void => {
    setLoad({ state: 'loading' });
    fetchHistory();
  };

  // Load once the core is connected. No polling: live updates arrive with the sync engine.
  useEffect(() => {
    if (core.state === 'connected') fetchHistory();
  }, [core.state, fetchHistory]);

  const connected = core.state === 'connected';

  return (
    <>
      <PageHeader
        title={t('pages.activity.title')}
        action={
          <PrimaryButton onClick={refresh} disabled={!connected || load.state === 'loading'}>
            {t('pages.activity.refresh')}
          </PrimaryButton>
        }
      />
      {load.state === 'loading' && (
        <Card>
          <p className="text-text-muted dark:text-white/70">{t('pages.activity.loading')}</p>
        </Card>
      )}
      {load.state === 'error' && (
        <p role="alert" className="rounded-md bg-error-bg p-3 text-sm text-error-text">
          {t('pages.activity.error', { message: load.message })}
        </p>
      )}
      {load.state === 'ready' && load.entries.length === 0 && (
        <EmptyState text={t('pages.activity.empty')} />
      )}
      {load.state === 'ready' && load.entries.length > 0 && (
        <Card>
          <ol aria-label={t('pages.activity.listLabel')} className="flex flex-col gap-1">
            {load.entries.map((entry) => (
              <ActivityRow key={entry.id} entry={entry} />
            ))}
          </ol>
        </Card>
      )}
    </>
  );
};
