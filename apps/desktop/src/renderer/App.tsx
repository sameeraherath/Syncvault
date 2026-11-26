import { useCallback, useEffect, useState } from 'react';
import type { CoreState, VaultState } from '@syncvault/shared';
import { Card } from './components/Page';
import { Sidebar, type PageId } from './components/Sidebar';
import { StatusCard } from './components/StatusCard';
import { TrayNotice } from './components/TrayNotice';
import { useCoreState } from './hooks/useCoreState';
import { t } from './i18n';
import { AccountsPage } from './pages/Accounts';
import { ActivityPage } from './pages/Activity';
import { DashboardPage } from './pages/Dashboard';
import { FilesPage } from './pages/Files';
import { SettingsPage } from './pages/Settings';
import { UnlockPage } from './pages/Unlock';
import { WelcomePage } from './pages/Welcome';

// TODO(ui): Add account and New sync folder flows.
type PageProps = { onNavigate: (id: PageId) => void; onLocked: () => void };
const pages: Record<PageId, (props: PageProps) => React.JSX.Element> = {
  dashboard: DashboardPage,
  files: FilesPage,
  accounts: AccountsPage,
  activity: ActivityPage,
  settings: SettingsPage,
};

/**
 * Vault gate: no vault → Welcome, locked → Unlock, unlocked → the app.
 * Re-checked whenever the core (re)connects: a restarted core always starts locked. Each answer is
 * tied to the core-state event it was asked for, so a stale "unlocked" can never outlive a restart.
 */
const useVaultState = (): { vault: VaultState | null; refresh: () => void } => {
  const core = useCoreState();
  const [answer, setAnswer] = useState<{ core: CoreState; state: VaultState } | null>(null);
  const refresh = useCallback((): void => {
    const askedFor = core;
    void window.syncvault
      .rpc('vault.status')
      .then((res) => setAnswer(res.ok ? { core: askedFor, state: res.value.state } : null));
  }, [core]);
  useEffect(() => {
    if (core.state === 'connected') refresh();
  }, [core, refresh]);
  const vault = core.state === 'connected' && answer?.core === core ? answer.state : null;
  return { vault, refresh };
};

export const App = (): React.JSX.Element => {
  const { vault, refresh } = useVaultState();
  const [page, setPage] = useState<PageId>('dashboard');

  if (vault === 'none') {
    return (
      <WelcomePage
        onFinish={(next) => {
          setPage(next);
          refresh();
        }}
      />
    );
  }
  if (vault === 'locked') {
    return (
      <UnlockPage
        onUnlocked={() => {
          setPage('dashboard');
          refresh();
        }}
      />
    );
  }
  if (vault === null) {
    return (
      <main className="h-full overflow-y-auto p-8" aria-live="polite">
        <div className="mx-auto max-w-xl">
          <Card className="mb-6">
            <p className="text-text-muted dark:text-white/70">{t('app.loading')}</p>
          </Card>
          {/* Shows why, if the core can't start. */}
          <StatusCard />
        </div>
      </main>
    );
  }

  const Page = pages[page];
  return (
    <div className="flex h-full">
      <Sidebar current={page} onNavigate={setPage} />
      <main className="flex-1 overflow-y-auto p-8" aria-live="polite">
        <TrayNotice />
        <Page onNavigate={setPage} onLocked={refresh} />
      </main>
    </div>
  );
};
