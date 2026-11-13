import { useEffect, useState } from 'react';
import type { Account, HistoryEntry } from '@syncvault/shared';
import { ActivityRow } from '../components/ActivityRow';
import { Card, PageHeader, PrimaryButton } from '../components/Page';
import type { PageId } from '../components/Sidebar';
import {
  lastSyncAt,
  overallState,
  rpcDashboardSource,
  type DashboardData,
  type DashboardSource,
  type OverallState,
  type SyncFolderSummary,
} from '../dashboard/data';
import { CloudIcon } from '../files/icons';
import { useCoreState } from '../hooks/useCoreState';
import { t } from '../i18n';

/**
 * Demo data exists only in development builds. In production `import.meta.env.DEV` is the constant
 * `false`, so Vite removes this dynamic import and dashboard/mockDashboard.ts is never bundled.
 */
const loadDemoSource: (() => Promise<DashboardSource>) | null = import.meta.env.DEV
  ? async () => (await import('../dashboard/mockDashboard')).mockDashboardSource
  : null;

type Load =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'ready'; data: DashboardData };

const relativeFormat = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
];
const timeAgo = (ms: number): string => {
  const diff = ms - Date.now();
  for (const [unit, size] of UNITS) {
    if (Math.abs(diff) >= size) return relativeFormat.format(Math.round(diff / size), unit);
  }
  return relativeFormat.format(0, 'minute');
};

// Blue is for actions only: problems use warning orange, real failures red.
const overallTone: Record<OverallState, string> = {
  empty: 'border-l-border bg-card dark:border-l-ink dark:bg-ink-raised',
  ok: 'border-l-border bg-card dark:border-l-ink dark:bg-ink-raised',
  syncing: 'border-l-border bg-card dark:border-l-ink dark:bg-ink-raised',
  paused: 'border-l-warning-text bg-warning-bg text-warning-text',
  error: 'border-l-error-text bg-error-bg text-error-text',
};

const StatusSummary = (props: { folders: SyncFolderSummary[] }): React.JSX.Element => {
  const overall = overallState(props.folders);
  const last = lastSyncAt(props.folders);
  return (
    <section
      aria-live="polite"
      className={`mb-6 rounded-xl border border-l-4 border-border p-6 dark:border-ink-raised ${overallTone[overall]}`}
    >
      <h2 className="text-lg font-semibold">{t(`pages.dashboard.overall.${overall}`)}</h2>
      {overall !== 'empty' && (
        <p className="mt-1 text-sm opacity-80">
          {last === null
            ? t('pages.dashboard.neverSynced')
            : t('pages.dashboard.lastSync', { time: timeAgo(last) })}
        </p>
      )}
    </section>
  );
};

const Connected = (props: { accounts: Account[]; onAddAccount: () => void }): React.JSX.Element => (
  <section aria-labelledby="dash-connected" className="mb-6">
    <h2 id="dash-connected" className="mb-3 font-semibold">
      {t('pages.dashboard.connected')}
    </h2>
    {props.accounts.length > 0 ? (
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-3">
        {props.accounts.map((a) => (
          <li
            key={a.id}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 dark:border-ink-raised dark:bg-ink-raised"
          >
            <CloudIcon />
            <div className="min-w-0">
              <p className="truncate font-medium">{t(`pages.files.providers.${a.provider}`)}</p>
              <p className="truncate text-sm text-text-muted dark:text-white/70">{a.displayName}</p>
            </div>
          </li>
        ))}
      </ul>
    ) : (
      <div className="flex flex-wrap items-center gap-4">
        <p className="text-sm text-text-muted dark:text-white/70">
          {t('pages.dashboard.noAccounts')}
        </p>
        <PrimaryButton onClick={props.onAddAccount}>
          {t('pages.dashboard.addAccount')}
        </PrimaryButton>
      </div>
    )}
  </section>
);

const TodayActivity = (props: { entries: HistoryEntry[] }): React.JSX.Element => (
  <section aria-labelledby="dash-today">
    <h2 id="dash-today" className="mb-3 font-semibold">
      {t('pages.dashboard.today')}
    </h2>
    <Card>
      {props.entries.length === 0 ? (
        <p className="text-text-muted dark:text-white/70">{t('pages.dashboard.noActivityToday')}</p>
      ) : (
        <ol className="flex flex-col gap-1">
          {props.entries.map((entry) => (
            <ActivityRow key={entry.id} entry={entry} timeOnly />
          ))}
        </ol>
      )}
    </Card>
  </section>
);

// What the user needs at a glance: is everything in sync, what is connected, what happened today.
export const DashboardPage = (props: { onNavigate: (id: PageId) => void }): React.JSX.Element => {
  const core = useCoreState();
  const [demo, setDemo] = useState(loadDemoSource !== null);
  const [demoSource, setDemoSource] = useState<DashboardSource | null>(null);
  const [load, setLoad] = useState<Load>({ state: 'loading' });

  useEffect(() => {
    if (!demo || demoSource || !loadDemoSource) return;
    void loadDemoSource().then(setDemoSource);
  }, [demo, demoSource]);

  const source = demo ? demoSource : rpcDashboardSource;
  const ready = demo ? demoSource !== null : core.state === 'connected';

  useEffect(() => {
    if (!source || !ready) return;
    let live = true;
    void source.load().then((res) => {
      if (live)
        setLoad(
          res.ok ? { state: 'ready', data: res.value } : { state: 'error', message: res.error },
        );
    });
    return () => {
      live = false;
    };
  }, [source, ready]);

  const toggleDemo = (on: boolean): void => {
    setDemo(on);
    setLoad({ state: 'loading' });
  };

  return (
    <>
      <PageHeader title={t('pages.dashboard.title')} />

      {loadDemoSource && (
        <div className="mb-6 flex flex-wrap items-center gap-4 rounded-md bg-warning-bg p-3 text-sm text-warning-text">
          <label className="flex min-h-touch cursor-pointer items-center gap-2 font-medium">
            <input
              type="checkbox"
              checked={demo}
              onChange={(e) => toggleDemo(e.target.checked)}
              className="size-4"
            />
            {t('pages.dashboard.demo.toggle')}
          </label>
          {demo && <span>{t('pages.dashboard.demo.notice')}</span>}
        </div>
      )}

      {load.state === 'loading' && (
        <p className="text-text-muted dark:text-white/70">{t('pages.dashboard.loading')}</p>
      )}
      {load.state === 'error' && (
        <p role="alert" className="rounded-md bg-error-bg p-3 text-sm text-error-text">
          {t('pages.dashboard.loadError', { message: load.message })}
        </p>
      )}
      {load.state === 'ready' && (
        <>
          <StatusSummary folders={load.data.folders} />
          <Connected
            accounts={load.data.accounts}
            onAddAccount={() => props.onNavigate('accounts')}
          />
          <TodayActivity entries={load.data.today} />
        </>
      )}
    </>
  );
};
