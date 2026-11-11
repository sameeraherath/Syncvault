import { useState } from 'react';
import { Sidebar, type PageId } from './components/Sidebar';
import { TrayNotice } from './components/TrayNotice';
import { AccountsPage } from './pages/Accounts';
import { ActivityPage } from './pages/Activity';
import { DashboardPage } from './pages/Dashboard';
import { SettingsPage } from './pages/Settings';
import { SyncFoldersPage } from './pages/SyncFolders';
import { WelcomePage } from './pages/Welcome';

// TODO(ui): Add account and New sync folder flows; show Welcome on first run only.
type PageProps = { onNavigate: (id: PageId) => void };
const pages: Record<PageId, (props: PageProps) => React.JSX.Element> = {
  welcome: WelcomePage,
  dashboard: DashboardPage,
  syncFolders: SyncFoldersPage,
  accounts: AccountsPage,
  activity: ActivityPage,
  settings: SettingsPage,
};

export const App = (): React.JSX.Element => {
  const [page, setPage] = useState<PageId>('dashboard');
  const Page = pages[page];
  return (
    <div className="flex h-full">
      <Sidebar current={page} onNavigate={setPage} />
      <main className="flex-1 overflow-y-auto p-8" aria-live="polite">
        <TrayNotice />
        <Page onNavigate={setPage} />
      </main>
    </div>
  );
};
