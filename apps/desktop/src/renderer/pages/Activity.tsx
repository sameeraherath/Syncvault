import { useCallback, useEffect, useState } from 'react';
import type { HistoryEntry, HistoryEvent } from '@syncvault/shared';
import { Card, EmptyState, PageHeader, PrimaryButton } from '../components/Page';
import { useCoreState } from '../hooks/useCoreState';
import { t } from '../i18n';

type Load =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'ready'; entries: HistoryEntry[] };

// Failures in error colours, "paused, needs review" in warning orange; blue stays for actions only.
const toneClass = (event: HistoryEvent): string => {
  switch (event) {
    case 'sync.failed':
      return 'border-l-error-text';
    case 'sync.paused':
      return 'border-l-warning-text';
    default:
      return 'border-l-border dark:border-l-ink';
  }
};

const timeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

const EntryRow = (props: { entry: HistoryEntry }): React.JSX.Element => {
  const { entry } = props;
  const date = new Date(entry.createdAt);
  return (
    <li
      className={`flex flex-wrap items-baseline gap-x-4 gap-y-1 border-l-4 py-3 pl-4 ${toneClass(entry.event)}`}
    >
      <time
        dateTime={date.toISOString()}
        className="w-44 shrink-0 text-sm text-text-muted dark:text-white/70"
      >
        {timeFormat.format(date)}
      </time>
      <span className="font-medium">{t(`pages.activity.events.${entry.event}`)}</span>
      {entry.folderName !== null && <span className="font-mono text-sm">{entry.folderName}</span>}
    </li>
  );
};

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
              <EntryRow key={entry.id} entry={entry} />
            ))}
          </ol>
        </Card>
      )}
    </>
  );
};
